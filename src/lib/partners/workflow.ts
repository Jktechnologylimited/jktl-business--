export type ClientStage =
  | "draft"
  | "awaiting-owner"
  | "access-needed"
  | "ready-to-build"
  | "ready-to-publish"
  | "published";
export function clientStage(c: Record<string, unknown>): ClientStage {
  if (c.organization_id && !c.access_active) return "access-needed";
  if (!c.organization_id) return c.template_id ? "awaiting-owner" : "draft";
  if (!c.can_edit) return "access-needed";
  if (c.published) return "published";
  return c.live_template ? "ready-to-publish" : "ready-to-build";
}
export const STAGE_LABELS: Record<ClientStage, string> = {
  draft: "Start designing",
  "awaiting-owner": "Owner approval needed",
  "access-needed": "Permission needed",
  "ready-to-build": "Ready to build",
  "ready-to-publish": "Ready to publish",
  published: "Published",
};
export function safeWebsiteUrl(subdomain: unknown) {
  return typeof subdomain === "string" &&
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)
    ? `https://${subdomain}.jktl.com.ng`
    : null;
}
export const PARTNER_STEPS = [
  ["01", "Create client", "Add the business and owner’s contact details."],
  ["02", "Build website", "Choose a design and prepare the content."],
  ["03", "Owner approval", "The owner signs in and grants permissions."],
  ["04", "Publish & grow", "Publish the site, then manage approved services."],
] as const;
