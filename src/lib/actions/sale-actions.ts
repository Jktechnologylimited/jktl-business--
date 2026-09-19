"use server";

import * as db from "@/lib/db/sales";
import { getProduct } from "@/lib/db/products";
import { requireSession } from "@/lib/session";
import { persistImage, releaseImage, StorageQuotaError } from "@/lib/blob";
import { notifyLowStock } from "@/lib/notify";
import type { ActionResult } from "./types";
import type { Sale, SaleItem } from "@/lib/types";

/**
 * Checks each product this sale sold against its low-stock threshold —
 * fires a push only for the ones that just crossed INTO the low-stock band
 * (fine to derive "before" as `current + quantitySold` here rather than
 * reading the product twice, since we already know exactly how much this
 * sale just deducted from it).
 */
async function checkLowStockAfterSale(organizationId: string, items: db.SaleLineInput[]): Promise<void> {
  const soldQtyByProduct = new Map<string, number>();
  for (const item of items) {
    if (item.kind !== "product") continue;
    soldQtyByProduct.set(item.refId, (soldQtyByProduct.get(item.refId) ?? 0) + item.quantity);
  }
  if (soldQtyByProduct.size === 0) return;

  await Promise.allSettled(
    Array.from(soldQtyByProduct.entries()).map(async ([productId, soldQty]) => {
      const product = await getProduct(organizationId, productId);
      if (!product) return;
      const previousQty = product.stockQty + soldQty;
      if (previousQty > product.lowStockThreshold && product.stockQty <= product.lowStockThreshold) {
        await notifyLowStock(organizationId, { name: product.name, stockQty: product.stockQty });
      }
    }),
  );
}

export async function createSaleAction(input: db.SaleInput): Promise<ActionResult<{ sale: Sale; items: SaleItem[] }>> {
  try {
    const { organizationId } = await requireSession();
    const receiptPhotoUrl = (await persistImage(input.receiptPhotoUrl, "receipts", organizationId)) ?? null;
    const result = await db.createSale(organizationId, { ...input, receiptPhotoUrl });
    void checkLowStockAfterSale(organizationId, input.items);
    return { ok: true, data: result };
  } catch (err) {
    if (err instanceof StorageQuotaError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "Couldn't record this sale." };
  }
}

export async function updateSalePaymentAction(id: string, patch: db.SalePaymentPatch): Promise<ActionResult<Sale>> {
  try {
    const { organizationId } = await requireSession();
    const previous = patch.receiptPhotoUrl !== undefined ? await db.getSale(organizationId, id) : null;
    const receiptPhotoUrl =
      patch.receiptPhotoUrl !== undefined ? (await persistImage(patch.receiptPhotoUrl, "receipts", organizationId)) ?? null : undefined;
    const sale = await db.updateSalePayment(organizationId, id, { ...patch, receiptPhotoUrl });
    if (!sale) return { ok: false, error: "That sale no longer exists." };
    if (previous?.receiptPhotoUrl && previous.receiptPhotoUrl !== receiptPhotoUrl) void releaseImage(previous.receiptPhotoUrl, organizationId);
    return { ok: true, data: sale };
  } catch (err) {
    if (err instanceof StorageQuotaError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "Couldn't update this sale's payment." };
  }
}
