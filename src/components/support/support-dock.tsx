"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useBusinessStore } from "@/lib/store";
import {
  reviewHomeAction,
  reviewPromptAction,
} from "@/lib/actions/review-actions";
type Assistant = typeof import("./ask-ai-chat").default;
export function SupportDock() {
  const mode = useBusinessStore((s) => s.mode);
  const [invite, setInvite] = useState(false);
  const [open, setOpen] = useState(false);
  const [Chat, setChat] = useState<Assistant | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const loadingRef = useRef(false);
  const activeRef = useRef(true);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => { setOpen(false); trigger.current?.focus(); }, []);
  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, []);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [open, close]);
  async function loadChat() {
    if (Chat || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true); setLoadError(false);
    try {
      const assistantModule = await import("./ask-ai-chat");
      if (activeRef.current) setChat(() => assistantModule.default);
    } catch {
      if (activeRef.current) setLoadError(true);
    } finally {
      loadingRef.current = false;
      if (activeRef.current) setLoading(false);
    }
  }
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
      {invite && !open && (
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
      {Chat && <Chat open={open} mode={mode} onClose={close} />}
      {open && loading && <p role="status" className="rounded-xl border border-border bg-paper p-4 text-sm">Opening JKTL AI…</p>}
      {open && loadError && <div role="alert" className="w-80 max-w-full rounded-xl border border-border bg-paper p-4 text-sm text-ink"><p>JKTL AI couldn’t load. Check your connection or use the existing help options.</p><div className="mt-3 flex flex-wrap gap-3 text-xs"><button type="button" onClick={()=>void loadChat()} className="text-blue-600 underline">Retry loading chat</button><Link href="/help" className="text-blue-600 underline">Knowledge base</Link><Link href="/business/help" className="text-blue-600 underline">Help &amp; support</Link><a href="https://wa.me/2347036580994" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">WhatsApp</a></div></div>}
      <button ref={trigger} type="button" aria-expanded={open} aria-haspopup="dialog" onClick={() => { if (open) close(); else { setOpen(true); void loadChat(); } }} className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-[#060e2a] px-4 py-3 text-sm font-semibold text-white shadow-lg"><Sparkles size={18} className="text-[#c9a84c]" aria-hidden="true" />Ask AI</button>
    </aside>
  );
}
