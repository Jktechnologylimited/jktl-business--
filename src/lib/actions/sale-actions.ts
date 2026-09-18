"use server";

import * as db from "@/lib/db/sales";
import { requireSession } from "@/lib/session";
import { persistImage, deleteImageIfBlob } from "@/lib/blob";
import type { ActionResult } from "./types";
import type { Sale, SaleItem } from "@/lib/types";

export async function createSaleAction(input: db.SaleInput): Promise<ActionResult<{ sale: Sale; items: SaleItem[] }>> {
  try {
    const { organizationId } = await requireSession();
    const receiptPhotoUrl = (await persistImage(input.receiptPhotoUrl, "receipts")) ?? null;
    const result = await db.createSale(organizationId, { ...input, receiptPhotoUrl });
    return { ok: true, data: result };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't record this sale." };
  }
}

export async function updateSalePaymentAction(id: string, patch: db.SalePaymentPatch): Promise<ActionResult<Sale>> {
  try {
    const { organizationId } = await requireSession();
    const previous = patch.receiptPhotoUrl !== undefined ? await db.getSale(organizationId, id) : null;
    const receiptPhotoUrl = patch.receiptPhotoUrl !== undefined ? (await persistImage(patch.receiptPhotoUrl, "receipts")) ?? null : undefined;
    const sale = await db.updateSalePayment(organizationId, id, { ...patch, receiptPhotoUrl });
    if (!sale) return { ok: false, error: "That sale no longer exists." };
    if (previous?.receiptPhotoUrl && previous.receiptPhotoUrl !== receiptPhotoUrl) void deleteImageIfBlob(previous.receiptPhotoUrl);
    return { ok: true, data: sale };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't update this sale's payment." };
  }
}
