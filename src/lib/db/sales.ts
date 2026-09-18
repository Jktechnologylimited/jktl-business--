import { getSql } from "./client";
import { isoDate, kobo } from "./rows";
import type { LineKind, PaymentMethod, PaymentStatus, Sale, SaleItem } from "@/lib/types";

function mapSale(row: Record<string, unknown>): Sale {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    customerId: (row.customer_id as string) ?? null,
    subtotalKobo: kobo(row.subtotal_kobo as string),
    discountKobo: kobo(row.discount_kobo as string),
    totalKobo: kobo(row.total_kobo as string),
    paymentMethod: row.payment_method as PaymentMethod,
    paymentStatus: row.payment_status as PaymentStatus,
    amountPaidKobo: kobo((row.amount_paid_kobo as string) ?? "0"),
    receiptPhotoUrl: (row.receipt_photo_url as string) ?? null,
    notes: row.notes as string,
    createdAt: isoDate(row.created_at as string),
  };
}

function mapItem(row: Record<string, unknown>): SaleItem {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    saleId: row.sale_id as string,
    kind: row.kind as LineKind,
    refId: row.ref_id as string,
    name: row.name as string,
    quantity: Number(row.quantity),
    unitPriceKobo: kobo(row.unit_price_kobo as string),
    totalKobo: kobo(row.total_kobo as string),
  };
}

export async function listSales(orgId: string): Promise<Sale[]> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM sales WHERE organization_id = ${orgId} ORDER BY created_at DESC`;
  return rows.map(mapSale);
}

export async function listSaleItems(orgId: string): Promise<SaleItem[]> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM sale_items WHERE organization_id = ${orgId}`;
  return rows.map(mapItem);
}

export async function getSale(orgId: string, id: string): Promise<Sale | null> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM sales WHERE id = ${id} AND organization_id = ${orgId}`;
  return rows[0] ? mapSale(rows[0]) : null;
}

export interface SaleLineInput {
  id: string;
  kind: LineKind;
  refId: string;
  name: string;
  quantity: number;
  unitPriceKobo: number;
}

export interface SaleInput {
  id: string;
  customerId: string | null;
  items: SaleLineInput[];
  discountKobo: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  amountPaidKobo: number;
  receiptPhotoUrl: string | null;
  notes: string;
}

/**
 * Creates the sale, its line items, the stock deduction and the inventory
 * movement log all in ONE statement — a data-modifying CTE is a single
 * Postgres statement, so the whole thing is genuinely atomic: either all of
 * it lands, or none of it does. (This used to be two round-trips, with the
 * stock deduction as a separate follow-up statement; folding it into the
 * same CTE closes that gap instead of needing a WebSocket `Pool` and real
 * `BEGIN`/`COMMIT`.)
 *
 * The `stock_updates` CTE only fires for rows where `new_sale.freshly_inserted`
 * is true — computed via the classic `(xmax = 0)` upsert trick — so a retried
 * request (same id, already applied) still won't double-charge inventory,
 * and that check now happens inside the same statement instead of gating a
 * second one from JS.
 *
 * id and each item's id are generated client-side (not DB defaults) so an
 * offline-created sale keeps the same id all the way through sync, and the
 * whole insert is safe to retry (ON CONFLICT upsert) if a request is sent
 * twice after a dropped connection.
 */
export async function createSale(orgId: string, input: SaleInput): Promise<{ sale: Sale; items: SaleItem[] }> {
  const sql = getSql();
  const subtotalKobo = input.items.reduce((sum, i) => sum + i.quantity * i.unitPriceKobo, 0);
  const totalKobo = Math.max(0, subtotalKobo - input.discountKobo);
  const itemsJson = JSON.stringify(
    input.items.map((i) => ({ id: i.id, kind: i.kind, ref_id: i.refId, name: i.name, quantity: i.quantity, unit_price_kobo: i.unitPriceKobo })),
  );
  const reason = `Sold in sale ${input.id}`;

  const rows = await sql`
    WITH new_sale AS (
      INSERT INTO sales (id, organization_id, customer_id, subtotal_kobo, discount_kobo, total_kobo, payment_method, payment_status, amount_paid_kobo, receipt_photo_url, notes)
      VALUES (${input.id}, ${orgId}, ${input.customerId}, ${subtotalKobo}, ${input.discountKobo}, ${totalKobo}, ${input.paymentMethod}, ${input.paymentStatus}, ${input.amountPaidKobo}, ${input.receiptPhotoUrl}, ${input.notes})
      ON CONFLICT (id) DO UPDATE SET notes = excluded.notes
      RETURNING *, (xmax = 0) AS freshly_inserted
    ),
    items_input AS (
      SELECT * FROM jsonb_to_recordset(${itemsJson}::jsonb) AS item(id uuid, kind text, ref_id uuid, name text, quantity int, unit_price_kobo bigint)
    ),
    inserted_items AS (
      INSERT INTO sale_items (id, organization_id, sale_id, kind, ref_id, name, quantity, unit_price_kobo, total_kobo)
      SELECT items_input.id, ${orgId}, new_sale.id, items_input.kind, items_input.ref_id, items_input.name, items_input.quantity, items_input.unit_price_kobo, items_input.quantity * items_input.unit_price_kobo
      FROM new_sale, items_input
      ON CONFLICT (id) DO UPDATE SET quantity = excluded.quantity
      RETURNING *
    ),
    product_totals AS (
      -- Pre-summed per product: a plain UPDATE ... FROM only applies one
      -- matching source row per target row, so without this, a sale with
      -- the same product on two separate lines would only deduct one of
      -- them instead of both.
      SELECT ref_id, SUM(quantity) AS qty FROM items_input WHERE kind = 'product' GROUP BY ref_id
    ),
    stock_updates AS (
      UPDATE products SET stock_qty = stock_qty - product_totals.qty
      FROM product_totals, new_sale
      WHERE products.id = product_totals.ref_id
        AND products.organization_id = ${orgId}
        AND new_sale.freshly_inserted
      RETURNING products.id AS product_id, product_totals.qty AS qty
    ),
    logged_movements AS (
      INSERT INTO inventory_movements (organization_id, product_id, type, quantity, reason)
      SELECT ${orgId}, product_id, 'sale', -qty, ${reason}
      FROM stock_updates
      RETURNING id
    )
    SELECT
      (SELECT row_to_json(new_sale) FROM new_sale) AS sale,
      (SELECT coalesce(jsonb_agg(inserted_items), '[]'::jsonb) FROM inserted_items) AS items
  `;

  const saleRow = rows[0].sale as Record<string, unknown>;
  const sale = mapSale(saleRow);
  const items = (rows[0].items as Record<string, unknown>[]).map(mapItem);

  return { sale, items };
}

export interface SalePaymentPatch {
  paymentStatus: PaymentStatus;
  amountPaidKobo: number;
  /** Pass undefined to leave the existing photo alone, or null to clear it. */
  receiptPhotoUrl?: string | null;
}

/**
 * Updates only the payment side of an existing sale — for recording the rest
 * of a partial payment once the customer pays in full, or attaching/replacing
 * the receipt photo after the fact. Line items and totals are untouched.
 */
export async function updateSalePayment(orgId: string, id: string, patch: SalePaymentPatch): Promise<Sale | null> {
  const sql = getSql();
  const rows =
    patch.receiptPhotoUrl === undefined
      ? await sql`
          UPDATE sales SET payment_status = ${patch.paymentStatus}, amount_paid_kobo = ${patch.amountPaidKobo}
          WHERE id = ${id} AND organization_id = ${orgId}
          RETURNING *
        `
      : await sql`
          UPDATE sales SET payment_status = ${patch.paymentStatus}, amount_paid_kobo = ${patch.amountPaidKobo}, receipt_photo_url = ${patch.receiptPhotoUrl}
          WHERE id = ${id} AND organization_id = ${orgId}
          RETURNING *
        `;
  return rows[0] ? mapSale(rows[0]) : null;
}
