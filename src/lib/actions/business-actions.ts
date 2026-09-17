"use server";

import { updateBusinessProfile } from "@/lib/db/organizations";
import { requireSession } from "@/lib/session";
import type { ActionResult } from "./types";
import type { BusinessProfile } from "@/lib/types";

export async function updateBusinessProfileAction(
  patch: Pick<BusinessProfile, "displayName" | "phone" | "email" | "address" | "city" | "state">,
): Promise<ActionResult<BusinessProfile>> {
  try {
    const { organizationId } = await requireSession();
    const profile = await updateBusinessProfile(organizationId, patch);
    if (!profile) return { ok: false, error: "Business profile not found." };
    return { ok: true, data: profile };
  } catch {
    return { ok: false, error: "Couldn't update your business details." };
  }
}
