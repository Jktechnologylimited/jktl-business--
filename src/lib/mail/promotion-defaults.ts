import type { Promotion } from "./layout";
export const PROMOTION_CATEGORIES = [
  "invitation",
  "onboarding",
  "website",
  "domain",
  "business_email",
  "payment",
  "subscription",
  "affiliate",
  "partner",
  "service",
  "marketing",
];
/** Verified public destinations on 28 October 2026; these are initialization
 * data only. Once initialized, the database (including an empty list) wins. */
export const DEFAULT_PROMOTIONS: Promotion[] = [
  [
    "Website Templates",
    "Explore professional website designs for your business.",
    "https://jktl.com.ng/templates",
    "templates",
  ],
  [
    "Domain Registration",
    "Find and register a domain that represents your business.",
    "https://jktl.com.ng/domains",
    "domains",
  ],
  [
    "Business Email",
    "Create professional email addresses for your business.",
    "https://jktl.com.ng/products/business-email",
    "business-email",
  ],
  [
    "JKTL Business",
    "Build and manage your business's online presence.",
    "https://business.jktl.com.ng",
    "jktl-business",
  ],
  [
    "JKTL Partners",
    "Offer JKTL-powered services to your clients.",
    "https://jktl.com.ng/partners",
    "partners",
  ],
].map(([title, description, url, productId], i) => ({
  id: "20000000-4444-4444-8444-" + String(i + 1).padStart(12, "0"),
  title,
  description,
  url,
  productId,
  enabled: true,
  priority: (i + 1) * 10,
  categories: [...PROMOTION_CATEGORIES],
}));
export const LEGACY_PROMOTION_IDS = Array.from(
  { length: 6 },
  (_, i) => "10000000-4444-4444-8444-" + String(i + 1).padStart(12, "0"),
);
