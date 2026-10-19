import type { BusinessType } from "@/lib/types";

/**
 * Shared shapes for the prospecting engine.
 *
 * Client-safe (type-only imports, no server modules) so the admin workbench,
 * the importer, the audit and the outreach composer all agree on one
 * definition. Nothing here carries an organization id: prospecting runs at the
 * platform level, before a business exists.
 */

export type ProspectSource = "apify" | "outscraper" | "csv" | "manual";

/**
 * Why a business is (or isn't) a lead.
 *   none        — no website at all. The best lead there is.
 *   social_only — a Facebook/Instagram page, a Linktree, or similar standing
 *                 in for a website.
 *   poor        — a real site that scores badly: no mobile viewport, no HTTPS,
 *                 nothing to tap to book, or slow enough to lose the visitor.
 *   unreachable — a URL that does not respond at all.
 *   ok / good   — genuinely fine. Not a lead; excluded from outreach.
 */
export type WebsiteStatus = "unaudited" | "none" | "social_only" | "poor" | "ok" | "good" | "unreachable";

export type ProspectStatus =
  | "new"
  | "qualified"
  | "rejected"
  | "site_built"
  | "contacted"
  | "replied"
  | "converted"
  | "suppressed";

/** One business, normalized out of whatever the source sent us. */
export interface ProspectInput {
  source: ProspectSource;
  /** The provider's own place id, where it has one — the dedupe key for a
   * re-scrape of the same search. */
  sourceRef: string;
  businessName: string;
  /** Our own industry id where the provider's category maps onto one. */
  niche: BusinessType | "";
  category: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  country: string;
  website: string;
  rating: number | null;
  reviews: number | null;
  latitude: number | null;
  longitude: number | null;
  raw?: unknown;
}

export interface AuditFinding {
  code: string;
  /** Severe enough to make a business a lead on its own, whatever the total
   * score says. See `isQualifiedLead`. */
  critical?: boolean;
  /** Written for a business owner, not a developer — these lines are quoted in
   * the outreach email, so "no viewport meta tag" would be useless. */
  label: string;
  /** Points deducted. */
  weight: number;
}

export interface WebsiteSignals {
  url: string;
  reachable: boolean;
  statusCode: number | null;
  https: boolean;
  finalUrl: string;
  loadMs: number | null;
  bytes: number;
  hasViewport: boolean;
  title: string;
  hasMetaDescription: boolean;
  hasOpenGraph: boolean;
  scriptCount: number;
  /** Whether there is anything a visitor can tap to book or message. */
  hasBookingCue: boolean;
  hasPhoneCue: boolean;
  platform: string;
  parked: boolean;
  errorMessage?: string;
}

export interface AuditResult {
  status: WebsiteStatus;
  /** 0–100, higher is better. 0 for no site, ~25 for social-only. */
  score: number;
  findings: AuditFinding[];
  /** One line the admin (and the email) can lead with. */
  summary: string;
}

export interface Prospect {
  id: string;
  source: ProspectSource;
  sourceRef: string;
  businessName: string;
  niche: string;
  category: string;
  phone: string;
  email: string;
  /** Whether the address is worth sending to. See `email-validation.ts`. */
  emailStatus?: "unknown" | "valid" | "risky" | "invalid";
  /** The scraped listing, as returned by the provider. Parsed into site content
   * by `enrichmentFromRaw`. */
  enrichment?: Record<string, unknown>;
  address: string;
  city: string;
  state: string;
  country: string;
  website: string;
  rating: number | null;
  reviews: number | null;
  latitude: number | null;
  longitude: number | null;
  websiteStatus: WebsiteStatus;
  websiteScore: number | null;
  auditFindings: AuditFinding[];
  auditedAt: string | null;
  siteOrganizationId: string | null;
  siteSubdomain: string;
  siteBuiltAt: string | null;
  status: ProspectStatus;
  suppressed: boolean;
  /** When they agreed to hear from us. Required before emailing a country
   * whose rule is `consent_required` — and the evidence if anyone asks. */
  consentAt: string | null;
  consentNote: string;
  /** Set when the pipeline refused to send, so the reason is auditable. */
  blockedReason: string;
  unsubscribeToken: string;
  notes: string;
  createdAt: string;
  /** The last outreach actually sent, if any. */
  lastContactedAt: string | null;
}

export interface ProspectRun {
  id: string;
  source: ProspectSource;
  niche: string;
  query: string;
  location: string;
  found: number;
  imported: number;
  duplicates: number;
  status: "running" | "ok" | "failed";
  error: string;
  createdAt: string;
  finishedAt: string | null;
}

export interface ProspectOutreach {
  id: string;
  prospectId: string;
  toEmail: string;
  subject: string;
  body: string;
  status: "sent" | "failed";
  error: string;
  sentAt: string;
}

export interface OutreachSettings {
  senderBusinessName: string;
  fromEmail: string;
  replyTo: string;
  /** Must contain {their_business} and/or {my_business}. */
  subjectTemplate: string;
  dailySendCap: number;
  includeAudit: boolean;
  calendarLink: string;
}

export interface ProspectFilters {
  status?: ProspectStatus | "all";
  websiteStatus?: WebsiteStatus | "all";
  niche?: string;
  city?: string;
  search?: string;
  limit?: number;
}

/** Pipeline counters for the workbench header. */
/** A country's marketing rule as stored, with any admin override applied. */
export interface CountryRuleRow {
  countryCode: string;
  countryName: string;
  dialCode: string;
  currency: string;
  rule: "permitted" | "consent_required" | "review_required" | "blocked";
  note: string;
  reviewedAt: string | null;
  count: number;
}

export interface ProspectStats {
  total: number;
  unaudited: number;
  qualified: number;
  sitesBuilt: number;
  contacted: number;
  replied: number;
  converted: number;
  suppressed: number;
  sentToday: number;
  dailyCap: number;
  /** Leads the rules will not let us email yet — shown so it is obvious why
   * the send button is refusing. */
  blockedByCountry: number;
  needsConsent: number;
}
