"use client";
import { usePathname } from "next/navigation";
import { startVisiblePolling } from "@/lib/browser/visible-polling";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
type Feature = {
  slug: string;
  route: string;
  show_new: boolean;
  ends_at: string | null;
};
const Context = createContext<Feature[]>([]);
export function FeatureBadgeProvider({ children }: { children: ReactNode }) {
  const [features, setFeatures] = useState<Feature[]>([]);
  const pathname = usePathname();
  const badgesNeeded =
    !/^\/(?:template-canvas|chatbots|sites)(?:\/|$)/.test(pathname || "") &&
    !/^\/templates\/[^/]+/.test(pathname || "");
  useEffect(() => {
    if (!badgesNeeded) return;
    let active = true;
    async function refresh() {
      try {
        const r = await fetch("/api/public/features", { cache: "default" });
        if (!r.ok) {
          if (active) setFeatures([]);
          return;
        }
        const d = await r.json();
        if (active && Array.isArray(d.features)) {
          const now = Date.now();
          setFeatures(
            d.features.map((feature: Feature) => ({
              ...feature,
              show_new:
                feature.show_new &&
                (!feature.ends_at || Date.parse(feature.ends_at) > now),
            })),
          );
        }
      } catch {
        if (active) setFeatures([]);
      }
    }
    const stop = startVisiblePolling(refresh, 300000, 300000);
    return () => {
      active = false;
      stop();
    };
  }, [badgesNeeded]);
  return <Context.Provider value={features}>{children}</Context.Provider>;
}
export function FeatureBadge({
  slug,
  route,
}: {
  slug?: string;
  route?: string;
}) {
  const features = useContext(Context);
  const normalized = route
    ?.split("?")[0]
    .replace(/^https:\/\/business\.jktl\.com\.ng/, "");
  const aliases: Record<string, string> = {
    "/products/customer-management": "customers",
    "/products/bookings-sales": "bookings",
    "/products/invoicing-payments": "payments",
    "/products/inventory-expenses": "inventory",
    "/products/business-email": "business-email",
    "/products/domains": "domains",
    "/products/custom-websites": "custom",
    "/products/website-builder": "website-builder",
    "/products/business-tools": "business-tools",
    "/products/ai-receptionist": "ai-receptionist",
    "/games/business-tycoon": "tycoon",
    "/games": "fantasy",
  };
  const feature = features.find(
    (f) =>
      f.slug === (slug || aliases[normalized || ""]) || f.route === normalized,
  );
  if (!feature?.show_new) return null;
  return (
    <span
      aria-label="New feature"
      style={{
        display: "inline-flex",
        alignItems: "center",
        marginInlineStart: 6,
        padding: "3px 6px",
        borderRadius: 5,
        background: "#c9a84c",
        color: "#060e2a",
        fontSize: 9,
        fontWeight: 800,
        lineHeight: 1.2,
        letterSpacing: ".04em",
        verticalAlign: "middle",
      }}
    >
      NEW
    </span>
  );
}
