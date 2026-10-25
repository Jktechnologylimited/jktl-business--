import { guardAdminPage } from "@/lib/admin-page-guard";
import { customAdminAction } from "@/lib/actions/custom-project-actions";
import { CustomAdmin } from "@/components/custom/admin";
export const dynamic = "force-dynamic";
export default async function Page() {
  await guardAdminPage("manage_custom");
  const r = await customAdminAction();
  if (!r.ok)
    return (
      <div className="p-8">
        <h1>Custom Projects unavailable</h1>
        <p>
          Apply migrations 034 and 035 and verify the Business database
          configuration.
        </p>
      </div>
    );
  return <CustomAdmin initial={r.data} />;
}
