"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Delivery = { id: string; text: string; complete: boolean };
type Target = { id: string; body: string; characters: string[]; position: number; complete: boolean };

/** Animate already validated text locally; never reveal unvalidated provider tokens. */
export function useReplyDelivery(open: boolean) {
  const [reply, setReply] = useState<Delivery | null>(null);
  const target = useRef<Target | null>(null), visible = useRef(open);
  useEffect(() => { visible.current = open; }, [open]);
  const finish = useCallback(() => {
    const current = target.current;
    if (!current || current.complete) return;
    current.complete = true;
    current.position = current.characters.length;
    setReply({ id: current.id, text: current.body, complete: true });
  }, []);
  const deliver = useCallback((message: { id: string; body: string }) => {
    if (target.current?.id === message.id) return;
    const immediate = !visible.current || document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const characters = Array.from(message.body);
    target.current = { ...message, characters, position: immediate ? characters.length : 0, complete: immediate };
    setReply({ id: message.id, text: immediate ? message.body : "", complete: immediate });
  }, []);
  useEffect(() => {
    const current = target.current;
    if (!current || current.complete) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setTimeout>;
    const chunk = Math.max(2, Math.ceil(current.characters.length / 70));
    const tick = () => {
      if (target.current !== current || current.complete) return;
      if (!open || document.hidden || reduced.matches) { finish(); return; }
      current.position = Math.min(current.characters.length, current.position + chunk);
      if (current.position === current.characters.length) { finish(); return; }
      setReply({ id: current.id, text: current.characters.slice(0, current.position).join(""), complete: false });
      timer = setTimeout(tick, 24);
    };
    const hidden = () => { if (document.hidden || reduced.matches) finish(); };
    timer = setTimeout(tick, 0);
    document.addEventListener("visibilitychange", hidden);
    reduced.addEventListener("change", hidden);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", hidden);
      reduced.removeEventListener("change", hidden);
    };
  }, [open, reply?.id, reply?.complete, finish]);
  useEffect(() => () => { target.current = null; }, []);
  return { reply, isTyping: Boolean(reply && !reply.complete), deliver, finish };
}
