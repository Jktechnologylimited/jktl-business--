"use server";

import * as db from "@/lib/db/services";
import { requireSession } from "@/lib/session";
import type { ActionResult } from "./types";
import type { Service } from "@/lib/types";

export async function createServiceAction(id: string, input: db.ServiceInput): Promise<ActionResult<Service>> {
  try {
    const { organizationId } = await requireSession();
    return { ok: true, data: await db.createService(organizationId, id, input) };
  } catch {
    return { ok: false, error: "Couldn't save this service." };
  }
}

export async function updateServiceAction(id: string, input: db.ServiceInput): Promise<ActionResult<Service>> {
  try {
    const { organizationId } = await requireSession();
    const service = await db.updateService(organizationId, id, input);
    if (!service) return { ok: false, error: "Service not found." };
    return { ok: true, data: service };
  } catch {
    return { ok: false, error: "Couldn't update this service." };
  }
}

export async function deleteServiceAction(id: string): Promise<ActionResult<null>> {
  try {
    const { organizationId } = await requireSession();
    await db.deleteService(organizationId, id);
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: "Couldn't delete this service." };
  }
}
