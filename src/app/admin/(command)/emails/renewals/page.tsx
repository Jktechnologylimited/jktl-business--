import Link from "next/link";
import { guardAdminPage } from "@/lib/admin-page-guard";
import { query } from "@/lib/custom/service";
import { ActionForm } from "@/components/distribution/action-form";
import { renewalInstalled, renewalItem } from "@/lib/renewals/service";
import { renewalKinds, renewalMessage } from "@/lib/renewals/model";
import {
  runRenewalCheckAction,
  confirmRenewalAcceptanceAction,
  configureRenewalsAction,
  sendRenewalAction,
  processRenewalsAction,
  retryRenewalAction,
  saveTrackedRenewalAction,
} from "@/lib/actions/renewal-actions";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    item?: string;
    q?: string;
    kind?: string;
    status?: string;
    edit?: string;
  }>;
}) {
  await guardAdminPage("manage_communications");
  if (!(await renewalInstalled()))
    return (
      <section>
        <h2>Renewals</h2>
        <p>
          Install the latest platform migration to enable renewal monitoring.
        </p>
      </section>
    );
  const params = await searchParams,
    settings = (
      await query(
        "SELECT *,enabled AND(last_scan_at IS NULL OR last_scan_at<now()-interval '36 hours') stale FROM renewal_settings WHERE id=true",
      )
    )[0],
    items = await query(
      `SELECT i.*,r.state,r.updated_at reminded_at,r.last_error FROM renewal_items i LEFT JOIN LATERAL(SELECT state,updated_at,last_error FROM renewal_reminders WHERE item_key=i.item_key AND due_on=i.due_on ORDER BY created_at DESC LIMIT 1)r ON true WHERE ($1='' OR i.name ILIKE '%'||$1||'%' OR i.business_name ILIKE '%'||$1||'%') AND($2='' OR kind=$2) AND($3='' OR($3='missing' AND(due_on IS NULL OR recipient IS NULL OR recipient NOT LIKE '%@%')) OR($3='overdue' AND days_left<0) OR($3='soon' AND days_left BETWEEN 0 AND 30) OR($3='attention' AND r.state IN('FAILED','UNKNOWN','SUBMITTING'))) ORDER BY due_on NULLS FIRST,item_key LIMIT 200`,
      [(params.q || "").slice(0, 120), params.kind || "", params.status || ""],
    );
  const counts = (
      await query(
        `SELECT count(*)::int total,count(*) FILTER(WHERE days_left BETWEEN 0 AND 30)::int soon,count(*) FILTER(WHERE days_left<0)::int overdue,count(*) FILTER(WHERE due_on IS NULL OR recipient IS NULL OR recipient NOT LIKE '%@%')::int missing FROM renewal_items`,
      )
    )[0],
    recent = await query(
      "SELECT r.*,i.name,i.business_name FROM renewal_reminders r LEFT JOIN renewal_items i ON i.item_key=r.item_key ORDER BY r.created_at DESC LIMIT 40",
    ),
    orgs = await query(
      "SELECT o.id,COALESCE(b.display_name,o.name) name FROM organizations o LEFT JOIN business_profiles b ON b.organization_id=o.id ORDER BY name LIMIT 500",
    ),
    preview = params.item ? await renewalItem(params.item) : null,
    editing = params.edit
      ? (
          await query("SELECT * FROM renewal_tracked_services WHERE id=$1", [
            params.edit,
          ])
        )[0]
      : null;
  const message = preview ? renewalMessage(preview) : null,
    stale = Boolean(settings.stale);
  const card = "rounded-xl border border-border bg-paper p-5",
    input = "w-full rounded-lg border border-border bg-paper p-3 text-ink",
    button = "rounded-lg border border-border px-4 py-2 font-semibold";
  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold">Renewals & reminders</h2>
        <p className="mt-2 text-sm text-ink-muted">
          One view of paid domains, hosting, business email, accepted recurring
          custom services and other subscriptions you track. This does not
          charge customers or renew services.
        </p>
      </header>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Tracked services", counts.total],
          ["Due within 30 days", counts.soon],
          ["Overdue", counts.overdue],
          ["Missing date/contact", counts.missing],
        ].map(([label, value]) => (
          <div key={String(label)} className={card}>
            <p className="text-sm">{label}</p>
            <b className="text-2xl">{value}</b>
          </div>
        ))}
      </div>
      <section className={card}>
        <h3 className="font-semibold">Automatic reminders</h3>
        <p className="my-3 text-sm">
          30, 14, 7 and 1 day before renewal, on the due date, and a follow-up
          at 7 days overdue. Missed runs catch up with the current reminder,
          rather than sending every missed message. No reminders are sent
          automatically beyond 30 days overdue.
        </p>
        <p className="text-sm">
          Last automatic check:{" "}
          {settings.last_scan_at
            ? new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Lagos",dateStyle:"medium",timeStyle:"short"}).format(new Date(String(settings.last_scan_at)))+" WAT"
            : "Not yet run"}
        </p>
        {stale && (
          <p role="alert" className="my-3 text-danger">
            The automatic check is overdue. Check the scheduled job and use the
            manual reminder tools below.
          </p>
        )}
        {settings.last_error && (
          <p role="alert">{String(settings.last_error)}</p>
        )}
        <p className="mt-2 text-sm">
          Email provider:{" "}
          {process.env.RESEND_API_KEY
            ? "Configured"
            : "Not configured in this environment"}
          . Scheduled-job secret:{" "}
          {process.env.CRON_SECRET
            ? "Configured"
            : "Not configured in this environment"}
          .
        </p>
        <ActionForm action={configureRenewalsAction} className="mt-4 space-y-3">
          <label className="flex gap-3">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={Boolean(settings.enabled)}
            />
            Enable central automatic reminders
          </label>
          <p className="text-xs text-ink-muted">
            Review dates and contacts first. Existing product reminders continue
            until central reminders take over. Enabling does not send a batch
            immediately.
          </p>
          <button className={button}>Save reminder settings</button>
        </ActionForm>
      </section>
      <ActionForm action={runRenewalCheckAction}>
        <button className={button} disabled={!settings.enabled}>
          Run scheduled renewal check now
        </button>
      </ActionForm>
      <form className="flex flex-wrap gap-3">
        <input
          className={input + " sm:max-w-xs"}
          name="q"
          placeholder="Search business or service"
          aria-label="Search renewals"
          defaultValue={params.q}
        />
        <select
          className={input + " sm:max-w-[180px]"}
          name="kind"
          aria-label="Service type"
          defaultValue={params.kind || ""}
        >
          <option value="">All services</option>
          {Object.entries(renewalKinds).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select
          className={input + " sm:max-w-[180px]"}
          name="status"
          aria-label="Renewal status"
          defaultValue={params.status || ""}
        >
          {[
            ["", "All dates"],
            ["soon", "Due soon"],
            ["overdue", "Overdue"],
            ["missing", "Missing details"],
            ["attention", "Reminder issues"],
          ].map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <button className={button}>Filter</button>
      </form>
      <div className="space-y-3">
        {!items.length && <p>No matching renewals.</p>}
        {items.map((item) => (
          <article className={card} key={String(item.item_key)}>
            <div className="flex flex-wrap justify-between gap-4">
              <div>
                <h3 className="font-semibold">{String(item.name)}</h3>
                <p className="text-sm text-ink-muted">
                  {String(item.business_name)} ·{" "}
                  {renewalKinds[String(item.kind)]}
                </p>
              </div>
              <div className="text-sm">
                <p>
                  Due:{" "}
                  {item.due_on
                    ? String(item.due_on).slice(0, 10)
                    : "Missing renewal date"}
                </p>
                <p>
                  {item.recipient
                    ? String(item.recipient)
                    : "Missing billing contact"}
                </p>
              </div>
            </div>
            <p className="my-3 text-xs">
              Central reminder for this cycle:{" "}
              {item.state === "ACCEPTED"
                ? "Accepted by email provider"
                : String(item.state || "Not yet queued")}
              . Provider acceptance does not confirm inbox delivery.
            </p>
            <div className="flex gap-4 text-sm">
              <Link
                className="text-blue-600 underline"
                href={"?item=" + encodeURIComponent(String(item.item_key))}
              >
                Preview & send reminder
              </Link>
              {String(item.item_key).startsWith("tracked:") && (
                <Link
                  className="underline"
                  href={"?edit=" + String(item.item_key).slice(8)}
                >
                  Edit tracked subscription
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>
      {preview && message && (
        <section className={card}>
          <h3 className="text-xl font-semibold">Reminder preview</h3>
          <p className="my-3">
            To: {String(preview.recipient || "Missing contact")}
          </p>
          <b>{message.subject}</b>
          <p className="my-4 whitespace-pre-line text-sm leading-relaxed">
            {message.detail}
          </p>
          <p className="text-xs">
            Link: https://business.jktl.com.ng{message.path}. Uses your
            configured sender, signature and Reply-To.
          </p>
          <ActionForm action={sendRenewalAction} className="mt-4">
            <input type="hidden" name="item" value={String(preview.item_key)} />
            <button
              className={button}
              disabled={!preview.due_on || !preview.recipient}
            >
              Queue this reminder
            </button>
          </ActionForm>
        </section>
      )}
      <section className={card}>
        <h3 className="text-xl font-semibold">Reminder queue & exceptions</h3>
        <p className="my-2 text-sm">
          Failed sends retry up to three times. Unconfirmed submissions are held
          for provider review to prevent duplicates. Changed renewal dates or
          cancelled subscriptions are checked again before sending.
        </p>
        <ActionForm action={processRenewalsAction}>
          <button className={button}>
            Process queued reminders / check submissions
          </button>
        </ActionForm>
        <div className="mt-4 space-y-3">
          {recent.map((r) => (
            <div
              key={String(r.id)}
              className="border-t border-border py-3 text-sm"
            >
              <b>{String(r.name || r.item_key)}</b>
              <p>
                {String(r.recipient)} ·{" "}
                {r.state === "ACCEPTED"
                  ? "Accepted by provider"
                  : String(r.state)}{" "}
                · Attempts: {Number(r.attempts)}
              </p>
              {r.last_error && (
                <p>{String(r.last_error).replaceAll("_", " ").toLowerCase()}</p>
              )}
              {["FAILED", "UNKNOWN"].includes(String(r.state)) && (
                <ActionForm
                  action={retryRenewalAction}
                  className="mt-3 space-y-2"
                >
                  <input type="hidden" name="id" value={String(r.id)} />
                  <input
                    className={input}
                    name="reason"
                    placeholder="Review note / provider confirmation"
                    required
                    minLength={10}
                    maxLength={1000}
                  />
                  {r.state === "UNKNOWN" && (
                    <label className="flex gap-2">
                      <input
                        type="checkbox"
                        name="confirmedNotAccepted"
                        required
                      />
                      I checked with the provider and confirmed this email was
                      not accepted.
                    </label>
                  )}
                  <button className={button}>Approve retry</button>
                </ActionForm>
              )}
              {r.state === "UNKNOWN" && (
                <details className="mt-3">
                  <summary>Provider confirms this was accepted?</summary>
                  <ActionForm
                    action={confirmRenewalAcceptanceAction}
                    className="mt-3 space-y-2"
                  >
                    <input type="hidden" name="id" value={String(r.id)} />
                    <input
                      className={input}
                      name="provider"
                      required
                      placeholder="Verified provider message ID"
                    />
                    <input
                      className={input}
                      name="reason"
                      required
                      minLength={10}
                      maxLength={1000}
                      placeholder="Provider verification note"
                    />
                    <label className="flex gap-2">
                      <input
                        type="checkbox"
                        name="confirmedAccepted"
                        required
                      />
                      I verified the provider accepted this message. This does
                      not confirm inbox delivery.
                    </label>
                    <button className={button}>
                      Record verified acceptance
                    </button>
                  </ActionForm>
                </details>
              )}
            </div>
          ))}
        </div>
      </section>
      <details className={card} open={Boolean(editing)}>
        <summary className="cursor-pointer font-semibold">
          {editing ? "Edit" : "Add"} another tracked subscription
        </summary>
        <p className="my-3 text-sm">
          For services not already listed above. Dates entered here only track
          reminders; they do not register, renew, bill or extend a service.
        </p>
        <ActionForm action={saveTrackedRenewalAction} className="space-y-3">
          <input type="hidden" name="id" value={String(editing?.id || "")} />
          <label className="block">
            Business account
            <select
              name="organization"
              required
              className={input}
              defaultValue={String(editing?.organization_id || "")}
            >
              <option value="">Choose an account</option>
              {orgs.map((o) => (
                <option key={String(o.id)} value={String(o.id)}>
                  {String(o.name)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Service name
            <input
              className={input}
              name="name"
              required
              maxLength={180}
              defaultValue={String(editing?.name || "")}
            />
          </label>
          <label className="block">
            Service type
            <select
              className={input}
              name="kind"
              defaultValue={String(editing?.kind || "OTHER")}
            >
              {Object.entries(renewalKinds).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Next renewal date
            <input
              className={input}
              type="date"
              name="due"
              defaultValue={String(editing?.due_on || "").slice(0, 10)}
            />
          </label>
          <label className="block">
            Recorded amount (NGN, optional)
            <input
              className={input}
              type="number"
              min="0"
              step="0.01"
              name="amount"
              defaultValue={
                editing?.amount_kobo != null
                  ? Number(editing.amount_kobo) / 100
                  : ""
              }
            />
          </label>
          <label className="block">
            Billing email (optional; otherwise current owner)
            <input
              className={input}
              type="email"
              name="recipient"
              defaultValue={String(editing?.recipient || "")}
            />
          </label>
          {editing && (
            <label className="flex gap-3">
              <input
                type="checkbox"
                name="cancel"
                defaultChecked={editing.status === "CANCELLED"}
              />
              Stop reminders for this tracked subscription
            </label>
          )}
          <button className={button}>Save tracked subscription</button>
        </ActionForm>
      </details>
    </section>
  );
}
