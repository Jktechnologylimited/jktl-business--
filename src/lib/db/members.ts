import { getSql } from "./client";
import type { MemberRole, OrganizationMember } from "@/lib/types";

function mapRow(row: Record<string, unknown>): OrganizationMember {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    userId: (row.user_id as string) ?? "",
    name: row.name as string,
    email: row.email as string,
    role: row.role as MemberRole,
    title: row.title as string,
    active: row.active as boolean,
  };
}

export async function listMembers(
  orgId: string,
): Promise<OrganizationMember[]> {
  const sql = getSql();
  const rows =
    await sql`SELECT * FROM organization_members WHERE organization_id = ${orgId} ORDER BY created_at ASC`;
  return rows.map(mapRow);
}

/** Used to gate team seats — the free tier is the owner alone; a 2nd+
 * member needs an active Website & Hosting subscription (see
 * `addMemberAction`). */
export async function countMembers(orgId: string): Promise<number> {
  const sql = getSql();
  const rows =
    await sql`SELECT count(*)::int AS count FROM organization_members WHERE organization_id = ${orgId}`;
  return Number(rows[0]?.count ?? 0);
}

export interface MemberInput {
  name: string;
  email: string;
  role: "manager" | "staff";
  title: string;
}

export async function addMember(
  orgId: string,
  id: string,
  input: MemberInput,
  seatLimit?: number,
): Promise<OrganizationMember> {
  const sql = getSql();
  if (seatLimit) {
    const results = await sql.transaction([
      sql`SELECT id FROM organizations WHERE id=${orgId} FOR UPDATE`,
      sql`INSERT INTO organization_members(id,organization_id,name,email,role,title,active)
       SELECT ${id},${orgId},${input.name},${input.email},${input.role},${input.title},true
       WHERE (SELECT count(*) FROM organization_members WHERE organization_id=${orgId} AND active=true)<${seatLimit}
       ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email,title=excluded.title,role=excluded.role
       WHERE organization_members.organization_id=${orgId} AND organization_members.role<>'owner'
       RETURNING *`,
    ]);
    if (!results[1][0])
      throw new Error("The collaborator limit has been reached");
    return mapRow(results[1][0]);
  }
  const rows = await sql`
    INSERT INTO organization_members (id, organization_id, name, email, role, title, active)
    VALUES (${id}, ${orgId}, ${input.name}, ${input.email}, ${input.role}, ${input.title}, true)
    ON CONFLICT (id) DO UPDATE SET
      name = excluded.name, email = excluded.email, role = excluded.role, title = excluded.title
    WHERE organization_members.organization_id=${orgId} AND organization_members.role<>'owner'
    RETURNING *
  `;
  return mapRow(rows[0]);
}

/** Never removes the owner — enforced here, not just in the UI. */
export async function removeMember(orgId: string, id: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM organization_members WHERE id = ${id} AND organization_id = ${orgId} AND role <> 'owner'`;
}
