"use client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import type { InvestorReport } from "@/lib/investor/model";
const money = (n: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(
    n / 100,
  );
export function RevenueIntelligence({ report }: { report: InvestorReport }) {
  const r = report.companyRecurring?.available
      ? report.companyRecurring.data
      : null,
    c = report.conversion?.available ? report.conversion.data : null,
    m = report.movements?.available ? report.movements.data : null,
    a = report.acquisitionCosts?.available
      ? report.acquisitionCosts.data
      : null;
  const cash = report.collections?.available ? report.collections.data : null;
  return (
    <section className="space-y-6 rounded-2xl border border-border bg-paper p-5">
      <h2 className="text-xl font-semibold">
        Recurring revenue &amp; conversion intelligence
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Covered verified MRR", r ? money(r.mrr) : "Unavailable"],
          ["Covered annual run-rate", r ? money(r.arr) : "Unavailable"],
          [
            "Verified recurring services",
            r ? String(r.services) : "Unavailable",
          ],
        ].map(([label, value]) => (
          <div className="rounded-xl bg-surface p-4" key={label}>
            <p className="text-xs text-ink-muted">{label}</p>
            <p className="mt-2 break-words text-xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <p className="text-xs leading-6 text-ink-muted">
        Run-rate from covered, verified paid recurring services. Excludes
        one-time development, domains, unpaid proposals and unsupported
        evidence.{" "}
        {r
          ? `${r.legacyHostingExcluded} active legacy hosting records and ${r.customCandidatesExcluded} active Custom recurring candidates are excluded for missing/mismatched evidence or possible overlap.`
          : "Required recurring sources are not installed."}{" "}
        These figures are separate from cash collections and receivables.
      </p>
      {r && (
        <>
          <div
            className="h-56 min-w-0"
            role="img"
            aria-label="Verified monthly recurring revenue by product"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={r.products.map((p) => ({ ...p, ngn: p.mrr / 100 }))}
              >
                <XAxis dataKey="product" tick={{ fontSize: 10 }} />
                <YAxis width={65} />
                <Tooltip />
                <Bar
                  name="Monthly run-rate NGN"
                  dataKey="ngn"
                  fill="#b4933e"
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-1 text-sm">
            {r.products.map((p) => (
              <li key={p.product}>
                {p.product}: {money(p.mrr)} MRR · {p.services} services
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="text-sm leading-7">
        Covered verified gross collections in the selected period:{" "}
        {cash ? money(cash.gross) : "Unavailable"}
        {cash
          ? ` across ${cash.transactions} transactions, including ${money(cash.legacyGross)} reconciled legacy hosting payments. Recorded risk balance: ${money(cash.risk)}.`
          : ""}{" "}
        Gross collections are before refunds, fees and tax; they are not
        recurring run-rate or profit.
      </p>
      <div>
        <h3 className="font-semibold">Consented visitor-to-paid cohort</h3>
        {c ? (
          <>
            <p className="my-2 text-xs leading-6 text-ink-muted">
              {c.coverage}
            </p>
            <ol className="grid gap-2 sm:grid-cols-5">
              {[
                ["Consenting browsers", c.visitors],
                ["Registered", c.registered],
                ["Template selected", c.selected],
                ["Published", c.published],
                ["Paid", c.paid],
              ].map(([label, value]) => (
                <li key={label} className="rounded-lg border border-border p-3">
                  <p className="text-xs">{label}</p>
                  <p className="mt-1 text-lg font-semibold">{value}</p>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">
            Consent-based cohort sources are unavailable.
          </p>
        )}
      </div>
      <div>
        <h3 className="font-semibold">Observed recurring revenue movements</h3>
        {m && m.daysCompared > 0 ? (
          <>
            <p className="my-2 text-sm leading-7">
              {m.daysCompared} consecutive daily comparisons. New:{" "}
              {money(m.newMrr)}; expansion: {money(m.expansionMrr)};
              contraction: {money(m.contractionMrr)}; lost covered MRR:{" "}
              {money(m.churnedMrr)}.
            </p>
            <div
              className="h-48 min-w-0"
              role="img"
              aria-label="Daily net recurring run-rate movement"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={m.series.map((d) => ({ ...d, ngn: d.net / 100 }))}
                >
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis width={65} />
                  <Tooltip />
                  <Bar
                    dataKey="ngn"
                    name="Net monthly run-rate change NGN"
                    fill="#537bae"
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">
            At least two consecutive daily evidence snapshots are needed. No
            historical churn or upgrade amounts are invented.
          </p>
        )}
        <p className="mt-2 text-xs leading-6 text-ink-muted">
          Service-level paid run-rate changes, including expiry and evidence
          coverage. This is not customer churn or cancellation intent. Missing
          days are excluded from comparisons.
        </p>
      </div>
      <div>
        <h3 className="font-semibold">Evidenced acquisition costs</h3>
        {a ? (
          <>
            <p className="my-2 text-xs text-ink-muted">
              Selected-period spend and newly paying referred businesses.
              Missing spend evidence yields unavailable CAC. Unallocated
              recorded spend: {money(a.unallocatedSpend)}.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    {[
                      "Source",
                      "Spend",
                      "New paying businesses",
                      "Period CAC",
                    ].map((h) => (
                      <th scope="col" key={h} className="px-3 py-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {a.sources.map((r, i) => (
                    <tr key={i}>
                      <th scope="row" className="px-3 py-2 font-medium">
                        {r.source}
                      </th>
                      <td className="whitespace-nowrap px-3">
                        {r.spend ? money(r.spend) : "No spend recorded"}
                      </td>
                      <td className="px-3">{r.newPaying}</td>
                      <td className="whitespace-nowrap px-3">
                        {r.cac === null ? "Unavailable" : money(r.cac)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">
            Acquisition cost sources are unavailable.
          </p>
        )}
      </div>
    </section>
  );
}
