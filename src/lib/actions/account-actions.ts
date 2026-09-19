"use server";

import { getUser, setAvatar, updateAccount } from "@/lib/db/organizations";
import { requireSession } from "@/lib/session";
import { persistImage, releaseImage, StorageQuotaError } from "@/lib/blob";
import type { ActionResult } from "./types";
import type { AppUser } from "@/lib/types";

export async function updateAccountAction(patch: { name: string; email: string; phone: string }): Promise<ActionResult<AppUser>> {
  try {
    const { userId } = await requireSession();
    const user = await updateAccount(userId, patch);
    if (!user) return { ok: false, error: "Account not found." };
    return { ok: true, data: user };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't update your profile." };
  }
}

export async function setAvatarAction(dataUrl: string | null): Promise<ActionResult<AppUser>> {
  try {
    const { userId, organizationId } = await requireSession();
    const previous = await getUser(userId);
    const storedUrl = (await persistImage(dataUrl, "avatars", organizationId)) ?? null;
    const user = await setAvatar(userId, storedUrl);
    if (!user) return { ok: false, error: "Account not found." };
    if (previous?.avatarUrl && previous.avatarUrl !== storedUrl) void releaseImage(previous.avatarUrl, organizationId);
    return { ok: true, data: user };
  } catch (err) {
    if (err instanceof StorageQuotaError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "Couldn't update your photo." };
  }
}
