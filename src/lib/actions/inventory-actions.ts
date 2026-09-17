"use server";

import { adjustStock } from "@/lib/db/inventory";
import { requireSession } from "@/lib/session";
import type { ActionResult } from "./types";
import type { InventoryMovement } from "@/lib/types";

export async function adjustStockAction(productId: string, delta: number, reason: string): Promise<ActionResult<InventoryMovement>> {
  try {
    const { organizationId } = await requireSession();
    const movement = await adjustStock(organizationId, productId, delta, reason);
    if (!movement) return { ok: false, error: "Product not found." };
    return { ok: true, data: movement };
  } catch {
    return { ok: false, error: "Couldn't adjust stock." };
  }
}
