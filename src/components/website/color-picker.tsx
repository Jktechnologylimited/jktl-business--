"use client";

const PRESETS = ["#0f6e5c", "#c98a2c", "#2f6fad", "#a6371e", "#7b3fa0", "#0b0d11"];

export function ColorPicker({ value, onChange }: { value: string | undefined | null; onChange: (color: string) => void }) {
  // Defensive: this always gets a real string in practice, but a native
  // <input type="color"> throws if handed `undefined`/`""`, and a stray
  // undefined here shouldn't take down the whole settings page — fall back
  // to the app's default brand color instead.
  const safeValue = value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#0f6e5c";

  return (
    <div className="flex items-center gap-3">
      <label className="relative flex size-11 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-border-strong">
        <input
          type="color"
          value={safeValue}
          onChange={(e) => onChange(e.target.value)}
          className="absolute -inset-2 cursor-pointer"
          aria-label="Custom brand color"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            aria-label={color}
            style={{ backgroundColor: color }}
            className={`size-8 rounded-full border-2 transition-transform ${safeValue.toLowerCase() === color ? "scale-110 border-ink" : "border-transparent"}`}
          />
        ))}
      </div>
    </div>
  );
}
