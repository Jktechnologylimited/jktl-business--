import "server-only";
import { getCustomer } from "@/lib/db/customers";
import { getBusinessProfile } from "@/lib/db/organizations";
import { sendPaymentReceiptEmail } from "@/lib/email";
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
  /** Paystack's reference, quoted by a customer when anything goes wrong. */
  reference?: string;
}

export async function finalizeInvoicePaid(
  organizationId: string,
  invoice: Invoice,
  details: InvoicePaymentDetails = {},
): Promise<void> {
  // Fire both pushes without awaiting: they are independent, and neither should
  // delay the other. `notifyPaymentReceived` is the one that leads with the
  // amount, because "money arrived" is the notification a business actually
  // wants; the invoice-number one stays for continuity with existing clients.
  void notifyInvoicePaid(organizationId, { number: invoice.number, totalKobo: invoice.totalKobo });
  void notifyPaymentReceived(organizationId, {
    amountKobo: invoice.totalKobo,
    customerName: "Your customer",
    invoiceNumber: invoice.number,
    method: details.method ?? "the payment link",
  });

  try {
    const [customer, profile] = await Promise.all([
      getCustomer(organizationId, invoice.customerId),
      getBusinessProfile(organizationId),
    ]);
    if (customer?.email && profile) {
      await sendPaymentReceiptEmail({
        to: customer.email,
        customerName: customer.name,
        businessName: profile.displayName,
        invoiceNumber: invoice.number,
        totalKobo: invoice.totalKobo,
        // The invoice's own paid timestamp, so the receipt matches the record
        // rather than the moment this email happened to be sent.
        paidAt: invoice.paidAt ?? new Date().toISOString(),
        reference: details.reference ?? "",
      }).catch(() => undefined);
    }
  } catch {
    // Best-effort — never let notification failure affect the status update.
  }
}
