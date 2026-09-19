"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, MessageCircle, X } from "lucide-react";
import { formatKobo } from "@/lib/format";
import { waLink, telLink, mailLink } from "@/lib/contact";
import type { Product, Service } from "@/lib/types";

/**
 * A scripted (not AI-generated) chat widget — a small decision tree over the
 * business's real data, with a brief typing pause before each reply so it
 * still *feels* conversational. Every line it says is computed live from
 * `services`, `products` and the profile fields passed in; nothing is
 * invented and nothing calls out to a language model. Replies are
 * quick-reply buttons only (no free-text input) — that's what keeps this
 * honestly "scripted" rather than something that looks like more than it is.
 */

interface ChatMessage {
  id: string;
  from: "bot" | "user";
  text: string;
}

interface ChatOption {
  label: string;
  next?: string;
  action?: "whatsapp" | "scroll-book";
  serviceId?: string;
}

interface ChatNode {
  lines: string[];
  options: ChatOption[];
}

export function ChatWidget({
  businessName,
  services,
  products,
  phone,
  email,
  address,
  city,
  state,
  themeColor,
  textColor,
  onSelectService,
}: {
  businessName: string;
  services: Service[];
  products: Product[];
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  themeColor: string;
  textColor: string;
  onSelectService: (serviceId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [options, setOptions] = useState<ChatOption[]>([]);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const locationLine = [address, city, state].filter(Boolean).join(", ");
  const wa = waLink(phone);
  const name = businessName || "us";

  function buildNode(id: string): ChatNode {
    if (id === "services") {
      if (services.length === 0) {
        return {
          lines: ["We haven't listed services here yet — message us directly and we'll help."],
          options: [{ label: "Chat with a person", action: "whatsapp" }, { label: "⬅ Back", next: "root" }],
        };
      }
      const lines = [
        "Here's what we offer:",
        ...services.slice(0, 8).map((s) => `• ${s.name} — ${formatKobo(s.priceKobo)}${s.durationMin ? ` (${s.durationMin} min)` : ""}`),
      ];
      const svcOptions: ChatOption[] = services
        .slice(0, 4)
        .map((s) => ({ label: `Book ${s.name}`, action: "scroll-book", serviceId: s.id }));
      svcOptions.push({ label: "⬅ Back", next: "root" });
      return { lines, options: svcOptions };
    }

    if (id === "products") {
      if (products.length === 0) {
        return {
          lines: ["We don't have products listed here yet — ask us directly!"],
          options: [{ label: "Chat with a person", action: "whatsapp" }, { label: "⬅ Back", next: "root" }],
        };
      }
      const lines = [
        "Here's what's in stock:",
        ...products.slice(0, 8).map((p) => `• ${p.name} — ${formatKobo(p.priceKobo)}${p.stockQty <= 0 ? " (sold out)" : ""}`),
      ];
      return { lines, options: [{ label: "⬅ Back", next: "root" }] };
    }

    if (id === "location") {
      const lines = locationLine
        ? [`We're at ${locationLine}.`]
        : ["We haven't added an address here yet — message us and we'll send directions."];
      const locOptions: ChatOption[] = [];
      if (locationLine && wa) locOptions.push({ label: "Chat with a person", action: "whatsapp" });
      locOptions.push({ label: "⬅ Back", next: "root" });
      return { lines, options: locOptions };
    }

    if (id === "contact") {
      const tel = telLink(phone);
      const mail = mailLink(email);
      const lines: string[] = [];
      if (tel) lines.push(`Call us: ${phone}`);
      if (mail) lines.push(`Email us: ${email}`);
      if (lines.length === 0) lines.push("We haven't added contact details here yet.");
      return { lines, options: [{ label: "⬅ Back", next: "root" }] };
    }

    // root
    const rootOptions: ChatOption[] = [];
    if (services.length > 0) rootOptions.push({ label: "Services & prices", next: "services" });
    if (products.length > 0) rootOptions.push({ label: "Products", next: "products" });
    rootOptions.push({ label: "Book an appointment", action: "scroll-book" });
    rootOptions.push({ label: "Where are you located?", next: "location" });
    rootOptions.push(wa ? { label: "Chat with a person", action: "whatsapp" } : { label: "Contact us", next: "contact" });
    return { lines: [`Hi! I'm the assistant for ${name}. What would you like to know?`], options: rootOptions };
  }

  function say(nodeId: string) {
    const node = buildNode(nodeId);
    setTyping(true);
    setOptions([]);
    window.setTimeout(() => {
      setMessages((prev) => [...prev, ...node.lines.map((text) => ({ id: crypto.randomUUID(), from: "bot" as const, text }))]);
      setOptions(node.options);
      setTyping(false);
    }, 450);
  }

  /** Opens the widget and, the very first time, kicks off the greeting.
   * This lives in the click handler rather than an effect reacting to
   * `open` — it's a direct response to the click, not a sync with an
   * external system, so there's no reason to route it through an effect. */
  function openChat() {
    setOpen(true);
    if (messages.length === 0) say("root");
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  function choose(option: ChatOption) {
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), from: "user", text: option.label }]);
    setOptions([]);

    if (option.action === "whatsapp") {
      if (wa) {
        window.open(wa, "_blank", "noopener,noreferrer");
        return;
      }
      say("contact");
      return;
    }

    if (option.action === "scroll-book") {
      if (option.serviceId) onSelectService(option.serviceId);
      document.getElementById("book")?.scrollIntoView({ behavior: "smooth", block: "start" });
      setOpen(false);
      return;
    }

    if (option.next) say(option.next);
  }

  return (
    <>
      {open ? (
        <div className="fixed inset-x-4 bottom-4 z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-border-strong bg-paper shadow-xl sm:inset-x-auto sm:right-5 sm:w-80">
          <div style={{ backgroundColor: themeColor, color: textColor }} className="flex items-center justify-between gap-2 px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Bot className="size-4" /> {name} assistant
            </span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="opacity-80 hover:opacity-100">
              <X className="size-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
            <div className="flex flex-col gap-2">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-[13px] leading-snug ${
                    m.from === "bot" ? "self-start bg-surface text-ink" : "self-end text-white"
                  }`}
                  style={m.from === "user" ? { backgroundColor: themeColor } : undefined}
                >
                  {m.text}
                </div>
              ))}
              {typing ? (
                <div className="flex items-center gap-1 self-start rounded-2xl bg-surface px-3 py-2.5">
                  <span className="size-1.5 animate-bounce rounded-full bg-ink-faint [animation-delay:-0.2s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-ink-faint [animation-delay:-0.1s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-ink-faint" />
                </div>
              ) : null}
            </div>
          </div>

          {!typing && options.length > 0 ? (
            <div className="flex flex-wrap gap-2 border-t border-border px-3 py-3">
              {options.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => choose(opt)}
                  className="rounded-full border border-border-strong px-3 py-1.5 text-xs font-medium text-ink hover:border-primary hover:text-primary"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={openChat}
          aria-label="Open chat"
          style={{ backgroundColor: themeColor, color: textColor }}
          className="fixed bottom-5 right-5 z-50 flex size-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105"
        >
          <MessageCircle className="size-6" />
        </button>
      )}
    </>
  );
}
