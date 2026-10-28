import "server-only";
import { randomBytes, createHash } from "node:crypto";
import type { Query } from "@/lib/domains/model";
import { ROLE_LABEL, type AdminRole } from "@/lib/admin-permissions";
import { mailAddress } from "./addresses";
export function invitationRole(value: unknown): AdminRole {
  if (typeof value !== "string" || !Object.hasOwn(ROLE_LABEL, value))
    throw Error("Choose an existing assignable team role.");
  return value as AdminRole;
}
export const inviteHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function createTeamInvitation(
  q: Query,
  actor: string,
  input: {
    name: string;
    email: string;
    role: AdminRole;
    message: string;
    hours: number;
  },
) {
  const role = invitationRole(input.role),
    email = mailAddress(input.email);
  if (
    !email ||
    !input.name.trim() ||
    input.name.length > 120 ||
    input.message.length > 2000 ||
    !Number.isInteger(input.hours) ||
    input.hours < 1 ||
    input.hours > 168
  )
    throw Error("Check the invitation name, email and expiry.");
  const token = randomBytes(32).toString("hex");
  const rows = await q(
    `WITH existing AS(SELECT * FROM admin_users WHERE lower(email)=$2 FOR UPDATE),
 added AS(INSERT INTO admin_users(name,email,password_hash,role,created_by,disabled_at) SELECT $1,$2,'!role-invitation-pending',$3,$4,now() WHERE NOT EXISTS(SELECT 1 FROM existing) ON CONFLICT(email) DO NOTHING RETURNING *),
 target AS(SELECT * FROM existing UNION ALL SELECT * FROM added),
 revoked AS(UPDATE editorial_invitations SET revoked_at=now() WHERE user_id IN(SELECT id FROM target) AND accepted_at IS NULL AND revoked_at IS NULL RETURNING id),
 invited AS(INSERT INTO editorial_invitations(user_id,token_hash,expires_at,created_by,name,message,target_role,accept_mode)
 SELECT t.id,$5,now()+$6::int*interval '1 hour',$4,$1,$7,$3,
 CASE WHEN t.password_hash NOT IN('!role-invitation-pending','!editorial-invitation-pending') THEN 'TEAM' WHEN EXISTS(SELECT 1 FROM users u WHERE lower(u.email)=$2) THEN 'BUSINESS' ELSE 'NEW_TEAM' END FROM target t WHERE (SELECT count(*) FROM revoked)>=0 RETURNING *),
 logged AS(INSERT INTO distribution_audit(actor_id,event,detail) SELECT $4,'TEAM_INVITED',jsonb_build_object('invitation',id,'role',$3::text) FROM invited)
 SELECT id,expires_at FROM invited`,
    [
      input.name.trim(),
      email,
      role,
      actor,
      inviteHash(token),
      input.hours,
      input.message,
    ],
  );
  if (!rows[0]) throw Error("The account changed. Reload before inviting.");
  return {
    id: String(rows[0].id),
    token,
    email,
    expiresAt: new Date(String(rows[0].expires_at)).toISOString(),
  };
}
export async function inspectTeamInvitation(q: Query, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return (
    (
      await q(
        `SELECT i.id,i.user_id,i.name,i.message,COALESCE(i.target_role,a.role) role,i.accept_mode,i.expires_at,
 EXISTS(SELECT 1 FROM users u WHERE lower(u.email)=lower(a.email)) business_exists
 FROM editorial_invitations i JOIN admin_users a ON a.id=i.user_id WHERE i.token_hash=$1 AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>now()`,
        [inviteHash(token)],
      )
    )[0] || null
  );
}
export async function acceptTeamInvitation(
  q: Query,
  token: string,
  identity: { businessId?: string; teamId?: string; passwordHash?: string },
) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw Error("Invalid invitation.");
  const rows = await q(
    `WITH eligible AS(SELECT i.*,a.email,COALESCE(i.target_role,a.role) assigned_role,(SELECT u.id FROM users u WHERE u.id=$2::uuid AND lower(u.email)=lower(a.email)) business_identity FROM editorial_invitations i JOIN admin_users a ON a.id=i.user_id
 JOIN admin_users creator ON creator.id=i.created_by AND creator.role='owner' AND creator.disabled_at IS NULL AND creator.staff_revoked_at IS NULL
 WHERE i.token_hash=$1 AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>now() AND a.staff_revoked_at IS NULL
 AND NOT(a.role='owner' AND COALESCE(i.target_role,a.role)<>'owner' AND (SELECT count(*) FROM admin_users WHERE role='owner' AND disabled_at IS NULL AND staff_revoked_at IS NULL)<=1)
 AND (i.accept_mode='TEAM' AND a.id=$3::uuid AND a.disabled_at IS NULL OR
 i.accept_mode IN('BUSINESS','NEW_TEAM') AND a.password_hash IN('!role-invitation-pending','!editorial-invitation-pending') AND
 (EXISTS(SELECT 1 FROM users u WHERE u.id=$2::uuid AND lower(u.email)=lower(a.email)) OR i.accept_mode='NEW_TEAM' AND $4::text IS NOT NULL AND NOT EXISTS(SELECT 1 FROM users u WHERE lower(u.email)=lower(a.email)))) FOR UPDATE OF i,a),
 accepted AS(UPDATE editorial_invitations SET accepted_at=now() WHERE id IN(SELECT id FROM eligible) AND accepted_at IS NULL RETURNING user_id),
 enabled AS(UPDATE admin_users a SET role=e.assigned_role,disabled_at=NULL,staff_assigned_at=now(),
 password_hash=CASE WHEN e.accept_mode<>'TEAM' AND e.business_identity IS NOT NULL THEN '!business-account-only' WHEN e.accept_mode='NEW_TEAM' AND $4::text IS NOT NULL THEN $4 ELSE a.password_hash END,
 business_user_id=CASE WHEN e.accept_mode<>'TEAM' AND e.business_identity IS NOT NULL THEN e.business_identity ELSE a.business_user_id END
 FROM eligible e WHERE a.id=e.user_id AND a.id IN(SELECT user_id FROM accepted) RETURNING a.id,a.role,a.business_user_id),
 ended AS(DELETE FROM admin_sessions WHERE admin_user_id IN(SELECT id FROM enabled)),
 logged AS(INSERT INTO distribution_audit(actor_id,event,detail) SELECT id,'TEAM_INVITATION_ACCEPTED',jsonb_build_object('invitation',(SELECT id FROM eligible),'role',role) FROM enabled)
 SELECT * FROM enabled`,
    [
      inviteHash(token),
      identity.businessId || null,
      identity.teamId || null,
      identity.passwordHash || null,
    ],
  );
  if (!rows[0])
    throw Error(
      "Invitation unavailable. Sign in with the invited account or request a new invitation.",
    );
  return rows[0];
}
