import { approvedPartner } from "@/lib/partners/access";
import { query } from "@/lib/custom/service";
import {
  createPartnerTicketAction,
  partnerTicketReplyAction,
} from "@/lib/actions/partner-ticket-actions";
export const dynamic = "force-dynamic";
export default async function Page() {
  const p = await approvedPartner();
  const tickets = await query(
    "SELECT id,subject,status,priority FROM partner_tickets WHERE partner_id=$1 ORDER BY updated_at DESC LIMIT 50",
    [p.id],
  );
  const messages = await query(
    "SELECT m.ticket_id,m.kind,m.body,m.created_at FROM partner_ticket_messages m JOIN partner_tickets t ON t.id=m.ticket_id WHERE t.partner_id=$1 AND m.kind<>'NOTE' ORDER BY m.id",
    [p.id],
  );
  const clients = await query(
    "SELECT id,business_name FROM partner_workspaces WHERE partner_id=$1",
    [p.id],
  );
  return (
    <div className="space-y-6 text-ink">
      <h1 className="text-3xl font-semibold">Partner support</h1>
      <p>
        Get help with client setup and JKTL products. Never include passwords,
        payment credentials or mailbox contents. Sensitive billing and security
        requests are escalated to an owner.
      </p>
      <form
        action={createPartnerTicketAction}
        className="grid gap-3 rounded-xl border border-border p-5"
      >
        <label>
          Subject
          <input
            name="subject"
            required
            minLength={5}
            maxLength={160}
            className="block w-full rounded border border-border bg-paper p-3"
          />
        </label>
        <label>
          Client
          <select
            name="workspace"
            className="ml-3 rounded border border-border bg-paper p-2"
          >
            <option value="">Program question</option>
            {clients.map((c) => (
              <option key={String(c.id)} value={String(c.id)}>
                {String(c.business_name)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select
            name="category"
            className="ml-3 rounded border border-border bg-paper p-2"
          >
            {[
              "Website Setup",
              "Website Templates",
              "Website Publishing",
              "Domain Registration",
              "DNS Configuration",
              "Business Email",
              "Hosting",
              "Billing",
              "Client Onboarding",
              "AI Tools",
              "Technical Issue",
              "Product Question",
              "General Assistance",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Priority
          <select
            name="priority"
            defaultValue="NORMAL"
            className="ml-3 rounded border border-border bg-paper p-2"
          >
            {["LOW", "NORMAL", "HIGH"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Issue
          <textarea
            name="body"
            required
            minLength={10}
            maxLength={5000}
            className="block w-full rounded border border-border bg-paper p-3"
          />
        </label>
        <button className="rounded-lg bg-primary p-3 text-on-primary">
          Create ticket
        </button>
      </form>
      {tickets.map((t) => (
        <article
          key={String(t.id)}
          className="space-y-3 rounded-xl border border-border p-5"
        >
          <h2 className="font-semibold">
            {String(t.subject)} · {String(t.status)}
          </h2>
          {messages
            .filter((m) => m.ticket_id === t.id)
            .map((m, n) => (
              <p
                key={n}
                className="whitespace-pre-wrap break-words rounded bg-surface p-3"
              >
                <strong>{String(m.kind)}</strong>
                <br />
                {String(m.body)}
              </p>
            ))}
          {t.status !== "CLOSED" && (
            <form action={partnerTicketReplyAction}>
              <input type="hidden" name="id" value={String(t.id)} />
              <label>
                Reply
                <textarea
                  name="body"
                  required
                  maxLength={5000}
                  className="block w-full rounded border border-border bg-paper p-3"
                />
              </label>
              <button className="mt-3 rounded-lg border border-border p-3">
                {t.status === "RESOLVED" ? "Reopen with reply" : "Send reply"}
              </button>
            </form>
          )}
        </article>
      ))}
    </div>
  );
}
