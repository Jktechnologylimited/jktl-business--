"use client";
import { useEffect, useRef, useCallback } from "react";
export function usePublishedSiteMetrics(
  subdomain: string,
  templateId: string,
  enabled: boolean,
) {
  const seen = useRef("");
  const send = useCallback(
    (event: "view" | "cta" | "contact") => {
      if (
        !enabled ||
        !templateId ||
        !globalThis.crypto?.randomUUID ||
        navigator.doNotTrack === "1"
      )
        return;
      const body = JSON.stringify({
        event,
        eventId: crypto.randomUUID(),
        subdomain,
        templateId,
      });
      if (
        !navigator.sendBeacon?.(
          "/api/site-metrics",
          new Blob([body], { type: "text/plain" }),
        )
      )
        void fetch("/api/site-metrics", {
          method: "POST",
          body,
          keepalive: true,
          credentials: "omit",
          headers: { "Content-Type": "text/plain" },
        }).catch(() => {});
    },
    [enabled, templateId, subdomain],
  );
  useEffect(() => {
    const key = `${subdomain}:${templateId}`;
    if (enabled && seen.current !== key) {
      const view = () => {
        if (document.visibilityState === "visible" && seen.current !== key) {
          seen.current = key;
          send("view");
        }
      };
      view();
      document.addEventListener("visibilitychange", view);
      return () => document.removeEventListener("visibilitychange", view);
    }
  }, [subdomain, templateId, enabled, send]);
  return send;
}
