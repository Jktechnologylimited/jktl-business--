import { guardAdminPage } from "@/lib/admin-page-guard";
import { getAdminSession } from "@/lib/admin-session";
import { can } from "@/lib/admin-permissions";
import { GrowthControls } from "@/components/admin/investor/GrowthControls";
import { REPORT_RANGES } from "@/lib/investor/model";
import { loadDashboardReport } from "@/lib/investor/dashboard-cache";
import { CompanyFinanceControls } from "@/components/admin/investor/CompanyFinanceControls";
import { InvestorDashboard } from "@/components/admin/investor/InvestorDashboard";
import { ActionForm } from "@/components/distribution/action-form";
import { generateInvestorReportAction } from "@/lib/actions/investor-report-actions";
import {
  listInvestorReports,
  periodFromQuery,
  reportsInstalled,
} from "@/lib/investor/service";
import { IntegrationHealth } from "@/components/admin/integration-health";
import { RunDailySweep } from "@/components/admin/run-daily-sweep";
import Link from "next/link";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "JKTL Company Insights",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await guardAdminPage("view_company_finance");
  const admin = await getAdminSession();
  let period;
  try {
    period = periodFromQuery(await searchParams);
  } catch {
    return (
      <section>
        <h1 className="text-3xl font-semibold">JKTL company insights</h1>
        <p className="my-5" role="alert">
          Choose valid dates ending no later than today, within a maximum
          24-month period.
        </p>
        <Link href="/admin/insights" className="text-blue-600 underline">
          Reset report dates
        </Link>
      </section>
    );
  }
  let report;
  try {
    report = await loadDashboardReport(period.from, period.to);
  } catch {
    return (
      <section>
        <h1 className="text-3xl font-semibold">JKTL company insights</h1>
        <p className="my-5" role="alert">
          A consistent database snapshot could not be loaded. No figures are
          being shown as zero. Please retry or ask the team to check the
          reporting sources.
        </p>
      </section>
    );
  }
  const [history, installed] = await Promise.all([
      listInvestorReports(),
      reportsInstalled(),
    ]),
    exportAllowed =
      admin && can(admin.role, "export_insights", admin.permissions);
  const input =
    "mt-2 block w-full rounded-lg border border-border bg-paper p-3 text-ink";
  return (
    <div className="space-y-6 text-ink">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
          JK TECHNOLOGY LIMITED · MANAGEMENT INFORMATION
        </p>
        <h1 className="my-3 text-3xl font-semibold">
          Company insights &amp; investor reports
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-ink-muted">
          Registered traction, verified payment evidence and product adoption.
          Charts use recorded data; the definitions explain what is covered.
          Reports are private and unaudited. Dashboard aggregates may be cached
          for up to 60 seconds; saved reports are read fresh.
        </p>
        <p className="mt-3 text-xs text-ink-muted">
          Current snapshot:{" "}
          {new Date(report.generatedAt).toLocaleString("en-NG", {
            timeZone: "Africa/Lagos",
          })}{" "}
          WAT. Period metrics: {period.from}–{period.to} WAT. Comparison:{" "}
          {period.previousFrom}–{period.previousTo}.
        </p>
      </header>
      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-border p-4"
      >
        <label>
          Reporting period
          <select name="range" className={input} defaultValue="custom">
            {REPORT_RANGES.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded-lg bg-primary p-3 text-on-primary">
          Use period
        </button>
      </form>
      <form
        method="get"
        className="grid gap-4 rounded-2xl border border-border bg-paper p-5 sm:grid-cols-[1fr_1fr_auto]"
      >
        <label className="text-sm font-medium">
          From
          <input
            className={input}
            type="date"
            name="from"
            defaultValue={period.from}
            required
          />
        </label>
        <label className="text-sm font-medium">
          To
          <input
            className={input}
            type="date"
            name="to"
            defaultValue={period.to}
            required
          />
        </label>
        <button className="self-end rounded-lg bg-primary px-5 py-3 font-semibold text-on-primary">
          Apply date range
        </button>
      </form>
      {exportAllowed && (
        <section className="rounded-2xl border border-border bg-paper p-5">
          <h2 className="text-lg font-semibold">Generate an investor report</h2>
          <p className="my-3 text-sm text-ink-muted">
            Save a dated, immutable snapshot, then download its PDF with charts
            or CSV with aggregate data. Both downloads use that same snapshot.
            Metrics are re-read from the database at generation time.
          </p>
          {!installed ? (
            <p>Install the reporting migration to enable saved reports.</p>
          ) : (
            <ActionForm action={generateInvestorReportAction}>
              <input type="hidden" name="from" value={period.from} />
              <input type="hidden" name="to" value={period.to} />
              <label className="text-sm">
                Management context (optional)
                <textarea
                  name="notes"
                  rows={3}
                  maxLength={1500}
                  className={input}
                  placeholder="Context you want included alongside the recorded metrics. Avoid customer personal details."
                />
              </label>
              <button
                disabled={
                  !report.accounts.available ||
                  !report.receipts.available ||
                  !report.subscriptions.available
                }
                className="mt-4 rounded-lg bg-primary px-5 py-3 font-semibold text-on-primary disabled:opacity-50"
              >
                Generate report snapshot
              </button>
            </ActionForm>
          )}
        </section>
      )}
      <InvestorDashboard report={report} />
      {admin &&
        can(admin.role, "manage_company_finance", admin.permissions) && (
          <CompanyFinanceControls period={period} />
        )}
      {admin && can(admin.role, "manage_team", admin.permissions) && (
        <GrowthControls operational />
      )}
      <section className="rounded-2xl border border-border bg-paper p-5">
        <h2 className="text-lg font-semibold">Saved report snapshots</h2>
        {!history.length ? (
          <p className="mt-3 text-sm text-ink-muted">
            No investor reports generated yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {history.map((row) => (
              <li key={String(row.id)}>
                <Link
                  className="text-blue-600 underline"
                  href={"/admin/insights/reports/" + row.id}
                >
                  {String(row.from_day).slice(0, 10)}–
                  {String(row.to_day).slice(0, 10)} · generated{" "}
                  {new Date(String(row.generated_at)).toLocaleString("en-NG", {
                    timeZone: "Africa/Lagos",
                  })}{" "}
                  WAT
                </Link>
                <p className="text-xs text-ink-muted">
                  Snapshot {String(row.id).slice(0, 8)} · SHA-256{" "}
                  {String(row.digest).slice(0, 16)}…
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <details className="rounded-2xl border border-border bg-paper p-5">
        <summary className="cursor-pointer font-semibold">
          Operational tools · excluded from report exports
        </summary>
        <div className="mt-5 space-y-6">
          {admin && can(admin.role, "run_daily_job", admin.permissions) && (
            <RunDailySweep />
          )}
          <IntegrationHealth />
        </div>
      </details>
    </div>
  );
}
