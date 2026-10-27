import Link from "next/link";
import { requireAffiliateSession } from "@/lib/affiliate-session";
import { query } from "@/lib/custom/service";
import { PolicyBankForm } from "@/components/distribution/policy-bank-form";
import { PartnerAlerts } from "@/components/distribution/partner-alerts";
export const dynamic = "force-dynamic";
export default async function Page() {
  const a = await requireAffiliateSession();
  const b = (
    await query(
      "SELECT bank_code,bank_name,account_number,account_name,bank_verified_at FROM affiliates WHERE id=$1",
      [a.id],
    )
  )[0];
  return (
    <div className="space-y-5 text-ink">
      <h1 className="text-3xl font-semibold">Affiliate settings</h1>
      <p>
        {a.name} · {a.email} · {a.status}
      </p>
      <PartnerAlerts />
      <PolicyBankForm
        bank={{
          bankCode: String(b?.bank_code || ""),
          bankName: String(b?.bank_name || ""),
          accountNumber: String(b?.account_number || ""),
          accountName: String(b?.account_name || ""),
          verified: Boolean(b?.bank_verified_at),
        }}
      />
      <p>
        Email notices include a private preferences link for optional marketing.
        Service and security updates remain available.
      </p>
      <Link className="underline" href="/affiliates/support">
        Contact support
      </Link>
    </div>
  );
}
