"use server";

import * as db from "@/lib/db/sales";
import { requireSession } from "@/lib/session";
import type { ActionResult } from "./types";
import type { Sale, SaleItem } from "@/lib/types";

export async function createSaleAction(input: db.SaleInput): Promise<ActionResult<{ sale: Sale; items: SaleItem[] }>> {
  try {
    const { organizationId } = await requireSession();
    const result = await db.createSale(organizationId, input);
    return { ok: true, data: result };
  } catch {
    return { ok: false, error: "Couldn't record this sale." };
  }
}
