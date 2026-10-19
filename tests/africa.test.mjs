/**
 * Tests for the Africa-only targeting rules and country-aware phone numbers.
 *
 * Two things are being pinned here, and both are expensive to get wrong:
 *
 *   1. **Who we are allowed to email.** Getting this wrong is a regulatory
 *      problem, not a bug report, so the decision logic is tested rather than
 *      trusted — including the direction that matters most, that an unknown or
 *      non-African country is *refused* rather than treated as sendable.
 *   2. **Which number a patient's appointment confirmation goes to.** Every
 *      phone number in this product used to be read as Nigerian; a Kenyan
 *      caller's 0712 345 678 would have become 234712345678 and texted a
 *      stranger.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  AFRICAN_COUNTRIES,
  countryRule,
  decideOutreach,
  dialCodeForCountry,
  isAfricanCountry,
  normalizeCountryCode,
  summarizeCountries,
} from "../src/lib/prospects/jurisdictions.ts";

import { formatInternational, isPlausibleMobile, normalizePhone, subscriberKey, whatsappLink } from "../src/lib/phone.ts";

/* ------------------------------------------------------------------ */
/* The target region                                                   */
/* ------------------------------------------------------------------ */

test("the continent is covered, without duplicates", () => {
  assert.ok(AFRICAN_COUNTRIES.length >= 50, `expected the African list, got ${AFRICAN_COUNTRIES.length}`);
  const codes = AFRICAN_COUNTRIES.map((c) => c.code);
  assert.equal(new Set(codes).size, codes.length, "no country may appear twice");

  // Every entry is usable for dialling and for pricing.
  for (const country of AFRICAN_COUNTRIES) {
    assert.match(country.code, /^[A-Z]{2}$/, `${country.name}: not an ISO alpha-2 code`);
    assert.match(country.dialCode, /^\d{2,3}$/, `${country.name}: bad dialling code`);
    assert.ok(country.currency.length === 3, `${country.name}: bad currency`);
    // A pointer to the statute, not an essay — but never empty.
    assert.ok(country.note.length >= 15, `${country.name}: needs a reason (got "${country.note}")`);
  }

  // The markets this business is built around.
  for (const code of ["NG", "KE", "ZA", "GH", "EG", "MA", "TZ", "UG", "ET"]) {
    assert.ok(codes.includes(code), `missing ${code}`);
  }
});

test("country names, codes and city-suffixed values all resolve", () => {
  assert.equal(normalizeCountryCode("NG"), "NG");
  assert.equal(normalizeCountryCode("ng"), "NG");
  assert.equal(normalizeCountryCode("Nigeria"), "NG");
  assert.equal(normalizeCountryCode("Kenya"), "KE");
  assert.equal(normalizeCountryCode("Nairobi, Kenya"), "KE");
  assert.equal(normalizeCountryCode("Côte d'Ivoire"), "CI");
  assert.equal(normalizeCountryCode("United States"), "US");
  assert.equal(normalizeCountryCode(""), null);
  assert.equal(normalizeCountryCode("Narnia"), null);
});

test("a country we cannot place is not treated as anywhere", () => {
  assert.equal(normalizeCountryCode(""), null);
  const decision = decideOutreach({ country: null });
  assert.equal(decision.allowed, false, "an unidentifiable country must never be emailed");
  assert.equal(decision.rule, "review_required");
});

/* ------------------------------------------------------------------ */
/* Who we may email                                                    */
/* ------------------------------------------------------------------ */

test("outside Africa is refused outright, whatever the consent", () => {
  for (const country of ["US", "GB", "IN", "AE", "FR", "BR"]) {
    const decision = decideOutreach({ country, consentAt: "2026-01-01T00:00:00Z" });
    assert.equal(decision.allowed, false, `${country} must be outside the target region`);
    assert.equal(decision.rule, "blocked");
    assert.match(decision.reason, /outside the target region/i);
  }
  assert.equal(isAfricanCountry("US"), false);
  assert.equal(isAfricanCountry("NG"), true);
});

test("Nigeria is permitted on a recorded basis, so the home market works", () => {
  const decision = decideOutreach({ country: "NG" });
  assert.equal(decision.allowed, true);
  assert.equal(decision.requiresConsent, false);
});

test("an opt-in market refuses without consent and allows with it", () => {
  for (const country of ["ZA", "EG", "MA", "KE", "GH"]) {
    const blocked = decideOutreach({ country });
    assert.equal(blocked.allowed, false, `${country} requires consent`);
    assert.equal(blocked.requiresConsent, true, `${country} should ask for consent, not review`);
    assert.ok(blocked.reason.length > 20);

    const allowed = decideOutreach({ country, consentAt: "2026-02-01T10:00:00Z" });
    assert.equal(allowed.allowed, true, `${country} should open once consent is recorded`);
  }
});

test("South Africa's reason names the statute, so the refusal is actionable", () => {
  const decision = decideOutreach({ country: "ZA" });
  assert.match(decision.reason, /POPIA/);
});

test("an unreviewed African country is held back rather than assumed safe", () => {
  const decision = decideOutreach({ country: "TZ" });
  assert.equal(decision.allowed, false);
  assert.equal(decision.rule, "review_required");
  assert.match(decision.reason, /Tanzania/);
  assert.match(decision.reason, /set the country rule/i, "the admin needs to be told how to unblock it");
});

test("every default rule is one of the four known states, and none is accidentally permissive", () => {
  const permitted = [];
  for (const country of AFRICAN_COUNTRIES) {
    assert.ok(
      ["permitted", "consent_required", "review_required", "blocked"].includes(country.rule),
      `${country.code}: unknown rule ${country.rule}`,
    );
    if (country.rule === "permitted") permitted.push(country.code);
  }
  // Exactly one market is open by default, and it is the one the business
  // already operates in. Anything else would be an unconsidered decision.
  assert.deepEqual(permitted, ["NG"]);
});

test("an override opens a market once it has been reviewed", () => {
  const before = decideOutreach({ country: "TZ" });
  assert.equal(before.allowed, false);

  const after = decideOutreach({ country: "TZ", overrideRule: "permitted" });
  assert.equal(after.allowed, true, "counsel signing off must be able to open a market without a deploy");

  // …and an override can close one too.
  assert.equal(decideOutreach({ country: "NG", overrideRule: "blocked" }).allowed, false);
});

test("even a permitted country reports which basis was relied on", () => {
  const decision = decideOutreach({ country: "NG" });
  assert.ok(decision.reason.length > 20, "the audit trail needs the reasoning, not just a boolean");
});

/* ------------------------------------------------------------------ */
/* Phone numbers across the continent                                  */
/* ------------------------------------------------------------------ */

test("Nigerian numbers behave exactly as they did before", () => {
  // The behaviour that must not regress: this is the live market.
  assert.equal(normalizePhone("0803 441 2291", "234"), "2348034412291");
  assert.equal(normalizePhone("+234 803 441 2291", "234"), "2348034412291");
  assert.equal(normalizePhone("2348034412291", "234"), "2348034412291");
  assert.equal(normalizePhone("08034412291", "234"), "2348034412291");
});

test("the same number shapes work for every market", () => {
  const cases = [
    ["0712 345 678", "254", "254712345678", "Kenya"],
    ["+254 712 345 678", "254", "254712345678", "Kenya international"],
    ["712345678", "254", "254712345678", "Kenya with no trunk zero"],
    ["00254712345678", "254", "254712345678", "Kenya with the 00 prefix"],
    ["024 123 4567", "233", "233241234567", "Ghana"],
    ["082 123 4567", "27", "27821234567", "South Africa"],
    ["0752 345 678", "255", "255752345678", "Tanzania"],
    ["0772 345 678", "256", "256772345678", "Uganda"],
    ["0912 345 678", "251", "251912345678", "Ethiopia"],
  ];
  for (const [input, dial, expected, label] of cases) {
    assert.equal(normalizePhone(input, dial), expected, `${label}: ${input}`);
    assert.equal(isPlausibleMobile(input, dial), true, `${label} should look like a usable mobile`);
  }
});

test("a number already international for another country is not reshaped into this one", () => {
  // The dangerous case: a Kenyan visitor's number must not be read as Nigerian.
  assert.equal(normalizePhone("+254712345678", "234"), "254712345678", "leave a foreign number alone");
  assert.equal(isPlausibleMobile("+254712345678", "234"), false, "and do not claim it is a Nigerian mobile");
});

test("rubbish input fails visibly rather than becoming somebody's number", () => {
  assert.equal(normalizePhone("", "234"), "");
  assert.equal(normalizePhone("not a phone", "234"), "");
  assert.equal(isPlausibleMobile("123", "234"), false);
  assert.equal(isPlausibleMobile("", "254"), false);
  // A Nigerian landline-shaped number of the wrong length is not a mobile.
  assert.equal(isPlausibleMobile("0803", "234"), false);
});

test("the subscriber key matches a stored number to a webhook's, in any format", () => {
  // This is the inbound-call routing key: the clinic's stored line and the
  // dialled number from the webhook must land on the same key.
  assert.equal(subscriberKey("0700 000 1234"), subscriberKey("+2347000001234"));
  assert.equal(subscriberKey("0712 345 678", 9), subscriberKey("+254712345678", 9));
  assert.notEqual(subscriberKey("+254712345678", 9), subscriberKey("+2348034412291", 9));
});

test("display formatting and WhatsApp links work for any market", () => {
  assert.equal(formatInternational("0803 441 2291", "234"), "+234 803 441 2291");
  assert.equal(formatInternational("0712 345 678", "254"), "+254 712 345 678");
  assert.equal(whatsappLink("0712 345 678", "254"), "https://wa.me/254712345678");
  assert.equal(whatsappLink("", "254"), null);
});

test("dialling codes resolve from a country code, so tenants can be configured", () => {
  assert.equal(dialCodeForCountry("NG"), "234");
  assert.equal(dialCodeForCountry("KE"), "254");
  assert.equal(dialCodeForCountry("ZA"), "27");
  assert.equal(countryRule("ke").name, "Kenya");
  assert.equal(countryRule("ke").rule, "consent_required");
});

test("the country summary shows where the leads actually are", () => {
  const summary = summarizeCountries(["KE", "Kenya", "NG", "NG", "TZ", "US"]);
  const byCode = Object.fromEntries(summary.map((s) => [s.rule.code, s.count]));
  assert.equal(byCode.NG, 2);
  assert.equal(byCode.KE, 2, "a name and a code for the same country must not split");
  assert.equal(byCode.TZ, 1);
  assert.equal(byCode.US, 1);
  // Worst-case first would be wrong here; most leads first is what an admin wants.
  assert.equal(summary[0].count, 2);
});
