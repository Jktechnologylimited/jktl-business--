"use client";
import { useEffect } from "react";
import { useBusinessStore } from "@/lib/store";

// Client lifecycle markers, not data/auth caches. A fresh document still performs
// the existing session verification and tenant-scoped pull through hydrate().
let visited = false;
export function BusinessDataBootstrap() {
  const hydrate = useBusinessStore((s) => s.hydrate);
  const setOnline = useBusinessStore((s) => s.setOnline);
  useEffect(() => {
    const returning = visited;
    visited = true;
    hydrate();
    if (returning && navigator.onLine) setOnline(true);
    const online = () => setOnline(true);
    const offline = () => setOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [hydrate, setOnline]);
  return null;
}
