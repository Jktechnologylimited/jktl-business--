import "server-only";
import bcrypt from "bcryptjs";
import { getSql } from "./client";

/** Shorter-lived than a business session (30 days) — this credential can
 * see every business on the platform, so it re-asks for a password more
 * often. */
const ADMIN_SESSION_DAYS = 7;

export interface AdminUser {
  id: string;
  name: string;
  email: string;
}

export async function verifyAdminLogin(email: string, password: string): Promise<AdminUser | null> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM admin_users WHERE email = ${email.toLowerCase()}`;
  const row = rows[0];
  if (!row) return null;

  const ok = await bcrypt.compare(password, row.password_hash as string);
  if (!ok) return null;

  return { id: row.id as string, name: row.name as string, email: row.email as string };
}

export async function createAdminSession(adminUserId: string): Promise<string> {
  const sql = getSql();
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const rows = await sql`
    INSERT INTO admin_sessions (admin_user_id, expires_at) VALUES (${adminUserId}, ${expiresAt}) RETURNING id
  `;
  return rows[0].id as string;
}

export async function validateAdminSession(sessionId: string): Promise<AdminUser | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT au.id, au.name, au.email
    FROM admin_sessions s
    JOIN admin_users au ON au.id = s.admin_user_id
    WHERE s.id = ${sessionId} AND s.expires_at > now()
  `;
  const row = rows[0];
  if (!row) return null;
  return { id: row.id as string, name: row.name as string, email: row.email as string };
}

export async function destroyAdminSession(sessionId: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM admin_sessions WHERE id = ${sessionId}`;
}
