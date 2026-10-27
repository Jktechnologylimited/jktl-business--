import { CommercialDashboard } from "@/components/distribution/commercial-dashboard";
import LegacyDashboard from "../page";
import { requireAffiliateSession } from "@/lib/affiliate-session";
import { query } from "@/lib/custom/service";
export const dynamic = "force-dynamic";
export default async function Page() {
  const a = await requireAffiliateSession();
  const row = (
    await query("SELECT commission_model FROM affiliates WHERE id=$1", [a.id])
  )[0];
  return row?.commission_model === "policy" ? (
    <CommercialDashboard />
  ) : (
    <LegacyDashboard />
  );
}
