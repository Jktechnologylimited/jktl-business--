import { WorkspaceUnavailable } from "@/components/admin/workspace-unavailable";
import { guardAdminPage } from "@/lib/admin-page-guard";
import { adminDomainsAction } from "@/lib/actions/domain-order-actions";
import { DomainAdmin } from "@/components/domains/domain-admin";
export const dynamic = "force-dynamic";
export default async function Page() {
  await guardAdminPage("fulfill_domains");
  const result = await adminDomainsAction();
  if (!result.ok)
    return <WorkspaceUnavailable title="Domain operations could not be loaded" detail="Check the Business database connection and domain configuration. Existing domain orders and website billing are unchanged." />;
  return <DomainAdmin initial={result.data} />;
}
