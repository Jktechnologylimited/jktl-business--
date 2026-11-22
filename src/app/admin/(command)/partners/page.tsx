import { WorkspaceUnavailable } from "@/components/admin/workspace-unavailable";
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
      "SELECT a.id,a.name,a.email,a.status,a.application_note,a.commission_bps,a.commission_model,a.partner_agreement,a.created_at,EXISTS(SELECT 1 FROM distribution_contracts c WHERE c.affiliate_id=a.id AND c.status='ACTIVE' AND c.model='REFERRAL') active_referral_contract FROM affiliates a WHERE programme='partner' ORDER BY created_at DESC",
    );
  } catch {}
  const legacy = await legacyPartnerApplicationsAction();
  return rows ? (
    <PartnerManager initial={rows} legacy={legacy} />
  ) : (
    <WorkspaceUnavailable title="Partners could not be loaded" detail="Check the Business database connection and partner configuration, then try again. Existing applications and agreements have not been changed." />
  );
}
