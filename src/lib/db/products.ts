import { getSql } from "./client";
import { kobo } from "./rows";
import type { Product } from "@/lib/types";

function mapRow(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    name: row.name as string,
    sku: row.sku as string,
    category: row.category as string,
    costKobo: kobo(row.cost_kobo as string),
    priceKobo: kobo(row.price_kobo as string),
    stockQty: Number(row.stock_qty),
    lowStockThreshold: Number(row.low_stock_threshold),
    supplier: row.supplier as string,
    active: row.active as boolean,
  };
}

export async function listProducts(orgId: string): Promise<Product[]> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM products WHERE organization_id = ${orgId} ORDER BY created_at DESC`;
  return rows.map(mapRow);
}

export interface ProductInput {
  name: string;
  sku: string;
  category: string;
  costKobo: number;
  priceKobo: number;
  stockQty: number;
  lowStockThreshold: number;
  supplier: string;
  active: boolean;
}

export async function createProduct(orgId: string, id: string, input: ProductInput): Promise<Product> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO products (id, organization_id, name, sku, category, cost_kobo, price_kobo, stock_qty, low_stock_threshold, supplier, active)
    VALUES (${id}, ${orgId}, ${input.name}, ${input.sku}, ${input.category}, ${input.costKobo}, ${input.priceKobo}, ${input.stockQty}, ${input.lowStockThreshold}, ${input.supplier}, ${input.active})
    ON CONFLICT (id) DO UPDATE SET
      name = excluded.name, sku = excluded.sku, category = excluded.category,
      cost_kobo = excluded.cost_kobo, price_kobo = excluded.price_kobo, stock_qty = excluded.stock_qty,
      low_stock_threshold = excluded.low_stock_threshold, supplier = excluded.supplier, active = excluded.active
    RETURNING *
  `;
  return mapRow(rows[0]);
}

export async function updateProduct(orgId: string, id: string, input: ProductInput): Promise<Product | null> {
  const sql = getSql();
  const rows = await sql`
    UPDATE products
    SET name = ${input.name}, sku = ${input.sku}, category = ${input.category},
        cost_kobo = ${input.costKobo}, price_kobo = ${input.priceKobo}, stock_qty = ${input.stockQty},
        low_stock_threshold = ${input.lowStockThreshold}, supplier = ${input.supplier}, active = ${input.active}
    WHERE id = ${id} AND organization_id = ${orgId}
    RETURNING *
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function deleteProduct(orgId: string, id: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM products WHERE id = ${id} AND organization_id = ${orgId}`;
}

export async function adjustProductStock(orgId: string, id: string, delta: number): Promise<Product | null> {
  const sql = getSql();
  const rows = await sql`
    UPDATE products SET stock_qty = stock_qty + ${delta}
    WHERE id = ${id} AND organization_id = ${orgId}
    RETURNING *
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}
