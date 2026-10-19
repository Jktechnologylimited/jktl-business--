"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Send, Stethoscope } from "lucide-react";
import { formatKobo } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * The patient-facing chat. Deliberately not a messaging app: two ways to
 * respond (free text, or a quick reply), one confirmation state, and an
 * unmissable escalation banner. Everything a patient could do here is either
 * a message or a booking, and the booking path is a real form so the
 * deterministic server-side booking route is used rather than a model's
 * interpretation of "tuesday-ish".
 */

/** Lagos is UTC+1 all year (no DST), so a `datetime-local` value can be
 * pinned to the clinic's timezone exactly rather than being reinterpreted in
 * whatever timezone the patient's phone happens to be set to — which is how a
 * 10:00 appointment becomes 09:00 in the clinic's diary. */
function lagosIso(localValue: string): string {
  return `${localValue}:00+01:00`;
}

/** Tomorrow at 10:00, as a `datetime-local` value. Module scope on purpose:
 * it reads the clock, so it must not live in the component body. */
function defaultTimeSlot(): string {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const date = tomorrow.toISOString().slice(0, 10);
  return `${date}T10:00`;
}

interface Message {
  id: string;
  from: "bot" | "user";
  text: string;
}

export interface ChatServiceOption {
  id: string;
  name: string;
  priceKobo: number;
}

export function AiChat({
  sessionId,
  businessName,
  greeting,
  initialMessages,
  services,
  themeColor,
  clinicPhone,
  alreadyEscalated,
  packLabel,
}: {
  sessionId: string;
  businessName: string;
  greeting: string;
  initialMessages: Message[];
  services: ChatServiceOption[];
  themeColor: string;
  clinicPhone: string;
  alreadyEscalated: boolean;
  packLabel: string;
}) {
  const [messages, setMessages] = useState<Message[]>(
    initialMessages.length ? initialMessages : [{ id: "greeting", from: "bot", text: greeting }],
  );
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [escalated, setEscalated] = useState(alreadyEscalated);
  const [emergency, setEmergency] = useState(false);
  const [confirmed, setConfirmed] = useState<{ service: string; startsAt: string } | null>(null);
  const [bookingService, setBookingService] = useState<ChatServiceOption | null>(null);
  const [bookingTime, setBookingTime] = useState("");
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending, bookingService, confirmed]);

  function append(message: Message) {
    setMessages((prev) => [...prev, message]);
  }

  async function send(text: string, quickReply?: { kind: "book"; serviceId: string; startsAt: string }) {
    const trimmed = text.trim();
    if (!trimmed && !quickReply) return;
    if (sending) return;

    setError("");
    setQuickReplies([]);
    if (trimmed) append({ id: crypto.randomUUID(), from: "user", text: trimmed });
    else if (quickReply) {
      const service = services.find((s) => s.id === quickReply.serviceId);
      append({ id: crypto.randomUUID(), from: "user", text: `Book ${service?.name ?? "appointment"}` });
    }
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, text: trimmed, quickReply }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        reply?: string;
        escalated?: boolean;
        severity?: string | null;
        booking?: { id: string; serviceName: string; startsAt: string } | null;
        quickReplies?: string[];
        error?: string | null;
      };

      if (!data.ok) {
        setError(data.error || "Something went wrong. Please try again, or call the clinic.");
        setSending(false);
        return;
      }

      if (data.reply) append({ id: crypto.randomUUID(), from: "bot", text: data.reply });
      if (data.escalated) setEscalated(true);
      if (data.severity === "emergency") setEmergency(true);
      setQuickReplies(data.quickReplies ?? []);
      if (data.booking?.id) {
        const service = services.find((s) => s.id === bookingService?.id);
        setConfirmed({
          service: data.booking.serviceName || service?.name || "your appointment",
          startsAt: data.booking.startsAt,
        });
        setBookingService(null);
        setQuickReplies([]);
      }
    } catch {
      setError("We couldn't reach the clinic's assistant. Please try again in a moment.");
    } finally {
      setSending(false);
    }
  }

  /** A "Book <service>" quick reply opens the time picker rather than
   * guessing a slot — the one place the patient's own choice is required. */
  function handleQuickReply(label: string) {
    const match = services.find((s) => label.toLowerCase() === `book ${s.name}`.toLowerCase());
    if (match) {
      setBookingService(match);
      setBookingTime(defaultTimeSlot());
      return;
    }
    void send(label);
  }

  return (
    <div className="flex h-[80vh] max-h-[720px] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-paper shadow-lg">
      <header style={{ backgroundColor: themeColor }} className="flex items-center gap-2 px-4 py-3 text-white">
        <span className="flex size-8 items-center justify-center rounded-full bg-white/20">
          <Stethoscope className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{businessName}</div>
          <div className="text-[11px] opacity-90">{packLabel} booking assistant</div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4">
        <div className="flex flex-col gap-2">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[13px] leading-snug ${
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

          {confirmed ? (
            <div className="self-start rounded-2xl border border-primary/30 bg-primary-soft px-3.5 py-3 text-[13px] text-ink">
              <div className="flex items-center gap-1.5 font-semibold text-primary-strong">
                <CheckCircle2 className="size-4" /> Appointment requested
              </div>
              <div className="mt-1">
                {confirmed.service}
                {confirmed.startsAt ? ` — ${new Date(confirmed.startsAt).toLocaleString("en-NG", { dateStyle: "full", timeStyle: "short" })}` : ""}
              </div>
              <div className="mt-1 text-xs text-ink-muted">The clinic will confirm. Keep this chat link to check back.</div>
            </div>
          ) : null}

          {emergency ? (
            <div className="self-start rounded-2xl border border-danger/40 bg-danger-soft px-3.5 py-3 text-[13px] text-danger">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="size-4" /> Please seek emergency care now
              </div>
              <div className="mt-1 text-ink">
                Call 112 or go to the nearest emergency department. The clinic has been alerted and will call you
                {clinicPhone ? ` on ${clinicPhone}` : ""}.
              </div>
            </div>
          ) : escalated && !emergency ? (
            <div className="self-start rounded-2xl border border-accent/40 bg-accent-soft px-3.5 py-3 text-[13px] text-ink">
              A member of the clinic team is taking over this conversation.
            </div>
          ) : null}
        </div>
      </div>

      {bookingService ? (
        <div className="border-t border-border bg-surface px-3 py-3">
          <div className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-ink">
            <CalendarClock className="size-4 text-primary" /> {bookingService.name} · {formatKobo(bookingService.priceKobo)}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="datetime-local"
              value={bookingTime}
              onChange={(e) => setBookingTime(e.target.value)}
              className="h-10"
              aria-label="Preferred date and time"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-10"
                disabled={!bookingTime || sending}
                onClick={() =>
                  void send(`Book ${bookingService.name}`, {
                    kind: "book",
                    serviceId: bookingService.id,
                    startsAt: lagosIso(bookingTime),
                  })
                }
              >
                Confirm
              </Button>
              <Button size="sm" variant="ghost" className="h-10" onClick={() => setBookingService(null)}>
                Cancel
              </Button>
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-ink-muted">Times are in West Africa Time (Lagos).</p>
        </div>
      ) : null}

      {!bookingService && quickReplies.length > 0 ? (
        <div className="flex flex-wrap gap-2 border-t border-border px-3 py-2.5">
          {quickReplies.map((label) => (
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

      {error ? <div className="border-t border-border px-4 py-2 text-xs text-danger">{error}</div> : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="flex items-center gap-2 border-t border-border px-3 py-3"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message…"
          aria-label="Your message"
          maxLength={1500}
          disabled={sending}
        />
        <Button type="submit" size="icon" disabled={sending || !input.trim()} aria-label="Send message">
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
