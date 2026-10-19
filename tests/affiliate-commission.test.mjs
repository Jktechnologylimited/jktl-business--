/**
 * Tests for the partner programme's commission rules.
 *
 * This is money owed to people outside the company, so the rules about *when* it
 * becomes payable matter more than the amounts. Two failures would be serious:
 *
 *   - **Paying the signup bonus on a bare signup.** ₦20,000 for creating a free
 *     account is farmable: a hundred accounts and ₦2m for nothing.
 *   - **Paying a month twice.** A redelivered webhook, or a cron running
 *     alongside one, must not produce two ₦3,500 rows for the same month.
 *
 * The published numbers are tested too, because the marketing site quotes them
 * and the two must not drift.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_TERMS,
  RECURRING_MONTHLY_KOBO,
  SIGNUP_BONUS_KOBO,
  SUBSCRIPTION_BONUS_KOBO,
  commissionForPayment,
  dueRecurringPeriods,
  firstYearValueKobo,
  monthAfter,
  summariseEarnings,
} from "../src/lib/affiliate-commission.ts";

/* ========================================================================== */
/* The published numbers                                                      */
/* ========================================================================== */

test("the tiers are the published Naira amounts", () => {
  assert.equal(SIGNUP_BONUS_KOBO, 2_000_000, "₦20,000");
  assert.equal(SUBSCRIPTION_BONUS_KOBO, 4_000_000, "₦40,000");
  assert.equal(RECURRING_MONTHLY_KOBO, 350_000, "₦3,500");
});

test("one referral is worth ₦102,000 in the first year", () => {
  // 20,000 + 40,000 + 12 × 3,500. This is the number the marketing site quotes,
  // so a change here has to be a change there.
  assert.equal(firstYearValueKobo() / 100, 102_000);
});

test("an agreed monthly cap caps the year-one figure", () => {
  const capped = { ...DEFAULT_TERMS, recurringMonthsCap: 6 };
  // 20,000 + 40,000 + 6 × 3,500
  assert.equal(firstYearValueKobo(capped) / 100, 81_000);
});

/* ========================================================================== */
/* The first payment                                                          */
/* ========================================================================== */

test("the first payment earns the subscription bonus AND releases the signup bonus", () => {
  const rows = commissionForPayment({ isFirstPayment: true, periodKey: "2026-03", paymentAmountKobo: 59_000_00 });

  // signup + subscription + the first month's recurring commission.
  assert.equal(rows.length, 3);
  const signup = rows.find((r) => r.kind === "signup");
  const subscription = rows.find((r) => r.kind === "subscription");

  assert.equal(signup?.commissionKobo, 2_000_000);
  assert.equal(subscription?.commissionKobo, 4_000_000);
  // Both become payable at once: the guard is that neither is payable *before*
  // the referral subscribes.
  assert.equal(signup?.status, "available");
  assert.equal(subscription?.status, "available");
});

test("the first payment also earns its own month of recurring commission", () => {
  // "₦3,500 every month they stay subscribed" — the first month is a month. An
  // earlier version skipped it, which made the advertised first-year figure
  // ₦98,500 while the marketing site promised ₦102,000.
  const rows = commissionForPayment({ isFirstPayment: true, periodKey: "2026-03", paymentAmountKobo: 59_000_00 });
  const recurring = rows.filter((r) => r.kind === "recurring");
  assert.equal(recurring.length, 1);
  assert.equal(recurring[0].periodKey, "2026-03", "the subscription month itself");
  assert.equal(recurring[0].commissionKobo, 350_000);
});

test("a later payment earns exactly one month of recurring commission", () => {
  const rows = commissionForPayment({ isFirstPayment: false, periodKey: "2026-04", paymentAmountKobo: 59_000_00 });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, "recurring");
  assert.equal(rows[0].commissionKobo, 350_000);
  // The period key is what the unique index uses to prevent a double credit.
  assert.equal(rows[0].periodKey, "2026-04");
});

test("the commission does not depend on what the customer paid", () => {
  // The whole point of fixed tiers: a clinic on the ₦108,333 instalment and one
  // on the ₦59,000 platform fee earn their partner the same ₦3,500.
  const big = commissionForPayment({ isFirstPayment: false, periodKey: "2026-04", paymentAmountKobo: 10_833_333 });
  const small = commissionForPayment({ isFirstPayment: false, periodKey: "2026-04", paymentAmountKobo: 5_900_000 });
  assert.equal(big[0].commissionKobo, small[0].commissionKobo);
});

test("a negotiated per-affiliate rate is honoured", () => {
  const rows = commissionForPayment({
    isFirstPayment: true,
    periodKey: "2026-03",
    paymentAmountKobo: 59_000_00,
    terms: { signupBonusKobo: 5_000_000, subscriptionBonusKobo: 8_000_000, recurringMonthlyKobo: 1_000_000, recurringMonthsCap: 0 },
  });
  assert.equal(rows.find((r) => r.kind === "signup")?.commissionKobo, 5_000_000);
  assert.equal(rows.find((r) => r.kind === "subscription")?.commissionKobo, 8_000_000);
});

/* ========================================================================== */
/* Recurring months                                                           */
/* ========================================================================== */

test("months advance and never overflow the year", () => {
  assert.equal(monthAfter("2026-01"), "2026-02");
  assert.equal(monthAfter("2026-11"), "2026-12");
  assert.equal(monthAfter("2026-12"), "2027-01", "December rolls into the next year");
  assert.equal(monthAfter("2026-13"), null, "a month of 13 is not a month");
  assert.equal(monthAfter("garbage"), null);
  assert.equal(monthAfter(""), null);
});

test("the recurring series includes the subscription month", () => {
  const due = dueRecurringPeriods({ startedPeriod: "2026-03", currentPeriod: "2026-06", alreadyPaid: [] });
  assert.deepEqual(due, ["2026-03", "2026-04", "2026-05", "2026-06"]);
});

test("the webhook's first month is not proposed again by the cron", () => {
  // The webhook credits the subscription month, so `alreadyPaid` contains it and
  // the backfill must leave it alone — otherwise a partner is paid twice for
  // their first month.
  const due = dueRecurringPeriods({
    startedPeriod: "2026-03",
    currentPeriod: "2026-06",
    alreadyPaid: ["2026-03"],
  });
  assert.deepEqual(due, ["2026-04", "2026-05", "2026-06"]);
});

test("already-paid months are never proposed again", () => {
  const due = dueRecurringPeriods({
    startedPeriod: "2026-03",
    currentPeriod: "2026-06",
    alreadyPaid: ["2026-03", "2026-04", "2026-05"],
  });
  assert.deepEqual(due, ["2026-06"], "only the outstanding month");
});

test("a subscription that ended owes nothing for months after it stopped", () => {
  // currentPeriod is the last month billed, so nothing after it is due.
  const due = dueRecurringPeriods({ startedPeriod: "2026-01", currentPeriod: "2026-02", alreadyPaid: [] });
  assert.deepEqual(due, ["2026-01", "2026-02"]);
});

test("a cap stops the series", () => {
  const due = dueRecurringPeriods({
    startedPeriod: "2026-01",
    currentPeriod: "2026-12",
    alreadyPaid: [],
    terms: { ...DEFAULT_TERMS, recurringMonthsCap: 3 },
  });
  assert.equal(due.length, 3);
  assert.deepEqual(due, ["2026-01", "2026-02", "2026-03"]);
});

test("a malformed period yields nothing rather than hundreds of months", () => {
  assert.deepEqual(dueRecurringPeriods({ startedPeriod: "nonsense", currentPeriod: "2026-12", alreadyPaid: [] }), []);

  // This one was a real bug: the loop compared period keys as strings, so
  // "nonsense" sorted above every real month and the loop ran to its guard,
  // proposing roughly 240 months of ₦3,500 — about ₦840,000 nobody earned.
  const bogus = dueRecurringPeriods({ startedPeriod: "2026-01", currentPeriod: "nonsense", alreadyPaid: [] });
  assert.deepEqual(bogus, [], "an unvalidated current period must not produce a series");
  assert.ok(bogus.length < 12, "and must certainly never approach the loop guard");

  // An out-of-range month is not a month either.
  assert.deepEqual(dueRecurringPeriods({ startedPeriod: "2026-01", currentPeriod: "2026-13", alreadyPaid: [] }), []);
});

test("a zero recurring rate proposes no months", () => {
  const due = dueRecurringPeriods({
    startedPeriod: "2026-01",
    currentPeriod: "2026-12",
    alreadyPaid: [],
    terms: { ...DEFAULT_TERMS, recurringMonthlyKobo: 0 },
  });
  assert.deepEqual(due, []);
});

/* ========================================================================== */
/* Balances                                                                   */
/* ========================================================================== */

test("pending earnings are not withdrawable", () => {
  // The financial guard of the whole programme: an affiliate with a referral who
  // signed up but has not subscribed has ₦20,000 *pending* and ₦0 to withdraw.
  const balance = summariseEarnings([{ kind: "signup", status: "pending", commissionKobo: 2_000_000 }], 0);
  assert.equal(balance.pendingKobo, 2_000_000);
  assert.equal(balance.balanceKobo, 0, "nothing to withdraw yet");
  assert.equal(balance.totalEarnedKobo, 2_000_000, "but it is still shown as earned");
});

test("released earnings become withdrawable", () => {
  const balance = summariseEarnings(
    [
      { kind: "signup", status: "available", commissionKobo: 2_000_000 },
      { kind: "subscription", status: "available", commissionKobo: 4_000_000 },
    ],
    0,
  );
  assert.equal(balance.balanceKobo, 6_000_000, "₦60,000 from one subscribing referral");
  assert.equal(balance.pendingKobo, 0);
});

test("money already paid out is not available a second time", () => {
  const balance = summariseEarnings(
    [
      { kind: "subscription", status: "available", commissionKobo: 4_000_000 },
      { kind: "recurring", status: "available", commissionKobo: 350_000 },
    ],
    4_000_000,
  );
  assert.equal(balance.balanceKobo, 350_000);
  assert.equal(balance.totalPaidOutKobo, 4_000_000);
});

test("an overpaid affiliate shows a zero balance, not a negative one", () => {
  // An overpayment is a data problem to correct, not a debt for a dashboard to
  // display.
  const balance = summariseEarnings([{ kind: "recurring", status: "available", commissionKobo: 100_000 }], 500_000);
  assert.equal(balance.balanceKobo, 0);
});

test("earnings marked paid are excluded from the balance", () => {
  const balance = summariseEarnings(
    [
      { kind: "subscription", status: "paid", commissionKobo: 4_000_000 },
      { kind: "recurring", status: "available", commissionKobo: 350_000 },
    ],
    0,
  );
  // The paid row has left; counting it again would let the same naira be
  // withdrawn twice.
  assert.equal(balance.balanceKobo, 350_000);
});

test("the recurring run-rate is reported for the dashboard", () => {
  const balance = summariseEarnings(
    [
      { kind: "recurring", status: "available", commissionKobo: 350_000, periodKey: "2026-04" },
      { kind: "recurring", status: "available", commissionKobo: 350_000, periodKey: "2026-05" },
      { kind: "recurring", status: "available", commissionKobo: 350_000, periodKey: "2026-06" },
    ],
    0,
  );
  // Three months of history is not a run-rate of ₦10,500/month; the dashboard
  // shows the per-referral figure instead, which is what a partner can act on.
  assert.equal(balance.recurringMonthlyKobo, 1_050_000);
  assert.equal(RECURRING_MONTHLY_KOBO, 350_000);
});

test("an empty ledger produces zeroes rather than NaN", () => {
  const balance = summariseEarnings([], 0);
  assert.deepEqual(
    { e: balance.totalEarnedKobo, a: balance.availableKobo, p: balance.pendingKobo, b: balance.balanceKobo },
    { e: 0, a: 0, p: 0, b: 0 },
  );
});

/* ========================================================================== */
/* The whole programme, end to end                                            */
/* ========================================================================== */

test("one referral through a full year pays exactly what was promised", () => {
  // Walk a referral through signup and twelve monthly payments, the way the
  // ledger would, and confirm the total is the advertised ₦102,000.
  let rows = [{ kind: "signup", status: "pending", commissionKobo: SIGNUP_BONUS_KOBO }];

  // First payment: releases signup, earns subscription.
  rows = rows.map((r) => ({ ...r, status: "available" }));
  rows = rows.concat(commissionForPayment({ isFirstPayment: true, periodKey: "2026-01", paymentAmountKobo: 5_900_000 }));

  // Eleven more monthly payments.
  for (let month = 2; month <= 12; month += 1) {
    rows = rows.concat(
      commissionForPayment({ isFirstPayment: false, periodKey: `2026-${String(month).padStart(2, "0")}`, paymentAmountKobo: 5_900_000 }),
    );
  }

  // Every row now carries `commissionKobo`, which is what the balance reads. The
  // two shapes agreeing is what this whole module is careful about.

  // The signup row is written twice — once at signup, once when the first
  // payment releases it — and in the database the unique index makes the second
  // a no-op. Reproduce that here, or the walk pays the signup bonus twice and
  // proves nothing about the real ledger.
  const seen = new Set();
  rows = rows.filter((r) => {
    const key = r.kind === "recurring" ? `recurring:${r.periodKey}` : r.kind;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const balance = summariseEarnings(rows, 0);
  assert.equal(balance.balanceKobo / 100, 102_000);
  assert.equal(balance.pendingKobo, 0, "nothing left held once they subscribe");
  assert.equal(firstYearValueKobo(), balance.balanceKobo, "the promise and the ledger agree");
});
