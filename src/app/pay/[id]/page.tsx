import type { Metadata } from "next";
import { getPublicInvoice } from "@/lib/db/invoices";
import { formatKobo, formatShortDate } from "@/lib/format";
import { INVOICE_PLATFORM_FEE_KOBO } from "@/lib/paystack";
import { JktlMark } from "@/components/app/logo";
import { PayButton } from "./pay-button";

export const dynamic = "force-dynamic";

// Never worth indexing — every one of these is a private link to a single
// customer's invoice, shared directly (over WhatsApp, for now), not a page
// anyone should find through search.
export const metadata: Metadata = { robots: { index: false, follow: false } };

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <div className="mb-6 flex items-center gap-2">
        <JktlMark className="size-7" />
        <span className="text-xs font-medium text-ink-muted">Secured by Paystack · JKTL Business</span>
      </div>
      <div className="rounded-2xl border border-border p-5">{children}</div>
    </div>
  );
}

export default async function PayInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await getPublicInvoice(id);

  if (!invoice) {
    return (
      <Wrapper>
        <h1 className="font-display text-lg font-bold text-ink">This payment link isn&apos;t valid</h1>
        <p className="mt-1 text-sm text-ink-muted">Double-check the link, or ask the business to resend it.</p>
      </Wrapper>
    );
  }

  if (invoice.status === "paid") {
    return (
      <Wrapper>
        <h1 className="font-display text-lg font-bold text-ink">Already paid</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Invoice {invoice.number} to {invoice.businessName} has already been paid — thank you!
        </p>
      </Wrapper>
    );
  }

  const amountKobo = invoice.totalKobo + INVOICE_PLATFORM_FEE_KOBO;

  return (
    <Wrapper>
      <div className="font-display text-lg font-bold text-ink">{invoice.businessName}</div>
      <div className="text-xs text-ink-muted">Invoice {invoice.number}</div>

      <div className="mt-5 divide-y divide-border border-y border-border">
        {invoice.items.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between py-2.5 text-sm">
            <div>
              <div className="text-ink">{item.description}</div>
              <div className="text-xs text-ink-muted">
                {item.quantity} × {formatKobo(item.unitPriceKobo)}
              </div>
            </div>
            <div className="font-medium text-ink">{formatKobo(item.totalKobo)}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col items-end gap-1 text-sm">
        <div className="flex w-56 justify-between text-ink-muted">
          <span>Invoice total</span>
          <span>{formatKobo(invoice.totalKobo)}</span>
        </div>
        {invoice.payoutReady ? (
          <div className="flex w-56 justify-between text-ink-muted">
            <span>Payment processing fee</span>
            <span>{formatKobo(INVOICE_PLATFORM_FEE_KOBO)}</span>
          </div>
        ) : null}
        <div className="flex w-56 justify-between border-t border-border pt-1 font-display text-base font-bold text-ink">
          <span>{invoice.payoutReady ? "Pay now" : "Total due"}</span>
          <span>{formatKobo(invoice.payoutReady ? amountKobo : invoice.totalKobo)}</span>
        </div>
      </div>

      <p className="mt-1 text-xs text-ink-muted">Due {formatShortDate(invoice.dueDate)}</p>

      {invoice.payoutReady ? (
        <PayButton invoiceId={invoice.id} />
      ) : (
        <p className="mt-4 text-xs text-ink-muted">Online payment isn&apos;t set up for this business yet — please pay them directly.</p>
      )}

      {invoice.bankName ? (
        <div className="mt-5 rounded-xl bg-surface p-3 text-xs text-ink-muted">
          <div className="font-medium text-ink">Prefer a direct bank transfer?</div>
          <div className="mt-1">
            {invoice.accountName} · {invoice.bankName} · {invoice.accountNumber}
          </div>
        </div>
      ) : null}
    </Wrapper>
  );
}
