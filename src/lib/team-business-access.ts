import "server-only";
import type { Query } from "@/lib/domains/model";
import type { LoginResult } from "@/lib/db/auth";

export class TeamBusinessConflict extends Error {
  constructor() {
    super(
      "This email already has a Business account. Open Team sign-in to connect it using its existing Business password.",
    );
  }
}

function loginResult(row: Record<string, unknown>): LoginResult {
  return {
    user: {
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      phone: String(row.phone || ""),
      avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    },
    organizationId: String(row.organization_id),
  };
}

async function linkedAccess(q: Query, adminId: string) {
  const rows = await q(
    `SELECT u.id,u.name,u.email,u.phone,u.avatar_url,m.organization_id
    FROM admin_users a JOIN users u ON u.id=a.business_user_id
    JOIN organization_members m ON m.user_id=u.id AND m.active=true
    WHERE a.id=$1 AND a.disabled_at IS NULL AND a.staff_revoked_at IS NULL
    ORDER BY m.created_at,m.id LIMIT 1`,
    [adminId],
  );
  return rows[0] ? loginResult(rows[0]) : null;
}

/** Only call after authenticating this Team identity or accepting its invitation.
 * Provision a private ordinary workspace, never membership of a customer tenant.
 * Migrate the existing hash once; users becomes the single password authority.
 */
export async function ensureTeamBusinessAccess(
  q: Query,
  adminId: string,
): Promise<LoginResult> {
  const existing = await linkedAccess(q, adminId);
  if (existing) return existing;
  const rows = await q(
    `WITH team AS MATERIALIZED (
    SELECT id,name,lower(email) email,password_hash FROM admin_users
    WHERE id=$1 AND business_user_id IS NULL AND disabled_at IS NULL AND staff_revoked_at IS NULL
    AND password_hash LIKE '$2%' FOR UPDATE
  ), added_user AS (
    INSERT INTO users(name,email,password_hash,phone,avatar_url)
    SELECT name,email,password_hash,'',NULL FROM team
    WHERE NOT EXISTS(SELECT 1 FROM users WHERE lower(email)=team.email)
    ON CONFLICT(email) DO NOTHING RETURNING id,name,email,phone,avatar_url
  ), added_org AS (
    INSERT INTO organizations(name,slug)
    SELECT name||' workspace','team-'||replace($1::text,'-','') FROM added_user RETURNING id,name,slug
  ), added_profile AS (
    INSERT INTO business_profiles(organization_id,business_type,display_name,subdomain)
    SELECT id,'general',name,slug FROM added_org
  ), added_member AS (
    INSERT INTO organization_members(organization_id,user_id,name,email,role,title,active)
    SELECT o.id,u.id,u.name,u.email,'owner','Owner',true FROM added_org o,added_user u
  ), added_infra AS (
    INSERT INTO infrastructure_accounts(organization_id,renewal_date)
    SELECT id,CURRENT_DATE+interval '1 year' FROM added_org
  ), linked AS (
    UPDATE admin_users SET business_user_id=u.id,password_hash='!business-account-only'
    FROM added_user u WHERE admin_users.id=$1 RETURNING admin_users.id
  ), ended AS (
    DELETE FROM admin_sessions WHERE admin_user_id IN(SELECT id FROM linked)
  ), logged AS (
    INSERT INTO distribution_audit(actor_id,event,detail)
    SELECT id,'TEAM_BUSINESS_ACCESS_ENABLED',jsonb_build_object('user',(SELECT id FROM added_user),'organization',(SELECT id FROM added_org)) FROM linked
  ) SELECT u.*,o.id organization_id FROM added_user u,added_org o`,
    [adminId],
  );
  if (rows[0]) return loginResult(rows[0]);
  // A concurrent sign-in may have completed the same link while we waited.
  const linked = await linkedAccess(q, adminId);
  if (linked) return linked;
  const state = (
    await q(
      "SELECT business_user_id,disabled_at,staff_revoked_at FROM admin_users WHERE id=$1",
      [adminId],
    )
  )[0];
  if (
    !state ||
    state.disabled_at ||
    state.staff_revoked_at ||
    state.business_user_id
  )
    throw Error("Team access is unavailable. Contact the Owner.");
  throw new TeamBusinessConflict();
}

/** Both identities must already be authenticated by the caller. Matching emails
 * alone never links an existing Business account or replaces its password.
 */
export async function connectExistingTeamBusiness(
  q: Query,
  adminId: string,
  businessUserId: string,
) {
  const rows = await q(
    `WITH changed AS (
    UPDATE admin_users a SET business_user_id=u.id,password_hash='!business-account-only'
    FROM users u WHERE a.id=$1 AND u.id=$2 AND lower(a.email)=lower(u.email)
    AND a.disabled_at IS NULL AND a.staff_revoked_at IS NULL AND a.business_user_id IS NULL
    AND NOT EXISTS(SELECT 1 FROM admin_users other WHERE other.business_user_id=u.id)
    RETURNING a.id
  ), ended AS(DELETE FROM admin_sessions WHERE admin_user_id IN(SELECT id FROM changed)),
  logged AS(INSERT INTO distribution_audit(actor_id,event,detail) SELECT id,'TEAM_BUSINESS_ACCOUNT_CONNECTED',jsonb_build_object('user',$2::uuid) FROM changed)
  SELECT id FROM changed`,
    [adminId, businessUserId],
  );
  if (!rows[0])
    throw Error(
      "Only your current matching Business account can be connected. Reload and check your access.",
    );
}
