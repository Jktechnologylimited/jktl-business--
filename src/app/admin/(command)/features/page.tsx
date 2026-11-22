import { WorkspaceUnavailable } from "@/components/admin/workspace-unavailable";
import { guardAdminPage } from "@/lib/admin-page-guard";
import { featureAdminAction } from "@/lib/actions/feature-actions";
import { FeatureManager } from "@/components/features/FeatureManager";
export const dynamic = "force-dynamic";
export default async function Page() {
  await guardAdminPage("manage_features");
  let data = null;
  try {
    data = await featureAdminAction();
  } catch {}
  return data ? (
    <FeatureManager initial={data} />
  ) : (
    <WorkspaceUnavailable title="Feature settings could not be loaded" detail="Check the Business database connection and feature configuration, then try again. Existing settings have not been changed." />
  );
}
