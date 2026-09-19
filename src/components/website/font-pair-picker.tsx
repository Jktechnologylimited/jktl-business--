"use client";

import { Select } from "@/components/ui/input";
import { SITE_FONT_PAIRS, getSiteFontPair } from "@/lib/fonts";

/** Lets a business pick one of 7 display+body font pairings for their
 * public website, independent of the accent color. A plain dropdown
 * rather than a grid of cards — one line to scan instead of seven tiles —
 * with a small live preview underneath in the actual chosen fonts (the
 * CSS custom properties for every pairing are defined globally on
 * `<html>` — see `ALL_SITE_FONT_VARIABLES` in `src/lib/fonts.ts` — so the
 * preview works without any extra wrapper here). */
export function FontPairPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const selected = getSiteFontPair(value);
  return (
    <div className="flex flex-col gap-2">
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {SITE_FONT_PAIRS.map((pair) => (
          <option key={pair.id} value={pair.id}>
            {pair.label} — {pair.vibe}
          </option>
        ))}
      </Select>
      <div className="flex items-center gap-3 rounded-xl border border-border-strong bg-surface px-3.5 py-2.5">
        <span style={{ fontFamily: selected.displayVar }} className="text-xl font-semibold text-ink">
          Aa
        </span>
        <span style={{ fontFamily: selected.bodyVar }} className="text-sm text-ink-muted">
          The quick brown fox jumps
        </span>
      </div>
    </div>
  );
}
