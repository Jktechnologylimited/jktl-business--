import Link from "next/link";
import { guardAdminPage } from "@/lib/admin-page-guard";
import { query } from "@/lib/custom/service";
import { lifecycleInstalled } from "@/lib/lifecycle/service";
import { STAGES, type LifecycleStage } from "@/lib/lifecycle/model";
import { ActionForm } from "@/components/distribution/action-form";
import {
  pauseLifecycleAction,
  saveLifecycleHandoffAction,
} from "@/lib/actions/lifecycle-actions";
export const dynamic = "force-dynamic";
export default async function Page() {
  await guardAdminPage("manage_support");
  if (!(await lifecycleInstalled()))
    return (
      <p>Install the latest platform migration to view automated follow-ups.</p>
    );
  const rows = await query(
      `SELECT h.*,c.business_name,c.recipient,c.stage,a.paused_until,(SELECT count(*)::int FROM support_cases s WHERE s.organization_id=h.organization_id AND s.status<>'RESOLVED') open_cases FROM lifecycle_handoffs h LEFT JOIN lifecycle_current c USING(organization_id) LEFT JOIN lifecycle_accounts a USING(organization_id) WHERE h.status<>'DONE' ORDER BY h.created_at LIMIT 150`,
    ),
    team = await query(
      "SELECT id,name FROM admin_users WHERE role IN('owner','support') AND disabled_at IS NULL AND staff_revoked_at IS NULL ORDER BY name",
    );
  const input = "w-full rounded-lg border border-border bg-paper p-3 text-ink",
    button = "rounded-lg border border-border px-4 py-2 font-semibold";
  return (
    <section className="space-y-6 text-ink">
      <header>
        <Link href="/admin/support" className="text-blue-600 underline">
          Support inbox
        </Link>
        <h1 className="my-3 text-3xl font-semibold">Customer follow-ups</h1>
        <p className="text-sm leading-relaxed">
          Accounts that remain stuck, cannot receive an email, have an overdue
          renewal or need provider review. Read existing support conversations
          before reaching out. Website changes and publishing still require the
          customer’s permission.
        </p>
      </header>
      {!rows.length && <p>No human follow-ups are currently due.</p>}
      {rows.map((h) => (
        <article
          key={String(h.id)}
          className="space-y-4 rounded-2xl border border-border bg-paper p-5"
        >
          <h2 className="text-xl font-semibold">
            {String(h.business_name || "Business account")}
          </h2>
          <p>
            {STAGES[h.stage as LifecycleStage] ||
              String(h.stage || "Account review")}{" "}
            · {Number(h.open_cases)} open support cases
          </p>
          <p>{String(h.reason)}</p>
          <p className="text-sm">
            Current owner email: {String(h.recipient || "Needs review")}
            {h.paused_until
              ? " · Automatic follow-ups paused until " +
                String(h.paused_until).slice(0, 10)
              : ""}
          </p>
          <Link
            className="inline-block text-blue-600 underline"
            href="/admin/support"
          >
            Open support inbox to review or contact the customer
          </Link>
          <ActionForm action={saveLifecycleHandoffAction}>
            <input type="hidden" name="id" value={String(h.id)} />
            <input type="hidden" name="revision" value={Number(h.revision)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                Status
                <select
                  className={input}
                  name="status"
                  defaultValue={String(h.status)}
                >
                  <option value="OPEN">Needs contact</option>
                  <option value="IN_PROGRESS">Team is helping</option>
                  <option value="DONE">Handled</option>
                </select>
              </label>
              <label>
                Assign to
                <select
                  className={input}
                  name="assigned"
                  defaultValue={String(h.assigned_to || "")}
                >
                  <option value="">Unassigned</option>
                  {team.map((t) => (
                    <option key={String(t.id)} value={String(t.id)}>
                      {String(t.name)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              Support notes
              <textarea
                className={input}
                name="notes"
                maxLength={2000}
                defaultValue={String(h.notes || "")}
              />
            </label>
            <button className={button}>Save follow-up</button>
          </ActionForm>
          <ActionForm action={pauseLifecycleAction}>
            <input
              type="hidden"
              name="organization"
              value={String(h.organization_id)}
            />
            <label className="block">
              Pause automatic setup emails until
              <input
                className={input}
                name="until"
                type="date"
                aria-label="Pause until"
                defaultValue={
                  h.paused_until
                    ? new Date(String(h.paused_until))
                        .toISOString()
                        .slice(0, 10)
                    : ""
                }
              />
            </label>
            <p className="my-2 text-xs">
              Leave empty to resume. Renewal notices keep their service-date
              schedule.
            </p>
            <button className={button}>Update account pause</button>
          </ActionForm>
        </article>
      ))}
    </section>
  );
}
