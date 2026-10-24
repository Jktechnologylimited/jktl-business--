import type { BusinessType } from "./types";
import { getWebsiteTemplate } from "./website-templates";
const key = "jktl.pending-website-template";
export function rememberTemplate(id: string) {
  if (typeof window === "undefined" || !getWebsiteTemplate(id)) return;
  try {
    window.sessionStorage.setItem(key, id);
  } catch {}
}
export function pendingTemplate(queryId?: string | null): string {
  if (queryId !== undefined && queryId !== null)
    return getWebsiteTemplate(queryId)?.id || "";
  if (typeof window === "undefined") return "";
  try {
    return getWebsiteTemplate(window.sessionStorage.getItem(key))?.id || "";
  } catch {
    return "";
  }
}
export function clearPendingTemplate() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {}
}

export function templateBusinessType(id: string): BusinessType {
  const mapped: Record<string, BusinessType> = {
    "hair-salon": "salon",
    "med-spa": "aesthetics",
    restaurant: "restaurant",
    photography: "photographer",
    events: "wedding_events",
  };
  return mapped[id] || "general";
}
