"use server";

import * as db from "@/lib/db/services";
import { requireSession } from "@/lib/session";
import { persistImage, releaseImage, StorageQuotaError } from "@/lib/blob";
import type { ActionResult } from "./types";
import type { Service } from "@/lib/types";

/** Services flow through the same offline outbox as products (see
 * `store.ts`'s `addService`/`updateService`), so `input.imageUrl` here can
 * be a fresh data URL queued while offline — same persist/release-on-change
 * pattern as `product-actions.ts`. */
export async function createServiceAction(id: string, input: db.ServiceInput): Promise<ActionResult<Service>> {
  try {
    const { organizationId } = await requireSession();
    const imageUrl = (await persistImage(input.imageUrl, "services", organizationId)) ?? null;
    return { ok: true, data: await db.createService(organizationId, id, { ...input, imageUrl }) };
  } catch (err) {
    if (err instanceof StorageQuotaError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "Couldn't save this service." };
  }
}

export async function updateServiceAction(id: string, input: db.ServiceInput): Promise<ActionResult<Service>> {
  try {
    const { organizationId } = await requireSession();
    const previous = await db.getService(organizationId, id);
    const imageUrl = (await persistImage(input.imageUrl, "services", organizationId)) ?? null;
    const service = await db.updateService(organizationId, id, { ...input, imageUrl });
    if (!service) return { ok: false, error: "Service not found." };
    if (previous?.imageUrl && previous.imageUrl !== imageUrl) void releaseImage(previous.imageUrl, organizationId);
    return { ok: true, data: service };
  } catch (err) {
    if (err instanceof StorageQuotaError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "Couldn't update this service." };
  }
}

export async function deleteServiceAction(id: string): Promise<ActionResult<null>> {
  try {
    const { organizationId } = await requireSession();
    const previous = await db.getService(organizationId, id);
    await db.deleteService(organizationId, id);
    if (previous?.imageUrl) void releaseImage(previous.imageUrl, organizationId);
    return { ok: true, data: null };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't delete this service." };
  }
}
