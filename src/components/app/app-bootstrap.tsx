"use client";

import { useEffect } from "react";
import { useBusinessStore } from "@/lib/store";

export function AppBootstrap() {
  const hydrate = useBusinessStore((s) => s.hydrate);
  const setOnline = useBusinessStore((s) => s.setOnline);

  useEffect(() => {
    hydrate();

    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    // Only register in production: `sw.js` treats /_next/static/* as
    // cache-first/immutable, which is correct once — but wrong for a dev
    // server, where the same chunk path can serve different code on every
    // restart. Registering it in dev makes the browser silently keep
    // running stale JS (surfaces as ChunkLoadError or a "function is not a
    // function" error for something you just added) no matter how many
    // times the dev server itself is restarted.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration can fail in unsupported contexts — the app still
        // works online, it just won't cache for offline use this session.
      });
    }

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [hydrate, setOnline]);

  return null;
}
