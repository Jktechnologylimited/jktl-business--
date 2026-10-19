/**
 * Tests for the partner reporting.
 *
 * A partner's dashboard is a statement of what they are owed, so the arithmetic
 * has to be right, and the *interpretation* has to be honest. Two failure modes
 * matter more than the rest and are what most of this file is about:
 *
 *   - **A run-rate that counts money from customers who left.** It would look
 *     great for a month and then be wrong, destroying trust in every other number
 *     on the page.
 *   - **A conversion rate that falls as churn happens.** Somebody who subscribed
 *     and later cancelled *did* convert; counting only current subscribers makes
 *     a partner's success rate go down precisely when they need the truth.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  earningsByKind,
  earningsByMonth,
  isPaying,
  projectedTwelveMonths,
  recurringRunRate,
  referralFunnel,
  referralValue,
} from "../src/lib/affiliate-report.ts";

const TIER = 350_000; // ₦3,500

const referral = (org, status, referredAt = "2026-01-15T00:00:00Z") => ({
  organizationId: org,
  displayName: `Business ${org}`,
  subscriptionStatus: status,
  referredAt,
});

const earning = (kind, commissionKobo, org, extra = {}) => ({
  kind,
  status: "available",
  commissionKobo,
  organizationId: org,
  createdAt: "2026-02-10T00:00:00Z",
  ...extra,
});

/* ========================================================================== */
/* Which statuses count as paying                                             */
/* ========================================================================== */

test("a past-due subscription still counts as paying", () => {
  // A card that failed this month may well succeed next month. Dropping the
  // partner's run-rate the moment a customer's card expires would make the
  // number lurch for reasons the partner can see and cannot influence.
  assert.equal(isPaying("active"), true);
  assert.equal(isPaying("past_due"), true);
  assert.equal(isPaying("canceled"), false);
  assert.equal(isPaying("inactive"), false);
  assert.equal(isPaying(""), false);
  assert.equal(isPaying(undefined), false, "must not throw on a missing status");
});

/* ========================================================================== */
/* Earnings by tier                                                           */
/* ========================================================================== */

test("earnings are split by tier, with legacy kept separate", () => {
  const byKind = earningsByKind([
    earning("signup", 2_000_000, "a"),
    earning("subscription", 4_000_000, "a"),
    earning("recurring", TIER, "a"),
    earning("recurring", TIER, "a"),
    // The old percentage programme, which must never be mixed into a tier.
    earning("commission", 123_456, "b"),
    earning("welcome", 200_000, "b"),
  ]);

  assert.equal(byKind.signupKobo, 2_000_000);
  assert.equal(byKind.subscriptionKobo, 4_000_000);
  assert.equal(byKind.recurringKobo, TIER * 2);
  assert.equal(byKind.legacyKobo, 323_456);
  assert.equal(byKind.totalKobo, 2_000_000 + 4_000_000 + TIER * 2 + 323_456);
});

test("an empty ledger is all zeroes, never NaN", () => {
  const byKind = earningsByKind([]);
  assert.deepEqual(byKind, { signupKobo: 0, subscriptionKobo: 0, recurringKobo: 0, legacyKobo: 0, totalKobo: 0 });
});

/* ========================================================================== */
/* The monthly trend                                                          */
/* ========================================================================== */

test("earnings are bucketed by month, oldest first", () => {
  const points = earningsByMonth([
    earning("recurring", TIER, "a", { createdAt: "2026-03-01T00:00:00Z" }),
    earning("recurring", TIER, "a", { createdAt: "2026-01-01T00:00:00Z" }),
    earning("recurring", TIER, "a", { createdAt: "2026-03-20T00:00:00Z" }),
  ]);

  assert.deepEqual(
    points.map((p) => p.month),
    ["2026-01", "2026-03"],
  );
  assert.equal(points[1].amountKobo, TIER * 2);
  assert.equal(points[1].count, 2);
});

test("only months with activity appear, so one referral is not twelve empty bars", () => {
  const points = earningsByMonth([earning("signup", 2_000_000, "a", { createdAt: "2026-02-01T00:00:00Z" })]);
  assert.equal(points.length, 1);
});

test("a row with an unparseable date is skipped rather than inventing a month", () => {
  const points = earningsByMonth([
    earning("recurring", TIER, "a", { createdAt: "not-a-date" }),
    earning("recurring", TIER, "a", { createdAt: undefined }),
    earning("recurring", TIER, "a", { createdAt: "2026-05-01T00:00:00Z" }),
  ]);
  assert.deepEqual(
    points.map((p) => p.month),
    ["2026-05"],
  );
});

/* ========================================================================== */
/* The funnel                                                                 */
/* ========================================================================== */

test("a partner with nobody yet is told what to do, not shown a zero", () => {
  const funnel = referralFunnel([], []);
  assert.equal(funnel.signedUp, 0);
  assert.equal(funnel.conversionPct, 0, "never NaN");
  assert.match(funnel.headline, /Share your link/);
});

test("signups that never subscribed are named as the problem", () => {
  // Five businesses created accounts and none subscribed: the messaging or the
  // audience is the issue, and the headline says so.
  const funnel = referralFunnel(
    ["a", "b", "c", "d", "e"].map((id) => referral(id, "inactive")),
    [],
  );
  assert.equal(funnel.signedUp, 5);
  assert.equal(funnel.subscribed, 0);
  assert.equal(funnel.conversionPct, 0);
  assert.match(funnel.headline, /none subscribed yet/);
});

test("conversion counts everyone who EVER subscribed, not just current payers", () => {
  // This is the interpretation that matters. `b` subscribed and later cancelled:
  // they converted. Counting only current subscribers would make the partner's
  // success rate fall as their customers churn — the opposite of informative.
  const funnel = referralFunnel(
    [referral("a", "active"), referral("b", "canceled"), referral("c", "inactive")],
    [earning("subscription", 4_000_000, "b")],
  );

  assert.equal(funnel.signedUp, 3);
  assert.equal(funnel.subscribed, 2, "a is paying, b subscribed once");
  assert.equal(funnel.stillPaying, 1);
  assert.equal(funnel.conversionPct, 66.7);
  assert.equal(funnel.churnPct, 50, "one of the two subscribers has stopped");
});

test("a paying referral counts even with no ledger rows", () => {
  // Commission credited before this report existed must not vanish from the
  // conversion figure.
  const funnel = referralFunnel([referral("a", "active")], []);
  assert.equal(funnel.subscribed, 1);
  assert.equal(funnel.conversionPct, 100);
});

test("the headline states the ratio, and every branch is a real sentence", () => {
  const good = referralFunnel(
    [referral("a", "active"), referral("b", "active"), referral("c", "inactive"), referral("d", "active")],
    [],
  );
  assert.match(good.headline, /3 of 4 referrals are paying you 75%/);

  const allChurned = referralFunnel([referral("a", "canceled")], [earning("subscription", 4_000_000, "a")]);
  assert.match(allChurned.headline, /none are still paying/);

  for (const funnel of [referralFunnel([], []), good, allChurned]) {
    assert.ok(!/NaN|undefined|Infinity/.test(funnel.headline), `bad headline: ${funnel.headline}`);
  }
});

/* ========================================================================== */
/* The run-rate                                                               */
/* ========================================================================== */

test("the run-rate counts only referrals still paying", () => {
  const referrals = [referral("a", "active"), referral("b", "canceled"), referral("c", "past_due"), referral("d", "inactive")];
  const earnings = referrals.map((r) => earning("subscription", 4_000_000, r.organizationId));

  const runRate = recurringRunRate({ referrals, earnings, recurringMonthlyKobo: TIER });
  // a and c are paying — three left.
  assert.equal(runRate.payingReferrals, 2);
  assert.equal(runRate.monthlyKobo, TIER * 2);
  assert.equal(runRate.annualKobo, TIER * 24);
});

test("a referral that never subscribed is not recurring income", () => {
  // Signed up (`inactive`), never paid. Counting them would inflate the run-rate
  // with money that has never arrived.
  const referrals = [referral("a", "active"), referral("b", "inactive")];
  const earnings = [earning("subscription", 4_000_000, "a")];
  const runRate = recurringRunRate({ referrals, earnings, recurringMonthlyKobo: TIER });
  assert.equal(runRate.payingReferrals, 1);
  assert.equal(runRate.monthlyKobo, TIER);
});

test("a paying referral counts before its first commission row exists", () => {
  // The status is the authority on whether somebody is subscribed, and a partner
  // must not see a lower run-rate than they are owed just because the recurring
  // row for this month has not been written yet.
  const referrals = [referral("a", "active")];
  const runRate = recurringRunRate({ referrals, earnings: [], recurringMonthlyKobo: TIER });
  assert.equal(runRate.payingReferrals, 1);
  assert.equal(runRate.monthlyKobo, TIER);
});

test("nobody paying gives a zero run-rate and no division by zero", () => {
  const runRate = recurringRunRate({ referrals: [referral("a", "canceled")], earnings: [], recurringMonthlyKobo: TIER });
  assert.equal(runRate.monthlyKobo, 0);
  assert.equal(runRate.payingReferrals, 0);
  assert.equal(runRate.changePct, 0);
  // Falls back to the tier rather than dividing by zero.
  assert.equal(runRate.perReferralKobo, TIER);
});

test("the month-on-month direction comes from the ledger, not the run-rate", () => {
  const earnings = [
    earning("recurring", TIER, "a", { periodKey: "2026-01" }),
    earning("recurring", TIER, "a", { periodKey: "2026-01" }),
  ];
  const runRate = recurringRunRate({
    referrals: [referral("a", "active"), referral("b", "active"), referral("c", "active")],
    earnings,
    recurringMonthlyKobo: TIER,
    previousPeriod: "2026-01",
  });
  // Now 3 × ₦3,500, previously ₦7,000 → +50%.
  assert.equal(runRate.lastMonthKobo, TIER * 2);
  assert.equal(runRate.changePct, 50);
});

test("no previous month means no percentage, not an infinite one", () => {
  const runRate = recurringRunRate({
    referrals: [referral("a", "active")],
    earnings: [],
    recurringMonthlyKobo: TIER,
    previousPeriod: "2026-01",
  });
  assert.equal(runRate.changePct, 0);
});

test("the projection is the run-rate over twelve months", () => {
  const runRate = recurringRunRate({
    referrals: [referral("a", "active"), referral("b", "active")],
    earnings: [],
    recurringMonthlyKobo: TIER,
  });
  assert.equal(projectedTwelveMonths(runRate), TIER * 2 * 12);
});

/* ========================================================================== */
/* What one referral is worth                                                 */
/* ========================================================================== */

test("average value is per referral, and the best is named", () => {
  const value = referralValue({
    earnings: [
      earning("signup", 2_000_000, "a"),
      earning("subscription", 4_000_000, "a"),
      earning("signup", 2_000_000, "b"),
    ],
    businessNames: { a: "Lekki Aesthetics", b: "Ikoyi Spa" },
    modelledFirstYearKobo: 10_200_000,
  });

  // a: ₦60,000, b: ₦20,000 → average ₦40,000
  assert.equal(value.averageKobo, 4_000_000);
  assert.equal(value.bestBusinessName, "Lekki Aesthetics");
  assert.equal(value.bestKobo, 6_000_000);
  assert.equal(value.modelledFirstYearKobo, 10_200_000);
});

test("no earnings yet means no average and no named best", () => {
  const value = referralValue({ earnings: [], businessNames: {}, modelledFirstYearKobo: 10_200_000 });
  assert.equal(value.averageKobo, 0);
  assert.equal(value.bestBusinessName, "");
  assert.equal(value.bestKobo, 0);
});

test("a referral with no name on file still reads as a sentence", () => {
  const value = referralValue({
    earnings: [earning("signup", 2_000_000, "unknown-org")],
    businessNames: {},
    modelledFirstYearKobo: 10_200_000,
  });
  assert.equal(value.bestBusinessName, "A referral");
});

/* ========================================================================== */
/* The whole picture                                                          */
/* ========================================================================== */

test("a realistic partner's dashboard is internally consistent", () => {
  // Two referrals: one subscribed and paying for three months, one signed up and
  // never subscribed.
  const referrals = [referral("a", "active"), referral("b", "inactive")];
  const earnings = [
    earning("signup", 2_000_000, "a"),
    earning("subscription", 4_000_000, "a"),
    earning("recurring", TIER, "a", { periodKey: "2026-02" }),
    earning("recurring", TIER, "a", { periodKey: "2026-03" }),
    earning("recurring", TIER, "a", { periodKey: "2026-04" }),
    earning("signup", 2_000_000, "b", { status: "pending" }),
  ];

  const byKind = earningsByKind(earnings);
  const funnel = referralFunnel(referrals, earnings);
  const runRate = recurringRunRate({ referrals, earnings, recurringMonthlyKobo: TIER, previousPeriod: "2026-03" });

  // ₦20,000 + ₦40,000 + 3 × ₦3,500 + ₦20,000 pending = ₦70,500 credited.
  assert.equal(byKind.totalKobo, 2_000_000 + 4_000_000 + TIER * 3 + 2_000_000);
  assert.equal(funnel.signedUp, 2);
  assert.equal(funnel.subscribed, 1);
  assert.equal(funnel.conversionPct, 50, "one of two signed up converted");
  assert.equal(runRate.monthlyKobo, TIER, "one referral is still paying");
  assert.equal(projectedTwelveMonths(runRate), TIER * 12);
});
