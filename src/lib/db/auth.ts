import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "node:crypto";
import { getSql } from "./client";
import type { AppUser, BusinessType } from "@/lib/types";
import { authRateLimit } from "@/lib/security/auth-rate-limit";

const SESSION_DAYS = 30;
const RESET_TOKEN_MINUTES = 60;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || "business"}-${suffix}`;
}

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  businessName: string;
  businessType: BusinessType;
}

export interface SignupResult {
  userId: string;
  organizationId: string;
}

/**
 * Creates the user, organization, business profile, owner membership, and a
 * starter infrastructure record in one statement — a data-modifying CTE is
 * one Postgres statement, so this is genuinely atomic: either the whole
 * tenant is created, or none of it is.
 */
export async function signup(input: SignupInput): Promise<SignupResult> {
  const sql = getSql();
  const passwordHash = await hashPassword(input.password);
  const slug = slugify(input.businessName);

  const rows = await sql`
    WITH new_user AS (
      INSERT INTO users (name, email, password_hash, phone, avatar_url)
      VALUES (${input.name}, ${input.email.toLowerCase()}, ${passwordHash}, '', NULL)
      RETURNING *
    ),
    new_org AS (
      INSERT INTO organizations (name, slug)
      VALUES (${input.businessName}, ${slug})
      RETURNING *
    ),
    new_profile AS (
      INSERT INTO business_profiles (organization_id, business_type, display_name, subdomain)
      SELECT new_org.id, ${input.businessType}, ${input.businessName}, new_org.slug
      FROM new_org
      RETURNING *
    ),
    new_member AS (
      INSERT INTO organization_members (organization_id, user_id, name, email, role, title, active)
      SELECT new_org.id, new_user.id, new_user.name, new_user.email, 'owner', 'Owner', true
      FROM new_org, new_user
      RETURNING *
    ),
    new_infra AS (
      INSERT INTO infrastructure_accounts (organization_id, renewal_date)
      SELECT new_org.id, (CURRENT_DATE + INTERVAL '1 year')
      FROM new_org
      RETURNING *
    )
    SELECT
      (SELECT id FROM new_user) AS user_id,
      (SELECT id FROM new_org) AS organization_id
  `;

  return { userId: rows[0].user_id as string, organizationId: rows[0].organization_id as string };
}

export interface LoginResult {
  user: AppUser;
  organizationId: string;
}

export async function verifyLogin(email: string, password: string): Promise<LoginResult | null> {
  // Preserve existing bcrypt accounts whose old passwords exceeded 72 bytes.
  // Only NEW credentials use the stricter bound below.
  if (typeof email !== "string" || email.length > 254 || typeof password !== "string" || Buffer.byteLength(password, "utf8") > 1024) return null;
  await authRateLimit(email.trim().toLowerCase(), "login", 10, 600);
  const sql = getSql();
  const rows = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase()}`;
  const row = rows[0];
  if (!row) return null;

  const ok = await verifyPassword(password, row.password_hash as string);
  if (!ok) return null;

  const memberRows = await sql`
    SELECT organization_id FROM organization_members WHERE user_id = ${row.id} AND active = true ORDER BY created_at ASC LIMIT 1
  `;
  if (!memberRows[0]) return null;

  return {
    user: {
      id: row.id as string,
      name: row.name as string,
      email: row.email as string,
      phone: row.phone as string,
      avatarUrl: (row.avatar_url as string) ?? null,
    },
    organizationId: memberRows[0].organization_id as string,
  };
}

export interface SessionInfo {
  userId: string;
  organizationId: string;
}

export async function createSession(userId: string, organizationId: string): Promise<string> {
  const sql = getSql();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const rows = await sql`
    INSERT INTO sessions (user_id, organization_id, expires_at)
    VALUES (${userId}, ${organizationId}, ${expiresAt})
    RETURNING id
  `;
  return rows[0].id as string;
}

export async function validateSession(sessionId: string): Promise<SessionInfo | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) return null;
  const sql = getSql();
  const rows = await sql`
    SELECT s.user_id, s.organization_id FROM sessions s WHERE s.id = ${sessionId} AND s.expires_at > now()
    AND EXISTS(SELECT 1 FROM organization_members m WHERE m.user_id = s.user_id AND m.organization_id = s.organization_id AND m.active = true)
  `;
  if (!rows[0]) return null;
  return { userId: rows[0].user_id as string, organizationId: rows[0].organization_id as string };
}

export async function destroySession(sessionId: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM sessions WHERE id = ${sessionId}`;
}

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export interface UserLookup {
  id: string;
  name: string;
  email: string;
}

export async function findUserByEmail(email: string): Promise<UserLookup | null> {
  const sql = getSql();
  const rows = await sql`SELECT id, name, email FROM users WHERE email = ${email.toLowerCase()}`;
  const row = rows[0];
  if (!row) return null;
  return { id: row.id as string, name: row.name as string, email: row.email as string };
}

/**
 * Creates a password-reset token for a user and returns the raw token —
 * only its SHA-256 hash is ever written to the database (same principle as
 * password_hash: the plaintext exists just long enough to email it once).
 */
export async function createPasswordResetToken(userId: string): Promise<string> {
  const sql = getSql();
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000).toISOString();
  await sql`
    INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
    VALUES (${userId}, ${tokenHash}, ${expiresAt})
  `;
  return rawToken;
}

/**
 * Validates a raw reset token (not expired, not already used) and, if valid,
 * updates the user's password and marks every outstanding token for that
 * user as used — a successful reset invalidates any other reset links that
 * were still live for the same account.
 */
export async function consumePasswordResetToken(rawToken: string, newPassword: string): Promise<boolean> {
  if (typeof rawToken !== "string" || !/^[a-f0-9]{64}$/i.test(rawToken) || !validNewPassword(newPassword)) return false;
  const sql = getSql();
  const tokenHash = hashToken(rawToken);
  const passwordHash = await hashPassword(newPassword);
  // A single statement locks, consumes, changes credentials and revokes every
  // account session atomically. Concurrent reuse cannot change the password twice.
  const rows = await sql`
    WITH candidate AS MATERIALIZED (
      SELECT t.id, t.user_id FROM password_reset_tokens t JOIN users u ON u.id=t.user_id
      WHERE t.token_hash=${tokenHash} AND t.used_at IS NULL AND t.expires_at>now() FOR UPDATE OF u,t
    ), consumed AS (
      UPDATE password_reset_tokens SET used_at=now() WHERE id IN(SELECT id FROM candidate) RETURNING user_id
    ), changed AS (
      UPDATE users SET password_hash=${passwordHash} WHERE id IN(SELECT user_id FROM consumed) RETURNING id
    ), invalidated AS (
      UPDATE password_reset_tokens SET used_at=now() WHERE user_id IN(SELECT id FROM changed)
      AND used_at IS NULL AND id NOT IN(SELECT id FROM candidate)
    ), revoked AS (
      DELETE FROM sessions WHERE user_id IN(SELECT id FROM changed)
    ) SELECT id FROM changed
  `;
  return rows.length === 1;
}

/** Changes a signed-in user's password after verifying their current one. */
export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
  if (!validNewPassword(newPassword) || typeof currentPassword !== "string" || Buffer.byteLength(currentPassword, "utf8") > 1024) return false;
  const sql = getSql();
  const rows = await sql`SELECT password_hash FROM users WHERE id = ${userId}`;
  const row = rows[0];
  if (!row) return false;

  const ok = await verifyPassword(currentPassword, row.password_hash as string);
  if (!ok) return false;

  const passwordHash = await hashPassword(newPassword);
  const changed = await sql`
    WITH changed AS (
      UPDATE users SET password_hash=${passwordHash} WHERE id=${userId} AND password_hash=${row.password_hash} RETURNING id
    ), revoked AS (
      DELETE FROM sessions WHERE user_id IN(SELECT id FROM changed)
    ), invalidated AS (
      UPDATE password_reset_tokens SET used_at=now() WHERE user_id IN(SELECT id FROM changed) AND used_at IS NULL
    ) SELECT id FROM changed
  `;
  return changed.length === 1;
}

/** bcrypt truncates beyond 72 UTF-8 bytes; never silently accept that input. */
export function validNewPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 10 && Buffer.byteLength(value, "utf8") <= 72;
}
