"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { Avatar } from "@/components/app/avatar";
import { fileToSquareDataUrl } from "@/lib/image";
import { useToastStore } from "@/lib/toast";

export function AvatarUpload({
  name,
  src,
  onChange,
}: {
  name: string;
  src: string | null;
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
      const dataUrl = await fileToSquareDataUrl(file);
      onChange(dataUrl);
      showToast("Profile photo updated");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't process that image", "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <Avatar name={name} src={src} className="size-16 text-lg" />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full border-2 border-paper bg-primary text-white shadow-sm disabled:opacity-60"
          aria-label="Change photo"
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
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-left text-sm font-medium text-primary"
          disabled={busy}
        >
          {src ? "Change photo" : "Upload photo"}
        </button>
        {src ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="flex items-center gap-1 text-left text-xs text-ink-muted hover:text-danger"
          >
            <X className="size-3" /> Remove
          </button>
        ) : (
          <span className="text-xs text-ink-muted">JPG or PNG, up to 8MB</span>
        )}
      </div>
    </div>
  );
}
