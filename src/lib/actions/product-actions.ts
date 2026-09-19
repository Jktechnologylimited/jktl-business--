"use server";

import * as db from "@/lib/db/products";
import { requireSession } from "@/lib/session";
import { persistImage, releaseImage, StorageQuotaError } from "@/lib/blob";
import { notifyLowStock, crossedIntoLowStock } from "@/lib/notify";
import type { ActionResult } from "./types";
import type { Product } from "@/lib/types";

/** Products flow through the same offline outbox as every other mutation
 * (see `store.ts`'s `addProduct`/`updateProduct`), so `input.imageUrl` here
 * can be a fresh data URL queued while offline — this is where it actually
 * gets uploaded and checked against the storage quota, same pattern as a
 * sale's receipt photo in `sale-actions.ts`. */
export async function createProductAction(id: string, input: db.ProductInput): Promise<ActionResult<Product>> {
  try {
    const { organizationId } = await requireSession();
    const imageUrl = (await persistImage(input.imageUrl, "products", organizationId)) ?? null;
    return { ok: true, data: await db.createProduct(organizationId, id, { ...input, imageUrl }) };
  } catch (err) {
    if (err instanceof StorageQuotaError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "Couldn't save this product." };
  }
}

export async function updateProductAction(id: string, input: db.ProductInput): Promise<ActionResult<Product>> {
  try {
    const { organizationId } = await requireSession();
    const previous = await db.getProduct(organizationId, id);
    const imageUrl = (await persistImage(input.imageUrl, "products", organizationId)) ?? null;
    const product = await db.updateProduct(organizationId, id, { ...input, imageUrl });
    if (!product) return { ok: false, error: "Product not found." };
    if (previous?.imageUrl && previous.imageUrl !== imageUrl) void releaseImage(previous.imageUrl, organizationId);
    if (previous && crossedIntoLowStock(previous.stockQty, previous.lowStockThreshold, product.stockQty, product.lowStockThreshold)) {
      void notifyLowStock(organizationId, { name: product.name, stockQty: product.stockQty });
    }
    return { ok: true, data: product };
  } catch (err) {
    if (err instanceof StorageQuotaError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "Couldn't update this product." };
  }
}

export async function deleteProductAction(id: string): Promise<ActionResult<null>> {
  try {
    const { organizationId } = await requireSession();
    const previous = await db.getProduct(organizationId, id);
    await db.deleteProduct(organizationId, id);
    if (previous?.imageUrl) void releaseImage(previous.imageUrl, organizationId);
    return { ok: true, data: null };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't delete this product." };
  }
}
