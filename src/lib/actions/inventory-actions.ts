"use server";

import { adjustStock } from "@/lib/db/inventory";
import { getProduct } from "@/lib/db/products";
import { requireSession } from "@/lib/session";
import { notifyLowStock, crossedIntoLowStock } from "@/lib/notify";
import type { ActionResult } from "./types";
import type { InventoryMovement } from "@/lib/types";

export async function adjustStockAction(productId: string, delta: number, reason: string): Promise<ActionResult<InventoryMovement>> {
  try {
    const { organizationId } = await requireSession();
    const before = await getProduct(organizationId, productId);
    const movement = await adjustStock(organizationId, productId, delta, reason);
    if (!movement) return { ok: false, error: "Product not found." };
    if (before) {
      const after = await getProduct(organizationId, productId);
      if (after && crossedIntoLowStock(before.stockQty, before.lowStockThreshold, after.stockQty, after.lowStockThreshold)) {
        void notifyLowStock(organizationId, { name: after.name, stockQty: after.stockQty });
      }
    }
    return { ok: true, data: movement };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't adjust stock." };
  }
}
