"use server";

import { requireSession } from "@/lib/session";
import { getStorageUsage, type StorageUsage } from "@/lib/db/storage";
import type { ActionResult } from "./types";

/** Read-only — the Settings → Plan tab's storage bar calls this on mount.
 * Nothing here changes state; the actual enforcement happens in `blob.ts`
 * at upload time via `hasStorageQuota`. */
export async function getStorageUsageAction(): Promise<ActionResult<StorageUsage>> {
  try {
    const { organizationId } = await requireSession();
    const usage = await getStorageUsage(organizationId);
    return { ok: true, data: usage };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't load storage usage." };
  }
}
