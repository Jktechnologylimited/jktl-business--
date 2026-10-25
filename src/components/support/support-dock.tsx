"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useBusinessStore } from "@/lib/store";
import {
  reviewHomeAction,
  reviewPromptAction,
} from "@/lib/actions/review-actions";
export function SupportDock() {
  const mode = useBusinessStore((s) => s.mode);
  const [invite, setInvite] = useState(false);
  useEffect(() => {
    if (mode !== "live") return;
    let active = true;
    void reviewHomeAction()
      .then((r) => {
        if (active && r.eligible) {
          setInvite(true);
          void reviewPromptAction().catch(() => {});
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [mode]);
  return (
    <aside className="fixed bottom-20 right-4 z-30 flex max-w-[calc(100vw-32px)] flex-col items-end gap-3 print:hidden">
      {invite && (
        <div className="w-72 max-w-full rounded-2xl border border-border-strong bg-paper p-4 shadow-lg">
          <h2 className="text-sm font-semibold">
            How is JKTL working for you?
          </h2>
          <p className="my-2 text-xs leading-6 text-ink-muted">
            Your website or domain journey can help us improve. Honest feedback
            is welcome.
          </p>
          <div className="flex gap-4 text-xs">
            <Link
              onClick={() => setInvite(false)}
              className="text-primary underline"
              href="/business/help#feedback"
            >
              Share feedback
            </Link>
            <button
              onClick={() => {
                setInvite(false);
                void reviewPromptAction(true).catch(() => {});
              }}
            >
              Later
            </button>
          </div>
        </div>
      )}
      <Link
        className="rounded-full border border-border-strong bg-paper px-4 py-3 text-sm font-semibold text-ink shadow-lg"
        href="/business/help"
      >
        Help & support
      </Link>
    </aside>
  );
}
