import "server-only";
import type { Query } from "@/lib/domains/model";
import {
  mailRecipients,
  composeBody,
  authorizeComposeReplyTo,
} from "./compose";
import { can, normaliseRole } from "@/lib/admin-permissions";
import { currentBranding } from "./service";
import type { sendAdminComposedEmail } from "@/lib/email";
// Bound composed-mail throughput within each worker. Queue row leases prevent
// overlap; provider rejections stay visible rather than triggering a burst retry.
let nextSubmissionAt = 0;
async function paceSubmission() {
  const slot = Math.max(Date.now(), nextSubmissionAt);
  nextSubmissionAt = slot + 650;
  const delay = slot - Date.now();
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
}
/** Invoked by the existing programme queue; not another cron or sender. */
export async function deliverComposedNotice(
  q: Query,
  n: Record<string, unknown>,
  send: typeof sendAdminComposedEmail,
) {
  const draft = (
    await q(
      "SELECT c.*,a.role,a.disabled_at,a.staff_revoked_at FROM affiliate_campaigns c JOIN admin_users a ON a.id::text=c.created_by WHERE c.id=$1 AND c.interface='emails'",
      [n.composed_id],
    )
  )[0];
  const role = normaliseRole(draft?.role as string);
  const reject = async (code: string, suppressed = false) => {
    await q(
      "UPDATE distribution_program_notices SET send_state='FAILED',last_error=$2,lease_until=NULL,suppressed_at=CASE WHEN $3 THEN now() ELSE suppressed_at END WHERE id=$1 AND delivered_at IS NULL",
      [n.id, code, suppressed],
    );
    return { accepted: false, failed: !suppressed };
  };
  if (
    !draft ||
    draft.disabled_at ||
    draft.staff_revoked_at ||
    !can(role, "compose_email")
  )
    return reject("AUTHOR_PERMISSION_CHANGED");
  let recipients: string[];
  try {
    recipients = await mailRecipients(
      q,
      role,
      String(draft.audience),
      draft.recipients as string[],
      String(n.recipient_email),
      draft.message_kind as "marketing" | "operational",
    );
  } catch {
    return reject("AUTHOR_OR_RECIPIENT_SCOPE_CHANGED");
  }
  if (!recipients.includes(String(n.recipient_email)))
    return reject("RECIPIENT_NOT_ELIGIBLE", true);
  try {
    authorizeComposeReplyTo(
      role,
      await currentBranding(),
      String(n.reply_to || ""),
    );
  } catch {
    return reject("REPLY_TO_PERMISSION_CHANGED");
  }
  const rendered = composeBody(String(n.detail));
  const claimed = await q(
    "UPDATE distribution_program_notices SET send_state='SUBMITTING',submitted_at=now() WHERE id=$1 AND send_state='QUEUED' AND delivered_at IS NULL RETURNING id",
    [n.id],
  );
  if (!claimed.length) return { accepted: false, failed: false };
  try {
    await paceSubmission();
    const result = await send({
      to: String(n.recipient_email),
      subject: String(n.subject),
      bodyHtml: rendered.html,
      text: rendered.text,
      category: draft.message_kind === "marketing" ? "marketing" : "service",
      replyTo: String(n.reply_to || "") || undefined,
      key: "composed-notice-" + n.id,
    });
    if (result.ok) {
      await q(
        "UPDATE distribution_program_notices SET send_state='ACCEPTED',delivered_at=now(),provider_message_id=$2,lease_until=NULL,last_error=NULL WHERE id=$1",
        [n.id, result.providerId || null],
      );
      return { accepted: true, failed: false };
    }
    await q(
      "UPDATE distribution_program_notices SET send_state=$2,last_error=$3,lease_until=NULL WHERE id=$1 AND delivered_at IS NULL",
      [
        n.id,
        result.uncertain ? "UNKNOWN" : "FAILED",
        result.uncertain
          ? "SUBMISSION_UNCONFIRMED"
          : "PROVIDER_REJECTED_OR_CONFIGURATION",
      ],
    );
    return { accepted: false, failed: true };
  } catch {
    // A crash or database failure after submission must not resend automatically.
    await q(
      "UPDATE distribution_program_notices SET send_state='UNKNOWN',last_error='SUBMISSION_UNCONFIRMED',lease_until=NULL WHERE id=$1 AND delivered_at IS NULL",
      [n.id],
    );
    return { accepted: false, failed: true };
  }
}
export async function recoverComposedSubmissions(q: Query) {
  await q(
    `UPDATE distribution_program_notices n SET
   send_state=CASE WHEN h.provider_state='ACCEPTED' THEN 'ACCEPTED' ELSE 'UNKNOWN' END,
   delivered_at=CASE WHEN h.provider_state='ACCEPTED' THEN COALESCE(n.delivered_at,now()) ELSE n.delivered_at END,
   provider_message_id=COALESCE(n.provider_message_id,h.provider_message_id),lease_until=NULL,
   last_error=CASE WHEN h.provider_state='ACCEPTED' THEN NULL ELSE 'SUBMISSION_UNCONFIRMED' END
   FROM (SELECT n.id,h.provider_state,h.provider_message_id FROM distribution_program_notices n LEFT JOIN email_send_history h ON h.attempt_key='composed-notice-'||n.id::text WHERE n.composed_id IS NOT NULL AND n.send_state='SUBMITTING' AND n.lease_until<now()) h
   WHERE n.id=h.id`,
    [],
  );
}
