"use server";

import * as db from "@/lib/db/products";
import { requireSession } from "@/lib/session";
import type { ActionResult } from "./types";
import type { Product } from "@/lib/types";

export async function createProductAction(id: string, input: db.ProductInput): Promise<ActionResult<Product>> {
  try {
    const { organizationId } = await requireSession();
    return { ok: true, data: await db.createProduct(organizationId, id, input) };
  } catch {
    return { ok: false, error: "Couldn't save this product." };
  }
}

export async function updateProductAction(id: string, input: db.ProductInput): Promise<ActionResult<Product>> {
  try {
    const { organizationId } = await requireSession();
    const product = await db.updateProduct(organizationId, id, input);
    if (!product) return { ok: false, error: "Product not found." };
    return { ok: true, data: product };
  } catch {
    return { ok: false, error: "Couldn't update this product." };
  }
}

export async function deleteProductAction(id: string): Promise<ActionResult<null>> {
  try {
    const { organizationId } = await requireSession();
    await db.deleteProduct(organizationId, id);
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: "Couldn't delete this product." };
  }
}
