import { guardAdminPage } from "@/lib/admin-page-guard";
import { TeamOrganogram } from "@/components/admin/team-organogram";
import { PageHeader } from "@/components/app/page-header";
export const dynamic = "force-dynamic";
export default async function TeamStructurePage() {
  await guardAdminPage("view_team_structure");
  return (
    <div className="space-y-5">
      <PageHeader title="Team structure" />
      <TeamOrganogram />
    </div>
  );
}
