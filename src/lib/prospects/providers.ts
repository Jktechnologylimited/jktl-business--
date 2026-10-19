import type { BusinessType } from "@/lib/types";
import type { ProspectInput, ProspectSource } from "./types";

/**
 * Lead importers: Apify, Outscraper, and a CSV fallback.
 *
 * All three normalize into the same `ProspectInput`, so everything downstream
 * — the audit, the site builder, the outreach — is written once. The mappers
 * are pure and exported separately from the fetches on purpose: the payload
 * shapes are the part that breaks when a provider changes a field name, and
 * they are the part worth testing. Fixtures for both providers live in
 * `tests/prospects.test.mjs`.
 *
 * Neither fetch function is exercised in tests (that needs live keys), but
 * neither does anything clever: run the actor / call the endpoint, hand the
 * array to the mapper, drop permanently-closed listings.
 */

/* -------------------------------------------------------------------------- */
/* Niche inference                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Maps a provider's free-text category onto one of our verticals.
 *
 * Order matters: "men's health clinic" contains "clinic", and "medical spa"
 * contains both "spa" (aesthetics) and "medical" — the more specific vertical
 * is tested first so a men's health clinic is never filed as generic beauty.
 */
const NICHE_KEYWORDS: Array<{ niche: BusinessType; words: string[] }> = [
  {
    niche: "mens_health",
    words: [
      "men's health",
      "mens health",
      "male health",
      "erectile",
      "androlog",
      "urolog",
      "testosterone",
      "fertility",
      "sexologist",
      "venereolog",
      "std clinic",
      "sti clinic",
    ],
  },
  {
    niche: "elderly_care",
    words: [
      "elderly",
      "elder care",
      "nursing home",
      "home care",
      "home nursing",
      "geriatric",
      "assisted living",
      "retirement home",
      "old age",
      "senior care",
      "hospice",
      "care home",
    ],
  },
  {
    niche: "aesthetics",
    words: [
      "aesthetic",
      "cosmetic",
      "skin care",
      "skincare",
      "dermatolog",
      "beauty",
      "beauty salon",
      "spa",
      "facial",
      "laser",
      "botox",
      "filler",
      "medical spa",
      "medspa",
      "hair removal",
      "nail",
      "lash",
      "brow",
      "makeup",
      "wellness",
    ],
  },
  {
    niche: "personal_care",
    words: ["barber", "hairdress", "hair salon", "salon", "massage", "grooming"],
  },
];

export function inferNiche(category: string, query = ""): BusinessType | "" {
  const haystack = `${category} ${query}`.toLowerCase();
  for (const entry of NICHE_KEYWORDS) {
    if (entry.words.some((w) => haystack.includes(w))) return entry.niche;
  }
  return "";
}

/* -------------------------------------------------------------------------- */
/* Small normalizers                                                          */
/* -------------------------------------------------------------------------- */

function str(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Ratings from these providers can arrive as "4,5" (comma decimal) or
 * "4.5 stars". */
function rating(value: unknown): number | null {
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.,]/g, "").replace(",", ".");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  const parsed = num(value);
  return parsed && parsed > 0 ? parsed : null;
}

function firstString(...values: unknown[]): string {
  for (const v of values) {
    const s = str(v);
    if (s) return s;
  }
  return "";
}

/* -------------------------------------------------------------------------- */
/* Apify                                                                     */
/* -------------------------------------------------------------------------- */

/** Google Maps scraper payloads we know about. `compass/crawler-google-places`
 * is the common one; the aliases cover the fields other actors swap in. */
export interface ApifyPlace {
  title?: unknown;
  name?: unknown;
  placeId?: unknown;
  place_id?: unknown;
  cid?: unknown;
  categoryName?: unknown;
  category?: unknown;
  address?: unknown;
  fullAddress?: unknown;
  street?: unknown;
  city?: unknown;
  state?: unknown;
  countryCode?: unknown;
  country?: unknown;
  phone?: unknown;
  phoneUnformatted?: unknown;
  website?: unknown;
  site?: unknown;
  emails?: unknown;
  totalScore?: unknown;
  rating?: unknown;
  reviewsCount?: unknown;
  reviews?: unknown;
  location?: { lat?: unknown; lng?: unknown };
  latitude?: unknown;
  longitude?: unknown;
  permanentlyClosed?: unknown;
  temporarilyClosed?: unknown;
}

export function isApifyClosed(item: ApifyPlace): boolean {
  return item.permanentlyClosed === true || item.temporarilyClosed === true;
}

export function mapApifyPlace(item: ApifyPlace, query = "", source: ProspectSource = "apify"): ProspectInput | null {
  const businessName = firstString(item.title, item.name);
  if (!businessName) return null;

  const category = firstString(item.categoryName, item.category);
  const emailsRaw = Array.isArray(item.emails) ? item.emails : [];

  return {
    source,
    sourceRef: firstString(item.placeId, item.place_id, item.cid),
    businessName,
    niche: inferNiche(category, query),
    category,
    phone: firstString(item.phoneUnformatted, item.phone),
    email: firstString(emailsRaw[0]),
    address: firstString(item.address, item.fullAddress, item.street),
    city: str(item.city),
    state: str(item.state),
    country: firstString(item.countryCode, item.country, "NG"),
    website: firstString(item.website, item.site),
    rating: rating(item.totalScore ?? item.rating),
    reviews: num(item.reviewsCount ?? item.reviews),
    latitude: num(item.location?.lat ?? item.latitude),
    longitude: num(item.location?.lng ?? item.longitude),
    raw: item as unknown,
  };
}

export interface ApifyFetchParams {
  token: string;
  actorId?: string;
  query: string;
  location: string;
  limit?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Runs the Google Maps actor synchronously and returns its dataset items.
 *
 * `run-sync-get-dataset-items` is the right endpoint here: prospecting is an
 * admin-triggered action that can afford to wait a minute, and it avoids
 * needing webhooks and a job-polling loop for a feature used a few times a
 * week.
 */
export async function fetchApifyLeads(params: ApifyFetchParams): Promise<unknown[]> {
  const actor = params.actorId || process.env.APIFY_GOOGLE_MAPS_ACTOR || "compass/crawler-google-places";
  const doFetch = params.fetchImpl ?? fetch;
  const url = `https://api.apify.com/v2/acts/${encodeURIComponent(actor)}/run-sync-get-dataset-items?token=${encodeURIComponent(
    params.token,
  )}`;

  const res = await doFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      searchStringsArray: [params.query],
      locationQuery: params.location,
      maxCrawledPlacesPerSearch: Math.min(Math.max(params.limit ?? 40, 1), 200),
      language: "en",
      skipClosedPlaces: true,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(180_000),
  });

  if (!res.ok) throw new Error(`Apify returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? data : [];
}

/* -------------------------------------------------------------------------- */
/* Outscraper                                                                */
/* -------------------------------------------------------------------------- */

export interface OutscraperRow {
  name?: unknown;
  query?: unknown;
  category?: unknown;
  type?: unknown;
  full_address?: unknown;
  address?: unknown;
  city?: unknown;
  state?: unknown;
  country?: unknown;
  country_code?: unknown;
  phone?: unknown;
  site?: unknown;
  website?: unknown;
  email_1?: unknown;
  email_2?: unknown;
  email?: unknown;
  rating?: unknown;
  reviews?: unknown;
  reviews_count?: unknown;
  place_id?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  business_status?: unknown;
}

export function mapOutscraperRow(row: OutscraperRow, query = "", source: ProspectSource = "outscraper"): ProspectInput | null {
  const businessName = str(row.name);
  if (!businessName) return null;
  // Outscraper marks closed businesses in `business_status`.
  if (str(row.business_status).toLowerCase().includes("closed_permanently")) return null;

  const category = firstString(row.category, row.type);

  return {
    source,
    sourceRef: str(row.place_id),
    businessName,
    niche: inferNiche(category, query),
    category,
    phone: str(row.phone),
    email: firstString(row.email_1, row.email_2, row.email),
    address: firstString(row.full_address, row.address),
    city: str(row.city),
    state: str(row.state),
    country: firstString(row.country_code, row.country, "NG"),
    website: firstString(row.site, row.website),
    rating: rating(row.rating),
    reviews: num(row.reviews ?? row.reviews_count),
    latitude: num(row.latitude),
    longitude: num(row.longitude),
    raw: row as unknown,
  };
}

export interface OutscraperFetchParams {
  apiKey: string;
  query: string;
  location: string;
  limit?: number;
  fetchImpl?: typeof fetch;
}

/** Outscraper's Google Maps search. `async=false` makes it a single blocking
 * request, matching the Apify path. */
export async function fetchOutscraperLeads(params: OutscraperFetchParams): Promise<OutscraperRow[]> {
  const doFetch = params.fetchImpl ?? fetch;
  const query = `${params.query}, ${params.location}`;
  const url = `https://api.app.outscraper.com/maps/search-v3?query=${encodeURIComponent(query)}&limit=${Math.min(
    Math.max(params.limit ?? 40, 1),
    200,
  )}&language=en&async=false&region=NG`;

  const res = await doFetch(url, {
    headers: { "X-API-KEY": params.apiKey },
    cache: "no-store",
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new Error(`Outscraper returned ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const body = (await res.json()) as { data?: unknown };
  // Outscraper nests results per query: [[row, row], [row]].
  const data = Array.isArray(body.data) ? body.data : [];
  const flat: OutscraperRow[] = [];
  for (const chunk of data) {
    if (Array.isArray(chunk)) flat.push(...(chunk as OutscraperRow[]));
    else if (chunk && typeof chunk === "object") flat.push(chunk as OutscraperRow);
  }
  return flat;
}

/* -------------------------------------------------------------------------- */
/* CSV fallback                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Maps a header row onto our fields by name, so a manually assembled
 * spreadsheet — or an export from any other tool — works without a provider
 * key. Header matching is loose on purpose: people write "Business Name",
 * "business_name" and "name".
 */
export function mapCsvRecord(record: Record<string, unknown>, query = ""): ProspectInput | null {
  const pick = (...candidates: string[]): string => {
    const keys = Object.keys(record);
    for (const candidate of candidates) {
      const key = keys.find((k) => k.toLowerCase().replace(/[^a-z]/g, "") === candidate.toLowerCase().replace(/[^a-z]/g, ""));
      if (key) {
        const value = str(record[key]);
        if (value) return value;
      }
    }
    return "";
  };

  const businessName = pick("name", "businessname", "title", "company");
  if (!businessName) return null;
  const category = pick("category", "type", "industry", "niche");

  return {
    source: "csv",
    sourceRef: pick("placeid", "id", "googleid"),
    businessName,
    niche: inferNiche(category, query),
    category,
    phone: pick("phone", "phonenumber", "mobile", "telephone"),
    email: pick("email", "email1", "contactemail"),
    address: pick("address", "fulladdress", "street"),
    city: pick("city", "town"),
    state: pick("state", "region", "province"),
    country: pick("country", "countrycode") || "NG",
    website: pick("website", "site", "url", "web"),
    rating: rating(pick("rating", "score", "totalscore")),
    reviews: num(pick("reviews", "reviewscount", "reviewcount")),
    latitude: num(pick("latitude", "lat")),
    longitude: num(pick("longitude", "lng", "lon")),
    raw: record,
  };
}

/* -------------------------------------------------------------------------- */
/* Dedupe                                                                    */
/* -------------------------------------------------------------------------- */

/** Stable key for spotting the same business arriving twice in one import —
 * once by provider id where there is one, otherwise by name + city. */
export function leadKey(input: ProspectInput): string {
  if (input.sourceRef) return `ref:${input.source}:${input.sourceRef}`;
  return `name:${input.businessName.toLowerCase().replace(/[^a-z0-9]/g, "")}|${input.city.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
}

export function dedupeLeads(inputs: ProspectInput[]): { unique: ProspectInput[]; duplicates: number } {
  const seen = new Map<string, ProspectInput>();
  let duplicates = 0;
  for (const input of inputs) {
    const key = leadKey(input);
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.set(key, input);
  }
  return { unique: [...seen.values()], duplicates };
}
