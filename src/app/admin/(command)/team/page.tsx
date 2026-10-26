import { GrowthStaffManager } from "@/components/admin/growth-staff-manager";
import { PageHeader } from "@/components/app/page-header";
import { TeamManager } from "@/components/admin/team-manager";
import { guardAdminPage } from "@/lib/admin-page-guard";
import { listAdminTeam } from "@/lib/db/admin-auth";

export const dynamic = "force-dynamic";

/**
 * Who has access to the command centre.
 *
 * The point of this page is delegation without handing over the keys: an affiliate
 * manager can approve partners, record payouts and read the numbers, and cannot
 * touch businesses, broadcasts or the lead engine.
 */
export default async function AdminTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>;
}) {
  const params = await searchParams;
  await guardAdminPage("manage_team");
  const team = await listAdminTeam();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Staff management" />
      <GrowthStaffManager search={params.account || ""} />
      <p className="-mt-2 text-sm text-ink-muted">
        People who can sign in here. Each has a role that decides what they can
        do — an affiliate manager can approve partners and record payouts
        without being able to move anything else.
      </p>
      <TeamManager team={team.filter((s) => s.role !== "growth_gaming_lead")} />
    </div>
  );
}
