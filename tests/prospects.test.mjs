/**
 * Tests for the lead engine's pure core: the website audit's judgement, the
 * provider payload mappers, the generated site's content, and the outreach
 * email.
 *
 * These are the parts worth pinning because they are the parts that make
 * claims to a stranger on the internet: getting an audit wrong means telling a
 * clinic its website is bad when it isn't, and getting the email wrong means
 * sending one that could have gone to anybody. Both are expensive mistakes and
 * neither is caught by a type.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  auditNonSite,
  auditWebsite,
  classifyWebsite,
  isQualifiedLead,
  scoreWebsite,
  GOOD_SITE_THRESHOLD,
  POOR_SITE_THRESHOLD,
} from "../src/lib/prospects/audit.ts";

import {
  dedupeLeads,
  inferNiche,
  isApifyClosed,
  leadKey,
  mapApifyPlace,
  mapCsvRecord,
  mapOutscraperRow,
} from "../src/lib/prospects/providers.ts";

import { buildSiteSeed, previewNotice, suggestSubdomain } from "../src/lib/prospects/site-builder.ts";

import { auditHighlights, composeOutreachEmail, renderSubject, resolveSettings, sourceNoteFor, unsubscribeUrlFor, DEFAULT_SUBJECT_TEMPLATE } from "../src/lib/prospects/outreach.ts";

/* ------------------------------------------------------------------ */
/* Classifying what a Maps listing puts in its "website" field         */
/* ------------------------------------------------------------------ */

test("a Maps 'website' field is classified for what it really is", () => {
  assert.equal(classifyWebsite("").kind, "none");
  assert.equal(classifyWebsite("   ").kind, "none");
  assert.equal(classifyWebsite("facebook.com/vitalisclinic").kind, "social");
  assert.equal(classifyWebsite("https://www.instagram.com/vitalis/").kind, "social");
  assert.equal(classifyWebsite("linktr.ee/vitalis").kind, "social");
  assert.equal(classifyWebsite("wa.me/2348030000000").kind, "social");
  assert.equal(classifyWebsite("vitalis.business.site").kind, "builder");
  assert.equal(classifyWebsite("sites.google.com/view/vitalis").kind, "builder");
  assert.equal(classifyWebsite("yelp.com/biz/vitalis").kind, "directory");
  assert.equal(classifyWebsite("https://maps.google.com/?cid=123").kind, "directory");
  assert.equal(classifyWebsite("vitalisclinic.com").kind, "site");
  assert.equal(classifyWebsite("https://vitalisclinic.com.ng/book").kind, "site");
});

test("a 'website' that is not a URL at all is not treated as one", () => {
  // Listings sometimes carry a phone number or a note in that column.
  assert.equal(classifyWebsite("0803 441 2291").kind, "invalid");
  assert.equal(classifyWebsite("Call for details").kind, "invalid");
});

test("a bare domain gets a scheme rather than being rejected", () => {
  const classified = classifyWebsite("vitalisclinic.com");
  assert.equal(classified.kind, "site");
  assert.equal(classified.url, "https://vitalisclinic.com");
});

/* ------------------------------------------------------------------ */
/* The audit's judgement                                              */
/* ------------------------------------------------------------------ */

function healthySignals(overrides = {}) {
  return {
    url: "https://vitalisclinic.com",
    reachable: true,
    statusCode: 200,
    https: true,
    finalUrl: "https://vitalisclinic.com",
    loadMs: 900,
    bytes: 180_000,
    hasViewport: true,
    title: "Vitalis Men's Health Clinic, Yenagoa",
    hasMetaDescription: true,
    hasOpenGraph: true,
    scriptCount: 12,
    hasBookingCue: true,
    hasPhoneCue: true,
    platform: "wordpress",
    parked: false,
    ...overrides,
  };
}

test("a healthy site scores well and is not a lead", () => {
  const result = scoreWebsite(healthySignals());
  assert.equal(result.score, 100);
  assert.equal(result.status, "good");
  assert.equal(isQualifiedLead(result), false);
});

test("no website at all is the best possible lead", () => {
  const result = scoreWebsite(healthySignals({ url: "" }));
  assert.equal(result.status, "none");
  assert.equal(result.score, 0);
  assert.equal(isQualifiedLead(result), true);
});

test("an unreachable site is a lead, and says why", () => {
  const result = scoreWebsite(healthySignals({ reachable: false, statusCode: 503, loadMs: null }));
  assert.equal(result.status, "unreachable");
  assert.equal(isQualifiedLead(result), true);
  assert.ok(result.findings.some((f) => f.code === "unreachable"));
});

test("the penalties reflect what actually loses patients here", () => {
  // A site with no mobile layout and no way to book is the archetypal lead in
  // this market. It qualifies through the critical faults rather than the
  // total, which is the point: three big faults should not need to add up to
  // more than twenty small ones.
  const bad = scoreWebsite(healthySignals({ hasViewport: false, hasBookingCue: false, hasPhoneCue: false }));
  assert.equal(isQualifiedLead(bad), true);
  assert.ok(bad.findings.some((f) => f.code === "no_mobile"));
  assert.ok(bad.findings.some((f) => f.code === "no_booking"));
  assert.ok(bad.findings.some((f) => f.code === "no_phone"));
  assert.ok(bad.score < 100, "faults must actually cost score");

  // A missing padlock is treated as a lead on its own: in this market
  // "Not secure" in the address bar costs bookings, so it is a real reason to
  // offer a rebuild even though the rest of the site may be fine.
  const noHttps = scoreWebsite(healthySignals({ https: false }));
  assert.equal(noHttps.score, 78);
  assert.equal(noHttps.status, "ok", "the health label stays honest");
  assert.equal(isQualifiedLead(noHttps), true, "but the decision is still that they are a lead");
});

test("a heavy, script-laden site is a lead even with everything else in place", () => {
  const heavy = scoreWebsite(healthySignals({ bytes: 7_500_000, scriptCount: 140, loadMs: 8_000 }));
  assert.ok(heavy.score < POOR_SITE_THRESHOLD, `expected poor, got ${heavy.score}`);
  assert.ok(heavy.findings.some((f) => f.code === "huge"));
  assert.ok(heavy.findings.some((f) => f.code === "script_heavy"));
  assert.ok(heavy.findings.some((f) => f.code === "very_slow"));
});

test("critical faults are marked as such, so qualification cannot drift from the score", () => {
  const bad = scoreWebsite(healthySignals({ hasViewport: false, https: false, hasBookingCue: false }));
  const critical = bad.findings.filter((f) => f.critical).map((f) => f.code);
  assert.ok(critical.includes("no_mobile"));
  assert.ok(critical.includes("no_https"));
  assert.ok(critical.includes("no_booking"));

  // …and the minor findings are not marked critical.
  const minor = scoreWebsite(healthySignals({ hasOpenGraph: false }));
  assert.equal(minor.findings.some((f) => f.critical), false);
  assert.equal(isQualifiedLead(minor), false);
});

test("a parked domain is never mistaken for a working site", () => {
  const parked = scoreWebsite(healthySignals({ parked: true }));
  assert.ok(parked.score <= 40);
  assert.ok(parked.findings.some((f) => f.code === "parked"));
  assert.equal(isQualifiedLead(parked), true);
});

test("a social page is a lead, but the copy never calls it a bad website", () => {
  const social = auditNonSite("social");
  assert.equal(social.status, "social_only");
  assert.equal(isQualifiedLead(social), true);
  assert.ok(/social media page/i.test(social.summary));
  assert.ok(!/poor|bad/i.test(social.summary), "a Facebook page is not a 'bad website'");
});

test("the score is a health label and qualification is the decision", () => {
  assert.ok(POOR_SITE_THRESHOLD < GOOD_SITE_THRESHOLD);

  // A healthy site: good label, not a lead.
  const healthy = scoreWebsite(healthySignals());
  assert.equal(healthy.status, "good");
  assert.equal(isQualifiedLead(healthy), false);

  // One critical fault can leave a decent score but still make them a lead —
  // which is exactly what a bare threshold would get wrong.
  const noMobile = scoreWebsite(healthySignals({ hasViewport: false }));
  assert.ok(noMobile.score >= POOR_SITE_THRESHOLD, `score should stay respectable, got ${noMobile.score}`);
  assert.equal(isQualifiedLead(noMobile), true);

  // Small faults in quantity are a lead through the score instead.
  const manySmall = scoreWebsite(
    healthySignals({ title: "", hasMetaDescription: false, hasOpenGraph: false, scriptCount: 60, loadMs: 4_000 }),
  );
  assert.ok(manySmall.score < POOR_SITE_THRESHOLD);
  assert.equal(isQualifiedLead(manySmall), true);
});

test("the audit summary names the worst problems, worst first", () => {
  const result = scoreWebsite(healthySignals({ hasViewport: false, https: false, hasBookingCue: false }));
  assert.ok(result.summary.includes(String(result.score)));
  // These labels are read by a business owner, not a developer.
  assert.ok(/phone|padlock|book/i.test(result.summary), result.summary);
  for (const finding of result.findings) {
    assert.ok(!finding.label.includes("<"), `finding labels must be human: ${finding.label}`);
  }
});

test("auditing a site with no URL never attempts a fetch", async () => {
  let called = false;
  const result = await auditWebsite("", {
    fetchImpl: async () => {
      called = true;
      throw new Error("should not be called");
    },
  });
  assert.equal(called, false);
  assert.equal(result.status, "none");
});

test("auditing a social page never attempts a fetch either", async () => {
  let called = false;
  const result = await auditWebsite("https://facebook.com/vitalis", {
    fetchImpl: async () => {
      called = true;
      throw new Error("should not be called");
    },
  });
  assert.equal(called, false);
  assert.equal(result.status, "social_only");
});

test("a network failure is recorded as an unreachable lead, not thrown", async () => {
  const result = await auditWebsite("https://vitalisclinic.com", {
    fetchImpl: async () => {
      throw new Error("ENOTFOUND");
    },
  });
  assert.equal(result.status, "unreachable");
  assert.equal(isQualifiedLead(result), true);
});

test("a real page is measured from its markup", async () => {
  const html = `<!doctype html><html><head><title>Vitalis Men's Health</title>
    <meta name="description" content="Confidential men's health care in Yenagoa.">
    <meta property="og:title" content="Vitalis">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    </head><body><a href="https://wa.me/2348030000000">WhatsApp us</a>${"<script src='a.js'></script>".repeat(60)}</body></html>`;

  const result = await auditWebsite("https://vitalisclinic.com", {
    fetchImpl: async () =>
      new Response(html, {
        status: 200,
        headers: { "content-length": String(html.length) },
      }),
  });

  // Everything present, so only the script count is held against it.
  assert.ok(result.findings.some((f) => f.code === "many_scripts"), JSON.stringify(result.findings));
  assert.ok(result.score >= 85, `expected a healthy score, got ${result.score}`);
});

test("a page missing the mobile viewport is caught from its markup", async () => {
  const html = `<!doctype html><html><head><title>Vitalis</title></head><body>Call 0803 441 2291</body></html>`;
  const result = await auditWebsite("https://vitalisclinic.com", {
    fetchImpl: async () => new Response(html, { status: 200 }),
  });
  assert.ok(result.findings.some((f) => f.code === "no_mobile"), JSON.stringify(result.findings));
  assert.equal(isQualifiedLead(result), true);
});

/* ------------------------------------------------------------------ */
/* Provider mappers                                                    */
/* ------------------------------------------------------------------ */

test("an Apify place maps onto the shared shape", () => {
  const place = {
    title: "Vitalis Men's Health Clinic",
    placeId: "ChIJ1234567890",
    categoryName: "Men's health clinic",
    address: "14 Swali Road, Yenagoa",
    city: "Yenagoa",
    state: "Bayelsa",
    countryCode: "NG",
    phone: "+234 803 441 2291",
    website: "vitalisclinic.com",
    emails: ["hello@vitalisclinic.com"],
    totalScore: 4.7,
    reviewsCount: 128,
    location: { lat: 4.9247, lng: 6.2642 },
  };

  const mapped = mapApifyPlace(place, "men's health clinic");
  assert.ok(mapped);
  assert.equal(mapped.businessName, "Vitalis Men's Health Clinic");
  assert.equal(mapped.niche, "mens_health", "the category decides the vertical");
  assert.equal(mapped.sourceRef, "ChIJ1234567890", "the place id is the dedupe key");
  assert.equal(mapped.email, "hello@vitalisclinic.com");
  assert.equal(mapped.rating, 4.7);
  assert.equal(mapped.reviews, 128);
  assert.equal(mapped.latitude, 4.9247);
  assert.equal(mapped.country, "NG");
});

test("Apify ratings arriving as '4,5' are still parsed", () => {
  const mapped = mapApifyPlace({ title: "Clinic", totalScore: "4,5", reviewsCount: "12 reviews" });
  assert.equal(mapped?.rating, 4.5);
  assert.equal(mapped?.reviews, 12);
});

test("permanently closed businesses are dropped, not emailed", () => {
  assert.equal(isApifyClosed({ title: "Gone", permanentlyClosed: true }), true);
  assert.equal(isApifyClosed({ title: "Gone", temporarilyClosed: true }), true);
  assert.equal(isApifyClosed({ title: "Open" }), false);
});

test("an Apify item with no name is skipped rather than stored blank", () => {
  assert.equal(mapApifyPlace({ placeId: "abc" }), null);
});

test("an Outscraper row maps onto the same shape", () => {
  const mapped = mapOutscraperRow(
    {
      name: "Glow Aesthetics",
      place_id: "ChIJoutscraper1",
      category: "Medical spa",
      full_address: "2 Aba Road, Port Harcourt",
      city: "Port Harcourt",
      state: "Rivers",
      phone: "0803 000 1111",
      site: "glowaesthetics.ng",
      email_1: "info@glowaesthetics.ng",
      rating: 4.9,
      reviews: 76,
      latitude: 4.8156,
      longitude: 7.0498,
    },
    "aesthetic clinic",
  );

  assert.ok(mapped);
  assert.equal(mapped.niche, "aesthetics");
  assert.equal(mapped.sourceRef, "ChIJoutscraper1");
  assert.equal(mapped.email, "info@glowaesthetics.ng");
  assert.equal(mapped.city, "Port Harcourt");
});

test("an Outscraper row for a permanently closed business is dropped", () => {
  assert.equal(mapOutscraperRow({ name: "Gone", business_status: "CLOSED_PERMANENTLY" }), null);
  assert.ok(mapOutscraperRow({ name: "Open", business_status: "OPERATIONAL" }));
});

test("outscraper stores no website as empty, which is the best lead", () => {
  const mapped = mapOutscraperRow({ name: "No Web Clinic" });
  assert.ok(mapped);
  assert.equal(mapped.website, "");
  assert.equal(classifyWebsite(mapped.website).kind, "none");
});

test("a CSV row maps by header name, however it is written", () => {
  const mapped = mapCsvRecord({
    "Business Name": "Elder Care Plus",
    Category: "Home nursing",
    Phone: "0805 111 2222",
    Website: "",
    City: "Lagos",
    Email: "hello@eldercareplus.ng",
  });
  assert.ok(mapped);
  assert.equal(mapped.businessName, "Elder Care Plus");
  assert.equal(mapped.niche, "elderly_care");
  assert.equal(mapped.email, "hello@eldercareplus.ng");
  assert.equal(mapped.source, "csv");
});

test("a CSV row with no business name is skipped", () => {
  assert.equal(mapCsvRecord({ phone: "0805 111 2222" }), null);
});

test("niche inference picks the more specific vertical", () => {
  assert.equal(inferNiche("Men's health clinic"), "mens_health");
  assert.equal(inferNiche("Urologist"), "mens_health");
  assert.equal(inferNiche("Medical spa"), "aesthetics");
  assert.equal(inferNiche("Beauty salon"), "aesthetics");
  assert.equal(inferNiche("Nursing home"), "elderly_care");
  assert.equal(inferNiche("Home care service"), "elderly_care");
  assert.equal(inferNiche("Barber shop"), "personal_care");
  assert.equal(inferNiche("Car wash"), "");
  // The query is a fallback when the category is vague.
  assert.equal(inferNiche("Clinic", "men's health clinic near me"), "mens_health");
});

test("re-importing the same search does not duplicate businesses", () => {
  const a = mapApifyPlace({ title: "Vitalis", placeId: "p1", website: "" });
  const b = mapApifyPlace({ title: "Vitalis", placeId: "p1", website: "" });
  const c = mapApifyPlace({ title: "Glow", placeId: "p2", website: "" });
  const { unique, duplicates } = dedupeLeads([a, b, c]);
  assert.equal(unique.length, 2);
  assert.equal(duplicates, 1);
});

test("businesses without a provider id dedupe on name and city", () => {
  const a = mapCsvRecord({ name: "Bright Smile Dental", city: "Lagos" });
  const b = mapCsvRecord({ name: "bright  smile dental", city: "lagos" });
  assert.equal(leadKey(a), leadKey(b), "case and punctuation must not create a second lead");
  assert.equal(dedupeLeads([a, b]).unique.length, 1);
});

/* ------------------------------------------------------------------ */
/* Generated sites                                                     */
/* ------------------------------------------------------------------ */

test("a subdomain is a usable hostname", () => {
  assert.equal(suggestSubdomain("Vitalis Men's Health Clinic", "Yenagoa"), "vitalis-mens-health-clinic-yenagoa");
  assert.equal(suggestSubdomain("Glow Aesthetics & Spa", "Port Harcourt"), "glow-aesthetics-spa-port-harcourt");
  assert.ok(!suggestSubdomain("...", "").startsWith("-"), "a subdomain must not start with a dash");
  assert.ok(suggestSubdomain("", "").length > 0);
  assert.ok(suggestSubdomain("A".repeat(90), "Lagos").length <= 48);
});

/** A stand-in for a vertical's config, so this suite stays free of app-alias
 * imports. The properties being tested — prices are never invented, copy is
 * never fabricated, the service list is used — hold for any input. */
const MENS_CONTEXT = {
  industry: {
    id: "mens_health",
    label: "Men's health clinic",
    productName: "JKTL Business",
    tagline: "",
    staffLabel: "Clinician",
    staffLabelPlural: "Clinicians",
    bookingLabel: "Appointment",
    bookingLabelPlural: "Appointments",
    catalogLabel: "Services",
    serviceCategories: ["Consultation", "Sexual health", "Hormonal therapy", "Lab & diagnostics", "Fertility", "Counselling", "Follow-up"],
    productCategories: [],
    modules: {},
    nav: { primary: [], more: [] },
  },
  pack: {
    id: "mens_health",
    label: "Men's health",
    summary: "",
    businessTypes: ["mens_health"],
    persona: "",
    tone: [],
    privacy: "",
    neverSay: [],
    services: ["Confidential consultation", "Testosterone & hormone panel", "Erectile dysfunction assessment", "Fertility & semen analysis", "STI screening & treatment", "Counselling & follow-up"],
    defaultGreeting: "",
    returningGreeting: "",
    smsTemplate: "",
    intakeFields: [],
    bookingPolicy: "",
    triageRules: [],
  },
};

const GENERAL_CONTEXT = {
  industry: { ...MENS_CONTEXT.industry, id: "general", serviceCategories: ["Appointment", "Consultation", "Enquiry"] },
  pack: { ...MENS_CONTEXT.pack, id: "general", services: ["Appointment", "Consultation", "Enquiry"] },
};

test("a generated site is tailored to the vertical", () => {
  const mens = buildSiteSeed({
    source: "apify",
    sourceRef: "p1",
    businessName: "Vitalis Men's Health",
    niche: "mens_health",
    category: "Men's health clinic",
    phone: "0803 441 2291",
    email: "",
    address: "14 Swali Road",
    city: "Yenagoa",
    state: "Bayelsa",
    country: "NG",
    website: "",
    rating: null,
    reviews: null,
    latitude: null,
    longitude: null,
  }, MENS_CONTEXT);

  assert.ok(mens.tagline.toLowerCase().includes("men's health"));
  assert.ok(mens.aboutText.includes("Vitalis Men's Health"));
  assert.ok(mens.aboutText.includes("Yenagoa"));
  assert.ok(mens.services.length >= 4);
  assert.ok(mens.services.some((s) => /consult/i.test(s.name)));
  assert.equal(mens.themeColor, "#0e5c66");

  // Deterministic: the same lead always produces the same site, so re-running
  // the builder is not a surprise.
  assert.deepEqual(buildSiteSeed({
    source: "apify",
    sourceRef: "p1",
    businessName: "Vitalis Men's Health",
    niche: "mens_health",
    category: "Men's health clinic",
    phone: "0803 441 2291",
    email: "",
    address: "14 Swali Road",
    city: "Yenagoa",
    state: "Bayelsa",
    country: "NG",
    website: "",
    rating: null,
    reviews: null,
    latitude: null,
    longitude: null,
  }, MENS_CONTEXT), mens);
});

test("a generated site never invents prices or opening hours", () => {
  for (const niche of ["mens_health", "aesthetics", "elderly_care", "general"]) {
    const seed = buildSiteSeed({
      source: "csv",
      sourceRef: "",
      businessName: "Test Business",
      niche,
      category: "",
      phone: "",
      email: "",
      address: "",
      city: "Lagos",
      state: "Lagos",
      country: "NG",
      website: "",
      rating: null,
      reviews: null,
      latitude: null,
      longitude: null,
    }, GENERAL_CONTEXT);

    for (const service of seed.services) {
      assert.equal(service.priceKobo, 0, `${niche}/${service.name}: a price we invented is worse than no price`);
    }
    const copy = `${seed.tagline} ${seed.aboutText} ${seed.services.map((s) => s.description).join(" ")}`.toLowerCase();
    for (const invented of ["₦", "ngn ", "years of experience", "monday to", "award", "best in"]) {
      assert.ok(!copy.includes(invented), `${niche}: generated copy must not invent "${invented}"`);
    }
  }
});

test("the preview notice says what the site is", () => {
  const notice = previewNotice("JKTL Business");
  assert.ok(notice.includes("JKTL Business"));
  assert.ok(/preview/i.test(notice) && /not been claimed/i.test(notice));
});

/* ------------------------------------------------------------------ */
/* Outreach email                                                      */
/* ------------------------------------------------------------------ */

test("the subject carries both business names, theirs first", () => {
  const subject = renderSubject(DEFAULT_SUBJECT_TEMPLATE, { theirBusiness: "Vitalis Men's Health", myBusiness: "JKTL Business" });
  assert.equal(subject, "Vitalis Men's Health — JKTL Business built you a new website");
  assert.ok(subject.includes("Vitalis Men's Health"));
  assert.ok(subject.includes("JKTL Business"));

  // Their name first is the point: a subject leading with the sender reads as an
  // advert and gets deleted unread, whereas a recipient scanning their inbox
  // stops at their own business name.
  assert.ok(
    subject.indexOf("Vitalis Men's Health") < subject.indexOf("JKTL Business"),
    "the recipient's business name must come before ours",
  );
});

test("a subject template with only one placeholder still works", () => {
  assert.equal(renderSubject("{their_business}, we built you a website", { theirBusiness: "Glow Spa", myBusiness: "JKTL" }), "Glow Spa, we built you a website");
});

test("unknown placeholders are stripped, and spacing is tidied", () => {
  const subject = renderSubject("{their_business}  {nonsense} website", { theirBusiness: "Glow Spa", myBusiness: "JKTL" });
  assert.equal(subject, "Glow Spa website");
  assert.ok(!subject.includes("{"));
  assert.ok(!subject.includes("  "));
});

test("an empty template falls back to a usable subject rather than sending blank", () => {
  assert.equal(renderSubject("", { theirBusiness: "Glow Spa", myBusiness: "JKTL Business" }), "JKTL Business built Glow Spa a new website");
  assert.equal(renderSubject("   ", { theirBusiness: "Glow Spa", myBusiness: "JKTL" }).length > 10, true);
});

test("only the most serious findings are quoted, at most three", () => {
  const audit = scoreWebsite({
    url: "https://x.com",
    reachable: true,
    statusCode: 200,
    https: false,
    finalUrl: "http://x.com",
    loadMs: 9_000,
    bytes: 8_000_000,
    hasViewport: false,
    title: "",
    hasMetaDescription: false,
    hasOpenGraph: false,
    scriptCount: 150,
    hasBookingCue: false,
    hasPhoneCue: false,
    platform: "unknown",
    parked: false,
  });
  const highlights = auditHighlights(audit);
  assert.ok(highlights.length > 0 && highlights.length <= 3);
  // Nothing trivial leaks into the email.
  for (const h of highlights) {
    assert.ok(!/preview image|page title is too short/i.test(h), `trivial finding quoted: ${h}`);
  }
});

test("a business with no website gets no invented audit complaints", () => {
  const noSite = scoreWebsite(healthySignals({ url: "" }));
  assert.equal(noSite.status, "none");
  // The email's opening line already says there is no website, so listing it
  // again as a fault would read as padding.
  assert.deepEqual(auditHighlights(noSite), []);
});

function emailFor(overrides = {}) {
  return composeOutreachEmail({
    prospect: {
      businessName: "Vitalis Men's Health",
      city: "Yenagoa",
      state: "Bayelsa",
      website: "",
      category: "Men's health clinic",
      niche: "mens_health",
      unsubscribeToken: "tok_abc123",
    },
    audit: null,
    siteUrl: "https://jktl.com.ng/sites/vitalis-mens-health-yenagoa",
    theirBusiness: "Vitalis Men's Health",
    myBusiness: "JKTL Business",
    includeAudit: true,
    calendarLink: "",
    subjectTemplate: DEFAULT_SUBJECT_TEMPLATE,
    unsubscribeUrl: unsubscribeUrlFor("https://jktl.com.ng", "tok_abc123"),
    sourceNote: sourceNoteFor("JKTL Business"),
    ...overrides,
  });
}

test("the email names the business, us, and links to the site that exists", () => {
  const email = emailFor();
  assert.ok(email.subject.includes("Vitalis Men's Health"));
  assert.ok(email.subject.includes("JKTL Business"));
  assert.ok(email.html.includes("Vitalis Men's Health"));
  assert.ok(email.html.includes("Yenagoa"));
  assert.ok(email.html.includes("https://jktl.com.ng/sites/vitalis-mens-health-yenagoa"));
  assert.ok(email.text.includes("Vitalis Men's Health"));
});

test("every outreach email carries a working unsubscribe link and says why it arrived", () => {
  const email = emailFor();
  const url = "https://jktl.com.ng/unsubscribe?token=tok_abc123";
  assert.ok(email.html.includes(url), "the html must carry the unsubscribe link");
  assert.ok(email.text.includes(url), "the plain-text alternative must too");
  assert.ok(/Google Maps/i.test(email.html), "the email must explain how the address was found");
  assert.ok(/unsubscribe/i.test(email.html));
});

test("a business with no website is never told its website is faulty", () => {
  const email = emailFor({
    audit: { status: "none", score: 0, findings: [{ code: "no_website", label: "No website listed at all", weight: 100 }], summary: "" },
  });
  assert.ok(/no website listed/i.test(email.text));
  assert.ok(!/your website could be doing more/i.test(email.text), "don't claim a site exists when it doesn't");
});

test("a poor website produces the specific observations, and they are the audit's own", () => {
  const audit = scoreWebsite({
    url: "https://x.com",
    reachable: true,
    statusCode: 200,
    https: false,
    finalUrl: "http://x.com",
    loadMs: 1_000,
    bytes: 100_000,
    hasViewport: false,
    title: "Clinic",
    hasMetaDescription: true,
    hasOpenGraph: true,
    scriptCount: 10,
    hasBookingCue: true,
    hasPhoneCue: true,
    platform: "unknown",
    parked: false,
  });
  const email = emailFor({ audit, prospect: { businessName: "X", city: "Lagos", state: "", website: "x.com", category: "", niche: "", unsubscribeToken: "t" } });
  assert.ok(email.text.includes("Not built for phones"), email.text);
  assert.ok(email.text.includes("Not secure") || email.text.includes("padlock"), email.text);
});

test("includeAudit=false drops the complaints but keeps the site and the link", () => {
  const audit = scoreWebsite({
    url: "https://x.com", reachable: true, statusCode: 200, https: false, finalUrl: "http://x.com",
    loadMs: 1_000, bytes: 100_000, hasViewport: false, title: "Clinic", hasMetaDescription: true,
    hasOpenGraph: true, scriptCount: 10, hasBookingCue: true, hasPhoneCue: true, platform: "unknown", parked: false,
  });
  const email = emailFor({ audit, includeAudit: false });
  assert.ok(!email.text.includes("Not built for phones"));
  assert.ok(email.text.includes("/sites/vitalis-mens-health-yenagoa"));
});

test("the unsubscribe URL carries only the token", () => {
  const url = unsubscribeUrlFor("https://jktl.com.ng/", "tok_abc123");
  assert.equal(url, "https://jktl.com.ng/unsubscribe?token=tok_abc123");
  assert.ok(!url.includes("@"), "an email address must never appear in the URL");
});

test("outreach settings fall back to safe defaults", () => {
  const settings = resolveSettings(null);
  assert.ok(settings.dailySendCap > 0, "a cap must always exist");
  assert.equal(settings.subjectTemplate, DEFAULT_SUBJECT_TEMPLATE);
  assert.equal(settings.includeAudit, true);

  // A zero or negative cap from a bad row must not disable the guardrail.
  assert.ok(resolveSettings({ dailySendCap: 0 }).dailySendCap > 0);
  assert.ok(resolveSettings({ dailySendCap: -5 }).dailySendCap > 0);
});
