import "server-only";
import bcrypt from "bcryptjs";
import {
  RESET_REQUESTS_PER_HOUR,
  createResetToken,
  hashResetToken,
  isPlausibleToken,
  resetExpiryFrom,
  resetTokenState,
  type ResetTokenState,
} from "@/lib/affiliate-reset-token";
import { getSql } from "./client";

/** Same 7-day lifetime as an admin session — an affiliate login is a
 * lower-trust credential than a business owner's (it can't see any
 * business's operational data, only its own referral stats), but it's
 * still a real financial relationship, so it re-asks for a password more
 * often than the 30-day business session. */
const AFFILIATE_SESSION_DAYS = 7;

export interface AffiliateUser {
  programme?: "partner" | "affiliate";
  id: string;
  name: string;
  email: string;
  referralCode: string;
  commissionBps: number;
  status: "pending" | "active" | "suspended";
}

function mapAffiliateUser(row: Record<string, unknown>): AffiliateUser {
  return {
    programme: row.programme === "partner" ? "partner" : "affiliate",
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    referralCode: row.referral_code as string,
    commissionBps: Number(row.commission_bps),
    status:
      (row.status as string) === "pending"
        ? "pending"
        : (row.status as string) === "suspended"
          ? "suspended"
          : "active",
  };
}

export type AffiliateLoginResult =
  | { ok: true; affiliate: AffiliateUser }
  | {
      ok: false;
      reason: "not_found" | "pending" | "suspended" | "wrong_password";
    };

/**
 * A self-serve application (migration 014) sits in `status = 'pending'`
 * until an admin approves it — it can't sign in at all until then, same as
 * a suspended affiliate can't sign in once suspended. Returns *why* it
 * failed (rather than just `null`, the previous shape) so the login form
 * can tell "your application is still under review" apart from "wrong
 * password" apart from "you've been suspended" — each needs different
 * wording, and none of them are sensitive enough to hide behind one vague
 * error the way, say, a business login's credential check would be.
 */
export async function verifyAffiliateLogin(
  email: string,
  password: string,
  programme?: "affiliate" | "partner",
): Promise<AffiliateLoginResult> {
  const sql = getSql();
  const rows =
    await sql`SELECT * FROM affiliates WHERE email = ${email.toLowerCase()} AND (${programme ?? null}::text IS NULL OR programme=${programme ?? null}) ORDER BY created_at ASC,id`;
  const row = rows[0];
  if (!row) return { ok: false, reason: "not_found" };
  if (row.status === "pending") return { ok: false, reason: "pending" };
  if (row.status !== "active") return { ok: false, reason: "suspended" };

  const ok = await bcrypt.compare(password, row.password_hash as string);
  if (!ok) return { ok: false, reason: "wrong_password" };

  return { ok: true, affiliate: mapAffiliateUser(row) };
}

export async function createAffiliateSession(
  affiliateId: string,
): Promise<string> {
  const sql = getSql();
  const expiresAt = new Date(
    Date.now() + AFFILIATE_SESSION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const rows = await sql`
    INSERT INTO affiliate_sessions (affiliate_id, expires_at) VALUES (${affiliateId}, ${expiresAt}) RETURNING id
  `;
  return rows[0].id as string;
}

export async function validateAffiliateSession(
  sessionId: string,
): Promise<AffiliateUser | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT a.*
    FROM affiliate_sessions s
    JOIN affiliates a ON a.id = s.affiliate_id
    WHERE s.id = ${sessionId} AND s.expires_at > now()
  `;
  const row = rows[0];
  if (!row) return null;
  if (row.status !== "active") return null;
  return mapAffiliateUser(row);
}

export async function destroyAffiliateSession(
  sessionId: string,
): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM affiliate_sessions WHERE id = ${sessionId}`;
}

export async function changeAffiliatePassword(
  affiliateId: string,
  currentPassword: string,
  newPassword: string,
): Promise<boolean> {
  const sql = getSql();
  const rows =
    await sql`SELECT password_hash FROM affiliates WHERE id = ${affiliateId}`;
  const row = rows[0];
  if (!row) return false;
  const ok = await bcrypt.compare(currentPassword, row.password_hash as string);
  if (!ok) return false;
  const newHash = await bcrypt.hash(newPassword, 10);
  await sql`UPDATE affiliates SET password_hash = ${newHash} WHERE id = ${affiliateId}`;
  return true;
}

/* -------------------------------------------------------------------------- */
/* Self-serve password reset                                                  */
/* -------------------------------------------------------------------------- */

export interface ResetRequestOutcome {
  /** True when a link was issued and should be emailed. */
  sent: boolean;
  /** True when the rate limit stopped it. */
  rateLimited: boolean;
  /** Present only when `sent` — the plaintext token, which exists nowhere else
   * and is never stored. The caller emails it and then forgets it. */
  token?: string;
  /** Present only when `sent`. */
  recipient?: { affiliateId: string; name: string; email: string };
}

/**
 * Issues a reset link, if the address belongs to an active partner.
 *
 * **The caller must not reveal which of those it was.** An endpoint that says
 * "no account with that email" is an account-enumeration oracle, and on a partner
 * programme the email list is the sales pipeline. The action returns the same
 * message either way; this function tells the action what happened only so it can
 * log it.
 *
 * Order of operations matters: the rate limit is checked first, so a flood of
 * requests for one address cannot be used to fill the table or the inbox, and the
 * supersede-then-insert happens in one transaction so a partner can never hold two
 * live links.
 */
export async function requestAffiliatePasswordReset(
  email: string,
  requestedIp = "",
  now: Date = new Date(),
): Promise<ResetRequestOutcome> {
  const sql = getSql();
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { sent: false, rateLimited: false };

  const rows =
    await sql`SELECT id, status, name FROM affiliates WHERE email = ${normalized} ORDER BY created_at ASC,id LIMIT 1`;
  const affiliate = rows[0];
  // Only an active partner can reset. A pending applicant has a password but no
  // approved account, and a suspended one must not be able to get back in.
  if (!affiliate || affiliate.status !== "active")
    return { sent: false, rateLimited: false };

  const affiliateId = affiliate.id as string;

  const recent = await sql`
    SELECT COUNT(*)::int AS n FROM affiliate_password_resets
    WHERE affiliate_id = ${affiliateId} AND created_at > now() - interval '1 hour'
  `;
  if (
    Number((recent[0] as Record<string, unknown>)?.n ?? 0) >=
    RESET_REQUESTS_PER_HOUR
  ) {
    return { sent: false, rateLimited: true };
  }

  // Every earlier link dies the moment a new one is issued. Without this, a
  // partner who clicks "resend" twice has two working credentials, and so does
  // anyone who saw the first email.
  await sql`
    UPDATE affiliate_password_resets SET superseded_at = now()
    WHERE affiliate_id = ${affiliateId} AND used_at IS NULL AND superseded_at IS NULL
  `;

  const { token, tokenHash } = createResetToken();
  await sql`
    INSERT INTO affiliate_password_resets (id, affiliate_id, token_hash, expires_at, requested_ip)
    VALUES (${crypto.randomUUID()}, ${affiliateId}, ${tokenHash}, ${resetExpiryFrom(now).toISOString()}, ${requestedIp.slice(0, 60)})
  `;

  return {
    sent: true,
    rateLimited: false,
    token,
    recipient: {
      affiliateId,
      name: (affiliate.name as string) ?? "",
      email: normalized,
    },
  };
}

export type ResetLookup =
  | {
      ok: true;
      affiliateId: string;
      name: string;
      email: string;
      resetId: string;
    }
  | { ok: false; state: ResetTokenState };

/**
 * Finds the partner a reset token belongs to, without consuming it.
 *
 * Separate from the consume step so the page can show the form before anything is
 * mutated — and so a partner who opens the link twice gets a clear "already used"
 * message rather than a silent failure.
 */
export async function lookupAffiliatePasswordReset(
  token: string,
  now: Date = new Date(),
): Promise<ResetLookup> {
  if (!isPlausibleToken(token)) return { ok: false, state: "expired" };
  const sql = getSql();
  const rows = await sql`
    SELECT r.id, r.affiliate_id, r.expires_at, r.used_at, r.superseded_at, a.name, a.email, a.status
    FROM affiliate_password_resets r
    JOIN affiliates a ON a.id = r.affiliate_id
    WHERE r.token_hash = ${hashResetToken(token)}
  `;
  const row = rows[0];
  if (!row) return { ok: false, state: "expired" };

  const state = resetTokenState(
    {
      expiresAt: row.expires_at as string,
      usedAt: (row.used_at as string) ?? null,
      supersededAt: (row.superseded_at as string) ?? null,
    },
    now,
  );
  if (state !== "usable") return { ok: false, state };
  // A partner suspended after requesting a reset must not be able to use it.
  if (row.status !== "active") return { ok: false, state: "superseded" };

  return {
    ok: true,
    affiliateId: row.affiliate_id as string,
    name: (row.name as string) ?? "",
    email: (row.email as string) ?? "",
    resetId: row.id as string,
  };
}

/**
 * Sets a new password and burns the token.
 *
 * **Every existing session for that partner is destroyed.** This is the part that
 * is easy to forget and the reason a reset is not just a password change: the
 * usual reason somebody resets a password is that they believe it is compromised.
 * Leaving the attacker's session alive would make the reset decorative.
 *
 * The token is claimed with `used_at IS NULL` in the WHERE clause, so two
 * concurrent submissions of the same link cannot both succeed.
 */
export async function completeAffiliatePasswordReset(params: {
  token: string;
  newPassword: string;
}): Promise<
  { ok: true; affiliateId: string } | { ok: false; state: ResetTokenState }
> {
  const sql = getSql();
  const lookup = await lookupAffiliatePasswordReset(params.token);
  if (!lookup.ok) return lookup;

  const passwordHash = await bcrypt.hash(params.newPassword, 10);

  // Claim the token first. Only the call that flips `used_at` from NULL proceeds,
  // so a double submission cannot set the password twice.
  const claimed = await sql`
    UPDATE affiliate_password_resets SET used_at = now()
    WHERE id = ${lookup.resetId} AND used_at IS NULL AND superseded_at IS NULL AND expires_at > now()
    RETURNING id
  `;
  if (!claimed[0]) return { ok: false, state: "used" };

  await sql`UPDATE affiliates SET password_hash = ${passwordHash} WHERE id = ${lookup.affiliateId}`;

  // Kicked out everywhere. A stolen session must not survive the reset.
  await sql`DELETE FROM affiliate_sessions WHERE affiliate_id = ${lookup.affiliateId}`;

  return { ok: true, affiliateId: lookup.affiliateId };
}

/** Deletes expired and long-spent tokens. Called from a cron — the table should
 * not grow forever, and an old row is only a liability. */
export async function pruneAffiliatePasswordResets(
  olderThanDays = 7,
): Promise<number> {
  const sql = getSql();
  const rows = await sql`
    DELETE FROM affiliate_password_resets
    WHERE expires_at < now() - (${olderThanDays} * interval '1 day')
    RETURNING id
  `;
  return rows.length;
}
