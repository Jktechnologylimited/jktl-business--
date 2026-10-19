import type { AuditFinding, AuditResult, WebsiteSignals } from "./types";

/**
 * The website audit: what makes a business worth approaching.
 *
 * Two halves, deliberately separated:
 *
 *   - `scoreWebsite()` is **pure** — signals in, verdict out — so the entire
 *     judgement about what counts as a "poor website" is unit tested rather
 *     than tuned by hand against live traffic.
 *   - `auditWebsite()` does the fetching and produces those signals.
 *
 * The weights below encode a specific opinion about this market, and it is
 * worth stating: **most visitors here arrive on a phone, from WhatsApp, on
 * mobile data.** So a missing viewport meta tag is penalised more heavily than
 * anything else, a site with no tap-to-book or tap-to-call is penalised next,
 * and a page that is merely slow is penalised hard — a 6 MB site is a site
 * nobody in Lagos finishes loading. A site scoring below 55 is a lead.
 */

const SOCIAL_HOSTS = [
  "facebook.com",
  "m.facebook.com",
  "web.facebook.com",
  "instagram.com",
  "linktr.ee",
  "linktree.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "linkedin.com",
  "youtube.com",
  "wa.me",
  "wa.link",
  "bit.ly",
  "beacons.ai",
  "carrd.co",
];

/** Free site builders that produce a page a business does not really own or
 * control — treat as "poor" rather than "no site": it exists, it just isn't
 * doing them any favours. */
const BUILDER_HOSTS = ["business.site", "sites.google.com", "godaddysites.com", "weebly.com", "wordpress.com", "blogspot.com"];

const DIRECTORY_HOSTS = [
  "yelp.com",
  "tripadvisor.com",
  "foursquare.com",
  "yellowpages",
  "vconnect.com",
  "finelib.com",
  "ngbusinessdirectory",
  "google.com/maps",
  "goo.gl",
];

/** Phrases that mark a domain as parked rather than in use. */
const PARKED_MARKERS = ["domain is for sale", "buy this domain", "this domain has expired", "parked by", "sedoparking", "godaddy.com/domainsearch"];

export interface ClassifiedUrl {
  kind: "none" | "social" | "directory" | "builder" | "site" | "invalid";
  url: string;
  host: string;
}

/**
 * Normalizes and classifies whatever the provider put in its `website` field.
 * Google Maps listings routinely carry a Facebook page, a directory entry or
 * nothing at all in that column, and all three mean "this business has no
 * website" for our purposes — but they are recorded distinctly, because the
 * email we send should not tell someone their Facebook page is a bad website.
 */
export function classifyWebsite(raw: string): ClassifiedUrl {
  const trimmed = (raw || "").trim();
  if (!trimmed) return { kind: "none", url: "", host: "" };

  // A Maps listing often has no scheme; a bare "example.com" is not a URL.
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    // Not a URL at all — some listings put a phone number or a note here.
    return { kind: "invalid", url: "", host: "" };
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const href = `${host}${parsed.pathname}`;

  if (SOCIAL_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return { kind: "social", url: withScheme, host };
  if (DIRECTORY_HOSTS.some((h) => href.includes(h) || host.endsWith(`.${h}`))) return { kind: "directory", url: withScheme, host };
  if (BUILDER_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return { kind: "builder", url: withScheme, host };
  // A deep google.com link is a Maps/Drive link, not a website.
  if (host === "google.com" || host.endsWith(".google.com")) return { kind: "directory", url: withScheme, host };

  return { kind: "site", url: withScheme, host };
}

/* -------------------------------------------------------------------------- */
/* The pure judgement                                                         */
/* -------------------------------------------------------------------------- */

/** Below this, a real site is a lead. */
export const POOR_SITE_THRESHOLD = 55;
/** At or above this, a site is genuinely good and not worth approaching. */
export const GOOD_SITE_THRESHOLD = 80;

export function scoreWebsite(signals: WebsiteSignals): AuditResult {
  const findings: AuditFinding[] = [];

  // No site at all is handled before we ever fetch anything.
  if (!signals.url) {
    return {
      status: "none",
      score: 0,
      findings: [{ code: "no_website", label: "No website listed at all", weight: 100, critical: true }],
      summary: "No website listed on their Google Maps profile.",
    };
  }

  if (!signals.reachable) {
    findings.push({
      code: "unreachable",
      label: "The website does not respond",
      weight: 70,
      critical: true,
    });
    return {
      status: "unreachable",
      score: 15,
      findings,
      summary: `Their website did not respond${signals.statusCode ? ` (HTTP ${signals.statusCode})` : ""}.`,
    };
  }

  let score = 100;

  const deduct = (code: string, label: string, weight: number, critical = false) => {
    score -= weight;
    findings.push({ code, label, weight, critical });
  };

  // A parked domain is a dead end, not a website: it must actually cost the
  // score, or the admin table would show 100/100 next to "domain expired".
  if (signals.parked) deduct("parked", "The domain is parked or expired", 60, true);

  /**
   * The four things that make a site a lead **on their own**, whatever the
   * total comes to. A numeric threshold alone gets this wrong in both
   * directions: a site can lose twenty small points and still be perfectly
   * usable, or lose eight big ones and be useless. These are the ones that
   * decide it.
   */
  if (!signals.https) deduct("no_https", "No padlock — visitors see 'Not secure' in their browser", 22, true);

  // The single biggest signal in this market: most visitors arrive on a phone.
  if (!signals.hasViewport) deduct("no_mobile", "Not built for phones — the page has no mobile layout", 20, true);

  if (!signals.title.trim()) deduct("no_title", "No page title, so it looks broken in search results and link previews", 12);
  else if (signals.title.trim().length < 12) deduct("weak_title", "The page title is too short to say what the business does", 6);

  if (!signals.hasMetaDescription) deduct("no_description", "Nothing tells Google what the business does", 8);

  if (!signals.hasOpenGraph) deduct("no_og", "No preview image or text when the link is shared on WhatsApp", 7);

  if (!signals.hasBookingCue) deduct("no_booking", "No way to book or message from the site", 9, true);
  if (!signals.hasPhoneCue) deduct("no_phone", "No visible phone number", 5);

  if (signals.bytes > 6_000_000) deduct("huge", "The page is over 6 MB — expensive and slow to open on mobile data", 18, true);
  else if (signals.bytes > 3_000_000) deduct("heavy", "The page is over 3 MB, which is slow on mobile data", 11);

  if (signals.loadMs !== null && signals.loadMs > 6_000) deduct("very_slow", "Takes more than six seconds to respond", 18);
  else if (signals.loadMs !== null && signals.loadMs > 3_000) deduct("slow", "Takes more than three seconds to respond", 10);

  if (signals.scriptCount > 100) deduct("script_heavy", "Loads over a hundred scripts, which slows every visit", 15);
  else if (signals.scriptCount > 50) deduct("many_scripts", "Loads a lot of scripts, which slows every visit", 9);

  if (signals.platform === "google-business-site") deduct("template", "A temporary Google template page the business cannot really control", 12);

  score = Math.max(0, Math.min(100, Math.round(score)));
  const status = score >= GOOD_SITE_THRESHOLD ? "good" : score >= POOR_SITE_THRESHOLD ? "ok" : "poor";

  const worst = [...findings].sort((a, b) => b.weight - a.weight).slice(0, 3);
  const summary =
    status === "poor"
      ? `Website scores ${score}/100. ${worst.map((f) => f.label).join("; ")}.`
      : status === "ok"
        ? `Website scores ${score}/100 — usable but with clear gaps.`
        : `Website scores ${score}/100 and looks healthy.`;

  return { status, score, findings, summary };
}

/** The verdict for a listing whose "website" field is a social page, a
 * directory entry or a builder template — no fetch required. */
export function auditNonSite(kind: Exclude<ClassifiedUrl["kind"], "site" | "none" | "invalid">): AuditResult {
  const labels: Record<string, string> = {
    social: "Their only web presence is a social media page",
    directory: "They only appear on a directory listing",
    builder: "They are on a free template builder they do not control",
  };
  return {
    status: "social_only",
    score: kind === "social" ? 25 : kind === "directory" ? 22 : 30,
    findings: [{ code: `only_${kind}`, label: labels[kind], weight: 45 }],
    summary: labels[kind],
  };
}

/**
 * A business is worth approaching when its site is missing, broken,
 * unmaintained, or not doing its job on a phone.
 *
 * Two routes in, and the second is the important one: a low total score, **or**
 * any single critical finding. `status` is a health label for humans ("this
 * site is fine, really"); this is the decision.
 */
export function isQualifiedLead(result: AuditResult): boolean {
  if (result.status === "none" || result.status === "social_only" || result.status === "poor" || result.status === "unreachable") {
    return true;
  }
  return result.findings.some((finding) => finding.critical === true);
}

/* -------------------------------------------------------------------------- */
/* The fetch                                                                  */
/* -------------------------------------------------------------------------- */

/** How much of a page we read. Enough to judge the markup, capped so one
 * enormous site can't stall an audit run. */
const MAX_HTML_BYTES = 400_000;

function countScripts(html: string): number {
  return (html.match(/<script\b/gi) ?? []).length;
}

function detectPlatform(html: string, host: string): string {
  const h = html.toLowerCase();
  if (h.includes("wp-content") || h.includes("wp-includes")) return "wordpress";
  if (h.includes("wix.com") || host.includes("wixsite")) return "wix";
  if (h.includes("squarespace")) return "squarespace";
  if (h.includes("shopify")) return "shopify";
  if (host.includes("business.site") || h.includes("business.site")) return "google-business-site";
  if (h.includes("webflow")) return "webflow";
  return "unknown";
}

function looksParked(html: string, title: string): boolean {
  const haystack = `${title} ${html}`.toLowerCase();
  return PARKED_MARKERS.some((m) => haystack.includes(m));
}

export interface AuditOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Fetches a site and turns it into signals. Never throws: an audit that fails
 * must still record *why*, because "we could not reach their site" is itself a
 * qualified lead.
 */
export async function auditWebsite(rawUrl: string, opts: AuditOptions = {}): Promise<AuditResult> {
  const classified = classifyWebsite(rawUrl);

  if (classified.kind === "none" || classified.kind === "invalid") {
    return scoreWebsite({
      url: "",
      reachable: false,
      statusCode: null,
      https: false,
      finalUrl: "",
      loadMs: null,
      bytes: 0,
      hasViewport: false,
      title: "",
      hasMetaDescription: false,
      hasOpenGraph: false,
      scriptCount: 0,
      hasBookingCue: false,
      hasPhoneCue: false,
      platform: "unknown",
      parked: false,
    });
  }

  if (classified.kind !== "site") {
    return auditNonSite(classified.kind);
  }

  const doFetch = opts.fetchImpl ?? fetch;
  const startedAt = Date.now();
  let html = "";
  let statusCode: number | null = null;
  let finalUrl = classified.url;
  let bytes = 0;
  let reachable = false;
  let errorMessage: string | undefined;

  try {
    const res = await doFetch(classified.url, {
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(opts.timeoutMs ?? 12_000),
      headers: {
        // Identify honestly. An audit that pretends to be a browser is a
        // crawler lying about who it is, which is not a habit to build in.
        "User-Agent": "JKTLBusinessSiteAudit/1.0 (+https://jktl.com.ng)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    statusCode = res.status;
    finalUrl = res.url || classified.url;
    reachable = res.ok;
    const text = await res.text();
    bytes = Number(res.headers.get("content-length") ?? 0) || text.length;
    html = text.slice(0, MAX_HTML_BYTES);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Request failed";
  }

  const loadMs = Date.now() - startedAt;
  const https = finalUrl.startsWith("https://");
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = (titleMatch?.[1] ?? "").replace(/\s+/g, " ").trim();
  const lower = html.toLowerCase();

  return scoreWebsite({
    url: classified.url,
    reachable,
    statusCode,
    https,
    finalUrl,
    loadMs: reachable ? loadMs : null,
    bytes,
    hasViewport: /<meta[^>]+name=["']viewport["']/i.test(html),
    title,
    hasMetaDescription: /<meta[^>]+name=["']description["'][^>]*content=["'][^"']{10,}/i.test(html),
    hasOpenGraph: /property=["']og:(title|image|description)["']/i.test(html),
    scriptCount: countScripts(html),
    // Deliberately generous: any of these counts as "there is a way in".
    hasBookingCue:
      /whatsapp|wa\.me|book (now|an? appointment|online)|book now|schedule|appointment|reserve|contact us|get in touch|call now/i.test(lower),
    hasPhoneCue: /tel:|(\+?234|0)[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{4}/.test(html),
    platform: detectPlatform(html, classified.host),
    parked: looksParked(html, title),
    errorMessage,
  });
}
