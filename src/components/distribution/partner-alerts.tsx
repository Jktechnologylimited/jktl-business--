"use client";
import { useState } from "react";
import {
  savePartnerPushAction,
  saveTeamProgrammePushAction,
  removeTeamProgrammePushAction,
  removePartnerPushAction,
} from "@/lib/actions/partner-operations-actions";
import { AddToHomeScreenGuide } from "@/components/help/add-to-home-screen-guide";
export function PartnerAlerts({ team = false }: { team?: boolean }) {
  const [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  async function enable() {
    setBusy(true);
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window))
        throw Error(
          "Use a supported browser or install JKTL on your home screen.",
        );
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key)
        throw Error(
          "Push alerts are not configured yet. Updates remain available in your inbox.",
        );
      if ((await Notification.requestPermission()) !== "granted")
        throw Error("Notifications are blocked in browser settings.");
      await navigator.serviceWorker.register("/sw.js");
      const sw = await navigator.serviceWorker.ready;
      let sub = await sw.pushManager.getSubscription();
      if (!sub) {
        const value = key.replace(/-/g, "+").replace(/_/g, "/");
        const bytes = Uint8Array.from(
          atob(value.padEnd(Math.ceil(value.length / 4) * 4, "=")),
          (c) => c.charCodeAt(0),
        );
        sub = await sw.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: bytes,
        });
      }
      const json = sub.toJSON();
      await (team ? saveTeamProgrammePushAction : savePartnerPushAction)({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      });
      setStatus("Programme alerts enabled for this signed-in device.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Unable to enable alerts.");
    } finally {
      setBusy(false);
    }
  }
  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await (team ? removeTeamProgrammePushAction : removePartnerPushAction)(
          sub.endpoint,
        );
        await sub.unsubscribe();
      }
      setStatus("Programme alerts disabled for this device.");
    } catch {
      setStatus("Could not update alerts. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="rounded-xl border border-border p-5">
      <summary className="font-semibold">
        Install JKTL & programme notifications
      </summary>
      <div className="mt-4 space-y-4">
        <AddToHomeScreenGuide />
        <p className="text-sm">
          Install JKTL for convenient access. Browser alerts require your
          permission and an active programme session; email updates use your
          program email.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            disabled={busy}
            type="button"
            onClick={enable}
            className="rounded-lg border border-border p-3"
          >
            Enable alerts
          </button>
          <button
            disabled={busy}
            type="button"
            onClick={disable}
            className="rounded-lg border border-border p-3"
          >
            Disable alerts
          </button>
        </div>
        {status && <p role="status">{status}</p>}
      </div>
    </details>
  );
}
