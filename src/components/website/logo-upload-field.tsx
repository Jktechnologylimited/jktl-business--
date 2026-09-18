"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { fileToSquareDataUrl } from "@/lib/image";
import { useToastStore } from "@/lib/toast";
import { initials } from "@/lib/format";

/** Logo for the public website. Square-cropped like the avatar upload (a
 * logo is usually shown in a fixed-size badge), but its own component since
 * it lives in a different part of the UI and has its own fallback (business
 * initials rather than a person's). */
export function LogoUploadField({
  businessName,
  value,
  onChange,
}: {
  businessName: string;
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
    if (file.size > 8 * 1024 * 1024) {
      showToast("That image is too large — try one under 8MB", "danger");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await fileToSquareDataUrl(file, 320);
      onChange(dataUrl);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't process that image", "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL or hosted URL, not a static asset
          <img src={value} alt="Logo" className="size-16 rounded-2xl border border-border-strong object-cover" />
        ) : (
          <span className="flex size-16 items-center justify-center rounded-2xl bg-accent-soft text-lg font-semibold text-accent-strong">
            {initials(businessName || "Business")}
          </span>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full border-2 border-paper bg-primary text-white shadow-sm disabled:opacity-60"
          aria-label="Change logo"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <button type="button" onClick={() => inputRef.current?.click()} className="text-left text-sm font-medium text-primary" disabled={busy}>
          {value ? "Change logo" : "Upload logo"}
        </button>
        {value ? (
          <button type="button" onClick={() => onChange(null)} className="flex items-center gap-1 text-left text-xs text-ink-muted hover:text-danger">
            <X className="size-3" /> Remove
          </button>
        ) : (
          <span className="text-xs text-ink-muted">JPG or PNG, up to 8MB</span>
        )}
      </div>
    </div>
  );
}
