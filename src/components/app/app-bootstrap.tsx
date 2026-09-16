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

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration can fail in unsupported/dev contexts — the app still
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
