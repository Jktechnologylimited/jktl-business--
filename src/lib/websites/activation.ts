import type { WebsiteCard } from "./model";
/** Deterministic next action from persisted sites, never from clicked buttons. */
export function websiteNextStep(sites: WebsiteCard[]) {
  const live = sites.find((s) => s.kind !== "custom" && s.published);
  const draft = sites.find((s) => s.kind !== "custom" && !s.published);
  const custom = sites.find((s) => s.kind === "custom");
  if (live)
    return {
      stage: "published" as const,
      site: live,
      href: live.editUrl,
      label: "Update my website",
    };
  if (draft)
    return {
      stage: "draft" as const,
      site: draft,
      href: draft.editUrl,
      label: "Continue my draft",
    };
  if (custom)
    return {
      stage: "custom" as const,
      site: custom,
      href: custom.editUrl,
      label: "Manage my Custom project",
    };
  return {
    stage: "choose" as const,
    site: null,
    href: "/business/templates",
    label: "Choose a free template",
  };
}
