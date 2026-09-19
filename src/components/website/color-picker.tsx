"use client";

import { Check } from "lucide-react";
import { ACCENT_COLORS } from "@/lib/accent-colors";

/** A curated set of 7 accent colors a business can pick for their public
 * website — replaces the old free-form hex input so every storefront gets
 * a color that's actually been checked for contrast, rather than whatever
 * a native color-wheel produces. */
export function ColorPicker({ value, onChange }: { value: string | undefined | null; onChange: (color: string) => void }) {
  const safeValue = (value || "#0f6e5c").toLowerCase();

  return (
    <div className="flex flex-wrap gap-3">
      {ACCENT_COLORS.map((color) => {
        const active = safeValue === color.hex.toLowerCase();
        return (
          <button
            key={color.id}
            type="button"
            onClick={() => onChange(color.hex)}
            aria-label={color.label}
            aria-pressed={active}
            className="flex flex-col items-center gap-1.5"
          >
            <span
              style={{ backgroundColor: color.hex }}
              className={`flex size-11 items-center justify-center rounded-full border-2 transition-transform ${active ? "scale-110 border-ink" : "border-transparent"}`}
            >
              {active ? <Check className="size-4 text-white drop-shadow" /> : null}
            </span>
            <span className="text-[11px] text-ink-muted">{color.label}</span>
          </button>
        );
      })}
    </div>
  );
}
