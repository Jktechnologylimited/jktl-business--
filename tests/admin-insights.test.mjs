/**
 * Tests for the admin reporting.
 *
 * Two failure modes matter more than arithmetic slips, and most of this file is
 * about them:
 *
 *   - **A rate with no denominator shown as 0%.** "0% conversion" and "nobody has
 *     applied yet" are different facts. Reporting them identically teaches an
 *     operator to distrust the dashboard, and then to ignore it.
 *   - **Counting prospect tenants as customers.** The lead engine creates a real
 *     organization for every generated site, so a naive count makes the business
 *     look like it is growing by hundreds a week on the day it acquired nobody.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  AFFILIATE_RECURRING_KOBO,
  PLATFORM_MONTHLY_KOBO,
  affiliateSummary,
  buildInsights,
  growthSummary,
  headlines,
  marketSplit,
  prospectSummary,
  rate,
  receptionistSummary,
  recentMonths,
  revenueSummary,
} from "../src/lib/admin-insights.ts";

const NOW = new Date("2026-06-15T12:00:00Z");
const K = (n) => n * 100; // naira → kobo

const business = (createdAt, opts = {}) => ({
  createdAt,
  published: true,
  subscriptionStatus: "inactive",
  isProspect: false,
  countryCode: "NG",
  ...opts,
});

/* ========================================================================== */
/* Rates fail honestly                                                        */
/* ========================================================================== */

test("a rate with no denominator is null, never zero", () => {
  assert.equal(rate(0, 0), null);
  assert.equal(rate(5, 0), null);
  assert.equal(rate(0, 10), 0, "a real zero is a real zero");
  assert.equal(rate(1, 3), 33.3);
  assert.equal(rate(Number.NaN, 10), null);
});

/* ========================================================================== */
/* Months                                                                     */
/* ========================================================================== */

test("recent months run oldest first and roll the year", () => {
  assert.deepEqual(recentMonths(new Date("2026-02-10T00:00:00Z"), 4), ["2025-11", "2025-12", "2026-01", "2026-02"]);
  assert.deepEqual(recentMonths(new Date("2026-01-01T00:00:00Z"), 1), ["2026-01"]);
});

/* ========================================================================== */
/* Growth                                                                     */
/* ========================================================================== */

test("prospect tenants are not customers", () => {
  // The lead engine generates a site for every lead, and each is a real
  // organization. Counting them would claim hundreds of customers acquired.
  const businesses = [
    business("2026-06-01T00:00:00Z"),
    business("2026-06-02T00:00:00Z", { isProspect: true }),
    business("2026-06-03T00:00:00Z", { isProspect: true }),
    business("2026-06-04T00:00:00Z", { isProspect: true }),
  ];
  const growth = growthSummary(businesses, NOW);
  assert.equal(growth.totalBusinesses, 1, "only the real one");
  assert.equal(growth.prospects, 3);
});

test("the growth series counts signups per month and a true cumulative", () => {
  const businesses = [
    business("2026-01-05T00:00:00Z"),
    business("2026-01-20T00:00:00Z"),
    business("2026-06-02T00:00:00Z"),
    // Before the window: must appear in the cumulative, not as a signup.
    business("2025-01-01T00:00:00Z"),
  ];
  const growth = growthSummary(businesses, NOW, 6);

  assert.equal(growth.series.length, 6);
  assert.deepEqual(
    growth.series.map((p) => p.month),
    ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"],
  );
  assert.equal(growth.series[0].signups, 2);
  assert.equal(growth.series[0].cumulative, 3, "the pre-window business is already counted");
  assert.equal(growth.series[5].cumulative, 4, "and the final point is the true total");
});

test("month-on-month is null when last month had no signups", () => {
  // Dividing by zero here would show an infinite growth rate, which reads as a
  // bug rather than as "this is the first month".
  const growth = growthSummary([business("2026-06-02T00:00:00Z")], NOW, 6);
  assert.equal(growth.signupsThisMonth, 1);
  assert.equal(growth.signupsLastMonth, 0);
  assert.equal(growth.monthOnMonthPct, null);
});

test("an empty business list produces zeroes, not NaN", () => {
  const growth = growthSummary([], NOW);
  assert.equal(growth.totalBusinesses, 0);
  assert.equal(growth.monthOnMonthPct, null);
  assert.equal(growth.published, 0);
});

/* ========================================================================== */
/* Revenue                                                                    */
/* ========================================================================== */

test("collected and outstanding are separate, and MRR counts only live contracts", () => {
  const contracts = [
    { status: "active", chargesPaid: 3, setupMonths: 6, collectedKobo: K(325_000), outstandingKobo: K(325_000), startedAt: "2026-01-01" },
    { status: "past_due", chargesPaid: 6, setupMonths: 6, collectedKobo: K(650_000), outstandingKobo: 0, startedAt: "2026-01-01" },
    { status: "cancelled", chargesPaid: 1, setupMonths: 6, collectedKobo: K(108_333), outstandingKobo: 0, startedAt: "2026-01-01" },
    { status: "pending", chargesPaid: 0, setupMonths: 6, collectedKobo: 0, outstandingKobo: 0, startedAt: null },
  ];
  const revenue = revenueSummary(contracts);

  assert.equal(revenue.collectedKobo, K(325_000) + K(650_000) + K(108_333));
  assert.equal(revenue.outstandingKobo, K(325_000), "only the live contract still owes setup months");
  // MRR counts active + past_due: a past-due clinic is still being billed.
  assert.equal(revenue.mrrKobo, PLATFORM_MONTHLY_KOBO * 2);
  assert.equal(revenue.arrKobo, PLATFORM_MONTHLY_KOBO * 24);
  assert.equal(revenue.active, 1);
  assert.equal(revenue.pastDue, 1);
  assert.equal(revenue.cancelled, 1);
  assert.equal(revenue.pending, 1);
});

test("a cancelled contract contributes nothing to recurring revenue", () => {
  const revenue = revenueSummary([
    { status: "cancelled", chargesPaid: 2, setupMonths: 6, collectedKobo: K(200_000), outstandingKobo: K(400_000), startedAt: "2026-01-01" },
  ]);
  assert.equal(revenue.mrrKobo, 0, "nobody is being billed");
  assert.equal(revenue.outstandingKobo, 0, "and nothing is still to come");
  assert.equal(revenue.collectedKobo, K(200_000), "but what was paid is still counted");
});

test("no contracts means every rate is null", () => {
  const revenue = revenueSummary([]);
  assert.equal(revenue.payingRatePct, null);
  assert.equal(revenue.averageCollectedKobo, 0);
  assert.equal(revenue.mrrKobo, 0);
});

/* ========================================================================== */
/* The receptionist                                                           */
/* ========================================================================== */

test("the three funnel rates expose different failures", () => {
  const summary = receptionistSummary({
    total: 100,
    textsSent: 90, // 10% never got a text → wallet or Twilio
    chatsOpened: 45, // half of those texted opened it → message copy
    bookings: 9, // a fifth of chats booked → the assistant
    recoveredKobo: K(450_000),
  });

  assert.equal(summary.textCoveragePct, 90);
  assert.equal(summary.openRatePct, 50);
  assert.equal(summary.chatToBookingPct, 20);
  assert.equal(summary.callToBookingPct, 9);
  assert.equal(summary.averageRecoveredKobo, K(50_000));
  assert.equal(summary.annualisedRecoveredKobo, K(450_000) * 12);
});

test("no calls yet means no rates at all", () => {
  const summary = receptionistSummary({ total: 0, textsSent: 0, chatsOpened: 0, bookings: 0, recoveredKobo: 0 });
  assert.equal(summary.textCoveragePct, null);
  assert.equal(summary.openRatePct, null);
  assert.equal(summary.chatToBookingPct, null);
  assert.equal(summary.callToBookingPct, null);
  assert.equal(summary.averageRecoveredKobo, 0);
});

test("a perfect funnel reads as 100%, not as zero", () => {
  const summary = receptionistSummary({ total: 10, textsSent: 10, chatsOpened: 10, bookings: 10, recoveredKobo: K(500_000) });
  assert.equal(summary.callToBookingPct, 100);
  assert.equal(summary.chatToBookingPct, 100);
});

/* ========================================================================== */
/* Affiliates                                                                 */
/* ========================================================================== */

test("owed is what was earned minus what was paid, never negative", () => {
  const summary = affiliateSummary({
    applications: 10,
    approved: 6,
    referrals: 20,
    convertedReferrals: 5,
    earnedKobo: K(300_000),
    pendingKobo: K(20_000),
    paidOutKobo: K(250_000),
  });

  assert.equal(summary.owedKobo, K(50_000));
  assert.equal(summary.approvalRatePct, 60);
  assert.equal(summary.referralConversionPct, 25);
  assert.equal(summary.averagePerReferralKobo, K(60_000));
  assert.equal(summary.monthlyRunRateKobo, AFFILIATE_RECURRING_KOBO * 5);

  // An overpayment is a data problem to fix, not a debt to display.
  assert.equal(
    affiliateSummary({ applications: 1, approved: 1, referrals: 1, convertedReferrals: 1, earnedKobo: K(10_000), pendingKobo: 0, paidOutKobo: K(50_000) }).owedKobo,
    0,
  );
});

test("no applications means no rates", () => {
  const summary = affiliateSummary({
    applications: 0,
    approved: 0,
    referrals: 0,
    convertedReferrals: 0,
    earnedKobo: 0,
    pendingKobo: 0,
    paidOutKobo: 0,
  });
  assert.equal(summary.approvalRatePct, null);
  assert.equal(summary.referralConversionPct, null);
  assert.equal(summary.averagePerReferralKobo, 0);
});

/* ========================================================================== */
/* Lead engine                                                                */
/* ========================================================================== */

test("cost per acquisition is withheld until something converts", () => {
  const base = {
    total: 1000,
    qualified: 400,
    sitesBuilt: 380,
    emailsSent: 300,
    blocked: 50,
    excluded: 20,
    sendableEmails: 300,
  };

  // Nothing converted: printing "0 emails per conversion" would read as
  // catastrophe rather than "not yet".
  assert.equal(prospectSummary(base, 0).emailsPerConversion, null);
  assert.equal(prospectSummary(base, 3).emailsPerConversion, 100);
  // No emails sent but conversions recorded (impossible, but must not divide by
  // zero if the data is odd).
  assert.equal(prospectSummary({ ...base, emailsSent: 0 }, 3).emailsPerConversion, null);
});

test("prospect rates are computed, and null when there is nothing to divide", () => {
  const summary = prospectSummary(
    { total: 100, qualified: 25, sitesBuilt: 10, emailsSent: 5, blocked: 0, excluded: 0, sendableEmails: 40 },
    1,
  );
  assert.equal(summary.qualificationRatePct, 25);
  assert.equal(summary.siteCoveragePct, 40);
  assert.equal(summary.sendableRatePct, 40);

  const empty = prospectSummary({ total: 0, qualified: 0, sitesBuilt: 0, emailsSent: 0, blocked: 0, excluded: 0, sendableEmails: 0 }, 0);
  assert.equal(empty.qualificationRatePct, null);
  assert.equal(empty.siteCoveragePct, null);
});

/* ========================================================================== */
/* Markets                                                                    */
/* ========================================================================== */

test("the market split counts real businesses only, and sums to 100", () => {
  const split = marketSplit([
    business("2026-01-01", { countryCode: "NG" }),
    business("2026-01-01", { countryCode: "NG" }),
    business("2026-01-01", { countryCode: "GH" }),
    business("2026-01-01", { countryCode: "CI" }),
    business("2026-01-01", { countryCode: "SN", isProspect: true }),
  ]);

  assert.deepEqual(
    split.map((m) => [m.countryCode, m.businesses]),
    [
      ["NG", 2],
      ["GH", 1],
      ["CI", 1],
    ],
  );
  assert.equal(split.reduce((sum, m) => sum + m.sharePct, 0), 100);
});

test("a missing country is treated as Nigeria", () => {
  const split = marketSplit([{ ...business("2026-01-01"), countryCode: "" }]);
  assert.equal(split[0].countryCode, "NG");
});

/* ========================================================================== */
/* The whole page                                                             */
/* ========================================================================== */

test("buildInsights assembles everything and never throws on empty input", () => {
  const insights = buildInsights(
    {
      businesses: [],
      contracts: [],
      calls: { total: 0, textsSent: 0, chatsOpened: 0, bookings: 0, recoveredKobo: 0 },
      affiliates: { applications: 0, approved: 0, referrals: 0, convertedReferrals: 0, earnedKobo: 0, pendingKobo: 0, paidOutKobo: 0 },
      prospects: { total: 0, qualified: 0, sitesBuilt: 0, emailsSent: 0, blocked: 0, excluded: 0, sendableEmails: 0 },
      wallet: { totalBalanceKobo: 0, emptyWallets: 0 },
      now: NOW,
    },
    (kobo) => `₦${(kobo / 100).toLocaleString()}`,
  );

  assert.equal(insights.headlines.length, 5);
  assert.equal(insights.growth.totalBusinesses, 0);
  for (const headline of insights.headlines) {
    assert.ok(!/NaN|undefined|Infinity/.test(headline.value + headline.sub), `bad headline: ${JSON.stringify(headline)}`);
  }
});

test("the headline strip reports the denominator, not a bare rate", () => {
  const revenue = revenueSummary([]);
  const receptionist = receptionistSummary({ total: 0, textsSent: 0, chatsOpened: 0, bookings: 0, recoveredKobo: 0 });
  const growth = growthSummary([], NOW);
  const affiliates = affiliateSummary({ applications: 0, approved: 0, referrals: 0, convertedReferrals: 0, earnedKobo: 0, pendingKobo: 0, paidOutKobo: 0 });
  const prospects = prospectSummary({ total: 0, qualified: 0, sitesBuilt: 0, emailsSent: 0, blocked: 0, excluded: 0, sendableEmails: 0 }, 0);

  const strip = headlines({ revenue, receptionist, growth, affiliates, prospects, formatKobo: (k) => `₦${k / 100}` });
  const byLabel = Object.fromEntries(strip.map((h) => [h.label, h]));

  assert.match(byLabel["Calls rescued"].sub, /No calls yet/);
  assert.match(byLabel["Partner commission"].sub, /nothing converted yet/);
  assert.match(byLabel["Leads qualified"].sub, /Nothing imported yet/);
  assert.match(byLabel["Collected"].sub, /No contracts started yet/);
});

test("with real data the headlines state the comparison", () => {
  const revenue = revenueSummary([
    { status: "active", chargesPaid: 2, setupMonths: 6, collectedKobo: K(216_666), outstandingKobo: K(433_334), startedAt: "2026-05-01" },
  ]);
  const receptionist = receptionistSummary({ total: 40, textsSent: 40, chatsOpened: 20, bookings: 5, recoveredKobo: K(250_000) });
  const growth = growthSummary([business("2026-06-01"), business("2026-05-01")], NOW, 6);
  const affiliates = affiliateSummary({ applications: 4, approved: 2, referrals: 2, convertedReferrals: 1, earnedKobo: K(60_000), pendingKobo: 0, paidOutKobo: 0 });
  const prospects = prospectSummary({ total: 200, qualified: 80, sitesBuilt: 60, emailsSent: 50, blocked: 0, excluded: 5, sendableEmails: 90 }, 1);

  const strip = headlines({ revenue, receptionist, growth, affiliates, prospects, formatKobo: (k) => `₦${k / 100}` });
  const byLabel = Object.fromEntries(strip.map((h) => [h.label, h]));

  assert.match(byLabel["Calls rescued"].sub, /5 became bookings \(12\.5%\)/);
  assert.match(byLabel["Leads qualified"].sub, /40% of 200/);
  assert.match(byLabel["Partner commission"].sub, /₦60000 owed/);
});
