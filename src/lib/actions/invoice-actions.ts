"use server";

import * as db from "@/lib/db/invoices";
import { getCustomer } from "@/lib/db/customers";
import { getBusinessProfile } from "@/lib/db/organizations";
import { requireSession } from "@/lib/session";
import { sendInvoiceEmail, sendPaymentConfirmationEmail } from "@/lib/email";
import type { ActionResult } from "./types";
import type { Invoice, InvoiceItem, InvoiceStatus } from "@/lib/types";

export async function createInvoiceAction(input: db.InvoiceInput): Promise<ActionResult<{ invoice: Invoice; items: InvoiceItem[] }>> {
  try {
    const { organizationId } = await requireSession();
    return { ok: true, data: await db.createInvoice(organizationId, input) };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't create this invoice." };
  }
}

export async function updateInvoiceStatusAction(id: string, status: InvoiceStatus): Promise<ActionResult<Invoice>> {
  try {
    const { organizationId } = await requireSession();
    const invoice = await db.updateInvoiceStatus(organizationId, id, status);
    if (!invoice) return { ok: false, error: "Invoice not found." };

    if (status === "paid") {
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

    return { ok: true, data: invoice };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't update this invoice." };
  }
}

/** Explicit send, triggered from the invoice detail page — not automatic on
 * create, since drafts shouldn't go out and the owner may want to review first. */
export async function sendInvoiceEmailAction(id: string): Promise<ActionResult<null>> {
  try {
    const { organizationId } = await requireSession();
    const [invoice, items, profile] = await Promise.all([
      db.getInvoice(organizationId, id),
      db.getInvoiceItems(organizationId, id),
      getBusinessProfile(organizationId),
    ]);
    if (!invoice || !profile) return { ok: false, error: "Invoice not found." };
    const customer = await getCustomer(organizationId, invoice.customerId);
    if (!customer?.email) return { ok: false, error: "This customer has no email on file." };

    const result = await sendInvoiceEmail({
      to: customer.email,
      customerName: customer.name,
      businessName: profile.displayName,
      invoiceNumber: invoice.number,
      totalKobo: invoice.totalKobo,
      dueDate: invoice.dueDate,
      lines: items.map((i) => ({ description: i.description, quantity: i.quantity, totalKobo: i.totalKobo })),
    });
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, data: null };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't send this invoice." };
  }
}

export async function deleteInvoiceAction(id: string): Promise<ActionResult<null>> {
  try {
    const { organizationId } = await requireSession();
    await db.deleteInvoice(organizationId, id);
    return { ok: true, data: null };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't delete this invoice." };
  }
}
