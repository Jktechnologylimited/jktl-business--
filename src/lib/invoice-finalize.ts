import "server-only";
import { getCustomer } from "@/lib/db/customers";
import { getBusinessProfile } from "@/lib/db/organizations";
import { sendPaymentConfirmationEmail } from "@/lib/email";
import { notifyInvoicePaid } from "@/lib/notify";
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
export async function finalizeInvoicePaid(organizationId: string, invoice: Invoice): Promise<void> {
  void notifyInvoicePaid(organizationId, { number: invoice.number, totalKobo: invoice.totalKobo });
  try {
    const [customer, profile] = await Promise.all([
      getCustomer(organizationId, invoice.customerId),
      getBusinessProfile(organizationId),
    ]);
    if (customer?.email && profile) {
      await sendPaymentConfirmationEmail({
        to: customer.email,
        customerName: customer.name,
        businessName: profile.displayName,
        invoiceNumber: invoice.number,
        totalKobo: invoice.totalKobo,
      }).catch(() => undefined);
    }
  } catch {
    // Best-effort — never let notification failure affect the status update.
  }
}
