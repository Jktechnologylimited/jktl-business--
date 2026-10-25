"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import {
  useThemePreference,
  setThemePreference,
  type ThemePreference,
} from "@/lib/theme";
type ThemePref = ThemePreference;

const OPTIONS: Array<{ value: ThemePref; label: string; icon: typeof Sun }> = [
  { value: "system", label: "System", icon: Laptop },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

/** Shared with the theme controls in the customer and programme workspaces. */
export function ThemeToggle() {
  const pref = useThemePreference();
  return (
    <div className="flex gap-1 rounded-xl bg-surface p-1">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setThemePreference(value)}
          aria-pressed={pref === value}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
            pref === value
              ? "bg-paper text-ink shadow-sm"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          <Icon className="size-3.5" /> {label}
        </button>
      ))}
    </div>
  );
}
