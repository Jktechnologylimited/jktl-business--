"use client";

import { Copy } from "lucide-react";
import { useToastStore } from "@/lib/toast";

export function CopyReferralLink({ link }: { link: string }) {
  const showToast = useToastStore((s) => s.show);

  function copy() {
    navigator.clipboard?.writeText(link).then(
      () => showToast("Referral link copied"),
      () => showToast("Couldn't copy — copy it manually", "danger"),
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border-strong bg-surface p-4">
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-ink-muted">Your referral link</div>
        <div className="truncate font-mono text-sm text-ink">{link}</div>
      </div>
      <button
        type="button"
        onClick={copy}
        className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-white hover:bg-primary-strong"
      >
        <Copy className="size-4" /> Copy
      </button>
    </div>
  );
}
