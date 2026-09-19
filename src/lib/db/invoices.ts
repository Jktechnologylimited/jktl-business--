import { getSql } from "./client";
import { isoDate, kobo } from "./rows";
import type { Invoice, InvoiceItem, InvoiceStatus } from "@/lib/types";

function mapInvoice(row: Record<string, unknown>): Invoice {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    number: row.number as string,
    customerId: row.customer_id as string,
    status: row.status as InvoiceStatus,
    issueDate: String(row.issue_date).slice(0, 10),
    dueDate: String(row.due_date).slice(0, 10),
    subtotalKobo: kobo(row.subtotal_kobo as string),
    discountKobo: kobo(row.discount_kobo as string),
    totalKobo: kobo(row.total_kobo as string),
    notes: row.notes as string,
    paidAt: row.paid_at ? isoDate(row.paid_at as string) : null,
    // Defensive fallbacks: rows created before migration 011 (or before
    // it's been run) won't have these columns yet — same pattern as
    // mapProfile's fallbacks in db/organizations.ts.
    paidVia: ((row.paid_via as string) || "manual") as Invoice["paidVia"],
    platformFeeKobo: kobo((row.platform_fee_kobo as string) ?? 0),
    paymentReference: (row.payment_reference as string) ?? "",
  };
}

function mapItem(row: Record<string, unknown>): InvoiceItem {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    invoiceId: row.invoice_id as string,
    description: row.description as string,
    quantity: Number(row.quantity),
    unitPriceKobo: kobo(row.unit_price_kobo as string),
    totalKobo: kobo(row.total_kobo as string),
  };
}

export async function listInvoices(orgId: string): Promise<Invoice[]> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM invoices WHERE organization_id = ${orgId} ORDER BY issue_date DESC`;
  return rows.map(mapInvoice);
}

export async function getInvoice(orgId: string, id: string): Promise<Invoice | null> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM invoices WHERE id = ${id} AND organization_id = ${orgId}`;
  return rows[0] ? mapInvoice(rows[0]) : null;
}

export async function listInvoiceItems(orgId: string): Promise<InvoiceItem[]> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM invoice_items WHERE organization_id = ${orgId}`;
  return rows.map(mapItem);
}

export async function getInvoiceItems(orgId: string, invoiceId: string): Promise<InvoiceItem[]> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM invoice_items WHERE invoice_id = ${invoiceId} AND organization_id = ${orgId}`;
  return rows.map(mapItem);
}

export interface InvoiceLineInput {
  id: string;
  description: string;
  quantity: number;
  unitPriceKobo: number;
}

export interface InvoiceInput {
  id: string;
  number: string;
  customerId: string;
  items: InvoiceLineInput[];
  discountKobo: number;
  dueDate: string;
  notes: string;
  status: InvoiceStatus;
}

export async function createInvoice(orgId: string, input: InvoiceInput): Promise<{ invoice: Invoice; items: InvoiceItem[] }> {
  const sql = getSql();
  const subtotalKobo = input.items.reduce((sum, i) => sum + i.quantity * i.unitPriceKobo, 0);
  const totalKobo = Math.max(0, subtotalKobo - input.discountKobo);
  const itemsJson = JSON.stringify(
    input.items.map((i) => ({ id: i.id, description: i.description, quantity: i.quantity, unit_price_kobo: i.unitPriceKobo })),
  );
  const paidAt = input.status === "paid" ? new Date().toISOString() : null;

  const rows = await sql`
    WITH new_invoice AS (
      INSERT INTO invoices (id, organization_id, number, customer_id, status, due_date, subtotal_kobo, discount_kobo, total_kobo, notes, paid_at)
      VALUES (${input.id}, ${orgId}, ${input.number}, ${input.customerId}, ${input.status}, ${input.dueDate}, ${subtotalKobo}, ${input.discountKobo}, ${totalKobo}, ${input.notes}, ${paidAt})
      ON CONFLICT (id) DO UPDATE SET notes = excluded.notes
      RETURNING *
    ),
    inserted_items AS (
      INSERT INTO invoice_items (id, organization_id, invoice_id, description, quantity, unit_price_kobo, total_kobo)
      SELECT item.id, ${orgId}, new_invoice.id, item.description, item.quantity, item.unit_price_kobo, item.quantity * item.unit_price_kobo
      FROM new_invoice, jsonb_to_recordset(${itemsJson}::jsonb) AS item(id uuid, description text, quantity int, unit_price_kobo bigint)
      ON CONFLICT (id) DO UPDATE SET quantity = excluded.quantity
      RETURNING *
    )
    SELECT
      (SELECT row_to_json(new_invoice) FROM new_invoice) AS invoice,
      (SELECT coalesce(jsonb_agg(inserted_items), '[]'::jsonb) FROM inserted_items) AS items
  `;

  return {
    invoice: mapInvoice(rows[0].invoice as Record<string, unknown>),
    items: (rows[0].items as Record<string, unknown>[]).map(mapItem),
  };
}

export async function updateInvoiceStatus(orgId: string, id: string, status: InvoiceStatus): Promise<Invoice | null> {
  const sql = getSql();
  const paidAt = status === "paid" ? new Date().toISOString() : null;
  // Explicitly stamps paid_via = 'manual' on this path (rather than leaving
  // whatever was there before) so an invoice that was once paid online,
  // reverted to pending, and marked paid again by hand here doesn't keep
  // reporting itself as an online/platform-fee payment it no longer is.
  const rows = status === "paid"
    ? await sql`UPDATE invoices SET status = ${status}, paid_at = ${paidAt}, paid_via = 'manual', platform_fee_kobo = 0, payment_reference = '' WHERE id = ${id} AND organization_id = ${orgId} RETURNING *`
    : await sql`UPDATE invoices SET status = ${status} WHERE id = ${id} AND organization_id = ${orgId} RETURNING *`;
  return rows[0] ? mapInvoice(rows[0]) : null;
}

export async function deleteInvoice(orgId: string, id: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM invoices WHERE id = ${id} AND organization_id = ${orgId}`;
}

/**
 * Marks an invoice paid from the Paystack webhook, once a payment through
 * the public link has actually gone through — the online-payment
 * counterpart to `updateInvoiceStatus`'s manual "Mark as paid". Scoped to
 * `status <> 'paid'` so a retried or duplicate webhook delivery (on top of
 * the dedupe already done in the webhook route itself) can never re-apply
 * the same payment or overwrite an already-paid invoice. Returns null if
 * there was nothing to update (already paid, or the invoiceId/orgId pair
 * from the webhook's metadata didn't match a real invoice).
 */
export async function markInvoicePaidOnline(
  orgId: string,
  invoiceId: string,
  params: { reference: string; platformFeeKobo: number },
): Promise<Invoice | null> {
  const sql = getSql();
  const rows = await sql`
    UPDATE invoices
    SET status = 'paid', paid_at = now(), paid_via = 'online', payment_reference = ${params.reference}, platform_fee_kobo = ${params.platformFeeKobo}
    WHERE id = ${invoiceId} AND organization_id = ${orgId} AND status <> 'paid'
    RETURNING *
  `;
  return rows[0] ? mapInvoice(rows[0]) : null;
}

export interface PublicInvoice {
  id: string;
  organizationId: string;
  number: string;
  status: InvoiceStatus;
  dueDate: string;
  totalKobo: number;
  customerEmail: string;
  businessName: string;
  businessLogoUrl: string | null;
  items: Array<{ description: string; quantity: number; unitPriceKobo: number; totalKobo: number }>;
  /** True once the business has a working Paystack Subaccount — gates
   * whether the public page shows a "Pay now" button at all. */
  payoutReady: boolean;
  bankName: string;
  accountNumber: string;
  accountName: string;
}

/**
 * The one place in this app that looks up an invoice with no
 * `organizationId` scoping from a session — this is what the public
 * `/pay/[id]` page reads, and the invoice's own id (an unguessable
 * `crypto.randomUUID()`, per store.ts's `newId`) is the only thing gating
 * it, the same trust model as a payment link from any other provider.
 * Deliberately returns only what a payer needs to see: never the
 * customer's own name, phone, or notes on the invoice.
 */
export async function getPublicInvoice(invoiceId: string): Promise<PublicInvoice | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      i.id, i.organization_id, i.number, i.status, i.due_date, i.total_kobo,
      bp.display_name AS business_name, bp.logo_url AS business_logo_url,
      c.email AS customer_email,
      ps.settlement_bank_name, ps.settlement_account_number, ps.settlement_account_name, ps.paystack_subaccount_code
    FROM invoices i
    JOIN business_profiles bp ON bp.organization_id = i.organization_id
    LEFT JOIN customers c ON c.id = i.customer_id
    LEFT JOIN payment_settings ps ON ps.organization_id = i.organization_id
    WHERE i.id = ${invoiceId}
  `;
  const row = rows[0];
  if (!row) return null;

  const orgId = row.organization_id as string;
  const itemRows = await sql`SELECT description, quantity, unit_price_kobo, total_kobo FROM invoice_items WHERE invoice_id = ${invoiceId} AND organization_id = ${orgId}`;

  return {
    id: row.id as string,
    organizationId: orgId,
    number: row.number as string,
    status: row.status as InvoiceStatus,
    dueDate: String(row.due_date).slice(0, 10),
    totalKobo: kobo(row.total_kobo as string),
    customerEmail: (row.customer_email as string) ?? "",
    businessName: row.business_name as string,
    businessLogoUrl: (row.business_logo_url as string) ?? null,
    items: itemRows.map((r) => ({
      description: r.description as string,
      quantity: Number(r.quantity),
      unitPriceKobo: kobo(r.unit_price_kobo as string),
      totalKobo: kobo(r.total_kobo as string),
    })),
    payoutReady: Boolean(row.paystack_subaccount_code),
    bankName: (row.settlement_bank_name as string) ?? "",
    accountNumber: (row.settlement_account_number as string) ?? "",
    accountName: (row.settlement_account_name as string) ?? "",
  };
}
