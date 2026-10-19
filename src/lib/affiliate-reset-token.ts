/**
 * Password reset tokens.
 *
 * Pure and dependency-free apart from `node:crypto`, so the rules that decide
 * whether a reset link works are unit tested rather than trusted. This is the
 * most attractive surface in the app to attack — a working token is a full
 * account takeover — so the properties below are asserted, not assumed.
 *
 * The design, and why:
 *
 *   * **256 bits from `randomBytes`.** Not a UUID, not a timestamp, not anything
 *     derived from the account. A guessable token makes the whole flow theatre.
 *   * **Only the hash is stored.** The plaintext token exists in exactly two
 *     places: the email, and the URL the partner clicks. A database dump must not
 *     contain working credentials.
 *   * **A plain SHA-256, not bcrypt.** Deliberate, and the opposite of the choice
 *     made for passwords. A password is low-entropy and needs a slow hash to
 *     resist guessing; this is 256 bits of uniform randomness, so there is nothing
 *     to guess and a slow hash would only make every reset request cost CPU. What
 *     matters here is that the lookup is by hash, so the token is never compared
 *     in a way that leaks.
 *   * **Single use and a 30-minute life.**
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** How long a reset link works for. */
export const RESET_TOKEN_TTL_MINUTES = 30;

/**
 * How many reset emails one partner can be sent per hour.
 *
 * Low on purpose. The form is otherwise a way to make our domain send somebody an
 * unbounded number of emails, and a sending reputation that transactional mail
 * depends on is not worth spending on a convenience.
 */
export const RESET_REQUESTS_PER_HOUR = 3;

/** Minimum length for the new password. Matches the change-password rule. */
export const MIN_PASSWORD_LENGTH = 6;

/** A fresh token, and the hash to store for it. */
export function createResetToken(): { token: string; tokenHash: string } {
  // base64url so it survives a URL and an email client without escaping.
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashResetToken(token) };
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Whether a string looks like a token we could have issued, before any query.
 * Saves a database round trip on the inevitable junk requests. */
export function isPlausibleToken(token: string | null | undefined): boolean {
  if (!token) return false;
  // 32 bytes base64url is 43 characters, and this accepts the range rather than
  // the exact length so a future change to the byte count does not silently
  // reject every valid link.
  return /^[A-Za-z0-9_-]{20,128}$/.test(token);
}

/**
 * Whether a stored reset row can still be used.
 *
 * Kept separate from the query so the reason can be reported honestly to the
 * person clicking the link — "this link has expired" and "this link has already
 * been used" are different messages, and a partner who clicked twice needs the
 * second one to make sense.
 */
export type ResetTokenState = "usable" | "expired" | "used" | "superseded";

export function resetTokenState(
  row: { expiresAt: string | Date; usedAt: string | Date | null; supersededAt: string | Date | null },
  now: Date = new Date(),
): ResetTokenState {
  if (row.usedAt) return "used";
  if (row.supersededAt) return "superseded";
  const expiry = row.expiresAt instanceof Date ? row.expiresAt : new Date(row.expiresAt);
  // An unparseable expiry is treated as expired, never as valid. Failing open on
  // a malformed timestamp would be a credential bypass.
  if (Number.isNaN(expiry.getTime())) return "expired";
  return expiry.getTime() > now.getTime() ? "usable" : "expired";
}

export function isResetTokenUsable(
  row: { expiresAt: string | Date; usedAt: string | Date | null; supersededAt: string | Date | null },
  now: Date = new Date(),
): boolean {
  return resetTokenState(row, now) === "usable";
}

/** When a token issued now should stop working. */
export function resetExpiryFrom(now: Date = new Date(), ttlMinutes = RESET_TOKEN_TTL_MINUTES): Date {
  return new Date(now.getTime() + ttlMinutes * 60 * 1000);
}

/** What the partner is told when a link cannot be used. */
export function resetFailureMessage(state: ResetTokenState): string {
  switch (state) {
    case "used":
      return "This reset link has already been used. If you need a new one, request another.";
    case "superseded":
      return "This reset link was replaced by a newer one. Check your inbox for the most recent email.";
    case "expired":
      return "This reset link has expired. Reset links work for 30 minutes — request a new one.";
    default:
      return "This reset link is not valid. Request a new one.";
  }
}

/**
 * Whether the new password is acceptable.
 *
 * Length only, and deliberately no character-class rules: composition
 * requirements push people towards `Password1!` and are worse than a length floor.
 * The one exception is rejecting a password identical to the old one, which is
 * checked by the caller because only it can see the hash.
 */
export function validateNewPassword(password: string, confirm: string): { ok: true } | { ok: false; error: string } {
  if (!password) return { ok: false, error: "Enter a new password." };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (password !== confirm) return { ok: false, error: "The two passwords do not match." };
  return { ok: true };
}

/**
 * A constant-time comparison of two token hashes.
 *
 * The lookup is by hash, so this is belt-and-braces — but the one place it
 * matters is a future refactor that fetches a row by id and compares afterwards,
 * and that refactor would otherwise introduce a timing oracle silently.
 */
export function hashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
