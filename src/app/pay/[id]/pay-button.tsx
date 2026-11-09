"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  initiateInvoicePaymentAction,
  invoiceCheckoutQuoteAction,
} from "@/lib/actions/invoice-payment-actions";
import { minorInput, type InvoiceQuote } from "@/lib/merchant-fees/model";
import { formatKobo } from "@/lib/format";
export function PayButton({
  invoiceId,
  initialQuote,
}: {
  invoiceId: string;
  initialQuote: InvoiceQuote;
}) {
  const [quote, setQuote] = useState(initialQuote),
    [amount, setAmount] = useState(
      (initialQuote.principalKobo / 100).toFixed(2),
    ),
    [pending, setPending] = useState(false),
    [quoting, setQuoting] = useState(false),
    [error, setError] = useState("");
  const requested = (() => {
    try {
      return minorInput(amount);
    } catch {
      return null;
    }
  })();
  useEffect(() => {
    if (requested === quote.principalKobo || quote.locked) return;
    const timer = setTimeout(async () => {
      if (!requested) {
        setError("Enter a positive payment amount.");
        return;
      }
      setQuoting(true);
      const result = await invoiceCheckoutQuoteAction(invoiceId, requested);
      setQuoting(false);
      if (result.ok) {
        setQuote(result.data);
        setError("");
      } else setError(result.error);
    }, 350);
    return () => clearTimeout(timer);
  }, [requested, quote.principalKobo, quote.locked, invoiceId]);
  const ready = requested === quote.principalKobo && !quoting;
  async function pay() {
    setPending(true);
    setError("");
    try {
      const r = await initiateInvoicePaymentAction(
        invoiceId,
        quote.principalKobo,
        quote.token,
      );
      if (r.ok) {
        window.location.href = r.data.authorizationUrl;
        return;
      }
      setError(r.error);
      const refresh = await invoiceCheckoutQuoteAction(
        invoiceId,
        requested ?? undefined,
      );
      if (refresh.ok) {
        setQuote(refresh.data);
        setAmount((refresh.data.principalKobo / 100).toFixed(2));
      }
    } catch {
      setError(
        "Payment setup is uncertain. Contact support before trying another payment.",
      );
    }
    setPending(false);
  }
  return (
    <section className="mt-4 space-y-4" aria-labelledby="checkout-charges">
      <h2
        id="checkout-charges"
        className="font-display text-lg font-bold text-ink"
      >
        Review your checkout
      </h2>
      <p className="text-xs leading-5 text-ink-muted">
        Your invoice principal stays unchanged. Any taxes, shipping or merchant
        charges are included in the invoice line items above.
      </p>
      <label className="block text-sm text-ink">
        Amount to pay toward this invoice (NGN)
        <input
          className="mt-2 block w-full rounded-lg border border-border bg-paper p-3"
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setError("");
          }}
          disabled={pending || quote.locked}
          aria-describedby="payment-balance"
        />
      </label>
      <p id="payment-balance" className="text-xs text-ink-muted">
        Outstanding principal: {formatKobo(quote.balanceKobo)}. You may pay part
        or all of this balance. A fee applies once to each eligible successful
        payment.
      </p>
      {quote.locked && (
        <p className="rounded-lg bg-surface p-3 text-xs text-ink-muted">
          An existing checkout is reserved for the amount below. Its original
          charges are preserved. Contact support if you need to change it.
        </p>
      )}
      <dl
        className="rounded-xl border border-border p-4 text-sm space-y-3"
        aria-live="polite"
      >
        {[
          ["Merchant payment", quote.principalKobo],
          ["JKTL platform fee", quote.feeKobo],
          ["Additional buyer processor charge", quote.processorFeeKobo],
          ["Total payable", quote.buyerTotalKobo],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="flex flex-wrap justify-between gap-2"
          >
            <dt className={label === "Total payable" ? "font-semibold" : ""}>
              {label}
            </dt>
            <dd className="font-semibold">{formatKobo(Number(value))}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs leading-5 text-ink-muted">
        Paystack processes the payment. Its processing costs remain allocated
        under JKTL’s existing arrangement; no separate processing surcharge is
        added to your checkout.
      </p>
      <Button
        size="lg"
        className="w-full"
        onClick={() => void pay()}
        disabled={pending || !ready}
      >
        {pending || quoting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : null}
        {pending
          ? "Opening secure checkout…"
          : quoting
            ? "Updating charges…"
            : `Pay ${formatKobo(quote.buyerTotalKobo)}`}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
