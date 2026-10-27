import { guardAdminPage } from "@/lib/admin-page-guard";
import { query } from "@/lib/custom/service";
import { requireAdminCapability } from "@/lib/admin-session";
import { ActionForm } from "@/components/distribution/action-form";
import {
  setAffiliatePrivilegesAction,
  affiliateActivitySettingsAction,
  reviewAffiliateActivityAction,
  monitorAffiliateActivityAction,
} from "@/lib/actions/affiliate-activity-actions";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    state?: string;
    loginBefore?: string;
    activityBefore?: string;
  }>;
}) {
  const filters = await searchParams;
  const state = ["ACTIVE", "WARNED", "DORMANT", "SUSPENDED", "EXEMPT"].includes(
    filters.state || "",
  )
    ? filters.state
    : "";
  const date = (v?: string) =>
    v &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(new Date(v).getTime()) &&
    new Date(v).toISOString().slice(0, 10) === v
      ? v
      : "";

  await guardAdminPage("manage_affiliates");
  const a = await requireAdminCapability("manage_affiliates");
  const s = (
    await query("SELECT * FROM affiliate_activity_settings WHERE id=true")
  )[0];
  const rows = await query(
    "SELECT a.id,a.name,a.status,x.state,x.exempt,x.last_qualified_at,a.last_login_at last_login FROM affiliates a LEFT JOIN affiliate_activity x ON x.affiliate_id=a.id WHERE a.programme='affiliate' AND($1='' OR $1='EXEMPT' AND COALESCE(x.exempt,true) OR x.state=$1) AND($2='' OR a.last_login_at IS NULL OR a.last_login_at<NULLIF($2,'')::date) AND($3='' OR x.last_qualified_at IS NULL OR x.last_qualified_at<NULLIF($3,'')::date) ORDER BY x.last_qualified_at NULLS LAST LIMIT 100",
    [state, date(filters.loginBefore), date(filters.activityBefore)],
  );
  const input = "block rounded border border-border bg-paper p-3";
  return (
    <div className="space-y-5 text-ink">
      <h1 className="text-3xl font-semibold">Affiliate activity settings</h1>
      <form className="flex flex-wrap gap-4">
        <label>
          Activity state
          <select className={input} name="state" defaultValue={state}>
            <option value="">All states</option>
            {["ACTIVE", "WARNED", "DORMANT", "SUSPENDED", "EXEMPT"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Last sign-in before
          <input
            className={input}
            type="date"
            name="loginBefore"
            defaultValue={date(filters.loginBefore)}
          />
        </label>
        <label>
          Last qualified activity before
          <input
            className={input}
            type="date"
            name="activityBefore"
            defaultValue={date(filters.activityBefore)}
          />
        </label>
        <button className={input}>Filter accounts</button>
      </form>
      <p>
        Legacy accounts are exempt by default. Qualified referral visits,
        signups and verified conversions count as activity. Financial records,
        Business accounts and customer subscriptions are preserved. Removing an
        exemption requires an Owner review of the applicable agreement.
      </p>
      {a.role === "owner" && (
        <ActionForm
          action={affiliateActivitySettingsAction}
          className="space-y-3"
        >
          {[
            [
              "reminder",
              "Invitation reminder after (days)",
              s.invitation_reminder_days,
            ],
            [
              "expiry",
              "New invitations expire after (days)",
              s.invitation_expiry_days,
            ],
            ["warning", "Warning after", s.warning_days],
            ["dormant", "Dormant after", s.dormant_days],
            [
              "suspend",
              "Additional days before suspension",
              s.suspend_after_days,
            ],
          ].map(([name, label, value]) => (
            <label key={String(name)} className="block">
              {label}
              <input
                className={input}
                name={String(name)}
                type="number"
                required
                defaultValue={Number(value)}
              />
            </label>
          ))}
          <label className="block">
            <input
              name="automatic"
              type="checkbox"
              defaultChecked={Boolean(s.automatic_suspension)}
            />
            Enable automatic suspension for reviewed, nonexempt agreements
          </label>
          <button className={input}>Save activity settings</button>
        </ActionForm>
      )}
      <ActionForm action={monitorAffiliateActivityAction}>
        <button className={input}>Run activity review</button>
      </ActionForm>
      {rows.map((r) => (
        <article
          key={String(r.id)}
          className="space-y-3 rounded border border-border p-4"
        >
          <h2>
            {String(r.name)} · {String(r.status)} ·{" "}
            {String(r.state || "EXEMPT")}
          </h2>
          <p>
            Last sign-in:{" "}
            {r.last_login
              ? new Date(String(r.last_login)).toLocaleDateString()
              : "No recorded sign-in"}{" "}
            · Last qualified activity:{" "}
            {r.last_qualified_at
              ? new Date(String(r.last_qualified_at)).toLocaleDateString()
              : "No tracked activity"}{" "}
            · {r.exempt !== false ? "Exempt" : "Monitored"}
          </p>
          {a.role === "owner" && (
            <ActionForm
              action={setAffiliatePrivilegesAction}
              className="space-y-3"
            >
              <input name="id" type="hidden" value={String(r.id)} />
              <input
                name="status"
                type="hidden"
                value={r.status === "active" ? "suspended" : "active"}
              />
              <textarea
                name="note"
                className={input}
                minLength={20}
                maxLength={2000}
                required
                placeholder="Reviewed reason for privilege change"
              />
              <button className={input}>
                {r.status === "active"
                  ? "Suspend Affiliate privileges"
                  : "Reactivate Affiliate privileges"}
              </button>
            </ActionForm>
          )}
          {a.role === "owner" && (
            <ActionForm
              action={reviewAffiliateActivityAction}
              className="space-y-3"
            >
              <input name="id" type="hidden" value={String(r.id)} />
              <label className="block">
                <input
                  name="exempt"
                  type="checkbox"
                  defaultChecked={r.exempt !== false}
                />
                Exempt from inactivity actions
              </label>
              <label className="block">
                <input name="reviewed" type="checkbox" required />I reviewed the
                actual agreement’s inactivity provisions
              </label>
              <textarea
                className={input}
                name="note"
                minLength={20}
                maxLength={2000}
                placeholder="Contract review and reason"
                required
              />
              <button className={input}>Save reviewed exemption</button>
            </ActionForm>
          )}
        </article>
      ))}
    </div>
  );
}
