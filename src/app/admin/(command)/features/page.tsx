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
    <p>
      Feature management is unavailable. Check migration 036 and database
      configuration.
    </p>
  );
}
