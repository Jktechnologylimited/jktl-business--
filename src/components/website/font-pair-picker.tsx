"use client";

import { Check } from "lucide-react";
import { SITE_FONT_PAIRS } from "@/lib/fonts";

/** Lets a business pick one of 7 display+body font pairings for their
 * public website, independent of the accent color. Each option previews
 * itself in its own actual fonts (the CSS custom properties for every
 * pairing are defined globally on `<html>` — see `ALL_SITE_FONT_VARIABLES`
 * in `src/lib/fonts.ts` — so this works without any extra wrapper here). */
export function FontPairPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {SITE_FONT_PAIRS.map((pair) => {
        const active = value === pair.id;
        return (
          <button
            key={pair.id}
            type="button"
            onClick={() => onChange(pair.id)}
            aria-pressed={active}
            className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors ${
              active ? "border-primary bg-primary-soft" : "border-border-strong hover:border-primary"
            }`}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <span style={{ fontFamily: pair.displayVar }} className="text-lg font-semibold text-ink">
                Aa
              </span>
              {active ? <Check className="size-4 shrink-0 text-primary" /> : null}
            </div>
            <span className="text-xs font-medium text-ink">{pair.label}</span>
            <span style={{ fontFamily: pair.bodyVar }} className="text-[11px] text-ink-muted">
              {pair.vibe}
            </span>
          </button>
        );
      })}
    </div>
  );
}
