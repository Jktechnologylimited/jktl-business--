"use client";
import { useState } from "react";
import { INVOICE_PLATFORM_FEE_KOBO } from "@/lib/invoicing/policy";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import {
  profitabilityResult,
  change,
  type InvestorReport,
} from "@/lib/investor/model";
const money = (n: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(
    n / 100,
  );
export function CompanyFinancePanel({ report }: { report: InvestorReport }) {
  const inventory = report.executiveInventory?.available
    ? report.executiveInventory.data
    : null;
  const [group, setGroup] = useState("day");
  const t = report.merchantTransactions?.available
      ? report.merchantTransactions.data
      : null,
    p = report.profitability?.available ? report.profitability.data : null,
    r = p ? profitabilityResult(p) : null;
  const buckets = new Map<
    string,
    { period: string; gpv: number; fees: number }
  >();
  for (const row of t?.series || []) {
    let key = row.day;
    if (group === "month") key = key.slice(0, 7);
    else if (group === "year") key = key.slice(0, 4);
    else if (group === "week") {
      const d = new Date(key + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      key = d.toISOString().slice(0, 10);
    }
    const old = buckets.get(key) || { period: key, gpv: 0, fees: 0 };
    old.gpv += row.gpv / 100;
    old.fees += row.fees / 100;
    buckets.set(key, old);
  }
  const tile = (
    label: string,
    value: number | null | undefined,
    detail: string,
  ) => (
    <div key={label} className="rounded-xl border border-border p-4">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="my-2 break-words text-xl font-semibold">
        {value === null || value === undefined ? "Unavailable" : money(value)}
      </p>
      <p className="text-xs leading-5 text-ink-muted">{detail}</p>
    </div>
  );
  return (
    <section className="space-y-6 rounded-2xl border border-border bg-paper p-5">
      <h2 className="text-xl font-semibold">
        Merchant payments &amp; JKTL profitability
      </h2>
      <p className="text-sm leading-6 text-ink-muted">
        Customer payment volume belongs to the receiving businesses. Only
        evidenced platform fees enter JKTL’s company revenue. Existing invoice
        surcharge: {money(INVOICE_PLATFORM_FEE_KOBO)}; prices and settlement
        splits are unchanged.
      </p>
      {inventory && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Registered businesses", inventory.registered],
            ["New registrations · period", inventory.newRegistrations],
            ["Recorded websites created", inventory.websitesCreated],
            ["Recorded published websites", inventory.websitesPublished],
            ["Published free website accounts", inventory.freeWebsiteAccounts],
            [
              "Paying recurring customers",
              inventory.recurringSnapshot
                ? inventory.paidCustomers
                : "Unavailable",
            ],
            [
              "Paid recurring services",
              inventory.recurringSnapshot
                ? inventory.paidServices
                : "Unavailable",
            ],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-border p-4">
              <p className="text-xs text-ink-muted">{label}</p>
              <p className="mt-2 text-xl font-semibold">{value}</p>
            </div>
          ))}
        </div>
      )}
      {inventory && (
        <p className="text-xs text-ink-muted">
          Website inventory counts recorded primary, additional and connected
          Custom sites. Paying customers/services come from the covered
          recurring snapshot {inventory.recurringSnapshot || "unavailable"};
          they are not all historical payers. Other account/website totals are
          current stocks.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tile(
          "Merchant GPV",
          t?.gpv,
          "Verified live NGN invoice principal; excludes JKTL surcharge.",
        )}
        {tile(
          "Gross JKTL fees",
          t?.grossFees,
          "Charged fees before reversals and risk holds; not merchant sales.",
        )}
        {tile(
          "Recognised fee evidence",
          t?.earnedFees,
          "Excludes unsupported splits and unresolved refund/dispute allocations.",
        )}
        {tile(
          "Transaction contribution",
          t?.contribution,
          "Fees less known processing costs. May be negative; unavailable while cost/risk evidence is incomplete.",
        )}
      </div>
      {t ? (
        <>
          <p className="text-sm leading-7">
            {t.successful} successful transactions · {t.pendingAttempts}{" "}
            pending/uncertain checkouts · {t.failedAttempts} confirmed failed
            attempts. Payer total: {money(t.payerTotal)}. Confirmed fee
            reversals: {money(t.adjustments)}. Held fees: {money(t.heldFees)} (
            {t.reviewCount} payments). Known processor costs:{" "}
            {money(t.processorCosts)}; {t.missingProcessorCosts} cost records
            missing. Refunds: {t.refundTransactions} payments /{" "}
            {money(t.payerRefunds)} payer funds. Disputes:{" "}
            {t.disputedTransactions}. {t.excludedMode}{" "}
            non-live/unsupported-currency records excluded.
          </p>
          <p className="text-xs text-ink-muted">
            Previous equivalent period: GPV {money(t.previousGpv)} (
            {change(t.gpv, t.previousGpv) ?? "no percentage base"}); fees{" "}
            {money(t.previousFees)}. Refund and risk evidence is evaluated as of
            this snapshot against the selected payment cohort. Bank settlement
            remains unconfirmed unless separately evidenced.
          </p>
          <label className="block text-sm">
            Chart interval
            <select
              className="ml-3 rounded-lg border border-border bg-paper p-2"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
            >
              {["day", "week", "month", "year"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <div
            className="h-64 min-w-0"
            role="img"
            aria-label="Merchant volume and JKTL fee revenue chart"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[...buckets.values()]}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                <YAxis width={65} />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="gpv"
                  name="Merchant GPV · NGN"
                  fill="#537bae"
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="fees"
                  name="JKTL fees · NGN"
                  fill="#b4933e"
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-ink-muted">
            Supported source: invoice payment links, including links shared from
            websites. A separate native website-store checkout and its fee
            policy have not been established; website-checkout volume is
            unavailable. No percentage or historical fee revenue is inferred
            from invoice status alone.
          </p>
        </>
      ) : (
        <p className="text-sm text-ink-muted">
          Install migration 076 to record future verified merchant payment
          evidence. Historical GPV and fees are unavailable until reconciled; no
          sample payments are created.
        </p>
      )}
      <h3 className="text-lg font-semibold">
        Company profitability · recorded-receipts basis
      </h3>
      <p className="text-xs leading-6 text-ink-muted">
        Management information on the existing receipt basis, not audited
        accrual accounts or tax returns. Transaction fees are separate from
        subscriptions and never enter ARR. Merchant GPV is excluded. Profit
        requires explicit, current period coverage evidence; recording one cost
        does not imply complete expenses.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tile(
          "Covered company receipts and fees",
          r?.revenue,
          "Recorded retained company receipts plus eligible merchant fees. Not recurring run-rate.",
        )}
        {tile(
          "Direct delivery and processor costs",
          p?.directCosts,
          p?.directComplete
            ? "Coverage confirmed for this period."
            : "Coverage incomplete; do not interpret this as all direct costs.",
        )}
        {tile(
          "Gross result",
          r?.gross,
          "Available only with confirmed revenue and direct-cost coverage.",
        )}
        {tile(
          "Operating expenses",
          p?.operatingExpenses,
          p?.opexComplete
            ? "Coverage confirmed, including evidenced acquisition spend and paid policy commissions."
            : "Operating expense coverage is incomplete.",
        )}
        {tile(
          "Operating result",
          r?.operating,
          "Gross result minus complete operating expenses.",
        )}
        {tile(
          "Recorded company taxes",
          p?.taxes,
          p?.taxComplete
            ? "Coverage confirmed for the selected period."
            : "Tax coverage is incomplete.",
        )}
        {tile(
          "Net result after recorded taxes",
          r?.net,
          "Requires complete revenue, direct costs, operating expenses and taxes.",
        )}
      </div>
      {r && (
        <p className="text-sm">
          Gross margin:{" "}
          {r.grossMargin === null ? "Unavailable" : r.grossMargin + "%"}.
          Operating margin:{" "}
          {r.operatingMargin === null ? "Unavailable" : r.operatingMargin + "%"}
          . Net margin:{" "}
          {r.netMargin === null ? "Unavailable" : r.netMargin + "%"}.
        </p>
      )}
      <p className="text-xs leading-6 text-ink-muted">
        Customer/plan contribution margins remain unavailable until shared
        delivery costs have an evidenced allocation method. No equal-cost
        allocation is assumed.
      </p>
      {p && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h4 className="font-semibold">Company receipt streams</h4>
            <ul className="mt-2 text-sm">
              {p.streams.map((s) => (
                <li key={s.product}>
                  {s.product}: {money(s.receipts)}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold">Recorded cost categories</h4>
            <ul className="mt-2 text-sm">
              {p.costCategories.map((c) => (
                <li key={c.category_id}>
                  {c.category_id} · {c.classification}: {money(c.cost)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
