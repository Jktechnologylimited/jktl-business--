"use client";
import { RevenueIntelligence } from "./RevenueIntelligence";
import { GrowthOverview } from "./GrowthOverview";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  DEFINITIONS,
  LIMITATIONS,
  monthlySeries,
  percent,
  change,
  type InvestorReport,
} from "@/lib/investor/model";
const money = (n: number) =>
  "NGN " +
  new Intl.NumberFormat("en-NG", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(n / 100);
const colours = [
  "#b4933e",
  "#537bae",
  "#598978",
  "#9a7092",
  "#bf8764",
  "#8894ac",
];
const stageNames: Record<string, string> = {
  NO_SITE: "No template yet",
  DRAFT: "Draft template",
  FREE_DOMAIN: "Published · free address",
  CONNECT_DOMAIN: "Domain connection pending",
  COMPLETE: "Verified custom domain",
  MANAGED: "Managed Custom client",
};
function Tile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-2xl border border-border bg-paper p-5">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="my-2 break-words text-2xl font-semibold">{value}</p>
      <p className="text-xs leading-relaxed text-ink-muted">{detail}</p>
    </article>
  );
}
function Empty({ text = "Source unavailable" }: { text?: string }) {
  return (
    <p className="rounded-xl border border-border p-5 text-sm text-ink-muted">
      {text}
    </p>
  );
}
const tooltipStyle = {
  backgroundColor: "var(--color-paper)",
  color: "var(--color-ink)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
};
export function InvestorDashboard({ report }: { report: InvestorReport }) {
  const a = report.accounts.available ? report.accounts.data : null,
    r = report.receipts.available ? report.receipts.data : null,
    s = report.subscriptions.available ? report.subscriptions.data : null,
    e = report.activity.available ? report.activity.data : null,
    p = report.partners.available ? report.partners.data : null,
    portfolio = report.portfolio.available ? report.portfolio.data : null;
  const growth = a ? monthlySeries(report.period, a.series, "count") : [],
    receipts = r
      ? monthlySeries(report.period, r.series, "gross").map((row) => ({
          ...row,
          ngn: Number(row.gross) / 100,
        }))
      : [],
    views = e ? monthlySeries(report.period, e.series, "views") : [];
  const growthChange = a ? change(a.newPeriod, a.previousPeriod) : null,
    cashChange = r ? change(r.gross, r.previousGross) : null;
  return (
    <div className="space-y-6 text-ink">
      <GrowthOverview report={report} />
      <RevenueIntelligence report={report} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Registered businesses · current"
          value={a ? String(a.total) : "Unavailable"}
          detail={
            a
              ? `${a.newPeriod} created in period; ${a.previousPeriod} in prior period${growthChange === null ? " (no percentage base)" : `; ${growthChange > 0 ? "+" : ""}${growthChange}%`}. Excludes unclaimed prospects.`
              : "Required registration source unavailable."
          }
        />
        <Tile
          label="Businesses with a published website · current"
          value={a ? String(a.published) : "Unavailable"}
          detail={
            a
              ? `${a.started} templates started; ${a.custom} managed Custom clients shown separately. ${percent(a.published, a.total - a.custom) ?? "—"}% of eligible self-serve businesses published.`
              : "Publishing source unavailable."
          }
        />
        <Tile
          label="Recorded verified receipts · period"
          value={r ? money(r.gross) : "Unavailable"}
          detail={
            r
              ? `${r.transactions} payment records. Prior period ${money(r.previousGross)}${cashChange === null ? " (no percentage base)" : `; ${cashChange > 0 ? "+" : ""}${cashChange}%`}. Covered products only.`
              : "Payment sources unavailable; not a zero balance."
          }
        />
        <Tile
          label="Verified website MRR · current"
          value={s ? money(s.mrr) : "Unavailable"}
          detail={
            s
              ? `${s.verified} evidenced active subscriptions. Annualized run-rate ${money(s.arr)}. Website plans only; not a revenue forecast.`
              : "Subscription source unavailable."
          }
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-border bg-paper p-5">
          <h2 className="text-lg font-semibold">
            Registered business creation cohorts
          </h2>
          <p className="mt-1 text-xs text-ink-muted">
            Current eligible businesses grouped by creation month. Current month
            may be partial.
          </p>
          {a ? (
            <div
              className="mt-4 h-64 min-w-0"
              role="img"
              aria-label="Monthly business creation chart"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growth}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} width={36} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area
                    dataKey="count"
                    name="Businesses created"
                    stroke="#b4933e"
                    fill="#b4933e"
                    fillOpacity={0.18}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty />
          )}
        </section>
        <section className="rounded-2xl border border-border bg-paper p-5">
          <h2 className="text-lg font-semibold">
            Verified receipts by payment month
          </h2>
          <p className="mt-1 text-xs text-ink-muted">
            NGN gross receipts before refunds, fees, tax or costs. Not
            recognized accounting revenue.
          </p>
          {r ? (
            <>
              <div
                className="mt-4 h-64 min-w-0"
                role="img"
                aria-label="Monthly recorded receipts chart"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={receipts}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis
                      width={60}
                      tickFormatter={(n) =>
                        new Intl.NumberFormat("en", {
                          notation: "compact",
                        }).format(Number(n))
                      }
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar
                      dataKey="ngn"
                      name="Gross receipts (NGN)"
                      fill="#537bae"
                      radius={[5, 5, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {r.gross === 0 && (
                <p className="text-xs text-ink-muted">
                  No verified NGN receipts recorded in the covered sources
                  during this period.
                </p>
              )}
            </>
          ) : (
            <Empty />
          )}
        </section>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-border bg-paper p-5">
          <h2 className="text-lg font-semibold">Current account stages</h2>
          {a ? (
            <>
              <div
                className="h-72"
                role="img"
                aria-label="Current business stage distribution"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={a.stages.map((row) => ({
                        ...row,
                        name: stageNames[row.stage] || row.stage,
                      }))}
                      dataKey="count"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={82}
                      isAnimationActive={false}
                    >
                      {a.stages.map((row, i) => (
                        <Cell
                          key={row.stage}
                          fill={colours[i % colours.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="grid gap-2 text-sm sm:grid-cols-2">
                {a.stages.map((row) => (
                  <li key={row.stage}>
                    {stageNames[row.stage] || row.stage}: <b>{row.count}</b>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <Empty />
          )}
        </section>
        <section className="rounded-2xl border border-border bg-paper p-5">
          <h2 className="text-lg font-semibold">
            Recorded public website views
          </h2>
          <p className="mt-1 text-xs text-ink-muted">
            Hosted template events; repeated visits and automation may be
            included.
          </p>
          {e ? (
            <>
              <div
                className="mt-4 h-64"
                role="img"
                aria-label="Monthly template website views chart"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={views}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} width={40} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area
                      dataKey="views"
                      name="Recorded view events"
                      stroke="#598978"
                      fill="#598978"
                      fillOpacity={0.15}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-ink-muted">
                {e.views} views · {e.cta} CTA events · {e.contacts} contact
                events · {e.bookings} booking events · {e.sites} sites with
                events.
              </p>
            </>
          ) : (
            <Empty />
          )}
        </section>
      </div>
      <section className="rounded-2xl border border-border bg-paper p-5">
        <h2 className="text-lg font-semibold">
          Payment evidence and product mix
        </h2>
        {r ? (
          <>
            <div className="my-4 grid gap-3 sm:grid-cols-3">
              <Tile
                label="Recorded refunds against this cohort"
                value={money(r.refunds)}
                detail="Cumulative known refunds against period receipts, as of generation; not period refund outflow."
              />
              <Tile
                label="Risk-excluded remaining balance"
                value={money(r.risk)}
                detail="Uncleared disputes/refund risks. Not a statement that this amount was lost."
              />
              <Tile
                label="Retained after these adjustments"
                value={money(r.retained)}
                detail="Before processing fees, taxes and service costs. This is not profit."
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <caption className="mb-3 text-left text-xs text-ink-muted">
                  Verified NGN payment records only. No tenant sales or client
                  invoice income is included.
                </caption>
                <thead>
                  <tr>
                    {[
                      "Product",
                      "Payments",
                      "Gross",
                      "Refunds",
                      "Risk excluded",
                      "Retained",
                    ].map((label) => (
                      <th key={label} className="border-b border-border p-2">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.products.map((row) => (
                    <tr key={row.product}>
                      <td className="p-2">{row.product}</td>
                      <td className="p-2">{row.transactions}</td>
                      {[row.gross, row.refunds, row.risk, row.retained].map(
                        (n, i) => (
                          <td className="whitespace-nowrap p-2" key={i}>
                            {money(n)}
                          </td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-ink-muted">
              {r.payingBusinesses} current registered businesses have retained
              verified payments across covered sources (all time). Deduplicated
              records: {r.duplicates}; records with incomplete evidence:{" "}
              {r.invalid}; non-NGN records excluded: {r.unsupported}.
            </p>
          </>
        ) : (
          <Empty />
        )}
        {s && (
          <p className="mt-3 text-xs text-ink-muted">
            Website subscription evidence: {s.verified}/{s.active} current
            active records matched.{" "}
            {s.unverified > 0
              ? "Review unmatched records before treating MRR as complete."
              : "No unmatched active website subscription records."}
          </p>
        )}
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-paper p-5">
          <h2 className="text-lg font-semibold">
            Programme distribution · current
          </h2>
          {p ? (
            <>
              <div className="mt-4 space-y-2">
                {p.programmes.map((row) => (
                  <div
                    className="flex justify-between gap-3 border-b border-border py-2 text-sm"
                    key={row.programme + row.status}
                  >
                    <span>
                      {row.programme || "Unspecified"} · {row.status}
                    </span>
                    <b>{row.count}</b>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm">
                Available/reserved policy commission: {money(p.available)}
                <br />
                Held for review: {money(p.held)}
                <br />
                Confirmed policy payouts in period: {money(p.paidOut)}
              </p>
              <p className="mt-2 text-xs text-ink-muted">
                Legacy commission balances and payouts are not combined with the
                policy ledger.
              </p>
            </>
          ) : (
            <Empty />
          )}
        </section>
        <section className="rounded-2xl border border-border bg-paper p-5">
          <h2 className="text-lg font-semibold">
            Portfolio and customer operations · current
          </h2>
          {portfolio ? (
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {Object.entries({
                "Custom projects": portfolio.customProjects,
                "Live Custom projects": portfolio.activeCustomProjects,
                "Tracked unexpired domains": portfolio.domains,
                "Active unexpired email services": portfolio.emailServices,
                "Open support cases": portfolio.openSupport,
                "New support cases in period": portfolio.newSupport,
                "Renewals due within 30 days": portfolio.renewalsDue,
                "Overdue tracked renewals": portfolio.renewalsOverdue,
                "Renewals missing a date": portfolio.missingRenewalDates,
                "Unclaimed prospect organizations": portfolio.prospectInventory,
              }).map(([label, value]) => (
                <div
                  className="rounded-lg border border-border p-3"
                  key={label}
                >
                  <dt className="text-ink-muted">{label}</dt>
                  <dd className="mt-1 font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <Empty />
          )}
          <p className="mt-4 text-sm">
            {e ? e.recentSavers : "Unavailable"} accounts have their latest
            saved Tycoon progress in this period. Guests, other games and
            Fantasy are excluded; this is not MAU.
          </p>
        </section>
      </div>
      <section className="rounded-2xl border border-border bg-paper p-5">
        <h2 className="text-lg font-semibold">
          Markets · current registered businesses
        </h2>
        {a ? (
          <div className="mt-4 space-y-3">
            {a.countries.map((row) => (
              <div
                key={row.code}
                className="grid grid-cols-[70px_1fr_40px] items-center gap-3 text-sm"
              >
                <span>{row.code}</span>
                <div className="h-3 overflow-hidden rounded-full bg-surface">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${percent(row.count, a.total) || 0}%` }}
                  />
                </div>
                <span>{row.count}</span>
              </div>
            ))}
          </div>
        ) : (
          <Empty />
        )}
      </section>
      <details className="rounded-2xl border border-border bg-paper p-5">
        <summary className="cursor-pointer font-semibold">
          Monthly values behind the charts
        </summary>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[450px] text-left text-sm">
            <thead>
              <tr>
                <th>Month</th>
                <th>Business creations</th>
                <th>Gross receipts (NGN)</th>
                <th>View events</th>
              </tr>
            </thead>
            <tbody>
              {monthlySeries(report.period, [], "count").map((row, i) => (
                <tr key={row.month}>
                  <td className="py-2">{row.month}</td>
                  <td>{a ? growth[i]?.count : "Unavailable"}</td>
                  <td>
                    {r ? money(Number(receipts[i]?.gross || 0)) : "Unavailable"}
                  </td>
                  <td>{e ? views[i]?.views : "Unavailable"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <section className="rounded-2xl border border-border bg-paper p-5">
        <h2 className="text-lg font-semibold">
          Source coverage and reporting limits
        </h2>
        <ul className="my-4 grid gap-2 text-sm sm:grid-cols-2">
          {(
            [
              "accounts",
              "receipts",
              "subscriptions",
              "activity",
              "partners",
              "portfolio",
            ] as const
          ).map((key) => (
            <li key={key}>
              {report[key].available ? "✓ Available" : "• Unavailable"} · {key}
            </li>
          ))}
        </ul>
        <ul className="list-disc space-y-2 pl-5 text-sm text-ink-muted">
          {LIMITATIONS.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>
      <details className="rounded-2xl border border-border bg-paper p-5">
        <summary className="cursor-pointer font-semibold">
          Metric definitions
        </summary>
        <dl className="mt-4 space-y-4">
          {DEFINITIONS.map(([term, definition]) => (
            <div key={term}>
              <dt className="font-semibold">{term}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-ink-muted">
                {definition}
              </dd>
            </div>
          ))}
        </dl>
      </details>
      {report.notes && (
        <section className="rounded-2xl border border-border bg-paper p-5">
          <h2 className="text-lg font-semibold">Management notes</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm">{report.notes}</p>
        </section>
      )}
    </div>
  );
}
