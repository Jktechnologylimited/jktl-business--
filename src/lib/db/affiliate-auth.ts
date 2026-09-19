import "server-only";
import bcrypt from "bcryptjs";
import { getSql } from "./client";

/** Same 7-day lifetime as an admin session — an affiliate login is a
 * lower-trust credential than a business owner's (it can't see any
 * business's operational data, only its own referral stats), but it's
 * still a real financial relationship, so it re-asks for a password more
 * often than the 30-day business session. */
const AFFILIATE_SESSION_DAYS = 7;

export interface AffiliateUser {
  id: string;
  name: string;
  email: string;
  referralCode: string;
  commissionBps: number;
  status: "pending" | "active" | "suspended";
}

function mapAffiliateUser(row: Record<string, unknown>): AffiliateUser {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    referralCode: row.referral_code as string,
    commissionBps: Number(row.commission_bps),
    status: (row.status as string) === "pending" ? "pending" : (row.status as string) === "suspended" ? "suspended" : "active",
  };
}

export type AffiliateLoginResult =
  | { ok: true; affiliate: AffiliateUser }
  | { ok: false; reason: "not_found" | "pending" | "suspended" | "wrong_password" };

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
export async function verifyAffiliateLogin(email: string, password: string): Promise<AffiliateLoginResult> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM affiliates WHERE email = ${email.toLowerCase()}`;
  const row = rows[0];
  if (!row) return { ok: false, reason: "not_found" };
  if (row.status === "pending") return { ok: false, reason: "pending" };
  if (row.status === "suspended") return { ok: false, reason: "suspended" };

  const ok = await bcrypt.compare(password, row.password_hash as string);
  if (!ok) return { ok: false, reason: "wrong_password" };

  return { ok: true, affiliate: mapAffiliateUser(row) };
}

export async function createAffiliateSession(affiliateId: string): Promise<string> {
  const sql = getSql();
  const expiresAt = new Date(Date.now() + AFFILIATE_SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const rows = await sql`
    INSERT INTO affiliate_sessions (affiliate_id, expires_at) VALUES (${affiliateId}, ${expiresAt}) RETURNING id
  `;
  return rows[0].id as string;
}

export async function validateAffiliateSession(sessionId: string): Promise<AffiliateUser | null> {
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

export async function destroyAffiliateSession(sessionId: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM affiliate_sessions WHERE id = ${sessionId}`;
}

export async function changeAffiliatePassword(affiliateId: string, currentPassword: string, newPassword: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`SELECT password_hash FROM affiliates WHERE id = ${affiliateId}`;
  const row = rows[0];
  if (!row) return false;
  const ok = await bcrypt.compare(currentPassword, row.password_hash as string);
  if (!ok) return false;
  const newHash = await bcrypt.hash(newPassword, 10);
  await sql`UPDATE affiliates SET password_hash = ${newHash} WHERE id = ${affiliateId}`;
  return true;
}
