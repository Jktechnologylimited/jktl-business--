import Link from "next/link";
import { percent, type InvestorReport } from "@/lib/investor/model";
const money = (v: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(
    v / 100,
  );
export function GrowthOverview({ report }: { report: InvestorReport }) {
  const a = report.accounts.available ? report.accounts.data : null;
  const s = report.subscriptions.available ? report.subscriptions.data : null;
  const events = report.activation?.available ? report.activation.data : null;
  const acquisition = report.acquisition?.available
    ? report.acquisition.data
    : null;
  const owed = report.receivables?.available ? report.receivables.data : null;
  const denominator = a ? a.total - a.custom : 0;
  const stages = [
    {
      label: "All visitors",
      value: null,
      detail:
        "Total visitor coverage is not measured; the consenting-browser cohort is shown separately below.",
    },
    {
      label: "Registered self-serve businesses",
      value: a ? denominator : null,
      detail: "Current registered accounts, excluding managed Custom clients.",
    },
    {
      label: "Templates started",
      value: a?.started ?? null,
      detail: "Current selected, draft or published templates.",
    },
    {
      label: "Businesses with a published website",
      value: a?.published ?? null,
      detail: "Current live template websites.",
    },
    {
      label: "Verified active website subscriptions",
      value: s?.verified ?? null,
      detail:
        "Payment-evidenced recurring website plans, including any managed clients.",
    },
  ];
  return (
    <section
      className="space-y-5 rounded-2xl border border-border bg-paper p-5"
      aria-labelledby="growth-overview"
    >
      <div>
        <h2 id="growth-overview" className="text-xl font-semibold">
          Growth &amp; revenue overview
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          Current adoption and recorded milestones. These account counts are not
          a historical visitor conversion funnel.
        </p>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stages.map((row) => (
          <li key={row.label} className="rounded-xl border border-border p-4">
            <p className="text-xs font-medium text-ink-muted">{row.label}</p>
            <p className="my-2 text-2xl font-semibold">
              {row.value === null ? "Unavailable" : row.value}
            </p>
            <p className="text-xs leading-5 text-ink-muted">{row.detail}</p>
          </li>
        ))}
      </ol>
      <p className="text-sm text-ink-muted">
        Self-serve publication rate:{" "}
        {a && percent(a.published, denominator) !== null
          ? `${percent(a.published, denominator)}%`
          : "Unavailable"}
        . Active recurring revenue is shown separately from collections in the
        report below.
      </p>
      <div className="flex flex-wrap gap-4 text-sm">
        <Link
          className="text-blue-600 underline"
          href="/admin/emails/automation"
        >
          Review stalled accounts
        </Link>
        <Link className="text-blue-600 underline" href="/admin/emails/renewals">
          Renewals &amp; reminders
        </Link>
      </div>
      <div>
        <h3 className="font-semibold">
          First observed milestones · selected period
        </h3>
        {events ? (
          <>
            <p className="my-2 text-xs text-ink-muted">
              Tracking since{" "}
              {new Date(events.trackingSince).toLocaleDateString("en-NG", {
                timeZone: "Africa/Lagos",
              })}
              . Independent event counts; existing accounts are not backdated.
              Payment events can later be refunded and do not represent current
              paid entitlement.
            </p>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Registered", events.registered],
                ["Selected template", events.selected],
                ["Published website", events.published],
                ["Verified website payment", events.paid],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-surface p-3">
                  <dt className="text-xs text-ink-muted">{label}</dt>
                  <dd className="mt-1 text-lg font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">
            Milestone history unavailable. Install migration 074 to record
            future milestones; current account status remains available above.
          </p>
        )}
      </div>
      <div>
        <h3 className="font-semibold">Outstanding Custom invoices · current</h3>
        {owed ? (
          <p className="mt-2 text-sm leading-7">
            {money(owed.outstanding)} across {owed.invoices} open invoices;{" "}
            {money(owed.overdue)} overdue; {money(owed.underReview)} under
            payment review. These balances exclude customer sales invoices and
            are not collections or ARR.
          </p>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">
            Invoice source unavailable.
          </p>
        )}
      </div>
      <div>
        <h3 className="font-semibold">Acquisition by referral account</h3>
        <p className="my-2 text-xs leading-5 text-ink-muted">
          Existing first-touch attribution only. Registration and publication
          are current counts; paying customers and receipts use the selected
          period. Missing referral attribution is not assigned to a source. CAC
          needs verified acquisition costs.
        </p>
        {acquisition?.sources.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Referral account performance
              </caption>
              <thead>
                <tr>
                  {[
                    "Source",
                    "Programme",
                    "Registered",
                    "Published",
                    "Paying",
                    "Retained receipts",
                  ].map((t) => (
                    <th
                      key={t}
                      scope="col"
                      className="whitespace-nowrap border-b border-border px-3 py-2"
                    >
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {acquisition.sources.map((r, i) => (
                  <tr key={`${r.source}-${i}`}>
                    <th scope="row" className="px-3 py-3 font-medium">
                      {r.source}
                    </th>
                    <td className="px-3">{r.programme}</td>
                    <td className="px-3">{r.registered}</td>
                    <td className="px-3">{r.published}</td>
                    <td className="px-3">{r.paying}</td>
                    <td className="whitespace-nowrap px-3">
                      {money(r.retained)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">
            {acquisition
              ? "No referral accounts recorded."
              : "Referral sources unavailable."}
          </p>
        )}
      </div>
    </section>
  );
}
