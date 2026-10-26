import Link from "next/link";
import {
  assignPartnerTicketAction,
  partnerResponseTargetAction,
  retryPartnerNoticesAction,
} from "@/lib/actions/partner-operations-actions";
import { guardAdminPage } from "@/lib/admin-page-guard";
import { requireAdminCapability } from "@/lib/admin-session";
import { query } from "@/lib/custom/service";
import { staffPartnerTicketAction } from "@/lib/actions/partner-ticket-actions";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; priority?: string; q?: string }>;
}) {
  const filters = await searchParams;
  await guardAdminPage("manage_support");
  const a = await requireAdminCapability("manage_support");
  const tickets = await query(
    `SELECT t.*,p.name,(t.updated_at<now()-make_interval(hours=>(SELECT response_hours FROM partner_support_settings WHERE id=true))) AS overdue FROM partner_tickets t JOIN affiliates p ON p.id=t.partner_id WHERE ($1='owner' OR(t.sensitive=false AND(t.assigned_to IS NULL OR t.assigned_to=$2))) AND($3='' OR t.status=$3) AND($4='' OR t.priority=$4) AND($5='' OR p.name ILIKE '%'||$5||'%' OR t.category ILIKE '%'||$5||'%') ORDER BY t.updated_at DESC LIMIT 100`,
    [
      a.role,
      a.id,
      filters.status || "",
      filters.priority || "",
      (filters.q || "").slice(0, 100),
    ],
  );
  const messages = await query(
    `SELECT m.* FROM partner_ticket_messages m JOIN partner_tickets t ON t.id=m.ticket_id WHERE $1='owner' OR(t.sensitive=false AND(t.assigned_to IS NULL OR t.assigned_to=$2)) ORDER BY m.id`,
    [a.role, a.id],
  );
  const settings = (
    await query(
      "SELECT response_hours FROM partner_support_settings WHERE id=true",
    )
  )[0];
  const staff =
    a.role === "owner"
      ? await query(
          "SELECT id,name,role FROM admin_users WHERE disabled_at IS NULL AND role IN('owner','support') ORDER BY name",
        )
      : [];
  const attachments = await query(
    `SELECT f.id,f.ticket_id,f.file_name FROM partner_ticket_attachments f JOIN partner_tickets t ON t.id=f.ticket_id WHERE $1='owner' OR(t.sensitive=false AND(t.assigned_to IS NULL OR t.assigned_to=$2)) ORDER BY f.created_at DESC LIMIT 200`,
    [a.role, a.id],
  );
  return (
    <div className="space-y-5 text-ink">
      <h1 className="text-3xl font-semibold">Partner support queue</h1>
      <Link href="/admin/support" className="underline">
        Install JKTL and enable team notifications
      </Link>
      <p>
        Internal response target: {String(settings?.response_hours || 48)}{" "}
        hours.{" "}
        {
          tickets.filter(
            (t) =>
              !["CLOSED", "RESOLVED"].includes(String(t.status)) &&
              Boolean(t.overdue),
          ).length
        }{" "}
        visible tickets exceed the target.
      </p>
      <form className="flex flex-wrap gap-3">
        <label>
          Status
          <input
            name="status"
            defaultValue={filters.status}
            placeholder="OPEN, IN_PROGRESS…"
            className="block rounded border border-border bg-paper p-2"
          />
        </label>
        <label>
          Priority
          <select
            name="priority"
            defaultValue={filters.priority || ""}
            className="block rounded border border-border bg-paper p-2"
          >
            <option value="">All</option>
            {["LOW", "NORMAL", "HIGH"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Partner or category
          <input
            name="q"
            defaultValue={filters.q}
            className="block rounded border border-border bg-paper p-2"
          />
        </label>
        <button className="rounded border border-border p-2">
          Filter tickets
        </button>
      </form>
      {a.role === "owner" && (
        <form
          action={partnerResponseTargetAction}
          className="flex flex-wrap gap-3"
        >
          <label>
            Internal response hours
            <input
              type="number"
              min={1}
              max={720}
              required
              name="hours"
              defaultValue={Number(settings?.response_hours || 48)}
              className="ml-2 rounded border border-border bg-paper p-2"
            />
          </label>
          <button className="rounded border border-border p-2">
            Save target
          </button>
        </form>
      )}
      <form
        action={async () => {
          "use server";
          await retryPartnerNoticesAction();
        }}
      >
        <button className="rounded border border-border p-2">
          Retry queued notifications
        </button>
      </form>
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
                {m.kind === "STAFF" ? "TEAM" : String(m.kind)}: {m.kind === "EVENT" && m.body === "Staff assignment updated" ? "Team assignment updated" : String(m.body)}
              </p>
            ))}
          <div>
            {attachments
              .filter((f) => f.ticket_id === t.id)
              .map((f) => (
                <a
                  className="my-2 block underline"
                  key={String(f.id)}
                  href={"/api/partners/attachments/" + f.id}
                >
                  {String(f.file_name)}
                </a>
              ))}
          </div>
          {a.role === "owner" && (
            <form
              action={assignPartnerTicketAction}
              className="flex flex-wrap gap-3"
            >
              <input type="hidden" name="id" value={String(t.id)} />
              <label>
                Assign team
                <select
                  name="assignedTo"
                  required
                  defaultValue={String(t.assigned_to || "")}
                  className="ml-2 rounded border border-border bg-paper p-2"
                >
                  <option value="" disabled>
                    Choose team
                  </option>
                  {staff
                    .filter((s) => !t.sensitive || s.role === "owner")
                    .map((s) => (
                      <option key={String(s.id)} value={String(s.id)}>
                        {String(s.name)} · {String(s.role)}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Priority
                <select
                  name="priority"
                  defaultValue={String(t.priority)}
                  className="ml-2 rounded border border-border bg-paper p-2"
                >
                  {["LOW", "NORMAL", "HIGH"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <button className="rounded border border-border p-2">
                Assign / update priority
              </button>
            </form>
          )}
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
              <input type="checkbox" name="internal" /> Internal team note
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
