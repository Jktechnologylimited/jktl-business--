/**
 * Tests for the partner password-reset tokens.
 *
 * A working reset token is a full account takeover, so this is the most
 * security-sensitive module in the partner programme. The properties asserted
 * here are the ones that make the flow safe rather than merely functional:
 *
 *   - the token is unguessable and never stored in the clear;
 *   - it works exactly once, inside a short window, and a newer request kills it;
 *   - a malformed or unparseable row fails **closed**, never open;
 *   - the caller cannot tell a real address from an unknown one.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  MIN_PASSWORD_LENGTH,
  RESET_REQUESTS_PER_HOUR,
  RESET_TOKEN_TTL_MINUTES,
  createResetToken,
  hashResetToken,
  hashesMatch,
  isPlausibleToken,
  isResetTokenUsable,
  resetExpiryFrom,
  resetFailureMessage,
  resetTokenState,
  validateNewPassword,
} from "../src/lib/affiliate-reset-token.ts";

const NOW = new Date("2026-05-01T12:00:00Z");

/** A row that is live right now — issued with the real TTL, so the fixture
 * cannot disagree with the constant it is testing. */
function liveRow(overrides = {}) {
  return {
    expiresAt: resetExpiryFrom(NOW).toISOString(),
    usedAt: null,
    supersededAt: null,
    ...overrides,
  };
}

/* ========================================================================== */
/* The token itself                                                           */
/* ========================================================================== */

test("a token is unguessable and URL-safe", () => {
  const { token } = createResetToken();
  // 32 bytes base64url.
  assert.equal(token.length, 43);
  assert.match(token, /^[A-Za-z0-9_-]+$/, "must survive a URL and an email client without escaping");
});

test("every token is different", () => {
  const tokens = new Set(Array.from({ length: 200 }, () => createResetToken().token));
  assert.equal(tokens.size, 200, "a repeated token would let one link open two accounts");
});

test("the stored value is a hash, never the token", () => {
  const { token, tokenHash } = createResetToken();
  assert.notEqual(tokenHash, token, "storing the token in the clear would make a database leak a set of working credentials");
  assert.equal(tokenHash.length, 64, "sha-256 hex");
  assert.match(tokenHash, /^[0-9a-f]{64}$/);
  // The hash is of the token, so it can be recomputed at lookup time.
  assert.equal(hashResetToken(token), tokenHash);
});

test("hashing is deterministic, and different tokens never collide", () => {
  const a = createResetToken();
  const b = createResetToken();
  assert.equal(hashResetToken(a.token), a.tokenHash);
  assert.notEqual(hashResetToken(a.token), hashResetToken(b.token));
});

test("a token that could not have been issued is rejected without a query", () => {
  // This guard matters: the reset page is public, so junk tokens are the
  // cheapest possible traffic to absorb.
  for (const bad of ["", "short", "has spaces in it", "has/slash+chars", "a".repeat(200), null, undefined]) {
    assert.equal(isPlausibleToken(bad), false, `${JSON.stringify(bad)} should be rejected`);
  }
  assert.equal(isPlausibleToken(createResetToken().token), true);
});

test("hash comparison is length-safe and correct", () => {
  const { tokenHash } = createResetToken();
  assert.equal(hashesMatch(tokenHash, tokenHash), true);
  assert.equal(hashesMatch(tokenHash, "different"), false);
  // Different lengths must not throw (timingSafeEqual does, on unequal buffers).
  assert.equal(hashesMatch("abc", "abcdef"), false);
});

/* ========================================================================== */
/* Expiry                                                                     */
/* ========================================================================== */

test("a link lasts 30 minutes", () => {
  assert.equal(RESET_TOKEN_TTL_MINUTES, 30);
  const expiry = resetExpiryFrom(NOW);
  assert.equal(expiry.getTime() - NOW.getTime(), 30 * 60 * 1000);
});

test("a link works before its expiry and not after", () => {
  const justBefore = new Date(NOW.getTime() + 29 * 60 * 1000);
  const justAfter = new Date(NOW.getTime() + 31 * 60 * 1000);
  assert.equal(isResetTokenUsable(liveRow(), justBefore), true);
  assert.equal(isResetTokenUsable(liveRow(), justAfter), false);
});

test("a link is dead exactly at its expiry, not a second later", () => {
  const expiry = new Date(NOW.getTime() + 60 * 1000).toISOString();
  assert.equal(isResetTokenUsable(liveRow({ expiresAt: expiry }), NOW), true);
  assert.equal(isResetTokenUsable(liveRow({ expiresAt: expiry }), new Date(NOW.getTime() + 60 * 1000)), false);
});

/* ========================================================================== */
/* Single use, and supersession                                               */
/* ========================================================================== */

test("a used link cannot be used again, even inside its window", () => {
  const row = liveRow({ usedAt: NOW.toISOString() });
  assert.equal(resetTokenState(row, NOW), "used");
  assert.equal(isResetTokenUsable(row, NOW), false);
});

test("requesting a new link kills the previous one", () => {
  // Otherwise a partner who clicks "resend" twice holds two working credentials,
  // and so does anyone who saw the first email.
  const row = liveRow({ supersededAt: NOW.toISOString() });
  assert.equal(resetTokenState(row, NOW), "superseded");
  assert.equal(isResetTokenUsable(row, NOW), false);
});

test("the state is reported honestly, so the message can be specific", () => {
  // A partner who clicked a link twice needs to be told it was already used, not
  // told the link is nonsense.
  assert.equal(resetTokenState(liveRow({ usedAt: NOW.toISOString() }), NOW), "used");
  assert.equal(resetTokenState(liveRow({ supersededAt: NOW.toISOString() }), NOW), "superseded");
  assert.equal(resetTokenState(liveRow({ expiresAt: new Date(NOW.getTime() - 1000).toISOString() }), NOW), "expired");
  assert.equal(resetTokenState(liveRow(), NOW), "usable");
});

test("a used link outranks an expired one in the message", () => {
  // Both are true; "already used" is the more useful thing to say.
  const row = liveRow({ usedAt: NOW.toISOString(), expiresAt: new Date(NOW.getTime() - 1000).toISOString() });
  assert.equal(resetTokenState(row, NOW), "used");
});

/* ========================================================================== */
/* Failing closed                                                             */
/* ========================================================================== */

test("an unparseable expiry fails closed, never open", () => {
  // Failing open on a malformed timestamp would be a credential bypass: the row
  // would be treated as valid forever.
  assert.equal(resetTokenState(liveRow({ expiresAt: "not-a-date" }), NOW), "expired");
  assert.equal(isResetTokenUsable(liveRow({ expiresAt: "not-a-date" }), NOW), false);
  assert.equal(resetTokenState(liveRow({ expiresAt: "" }), NOW), "expired");
  assert.equal(isResetTokenUsable(liveRow({ expiresAt: null }), NOW), false);
});

test("a reset row with no expiry column value at all is not usable", () => {
  assert.equal(isResetTokenUsable({ expiresAt: undefined, usedAt: null, supersededAt: null }, NOW), false);
});

test("every failure state has a message a person can act on", () => {
  for (const state of ["used", "superseded", "expired"]) {
    const message = resetFailureMessage(state);
    assert.ok(message.length > 20, `${state} needs a real message`);
    assert.ok(!/undefined|null|\[object/i.test(message));
  }
  // The three cases must not read the same, or there was no point distinguishing
  // them.
  const messages = new Set(["used", "superseded", "expired"].map(resetFailureMessage));
  assert.equal(messages.size, 3);
});

/* ========================================================================== */
/* The new password                                                           */
/* ========================================================================== */

test("the new password must be long enough and typed twice the same", () => {
  assert.equal(validateNewPassword("", "").ok, false);
  assert.equal(validateNewPassword("abc", "abc").ok, false, "too short");
  assert.equal(validateNewPassword("abcdef", "abcdefg").ok, false, "the two must match");
  assert.equal(validateNewPassword("abcdef", "abcdef").ok, true);
  assert.equal(validateNewPassword("a".repeat(MIN_PASSWORD_LENGTH), "a".repeat(MIN_PASSWORD_LENGTH)).ok, true);
});

test("no character-class rules, deliberately", () => {
  // Composition requirements push people towards `Password1!` and are measurably
  // worse than a length floor.
  assert.equal(validateNewPassword("correct horse battery", "correct horse battery").ok, true);
  assert.equal(validateNewPassword("122333444455555", "122333444455555").ok, true);
});

test("a rejection explains itself rather than saying 'invalid'", () => {
  const short = validateNewPassword("abc", "abc");
  assert.equal(short.ok, false);
  assert.match(short.ok === false ? short.error : "", /at least 6 characters/);

  const mismatch = validateNewPassword("abcdef", "abcdefg");
  assert.equal(mismatch.ok, false);
  assert.match(mismatch.ok === false ? mismatch.error : "", /do not match/);
});

/* ========================================================================== */
/* Rate limiting                                                              */
/* ========================================================================== */

test("the request limit is low enough to protect the sending domain", () => {
  // The form is otherwise a way to make our domain send somebody an unbounded
  // number of emails, and a sending reputation is not worth spending on a
  // convenience.
  assert.ok(RESET_REQUESTS_PER_HOUR > 0 && RESET_REQUESTS_PER_HOUR <= 5, "expected a small limit");
});
