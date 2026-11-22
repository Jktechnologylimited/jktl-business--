"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BookOpen, Check, ExternalLink, Headset, Loader2, RefreshCw, Send, Sparkles, X } from "lucide-react";
import * as support from "@/lib/actions/support-actions";
import { guideReply, HELP_GUIDES } from "@/lib/support/knowledge";
import { useReplyDelivery } from "./use-reply-delivery";

type Message = { id: string; sender: string; body: string; guides: string[]; mode?: string };
type Conversation = Awaited<ReturnType<typeof support.supportCaseAction>>;
const humanStates = new Set(["WAITING", "HUMAN", "ESCALATED"]);

export default function AskAiChat({ open, mode, onClose }: {
  open: boolean;
  mode: "live" | "demo";
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [caseId, setCaseId] = useState<string | null>(null);
  const [status, setStatus] = useState("AI");
  const [operation, setOperation] = useState<"thinking" | "sending" | "handoff" | "checking" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const running = useRef(false);
  const currentCase = useRef<string | null>(null);
  const knownReplies = useRef(new Set<string>());
  const followTail = useRef(true);
  const delivery = useReplyDelivery(open);
  const busy = Boolean(operation) || delivery.isTyping;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
  }, [open]);
  useEffect(() => {
    if (open && followTail.current) transcript.current?.scrollTo({ top: transcript.current.scrollHeight, behavior: "auto" });
  }, [messages, open, busy, delivery.reply?.text]);

  function showConversation(data: Conversation, animate = false) {
    if (!mounted.current) return;
    setStatus(String(data.case.status));
    const next = data.messages.map(row => ({
      id: String(row.id), sender: String(row.sender), body: String(row.body),
      guides: Array.isArray(row.guide_ids) ? row.guide_ids.filter((id): id is string => typeof id === "string") : [],
      mode: typeof row.answer_mode === "string" ? row.answer_mode : undefined,
    }));
    const latest = next.filter(message => message.sender === "assistant" && !knownReplies.current.has(message.id)).at(-1);
    knownReplies.current = new Set(next.filter(message => message.sender === "assistant").map(message => message.id));
    setMessages(next);
    if (animate && latest) delivery.deliver(latest);
  }
  function showGuide(text: string) {
    const answer = guideReply(text, undefined, messages.map(message => ({ sender: message.sender, body: message.body, guideIds: message.guides })));
    const message = { id: crypto.randomUUID(), sender: "assistant", body: answer.reply, guides: answer.guides.map(g => g.id), mode: "guide" };
    setMessages(previous => [...previous, message].slice(-120));
    delivery.deliver(message);
  }
  async function send(value = question) {
    const text = value.trim();
    if (!text || text.length > 2000 || running.current || delivery.isTyping || status === "RESOLVED") return;
    running.current = true;
    setOperation(humanStates.has(status) ? "sending" : "thinking"); setError(""); setNotice(""); setQuestion("");
    followTail.current = true;
    setMessages(previous => [...previous, { id: crypto.randomUUID(), sender: "user", body: text, guides: [] }].slice(-120));
    try {
      if (mode !== "live") {
        showGuide(text);
        setNotice("Knowledge-base mode. Sign in to your live account for a saved conversation or personal support.");
        return;
      }
      let id = currentCase.current;
      if (!id) {
        const result = await support.createSupportCaseAction({ subject: "JKTL AI: " + text.slice(0, 140), message: text });
        if (!result.ok) throw Error(result.error);
        id = result.id;
        currentCase.current = id;
        if (!mounted.current) return;
        setCaseId(id);
      } else {
        const result = await support.sendSupportMessageAction(id, text);
        if (!result.ok) throw Error(result.error);
      }
      const data = await support.supportCaseAction(id);
      showConversation(data, true);
    } catch {
      if (!mounted.current) return;
      showGuide(text);
      setError("The live response wasn’t confirmed. The guide answer below still works. Check your saved conversation before sending again; contact the team if the platform is unavailable.");
    } finally {
      running.current = false;
      if (mounted.current) setOperation(null);
    }
  }
  async function requestHuman() {
    if (running.current || delivery.isTyping) return;
    if (mode !== "live") {
      setNotice("Sign in to your live account to send a personal support request, or contact the team on WhatsApp.");
      return;
    }
    running.current = true; setOperation("handoff"); setError("");
    try {
      let id = currentCase.current;
      if (!id) {
        const description = question.trim() || messages.filter(m => m.sender === "user").at(-1)?.body;
        const result = await support.createSupportCaseAction({ subject: "JKTL AI — human support", message: "Please connect me to human support. " + (description || "I need help using JKTL Business.") });
        if (!result.ok) throw Error(result.error);
        id = result.id; currentCase.current = id;
        if (!mounted.current) return;
        setCaseId(id); setQuestion("");
      } else {
        const result = await support.requestHumanAction(id);
        if (!result.ok) throw Error(result.error);
      }
      const data = await support.supportCaseAction(id);
      showConversation(data);
      if (mounted.current) setNotice("Your request is in the support queue. Check here or open the full conversation for replies.");
    } catch {
      if (mounted.current) setError("The support request wasn’t confirmed. Check your conversation or use WhatsApp; no automatic retry has been made.");
    } finally {
      running.current = false;
      if (mounted.current) setOperation(null);
    }
  }
  async function refresh() {
    if (!currentCase.current || running.current || delivery.isTyping) return;
    running.current = true; setOperation("checking"); setError("");
    try { showConversation(await support.supportCaseAction(currentCase.current)); }
    catch { if (mounted.current) setError("Could not check replies. Try again when the connection or service is available."); }
    finally { running.current = false; if (mounted.current) setOperation(null); }
  }
  if (!open) return null;
  const human = humanStates.has(status);
  const progress = operation === "thinking" ? "Thinking…" : operation === "sending" ? "Sending…"
    : operation === "handoff" ? "Requesting support…" : operation === "checking" ? "Checking replies…"
      : delivery.isTyping ? "Typing…" : human ? "With support" : delivery.reply?.complete ? "Done" : "Ready";
  return (
    <section role="dialog" aria-modal="false" aria-labelledby="jktl-ai-title" className="flex max-h-[70dvh] w-96 max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-2xl border border-border-strong bg-paper text-ink shadow-xl">
      <header className="flex items-center justify-between gap-3 bg-[#060e2a] px-4 py-3 text-white">
        <div><h2 id="jktl-ai-title" className="flex items-center gap-2 font-semibold"><Sparkles size={18} aria-hidden="true" />JKTL AI</h2><p className="mt-1 text-xs text-white/75">Let’s work through it, one step at a time.</p></div>
        <button type="button" onClick={() => { delivery.finish(); onClose(); }} aria-label="Close JKTL AI" className="rounded-lg p-2 hover:bg-white/10"><X size={20} aria-hidden="true" /></button>
      </header>
      <div role="status" aria-label="Assistant status" aria-live="polite" className="flex min-h-10 items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-2">
          {busy ? <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : human ? <Headset size={14} aria-hidden="true" /> : delivery.reply?.complete ? <Check size={14} className="text-success" aria-hidden="true" /> : <Sparkles size={14} aria-hidden="true" />}
          {progress}{progress === "Done" && <span className="sr-only"> — reply complete</span>}
        </span>
        {delivery.isTyping && <button type="button" onClick={delivery.finish} className="text-info underline">Show full reply</button>}
      </div>
      <div ref={transcript} onScroll={event => { const el = event.currentTarget; followTail.current = el.scrollHeight - el.scrollTop - el.clientHeight < 64; }} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm" style={{ overflowWrap: "anywhere" }}>
        {!messages.length && <div><p className="leading-6">Hi! What would you like help with today? I can guide you through JKTL Business or help you reach the team.</p><div className="mt-3 flex flex-col items-start gap-2">{["How do I publish my website?", "Where do I check my renewals?", "How do invoices and payments work?"].map(text => <button type="button" key={text} disabled={busy} onClick={() => void send(text)} className="rounded-xl border border-border px-3 py-2 text-left text-info">{text}</button>)}</div></div>}
        <div role="log" aria-live="polite" aria-busy={busy} aria-label="JKTL AI conversation" className="space-y-4">
          {messages.map(message => {
            const typing = delivery.isTyping && delivery.reply?.id === message.id;
            const body = delivery.reply?.id === message.id ? delivery.reply.text : message.body;
            return <article key={message.id} aria-busy={typing} className={message.sender === "user" ? "ml-5 rounded-xl bg-primary/10 p-3" : "mr-3 rounded-xl border border-border bg-surface p-3"}>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted"><p className="font-semibold">{message.sender === "user" ? "You" : message.sender === "support" ? "Support team" : "JKTL AI"}</p>{message.mode === "guide" && <span className="text-[10px]">From JKTL guides</span>}</div>
              <p className="whitespace-pre-wrap leading-6">{body}{typing && <span aria-hidden="true" className="ml-0.5 inline-block h-4 w-0.5 align-middle bg-accent" />}</p>
              {!typing && message.sender !== "user" && message.guides.map(id => HELP_GUIDES.find(g => g.id === id)).filter(g => Boolean(g)).map(guide => guide && <div key={guide.id} className="mt-3 border-t border-border pt-3 text-xs"><p className="font-medium">{guide.title}</p><div className="mt-2 flex flex-wrap gap-4"><Link prefetch={false} className="inline-flex items-center gap-1 text-info underline" href={guide.route}>Open screen<ExternalLink size={12} aria-hidden="true" /></Link><Link prefetch={false} className="inline-flex items-center gap-1 text-info underline" href={"/help/" + guide.id}><BookOpen size={12} aria-hidden="true" />Read full guide</Link></div></div>)}
            </article>;
          })}
          {operation === "thinking" && <div aria-label="JKTL AI is preparing a reply" className="mr-3 flex items-center gap-1 rounded-xl border border-border bg-surface p-4">{[0, 1, 2].map(index => <span key={index} aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-ink-muted motion-reduce:animate-none" style={{ animationDelay: `${index * 150}ms` }} />)}<span className="sr-only">Thinking about your question.</span></div>}
        </div>
        {notice && <p role="status" className="rounded-lg border border-border p-3 text-xs leading-5">{notice}</p>}
        {error && <p role="alert" className="rounded-lg border border-danger/40 p-3 text-xs leading-5">{error}</p>}
        {human && <p className="text-xs leading-5">{status === "ESCALATED" ? "This request needs an authorized team member." : "Your conversation is waiting for, or with, a support agent."} Replies appear when you check for updates; an immediate live response isn’t guaranteed.</p>}
        {status === "RESOLVED" && <p className="text-xs">This conversation is resolved. Open Help & support to start another conversation.</p>}
      </div>
      <div className="space-y-3 border-t border-border p-3">
        <form onSubmit={event => { event.preventDefault(); void send(); }} className="flex items-end gap-2">
          <label className="min-w-0 flex-1"><span className="sr-only">Ask JKTL AI</span><textarea ref={input} aria-label="Ask JKTL AI" value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); }
          }} maxLength={2000} rows={2} required disabled={status === "RESOLVED"} placeholder={human ? "Message the team…" : "Ask a question or tell me where you’re stuck…"} className="block w-full resize-none rounded-xl border border-border-strong bg-paper p-3 text-base text-ink sm:text-sm" /></label>
          <button type="submit" disabled={busy || !question.trim() || status === "RESOLVED"} aria-label="Send question" className="rounded-xl bg-[#c9a84c] p-3 text-[#060e2a] disabled:opacity-50"><Send size={18} aria-hidden="true" /></button>
        </form>
        <p className="text-[10px] text-ink-muted">Enter to send · Shift + Enter for a new line</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          {!human && status !== "RESOLVED" && <button type="button" disabled={busy} onClick={() => void requestHuman()} className="inline-flex items-center gap-1 text-info underline"><Headset size={14} aria-hidden="true" />Talk to a person</button>}
          {caseId && <><button type="button" disabled={busy} onClick={() => void refresh()} className="inline-flex items-center gap-1 text-info underline"><RefreshCw size={14} aria-hidden="true" />Check replies</button><Link prefetch={false} href={"/business/help?case=" + caseId} className="text-info underline">Full conversation</Link></>}
          <Link prefetch={false} href="/help" className="text-info underline">Knowledge base</Link>
          {!caseId && <Link prefetch={false} href="/business/help" className="text-info underline">Help &amp; support</Link>}
          {mode !== "live" && <Link prefetch={false} href="/login?next=support" className="text-info underline">Sign in for support</Link>}
          <a href="https://wa.me/2347036580994?text=Hi%20JKTL%2C%20I%20need%20help%20using%20JKTL%20Business." target="_blank" rel="noopener noreferrer" className="text-info underline">WhatsApp</a>
        </div>
        <p className="text-[10px] leading-4 text-ink-muted">Don’t share passwords, card details, OTPs or private customer records. Guidance doesn’t change your account or confirm a payment.</p>
      </div>
    </section>
  );
}
