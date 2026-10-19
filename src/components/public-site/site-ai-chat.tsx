"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { formatKobo } from "@/lib/format";

/**
 * The AI chatbot that ships with every published site.
 *
 * Not the scripted decision tree it replaces: this talks to the same engine
 * the SMS link does (`/api/ai/chat`), so a visitor on the website gets the
 * same clinical pack, the same deterministic emergency screening, and the same
 * escalation to a human as someone whose call was missed. The only difference
 * is the entry point — the visitor's first message opens the conversation
 * server-side, keyed on a token their own browser holds, so a reload continues
 * the thread instead of starting over.
 *
 * One deliberate split from the /chat page: a booking made *here* hands off to
 * the site's own booking form rather than writing the appointment from the
 * chat. A website visitor hasn't given us a phone number yet, and an
 * appointment nobody can confirm is worse than one extra tap.
 */

interface Message {
  id: string;
  from: "bot" | "user";
  text: string;
}

export interface SiteAiChatService {
  id: string;
  name: string;
  priceKobo: number;
}

export function SiteAiChat({
  subdomain,
  businessName,
  packLabel,
  greeting,
  themeColor,
  textColor,
  services,
  clinicPhone,
  open,
  onOpenChange,
  onSelectService,
}: {
  subdomain: string;
  businessName: string;
  packLabel: string;
  greeting: string;
  themeColor: string;
  textColor: string;
  services: SiteAiChatService[];
  clinicPhone: string;
  /** Controlled by the page so the hero's "Ask our assistant" button and the
   * floating bubble open the same panel. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectService: (serviceId: string) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [escalated, setEscalated] = useState(false);
  const [emergency, setEmergency] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // A token this browser keeps, so a reload or a return visit continues the
  // same conversation. It grants nothing — the server still derives the
  // business and the session from its own records.
  const storageKey = `jktl.ai-visitor.${subdomain}`;
  const [visitorKey] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      const existing = window.localStorage.getItem(storageKey);
      if (existing) return existing;
      const created = crypto.randomUUID();
      window.localStorage.setItem(storageKey, created);
      return created;
    } catch {
      // Private mode / quota: the chat still works, it just won't resume
      // across a reload.
      return crypto.randomUUID();
    }
  });

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [open, messages, sending]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setError("");
    setQuickReplies([]);
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), from: "user", text: trimmed }]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // First turn opens the conversation server-side; after that we hold its
        // id and just send messages.
        body: JSON.stringify(sessionId ? { sessionId, text: trimmed } : { subdomain, visitorKey, text: trimmed }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        sessionId?: string;
        reply?: string;
        escalated?: boolean;
        severity?: string | null;
        quickReplies?: string[];
        error?: string | null;
      };

      if (data.sessionId) setSessionId(data.sessionId);

      if (!data.ok) {
        setError(data.error || "Something went wrong. Please try again, or call the clinic.");
        setSending(false);
        return;
      }

      if (data.reply) setMessages((prev) => [...prev, { id: crypto.randomUUID(), from: "bot", text: data.reply as string }]);
      if (data.escalated) setEscalated(true);
      if (data.severity === "emergency") setEmergency(true);
      setQuickReplies(data.quickReplies ?? []);
    } catch {
      setError("We couldn't reach the assistant. Please try again in a moment.");
    } finally {
      setSending(false);
    }
  }

  /** "Book <service>" hands off to the site's booking form with that service
   * chosen — the form is where a name and number get captured. */
  function handleQuickReply(label: string) {
    const match = services.find((s) => label.toLowerCase() === `book ${s.name}`.toLowerCase());
    if (match) {
      onSelectService(match.id);
      onOpenChange(false);
      return;
    }
    void send(label);
  }

  // What the visitor sees: the pack's greeting is always the first bubble, and
  // the service quick replies stay available until they start typing. Derived
  // rather than seeded into state, so opening the panel can't trigger a render
  // cascade.
  const visible: Message[] = messages.length
    ? messages
    : [
        { id: "greeting", from: "bot", text: greeting },
        ...(services.length
          ? [{ id: "replies", from: "bot" as const, text: "You can ask me anything, or pick a service below to book it." }]
          : []),
      ];
  const shownReplies = messages.length === 0 ? services.slice(0, 3).map((s) => `Book ${s.name}`) : quickReplies;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        aria-label={`Chat with the ${businessName} assistant`}
        style={{ backgroundColor: themeColor, color: textColor }}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full py-3.5 pl-4 pr-5 shadow-xl transition-transform hover:scale-105"
      >
        <Sparkles className="size-5" />
        <span className="text-sm font-semibold">Ask our assistant</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 flex max-h-[82vh] flex-col overflow-hidden rounded-2xl border border-border bg-paper shadow-2xl sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[400px]">
      <header style={{ backgroundColor: themeColor, color: textColor }} className="flex items-start gap-2.5 px-4 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/20">
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{businessName}</div>
          <div className="text-[11px] opacity-90">{packLabel} assistant · answers instantly, day or night</div>
        </div>
        <button type="button" onClick={() => onOpenChange(false)} aria-label="Close chat" className="opacity-90 hover:opacity-100">
          <X className="size-4" />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3.5 py-4">
        <div className="flex flex-col gap-2">
          {visible.map((m) => (
            <div
              key={m.id}
              className={`max-w-[86%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[13px] leading-snug ${
                m.from === "bot" ? "self-start bg-surface text-ink" : "self-end text-white"
              }`}
              style={m.from === "user" ? { backgroundColor: themeColor } : undefined}
            >
              {m.text}
            </div>
          ))}

          {sending ? (
            <div className="flex items-center gap-1 self-start rounded-2xl bg-surface px-3 py-3">
              <span className="size-1.5 animate-bounce rounded-full bg-ink-faint [animation-delay:-0.2s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-ink-faint [animation-delay:-0.1s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-ink-faint" />
            </div>
          ) : null}

          {emergency ? (
            <div className="self-start rounded-2xl border border-danger/40 bg-danger-soft px-3.5 py-3 text-[13px] text-danger">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="size-4" /> Please seek emergency care now
              </div>
              <div className="mt-1 text-ink">
                Call 112 or go to the nearest emergency department. The clinic has been alerted
                {clinicPhone ? ` and will call you on ${clinicPhone}` : ""}.
              </div>
            </div>
          ) : escalated ? (
            <div className="self-start rounded-2xl border border-accent/40 bg-accent-soft px-3.5 py-3 text-[13px] text-ink">
              A member of the team is taking over this conversation.
            </div>
          ) : null}
        </div>
      </div>

      {shownReplies.length > 0 && !sending ? (
        <div className="flex flex-wrap gap-2 border-t border-border px-3 py-2.5">
          {shownReplies.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => handleQuickReply(label)}
              className="rounded-full border border-border-strong px-3 py-1.5 text-xs font-medium text-ink hover:border-primary hover:text-primary"
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {services.length > 0 ? (
        <div className="border-t border-border px-3.5 py-2.5">
          <div className="mb-1.5 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
            <CheckCircle2 className="size-3" /> Popular here
          </div>
          <div className="flex flex-wrap gap-1.5">
            {services.slice(0, 3).map((service) => (
              <button
                key={service.id}
                type="button"
                onClick={() => {
                  onSelectService(service.id);
                  onOpenChange(false);
                }}
                className="rounded-lg border border-border px-2.5 py-1.5 text-left text-[11px] text-ink hover:border-primary"
              >
                <span className="block font-medium">{service.name}</span>
                <span className="text-ink-faint">{formatKobo(service.priceKobo)}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <div className="border-t border-border px-4 py-2 text-xs text-danger">{error}</div> : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="flex items-center gap-2 border-t border-border px-3 py-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question, or say what you need…"
          aria-label="Your message"
          maxLength={1500}
          disabled={sending}
          className="h-11 w-full rounded-xl border border-border-strong bg-paper px-3.5 text-sm text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          aria-label="Send message"
          style={{ backgroundColor: themeColor, color: textColor }}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl disabled:opacity-50"
        >
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}

/** The chat panel's own open state lives with the page, so the hero and the
 * floating bubble can both drive it. This small hook keeps that wiring in one
 * place. */
export function useSiteChat() {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}

/** Icon re-exported so the hero CTA and the bubble stay visually consistent. */
export { MessageCircle };
