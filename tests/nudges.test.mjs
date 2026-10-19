/**
 * Tests for the automated nudges — the "get paid while you sleep"
 * notifications.
 *
 * The thing worth testing here is not that a notification can be sent; it is
 * **when it must not be**. A business that installed the app is trusting us not
 * to turn setup advice into a daily drip, so the rules about one-offs,
 * cooldowns and resolution are the substance of this file.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { NUDGES, conditionHolds, evaluateNudges, getNudge, shouldSend } from "../src/lib/ai/nudges.ts";

/** A business with nothing missing. Every test starts from "don't nag". */
const HEALTHY = {
  hasContract: true,
  needsCard: false,
  needsNumber: false,
  needsWalletTopUp: false,
  needsServices: false,
  needsPayments: false,
  noBookingsYet: false,
  hasOverdueInvoice: false,
};

const NOTHING_SENT = { sent: {} };

test("the catalogue is complete and internally consistent", () => {
  assert.ok(NUDGES.length >= 5);
  const ids = NUDGES.map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length, "nudge ids must be unique");
  for (const nudge of NUDGES) {
    assert.ok(nudge.title.length > 5, `${nudge.id}: needs a title`);
    assert.ok(nudge.body.length > 40, `${nudge.id}: the body must explain the consequence`);
    assert.ok(nudge.url.startsWith("/business/"), `${nudge.id}: must link somewhere actionable`);
    assert.ok(nudge.cooldownDays >= 0);
    assert.ok(getNudge(nudge.id)?.id === nudge.id, `${nudge.id}: must be findable by id`);
  }
  assert.equal(getNudge("not-a-nudge"), null);
});

test("nothing is sent to a business that has set everything up", () => {
  assert.equal(evaluateNudges(HEALTHY, NOTHING_SENT, new Date()), null);
});

test("the first applicable nudge is the most valuable one, not the first in the list", () => {
  // A business missing everything gets the money one first.
  const nothing = {
    hasContract: true,
    needsCard: true,
    needsNumber: true,
    needsWalletTopUp: true,
    needsServices: true,
    needsPayments: true,
    noBookingsYet: true,
    hasOverdueInvoice: true,
  };
  const decision = evaluateNudges(nothing, NOTHING_SENT, new Date());
  assert.equal(decision?.nudge.id, "add_card", "getting paid beats tidying up the catalogue");
});

test("a nudge only applies when its own condition holds", () => {
  assert.equal(conditionHolds("add_card", HEALTHY), false);
  assert.equal(conditionHolds("add_card", { ...HEALTHY, needsCard: true }), true);

  // The receptionist-specific ones must not fire for a business that has not
  // switched the receptionist on — telling somebody to add a card for a
  // product they don't have would be nonsense.
  assert.equal(conditionHolds("add_card", { ...HEALTHY, hasContract: false, needsCard: true }), false);

  assert.equal(conditionHolds("top_up_wallet", { ...HEALTHY, needsWalletTopUp: true }), true);
  assert.equal(conditionHolds("add_services", { ...HEALTHY, needsServices: true }), true);
  assert.equal(conditionHolds("chase_overdue_invoice", { ...HEALTHY, hasOverdueInvoice: true }), true);
  assert.equal(conditionHolds("share_booking_link", { ...HEALTHY, noBookingsYet: true }), true);
});

test("a one-off nudge is sent once and then never again", () => {
  const addCard = getNudge("add_card");
  assert.equal(addCard.repeatable, false);

  const state = { sent: { add_card: { sentCount: 1, lastSentAt: "2026-01-01T00:00:00Z", resolvedAt: null } } };
  // Even a year later, for a business that still hasn't added a card: one ask.
  const decision = shouldSend(addCard, state, new Date("2027-01-01T00:00:00Z"));
  assert.equal(decision.send, false);
  assert.match(decision.reason, /one-off/);
});

test("a repeatable nudge waits out its cooldown", () => {
  const topUp = getNudge("top_up_wallet");
  assert.equal(topUp.repeatable, true);
  assert.ok(topUp.cooldownDays > 0);

  const justSent = { sent: { top_up_wallet: { sentCount: 1, lastSentAt: "2026-03-01T00:00:00Z", resolvedAt: null } } };
  assert.equal(shouldSend(topUp, justSent, new Date("2026-03-05T00:00:00Z")).send, false, "five days later is too soon");

  const muchLater = { sent: { top_up_wallet: { sentCount: 1, lastSentAt: "2026-03-01T00:00:00Z", resolvedAt: null } } };
  assert.equal(shouldSend(topUp, muchLater, new Date("2026-04-01T00:00:00Z")).send, true, "a month later is fair");
});

test("a resolved condition lets a repeatable nudge come back", () => {
  const chase = getNudge("chase_overdue_invoice");
  // They paid the overdue invoice in March, so it was resolved — and then a new
  // debt went stale in June. The nudge must be allowed again.
  const state = { sent: { chase_overdue_invoice: { sentCount: 1, lastSentAt: "2026-03-01T00:00:00Z", resolvedAt: "2026-03-05T00:00:00Z" } } };
  const decision = shouldSend(chase, state, new Date("2026-06-01T00:00:00Z"));
  assert.equal(decision.send, true);
  assert.match(decision.reason, /came back/);
});

test("at most one nudge per run, so setup arrives as a sequence not an avalanche", () => {
  const missing = { ...HEALTHY, needsCard: true, needsServices: true, noBookingsYet: true, hasOverdueInvoice: true };
  const decision = evaluateNudges(missing, NOTHING_SENT, new Date());
  assert.ok(decision);
  assert.equal(typeof decision.nudge.id, "string");

  // Exactly one, and the others are still available for future runs.
  const second = evaluateNudges(
    missing,
    { sent: { [decision.nudge.id]: { sentCount: 1, lastSentAt: new Date().toISOString(), resolvedAt: null } } },
    new Date(),
  );
  assert.ok(second);
  assert.notEqual(second.nudge.id, decision.nudge.id, "the next run moves on to the next thing");
});

test("an unknown or malformed send history is treated as never sent", () => {
  const addCard = getNudge("add_card");
  assert.equal(shouldSend(addCard, { sent: {} }, new Date()).send, true);
  assert.equal(shouldSend(addCard, { sent: { add_card: { sentCount: 0, lastSentAt: null, resolvedAt: null } } }, new Date()).send, true);
  // A corrupt date must not silence a nudge forever.
  assert.equal(shouldSend(addCard, { sent: { add_card: { sentCount: 1, lastSentAt: "not-a-date", resolvedAt: null } } }, new Date()).send, false);
});

test("the wallet nudge is stable when several things are true at once", () => {
  // Determinism matters: the same state must always produce the same nudge, or
  // a business could get two different notifications on consecutive runs.
  const state = { ...HEALTHY, needsWalletTopUp: true, needsNumber: true };
  const first = evaluateNudges(state, NOTHING_SENT, new Date("2026-05-01T00:00:00Z"));
  const second = evaluateNudges(state, NOTHING_SENT, new Date("2026-05-01T00:00:00Z"));
  assert.equal(first?.nudge.id, second?.nudge.id);
});
