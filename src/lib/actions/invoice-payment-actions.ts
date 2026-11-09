"use server";

import { headers } from "next/headers";
import { authRateLimit } from "@/lib/security/auth-rate-limit";
import { query } from "@/lib/custom/service";
import {
  reserveMerchantCheckout,
  recordVerifiedMerchantPayment,
} from "@/lib/company-finance/payments";
import { payoutReady } from "@/lib/invoicing/policy";
import { getPublicInvoice } from "@/lib/db/invoices";
import { getPaymentSettings } from "@/lib/db/payments";
import {
  initializeInvoicePayment,
  verifyTransaction,
  INVOICE_PLATFORM_FEE_KOBO,
} from "@/lib/paystack";
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
export async function initiateInvoicePaymentAction(
  invoiceId: string,
): Promise<ActionResult<{ authorizationUrl: string }>> {
  let reservedReference = "";
  try {
    if (!/^[0-9a-f-]{36}$/i.test(invoiceId))
      return { ok: false, error: "Invoice not found." };
    const h = await headers();
    await authRateLimit(
      (h.get("x-forwarded-for") || "unknown").split(",")[0] + ":" + invoiceId,
      "invoice-checkout",
      20,
      3600,
    );
    const invoice = await getPublicInvoice(invoiceId);
    if (!invoice) return { ok: false, error: "Invoice not found." };
    if (invoice.status === "draft")
      return { ok: false, error: "This invoice has not been issued yet." };
    if (invoice.status === "paid")
      return { ok: false, error: "This invoice has already been paid." };
    if (!invoice.payoutReady)
      return {
        ok: false,
        error: "This business hasn't set up online payments yet.",
      };

    const settings = await getPaymentSettings(invoice.organizationId);
    if (!payoutReady(settings))
      return {
        ok: false,
        error: "Online payments are not set up for this business.",
      };
    if (!Number.isSafeInteger(invoice.totalKobo) || invoice.totalKobo <= 0)
      return { ok: false, error: "This invoice does not require a payment." };
    const amountKobo = invoice.totalKobo + INVOICE_PLATFORM_FEE_KOBO;

    const reserved = await reserveMerchantCheckout(
      invoice,
      settings.subaccountCode,
    );
    if (!reserved.created) {
      if (
        Number(reserved.row.principal_kobo) !== invoice.totalKobo ||
        reserved.row.subaccount_code !== settings.subaccountCode
      )
        return {
          ok: false,
          error:
            "This invoice changed after checkout was opened. Contact the business before paying.",
        };
      if (
        reserved.row.state === "READY" &&
        /^https:\/\/checkout\.paystack\.com\//.test(
          String(reserved.row.authorization_url),
        )
      )
        return {
          ok: true,
          data: { authorizationUrl: String(reserved.row.authorization_url) },
        };
      return {
        ok: false,
        error:
          "This payment request is still being checked. Do not pay again; contact the business or JKTL support if it remains pending.",
      };
    }
    reservedReference = String(reserved.row.reference);
    const { authorizationUrl, reference } = await initializeInvoicePayment({
      reference: reservedReference,
      email:
        invoice.customerEmail ||
        `invoice-${invoice.number.toLowerCase()}@jktl.com.ng`,
      amountKobo,
      subaccountCode: settings.subaccountCode,
      transactionChargeKobo: INVOICE_PLATFORM_FEE_KOBO,
      callbackUrl: `${appOrigin()}/pay/${invoiceId}/callback`,
      metadata: {
        type: "invoice_payment",
        organizationId: invoice.organizationId,
        invoiceId,
      },
    });

    if (
      reference !== reservedReference ||
      !/^https:\/\/checkout\.paystack\.com\//.test(authorizationUrl)
    )
      throw Error("Invalid provider response");
    await query(
      "UPDATE merchant_payment_attempts SET state='READY',authorization_url=$2,updated_at=now() WHERE reference=$1 AND state='INITIALIZING'",
      [reservedReference, authorizationUrl],
    );
    return { ok: true, data: { authorizationUrl } };
  } catch (err) {
    if (reservedReference)
      await query(
        "UPDATE merchant_payment_attempts SET state='UNKNOWN',updated_at=now() WHERE reference=$1 AND state='INITIALIZING'",
        [reservedReference],
      ).catch(() => {});
    void err;
    return {
      ok: false,
      error: reservedReference
        ? "Payment setup needs confirmation. Please do not start another payment; contact support."
        : "Could not start this payment. Check the invoice or contact support.",
    };
  }
}

/** Called by the payment callback page for immediate feedback once
 * Paystack redirects back with a reference — the webhook (see
 * src/app/api/webhooks/paystack) remains the authoritative source that
 * actually marks the invoice paid, exactly like the existing billing
 * checkout's `confirmCheckoutAction` / webhook pair. */
export async function verifyInvoicePaymentAction(
  reference: string,
  invoiceId: string,
): Promise<ActionResult<{ status: string }>> {
  try {
    if (
      !/^[a-z0-9_-]{4,160}$/i.test(reference) ||
      !/^[a-f0-9-]{36}$/i.test(invoiceId)
    )
      return { ok: false, error: "Could not confirm this payment reference." };
    const h = await headers();
    await authRateLimit(
      (h.get("x-forwarded-for") || "unknown").split(",")[0],
      "invoice-verify",
      30,
      3600,
    );
    const data = await verifyTransaction(reference);
    if (
      data.reference !== reference ||
      data.metadata?.type !== "invoice_payment" ||
      data.metadata?.invoiceId !== invoiceId
    )
      return { ok: false, error: "This payment does not match this invoice." };
    if (data.status === "success") {
      const result = await recordVerifiedMerchantPayment(
        data as unknown as Record<string, unknown>,
      );
      return {
        ok: true,
        data: { status: result.applied ? "success" : "pending" },
      };
    }
    return {
      ok: true,
      data: {
        status:
          data.status === "success"
            ? "success"
            : data.status === "failed"
              ? "failed"
              : "pending",
      },
    };
  } catch {
    return {
      ok: false,
      error:
        "Payment confirmation is pending. Contact support before trying another payment.",
    };
  }
}
