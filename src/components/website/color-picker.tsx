"use client";

const PRESETS = ["#0f6e5c", "#c98a2c", "#2f6fad", "#a6371e", "#7b3fa0", "#0b0d11"];

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <label className="relative flex size-11 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-border-strong">
        <input
          type="color"
          value={value}
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
            className={`size-8 rounded-full border-2 transition-transform ${value.toLowerCase() === color ? "scale-110 border-ink" : "border-transparent"}`}
          />
        ))}
      </div>
    </div>
  );
}
