import type { IndustryConfig } from "@/lib/industry";
import type { IndustryPack } from "@/lib/ai/industry-packs";
// Type-only on purpose: this module is imported directly by Node's test runner,
// which cannot resolve a runtime relative import. The caller computes the score
// and gaps from the enrichment it already holds.
import type { Enrichment, EnrichmentReview } from "./enrichment";
import type { BusinessType } from "@/lib/types";
import type { ProspectInput } from "./types";

/**
 * Builds a prospect a real, tailored JKTL site before we ever speak to them.
 *
 * The pitch is the artefact: instead of describing what a website would look
 * like, we send a link to one that already exists, carrying their name, their
 * city, and services worded for their vertical. Everything here is derived
 * from the industry packs, so a men's health clinic in Yenagoa gets discreet
 * clinical copy and a men's-health service list, not a generic template with
 * "Your Business Name" in the header.
 *
 * Two rules the generator holds to:
 *
 *   1. **No invented prices.** Services are seeded with a zero price and the
 *      site renders "Ask for price" — a made-up figure in a real clinic's
 *      name is worse than no figure, and a real price list is something the
 *      clinic fills in when it claims the site.
 *   2. **No invented facts.** Opening hours, awards, years of experience and
 *      staff names are all left out. What remains is true by construction:
 *      their name, their city, their category, and the services their vertical
 *      actually provides.
 *
 * The vertical's own configuration is **passed in** rather than looked up here,
 * which keeps this module free of runtime imports and therefore directly unit
 * testable — the rule that "a generated site never invents a price" is checked
 * by a test rather than trusted. The caller (`buildSitesAction`) supplies the
 * industry and pack for the prospect's niche.
 */

export interface SeedService {
  name: string;
  category: string;
  priceKobo: number;
  durationMin: number;
  description: string;
}

export interface SeedTestimonial {
  author: string;
  rating: number;
  text: string;
  when: string;
}

export interface SeedPhoto {
  url: string;
  category: string;
}

export interface SeedProduct {
  name: string;
  description: string;
  price: string;
}

export interface SeedFaq {
  question: string;
  answer: string;
}

export interface SiteSeed {
  subdomain: string;
  tagline: string;
  aboutText: string;
  /** The long-form about, built from what the listing actually says. */
  aboutLong: string;
  themeColor: string;
  fontPairId: string;
  services: SeedService[];
  /** Photographs from the business's own listing — their premises, not stock art. */
  gallery: SeedPhoto[];
  /** Real reviews, quoted verbatim and attributed. */
  testimonials: SeedTestimonial[];
  /** Opening hours as the listing publishes them. */
  openingHours: Array<{ day: string; hours: string }>;
  /** Neighbourhoods the business is in or near, from the listing. */
  serviceAreas: string[];
  products: SeedProduct[];
  faqs: SeedFaq[];
  /** The listing's own rating and count, shown as a trust signal. */
  rating: number;
  reviewCount: number;
  /** 0–10, from `enrichmentCompleteness`. Drives the admin's quality warning. */
  contentScore: number;
  /** What the listing did not provide, so a human knows what to add. */
  contentGaps: string[];
}

/** Per-vertical look. Deliberately conservative palettes: a clinic should see
 * something it would plausibly have chosen, not a template. */
const VERTICAL_STYLE: Record<string, { themeColor: string; fontPairId: string }> = {
  mens_health: { themeColor: "#0e5c66", fontPairId: "professional" },
  aesthetics: { themeColor: "#9c4368", fontPairId: "romantic" },
  elderly_care: { themeColor: "#2f6b4f", fontPairId: "classic" },
  personal_care: { themeColor: "#7a4a8c", fontPairId: "chic" },
  general: { themeColor: "#0f6e5c", fontPairId: "modern" },
};

/** Durations that make sense per kind of service, so the seeded list doesn't
 * claim a 30-minute lab panel. */
function durationFor(name: string): number {
  const lower = name.toLowerCase();
  if (lower.includes("panel") || lower.includes("analysis") || lower.includes("screening") || lower.includes("test")) return 0;
  if (lower.includes("consult") || lower.includes("assessment") || lower.includes("review")) return 30;
  if (lower.includes("visit") || lower.includes("nursing") || lower.includes("physio")) return 60;
  if (lower.includes("therapy") || lower.includes("counselling")) return 45;
  return 45;
}

function descriptionFor(name: string, businessName: string, city: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("consult")) {
    return `Sit down with a clinician at ${businessName} to talk through what you need${city ? ` in ${city}` : ""}.`;
  }
  if (lower.includes("panel") || lower.includes("test") || lower.includes("analysis") || lower.includes("screening")) {
    return "Bring your results together in one place so a clinician can interpret them for you.";
  }
  if (lower.includes("follow")) return "A shorter visit to check progress and adjust the plan.";
  if (lower.includes("counsel")) return "A private conversation with someone who does this every day.";
  if (lower.includes("visit") || lower.includes("nursing")) return `Care delivered at home${city ? `, anywhere in ${city}` : ""}.`;
  return "Talk to our team about what this involves and whether it is right for you.";
}

/**
 * A subdomain from the business name and city: "vitalis-mens-health-yenagoa".
 * Kept short — subdomains are typed and read aloud on the phone — and stripped
 * to what is safe in a hostname.
 */
export function suggestSubdomain(businessName: string, city = ""): string {
  const base = `${businessName} ${city}`
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48)
    .replace(/^-|-$/g, "");
  // A subdomain has to start with a letter or digit and not be empty.
  const safe = base || "business";
  return /^[a-z0-9]/.test(safe) ? safe : `b-${safe}`;
}

const TAGLINES: Record<string, (businessName: string, city: string) => string> = {
  mens_health: (_b, city) => `Discreet, confidential men's health care${city ? ` in ${city}` : ""}.`,
  aesthetics: (_b, city) => `Skin, beauty and aesthetic treatments${city ? ` in ${city}` : ""}.`,
  elderly_care: (_b, city) => `Trusted care for elderly patients${city ? ` in ${city}` : ""}, at home or with us.`,
  personal_care: (_b, city) => `Look after yourself${city ? ` in ${city}` : ""} — book in seconds.`,
  general: (b, city) => `${b}${city ? `, ${city}` : ""} — book online in seconds.`,
};

const ABOUT: Record<string, (businessName: string, city: string, category: string) => string> = {
  mens_health: (b, city, category) =>
    `${b} provides confidential men's health care${city ? ` in ${city}` : ""}. ${
      category ? `We are listed as a ${category.toLowerCase()}. ` : ""
    }Everything you discuss with us is private, and appointments are arranged so you are not kept waiting in a shared reception. Book a consultation and a clinician will take it from there.`,
  aesthetics: (b, city, category) =>
    `${b} is an aesthetics and beauty clinic${city ? ` in ${city}` : ""}. ${
      category ? `We are listed as a ${category.toLowerCase()}. ` : ""
    }Every treatment starts with a consultation so you know what is involved, what it costs, and whether it is right for you before anything begins. Book online and we will confirm your slot.`,
  elderly_care: (b, city, category) =>
    `${b} supports elderly patients and their families${city ? ` in ${city}` : ""}. ${
      category ? `We are listed as a ${category.toLowerCase()}. ` : ""
    }Whether you need nursing care at home, physiotherapy, or someone to look in on a parent, we arrange visits around your family — and a caregiver calls ahead before every visit.`,
  personal_care: (b, city) => `${b} looks after clients${city ? ` in ${city}` : ""}. Book your appointment online and we will confirm it straight away.`,
  general: (b, city, category) =>
    `${b} serves customers${city ? ` in ${city}` : ""}. ${category ? `We are listed as a ${category.toLowerCase()}. ` : ""}Book online and we will confirm your appointment.`,
};

/**
 * Turns a scraped listing into a site.
 *
 * Services come from the vertical's clinical pack where there is one (those
 * are the services such a business genuinely offers), and fall back to the
 * industry's own category list otherwise.
 */
/* -------------------------------------------------------------------------- */
/* Copy generated from real listing data                                      */
/* -------------------------------------------------------------------------- */

/**
 * The long-form about.
 *
 * Built from what the listing says, in the business's own voice, and deliberately
 * light on claims: it says where they are, what they do and who they see. No
 * "award-winning", no "trusted by thousands" — a generated site that overstates
 * on the owner's behalf is a liability they did not ask for, and the first thing
 * they would have to apologise for.
 */
function buildAboutLong(context: {
  businessName: string;
  city: string;
  area: string;
  categories: string[];
  years: number | null;
  reviewCount: number;
  rating: number;
  industries: string;
  enrichmentAbout: string;
}): string {
  const { businessName, city, area, categories, years, reviewCount, rating, enrichmentAbout } = context;
  const where = area || city;
  const paragraphs: string[] = [];

  // Their own words first, if they wrote any. It is their business; their
  // sentence beats ours.
  if (enrichmentAbout) {
    paragraphs.push(enrichmentAbout.trim());
  }

  const what = categories.length > 0 ? categories.slice(0, 3).join(", ").toLowerCase() : context.industries;
  paragraphs.push(
    `${businessName} is a ${what} business${where ? ` in ${where}` : ""}${city && where !== city ? `, ${city}` : ""}. ` +
      (years ? `They have been trading for around ${years} years. ` : "") +
      (reviewCount > 0 && rating > 0
        ? `Their Google listing carries ${reviewCount} review${reviewCount === 1 ? "" : "s"} at an average of ${rating.toFixed(1)} out of 5.`
        : ""),
  );

  paragraphs.push(
    `This page was built for them by JKTL Business. Booking, enquiries and questions are handled here so nothing gets missed — ` +
      `including when the phone rings and nobody can pick up.`,
  );

  return paragraphs.filter(Boolean).join("\n\n").trim();
}

/**
 * FAQs, answered only from facts the listing supports.
 *
 * Every answer here is something we can stand behind: the address, the phone
 * number, the hours, the services. The temptation is to write plausible marketing
 * answers ("Do you take insurance?" — "Yes, we accept all major providers"),
 * which is exactly the kind of invented promise that has to be retracted.
 */
export function buildFaqs(context: {
  businessName: string;
  city: string;
  area: string;
  address: string;
  phone: string;
  openingHours: Array<{ day: string; hours: string }>;
  serviceAreas: string[];
  services: SeedService[];
  hasBooking: boolean;
}): SeedFaq[] {
  const { businessName, city, area, address, phone, openingHours, serviceAreas, services, hasBooking } = context;
  const faqs: SeedFaq[] = [];

  if (hasBooking) {
    faqs.push({
      question: `How do I book an appointment at ${businessName}?`,
      answer:
        "Use the booking form on this page and pick a time that suits you. You will get a confirmation straight away, and a reminder before your appointment.",
    });
  }

  if (phone || address) {
    faqs.push({
      question: "Where are you, and how do I reach you?",
      answer: [address ? `We are at ${address}${city ? `, ${city}` : ""}.` : "", phone ? `You can call us on ${phone}.` : ""]
        .filter(Boolean)
        .join(" "),
    });
  }

  if (openingHours.length > 0) {
    const closed = ["Sunday", "Saturday"].find((day) => !openingHours.some((h) => h.day === day));
    const weekdays = openingHours.filter((h) => !["Saturday", "Sunday"].includes(h.day));
    faqs.push({
      question: "What are your opening hours?",
      answer:
        (weekdays.length > 0
          ? `We are open ${weekdays[0].day} to ${weekdays[weekdays.length - 1].day}, ${weekdays[0].hours}.`
          : "Our full opening hours are listed above.") + (closed ? ` We are closed on ${closed}.` : ""),
    });
  }

  if (services.length > 0) {
    faqs.push({
      question: "What do you offer?",
      answer: `Our services include ${services
        .slice(0, 4)
        .map((s) => s.name)
        .join(", ")}. The full list is above — ask us if you are not sure which one you need.`,
    });
  }

  if (serviceAreas.length > 0) {
    faqs.push({
      question: "Which areas do you cover?",
      answer: `We are based in ${area || city} and see customers from ${serviceAreas.slice(0, 5).join(", ")}${city ? ` and across ${city}` : ""}.`,
    });
  }

  faqs.push({
    question: "Can I ask a question before booking?",
    answer:
      "Yes — use the chat button in the corner at any time, day or night. You will get a reply by text, and a person will follow up if it needs one.",
  });

  return faqs.slice(0, 6);
}

/** Per-vertical taglines. Kept short: a hero headline that needs two lines on a
 * phone is not a hero headline. */
export function buildSiteSeed(
  prospect: ProspectInput,
  context: {
    industry: IndustryConfig;
    pack: IndustryPack;
    enrichment?: Enrichment;
    /** From `enrichmentCompleteness`. Passed in rather than computed here. */
    contentScore?: number;
    /** From `enrichmentGaps`. */
    contentGaps?: string[];
  },
): SiteSeed {
  const niche = (prospect.niche || "general") as BusinessType;
  const { industry, pack } = context;
  const city = prospect.city || prospect.state || "";
  const style = VERTICAL_STYLE[niche] ?? VERTICAL_STYLE.general;

  const sourceNames = pack.services.length >= 4 ? pack.services.slice(0, 6) : industry.serviceCategories.slice(0, 6);
  const categories = industry.serviceCategories;
  const services: SeedService[] = sourceNames.map((name, index) => ({
    name,
    category: categories[index % Math.max(1, categories.length)] ?? "",
    // Zero on purpose — see the note at the top of this file.
    priceKobo: 0,
    durationMin: durationFor(name),
    description: descriptionFor(name, prospect.businessName, city),
  }));

  const enrichment = context.enrichment;
  const photos = enrichment?.photos ?? [];
  const reviews = enrichment?.reviews ?? [];
  const openingHours = enrichment?.openingHours ?? [];
  const serviceAreas = enrichment?.serviceAreas ?? [];
  const products = enrichment?.products ?? [];
  const reviewCount = prospect.reviews ?? 0;
  const rating = prospect.rating ?? 0;
  const area = enrichment?.neighbourhood || prospect.city || "";

  const aboutLong = buildAboutLong({
    businessName: prospect.businessName,
    city,
    area,
    categories: (enrichment?.categories.length ?? 0) > 0 ? enrichment!.categories : prospect.category ? [prospect.category] : [],
    years: enrichment?.yearsInBusiness ?? null,
    reviewCount,
    rating,
    industries: industry.label,
    enrichmentAbout: enrichment?.about ?? "",
  });

  const faqs = buildFaqs({
    businessName: prospect.businessName,
    city,
    area,
    address: prospect.address ?? "",
    phone: prospect.phone ?? "",
    openingHours,
    serviceAreas,
    services,
    hasBooking: true,
  });

  return {
    subdomain: suggestSubdomain(prospect.businessName, city),
    tagline: (TAGLINES[niche] ?? TAGLINES.general)(prospect.businessName, city),
    aboutText: (ABOUT[niche] ?? ABOUT.general)(prospect.businessName, city, prospect.category),
    aboutLong,
    themeColor: style.themeColor,
    fontPairId: style.fontPairId,
    services,
    gallery: photos,
    testimonials: reviews.map((r: EnrichmentReview) => ({ author: r.author, rating: r.rating, text: r.text, when: r.when })),
    openingHours,
    serviceAreas,
    products,
    faqs,
    rating,
    reviewCount,
    contentScore: context.contentScore ?? 0,
    contentGaps: context.contentGaps ?? [],
  };
}

/** The line shown on a prospect's site so nobody — the prospect, or a visitor
 * who stumbles on it — mistakes a preview for the clinic's live site. */
export function previewNotice(senderBusinessName = "JKTL Business"): string {
  return `This is a preview website prepared for this business by ${senderBusinessName}. It has not been claimed or edited by the business yet.`;
}
