import { guardAdminPage } from "@/lib/admin-page-guard";
import { requireAdminCapability } from "@/lib/admin-session";
import { can } from "@/lib/admin-permissions";
import { query } from "@/lib/custom/service";
import { ActionForm } from "@/components/distribution/action-form";
import { retryComposedEmailFormAction } from "@/lib/actions/email-compose-actions";
export const dynamic = "force-dynamic";
export default async function Page() {
  await guardAdminPage("compose_email");
  const a = await requireAdminCapability("compose_email"),
    global = can(a.role, "manage_communications", a.permissions);
  const messages = await query(
    `SELECT c.id,c.subject,c.audience,c.message_kind,c.status,c.created_at,jsonb_array_length(c.recipients) recipient_count,
 count(n.id) FILTER(WHERE n.submitted_at IS NOT NULL) submitted_count,count(n.id) FILTER(WHERE n.send_state='ACCEPTED') accepted_count,
 count(n.id) FILTER(WHERE n.send_state='FAILED' AND n.suppressed_at IS NULL) failed_count,count(n.id) FILTER(WHERE n.send_state IN('UNKNOWN','SUBMITTING')) uncertain_count,
 count(n.id) FILTER(WHERE n.suppressed_at IS NOT NULL) suppressed_count
 FROM affiliate_campaigns c LEFT JOIN distribution_program_notices n ON n.composed_id=c.id WHERE c.interface='emails' AND($1::boolean OR c.created_by=$2)
 GROUP BY c.id ORDER BY c.created_at DESC LIMIT 100`,
    [global, a.id],
  );
  const failures = global
    ? await query(
        "SELECT composed_id,recipient_email,send_state,last_error,provider_message_id,attempts FROM distribution_program_notices WHERE composed_id IS NOT NULL AND send_state IN('FAILED','UNKNOWN','SUBMITTING') ORDER BY id DESC LIMIT 200",
      )
    : [];
  const legacy = await query(
    `SELECT c.id,c.subject,c.body,c.status,c.created_at,jsonb_array_length(c.recipients) recipients,
    count(n.id) FILTER(WHERE n.delivered_at IS NOT NULL) provider_accepted
    FROM affiliate_campaigns c LEFT JOIN distribution_program_notices n ON n.event_key LIKE 'affiliate-campaign-'||c.id::text||'-%'
    WHERE c.interface='affiliate' AND($1::boolean OR c.created_by=$2) GROUP BY c.id ORDER BY c.created_at DESC LIMIT 100`,
    [global, a.id],
  );
  const history = global
    ? await query(
        "SELECT recipient,subject,category,provider_state,provider_message_id,error_code,created_at FROM email_send_history ORDER BY created_at DESC LIMIT 200",
      )
    : [];
  return (
    <section className="space-y-5">
      <h2 className="text-2xl font-semibold">Email History</h2>
      <p>
        Provider acceptance is not delivery. Delivery status remains unconfirmed
        unless a verified provider delivery event is available. Unknown
        submissions are held for provider review; this page never retries them.
      </p>
      {messages.map((m) => (
        <details
          key={String(m.id)}
          className="rounded-xl border border-border bg-paper p-4"
        >
          <summary>
            {String(m.subject)} · {String(m.audience)} · {String(m.status)}
          </summary>
          <p>
            {String(m.created_at)} · {String(m.message_kind)}
          </p>
          <p>
            Recipients: {String(m.recipient_count)} · Submitted:{" "}
            {String(m.submitted_count)} · Provider accepted:{" "}
            {String(m.accepted_count)} · Failed: {String(m.failed_count)} ·
            Pending confirmation: {String(m.uncertain_count)} · Suppressed:{" "}
            {String(m.suppressed_count)}
          </p>
          {failures
            .filter((f) => f.composed_id === m.id)
            .map((f, i) => (
              <p key={i} className="my-2 text-sm">
                {String(f.recipient_email)} · {String(f.send_state)} ·{" "}
                {String(f.last_error || "Awaiting provider confirmation")} ·
                Attempts {String(f.attempts)}
              </p>
            ))}
          {Number(m.failed_count) > 0 && (
            <ActionForm action={retryComposedEmailFormAction}>
              <label className="flex gap-3">
                <input type="hidden" name="id" value={String(m.id)} />
                <input name="confirm" type="checkbox" required /> Retry only
                confirmed rejections or pre-submission failures. Accepted and
                uncertain messages are excluded.
              </label>
              <button>Retry eligible failures</button>
            </ActionForm>
          )}
        </details>
      ))}
      {legacy.length > 0 && (
        <details>
          <summary>Earlier Affiliate emails and drafts</summary>
          <p>
            Existing queued notices keep their original delivery workflow.
            Unsent drafts are retained here for review; copy a draft into
            Compose Email to recheck current recipients and consent.
          </p>
          {legacy.map((m) => (
            <article
              key={String(m.id)}
              className="my-3 rounded border border-border p-3"
            >
              <p>
                {String(m.subject)} · {String(m.created_at)} ·{" "}
                {String(m.status)}
              </p>
              <p>
                Recipients: {String(m.recipients)} · Provider accepted:{" "}
                {String(m.provider_accepted)}. Acceptance is not delivery.
              </p>
              {m.status === "DRAFT" && (
                <pre className="whitespace-pre-wrap">{String(m.body)}</pre>
              )}
            </article>
          ))}
        </details>
      )}
      {global && (
        <details>
          <summary>Recent system and role email submissions</summary>
          {history.map((h, i) => (
            <article key={i} className="my-3 rounded border border-border p-3">
              <p>
                {String(h.created_at)} · {String(h.recipient)} ·{" "}
                {String(h.subject)}
              </p>
              <p>
                {String(h.category)} · {String(h.provider_state)} · Provider ID:{" "}
                {String(h.provider_message_id || "Not recorded")} ·{" "}
                {String(h.error_code || "")}
              </p>
            </article>
          ))}
        </details>
      )}
    </section>
  );
}
