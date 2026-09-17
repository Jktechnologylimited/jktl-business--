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
  notes: string;
}

/**
 * Creates the sale and its line items in one statement (a data-modifying CTE
 * is one Postgres statement, so this part is atomic). Stock deduction and
 * the inventory movement log are a second statement — narrower atomicity
 * gap than doing everything separately, but not a full cross-statement
 * transaction. Upgrading to @neondatabase/serverless's Pool with real
 * BEGIN/COMMIT would close that gap if it ever matters in practice.
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
  const itemsJson = JSON.stringify(input.items);

  const rows = await sql`
    WITH new_sale AS (
      INSERT INTO sales (id, organization_id, customer_id, subtotal_kobo, discount_kobo, total_kobo, payment_method, payment_status, notes)
      VALUES (${input.id}, ${orgId}, ${input.customerId}, ${subtotalKobo}, ${input.discountKobo}, ${totalKobo}, ${input.paymentMethod}, ${input.paymentStatus}, ${input.notes})
      ON CONFLICT (id) DO UPDATE SET notes = excluded.notes
      RETURNING *, (xmax = 0) AS freshly_inserted
    ),
    inserted_items AS (
      INSERT INTO sale_items (id, organization_id, sale_id, kind, ref_id, name, quantity, unit_price_kobo, total_kobo)
      SELECT item.id, ${orgId}, new_sale.id, item.kind, item.ref_id, item.name, item.quantity, item.unit_price_kobo, item.quantity * item.unit_price_kobo
      FROM new_sale, jsonb_to_recordset(${itemsJson}::jsonb) AS item(id uuid, kind text, ref_id uuid, name text, quantity int, unit_price_kobo bigint)
      ON CONFLICT (id) DO UPDATE SET quantity = excluded.quantity
      RETURNING *
    )
    SELECT
      (SELECT row_to_json(new_sale) FROM new_sale) AS sale,
      (SELECT coalesce(jsonb_agg(inserted_items), '[]'::jsonb) FROM inserted_items) AS items
  `;

  const saleRow = rows[0].sale as Record<string, unknown>;
  const wasFreshlyInserted = saleRow.freshly_inserted === true;
  const sale = mapSale(saleRow);
  const items = (rows[0].items as Record<string, unknown>[]).map(mapItem);

  // Stock deduction is deliberately skipped on a retry of an already-applied
  // create — otherwise a lost response + automatic retry would double-charge
  // inventory for one real-world sale.
  const productLines = wasFreshlyInserted ? input.items.filter((i) => i.kind === "product") : [];
  if (productLines.length > 0) {
    const productJson = JSON.stringify(productLines.map((l) => ({ ref_id: l.refId, quantity: l.quantity })));
    await sql`
      WITH product_items AS (
        SELECT * FROM jsonb_to_recordset(${productJson}::jsonb) AS item(ref_id uuid, quantity int)
      ),
      stock_updates AS (
        UPDATE products SET stock_qty = stock_qty - product_items.quantity
        FROM product_items
        WHERE products.id = product_items.ref_id AND products.organization_id = ${orgId}
        RETURNING products.id AS product_id, product_items.quantity AS qty
      )
      INSERT INTO inventory_movements (organization_id, product_id, type, quantity, reason)
      SELECT ${orgId}, product_id, 'sale', -qty, ${"Sold in sale " + sale.id}
      FROM stock_updates
    `;
  }

  return { sale, items };
}
