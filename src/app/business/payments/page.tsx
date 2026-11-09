import Link from "next/link";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { businessPaymentReport } from "@/lib/merchant-fees/reporting";
import { formatKobo } from "@/lib/format";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your payments | JKTL Business",
  robots: { index: false, follow: false },
};
export default async function Payments({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await getSession())) redirect("/login?next=payments");
  const q = await searchParams,
    from = typeof q.from === "string" ? q.from : undefined,
    to = typeof q.to === "string" ? q.to : undefined,
    status = typeof q.status === "string" ? q.status : undefined;
  let report;
  try {
    report = await businessPaymentReport(from, to, status);
  } catch {
    return (
      <section className="space-y-5">
        <h1 className="text-3xl font-semibold">Your online payments</h1>
        <p role="alert" className="text-sm text-ink-muted">
          Payment activity could not be loaded. Check the date range and your
          owner or manager access, then retry.
        </p>
        <Link className="text-primary underline" href="/business/invoices">
          Back to invoices
        </Link>
      </section>
    );
  }
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Your online payments</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-muted">
          Payment links for your business only. The merchant principal is your
          sale; the buyer’s JKTL fee is separate. Provider verification confirms
          a payment, while bank settlement follows Paystack’s schedule.
        </p>
        <div className="mt-4 flex flex-wrap gap-5 text-sm">
          <Link className="text-primary underline" href="/business/invoices">
            Invoices
          </Link>
          <Link
            className="text-primary underline"
            href="/business/settings#payments"
          >
            Receiving bank details
          </Link>
        </div>
      </header>
      <form className="flex flex-wrap gap-3" method="get">
        <label>
          From
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="mt-2 block rounded-lg border border-border bg-paper p-3"
          />
        </label>
        <label>
          To
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="mt-2 block rounded-lg border border-border bg-paper p-3"
          />
        </label>
        <label>
          Status
          <select
            name="status"
            defaultValue={status || ""}
            className="mt-2 block rounded-lg border border-border bg-paper p-3"
          >
            {[
              "",
              "SUCCESS",
              "PENDING",
              "FAILED",
              "REFUNDED",
              "DISPUTED",
              "REVIEW",
            ].map((s) => (
              <option value={s} key={s}>
                {s || "All statuses"}
              </option>
            ))}
          </select>
        </label>
        <button className="self-end rounded-lg bg-primary p-3 text-on-primary">
          Apply filters
        </button>
      </form>
      {!report.installed ? (
        <p>
          Payment tracking is being prepared. Your existing invoices remain
          available.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border bg-paper p-4">
            <table className="w-full text-left text-sm">
              <caption className="mb-4 text-left text-xs text-ink-muted">
                Most recent 100 matching transactions and attempts. Test/unknown
                modes are labelled and do not prove bank receipts.
              </caption>
              <thead>
                <tr>
                  {[
                    "Date / reference",
                    "Status / mode",
                    "Merchant principal",
                    "Buyer platform fee",
                    "Buyer total",
                    "Refund recorded",
                    "Settlement",
                  ].map((h) => (
                    <th key={h} scope="col" className="p-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr
                    className="border-t border-border"
                    key={String(r.reference)}
                  >
                    <th
                      className="max-w-60 break-all p-2 text-xs font-normal"
                      scope="row"
                    >
                      <Link
                        href={`/business/invoices/${r.invoice_id}`}
                        className="text-primary underline"
                      >
                        {new Date(String(r.occurred_at)).toLocaleString(
                          "en-NG",
                          { timeZone: "Africa/Lagos" },
                        )}{" "}
                        WAT
                      </Link>
                      <br />
                      {String(r.reference)}
                    </th>
                    <td className="p-2">
                      {String(r.status)} · {String(r.mode)}
                    </td>
                    <td className="p-2">
                      {formatKobo(Number(r.principal_kobo))}
                    </td>
                    <td className="p-2">
                      {formatKobo(Number(r.gross_fee_kobo))}
                    </td>
                    <td className="p-2">
                      {formatKobo(Number(r.charged_kobo))}
                    </td>
                    <td className="p-2">
                      {formatKobo(Number(r.refunded_kobo))}
                    </td>
                    <td className="p-2">{String(r.settlement_status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!report.rows.length && (
              <p className="py-6 text-sm text-ink-muted">
                No matching online payment records. Creating or sharing an
                invoice does not charge a fee.
              </p>
            )}
          </div>
          <p className="text-xs leading-6 text-ink-muted">
            A refund or dispute remains visible even while its allocation is
            reviewed. Payments held for reconciliation are not applied silently
            to a changed invoice. Contact support with the payment reference if
            confirmation is delayed.
          </p>
        </>
      )}
    </div>
  );
}
