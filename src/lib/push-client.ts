/** Browser-side half of push notifications — turning a "yes, notify me" tap
 * into a real PushSubscription and back out again. Server-side counterpart
 * is src/lib/push.ts (sending) and src/lib/db/push.ts (storage). */

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

/** True only when every piece push notifications need is actually present:
 * a service worker, the Push API, Notification permission, and a VAPID
 * public key baked in at build time. The service worker itself only
 * registers in production (see AppBootstrap), so this is naturally false
 * in local dev too — same as the rest of the PWA's offline features. */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
  );
}

/** True on an iPhone/iPad/iPod, including an iPad reporting itself as
 * "Macintosh" with touch support (iPadOS 13+'s default desktop-site UA) —
 * the same check used by the "Add to home screen" guide's platform
 * detection, kept here too so push-support messaging can be iOS-specific. */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

/** True when this page was opened from its home-screen icon rather than a
 * normal browser tab. iOS Safari only ever exposes `navigator.standalone`
 * for this; other browsers report it through the display-mode media query. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (navigator as unknown as { standalone?: boolean }).standalone;
  return Boolean(iosStandalone) || window.matchMedia("(display-mode: standalone)").matches;
}

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Asks for notification permission and subscribes this device, returning
 * the subscription's keys to save server-side — or null if permission was
 * denied, the browser doesn't support push, or no VAPID key is configured
 * for this deployment. */
export async function subscribeToPush(): Promise<PushSubscriptionKeys | null> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey || !isPushSupported()) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null;
  return { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth };
}

/** Unsubscribes this device and returns the endpoint it had (so the
 * caller can remove the matching server-side row), or null if it was
 * never subscribed in the first place. */
export async function unsubscribeFromPush(): Promise<string | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return null;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  return endpoint;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}
