import Link from "next/link";
import { guardAdminPage } from "@/lib/admin-page-guard";
import { query } from "@/lib/custom/service";
import { lifecycleInstalled, lifecycleConfig } from "@/lib/lifecycle/service";
import {
  lifecycleMessage,
  STAGES,
  type LifecycleStage,
} from "@/lib/lifecycle/model";
import { ActionForm } from "@/components/distribution/action-form";
import {
  configureLifecycleAction,
  scanLifecycleAction,
  dispatchLifecycleAction,
  reviewLifecycleMailAction,
  pauseLifecycleAction,
} from "@/lib/actions/lifecycle-actions";
export const dynamic = "force-dynamic";
export default async function Page() {
  await guardAdminPage("manage_communications");
  if (!(await lifecycleInstalled()))
    return (
      <p>
        Install the latest platform migration to configure account follow-ups.
      </p>
    );
  const settings = await lifecycleConfig(),
    meta = (
      await query(
        "SELECT *, (last_scan_at IS NULL OR last_scan_at<now()-interval '36 hours') stale FROM lifecycle_settings WHERE id=true",
      )
    )[0],
    renewals = (
      await query(
        "SELECT enabled,last_scan_at FROM renewal_settings WHERE id=true",
      )
    )[0],
    accounts = await query(
      `SELECT a.*,c.business_name,c.has_domain FROM lifecycle_accounts a JOIN lifecycle_current c USING(organization_id) ORDER BY a.stage_started_at LIMIT 200`,
    ),
    events = await query(
      "SELECT e.*,c.business_name FROM lifecycle_events e LEFT JOIN lifecycle_current c USING(organization_id) ORDER BY e.created_at DESC LIMIT 100",
    ),
    counts = await query(
      "SELECT stage,count(*)::int n FROM lifecycle_current GROUP BY stage",
    );
  const card = "rounded-2xl border border-border bg-paper p-5",
    input = "w-full rounded-lg border border-border bg-paper p-3 text-ink",
    button = "rounded-lg border border-border px-4 py-2 font-semibold";
  const date = (value: unknown) =>
    value
      ? new Intl.DateTimeFormat("en-NG", {
          timeZone: "Africa/Lagos",
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(String(value)))
      : "Not run yet";
  return (
    <section className="space-y-6 text-ink">
      <header>
        <h2 className="text-2xl font-semibold">Account journey & follow-ups</h2>
        <p className="mt-3 text-sm leading-relaxed">
          Help accounts choose a website, finish publishing and consider a
          custom domain. Each account has its own stage clock; moving forward
          cancels old follow-ups. New accounts enter the journey automatically.
        </p>
        <Link
          href="/admin/support/follow-ups"
          className="mt-3 inline-block text-blue-600 underline"
        >
          Human follow-up queue →
        </Link>
      </header>
      <section className={card}>
        <h3 className="font-semibold">Automation schedule</h3>
        <p className="my-3 text-sm">
          Last account check: {date(meta.last_scan_at)} · Last email processing:{" "}
          {date(meta.last_dispatch_at)} · Renewal check:{" "}
          {date(renewals?.last_scan_at)}
        </p>
        {settings.enabled && meta.stale && (
          <p role="alert" className="my-3 text-amber-700">
            The daily account check needs attention. Verify the scheduled job
            and run a check below.
          </p>
        )}
        <ActionForm action={configureLifecycleAction}>
          <label className="block">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={settings.enabled}
            />{" "}
            Automatic account follow-up emails
          </label>
          <div className="my-4 grid gap-3 sm:grid-cols-4">
            {[
              ["first_days", "First reminder", settings.first_days],
              ["second_days", "Second reminder", settings.second_days],
              ["human_days", "Human follow-up", settings.human_days],
              ["gap_days", "Minimum email gap", settings.gap_days],
            ].map(([name, label, value]) => (
              <label key={String(name)} className="text-sm">
                {label} (days)
                <input
                  className={input}
                  name={String(name)}
                  type="number"
                  min="1"
                  max="90"
                  required
                  defaultValue={Number(value)}
                />
              </label>
            ))}
          </div>
          <label className="block">
            <input
              type="checkbox"
              name="renewals"
              defaultChecked={Boolean(renewals?.enabled)}
            />{" "}
            Automatic renewals for domains, hosting, email and tracked
            subscriptions
          </label>
          <p className="my-3 text-sm leading-relaxed">
            Renewals use recorded service dates and the existing 30/14/7/1-day,
            due-date and overdue windows. After a renewal updates the next date,
            a new cycle begins. Account reminders never replace a selected
            design or publish a site.
          </p>
          <button className={button}>Save automation settings</button>
        </ActionForm>
        <div className="mt-4 flex flex-wrap gap-3">
          <ActionForm action={scanLifecycleAction}>
            <button className={button}>
              Check accounts & queue due follow-ups
            </button>
          </ActionForm>
          <ActionForm action={dispatchLifecycleAction}>
            <button className={button}>Process due email queue</button>
          </ActionForm>
          <Link href="/admin/emails/renewals" className={button}>
            Review renewals
          </Link>
        </div>
      </section>
      <section className={card}>
        <h3 className="font-semibold">Current journey</h3>
        <div className="my-3 flex flex-wrap gap-4">
          {counts.map((row) => (
            <p key={String(row.stage)}>
              {STAGES[row.stage as LifecycleStage]}: <b>{Number(row.n)}</b>
            </p>
          ))}
        </div>
        <p className="text-sm leading-relaxed">
          The first observation starts each stage clock, so existing accounts
          are not emailed in a backdated batch. First and second messages are
          limited to one per stage step, with a shared recipient cooldown.
          Domain offers require marketing permission. Opt-outs and suppressed
          addresses are respected. Replies go to your configured Reply-To; pause
          an account if the team is already helping.
        </p>
        <div className="mt-4 space-y-3">
          {accounts.map((a) => (
            <div
              key={String(a.organization_id)}
              className="rounded-lg border border-border p-3 text-sm"
            >
              <b>{String(a.business_name)}</b> ·{" "}
              {STAGES[a.stage as LifecycleStage]}
              <p>
                Stage observed: {date(a.stage_started_at)}
                {a.paused_until
                  ? " · Paused until " + date(a.paused_until)
                  : ""}
              </p>
              {["NO_SITE", "DRAFT", "FREE_DOMAIN", "CONNECT_DOMAIN"].includes(
                String(a.stage),
              ) && (
                <details className="mt-2">
                  <summary>Preview next follow-up copy</summary>
                  <h4 className="mt-2 font-semibold">
                    {
                      lifecycleMessage(
                        a.stage as LifecycleStage,
                        1,
                        String(a.business_name),
                        Boolean(a.has_domain),
                      ).subject
                    }
                  </h4>
                  <p className="mt-2 whitespace-pre-line">
                    {
                      lifecycleMessage(
                        a.stage as LifecycleStage,
                        1,
                        String(a.business_name),
                        Boolean(a.has_domain),
                      ).detail
                    }
                  </p>
                </details>
              )}
              <ActionForm action={pauseLifecycleAction}>
                <input
                  type="hidden"
                  name="organization"
                  value={String(a.organization_id)}
                />
                <label>
                  Pause setup emails until
                  <input
                    className={input}
                    type="date"
                    name="until"
                    defaultValue={
                      a.paused_until
                        ? new Date(String(a.paused_until))
                            .toISOString()
                            .slice(0, 10)
                        : ""
                    }
                  />
                </label>
                <button className={button}>Save pause / resume</button>
              </ActionForm>
            </div>
          ))}
        </div>
      </section>
      <section className={card}>
        <h3 className="font-semibold">Recent follow-up emails</h3>
        <p className="my-2 text-sm">
          Provider acceptance is recorded separately from inbox delivery.
          Unconfirmed submissions require review before retrying.
        </p>
        {!events.length && <p>No follow-up emails have been queued yet.</p>}
        {events.map((e) => (
          <article
            key={String(e.id)}
            className="mt-3 rounded-lg border border-border p-3 text-sm"
          >
            <b>{String(e.business_name || "Account")}</b> · {String(e.stage)} ·
            Step {Number(e.step)} · <b>{String(e.state)}</b>
            <p>
              {String(e.recipient)} · {date(e.updated_at)}
            </p>
            {["UNKNOWN", "FAILED"].includes(String(e.state)) && (
              <ActionForm action={reviewLifecycleMailAction}>
                <input type="hidden" name="id" value={String(e.id)} />
                <select className={input} name="decision">
                  <option value="ACCEPTED">
                    Provider confirmed acceptance
                  </option>
                  <option value="CANCELLED">Cancel this email</option>
                  <option value="RETRY">
                    Retry after confirming no acceptance
                  </option>
                </select>
                <input
                  className={input}
                  name="reason"
                  minLength={10}
                  maxLength={1000}
                  required
                  placeholder="Provider review note"
                  aria-label="Provider review note"
                />
                <label>
                  <input type="checkbox" name="notAccepted" /> Provider confirms
                  this email was not accepted
                </label>
                <button className={button}>Save reviewed outcome</button>
              </ActionForm>
            )}
          </article>
        ))}
      </section>
    </section>
  );
}
