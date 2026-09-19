"use client";

import { useEffect, useState } from "react";
import { BellOff } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { useToastStore } from "@/lib/toast";
import { isPushSupported, notificationPermission, subscribeToPush, unsubscribeFromPush } from "@/lib/push-client";
import { getNotificationPrefsAction, updateNotificationPrefsAction, saveSubscriptionAction, removeSubscriptionAction } from "@/lib/actions/push-actions";
import type { NotificationPrefs } from "@/lib/db/push";

const DEMO_PREFS: NotificationPrefs = {
  pushEnabled: false,
  bookingNotifications: true,
  lowStockAlerts: true,
  invoicePaidAlerts: true,
  dailySummary: false,
  platformAnnouncements: true,
};

const CATEGORY_TOGGLES: Array<{ key: keyof Omit<NotificationPrefs, "pushEnabled">; label: string; description: string }> = [
  { key: "bookingNotifications", label: "New bookings", description: "Notify me when a booking comes in" },
  { key: "lowStockAlerts", label: "Low-stock alerts", description: "Notify me when a product drops to its threshold" },
  { key: "invoicePaidAlerts", label: "Invoice paid", description: "Notify me when a customer pays an invoice" },
  { key: "dailySummary", label: "Daily summary", description: "A morning recap of yesterday's numbers" },
  { key: "platformAnnouncements", label: "Platform updates", description: "Downtime notices and promotions from JKTL" },
];

/**
 * Real push notifications (replacing the old "actual emails send once
 * Resend is connected" placeholder) — a master toggle that actually asks
 * the browser for permission and subscribes this device, plus per-category
 * toggles for what gets sent once it's on. Demo mode keeps the old
 * client-only behavior (nothing is actually wired up, no backend to save
 * to) so the settings screen still feels usable when trying the app out.
 */
export function NotificationsPanel({ mode }: { mode: "demo" | "live" }) {
  const showToast = useToastStore((s) => s.show);
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEMO_PREFS);
  const [loading, setLoading] = useState(mode === "live");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const supported = isPushSupported();
  const permission = notificationPermission();

  useEffect(() => {
    if (mode !== "live") return;
    getNotificationPrefsAction().then((result) => {
      if (result.ok) setPrefs(result.data);
      setLoading(false);
    });
  }, [mode]);

  async function togglePush(next: boolean) {
    setError("");
    if (mode !== "live") {
      setPrefs((p) => ({ ...p, pushEnabled: next }));
      showToast(next ? "Push enabled — you're in demo mode, so nothing actually sends" : "Push disabled");
      return;
    }
    if (!supported) {
      setError(
        permission === "denied"
          ? "Notifications are blocked for this site in your browser settings."
          : "Push notifications aren't available here — this needs a supported browser and the installed app (not the dev server)."
      );
      return;
    }

    setPending(true);
    if (next) {
      const subscription = await subscribeToPush();
      if (!subscription) {
        setPending(false);
        setError("Permission wasn't granted, so push couldn't be turned on.");
        return;
      }
      const saved = await saveSubscriptionAction(subscription);
      if (!saved.ok) {
        setPending(false);
        setError(saved.error);
        return;
      }
      const result = await updateNotificationPrefsAction({ pushEnabled: true });
      setPending(false);
      if (result.ok) {
        setPrefs(result.data);
        showToast("Push notifications turned on");
      } else {
        setError(result.error);
      }
    } else {
      const endpoint = await unsubscribeFromPush();
      if (endpoint) await removeSubscriptionAction(endpoint);
      const result = await updateNotificationPrefsAction({ pushEnabled: false });
      setPending(false);
      if (result.ok) {
        setPrefs(result.data);
        showToast("Push notifications turned off");
      } else {
        setError(result.error);
      }
    }
  }

  async function toggleCategory(key: keyof Omit<NotificationPrefs, "pushEnabled">, value: boolean) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    if (mode !== "live") return;
    const result = await updateNotificationPrefsAction({ [key]: value });
    if (!result.ok) {
      setPrefs(prefs); // revert on failure
      setError(result.error);
    }
  }

  return (
    <section className="rounded-2xl border border-border p-4">
      <h2 className="font-display text-sm font-semibold text-ink">Notifications</h2>
      <p className="mt-1 text-xs text-ink-muted">Real push notifications to this device — no email required.</p>

      <div className="mt-1 divide-y divide-border">
        <Toggle
          label="Push notifications"
          description={mode === "live" && loading ? "Loading…" : "Turn on to receive alerts on this device"}
          checked={prefs.pushEnabled}
          onChange={togglePush}
          disabled={pending || (mode === "live" && loading)}
        />
        {CATEGORY_TOGGLES.map((cat) => (
          <Toggle
            key={cat.key}
            label={cat.label}
            description={cat.description}
            checked={prefs[cat.key]}
            onChange={(v) => toggleCategory(cat.key, v)}
            disabled={!prefs.pushEnabled || (mode === "live" && loading)}
          />
        ))}
      </div>

      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      {!supported && mode === "live" ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-muted">
          <BellOff className="size-3.5" /> Push needs the installed app (add to home screen) or a supported desktop browser.
        </p>
      ) : null}
    </section>
  );
}
