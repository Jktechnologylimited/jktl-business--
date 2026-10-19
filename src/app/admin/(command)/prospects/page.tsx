import { ProspectWorkbench } from "@/components/admin/prospect-workbench";
import { getOutreachSettings, getProspectStats, listCountryRules, listProspects, listRuns } from "@/lib/db/prospects";

export const dynamic = "force-dynamic";

/**
 * The lead engine. Server-rendered: it reads platform-level tables and hands
 * the result to the client workbench, which drives the four pipeline actions
 * and calls `router.refresh()` after each one.
 *
 * Access is enforced by the `(command)` layout above this (which redirects
 * anyone without an admin session), and again inside every action, because a
 * server action is a public HTTP endpoint regardless of what renders it.
 */
export default async function AdminProspectsPage() {
  const [prospects, stats, settings, runs, countries] = await Promise.all([
    listProspects({ limit: 200 }),
    getProspectStats(),
    getOutreachSettings(),
    listRuns(8),
    listCountryRules(),
  ]);

  return (
    <ProspectWorkbench
      prospects={prospects}
      stats={stats}
      settings={settings}
      runs={runs}
      countries={countries}
      integrations={{
        apify: Boolean(process.env.APIFY_TOKEN),
        outscraper: Boolean(process.env.OUTSCRAPER_API_KEY),
        resend: Boolean(process.env.RESEND_API_KEY),
      }}
    />
  );
}
