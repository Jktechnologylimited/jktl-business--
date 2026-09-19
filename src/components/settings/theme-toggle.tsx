"use client";

import { useEffect, useState } from "react";
import { Laptop, Moon, Sun } from "lucide-react";

type ThemePref = "system" | "light" | "dark";

const STORAGE_KEY = "jktl-theme";

const OPTIONS: Array<{ value: ThemePref; label: string; icon: typeof Sun }> = [
  { value: "system", label: "System", icon: Laptop },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

/**
 * Light/dark/system for the business dashboard only — the public website
 * always renders light regardless of this (see the `.jktl-light` class in
 * globals.css). Reads the stored preference via a lazy initializer (the
 * same value `layout.tsx`'s blocking script already applied to <html>
 * before this component ever mounts) so there's nothing to flash or
 * resync on mount.
 */
export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>(() => {
    if (typeof window === "undefined") return "system";
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  });

  // Re-applies whenever the person picks a new option — the initial
  // (pre-hydration) application is the blocking script's job, not this
  // effect's; this only runs on an actual change.
  useEffect(() => {
    if (pref === "system") {
      document.documentElement.removeAttribute("data-theme");
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      document.documentElement.setAttribute("data-theme", pref);
      window.localStorage.setItem(STORAGE_KEY, pref);
    }
  }, [pref]);

  return (
    <div className="flex gap-1 rounded-xl bg-surface p-1">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setPref(value)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
            pref === value ? "bg-paper text-ink shadow-sm" : "text-ink-muted hover:text-ink"
          }`}
        >
          <Icon className="size-3.5" /> {label}
        </button>
      ))}
    </div>
  );
}
