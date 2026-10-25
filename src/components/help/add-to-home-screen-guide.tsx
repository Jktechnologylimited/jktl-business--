"use client";

import { useState, useSyncExternalStore } from "react";
import { Share, MoreVertical, MonitorDown } from "lucide-react";
import { FilterTabs } from "@/components/app/filter-tabs";

type Platform = "ios" | "android" | "desktop";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "android";
  const ua = navigator.userAgent || "";
  const isIOS =
    /iPhone|iPad|iPod/.test(ua) ||
    (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  if (isIOS) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

const steps: Record<
  Platform,
  { icon: typeof Share; note: string; list: string[] }
> = {
  ios: {
    icon: Share,
    note: "Use Safari on iPhone or iPad for these steps. If your current browser does not offer Add to Home Screen, open this page in Safari.",
    list: [
      "Tap the Share icon in Safari's toolbar (the square with an arrow pointing up).",
      'Scroll down the share sheet and tap "Add to Home Screen".',
      'Tap "Add" in the top-right corner.',
    ],
  },
  android: {
    icon: MoreVertical,
    note: 'Works in Chrome. Some versions show an "Install app" banner automatically — you can tap that instead of the steps below.',
    list: [
      "Tap the ⋮ menu in the top-right corner of Chrome.",
      'Tap "Install app" (or "Add to Home screen").',
      'Confirm by tapping "Install".',
    ],
  },
  desktop: {
    icon: MonitorDown,
    note: "Works in Chrome or Edge on a computer.",
    list: [
      "Look for an install icon in the address bar, on the right — it looks like a small monitor with a down arrow, or a ⊕.",
      'Click it, then click "Install".',
      'If you don\'t see the icon, open the browser\'s menu and look for "Install JKTL Business…" or "Apps → Install this site as an app".',
    ],
  },
};

const labels: Record<Platform, string> = {
  ios: "iPhone / iPad",
  android: "Android",
  desktop: "Computer",
};

const subscribePlatform = () => () => {};
const serverPlatform = (): Platform => "desktop";

export function AddToHomeScreenGuide() {
  // Use a stable server snapshot, then detect the browser without hydration mismatches.
  const detected = useSyncExternalStore(
    subscribePlatform,
    detectPlatform,
    serverPlatform,
  );
  const [selection, setPlatform] = useState<Platform | null>(null);
  const platform = selection ?? detected;

  const current = steps[platform];
  const Icon = current.icon;

  return (
    <div className="flex flex-col gap-3">
      <FilterTabs<Platform>
        options={[
          { value: "ios", label: labels.ios },
          { value: "android", label: labels.android },
          { value: "desktop", label: labels.desktop },
        ]}
        value={platform}
        onChange={setPlatform}
      />
      <div className="flex items-start gap-2 rounded-xl bg-surface px-3.5 py-2.5 text-xs text-ink-muted">
        <Icon className="mt-0.5 size-3.5 shrink-0" />
        <span>{current.note}</span>
      </div>
      <ol className="flex flex-col gap-2">
        {current.list.map((step, i) => (
          <li key={i} className="flex gap-2.5 text-sm text-ink">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary-strong">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
