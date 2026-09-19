"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { fileToDataUrl } from "@/lib/image";
import { useToastStore } from "@/lib/toast";

/** Optional photo of the physical receipt issued for a sale. Not a crop —
 * receipts are documents, so the full frame (resized) is kept. */
export function ReceiptPhotoField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const showToast = useToastStore((s) => s.show);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Please choose an image file", "danger");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast("That image is too large — try one under 10MB", "danger");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      onChange(dataUrl);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't process that image", "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-ink">Receipt photo (optional)</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {value ? (
        <div className="relative overflow-hidden rounded-xl border border-border-strong">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL, not a static asset */}
          <img src={value} alt="Receipt" className="max-h-56 w-full object-contain bg-surface" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-toast/70 text-white"
            aria-label="Remove photo"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex h-24 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong text-sm font-medium text-ink-muted hover:border-primary hover:text-primary disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
          {busy ? "Processing…" : "Add a photo of the receipt"}
        </button>
      )}
    </div>
  );
}
