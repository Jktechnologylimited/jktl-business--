import { flushProgrammePush } from "./push";
import "server-only";
import { query } from "@/lib/custom/service";
import {
  deliverComposedNotice,
  recoverComposedSubmissions,
} from "@/lib/mail/composed-delivery";
import { sendAdminComposedEmail, sendPartnerNoticeEmail } from "@/lib/email";
export async function flushProgramNotices() {
  const push = await flushProgrammePush().catch(() => ({
    configured: true,
    delivered: 0,
    failed: 1,
  }));
  if (!process.env.RESEND_API_KEY)
    return {
      configured: push.configured,
      delivered: 0,
      failed: push.failed,
      push,
    };
  await recoverComposedSubmissions(query);
  const rows = await query(
    `WITH picked AS(SELECT id FROM distribution_program_notices WHERE delivered_at IS NULL AND suppressed_at IS NULL AND attempts<10 AND(composed_id IS NULL OR send_state='QUEUED') AND(lease_until IS NULL OR lease_until<now()) ORDER BY id LIMIT 20 FOR UPDATE SKIP LOCKED) UPDATE distribution_program_notices n SET lease_until=now()+interval '5 minutes',attempts=attempts+1 FROM picked WHERE n.id=picked.id RETURNING n.*`,
  );
  let delivered = 0,
    failed = 0;
  for (const n of rows) {
    try {
      if (n.composed_id) {
        const r = await deliverComposedNotice(query, n, sendAdminComposedEmail);
        if (r.accepted) delivered++;
        if (r.failed) failed++;
        continue;
      }
      const recipients = n.recipient_email
        ? [{ email: n.recipient_email }]
        : n.audience === "STAFF"
          ? await query(
              "SELECT email FROM admin_users WHERE disabled_at IS NULL AND role IN('owner','affiliate_manager')",
            )
          : await query("SELECT email FROM affiliates WHERE id=$1", [
              n.affiliate_id,
            ]);
      const results = await Promise.all(
        recipients.map((a) =>
          sendPartnerNoticeEmail({
            to: String(a.email || ""),
            subject: String(n.subject),
            detail: String(n.detail),
            path: String(n.path),
            category: [
              "marketing",
              "security",
              "affiliate",
              "internal",
            ].includes(String(n.category))
              ? (n.category as
                  "marketing" | "security" | "affiliate" | "internal")
              : "partner",
            key: "distribution-notice-" + n.id + "-" + String(a.email),
          }),
        ),
      );
      if (
        n.category === "marketing" &&
        results.length > 0 &&
        results.every(
          (r) =>
            !r.ok && r.error === "Marketing preferences prevent this send.",
        )
      ) {
        await query(
          "UPDATE distribution_program_notices SET suppressed_at=now(),lease_until=NULL WHERE id=$1",
          [n.id],
        );
        continue;
      }
      if (recipients.length > 0 && results.every((r) => r.ok)) {
        await query(
          "UPDATE distribution_program_notices SET delivered_at=now(),lease_until=NULL WHERE id=$1",
          [n.id],
        );
        delivered++;
      } else failed++;
    } catch {
      failed++;
    }
  }
  return { configured: true, delivered, failed: failed + push.failed, push };
}
