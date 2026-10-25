import { legacyPartnerApplicationsAction } from "@/lib/actions/legacy-partner-actions";
import { guardAdminPage } from "@/lib/admin-page-guard";
import { query } from "@/lib/custom/service";
import { PartnerManager } from "@/components/admin/partner-manager";
export const dynamic = "force-dynamic";
export default async function Page() {
  await guardAdminPage("manage_affiliates");
  let rows = null;
  try {
    rows = await query(
      "SELECT id,name,email,status,application_note,commission_bps,partner_agreement,created_at FROM affiliates WHERE programme='partner' ORDER BY created_at DESC",
    );
  } catch {}
  const legacy = await legacyPartnerApplicationsAction();
  return rows ? (
    <PartnerManager initial={rows} legacy={legacy} />
  ) : (
    <p>
      Partner management is unavailable. Check migration 036 and database
      configuration.
    </p>
  );
}
