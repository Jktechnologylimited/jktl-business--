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
  const rows = status === "paid"
    ? await sql`UPDATE invoices SET status = ${status}, paid_at = ${paidAt} WHERE id = ${id} AND organization_id = ${orgId} RETURNING *`
    : await sql`UPDATE invoices SET status = ${status} WHERE id = ${id} AND organization_id = ${orgId} RETURNING *`;
  return rows[0] ? mapInvoice(rows[0]) : null;
}

export async function deleteInvoice(orgId: string, id: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM invoices WHERE id = ${id} AND organization_id = ${orgId}`;
}
