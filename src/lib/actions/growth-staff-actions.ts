"use server";
import { query, growth, audit, field, uuid } from "@/lib/growth/service";
import { GROWTH_PERMISSIONS } from "@/lib/admin-permissions";
import { revalidatePath } from "next/cache";
export async function assignGrowthRoleAction(f: FormData) {
  const a = await growth("manage_team"),
    userId = uuid(f.get("userId"));
  const r = await query(
    `WITH added AS(INSERT INTO admin_users(name,email,password_hash,role,business_user_id,created_by,staff_assigned_at) SELECT name,email,'!business-account-only','growth_gaming_lead',id,$2,now() FROM users WHERE id=$1 ON CONFLICT(business_user_id) DO UPDATE SET disabled_at=NULL,staff_revoked_at=NULL,staff_assigned_at=now() WHERE admin_users.role='growth_gaming_lead' RETURNING id) INSERT INTO distribution_audit(actor_id,event,detail) SELECT $2,'STAFF_ROLE_ASSIGNED',jsonb_build_object('staff',id,'user',$1::uuid,'role','GROWTH_GAMING_LEAD','category','STAFF') FROM added RETURNING id`,
    [userId, a.id],
  );
  if (!r.length)
    throw Error(
      "Only an existing Business user without a conflicting admin profile can be assigned",
    );
  revalidatePath("/admin/team");
}
export async function configureGrowthStaffAction(f: FormData) {
  const a = await growth("manage_team"),
    target = uuid(f.get("id")),
    mode = field(f, "mode", 20);
  if (!["PERMISSIONS", "SUSPEND", "ENABLE", "REVOKE"].includes(mode))
    throw Error("Choose a staff action");
  const enabled = f.getAll("permissions").map(String);
  if (
    enabled.some((p) => !(GROWTH_PERMISSIONS as readonly string[]).includes(p))
  )
    throw Error("Invalid permission");
  const overrides = Object.fromEntries(
    GROWTH_PERMISSIONS.map((p) => [p, enabled.includes(p)]),
  );
  const r = await query(
    `WITH changed AS(UPDATE admin_users SET permission_overrides=CASE WHEN $2='PERMISSIONS' THEN $3::jsonb ELSE permission_overrides END,disabled_at=CASE WHEN $2 IN('SUSPEND','REVOKE') THEN now() WHEN $2='ENABLE' AND staff_revoked_at IS NULL THEN NULL ELSE disabled_at END,staff_revoked_at=CASE WHEN $2='REVOKE' THEN now() ELSE staff_revoked_at END WHERE id=$1 AND role='growth_gaming_lead' AND($2<>'ENABLE' OR staff_revoked_at IS NULL) RETURNING id),ended AS(DELETE FROM admin_sessions WHERE admin_user_id=$1 AND EXISTS(SELECT 1 FROM changed)) INSERT INTO distribution_audit(actor_id,event,detail) SELECT $4,'STAFF_'||$2,jsonb_build_object('staff',id,'permissions',CASE WHEN $2='PERMISSIONS' THEN $3::jsonb ELSE '{}'::jsonb END) FROM changed RETURNING id`,
    [target, mode, JSON.stringify(overrides), a.id],
  );
  if (!r.length) throw Error("Staff profile unavailable");
  revalidatePath("/admin/team");
  revalidatePath("/admin/growth");
}
export async function assignGrowthLeadAction(f: FormData) {
  const a = await growth("manage_team");
  const r = await query(
    `UPDATE prospects SET assigned_staff_id=$2 WHERE id=$1 AND EXISTS(SELECT 1 FROM admin_users WHERE id=$2 AND role='growth_gaming_lead' AND disabled_at IS NULL AND staff_revoked_at IS NULL) RETURNING id`,
    [uuid(f.get("lead")), uuid(f.get("staff"))],
  );
  if (!r.length) throw Error("Choose an active staff member and existing lead");
  await audit(a.id, "LEAD_ASSIGNED", String(f.get("lead")), {
    staff: String(f.get("staff")),
  });
  revalidatePath("/admin/growth/leads");
}
