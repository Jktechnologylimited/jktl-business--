"use client";
import { useEffect, useState } from "react";
import type { WorldFeed } from "@/lib/game-world/model";
export function useWorldFeed() {
  const [feed, setFeed] = useState<WorldFeed | null>(null),
    [now, setNow] = useState(0);
  useEffect(() => {
    let alive = true;
    let controller: AbortController | null = null;
    const update = async () => {
      if (document.hidden) return;
      setNow(Date.now());
      controller?.abort();
      controller = new AbortController();
      try {
        const r = await fetch("/api/game-world-feed", {
          signal: controller.signal,
        });
        if (r.ok && alive) setFeed(await r.json());
      } catch {
        /* Old live labels expire using observedAt; no fabricated fallback. */
      }
    };
    void update();
    const timer = setInterval(update, 60000),
      clock = setInterval(() => {
        if (!document.hidden) setNow(Date.now());
      }, 30000);
    document.addEventListener("visibilitychange", update);
    return () => {
      alive = false;
      controller?.abort();
      clearInterval(timer);
      clearInterval(clock);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return { feed, now };
}
