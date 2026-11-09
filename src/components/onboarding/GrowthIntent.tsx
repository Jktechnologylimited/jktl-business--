"use client";
import { useEffect } from "react";
export function GrowthIntent({
  event,
}: {
  event: "registration_started" | "template_selected";
}) {
  useEffect(() => {
    if (
      !document.cookie.split("; ").includes("jktl_journey_analytics=yes") ||
      navigator.doNotTrack === "1" ||
      (navigator as Navigator & { globalPrivacyControl?: boolean })
        .globalPrivacyControl
    )
      return;
    void fetch("/api/growth/visit", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consent: true, event }),
      keepalive: true,
    }).catch(() => {});
  }, [event]);
  return null;
}
