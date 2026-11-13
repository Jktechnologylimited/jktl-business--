
/* eslint-disable @next/next/no-img-element -- Owner-approved HTTPS avatars are fetched by the browser, avoiding an arbitrary image proxy. */
"use client";
import { ArrowUpRight } from "lucide-react";
import { startVisiblePolling } from "@/lib/browser/visible-polling";
import { useEffect, useRef, useState } from "react";
import type { publicConfig } from "@/lib/chatbot/public";
import styles from "./PublicChat.module.css";
type Config = Awaited<ReturnType<typeof publicConfig>>;
type Message = { role: string; content: string; created_at: string };
export function PublicChat({
  config,
  ticket: initialTicket = "",
  embedded = false,
}: {
  config: Config;
  ticket?: string;
  embedded?: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]),
    [token, setToken] = useState(""),
    [ticket] = useState(initialTicket),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [leadKind, setLeadKind] = useState(""),
    [human, setHuman] = useState(false),
    [notice, setNotice] = useState("");
  const restoring = useRef(false),
    busyRef = useRef(false);
  const end = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null),
    controller = useRef<AbortController | null>(null),
    storeKey = "jktl.chatbot." + (embedded ? "embed." : "public.") + config.id;
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const existing = sessionStorage.getItem(storeKey);
        if (existing && !embedded) {
          restoring.current = true;
          setToken(existing);
        }
      } catch {}
    });
    const listener = async (event: MessageEvent) => {
      if (
        !embedded ||
        event.source !== window.parent ||
        event.data?.type !== "jktl-chat-init" ||
        typeof event.data.ticket !== "string"
      )
        return;
      // Restoring iframe history requires a fresh domain-authorized proof and exact origin match.
      try {
        let resumeToken = "";
        try {
          resumeToken = sessionStorage.getItem(storeKey) || "";
        } catch {}
        const response = await fetch("/api/chatbots/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            botId: config.id,
            ticket: event.data.ticket,
            resumeToken,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw Error();
        setToken(data.token);
        setMessages(data.messages);
        setHuman(data.status === "human");
        try {
          sessionStorage.setItem(storeKey, data.token);
        } catch {}
      } catch {
        setError(
          "The website connection expired. Reload this page to reconnect.",
        );
      }
    };
    window.addEventListener("message", listener);
    if (embedded) window.parent.postMessage({ type: "jktl-chat-ready" }, "*");
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("message", listener);
      controller.current?.abort();
    };
  }, [embedded, storeKey, config.id]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "auto" });
  }, [messages, busy]);
  useEffect(() => {
    if (!token || (!restoring.current && !human)) return;
    let active = true;
    async function load() {
      if (busyRef.current) return;
      try {
        const response = await fetch("/api/chatbots/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
          cache: "no-store",
        });
        const data = await response.json();
        if (!active) return;
        if (response.ok) {
          restoring.current = false;
          setMessages(data.messages);
          setHuman(data.status === "human");
        } else {
          setToken("");
          try {
            sessionStorage.removeItem(storeKey);
          } catch {}
          setError(
            "Your session expired. Start a new chat; reload this page if needed.",
          );
        }
      } catch {}
    }
    // Only an active human handoff needs recurring reads.
    const stop = human ? startVisiblePolling(load, 15000) : null;
    if (!human) void load();
    return () => {
      active = false;
      stop?.();
    };
  }, [token, human, storeKey]);
  async function ensureSession() {
    if (token) return token;
    if (!ticket)
      throw Error(
        "This website has not established an authorized chatbot connection.",
      );
    const response = await fetch("/api/chatbots/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ botId: config.id, ticket }),
    });
    const data = await response.json();
    if (!response.ok)
      throw Error(
        "The chat connection expired. Reload this page and try again.",
      );
    setToken(data.token);
    try {
      sessionStorage.setItem(storeKey, data.token);
    } catch {}
    return data.token as string;
  }
  async function send(event: React.FormEvent) {
    event.preventDefault();
    const question = text.trim();
    if (!question || busy) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setText("");
    controller.current = new AbortController();
    try {
      const session = await ensureSession();
      setMessages((current) => [
        ...current,
        {
          role: "user",
          content: question,
          created_at: new Date().toISOString(),
        },
        {
          role: "assistant",
          content: "",
          created_at: new Date().toISOString(),
        },
      ]);
      const response = await fetch("/api/chatbots/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: session,
          text: question,
          requestId: crypto.randomUUID(),
        }),
        signal: controller.current.signal,
      });
      if (!response.ok || !response.body)
        throw Error(
          response.status === 429
            ? "Please wait before sending another message."
            : "The message could not be sent.",
        );
      const reader = response.body.getReader(),
        decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        buffer += decoder.decode(part.value, { stream: true });
        let boundary: number;
        while ((boundary = buffer.indexOf("\n\n")) >= 0) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const type = block.match(/^event: (.*)$/m)?.[1],
            raw = block.match(/^data: (.*)$/m)?.[1];
          if (!raw) continue;
          const value = JSON.parse(raw);
          if (type === "delta" && typeof value.text === "string")
            setMessages((current) =>
              current.map((message, index) =>
                index === current.length - 1
                  ? { ...message, content: message.content + value.text }
                  : message,
              ),
            );
          if (type === "error")
            setError(String(value.message || "The AI reply was interrupted."));
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to connect.");
    } finally {
      busyRef.current = false;
      setBusy(false);
      input.current?.focus();
    }
  }
  async function submitLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const session = await ensureSession();
      const response = await fetch("/api/chatbots/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...Object.fromEntries(f),
          token: session,
          kind: leadKind,
          consent: f.has("consent"),
          marketingConsent: f.has("marketingConsent"),
          requestId: crypto.randomUUID(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw Error("Please check your request and try again.");
      setNotice(data.message);
      if (leadKind === "handoff") setHuman(true);
      setLeadKind("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to submit.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  const close = () => {
    if (embedded) window.parent.postMessage({ type: "jktl-chat-close" }, "*");
  };
  return (
    <main
      className={styles.chat}
      style={{ "--chat-accent": config.settings.color } as React.CSSProperties}
    >
      <header className={styles.header}>
        {config.settings.avatar && (
          <img width={40} height={40} src={config.settings.avatar} alt="" />
        )}
        <div>
          <h1>{String(config.name)}</h1>
          <p>
            AI assistant ·{" "}
            {config.aiAvailable
              ? "Approved business knowledge"
              : "Knowledge mode · live AI unavailable"}
          </p>
        </div>
        {embedded && (
          <button type="button" aria-label="Minimize chat" onClick={close}>
            ×
          </button>
        )}
      </header>
      <p className={styles.privacy}>
        Messages are retained for {String(config.retentionDays)} days. Don’t
        share passwords, payment details or sensitive documents.
      </p>
      <section
        className={styles.messages}
        aria-label="Conversation"
        aria-live="polite"
      >
        <article className={styles.bot}>
          <b>AI assistant</b>
          <p>{config.settings.welcome}</p>
        </article>
        {messages.map((message, index) => (
          <article
            key={index}
            className={message.role === "user" ? styles.user : styles.bot}
          >
            <b>
              {message.role === "human"
                ? "Business follow-up"
                : message.role === "user"
                  ? "You"
                  : "AI assistant"}
            </b>
            <p>{message.content || (busy ? "Thinking…" : "")}</p>
            <time dateTime={message.created_at}>
              {new Date(message.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </article>
        ))}
        <div ref={end} />
      </section>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      <nav className={styles.actions} aria-label="Contact the business">
        {config.settings.whatsapp && (
          <a
            href={
              "https://wa.me/" + config.settings.whatsapp.replace(/\D/g, "")
            }
            target="_blank"
            rel="noopener noreferrer"
          >
            Talk to a Human on WhatsApp <ArrowUpRight size={16} className="inline-block align-middle" aria-hidden="true" />
          </a>
        )}
        {config.settings.leadCapture && (
          <button
            type="button"
            onClick={() => setLeadKind(leadKind ? "" : "handoff")}
          >
            Request human follow-up
          </button>
        )}
        {config.appointments &&
          config.settings.leadCapture &&
          config.services.length > 0 && (
            <button type="button" onClick={() => setLeadKind("appointment")}>
              Request appointment
            </button>
          )}
        {config.settings.phone && (
          <a href={"tel:" + config.settings.phone.replace(/[^\d+]/g, "")}>
            Call business
          </a>
        )}
        {config.settings.email && (
          <a href={"mailto:" + config.settings.email}>Email business</a>
        )}
      </nav>
      {leadKind && (
        <form className={styles.lead} onSubmit={submitLead}>
          <h2>
            {leadKind === "appointment"
              ? "Appointment request (not confirmed)"
              : "Request business follow-up"}
          </h2>
          <label>
            Your name
            <input name="name" required maxLength={120} />
          </label>
          <label>
            Email{leadKind !== "appointment" ? " (optional)" : ""}
            <input
              type="email"
              name="email"
              maxLength={254}
              required={leadKind === "appointment"}
            />
          </label>
          <label>
            Phone{leadKind !== "appointment" ? " (optional)" : ""}
            <input
              type="tel"
              name="phone"
              maxLength={40}
              required={leadKind === "appointment"}
            />
          </label>
          {leadKind === "appointment" && (
            <>
              <label>
                Service
                <select name="serviceId" required>
                  {config.services.map((service) => (
                    <option key={String(service.id)} value={String(service.id)}>
                      {String(service.name)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Preferred date (WAT)
                <input name="date" type="date" required />
              </label>
              <label>
                Preferred time (WAT)
                <input name="time" type="time" required />
              </label>
            </>
          )}
          <label>
            How can the business help?
            <textarea name="enquiry" required maxLength={2000} />
          </label>
          <label className={styles.check}>
            <input name="consent" type="checkbox" required /> I agree to send
            these details to this business for follow-up.
          </label>
          {config.advancedLeads && (
            <label className={styles.check}>
              <input name="marketingConsent" type="checkbox" /> I also agree to
              receive marketing from this business (optional).
            </label>
          )}
          <button disabled={busy}>Send request</button>
          <button type="button" onClick={() => setLeadKind("")}>
            Cancel
          </button>
        </form>
      )}
      <form className={styles.compose} onSubmit={send}>
        <label className={styles.srOnly} htmlFor="chat-question">
          Your question
        </label>
        <input
          id="chat-question"
          ref={input}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Ask about this business…"
          maxLength={1500}
          required
          disabled={busy || (embedded && !token)}
        />
        <button disabled={busy || !text.trim() || (embedded && !token)}>
          {busy ? "Sending…" : "Send"}
        </button>
      </form>
      {!config.settings.hideBranding && (
        <footer className={styles.brand}>
          <a
            href="https://jktl.com.ng"
            target="_blank"
            rel="noopener noreferrer"
          >
            Powered by JKTL AI Chatbot
          </a>
        </footer>
      )}
    </main>
  );
}
