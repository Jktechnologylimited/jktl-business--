import type { Period } from "@/lib/investor/model";
import {
  companyPaymentReport,
  type PaymentFilters,
} from "@/lib/merchant-fees/reporting";
import { formatKobo } from "@/lib/format";
export async function MerchantPaymentExplorer({
  period,
  filters,
}: {
  period: Period;
  filters: PaymentFilters;
}) {
  let report;
  try {
    report = await companyPaymentReport(period, filters);
  } catch {
    return (
      <p role="alert">
        Payment filters could not be loaded. Check access and filter values.
      </p>
    );
  }
  if (!report.installed)
    return (
      <p className="text-sm text-ink-muted">
        Detailed merchant payment evidence is available after migrations
        076–077.
      </p>
    );
  const businessName = (id: unknown) =>
    String(report.businessOptions.find((b) => b.id === id)?.name || id);
  const input =
    "mt-2 block w-full rounded-lg border border-border bg-paper p-3";
  return (
    <details className="rounded-2xl border border-border bg-paper p-5">
      <summary className="cursor-pointer font-semibold">
        Merchant transaction explorer
      </summary>
      <p className="my-3 text-xs leading-6 text-ink-muted">
        Filters apply to this explorer for {period.from}–{period.to} WAT.
        Overview charts above retain their report scope. Up to 100 recent rows
        are shown. Test/unknown modes are labelled; only evidenced live fee
        amounts contribute to earned revenue. Transaction volume is merchant
        principal, not JKTL income.
      </p>
      <form method="get" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <input type="hidden" name="from" value={period.from} />
        <input type="hidden" name="to" value={period.to} />
        <label>
          Status
          <select
            name="paymentStatus"
            className={input}
            defaultValue={filters.status || ""}
          >
            {[
              "",
              "SUCCESS",
              "REFUNDED",
              "DISPUTED",
              "REVIEW",
              "PENDING",
              "FAILED",
            ].map((s) => (
              <option key={s} value={s}>
                {s || "All statuses"}
              </option>
            ))}
          </select>
        </label>
        <label>
          Source
          <select
            name="paymentSource"
            className={input}
            defaultValue={filters.source || ""}
          >
            {["", "INVOICE", "WEBSITE"].map((s) => (
              <option key={s} value={s}>
                {s || "All sources"}
              </option>
            ))}
          </select>
        </label>
        <label>
          Provider
          <select
            name="paymentProvider"
            className={input}
            defaultValue={filters.provider || ""}
          >
            <option value="">All providers</option>
            <option value="paystack">Paystack</option>
          </select>
        </label>
        <label>
          Business
          <select
            name="paymentBusiness"
            className={input}
            defaultValue={filters.business || ""}
          >
            <option value="">All businesses</option>
            {report.businessOptions.map((b) => (
              <option key={String(b.id)} value={String(b.id)}>
                {String(b.name)}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded-lg bg-primary p-3 text-on-primary sm:col-span-2">
          Filter merchant transactions
        </button>
      </form>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <caption className="mb-3 text-left">
            Verified transactions and unresolved checkout attempts
          </caption>
          <thead>
            <tr>
              {[
                "Reference / business",
                "Source / status / mode",
                "Merchant principal",
                "Buyer fee / total",
                "Fee reversed / earned",
                "JKTL processor cost",
                "Settlement",
              ].map((h) => (
                <th className="p-2" key={h} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.rows.map((r) => (
              <tr key={String(r.reference)} className="border-t border-border">
                <th scope="row" className="max-w-60 break-all p-2 font-normal">
                  {String(r.reference)}
                  <br />
                  {String(r.organization_id)}
                </th>
                <td className="p-2">
                  {String(r.source)} · {String(r.status)} · {String(r.mode)}
                </td>
                <td className="p-2">{formatKobo(Number(r.principal_kobo))}</td>
                <td className="p-2">
                  {formatKobo(Number(r.gross_fee_kobo))} /{" "}
                  {formatKobo(Number(r.charged_kobo))}
                </td>
                <td className="p-2">
                  {formatKobo(Number(r.reversed_fee_kobo))} /{" "}
                  {r.earned_fee_kobo === null
                    ? "Held/unavailable"
                    : formatKobo(Number(r.earned_fee_kobo))}
                </td>
                <td className="p-2">
                  {r.processor_kobo === null
                    ? "Unknown"
                    : formatKobo(Number(r.processor_kobo))}
                </td>
                <td className="p-2">{String(r.settlement_status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="font-semibold">
            Volume by business · matching filters
          </h3>
          <ul className="mt-2 text-xs leading-6">
            {report.businesses.map((b) => (
              <li key={String(b.organization_id)} className="break-all">
                {businessName(b.organization_id)} · {String(b.transactions)}{" "}
                payments · {formatKobo(Number(b.gpv))} merchant GPV
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-semibold">
            Earned fee revenue by source · matching filters
          </h3>
          <ul className="mt-2 text-sm leading-6">
            {report.sources.map((s) => (
              <li key={String(s.source)}>
                {String(s.source)} · {formatKobo(Number(s.earned))} covered live
                fee revenue
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}
