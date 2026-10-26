import Link from "next/link";
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
export default async function AdminTeamPage() {
  await guardAdminPage("manage_team");
  const team = await listAdminTeam();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Team" />
      <Link
        href="/admin/growth"
        className="self-start rounded-lg border border-border p-3 text-sm"
      >
        Open Growth & Gaming workspace →
      </Link>
      <p className="-mt-2 text-sm text-ink-muted">
        People who can sign in here. Each has a role that decides what they can
        do — an affiliate manager can approve partners and record payouts
        without being able to move anything else.
      </p>
      <TeamManager team={team} />
    </div>
  );
}
