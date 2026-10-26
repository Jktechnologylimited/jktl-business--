import { query } from "@/lib/custom/service";
import { ActionForm } from "@/components/distribution/action-form";
import {
  assignGrowthRoleAction,
  configureGrowthStaffAction,
} from "@/lib/actions/growth-staff-actions";
import { can, GROWTH_PERMISSIONS } from "@/lib/admin-permissions";
const input = "block w-full rounded-lg border border-border bg-paper p-3";
export async function GrowthStaffManager({ search = "" }: { search?: string }) {
  const staff = await query(
    "SELECT id,name,email,permission_overrides,disabled_at,staff_revoked_at,staff_assigned_at,last_login_at FROM admin_users WHERE role='growth_gaming_lead' ORDER BY staff_assigned_at DESC",
  );
  const found =
    search.length >= 3
      ? await query(
          "SELECT id,name,email FROM users WHERE lower(email)=lower($1) LIMIT 1",
          [search.slice(0, 254)],
        )
      : [];
  const events = await query(
    "SELECT d.actor_id,d.event,d.detail,d.created_at FROM distribution_audit d WHERE d.event LIKE 'STAFF_%' OR d.event LIKE 'GROWTH_%' OR d.event='LEAD_ASSIGNED' ORDER BY d.created_at DESC LIMIT 50",
  );
  return (
    <section className="space-y-5 rounded-xl border border-border bg-paper p-5">
      <h2 className="text-2xl font-semibold">Growth & Gaming staff</h2>
      <p>
        Assign an existing JKTL Business account. This creates a staff profile
        in the existing admin system; the person keeps their Business password.
        Owner administrators control access and permissions.
      </p>
      <form action="/admin/team" className="flex flex-wrap gap-3">
        <label className="min-w-0 flex-1">
          Find an existing account by exact email
          <input
            name="account"
            type="email"
            defaultValue={search}
            required
            className={input}
          />
        </label>
        <button className="rounded-lg border border-border p-3">
          Find account
        </button>
      </form>
      {search && found.length === 0 && (
        <p>
          No matching Business account. Ask the person to{" "}
          <a className="underline" href="/signup">
            create their JKTL account
          </a>
          , then assign access. No passwords are emailed.
        </p>
      )}
      {found.map((u) => (
        <ActionForm
          action={assignGrowthRoleAction}
          key={String(u.id)}
          className="rounded border border-border p-4"
        >
          <p>
            {String(u.name)} · {String(u.email)}
          </p>
          <input type="hidden" name="userId" value={String(u.id)} />
          <button className="mt-3 rounded-lg bg-primary p-3 text-on-primary">
            Assign Growth & Gaming Lead
          </button>
        </ActionForm>
      ))}
      {staff.map((s) => (
        <article
          key={String(s.id)}
          className="space-y-4 rounded-lg border border-border p-5"
        >
          <h3 className="font-semibold">
            {String(s.name)} · {String(s.email)}
          </h3>
          <p>
            Growth & Gaming Lead ·{" "}
            {s.staff_revoked_at
              ? "Revoked"
              : s.disabled_at
                ? "Suspended"
                : "Active"}
          </p>
          <p className="text-sm">
            Assigned: {String(s.staff_assigned_at || "Unavailable")} · Last
            staff login: {String(s.last_login_at || "Not recorded")}
          </p>
          <ActionForm action={configureGrowthStaffAction} className="space-y-3">
            <input type="hidden" name="id" value={String(s.id)} />
            <input type="hidden" name="mode" value="PERMISSIONS" />
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="mb-3 font-semibold">
                Supported permissions
              </legend>
              {GROWTH_PERMISSIONS.map((p) => (
                <label key={p} className="flex gap-2">
                  <input
                    type="checkbox"
                    name="permissions"
                    value={p}
                    defaultChecked={can(
                      "growth_gaming_lead",
                      p,
                      s.permission_overrides as Record<string, boolean>,
                    )}
                  />
                  {p.replace("growth_", "").replaceAll("_", " ")}
                </label>
              ))}
            </fieldset>
            <p className="text-sm">
              The workspace remains accessible so staff can understand their
              permissions. Banking, payouts, rates, prices, security and staff
              management cannot be granted here.
            </p>
            <button className="rounded border border-border p-3">
              Save permissions
            </button>
          </ActionForm>
          <div className="flex flex-wrap gap-3">
            {["SUSPEND", "ENABLE", "REVOKE"].map((mode) => (
              <ActionForm key={mode} action={configureGrowthStaffAction}>
                <input type="hidden" name="id" value={String(s.id)} />
                <input type="hidden" name="mode" value={mode} />
                <button className="rounded border border-border p-2">
                  {mode === "ENABLE"
                    ? "Enable suspended access"
                    : mode === "REVOKE"
                      ? "Revoke role"
                      : "Suspend access"}
                </button>
              </ActionForm>
            ))}
          </div>
        </article>
      ))}
      <details>
        <summary className="font-semibold">Recent staff activity</summary>
        {events.map((e, i) => (
          <article
            key={i}
            className="my-3 rounded border border-border p-3 text-sm"
          >
            <p>
              {String(e.event)} · {String(e.created_at)} · Actor{" "}
              {String(e.actor_id)}
            </p>
            <pre className="whitespace-pre-wrap break-words">
              {JSON.stringify(e.detail)}
            </pre>
          </article>
        ))}
      </details>
    </section>
  );
}
