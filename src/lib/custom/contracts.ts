/** Public labels only. Do not import server credentials/crypto into client components. */
export const PROJECT_CATEGORY_LABELS = {
  WEBSITE_CONTENT: "Website content",
  WEBSITE_TECHNICAL: "Website technical issue",
  DOMAIN: "Domain",
  EMAIL: "Business Email",
  BILLING: "Billing",
  MAINTENANCE: "Maintenance",
  FEATURE_REQUEST: "Feature request",
} as const;
export const CMS_SCOPE_LABELS: Record<string, string> = {
  "content:read": "View content",
  "content:write": "Edit content",
  "content:publish": "Publish content",
};
