import { guardAdminPage } from "@/lib/admin-page-guard";
import { customAdminAction } from "@/lib/actions/custom-project-actions";
import { CustomAdmin } from "@/components/custom/admin";
import { listExistingClients } from "@/lib/db/prospects";
import { requireAdminSession } from "@/lib/admin-session";
import { can } from "@/lib/admin-permissions";
import { ClientAccountManager } from "@/components/admin/client-account-manager";
import { WorkspaceUnavailable } from "@/components/admin/workspace-unavailable";
export const dynamic = "force-dynamic";
export default async function Page() {
  await guardAdminPage("manage_custom");
  const r = await customAdminAction();
  if (!r.ok)
    return <WorkspaceUnavailable title="Custom projects could not be loaded" detail="Check the Business database connection and required custom-project migrations. Existing client records are unchanged." />;
  const actor = await requireAdminSession();
  // Preserve any unfinished older lead-based onboarding without a duplicate,
  // empty sidebar destination or granting lead-engine access to other roles.
  const pending = can(actor.role, "run_lead_engine", actor.permissions)
    ? (await listExistingClients()).filter(client => !client.accountOrganizationId)
    : [];
  return <div className="space-y-4">
    <CustomAdmin initial={r.data} />
    {pending.length > 0 && <details className="rounded-xl border border-border bg-paper p-4">
      <summary className="cursor-pointer text-sm font-semibold">Earlier client onboarding ({pending.length})</summary>
      <p className="my-3 text-sm text-ink-muted">Clients previously marked in the lead engine who are still awaiting account setup.</p>
      <ClientAccountManager clients={pending} />
    </details>}
  </div>;
}
