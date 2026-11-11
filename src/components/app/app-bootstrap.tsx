"use client";
import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { needsBusinessBootstrap } from "@/lib/business-bootstrap";

// Avoid loading/initialising the private offline store on public sites, previews
// and game frames. The authenticated workspace keeps its existing store/actions.
const BusinessDataBootstrap = dynamic(() =>
  import("./business-data-bootstrap").then((m) => m.BusinessDataBootstrap),
);
export function AppBootstrap() {
  const pathname = usePathname();
  const registered = useRef(false);
  useEffect(() => {
    if (registered.current || pathname.startsWith("/chatbots/")) return;
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      registered.current = true;
      navigator.serviceWorker.register("/sw.js").catch(() => {
        registered.current = false;
      });
    }
  }, [pathname]);
  return needsBusinessBootstrap(pathname) ? <BusinessDataBootstrap /> : null;
}
