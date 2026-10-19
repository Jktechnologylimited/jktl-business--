/**
 * Tests for the market and currency layer.
 *
 * The one that matters most: the CFA franc has no subunit, and the rest of this
 * product stores money in hundredths. Getting that wrong multiplies a payment by
 * a hundred, and the wrong number would sit in the database looking perfectly
 * normal. So the rounding rules and the "is this amount even chargeable" check
 * are the substance of this file.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  CURRENCIES,
  MARKETS,
  convertFromNairaKobo,
  formatMoney,
  getCurrency,
  getMarket,
  getPricePoints,
  isChargeableAmount,
  marketReadiness,
  marketsNeedingTranslation,
  marketsWithoutPayments,
  setPricePoints,
} from "../src/lib/markets.ts";

/* ------------------------------------------------------------------ */
/* The currencies                                                      */
/* ------------------------------------------------------------------ */

test("XOF is declared as having no subunit, which is the whole point", () => {
  assert.equal(getCurrency("XOF").minorUnits, 1, "a CFA franc IS the smallest unit");
  assert.equal(getCurrency("XOF").decimals, 0);
  assert.equal(getCurrency("NGN").minorUnits, 100);
  assert.equal(getCurrency("GHS").minorUnits, 100, "the cedi has pesewas");

  // The trap, stated as a test: 100 kobo is ₦1, and 100 minor units of XOF is
  // one hundred francs. They are not the same thing.
  assert.notEqual(CURRENCIES.NGN.minorUnits, CURRENCIES.XOF.minorUnits);
});

test("money formats with each currency's own decimals", () => {
  assert.equal(formatMoney(65_000_000, "NGN"), "₦650,000.00");
  assert.equal(formatMoney(5_900_000, "NGN"), "₦59,000.00");
  assert.equal(formatMoney(65_000_000, "GHS"), "GH₵650,000.00");
  // No decimal point for francs, ever.
  assert.equal(formatMoney(412_346, "XOF"), "CFA412,346");
  assert.ok(!formatMoney(412_346, "XOF").includes("."), "a CFA franc has no centime");
});

/* ------------------------------------------------------------------ */
/* Conversion                                                          */
/* ------------------------------------------------------------------ */

test("conversion into a currency with subunits keeps two decimals", () => {
  // ₦100 at 0.05 cedis per naira = 5 cedis = 500 pesewas.
  assert.equal(convertFromNairaKobo(10_000, "GHS", 0.05), 500);
});

test("conversion into XOF produces a whole number of francs", () => {
  // ₦100 at 0.4 francs per naira = 40 francs. 40, not 40.0-something.
  const francs = convertFromNairaKobo(10_000, "XOF", 0.4);
  assert.equal(francs, 40);
  assert.ok(Number.isInteger(francs));

  // A rate that does not divide evenly must still land on a whole franc.
  const awkward = convertFromNairaKobo(65_000_000, "XOF", 0.6344);
  assert.ok(Number.isInteger(awkward), `expected whole francs, got ${awkward}`);
});

test("conversion refuses to invent a result from nonsense input", () => {
  assert.equal(convertFromNairaKobo(1_000, "XOF", 0), 0, "no rate, no price");
  assert.equal(convertFromNairaKobo(1_000, "XOF", -1), 0);
  assert.equal(convertFromNairaKobo(Number.NaN, "XOF", 0.4), 0);
});

test("chargeability rejects a fractional amount in a zero-decimal currency", () => {
  assert.equal(isChargeableAmount(412_346, "XOF"), true);
  assert.equal(isChargeableAmount(412_346.5, "XOF"), false, "half a franc cannot be charged");
  assert.equal(isChargeableAmount(-1, "XOF"), false);
  // Pesewas are real, so a whole number of minor units is always chargeable.
  assert.equal(isChargeableAmount(500, "GHS"), true);
});

/* ------------------------------------------------------------------ */
/* The markets                                                         */
/* ------------------------------------------------------------------ */

test("the three expansion markets are defined, with the home market first", () => {
  assert.deepEqual(
    MARKETS.map((m) => m.countryCode),
    ["NG", "GH", "CI", "SN"],
  );
  assert.equal(getMarket("gh")?.country, "Ghana", "lookup is case-insensitive");
  assert.equal(getMarket("SN")?.currency, "XOF");
  assert.equal(getMarket("ZZ"), null);
  assert.equal(getMarket(null), null);
});

test("Côte d'Ivoire and Senegal are flagged as French-speaking", () => {
  assert.equal(getMarket("CI")?.primaryLanguage, "fr");
  assert.equal(getMarket("SN")?.primaryLanguage, "fr");
  assert.equal(getMarket("GH")?.primaryLanguage, "en");
  assert.deepEqual(
    marketsNeedingTranslation().map((m) => m.countryCode),
    ["CI", "SN"],
    "the translation layer is needed for market two, not market five",
  );
});

test("Paystack's coverage gap is recorded rather than discovered at checkout", () => {
  assert.equal(getMarket("NG")?.paystack, true);
  assert.equal(getMarket("GH")?.paystack, true);
  assert.equal(getMarket("CI")?.paystack, false);
  assert.equal(getMarket("SN")?.paystack, false);
  assert.deepEqual(marketsWithoutPayments().map((m) => m.countryCode), ["CI", "SN"]);

  // And the rails that actually matter there are named, because a card-first
  // checkout in Dakar would lose most customers.
  assert.ok(getMarket("SN").rails.join(" ").includes("Wave"));
  assert.ok(getMarket("CI").rails.join(" ").includes("Orange Money"));
});

test("every market carries its legal position, so none can be opened by accident", () => {
  for (const market of MARKETS) {
    assert.ok(market.legalNote.length > 20, `${market.countryCode}: needs its legal note`);
    assert.ok(market.dialCode.length >= 2 && market.dialCode.length <= 3, `${market.countryCode}: bad dial code`);
  }
  assert.match(getMarket("GH").legalNote, /Act 843/);
  assert.match(getMarket("SN").legalNote, /2008-12/);
});

test("only Nigeria is priced, and the others say so", () => {
  assert.equal(getMarket("NG")?.priced, true);
  for (const code of ["GH", "CI", "SN"]) {
    assert.equal(getMarket(code)?.priced, false, `${code} must not pretend to have a price yet`);
  }
});

/* ------------------------------------------------------------------ */
/* Price points                                                        */
/* ------------------------------------------------------------------ */

test("a market with no agreed price points cannot be quoted", () => {
  assert.equal(getPricePoints("GH"), null);
  assert.equal(getPricePoints("ZZ"), null);
});

test("price points are accepted only when they are internally consistent", () => {
  // A fractional instalment in XOF is refused rather than silently rounded.
  const fractional = setPricePoints({
    countryCode: "SN",
    currency: "XOF",
    setupFeeMinor: 412_346,
    setupMonths: 6,
    setupInstalmentMinor: 68_724.33,
    monthlyFeeMinor: 37_400,
  });
  assert.equal(fractional.ok, false);
  assert.match(fractional.ok === false ? fractional.error : "", /no fractional unit/);

  // Instalments must cover the package exactly — it is the contract.
  const mismatched = setPricePoints({
    countryCode: "SN",
    currency: "XOF",
    setupFeeMinor: 412_346,
    setupMonths: 6,
    setupInstalmentMinor: 68_724,
    monthlyFeeMinor: 37_400,
  });
  assert.equal(mismatched.ok, false);
  assert.match(mismatched.ok === false ? mismatched.error : "", /do not equal/);

  // 6 × 68,724 = 412,344 ≠ 412,346. Deliberately off by two francs.
});

test("correct price points are accepted and quotable", () => {
  const ok = setPricePoints({
    countryCode: "SN",
    currency: "XOF",
    setupFeeMinor: 412_344,
    setupMonths: 6,
    setupInstalmentMinor: 68_724,
    monthlyFeeMinor: 37_400,
  });
  assert.equal(ok.ok, true);
  const points = getPricePoints("SN");
  assert.equal(points?.monthlyFeeMinor, 37_400);
  assert.equal(formatMoney(points.monthlyFeeMinor, "XOF"), "CFA37,400");
  // Clean up so the module-level registry does not leak into other tests.
  assert.equal(getPricePoints("sn")?.countryCode, "SN");
});

test("price points are refused for the wrong currency", () => {
  const wrong = setPricePoints({
    countryCode: "GH",
    currency: "XOF",
    setupFeeMinor: 100,
    setupMonths: 1,
    setupInstalmentMinor: 100,
    monthlyFeeMinor: 100,
  });
  assert.equal(wrong.ok, false);
  assert.match(wrong.ok === false ? wrong.error : "", /uses GHS/);
});

/* ------------------------------------------------------------------ */
/* Readiness                                                           */
/* ------------------------------------------------------------------ */

test("readiness names the blockers in the order they block", () => {
  const senegal = marketReadiness("SN");
  const blockers = senegal.filter((r) => r.blocker && !r.met).map((r) => r.requirement);
  assert.deepEqual(blockers, ["Payment rail available", "Price points agreed"]);
  assert.ok(senegal.some((r) => r.requirement.includes("translated") && !r.met), "French is a gap, though not a hard blocker");

  const nigeria = marketReadiness("NG");
  assert.equal(nigeria.filter((r) => r.blocker && !r.met).length, 0, "the home market is ready");
});
