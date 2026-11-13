import { guardAdminPage } from "@/lib/admin-page-guard";
import { getSql } from "@/lib/db/client";
import { normaliseRole } from "@/lib/admin-permissions";
import { TeamOrganogram } from "@/components/admin/team-organogram";
import { PageHeader } from "@/components/app/page-header";
export const dynamic = "force-dynamic";
export default async function TeamStructurePage() {
  await guardAdminPage("view_team_structure");
  const rows =
    await getSql()`SELECT name,role FROM admin_users WHERE disabled_at IS NULL AND staff_revoked_at IS NULL ORDER BY name`;
  const members = rows.map((row) => ({
    name: String(row.name),
    role: normaliseRole(String(row.role)),
  }));
  return (
    <div className="space-y-5">
      <PageHeader title="Team structure" />
      <TeamOrganogram members={members} />
    </div>
  );
}
