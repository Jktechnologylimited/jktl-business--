"use server";

import { requireSession } from "@/lib/session";
import {
  getNotificationPrefs,
  updateNotificationPrefs,
  saveSubscription,
  removeSubscriptionByEndpoint,
} from "@/lib/db/push";
import type { NotificationPrefs, PushSubscriptionKeys } from "@/lib/db/push";
import type { ActionResult } from "./types";

export async function getNotificationPrefsAction(): Promise<ActionResult<NotificationPrefs>> {
  try {
    const { organizationId } = await requireSession();
    return { ok: true, data: await getNotificationPrefs(organizationId) };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't load your notification settings." };
  }
}

export async function updateNotificationPrefsAction(patch: Partial<NotificationPrefs>): Promise<ActionResult<NotificationPrefs>> {
  try {
    const { organizationId } = await requireSession();
    return { ok: true, data: await updateNotificationPrefs(organizationId, patch) };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't update your notification settings." };
  }
}

/** Called right after the browser grants permission and the service
 * worker's push manager hands back a subscription — this is what makes
 * that subscription actually usable server-side. */
export async function saveSubscriptionAction(subscription: PushSubscriptionKeys): Promise<ActionResult<null>> {
  try {
    const { organizationId } = await requireSession();
    await saveSubscription(organizationId, subscription);
    return { ok: true, data: null };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't save this device for notifications." };
  }
}

export async function removeSubscriptionAction(endpoint: string): Promise<ActionResult<null>> {
  try {
    const { organizationId } = await requireSession();
    await removeSubscriptionByEndpoint(organizationId, endpoint);
    return { ok: true, data: null };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't remove this device." };
  }
}
