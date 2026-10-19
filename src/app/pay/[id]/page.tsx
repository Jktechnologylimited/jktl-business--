import type { Metadata } from "next";
import { getPublicInvoice } from "@/lib/db/invoices";
import { formatKobo, formatShortDate } from "@/lib/format";
import { INVOICE_PLATFORM_FEE_KOBO } from "@/lib/paystack";
import { JktlMark } from "@/components/app/logo";
import { PayButton } from "./pay-button";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

// Never worth indexing — every one of these is a private link to a single
// customer's invoice, shared directly (over WhatsApp, for now), not a page
// anyone should find through search.
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * The public invoice.
 *
 * Rebuilt as an actual document rather than a payment widget, because of what
 * it is used for: a customer forwards this link to whoever approves spending,
 * and that person has to be able to see who is billing them, for what, by when,
 * and whether it has already been settled. So it carries the business's own
 * details, the line items, the payment status with its date and reference, and
 * a print stylesheet — a PDF the customer can file without any extra step.
 */
export default async function PayInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await getPublicInvoice(id);

  if (!invoice) {
    return (
      <Shell>
        <div className="rounded-2xl border border-border bg-paper p-6">
          <h1 className="font-display text-lg font-bold text-ink">This payment link isn&apos;t valid</h1>
          <p className="mt-1 text-sm text-ink-muted">Double-check the link, or ask the business to resend it.</p>
        </div>
      </Shell>
    );
  }

  const paid = invoice.status === "paid";
  const overdue = !paid && isOverdue(invoice.dueDate);
  const amountKobo = invoice.totalKobo + INVOICE_PLATFORM_FEE_KOBO;
  const businessLocation = [invoice.businessAddress, invoice.businessCity, invoice.businessState].filter(Boolean).join(", ");

  return (
    <Shell>
      <article className="overflow-hidden rounded-2xl border border-border bg-paper print:rounded-none print:border-0">
        {/* Header: who is billing, and how to reach them. */}
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="flex items-start gap-3">
            {invoice.businessLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- external/blob URL, not a static asset
              <img src={invoice.businessLogoUrl} alt="" className="size-12 rounded-xl object-cover" />
            ) : null}
            <div>
              <div className="font-display text-lg font-bold tracking-tight text-ink">{invoice.businessName}</div>
              {businessLocation ? <div className="text-xs text-ink-muted">{businessLocation}</div> : null}
              <div className="text-xs text-ink-muted">
                {[invoice.businessPhone, invoice.businessEmail].filter(Boolean).join(" · ")}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="font-display text-xl font-bold tracking-tight text-ink">
              {paid ? "Receipt" : "Invoice"}
            </div>
            <div className="text-sm text-ink-muted">#{invoice.number}</div>
            <StatusBadge paid={paid} overdue={overdue} />
          </div>
        </header>

        {/* The dates and the person being billed. */}
        <div className="grid gap-4 border-b border-border px-6 py-5 sm:grid-cols-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Billed to</div>
            <div className="mt-1 text-sm text-ink">{invoice.customerName || "Customer"}</div>
            {invoice.customerEmail ? <div className="text-xs text-ink-muted">{invoice.customerEmail}</div> : null}
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Issued</div>
            <div className="mt-1 text-sm text-ink">{formatShortDate(invoice.issueDate)}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              {paid ? "Paid on" : "Due"}
            </div>
            <div className={paid ? "mt-1 text-sm text-ink" : `mt-1 text-sm ${overdue ? "font-semibold text-danger" : "text-ink"}`}>
              {paid && invoice.paidAt ? formatShortDate(invoice.paidAt) : formatShortDate(invoice.dueDate)}
            </div>
          </div>
        </div>

        {/* Line items. */}
        <div className="px-6 py-5">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-ink-faint">
                <th className="pb-2 font-semibold">Description</th>
                <th className="pb-2 text-right font-semibold">Qty</th>
                <th className="pb-2 text-right font-semibold">Unit</th>
                <th className="pb-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoice.items.map((item, index) => (
                <tr key={index}>
                  <td className="py-2.5 text-ink">{item.description}</td>
                  <td className="py-2.5 text-right text-ink-muted">{item.quantity}</td>
                  <td className="py-2.5 text-right text-ink-muted">{formatKobo(item.unitPriceKobo)}</td>
                  <td className="py-2.5 text-right font-medium text-ink">{formatKobo(item.totalKobo)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex flex-col items-end gap-1 text-sm">
            <Row label="Subtotal" value={formatKobo(invoice.subtotalKobo)} />
            {invoice.discountKobo > 0 ? <Row label="Discount" value={`− ${formatKobo(invoice.discountKobo)}`} /> : null}
            {invoice.payoutReady && !paid ? (
              <Row label="Payment processing fee" value={formatKobo(INVOICE_PLATFORM_FEE_KOBO)} />
            ) : null}
            <div className="mt-1 flex w-64 justify-between border-t border-border pt-2">
              <span className="font-display text-base font-bold text-ink">{paid ? "Amount paid" : "Total due"}</span>
              <span className="font-display text-base font-bold text-ink">
                {formatKobo(paid ? invoice.totalKobo : invoice.payoutReady ? amountKobo : invoice.totalKobo)}
              </span>
            </div>
          </div>
        </div>

        {invoice.notes ? (
          <div className="border-t border-border px-6 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Notes</div>
            <p className="mt-1 whitespace-pre-line text-sm text-ink-muted">{invoice.notes}</p>
          </div>
        ) : null}

        {/* The state the customer actually cares about. */}
        <div className="border-t border-border px-6 py-5 print:hidden">
          {paid ? (
            <div className="rounded-xl border border-primary/30 bg-primary-soft px-4 py-3">
              <div className="text-sm font-semibold text-primary-strong">Paid — thank you</div>
              <p className="mt-0.5 text-xs text-ink-muted">
                {invoice.businessName} has been notified
                {invoice.paidAt ? ` and this was settled on ${formatShortDate(invoice.paidAt)}` : ""}. Keep this page as your receipt.
              </p>
              <div className="mt-3">
                <PrintButton />
              </div>
            </div>
          ) : invoice.payoutReady ? (
            <>
              {overdue ? (
                <p className="mb-3 rounded-xl bg-danger-soft px-3 py-2 text-xs text-danger">
                  This invoice was due on {formatShortDate(invoice.dueDate)}.
                </p>
              ) : null}
              <PayButton invoiceId={invoice.id} />
              <p className="mt-2 text-center text-[11px] text-ink-faint">
                Secure card payment, processed by Paystack. {invoice.businessName} is notified the moment it clears.
              </p>
            </>
          ) : (
            <p className="text-xs text-ink-muted">
              Online payment isn&apos;t set up for this business yet — please pay them directly using the details below.
            </p>
          )}
        </div>

        {!paid && invoice.bankName ? (
          <div className="border-t border-border bg-surface px-6 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Or pay by bank transfer</div>
            <div className="mt-1 text-sm text-ink">
              {invoice.accountName} · {invoice.bankName} · {invoice.accountNumber}
            </div>
            <div className="mt-0.5 text-xs text-ink-muted">
              Use invoice #{invoice.number} as the reference so it can be matched to your account.
            </div>
          </div>
        ) : null}
      </article>

      <div className="mt-4 flex items-center justify-center gap-2 print:hidden">
        <JktlMark className="size-5" />
        <span className="text-[11px] text-ink-faint">Invoicing by JKTL Business · payments secured by Paystack</span>
      </div>
    </Shell>
  );
}

/** Module scope because it reads the clock: keeping it out of the component
 * body makes the render a pure function of the invoice. */
function isOverdue(dueDate: string): boolean {
  return new Date(dueDate).getTime() < Date.now();
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-4 py-8 print:max-w-none print:py-0">
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex w-64 justify-between text-ink-muted">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function StatusBadge({ paid, overdue }: { paid: boolean; overdue: boolean }) {
  const label = paid ? "Paid" : overdue ? "Overdue" : "Awaiting payment";
  const classes = paid
    ? "bg-primary-soft text-primary-strong"
    : overdue
      ? "bg-danger-soft text-danger"
      : "bg-accent-soft text-accent-strong";
  return <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${classes}`}>{label}</span>;
}
