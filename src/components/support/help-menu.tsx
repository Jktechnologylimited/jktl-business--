"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { ArrowUpRight, BookOpen, Headset, LifeBuoy, Mail, MessageSquare, Search, Sparkles, X } from "lucide-react";
import { openSupportAssistant } from "./support-navigation";
import styles from "./help-menu.module.css";

export function HelpMenu({ compact = false }: { compact?: boolean }) {
  const knowledgeHref = "/help";
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  function close() { dialog.current?.close(); setOpen(false); }
  return <>
    <button ref={trigger} type="button" className={styles.trigger} aria-label="Help & support" aria-haspopup="dialog" aria-expanded={open} aria-controls={id} onClick={() => { dialog.current?.showModal(); setOpen(true); }}>
      <LifeBuoy size={18} aria-hidden="true" /><span>{compact ? "Help" : "Help & support"}</span>
    </button>
    <dialog ref={dialog} id={id} className={styles.dialog} aria-labelledby={id + "-title"} aria-describedby={id + "-description"} onClose={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <div className={styles.panel}>
        <header className={styles.header}><div><p>JKTL Business</p><h2 id={id + "-title"}>Help & support</h2></div><button type="button" className={styles.close} aria-label="Close help" onClick={close}><X size={20} aria-hidden="true" /></button></header>
        <div className={styles.body}>
          <p id={id + "-description"} className={styles.description}>Find a guide, ask a question or follow up with the team.</p>
          <form method="get" action={knowledgeHref} className={styles.search}>
            <label htmlFor={id + "-search"}>Search the knowledge base</label>
            <div><Search size={17} aria-hidden="true" /><input id={id + "-search"} name="q" placeholder="Try publishing, domains or billing" value={search} onChange={event => setSearch(event.target.value)} maxLength={200} /><button type="submit">Search</button></div>
          </form>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={() => { close(); openSupportAssistant(trigger.current); }}><Sparkles size={22} aria-hidden="true" /><span><strong>Ask JKTL AI</strong><small>Work through your question, one step at a time.</small></span><ArrowUpRight size={17} aria-hidden="true" /></button>
            <Link prefetch={false} href="/business/help" onClick={close}><Headset size={22} aria-hidden="true" /><span><strong>Messages & human support</strong><small>Start a request or return to your conversations.</small></span><ArrowUpRight size={17} aria-hidden="true" /></Link>
            <Link prefetch={false} href={knowledgeHref} onClick={close}><BookOpen size={22} aria-hidden="true" /><span><strong>Browse the guides</strong><small>Clear instructions for the next step.</small></span><ArrowUpRight size={17} aria-hidden="true" /></Link>
          </div>
          <footer className={styles.contact}><span>Need to reach JKTL?</span><a href="https://wa.me/2347036580994" target="_blank" rel="noopener noreferrer"><MessageSquare size={15} aria-hidden="true" />WhatsApp</a><a href="mailto:info@jktl.com.ng"><Mail size={15} aria-hidden="true" />Email</a></footer>
        </div>
      </div>
    </dialog>
  </>;
}
