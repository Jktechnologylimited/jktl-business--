"use server";

import { setAvatar, updateAccount } from "@/lib/db/organizations";
import { requireSession } from "@/lib/session";
import type { ActionResult } from "./types";
import type { AppUser } from "@/lib/types";

export async function updateAccountAction(patch: { name: string; email: string; phone: string }): Promise<ActionResult<AppUser>> {
  try {
    const { userId } = await requireSession();
    const user = await updateAccount(userId, patch);
    if (!user) return { ok: false, error: "Account not found." };
    return { ok: true, data: user };
  } catch {
    return { ok: false, error: "Couldn't update your profile." };
  }
}

export async function setAvatarAction(dataUrl: string | null): Promise<ActionResult<AppUser>> {
  try {
    const { userId } = await requireSession();
    const user = await setAvatar(userId, dataUrl);
    if (!user) return { ok: false, error: "Account not found." };
    return { ok: true, data: user };
  } catch {
    return { ok: false, error: "Couldn't update your photo." };
  }
}
