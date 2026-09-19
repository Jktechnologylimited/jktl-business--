"use server";

import { redirect } from "next/navigation";
import { verifyAdminLogin } from "@/lib/db/admin-auth";
import { startAdminSession, endAdminSession, requireAdminSession } from "@/lib/admin-session";
import { listBroadcastSubscriptions } from "@/lib/db/push";
import { sendBroadcastPush } from "@/lib/push";
import { recordBroadcast, listBroadcasts } from "@/lib/db/admin";
import type { AdminBroadcast } from "@/lib/db/admin";
import type { ActionResult } from "./types";

export async function adminLoginAction(email: string, password: string): Promise<ActionResult<null>> {
  try {
    const admin = await verifyAdminLogin(email, password);
    if (!admin) return { ok: false, error: "That email and password don't match a command-center account." };
    await startAdminSession(admin.id);
    return { ok: true, data: null };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't sign in right now. Please try again." };
  }
}

/** Used directly as a `<form action={adminLogoutAction}>` — ending the
 * session and redirecting in the same server action means there's no
 * client-side round trip that could be skipped. */
export async function adminLogoutAction(): Promise<void> {
  await endAdminSession();
  redirect("/admin/login");
}

/**
 * Sends a push notification to every business that has push on and hasn't
 * opted out of platform announcements (downtime notices, promotions,
 * etc.) — see src/lib/db/push.ts's listBroadcastSubscriptions. Unlike the
 * rest of the command center, this is the one thing here that *writes*
 * something outward rather than just viewing account-level stats — it
 * never touches a business's own operational data, only pushes a message
 * to their device.
 */
export async function sendBroadcastAction(input: {
  category: string;
  title: string;
  body: string;
  url: string;
}): Promise<ActionResult<AdminBroadcast>> {
  try {
    const admin = await requireAdminSession();
    if (!input.title.trim() || !input.body.trim()) {
      return { ok: false, error: "Title and message are both required." };
    }

    const subscriptions = await listBroadcastSubscriptions();
    const recipientCount = await sendBroadcastPush(subscriptions, {
      title: input.title.trim(),
      body: input.body.trim(),
      url: input.url.trim() || undefined,
    });

    const record = await recordBroadcast(admin.id, {
      category: input.category,
      title: input.title.trim(),
      body: input.body.trim(),
      url: input.url.trim(),
      recipientCount,
    });
    return { ok: true, data: record };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't send that broadcast." };
  }
}

export async function listBroadcastsAction(): Promise<ActionResult<AdminBroadcast[]>> {
  try {
    await requireAdminSession();
    return { ok: true, data: await listBroadcasts() };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't load broadcast history." };
  }
}
