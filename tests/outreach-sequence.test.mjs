/**
 * Tests for the outreach sequence's pure core.
 *
 * These are the rules that decide whether a stranger gets emailed again, so they
 * are asserted rather than trusted. Three kinds of mistake are expensive here and
 * none of them is caught by a type:
 *
 *   - sending the next step the day after the last one, turning the sequence
 *     back into the blast it was meant to replace;
 *   - emailing somebody who replied, unsubscribed or already bought — the
 *     fastest route to a complaint;
 *   - an email that names nobody and carries no working opt-out.
 *
 * No database, no clock, no network: every input is passed in, so a failing test
 * means the rule is wrong rather than that a fixture moved.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  SEQUENCE_STEPS,
  dueStep,
  firstStepKey,
  isFinalStep,
  nextOutreachAt,
  nextStepKey,
  renderStep,
  stepByKey,
} from "../src/lib/prospects/sequence.ts";

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date("2026-03-02T09:00:00.000Z");
const at = (days) => new Date(T0.getTime() + days * DAY);

const CTX = {
  businessName: "Vitalis Mens Health",
  city: "Yenagoa",
  siteUrl: "https://jktl.com.ng/sites/vitalis",
  myBusiness: "JKTL Business",
  unsubscribeUrl: "https://jktl.com.ng/unsubscribe?token=abc123",
};

/** A prospect that has never been sent anything. */
const unstarted = {
  currentStepKey: "",
  lastSentAt: null,
  now: T0,
  replied: false,
  unsubscribed: false,
  converted: false,
};

const KEYS = ["intro", "tips", "proof", "offer"];

/* ------------------------------------------------------------------ */
/* The cadence                                                        */
/* ------------------------------------------------------------------ */

test("the sequence is the four steps, in order, with increasing day offsets", () => {
  assert.equal(SEQUENCE_STEPS.length, 4);
  assert.deepEqual(
    SEQUENCE_STEPS.map((step) => step.key),
    KEYS,
  );
  assert.deepEqual(
    SEQUENCE_STEPS.map((step) => step.dayOffset),
    [0, 4, 11, 21],
  );

  // Strictly increasing, starting at zero: order is the cadence, and a step that
  // does not move forward in time would be sent immediately after its predecessor.
  assert.equal(SEQUENCE_STEPS[0].dayOffset, 0);
  for (let i = 1; i < SEQUENCE_STEPS.length; i += 1) {
    assert.ok(
      SEQUENCE_STEPS[i].dayOffset > SEQUENCE_STEPS[i - 1].dayOffset,
      `offset ${i} (${SEQUENCE_STEPS[i].dayOffset}) must be after ${SEQUENCE_STEPS[i - 1].dayOffset}`,
    );
  }
});

test("every step has a subject and a body that use the context", () => {
  for (const step of SEQUENCE_STEPS) {
    assert.equal(typeof step.subject, "function", `${step.key} needs a subject`);
    assert.equal(typeof step.body, "function", `${step.key} needs a body`);

    const subject = step.subject(CTX.businessName, CTX.myBusiness);
    assert.ok(subject.length > 0);
    // Their name first: a subject that leads with the sender reads as an advert.
    assert.ok(subject.includes(CTX.businessName), `${step.key} subject must name the business`);
    assert.ok(subject.includes(CTX.myBusiness), `${step.key} subject must name the sender`);

    const body = step.body(CTX);
    assert.ok(body.length > 200, `${step.key} body is too thin to be worth sending`);
    assert.ok(body.includes(CTX.businessName), `${step.key} body must greet the business by name`);
    assert.ok(body.includes(CTX.unsubscribeUrl), `${step.key} body must carry the unsubscribe link`);
  }
});

/* ------------------------------------------------------------------ */
/* Position in the sequence                                           */
/* ------------------------------------------------------------------ */

test("the sequence starts at intro and the chain walks forward", () => {
  assert.equal(firstStepKey, "intro");
  assert.equal(nextStepKey("intro"), "tips");
  assert.equal(nextStepKey("tips"), "proof");
  assert.equal(nextStepKey("proof"), "offer");
});

test("the final step has no successor and is the only final step", () => {
  assert.equal(nextStepKey("offer"), null);
  assert.equal(isFinalStep("offer"), true);
  for (const key of ["intro", "tips", "proof"]) {
    assert.equal(isFinalStep(key), false, `${key} is not the final step`);
  }
});

test("an empty key means not started, and resolves to the first step", () => {
  assert.equal(nextStepKey(""), "intro");
  assert.equal(nextStepKey("   "), "intro");
});

test("an unknown step key is refused rather than guessed at", () => {
  assert.equal(stepByKey("nurture"), null);
  assert.equal(stepByKey(""), null);
  assert.equal(nextStepKey("nurture"), null);
  assert.equal(isFinalStep("nurture"), false);
  assert.equal(renderStep("nurture", CTX), null);
  // The dangerous guess would be "unknown, so start again" — that re-sends the
  // intro to somebody who may already have had all four.
  assert.equal(
    dueStep({ ...unstarted, currentStepKey: "nurture", lastSentAt: T0.toISOString(), now: at(30) }),
    null,
  );
});

/* ------------------------------------------------------------------ */
/* When nothing may be sent                                           */
/* ------------------------------------------------------------------ */

test("a reply stops the sequence, however long it has been", () => {
  for (const key of ["intro", "tips", "proof"]) {
    assert.equal(
      dueStep({ ...unstarted, currentStepKey: key, lastSentAt: T0.toISOString(), now: at(60), replied: true }),
      null,
      `a reply after ${key} must stop the sequence`,
    );
  }
});

test("an unsubscribe stops the sequence immediately and permanently", () => {
  for (const key of ["intro", "tips", "proof"]) {
    assert.equal(
      dueStep({ ...unstarted, currentStepKey: key, lastSentAt: T0.toISOString(), now: at(60), unsubscribed: true }),
      null,
      `an unsubscribe after ${key} must stop the sequence`,
    );
  }
});

test("a conversion stops the sequence — never sell a site to a customer", () => {
  for (const key of ["intro", "tips", "proof"]) {
    assert.equal(
      dueStep({ ...unstarted, currentStepKey: key, lastSentAt: T0.toISOString(), now: at(60), converted: true }),
      null,
      `a conversion after ${key} must stop the sequence`,
    );
  }
});

test("a prospect already at the final step never advances again", () => {
  assert.equal(
    dueStep({ ...unstarted, currentStepKey: "offer", lastSentAt: T0.toISOString(), now: at(365) }),
    null,
  );
});

test("a started sequence with no send date does not send", () => {
  // Without the anchor the wait cannot be proven, and guessing would send early.
  assert.equal(dueStep({ ...unstarted, currentStepKey: "intro", lastSentAt: null, now: at(30) }), null);
  assert.equal(dueStep({ ...unstarted, currentStepKey: "intro", lastSentAt: "not-a-date", now: at(30) }), null);
});

/* ------------------------------------------------------------------ */
/* The day offset                                                     */
/* ------------------------------------------------------------------ */

test("a prospect that has not started is due immediately", () => {
  assert.equal(dueStep(unstarted), "intro");
});

test("the intro's successor waits four days, not one", () => {
  const sent = { ...unstarted, currentStepKey: "intro", lastSentAt: T0.toISOString() };
  assert.equal(dueStep({ ...sent, now: at(0) }), null);
  assert.equal(dueStep({ ...sent, now: at(3) }), null, "three days is still too early");
  assert.equal(dueStep({ ...sent, now: at(4) }), "tips");
  assert.equal(dueStep({ ...sent, now: at(30) }), "tips");
});

test("later steps wait out their own gap, measured from the previous send", () => {
  const tips = { ...unstarted, currentStepKey: "tips", lastSentAt: T0.toISOString() };
  assert.equal(dueStep({ ...tips, now: at(6) }), null);
  assert.equal(dueStep({ ...tips, now: at(7) }), "proof");

  const proof = { ...unstarted, currentStepKey: "proof", lastSentAt: T0.toISOString() };
  assert.equal(dueStep({ ...proof, now: at(9) }), null);
  assert.equal(dueStep({ ...proof, now: at(10) }), "offer");
});

test("sent on time, the sequence lands on day 0, 4, 11 and 21", () => {
  let currentStepKey = "";
  let lastSentAt = null;
  const sentOn = [];

  for (let day = 0; day <= 21; day += 1) {
    const key = dueStep({ ...unstarted, currentStepKey, lastSentAt, now: at(day) });
    if (!key) continue;
    sentOn.push([day, key]);
    currentStepKey = key;
    lastSentAt = at(day).toISOString();
  }

  assert.deepEqual(sentOn, [
    [0, "intro"],
    [4, "tips"],
    [11, "proof"],
    [21, "offer"],
  ]);
  assert.equal(nextOutreachAt("offer", at(21)), null);
});

/* ------------------------------------------------------------------ */
/* What the email says                                                */
/* ------------------------------------------------------------------ */

test("rendering names the business and carries a working unsubscribe link", () => {
  for (const key of KEYS) {
    const email = renderStep(key, CTX);
    assert.ok(email, `${key} must render`);
    assert.ok(email.subject.includes(CTX.businessName));
    assert.ok(email.text.includes(CTX.businessName));
    assert.ok(email.html.includes(CTX.businessName));

    assert.ok(email.text.includes(CTX.unsubscribeUrl), `${key} text must include the opt-out`);
    // Not just present in the text: an HTML email needs a real anchor, or the
    // recipient has nothing to click.
    assert.ok(
      email.html.includes(`href="${CTX.unsubscribeUrl}"`),
      `${key} html must link the opt-out`,
    );
  }
});

test("the tips step is value with no pitch, and the offer is where the link lives", () => {
  const tips = renderStep("tips", CTX);
  assert.ok(tips);
  // "Free value, no pitch" is the point of step two: a site link here makes it
  // the same email four times and the whole sequence pointless.
  assert.equal(tips.text.includes(CTX.siteUrl), false);
  assert.equal(tips.html.includes(CTX.siteUrl), false);

  const offer = renderStep("offer", CTX);
  assert.ok(offer);
  assert.ok(offer.text.includes(CTX.siteUrl));
  assert.ok(offer.html.includes(`href="${CTX.siteUrl}"`));

  for (const key of ["intro", "proof"]) {
    const email = renderStep(key, CTX);
    assert.ok(email);
    if (key === "proof") assert.equal(email.text.includes(CTX.siteUrl), false, "proof is the soft CTA");
  }
});

test("a business name with HTML in it cannot break the email", () => {
  const hostile = { ...CTX, businessName: "Bright <Smile> & Co" };
  const email = renderStep("intro", hostile);
  assert.ok(email);
  assert.equal(email.html.includes("<Smile>"), false);
  assert.ok(email.html.includes("&lt;Smile&gt;"));
  assert.ok(email.text.includes("Bright <Smile> & Co"), "the plain-text version is not markup");
});
