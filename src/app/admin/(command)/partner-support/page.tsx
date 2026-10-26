import { guardAdminPage } from "@/lib/admin-page-guard";
import { requireAdminCapability } from "@/lib/admin-session";
import { query } from "@/lib/custom/service";
import { staffPartnerTicketAction } from "@/lib/actions/partner-ticket-actions";
export const dynamic = "force-dynamic";
export default async function Page() {
  await guardAdminPage("manage_support");
  const a = await requireAdminCapability("manage_support");
  const tickets = await query(
    `SELECT t.*,p.name FROM partner_tickets t JOIN affiliates p ON p.id=t.partner_id WHERE $1='owner' OR(t.sensitive=false AND(t.assigned_to IS NULL OR t.assigned_to=$2)) ORDER BY t.updated_at DESC LIMIT 100`,
    [a.role, a.id],
  );
  const messages = await query(
    `SELECT m.* FROM partner_ticket_messages m JOIN partner_tickets t ON t.id=m.ticket_id WHERE $1='owner' OR(t.sensitive=false AND(t.assigned_to IS NULL OR t.assigned_to=$2)) ORDER BY m.id`,
    [a.role, a.id],
  );
  return (
    <div className="space-y-5 text-ink">
      <h1 className="text-3xl font-semibold">Partner support queue</h1>
      <p>
        Support agents can claim unassigned non-sensitive tickets. Sensitive
        issues require Owner access. Responses and status changes retain their
        history.
      </p>
      {tickets.map((t) => (
        <article
          key={String(t.id)}
          className="space-y-3 rounded-xl border border-border p-5"
        >
          <h2 className="font-semibold">
            {String(t.subject)} · {String(t.name)}
          </h2>
          <p>
            {String(t.category)} · {String(t.priority)} · {String(t.status)}
            {t.sensitive ? " · OWNER ESCALATION" : ""}
          </p>
          {messages
            .filter((m) => m.ticket_id === t.id)
            .map((m) => (
              <p
                key={String(m.id)}
                className="whitespace-pre-wrap break-words rounded bg-surface p-3"
              >
                {String(m.kind)}: {String(m.body)}
              </p>
            ))}
          <form action={staffPartnerTicketAction} className="grid gap-3">
            <input type="hidden" name="id" value={String(t.id)} />
            <label>
              Status
              <select
                name="status"
                className="ml-3 rounded border border-border bg-paper p-2"
              >
                {[
                  "ASSIGNED",
                  "IN_PROGRESS",
                  "WAITING_FOR_PARTNER",
                  "WAITING_FOR_CUSTOMER",
                  "WAITING_FOR_PROVIDER",
                  "RESOLVED",
                  "CLOSED",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Response
              <textarea
                required
                name="body"
                maxLength={5000}
                className="block w-full rounded border border-border bg-paper p-3"
              />
            </label>
            <label>
              <input type="checkbox" name="internal" /> Internal staff note
            </label>
            <button className="rounded-lg bg-primary p-3 text-on-primary">
              Claim or update ticket
            </button>
          </form>
        </article>
      ))}
    </div>
  );
}
