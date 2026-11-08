import { PartnerShell } from "@/components/partners/partner-shell";
import { redirect } from "next/navigation";
import { getAffiliateSession } from "@/lib/affiliate-session";
import { query } from "@/lib/custom/service";
import { affiliateLogoutAction } from "@/lib/actions/affiliate-actions";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const s = await getAffiliateSession();
  if (!s) redirect("/partners/login");
  if (
    !(
      await query(
        "SELECT 1 FROM affiliates WHERE id=$1 AND programme='partner' AND status='active' AND partner_terms_confirmed=true",
        [s.id],
      )
    ).length
  )
    redirect("/partners/login");
  return (
    <PartnerShell name={s.name} logout={affiliateLogoutAction}>
      {children}
    </PartnerShell>
  );
}
