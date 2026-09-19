import "server-only";
import webpush from "web-push";
import { listSubscriptions, removeSubscription } from "@/lib/db/push";
import type { PushSubscriptionKeys } from "@/lib/db/push";

let configured = false;

/** Lazy, like `getSql()` — configuring VAPID at module scope would throw
 * during `next build` on any environment that hasn't generated keys yet
 * (this sandbox included). Returns false, silently, when push isn't set
 * up — same "never let a missing integration break the app" principle as
 * `src/lib/email.ts` without a RESEND_API_KEY. */
function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:support@jktl.com.ng", publicKey, privateKey);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Path to open (via the service worker's `notificationclick` handler)
   * when the notification itself is tapped. */
  url?: string;
}

/**
 * Sends one push notification to every device this business has
 * subscribed. Best-effort: a dead subscription (device uninstalled, site
 * data cleared) gets pruned rather than retried, and any other failure is
 * swallowed here — same as every other notification in this app, sending
 * one must never be able to fail the action that triggered it.
 */
export async function sendPush(orgId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return;
  const subs = await listSubscriptions(orgId);
  if (subs.length === 0) return;

  const body = JSON.stringify(payload);
  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body);
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await removeSubscription(sub.endpoint).catch(() => undefined);
        }
      }
    }),
  );
}

/**
 * Sends one push to an arbitrary list of subscriptions — used only by the
 * command center's broadcast feature, which (unlike `sendPush` above)
 * already has its recipient list gathered across every business at once
 * (see `listBroadcastSubscriptions`), so there's no single `orgId` to key
 * off of here. Returns how many actually went out, for the admin's own
 * record of that broadcast.
 */
export async function sendBroadcastPush(subs: PushSubscriptionKeys[], payload: PushPayload): Promise<number> {
  if (!ensureConfigured() || subs.length === 0) return 0;

  const body = JSON.stringify(payload);
  let sent = 0;
  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body);
        sent += 1;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await removeSubscription(sub.endpoint).catch(() => undefined);
        }
      }
    }),
  );
  return sent;
}
