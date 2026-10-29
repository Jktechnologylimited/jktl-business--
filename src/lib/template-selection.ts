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
    "beauty-atelier": "salon",
    "salon-luxe": "salon",
    "barber-monochrome": "salon",
    "med-spa": "aesthetics",
    restaurant: "restaurant",
    photography: "photographer",
    events: "wedding_events",
  };
  return mapped[getWebsiteTemplate(id)?.sourceId || id] || "general";
}

/** Session-only draft for leaving the editor to change a plan. Never publishes. */
export function readTemplateSessionDraft(
  organizationId: string,
  templateId: string,
  revision: number,
): unknown | null {
  if (typeof window === "undefined" || !getWebsiteTemplate(templateId))
    return null;
  try {
    const value = JSON.parse(
      window.sessionStorage.getItem(
        `jktl.website-draft:${organizationId}:${templateId}`,
      ) || "null",
    );
    if (
      !value ||
      value.revision !== revision ||
      Date.now() - value.updatedAt > 24 * 60 * 60 * 1000
    )
      return null;
    return value.document || null;
  } catch {
    return null;
  }
}
export function rememberTemplateSessionDraft(
  organizationId: string,
  templateId: string,
  revision: number,
  document: unknown,
) {
  if (typeof window === "undefined" || !getWebsiteTemplate(templateId)) return;
  try {
    const serialized = JSON.stringify({
      revision,
      updatedAt: Date.now(),
      document,
    });
    if (serialized.length <= 75000)
      window.sessionStorage.setItem(
        `jktl.website-draft:${organizationId}:${templateId}`,
        serialized,
      );
  } catch {}
}
