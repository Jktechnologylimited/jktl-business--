"use client";
import { useEffect, useRef, useState } from "react";
import type { TycoonState } from "@/lib/tycoon";

/** One throttled clock for all moving actors; no timer or frame loop per sprite. */
export function useWorldMotion(paused: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0, previous = 0, accumulated = 0;
    const tick = (now: number) => {
      if (previous && !paused && !media.matches && !document.hidden) {
        accumulated += Math.min(now - previous, 100);
        if (accumulated >= 1000 / 30) {
          const elapsed = accumulated / 1000;
          setSeconds(value => value + elapsed);
          accumulated = 0;
        }
      }
      previous = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [paused]);
  return seconds;
}

/** Presentation only: accepted economy builds remain the sole source of ownership. */
export function useConstruction(plots: TycoonState["plots"], ready = true) {
  const initialized = useRef(false);
  const previous = useRef(plots);
  const generations = useRef<Record<number, number>>({});
  const [stages, setStages] = useState<Record<number, "building" | "ready">>({});
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    if (!initialized.current || !ready) {
      previous.current = plots;
      initialized.current = ready;
      return;
    }
    const added = plots.flatMap((p, id) => p && !previous.current[id] ? [id] : []);
    plots.forEach((p, id) => {
      if (!p && previous.current[id]) generations.current[id] = (generations.current[id] || 0) + 1;
    });
    previous.current = plots;
    if (!added.length) return;
    // Defer the visual update until after the committed economy update.
    const frame = requestAnimationFrame(() => {
      setStages(current => ({ ...current, ...Object.fromEntries(added.map(id => [id, "building"])) }));
      for (const id of added) {
        const token = (generations.current[id] || 0) + 1;
        generations.current[id] = token;
        const complete = setTimeout(() => {
          timers.current.delete(complete);
          if (generations.current[id] !== token) return;
          setStages(current => ({ ...current, [id]: "ready" }));
          const clear = setTimeout(() => {
            timers.current.delete(clear);
            if (generations.current[id] !== token) return;
            setStages(current => { const next = { ...current }; delete next[id]; return next; });
          }, 1800);
          timers.current.add(clear);
        }, 2200);
        timers.current.add(complete);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [plots, ready]);
  useEffect(() => {
    const pending = timers.current;
    return () => { for (const timer of pending) clearTimeout(timer); pending.clear(); };
  }, []);
  return stages;
}
