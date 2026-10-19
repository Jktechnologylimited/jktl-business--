/**
 * Turning a scraped Google Maps listing into everything a website needs.
 *
 * Apify and Outscraper already return the photographs, the reviews, the opening
 * hours, the categories and the "about" text. The import was keeping only the
 * name, phone and website and throwing the rest away — which is why a generated
 * site looked like a template rather than *their* business.
 *
 * The rule running through this: **use their real content, and never invent a
 * claim.** A generated site that says "trusted by thousands" when the listing
 * shows eleven reviews is worse than no site — it is a lie in the customer's own
 * name, and they will be the one embarrassed by it. So every field here is either
 * something the listing said, or something derived arithmetically from it
 * (a rating, a review count, a price range), or nothing at all.
 *
 * Pure and dependency-free so the shaping of fourteen different provider field
 * names is unit tested rather than discovered in production.
 */

export interface EnrichmentReview {
  author: string;
  rating: number;
  text: string;
  when: string;
}

export interface EnrichmentPhoto {
  url: string;
  /** Free-form, from the listing: "Food & drink", "Interior", "By owner". */
  category: string;
}

export interface EnrichmentProduct {
  name: string;
  description: string;
  price: string;
}

export interface Enrichment {
  photos: EnrichmentPhoto[];
  reviews: EnrichmentReview[];
  openingHours: Array<{ day: string; hours: string }>;
  categories: string[];
  /** The business's own description, when the listing carries one. */
  about: string;
  /** Neighbourhoods served, derived from what the listing says it is near. */
  serviceAreas: string[];
  products: EnrichmentProduct[];
  /** "$", "$$", "$$$" as published. */
  priceLevel: string;
  /** The listing's own claim, kept verbatim rather than embellished. */
  yearsInBusiness: number | null;
  /** Extra phone numbers the listing carries. */
  extraPhones: string[];
  /** A structured address, when the provider splits it out. */
  postalCode: string;
  neighbourhood: string;
}

export const EMPTY_ENRICHMENT: Enrichment = {
  photos: [],
  reviews: [],
  openingHours: [],
  categories: [],
  about: "",
  serviceAreas: [],
  products: [],
  priceLevel: "",
  yearsInBusiness: null,
  extraPhones: [],
  postalCode: "",
  neighbourhood: "",
};

/** Photographs we will not put on a business site. */
const BAD_PHOTO = /(logo|icon|sprite|placeholder|1x1|pixel|tracking)/i;

function str(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const s = str(value);
    if (s) return s;
  }
  return "";
}

/** A usable URL, or empty. Accepts protocol-relative and bare hosts because
 * scrapers return all three. */
function url(value: unknown): string {
  const s = str(value);
  if (!s) return "";
  if (s.startsWith("//")) return `https:${s}`;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[\w-]+(\.[\w-]+)+\//.test(s)) return `https://${s}`;
  return "";
}

function clampRating(value: unknown): number {
  const n = typeof value === "number" ? value : Number.parseFloat(str(value));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(5, Math.round(n * 10) / 10);
}

/* -------------------------------------------------------------------------- */
/* Photos                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Photographs from a listing, in the order they should appear.
 *
 * Google returns these in a deliberate order — usually the exterior or the most
 * representative shot first — so the order is preserved rather than sorted. A
 * logo is dropped: it belongs in the header, not in a gallery, and it is almost
 * always an awkward aspect ratio that wrecks a grid.
 */
export function extractPhotos(source: Record<string, unknown>): EnrichmentPhoto[] {
  const candidates: unknown[] = [];

  const collect = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === "string") candidates.push(entry);
        else if (entry && typeof entry === "object") {
          const record = entry as Record<string, unknown>;
          candidates.push(firstString(record.imageUrl, record.url, record.photoUrl, record.src, record.link));
        }
      }
    }
  };

  collect(source.imageUrls);
  collect(source.images);
  collect(source.photos);
  collect(source.imageUrl);
  collect(source.photo);

  const out: EnrichmentPhoto[] = [];
  const seen = new Set<string>();

  // The category list lines up with the image list in the Apify actor, so a
  // photo can be labelled with what it shows.
  const categories = Array.isArray(source.imageCategories)
    ? (source.imageCategories as unknown[]).map((c) => str(c))
    : [];

  candidates.forEach((candidate, index) => {
    const href = url(candidate);
    if (!href || BAD_PHOTO.test(href)) return;
    if (seen.has(href)) return;
    seen.add(href);
    out.push({ url: href, category: categories[index] ?? "" });
  });

  // Twelve is a full gallery; beyond that the page weight hurts the visitor more
  // than the extra photographs help.
  return out.slice(0, 12);
}

/* -------------------------------------------------------------------------- */
/* Reviews                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The reviews worth putting on a website.
 *
 * Only reviews with something to say and a decent rating: a one-star rant is
 * real, but a business's own website is not the place to republish it, and a
 * five-star review with no text ("Nice") adds nothing a visitor can read. The
 * text is kept verbatim and attributed — paraphrasing a customer is not ours to
 * do.
 */
export function extractReviews(source: Record<string, unknown>, max = 6): EnrichmentReview[] {
  const raw = Array.isArray(source.reviews) ? (source.reviews as unknown[]) : [];
  const out: EnrichmentReview[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const text = firstString(record.text, record.reviewText, record.comment, record.snippet);
    const rating = clampRating(record.stars ?? record.rating ?? record.score);

    // A rating-only review cannot be shown — there is nothing to read, and the
    // stars alone make the section look padded.
    if (text.length < 40) continue;
    if (rating && rating < 4) continue;

    out.push({
      author: firstString(record.name, record.author, record.authorName, record.reviewerName) || "A customer",
      rating: rating || 5,
      text,
      when: firstString(record.publishedAtDate, record.publishedAt, record.when, record.relativeTime, record.date),
    });
    if (out.length >= max) break;
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/* Opening hours                                                              */
/* -------------------------------------------------------------------------- */

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * Opening hours, in a fixed week order.
 *
 * Providers return these three different ways: an array of "Monday: 9 AM–5 PM"
 * strings, an array of `{day, hours}` objects, or a single "Closed now · Opens 9
 * AM" fragment. All three are handled, and the day order is normalised so Sunday
 * sits last rather than wherever the provider happened to put it.
 */
export function extractOpeningHours(source: Record<string, unknown>): Array<{ day: string; hours: string }> {
  const raw = source.openingHours ?? source.workingHours ?? source.hours ?? source.openHours;
  const out: Array<{ day: string; hours: string }> = [];

  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (typeof entry === "string") {
        const [day, ...rest] = entry.split(":");
        const hours = rest.join(":").trim();
        const normalised = DAY_ORDER.find((d) => d.toLowerCase() === str(day).toLowerCase().trim());
        if (normalised && hours) out.push({ day: normalised, hours });
      } else if (entry && typeof entry === "object") {
        const record = entry as Record<string, unknown>;
        const day = firstString(record.day, record.dayOfWeek, record.name);
        const hours = firstString(record.hours, record.time, record.value, record.openClose);
        const normalised = DAY_ORDER.find((d) => d.toLowerCase() === day.toLowerCase());
        if (normalised && hours) out.push({ day: normalised, hours });
      }
    }
  }

  // Deduplicate (some providers repeat a day for split shifts) and order.
  const byDay = new Map<string, string>();
  for (const entry of out) byDay.set(entry.day, entry.hours);
  return DAY_ORDER.filter((day) => byDay.has(day)).map((day) => ({ day, hours: byDay.get(day)! }));
}

/* -------------------------------------------------------------------------- */
/* Products and services                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Menu items or products, when the listing carries them.
 *
 * Aesthetics and hair listings sometimes include a priced menu. Prices are kept
 * as strings because they come formatted in the local currency and an
 * interpretation into kobo is a business decision, not a parsing one.
 */
export function extractProducts(source: Record<string, unknown>, max = 12): EnrichmentProduct[] {
  const raw = source.menu ?? source.products ?? source.services ?? source.items;
  if (!Array.isArray(raw)) return [];

  const out: EnrichmentProduct[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const name = firstString(record.name, record.title, record.itemName);
    if (!name) continue;
    out.push({
      name,
      description: firstString(record.description, record.details, record.text),
      price: firstString(record.price, record.amount, record.cost),
    });
    if (out.length >= max) break;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Service areas                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Neighbourhoods the business serves.
 *
 * Taken from what the listing says about its own location — the neighbourhood,
 * the suburb, the borough, and the city's districts when a provider enumerates
 * them. Inventing a service area would be claiming coverage the business may not
 * have, which is the kind of claim that produces an angry phone call from a
 * customer outside it.
 */
export function extractServiceAreas(source: Record<string, unknown>, city: string): string[] {
  const out: string[] = [];
  const push = (value: unknown): void => {
    const s = str(value);
    if (s && s.length < 60 && s.toLowerCase() !== city.toLowerCase()) out.push(s);
  };

  for (const key of ["neighborhood", "neighbourhood", "suburb", "borough", "district", "locality", "area"]) {
    push(source[key]);
  }
  for (const key of ["nearbyAreas", "servedAreas", "serviceAreas", "areasServed"]) {
    const value = source[key];
    if (Array.isArray(value)) value.forEach(push);
  }

  // Deduplicate, keeping the order the listing gave.
  return [...new Set(out)].slice(0, 8);
}

/* -------------------------------------------------------------------------- */
/* The whole thing                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Everything worth keeping from a scraped listing.
 *
 * Accepts either an Apify place, an Outscraper row, or an already-normalised
 * object — the providers overlap on most keys and use different names for the
 * rest, so the extraction reads defensively rather than branching per provider.
 */
export function enrichmentFromRaw(raw: unknown, city = ""): Enrichment {
  if (!raw || typeof raw !== "object") return { ...EMPTY_ENRICHMENT };
  const source = raw as Record<string, unknown>;

  const yearsRaw = source.yearsInBusiness ?? source.years_in_business ?? source.establishedYear;
  const years = typeof yearsRaw === "number" && yearsRaw > 0 && yearsRaw < 200 ? yearsRaw : null;

  const extraPhones: string[] = [];
  const phoneList = source.phones ?? source.additionalPhones;
  if (Array.isArray(phoneList)) {
    for (const entry of phoneList) {
      const s = str(entry);
      if (s) extraPhones.push(s);
    }
  }

  return {
    photos: extractPhotos(source),
    reviews: extractReviews(source),
    openingHours: extractOpeningHours(source),
    categories: [
      ...new Set(
        [firstString(source.categoryName, source.category, source.type), ...(Array.isArray(source.categories) ? (source.categories as unknown[]).map(str) : [])].filter(
          Boolean,
        ),
      ),
    ],
    about: firstString(source.about, source.description, source.businessDescription, source.intro, source.summary).slice(0, 2000),
    serviceAreas: extractServiceAreas(source, city),
    products: extractProducts(source),
    priceLevel: firstString(source.priceLevel, source.price, source.priceRange),
    yearsInBusiness: years,
    extraPhones: extraPhones.slice(0, 3),
    postalCode: firstString(source.postalCode, source.zip, source.postcode),
    neighbourhood: firstString(source.neighborhood, source.neighbourhood, source.suburb),
  };
}

/** How much real content a listing gave us, 0–10. Drives the quality score and
 * decides whether a generated site is worth publishing or needs manual work. */
export function enrichmentCompleteness(enrichment: Enrichment): number {
  let score = 0;
  if (enrichment.photos.length >= 3) score += 3;
  else if (enrichment.photos.length > 0) score += 1;
  if (enrichment.reviews.length >= 3) score += 3;
  else if (enrichment.reviews.length > 0) score += 1;
  if (enrichment.openingHours.length >= 5) score += 2;
  else if (enrichment.openingHours.length > 0) score += 1;
  if (enrichment.about) score += 1;
  if (enrichment.products.length > 0) score += 1;
  return Math.min(10, score);
}

/** A plain description of what is missing, for the admin's generated-site view. */
export function enrichmentGaps(enrichment: Enrichment): string[] {
  const gaps: string[] = [];
  if (enrichment.photos.length === 0) gaps.push("no photographs on the listing");
  else if (enrichment.photos.length < 3) gaps.push(`only ${enrichment.photos.length} photograph(s)`);
  if (enrichment.reviews.length === 0) gaps.push("no usable reviews to quote");
  if (enrichment.openingHours.length === 0) gaps.push("no opening hours published");
  if (!enrichment.about) gaps.push("no description on the listing");
  return gaps;
}
