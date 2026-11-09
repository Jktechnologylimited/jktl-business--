import "server-only";
import { getCustomer } from "@/lib/db/customers";
import { getBusinessProfile, getOwnerEmail } from "@/lib/db/organizations";
import {
  sendPaymentReceiptEmail,
  sendBusinessInvoicePaidEmail,
} from "@/lib/email";
import { notifyInvoicePaid, notifyPaymentReceived } from "@/lib/notify";
import type { Invoice } from "@/lib/types";

/**
 * Shared by both ways an invoice can end up paid — the owner tapping
 * "Mark as paid" by hand (invoice-actions.ts), and a customer paying
 * through the public payment link (the Paystack webhook) — so either path
 * triggers the same push notification and customer email exactly once,
 * rather than duplicating this logic in two places that could drift.
 * Best-effort throughout: a notification failure can never affect the
 * status update that already happened before this is called.
 */
export interface InvoicePaymentDetails {
  /** The payment method, for the business's notification copy. */
  method?: string;
  paymentAmountKobo?: number;
  platformFeeKobo?: number;
  remainingKobo?: number;
  paidAt?: string;
  /** Paystack's reference, quoted by a customer when anything goes wrong. */
  reference?: string;
}

export async function finalizeInvoicePaid(
  organizationId: string,
  invoice: Invoice,
  details: InvoicePaymentDetails = {},
): Promise<void> {
  // Await best-effort notification delivery so serverless response completion
  // cannot discard in-flight provider requests.
  if (invoice.status === "paid")
    await notifyInvoicePaid(organizationId, {
      number: invoice.number,
      totalKobo: invoice.totalKobo,
    });
  await notifyPaymentReceived(organizationId, {
    amountKobo: details.paymentAmountKobo ?? invoice.totalKobo,
    customerName: "Your customer",
    invoiceNumber: invoice.number,
    method: details.method ?? "the payment link",
  });

  try {
    const [customer, profile, ownerEmail] = await Promise.all([
      getCustomer(organizationId, invoice.customerId),
      getBusinessProfile(organizationId),
      getOwnerEmail(organizationId),
    ]);
    if (ownerEmail && profile)
      await sendBusinessInvoicePaidEmail({
        to: ownerEmail,
        businessName: profile.displayName,
        customerName: customer?.name || "Your customer",
        invoiceNumber: invoice.number,
        totalKobo: details.paymentAmountKobo ?? invoice.totalKobo,
        remainingKobo: details.remainingKobo,
        reference: details.reference || "",
        invoiceId: invoice.id,
        online: invoice.paidVia === "online",
      }).catch(() => undefined);
    if (customer?.email && profile) {
      await sendPaymentReceiptEmail({
        to: customer.email,
        customerName: customer.name,
        businessName: profile.displayName,
        invoiceNumber: invoice.number,
        totalKobo: details.paymentAmountKobo ?? invoice.totalKobo,
        platformFeeKobo: details.platformFeeKobo,
        remainingKobo: details.remainingKobo,
        // The invoice's own paid timestamp, so the receipt matches the record
        // rather than the moment this email happened to be sent.
        paidAt: details.paidAt ?? invoice.paidAt ?? new Date().toISOString(),
        reference: details.reference ?? "",
      }).catch(() => undefined);
    }
  } catch {
    // Best-effort — never let notification failure affect the status update.
  }
}
