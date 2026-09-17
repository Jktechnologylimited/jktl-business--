import { getSql } from "./client";
import { isoDate } from "./rows";
import type { InventoryMovement, MovementType } from "@/lib/types";

function mapRow(row: Record<string, unknown>): InventoryMovement {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    productId: row.product_id as string,
    type: row.type as MovementType,
    quantity: Number(row.quantity),
    reason: row.reason as string,
    createdAt: isoDate(row.created_at as string),
  };
}

export async function listMovements(orgId: string): Promise<InventoryMovement[]> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM inventory_movements WHERE organization_id = ${orgId} ORDER BY created_at DESC`;
  return rows.map(mapRow);
}

/** Adjusts stock and logs the movement in one statement (single CTE = atomic). */
export async function adjustStock(orgId: string, productId: string, delta: number, reason: string): Promise<InventoryMovement | null> {
  const sql = getSql();
  const type: MovementType = delta >= 0 ? "addition" : "adjustment";
  const rows = await sql`
    WITH updated AS (
      UPDATE products SET stock_qty = stock_qty + ${delta}
      WHERE id = ${productId} AND organization_id = ${orgId}
      RETURNING id
    )
    INSERT INTO inventory_movements (organization_id, product_id, type, quantity, reason)
    SELECT ${orgId}, id, ${type}, ${delta}, ${reason} FROM updated
    RETURNING *
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}
