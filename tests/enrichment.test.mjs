/**
 * Tests for lead enrichment and email validation.
 *
 * Two things are being protected here.
 *
 * **Honesty.** A generated website is published in the business's own name. If
 * the generator invents a testimonial, a years-in-business figure or a service
 * area, the owner is the one who has to apologise for it — and they never asked
 * for it. So the extraction is tested for what it *refuses* to produce as much as
 * for what it produces.
 *
 * **A sending domain.** Validation exists to keep hard bounces under the roughly
 * 2% that gets a domain throttled. An address that should have been caught and
 * was not is a mark against the domain, and enough of them take the transactional
 * mail — receipts, booking confirmations — down with them.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  EMPTY_ENRICHMENT,
  enrichmentCompleteness,
  enrichmentFromRaw,
  enrichmentGaps,
  extractOpeningHours,
  extractPhotos,
  extractProducts,
  extractReviews,
  extractServiceAreas,
} from "../src/lib/prospects/enrichment.ts";

import {
  checkEmailOffline,
  checkDomainMail,
  combineEmailChecks,
  domainOf,
  emailPriority,
  isSendable,
  isSyntacticallyValid,
  normalizeEmail,
  uniqueDomains,
} from "../src/lib/prospects/email-validation.ts";

/* ========================================================================== */
/* Photos                                                                     */
/* ========================================================================== */

test("photos come from every shape a provider uses", () => {
  const fromStrings = extractPhotos({ imageUrls: ["https://a/1.jpg", "https://a/2.jpg"] });
  assert.equal(fromStrings.length, 2);

  const fromObjects = extractPhotos({ images: [{ imageUrl: "https://a/3.jpg" }, { url: "https://a/4.jpg" }] });
  assert.deepEqual(fromObjects.map((p) => p.url), ["https://a/3.jpg", "https://a/4.jpg"]);

  // A bare host gets a scheme; a protocol-relative URL keeps https.
  assert.equal(extractPhotos({ imageUrls: ["//cdn.x/1.jpg"] })[0].url, "https://cdn.x/1.jpg");
  assert.equal(extractPhotos({ imageUrls: ["cdn.x/1.jpg"] })[0].url, "https://cdn.x/1.jpg");
});

test("a logo is kept out of the gallery", () => {
  // A logo in a photo grid is an awkward aspect ratio that wrecks the layout, and
  // it belongs in the header — where it is already shown.
  const photos = extractPhotos({ imageUrls: ["https://a/logo.png", "https://a/shop-front.jpg", "https://a/1x1.gif"] });
  assert.deepEqual(photos.map((p) => p.url), ["https://a/shop-front.jpg"]);
});

test("duplicate photos are collapsed and the order is preserved", () => {
  // Google returns images in a deliberate order — usually the most
  // representative first — so sorting them would lose the best hero shot.
  const photos = extractPhotos({ imageUrls: ["https://a/b.jpg", "https://a/a.jpg", "https://a/b.jpg"] });
  assert.deepEqual(photos.map((p) => p.url), ["https://a/b.jpg", "https://a/a.jpg"]);
});

test("photo categories line up with the photos", () => {
  const photos = extractPhotos({
    imageUrls: ["https://a/1.jpg", "https://a/2.jpg"],
    imageCategories: ["Interior", "Exterior"],
  });
  assert.deepEqual(photos.map((p) => p.category), ["Interior", "Exterior"]);
});

test("a listing with no photos yields none, and does not throw", () => {
  for (const input of [{}, { imageUrls: null }, { imageUrls: "not-an-array" }, { imageUrls: [] }]) {
    assert.deepEqual(extractPhotos(input), []);
  }
});

/* ========================================================================== */
/* Reviews                                                                    */
/* ========================================================================== */

test("only reviews with something to say are used", () => {
  const reviews = extractReviews({
    reviews: [
      { name: "Ada", stars: 5, text: "The team was professional and the clinic was spotless. Highly recommend." },
      { name: "Bob", stars: 5, text: "Nice" }, // nothing to read
      { name: "Chidi", stars: 5, text: "Excellent service from start to finish, I will definitely be coming back again." },
    ],
  });
  assert.equal(reviews.length, 2, "a rating-only review makes the section look padded");
  assert.ok(reviews.every((r) => r.text.length >= 40));
});

test("a poor review is not republished, but it is not invented either", () => {
  const reviews = extractReviews({
    reviews: [
      { name: "Angry", stars: 2, text: "Terrible experience, I waited two hours and nobody attended to me at all." },
      { name: "Happy", stars: 5, text: "Wonderful care and very attentive staff, I felt looked after the whole time." },
    ],
  });
  assert.equal(reviews.length, 1, "a business's own site is not where its one-star reviews go");
  assert.equal(reviews[0].author, "Happy");
});

test("the extraction invents nothing when the listing is empty", () => {
  assert.deepEqual(extractReviews({}), []);
  assert.deepEqual(extractReviews({ reviews: null }), []);
  assert.deepEqual(extractReviews({ reviews: "nope" }), []);
  assert.deepEqual(extractReviews({ reviews: [{ stars: 5 }] }), [], "no text, no testimonial");
});

test("an unnamed reviewer is attributed honestly rather than given a fake name", () => {
  const reviews = extractReviews({ reviews: [{ stars: 5, text: "Absolutely brilliant service and very friendly staff throughout." }] });
  assert.equal(reviews[0].author, "A customer");
});

/* ========================================================================== */
/* Opening hours                                                              */
/* ========================================================================== */

test("opening hours are normalised into a week order", () => {
  // Providers return these every which way, including Sunday first.
  const hours = extractOpeningHours({
    openingHours: ["Sunday: Closed", "Monday: 9 AM - 6 PM", "Wednesday: 9 AM - 6 PM", "Tuesday: 10 AM - 4 PM"],
  });
  assert.deepEqual(hours.map((h) => h.day), ["Monday", "Tuesday", "Wednesday", "Sunday"]);

  const objects = extractOpeningHours({ openingHours: [{ day: "Friday", hours: "9-5" }, { day: "Monday", hours: "9-5" }] });
  assert.deepEqual(objects.map((h) => h.day), ["Monday", "Friday"]);
});

test("hours with a colon in them survive the split", () => {
  // "Monday: 9:00 AM - 6:00 PM" — a naive split on ":" truncates the time.
  const hours = extractOpeningHours({ openingHours: ["Monday: 9:00 AM - 6:00 PM"] });
  assert.equal(hours[0].hours, "9:00 AM - 6:00 PM");
});

test("a day repeated for split shifts appears once", () => {
  const hours = extractOpeningHours({ openingHours: ["Monday: 9 AM - 1 PM", "Monday: 3 PM - 7 PM"] });
  assert.equal(hours.filter((h) => h.day === "Monday").length, 1);
});

test("no hours published means no hours section", () => {
  assert.deepEqual(extractOpeningHours({}), []);
  assert.deepEqual(extractOpeningHours({ openingHours: [] }), []);
});

/* ========================================================================== */
/* Products and service areas                                                 */
/* ========================================================================== */

test("a priced menu is captured, with prices left as strings", () => {
  const products = extractProducts({
    menu: [
      { name: "Deep Tissue Massage", description: "60 minutes", price: "₦25,000" },
      { name: "Consultation", price: "$40" },
    ],
  });
  assert.equal(products.length, 2);
  // Prices arrive formatted in the local currency; interpreting them into kobo
  // is a business decision, not a parsing one.
  assert.equal(products[0].price, "₦25,000");
  assert.equal(products[1].price, "$40");
});

test("service areas come from the listing's own location data only", () => {
  const areas = extractServiceAreas({ neighborhood: "Lekki Phase 1", suburb: "Lekki", borough: "Lagos" }, "Lagos");
  // The city is excluded — "we serve Lagos" while standing in Lagos is noise.
  assert.deepEqual(areas, ["Lekki Phase 1", "Lekki"]);

  const listed = extractServiceAreas({ nearbyAreas: ["Ikoyi", "Victoria Island", "Ikoyi"] }, "Lagos");
  assert.deepEqual(listed, ["Ikoyi", "Victoria Island"], "duplicates collapsed, order kept");
});

test("a service area is never invented", () => {
  // Claiming coverage the business may not have is how you get an angry call from
  // a customer outside it.
  assert.deepEqual(extractServiceAreas({}, "Lagos"), []);
  assert.deepEqual(extractServiceAreas({ neighborhood: "" }, "Lagos"), []);
});

/* ========================================================================== */
/* The whole enrichment                                                       */
/* ========================================================================== */

test("a rich listing is fully extracted", () => {
  const enrichment = enrichmentFromRaw(
    {
      imageUrls: ["https://a/1.jpg", "https://a/2.jpg", "https://a/3.jpg"],
      reviews: [
        { name: "Ada", stars: 5, text: "The team was professional and the clinic was spotless. Highly recommend to anyone." },
        { name: "Bola", stars: 5, text: "Excellent service from start to finish, I will definitely be coming back again soon." },
        { name: "Chidi", stars: 4, text: "Very good care and friendly staff, the waiting time was short and reasonable too." },
      ],
      openingHours: ["Monday: 9-6", "Tuesday: 9-6", "Wednesday: 9-6", "Thursday: 9-6", "Friday: 9-6"],
      categoryName: "Men's health clinic",
      categories: ["Doctor", "Clinic"],
      about: "We provide confidential men's health care.",
      neighborhood: "Lekki Phase 1",
      priceLevel: "$$",
      yearsInBusiness: 9,
      phones: ["+2348031111111"],
      postalCode: "106104",
      menu: [{ name: "Initial consultation", description: "45 minutes with a clinician", price: "₦35,000" }],
    },
    "Lagos",
  );

  assert.equal(enrichment.photos.length, 3);
  assert.equal(enrichment.reviews.length, 3);
  assert.equal(enrichment.openingHours.length, 5);
  assert.deepEqual(enrichment.categories, ["Men's health clinic", "Doctor", "Clinic"]);
  assert.equal(enrichment.about, "We provide confidential men's health care.");
  assert.deepEqual(enrichment.serviceAreas, ["Lekki Phase 1"]);
  assert.equal(enrichment.yearsInBusiness, 9);
  assert.equal(enrichment.postalCode, "106104");
  assert.equal(enrichment.products.length, 1);
  assert.equal(enrichment.products[0].price, "₦35,000");
  assert.equal(enrichmentCompleteness(enrichment), 10, "nothing missing");
  assert.deepEqual(enrichmentGaps(enrichment), []);
});

test("a bare listing produces an empty enrichment rather than guesses", () => {
  const enrichment = enrichmentFromRaw({ title: "Some Clinic" }, "Lagos");
  assert.deepEqual(enrichment.photos, []);
  assert.deepEqual(enrichment.reviews, []);
  assert.deepEqual(enrichment.openingHours, []);
  assert.equal(enrichment.about, "");
  assert.deepEqual(enrichment.serviceAreas, []);
  assert.equal(enrichment.yearsInBusiness, null);
  assert.equal(enrichmentCompleteness(enrichment), 0);

  // And the gaps are named, so the admin knows what a human has to add.
  const gaps = enrichmentGaps(enrichment);
  assert.ok(gaps.some((g) => g.includes("no photographs")));
  assert.ok(gaps.some((g) => g.includes("no usable reviews")));
  assert.ok(gaps.some((g) => g.includes("opening hours")));
});

test("junk input never throws mid-generation", () => {
  for (const junk of [null, undefined, "text", 42, []]) {
    const enrichment = enrichmentFromRaw(junk, "Lagos");
    assert.equal(enrichmentCompleteness(enrichment), 0);
  }
  assert.deepEqual(EMPTY_ENRICHMENT.photos, []);
  assert.deepEqual(EMPTY_ENRICHMENT.products, []);
});

test("an implausible years-in-business figure is discarded", () => {
  // A scraped "1820" would produce a claim of two centuries of trading.
  assert.equal(enrichmentFromRaw({ yearsInBusiness: 1820 }).yearsInBusiness, null);
  assert.equal(enrichmentFromRaw({ yearsInBusiness: -4 }).yearsInBusiness, null);
  assert.equal(enrichmentFromRaw({ yearsInBusiness: "many" }).yearsInBusiness, null);
});

/* ========================================================================== */
/* Email: syntax                                                              */
/* ========================================================================== */

test("real addresses pass and junk is rejected", () => {
  for (const good of [
    "info@lekki-aesthetics.ng",
    "dr.eze@vitalisclinic.com.ng",
    "bookings+lagos@glamhair.ng",
    "a_b-c@sub.domain.co.uk",
  ]) {
    assert.equal(isSyntacticallyValid(good), true, `${good} should be accepted`);
  }

  for (const bad of [
    "",
    "n/a",
    "none",
    "not-an-email",
    "two@@at.com",
    "no@tld",
    "a@b.c",
    ".leading@x.com",
    "trailing.@x.com",
    "double..dot@x.com",
    "spaces in@x.com",
    "08031234567",
  ]) {
    assert.equal(isSyntacticallyValid(bad), false, `${bad} should be rejected`);
  }
});

test("scraped placeholder addresses are recognised as junk", () => {
  for (const junk of ["test@test.com", "example@example.com", "your@email.com", "user@example.com"]) {
    assert.equal(isSyntacticallyValid(junk), false, `${junk} is a placeholder, not a business`);
  }
});

test("normalising is case- and whitespace-insensitive", () => {
  assert.equal(normalizeEmail("  Info@Lekki.ng  "), "info@lekki.ng");
  assert.equal(domainOf("Info@Lekki.ng"), "lekki.ng");
  assert.equal(domainOf("no-at-sign"), "");
});

/* ========================================================================== */
/* Email: role and disposable detection                                       */
/* ========================================================================== */

test("a shared inbox is risky, not invalid", () => {
  // `info@` reaches a real business. It is worth less for a personalised email,
  // but discarding the lead would be wrong.
  const check = checkEmailOffline("info@lekki-aesthetics.ng");
  assert.equal(check.status, "risky");
  assert.match(check.note, /role address/i);
  assert.equal(isSendable(check.status), true);

  // A suffixed role address is still a role address.
  assert.equal(checkEmailOffline("info2@x.ng").status, "risky");
  assert.equal(checkEmailOffline("bookings-ng@x.ng").status, "risky");
  assert.equal(checkEmailOffline("no-reply@x.ng").status, "risky");
});

test("a throwaway provider is invalid, because the lead can never reply", () => {
  for (const domain of ["mailinator.com", "yopmail.com", "guerrillamail.com", "10minutemail.com"]) {
    const check = checkEmailOffline(`someone@${domain}`);
    assert.equal(check.status, "invalid", `${domain} should never be sent to`);
    assert.equal(isSendable(check.status), false);
  }
});

test("a free mailbox is risky, and says why", () => {
  const check = checkEmailOffline("ada@gmail.com");
  assert.equal(check.status, "risky");
  assert.match(check.note, /free mailbox/i);
  // A business with no domain of its own is still a business.
  assert.equal(isSendable(check.status), true);
});

test("a well-formed address is only 'unknown' until DNS says otherwise", () => {
  // Never "valid" on syntax alone: syntax has never delivered an email.
  const check = checkEmailOffline("dr.eze@vitalisclinic.com.ng");
  assert.equal(check.status, "unknown");
  assert.equal(check.domain, "vitalisclinic.com.ng");
  assert.equal(isSendable(check.status), true, "an unchecked lead must not be blocked");
  assert.equal(isSendable("invalid"), false);
});

/* ========================================================================== */
/* Email: MX                                                                  */
/* ========================================================================== */

/** A resolver whose answers the test decides, so no DNS is touched. */
function fakeResolver(answers) {
  return {
    resolveMx: async (domain) => {
      const answer = answers[domain];
      if (answer === undefined) {
        const err = new Error("queryMx ENOTFOUND");
        err.code = "ENOTFOUND";
        throw err;
      }
      if (answer === "SERVFAIL") {
        const err = new Error("queryMx ESERVFAIL");
        err.code = "ESERVFAIL";
        throw err;
      }
      return answer;
    },
    resolve4: async (domain) => (answers[`A:${domain}`] ? ["1.2.3.4"] : []),
  };
}

test("a domain with an MX record can receive mail", async () => {
  const resolver = fakeResolver({ "good.ng": [{ exchange: "mx1.good.ng", priority: 10 }] });
  const result = await checkDomainMail("good.ng", resolver);
  assert.equal(result.hasMail, true);
});

test("a domain that does not exist is dead", async () => {
  const result = await checkDomainMail("nope.ng", fakeResolver({}));
  assert.equal(result.hasMail, false);
  assert.match(result.note, /does not exist/i);
});

test("a null MX is an explicit refusal to receive mail", async () => {
  const result = await checkDomainMail("noreply.example.com", fakeResolver({ "noreply.example.com": [{ exchange: ".", priority: 0 }] }));
  assert.equal(result.hasMail, false);
  assert.match(result.note, /null MX/i);
});

test("a DNS failure is never the domain's fault", async () => {
  // The distinction that matters: discarding a real business because our
  // resolver was briefly unavailable is worse than one extra bounce.
  const result = await checkDomainMail("temporary.ng", fakeResolver({ "temporary.ng": "SERVFAIL" }));
  assert.equal(result.hasMail, null, "must be unknown, not false");
  assert.match(result.note, /not treated as invalid/i);
});

test("no MX but a resolving domain is worth one send", async () => {
  // Some small-business hosts deliver to the A record.
  const result = await checkDomainMail("smallbiz.ng", fakeResolver({ "A:smallbiz.ng": true }));
  assert.equal(result.hasMail, true);
  assert.match(result.note, /resolves/i);
});

/* ========================================================================== */
/* Email: combining the layers                                                */
/* ========================================================================== */

test("the combined verdict respects every layer", () => {
  // Offline invalid short-circuits regardless of DNS.
  assert.equal(combineEmailChecks("n/a", { domain: "x", hasMail: true, note: "" }).status, "invalid");

  // Reachable domain promotes unknown to valid.
  assert.equal(combineEmailChecks("dr.eze@clinic.ng", { domain: "clinic.ng", hasMail: true, note: "Mail exchanger found" }).status, "valid");

  // Dead domain condemns an otherwise fine address.
  assert.equal(combineEmailChecks("dr.eze@dead.ng", { domain: "dead.ng", hasMail: false, note: "Domain does not exist" }).status, "invalid");

  // A role address stays risky even when the domain is confirmed reachable —
  // reachable is not the same as worth a personalised email.
  assert.equal(combineEmailChecks("info@clinic.ng", { domain: "clinic.ng", hasMail: true, note: "Mail exchanger found" }).status, "risky");

  // An inconclusive lookup leaves the offline verdict alone.
  assert.equal(combineEmailChecks("dr.eze@clinic.ng", { domain: "clinic.ng", hasMail: null, note: "DNS lookup failed" }).status, "unknown");
  assert.equal(combineEmailChecks("dr.eze@clinic.ng", null).status, "unknown");
});

/* ========================================================================== */
/* Email: batching and ordering                                               */
/* ========================================================================== */

test("domains are deduplicated so DNS is queried once each", () => {
  const domains = uniqueDomains(["a@x.ng", "b@x.ng", "c@y.ng", "d@X.ng", "broken"]);
  assert.deepEqual(domains.sort(), ["x.ng", "y.ng"]);
});

test("the most promising addresses are sent to first", () => {
  // A named person at a company domain beats a shared inbox; an unvalidated
  // address goes last.
  const named = emailPriority("valid", "dr.eze@clinic.ng");
  const shared = emailPriority("valid", "info@clinic.ng");
  const free = emailPriority("risky", "ada@gmail.com");
  const unchecked = emailPriority("unknown", "ada@clinic.ng");

  assert.ok(named < shared);
  assert.ok(shared < unchecked);
  assert.ok(free < unchecked);
  assert.equal(emailPriority("invalid", "a@b.com"), 5, "never chosen while anything else exists");
});
