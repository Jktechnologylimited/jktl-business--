"use client";
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
  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const r = await fetch("/api/public/features", { cache: "no-store" });
        if (!r.ok) {
          if (active) setFeatures([]);
          return;
        }
        const d = await r.json();
        if (active && Array.isArray(d.features)) setFeatures(d.features);
      } catch {
        if (active) setFeatures([]);
      }
    }
    void refresh();
    const interval = setInterval(refresh, 30000);
    const focus = () => void refresh();
    window.addEventListener("focus", focus);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("focus", focus);
    };
  }, []);
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
