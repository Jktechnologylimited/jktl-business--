"use server";

import * as db from "@/lib/db/invoices";
import { getCustomer } from "@/lib/db/customers";
import { getBusinessProfile } from "@/lib/db/organizations";
import { requireSession } from "@/lib/session";
import { sendInvoiceEmail } from "@/lib/email";
import { notifyInvoiceSent } from "@/lib/notify";
import { finalizeInvoicePaid } from "@/lib/invoice-finalize";
import type { ActionResult } from "./types";
import type { Invoice, InvoiceItem, InvoiceStatus } from "@/lib/types";

/** Public base URL for customer-facing links in emails. */
function appOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  return `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN || "jktl.com.ng"}`;
}

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
      void finalizeInvoicePaid(organizationId, invoice, { method: "cash or transfer" });
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

    // The public payment link goes in the email, so the customer can settle it
    // in two taps instead of reading bank details across to their banking app.
    const payUrl = `${appOrigin()}/pay/${invoice.id}`;

    const result = await sendInvoiceEmail({
      to: customer.email,
      customerName: customer.name,
      businessName: profile.displayName,
      invoiceNumber: invoice.number,
      totalKobo: invoice.totalKobo,
      dueDate: invoice.dueDate,
      lines: items.map((i) => ({ description: i.description, quantity: i.quantity, totalKobo: i.totalKobo })),
      payUrl,
      businessPhone: profile.phone,
    });
    if (!result.ok) return { ok: false, error: result.error };

    // Best-effort, and after the send: the business wants to know a request for
    // money has actually gone out, but that must never be the reason the send
    // is reported as failed.
    void notifyInvoiceSent(organizationId, {
      number: invoice.number,
      totalKobo: invoice.totalKobo,
      customerName: customer.name,
      dueDate: invoice.dueDate,
    });

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
