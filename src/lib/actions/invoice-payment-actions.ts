"use server";

import { getPublicInvoice } from "@/lib/db/invoices";
import { getPaymentSettings } from "@/lib/db/payments";
import { initializeInvoicePayment, verifyTransaction, INVOICE_PLATFORM_FEE_KOBO } from "@/lib/paystack";
import type { ActionResult } from "./types";

function appOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "jktl.com.ng";
  return `https://business.${root}`;
}

/**
 * Starts a hosted Paystack checkout for a single invoice. Deliberately has
 * no `requireSession()` call, unlike almost every other action in this
 * app: whoever is paying isn't a JKTL Business user at all, just someone
 * the business shared this link with. The invoice's own id — an
 * unguessable `crypto.randomUUID()`, see store.ts's `newId` — is the only
 * thing gating this, the same trust model as a payment link from any
 * other provider.
 */
export async function initiateInvoicePaymentAction(invoiceId: string): Promise<ActionResult<{ authorizationUrl: string }>> {
  try {
    const invoice = await getPublicInvoice(invoiceId);
    if (!invoice) return { ok: false, error: "Invoice not found." };
    if (invoice.status === "paid") return { ok: false, error: "This invoice has already been paid." };
    if (!invoice.payoutReady) return { ok: false, error: "This business hasn't set up online payments yet." };

    const settings = await getPaymentSettings(invoice.organizationId);
    const amountKobo = invoice.totalKobo + INVOICE_PLATFORM_FEE_KOBO;

    const { authorizationUrl } = await initializeInvoicePayment({
      email: invoice.customerEmail || `invoice-${invoice.number.toLowerCase()}@jktl.com.ng`,
      amountKobo,
      subaccountCode: settings.subaccountCode,
      transactionChargeKobo: INVOICE_PLATFORM_FEE_KOBO,
      callbackUrl: `${appOrigin()}/pay/${invoiceId}/callback`,
      metadata: { type: "invoice_payment", organizationId: invoice.organizationId, invoiceId },
    });

    return { ok: true, data: { authorizationUrl } };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't start payment right now — please try again." };
  }
}

/** Called by the payment callback page for immediate feedback once
 * Paystack redirects back with a reference — the webhook (see
 * src/app/api/webhooks/paystack) remains the authoritative source that
 * actually marks the invoice paid, exactly like the existing billing
 * checkout's `confirmCheckoutAction` / webhook pair. */
export async function verifyInvoicePaymentAction(reference: string): Promise<ActionResult<{ status: string }>> {
  try {
    const data = await verifyTransaction(reference);
    return { ok: true, data: { status: data.status } };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't confirm payment status." };
  }
}
