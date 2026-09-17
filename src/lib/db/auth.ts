import bcrypt from "bcryptjs";
import { getSql } from "./client";
import type { AppUser, BusinessType } from "@/lib/types";

const SESSION_DAYS = 30;

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
  const sql = getSql();
  const rows = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase()}`;
  const row = rows[0];
  if (!row) return null;

  const ok = await verifyPassword(password, row.password_hash as string);
  if (!ok) return null;

  const memberRows = await sql`
    SELECT organization_id FROM organization_members WHERE user_id = ${row.id} ORDER BY created_at ASC LIMIT 1
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
  const sql = getSql();
  const rows = await sql`
    SELECT user_id, organization_id FROM sessions WHERE id = ${sessionId} AND expires_at > now()
  `;
  if (!rows[0]) return null;
  return { userId: rows[0].user_id as string, organizationId: rows[0].organization_id as string };
}

export async function destroySession(sessionId: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM sessions WHERE id = ${sessionId}`;
}
