import type { Metadata } from "next";
import Link from "next/link";
import { JktlMark } from "@/components/app/logo";
import { verifyInvoicePaymentAction } from "@/lib/actions/invoice-payment-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Where Paystack redirects the payer back to after checkout. Just gives
 * immediate visual feedback — the webhook (src/app/api/webhooks/paystack)
 * is what actually marks the invoice paid, same dual pattern as the
 * existing billing checkout's confirmCheckoutAction/webhook pair, so this
 * page still lands correctly even if the webhook is what ends up doing
 * the real work moments later.
 */
export default async function PaymentCallbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reference?: string }>;
}) {
  const { id } = await params;
  const { reference } = await searchParams;

  let status: "success" | "pending" | "failed" = "pending";
  if (reference) {
    const result = await verifyInvoicePaymentAction(reference);
    if (result.ok) status = result.data.status === "success" ? "success" : "failed";
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <JktlMark className="size-9" />
      {status === "success" ? (
        <>
          <h1 className="font-display text-xl font-bold text-ink">Payment received</h1>
          <p className="text-sm text-ink-muted">Thank you — your payment has gone through.</p>
        </>
      ) : status === "failed" ? (
        <>
          <h1 className="font-display text-xl font-bold text-ink">Payment didn&apos;t go through</h1>
          <p className="text-sm text-ink-muted">Nothing was charged. You can go back and try again.</p>
          <Link href={`/pay/${id}`} className="text-sm font-medium text-primary">
            Try again
          </Link>
        </>
      ) : (
        <>
          <h1 className="font-display text-xl font-bold text-ink">Confirming your payment…</h1>
          <p className="text-sm text-ink-muted">This can take a moment. You can close this page — you&apos;ll get a confirmation once it&apos;s done.</p>
        </>
      )}
    </div>
  );
}
