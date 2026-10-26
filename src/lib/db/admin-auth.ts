import "server-only";
import bcrypt from "bcryptjs";
import { normaliseRole, type AdminRole } from "@/lib/admin-permissions";
import { getSql } from "./client";

/** Shorter-lived than a business session (30 days) — this credential can
 * see every business on the platform, so it re-asks for a password more
 * often. */
const ADMIN_SESSION_DAYS = 7;

/**
 * The role, from a row that may predate roles entirely.
 *
 * Two different things look similar here and must not be confused:
 *
 *   - **`role` is `undefined`** — the column does not exist, so this database has
 *     not run migration 027. Every admin from that era was an owner, because owner
 *     was the only thing an admin could be. Treating them as anything else locks
 *     the founder out of their own command centre.
 *   - **`role` is a string** — normalise it, and an unrecognised value falls to the
 *     least-privileged role.
 *
 * A `null` is treated as an owner because that is the column's own default; the
 * migration backfills every existing row to `owner` for the same reason.
 */
function mapAdminUser(row: Record<string, unknown>): AdminUser {
  const raw = row.role;
  const role =
    raw === undefined || raw === null ? "owner" : normaliseRole(raw as string);
  return {
    id: row.id as string,
    name: (row.name as string) ?? "",
    email: (row.email as string) ?? "",
    role,
    // `disabled_at` is also from migration 027; absent means not disabled.
    disabled: Boolean(row.disabled_at || row.staff_revoked_at),
    businessUserId: row.business_user_id
      ? String(row.business_user_id)
      : undefined,
    permissions:
      row.permission_overrides && typeof row.permission_overrides === "object"
        ? (row.permission_overrides as Record<string, boolean>)
        : {},
  };
}

export interface AdminUser {
  businessUserId?: string;
  permissions?: Record<string, boolean>;
  id: string;
  name: string;
  email: string;
  /** What this account may do — see `src/lib/admin-permissions.ts`. */
  role: AdminRole;
  /** True when the account has been switched off. Sessions are checked as well,
   * so this is for display. */
  disabled: boolean;
}

export async function verifyAdminLogin(
  email: string,
  password: string,
): Promise<AdminUser | null> {
  const sql = getSql();
  const rows =
    await sql`SELECT * FROM admin_users WHERE email = ${email.toLowerCase()}`;
  const row = rows[0];
  // A disabled account cannot sign in, and a row from before migration 027 has no
  // role — `normaliseRole` gives it 'analyst', which is safe for a legacy row only
  // because the migration backfills 'owner' first.
  if (row?.disabled_at || row?.business_user_id || row?.staff_revoked_at)
    return null;
  if (!row) return null;

  const ok = await bcrypt.compare(password, row.password_hash as string);
  if (!ok) return null;

  // Bookkeeping, and deliberately unable to fail the sign-in. This threw for
  // every admin whose database predated migration 027, which meant nobody could
  // sign in at all because a timestamp column was missing.
  await sql`UPDATE admin_users SET last_login_at = now() WHERE id = ${row.id}`.catch(
    (err) => {
      console.error("admin-auth: could not record last_login_at:", err);
    },
  );
  return mapAdminUser(row);
}

export async function createAdminSession(adminUserId: string): Promise<string> {
  const sql = getSql();
  const expiresAt = new Date(
    Date.now() + ADMIN_SESSION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const rows = await sql`
    INSERT INTO admin_sessions (admin_user_id, expires_at) VALUES (${adminUserId}, ${expiresAt}) RETURNING id
  `;
  return rows[0].id as string;
}

export async function validateAdminSession(
  sessionId: string,
): Promise<AdminUser | null> {
  const sql = getSql();
  // `au.*` rather than a column list: migration 027 added `role`, and naming it
  // explicitly makes the query fail outright on a database that has not been
  // migrated yet — which took the entire command centre down with a 500 instead
  // of letting it start. A missing column is handled in `mapAdminUser`.
  const rows = await sql`
    SELECT au.*
    FROM admin_sessions s
    JOIN admin_users au ON au.id = s.admin_user_id
    WHERE s.id = ${sessionId} AND s.expires_at > now()
  `;
  const row = rows[0];
  if (!row) return null;
  // Disabling an account must end its existing sessions too, not just block new
  // sign-ins. Caught here so a live session cannot outlive the disable.
  if (row.disabled_at || row.staff_revoked_at || row.business_user_id)
    return null;
  return mapAdminUser(row);
}

export async function destroyAdminSession(sessionId: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM admin_sessions WHERE id = ${sessionId}`;
}

/* -------------------------------------------------------------------------- */
/* Team accounts                                                              */
/* -------------------------------------------------------------------------- */

export interface AdminTeamMember {
  businessUserId?: string;
  permissions?: Record<string, boolean>;
  revokedAt?: string | null;
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  createdAt: string;
  lastLoginAt: string | null;
  disabledAt: string | null;
}

export async function listAdminTeam(): Promise<AdminTeamMember[]> {
  const sql = getSql();
  // `SELECT *`: same reason as `validateAdminSession` — a named column that does
  // not exist yet turns a page into a 500 instead of an empty list.
  const rows = await sql`SELECT * FROM admin_users ORDER BY created_at ASC`;
  return rows.map((row) => ({
    businessUserId: row.business_user_id
      ? String(row.business_user_id)
      : undefined,
    permissions: (row.permission_overrides || {}) as Record<string, boolean>,
    revokedAt: row.staff_revoked_at ? String(row.staff_revoked_at) : null,
    id: row.id as string,
    name: (row.name as string) ?? "",
    email: (row.email as string) ?? "",
    role:
      row.role === undefined || row.role === null
        ? "owner"
        : normaliseRole(row.role as string),
    createdAt: new Date(row.created_at as string).toISOString(),
    lastLoginAt: row.last_login_at
      ? new Date(row.last_login_at as string).toISOString()
      : null,
    disabledAt: row.disabled_at
      ? new Date(row.disabled_at as string).toISOString()
      : null,
  }));
}

export const ADMIN_EMAIL_TAKEN = "ADMIN_EMAIL_TAKEN";

/**
 * Creates an admin account.
 *
 * The password is chosen by whoever creates the account and shown to them once —
 * deliberately not emailed. An emailed password is a password in a mailbox and,
 * in practice, a password that is never changed. The creator is a colleague in the
 * same business, so handing it over in person is both easier and safer.
 */
export async function createAdminUser(input: {
  name: string;
  email: string;
  password: string;
  role: AdminRole;
  createdBy: string;
}): Promise<AdminUser> {
  const sql = getSql();
  const email = input.email.trim().toLowerCase();

  const existing =
    await sql`SELECT id FROM admin_users WHERE email = ${email} LIMIT 1`;
  if (existing[0]) throw new Error(ADMIN_EMAIL_TAKEN);

  const passwordHash = await bcrypt.hash(input.password, 10);
  const rows =
    input.role === "growth_gaming_lead"
      ? await sql.query(
          `WITH created AS(INSERT INTO admin_users(name,email,password_hash,role,created_by,staff_assigned_at) VALUES($1,$2,$3,$4,$5,now()) RETURNING *),logged AS(INSERT INTO distribution_audit(actor_id,event,detail) SELECT $5,'STAFF_ROLE_ASSIGNED',jsonb_build_object('staff',id,'role','GROWTH_GAMING_LEAD','source','TEAM') FROM created RETURNING id) SELECT * FROM created`,
          [input.name.trim(), email, passwordHash, input.role, input.createdBy],
        )
      : await sql`
    INSERT INTO admin_users (name, email, password_hash, role, created_by)
    VALUES (${input.name.trim()}, ${email}, ${passwordHash}, ${input.role}, ${input.createdBy})
    RETURNING id, name, email, role
  `;
  return mapAdminUser(rows[0]);
}

/**
 * Disables or re-enables an account.
 *
 * Disabling **deletes their sessions** as well. Without that, somebody who has
 * been switched off keeps working until their seven-day cookie expires — which is
 * exactly the window in which a revoked account does the most damage.
 *
 * An owner cannot disable themselves: locking the last owner out of the command
 * centre is not recoverable from inside the app.
 */
export async function setAdminDisabled(
  adminUserId: string,
  disabled: boolean,
  actingAdminId: string,
): Promise<void> {
  if (adminUserId === actingAdminId && disabled) {
    throw new Error("You cannot disable your own account.");
  }
  const sql = getSql();
  await sql`
    UPDATE admin_users SET disabled_at = ${disabled ? new Date().toISOString() : null}
    WHERE id = ${adminUserId}
  `;
  if (disabled)
    await sql`DELETE FROM admin_sessions WHERE admin_user_id = ${adminUserId}`;
}

/** Refuses to remove the last enabled owner — the command centre would become
 * unreachable, and no in-app recovery exists. */
export async function countEnabledOwners(): Promise<number> {
  const sql = getSql();
  const rows = await sql`
    SELECT COUNT(*)::int AS n FROM admin_users WHERE role = 'owner' AND disabled_at IS NULL
  `;
  return Number((rows[0] as Record<string, unknown>)?.n ?? 0);
}

/**
 * Sets a new password for an admin account, and signs them out everywhere.
 *
 * For a teammate locked out at 11pm with the founder not wanting to hand-issue
 * credentials over WhatsApp. The password is set by the owner and shown once —
 * never emailed — and every existing session is destroyed, because a password
 * change that leaves the old session alive has not changed anything.
 */
export async function setAdminPassword(
  adminUserId: string,
  newPassword: string,
  actingAdminId: string,
): Promise<void> {
  if (adminUserId === actingAdminId) {
    throw new Error("Use your own account settings to change your password.");
  }
  const sql = getSql();
  const linked =
    await sql`SELECT business_user_id FROM admin_users WHERE id=${adminUserId}`;
  if (linked[0]?.business_user_id)
    throw Error(
      "This staff member uses their Business password. Use the Business password reset process.",
    );
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await sql`UPDATE admin_users SET password_hash = ${passwordHash} WHERE id = ${adminUserId}`;
  await sql`DELETE FROM admin_sessions WHERE admin_user_id = ${adminUserId}`;
}

/**
 * Deletes an admin account.
 *
 * Two refusals, both about staying reachable: you cannot delete yourself, and you
 * cannot delete the last enabled owner. Everything else is fair game — a departed
 * colleague's account should not linger as an active credential.
 *
 * Records they created (broadcasts, payouts) are attributed by foreign key with
 * `ON DELETE SET NULL`, so the audit trail survives the account.
 */
export async function deleteAdminUser(
  adminUserId: string,
  actingAdminId: string,
): Promise<void> {
  if (adminUserId === actingAdminId)
    throw new Error("You cannot delete your own account.");
  const sql = getSql();

  const rows =
    await sql`SELECT role, disabled_at FROM admin_users WHERE id = ${adminUserId}`;
  const target = rows[0];
  if (!target) return;

  if (target.role === "owner" && !target.disabled_at) {
    const owners = await countEnabledOwners();
    if (owners <= 1)
      throw new Error(
        "That's the last owner. Promote someone else first, or you'd lock yourself out.",
      );
  }

  await sql`DELETE FROM admin_sessions WHERE admin_user_id = ${adminUserId}`;
  await sql`DELETE FROM admin_users WHERE id = ${adminUserId}`;
}

/** No email matching or second password: this profile is assigned by an Owner. */
export async function linkedBusinessStaff(
  userId: string,
): Promise<AdminUser | null> {
  const rows = await getSql().query(
    "SELECT a.id,a.name,a.email,a.role,a.disabled_at,a.business_user_id,a.permission_overrides,a.staff_revoked_at FROM admin_users a JOIN users u ON u.id=a.business_user_id WHERE a.business_user_id=$1 AND a.role='growth_gaming_lead' AND a.disabled_at IS NULL AND a.staff_revoked_at IS NULL",
    [userId],
  );
  return rows[0] ? mapAdminUser(rows[0]) : null;
}
