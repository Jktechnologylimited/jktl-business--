"use client";

import { useRef, useState } from "react";
import { Camera, Image as ImageIcon, Loader2, X } from "lucide-react";
import { fileToRectDataUrl } from "@/lib/image";
import { useToastStore } from "@/lib/toast";

/** Wide banner photo for the public site's hero. Same upload pattern as
 * `LogoUploadField` (client-side crop → data URL → held in the parent
 * form's state → uploaded on Save), just a 16:9 crop instead of square. */
export function CoverPhotoField({ value, onChange }: { value: string | null; onChange: (dataUrl: string | null) => void }) {
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
      const dataUrl = await fileToRectDataUrl(file, 1200, 675);
      onChange(dataUrl);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't process that image", "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-border-strong bg-surface">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL or hosted URL, not a static asset
          <img src={value} alt="Cover" className="size-full object-cover" />
        ) : (
          <ImageIcon className="size-8 text-ink-faint" />
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="absolute bottom-2 right-2 flex size-9 items-center justify-center rounded-full border-2 border-paper bg-primary text-white shadow-sm disabled:opacity-60"
          aria-label="Change cover photo"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
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
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => inputRef.current?.click()} className="text-left text-sm font-medium text-primary" disabled={busy}>
          {value ? "Change cover photo" : "Upload cover photo"}
        </button>
        {value ? (
          <button type="button" onClick={() => onChange(null)} className="flex items-center gap-1 text-left text-xs text-ink-muted hover:text-danger">
            <X className="size-3" /> Remove
          </button>
        ) : (
          <span className="text-xs text-ink-muted">Wide photo, up to 8MB</span>
        )}
      </div>
    </div>
  );
}
