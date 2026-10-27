import Link from "next/link";
import { requireAffiliateSession } from "@/lib/affiliate-session";
import { query } from "@/lib/custom/service";
import { CopyReferralLink } from "@/components/affiliates/copy-referral-link";
import { PartnerAlerts } from "./partner-alerts";
export async function AffiliateOverview() {
  const a = await requireAffiliateSession();
  const n = (
    await query(
      `SELECT COALESCE((SELECT qualified_visit_count FROM affiliate_activity WHERE affiliate_id=$1),0) clicks,(SELECT count(*) FROM affiliate_referrals WHERE affiliate_id=$1) signups,(SELECT count(*) FROM affiliate_referrals r WHERE r.affiliate_id=$1 AND(EXISTS(SELECT 1 FROM website_plan_payments p WHERE p.organization_id=r.organization_id AND p.paid_at IS NOT NULL) OR EXISTS(SELECT 1 FROM domain_orders d WHERE d.organization_id=r.organization_id AND d.paid_at IS NOT NULL AND d.refunded_kobo=0 AND d.status IN('PAID','PROCESSING','ACTIVE')) OR EXISTS(SELECT 1 FROM email_orders e WHERE e.organization_id=r.organization_id AND e.paid_at IS NOT NULL AND e.status IN('PAYMENT_CONFIRMED','AWAITING_DOMAIN_VERIFICATION','PENDING_SETUP','CONFIGURING','ACTIVE')) OR EXISTS(SELECT 1 FROM custom_invoices i WHERE i.organization_id=r.organization_id AND i.status='PAID'))) payers,(SELECT COALESCE(sum(amount_kobo),0) FROM distribution_ledger WHERE affiliate_id=$1 AND status IN('PENDING','UNDER_REVIEW','RESERVED')) pending,(SELECT GREATEST(0,COALESCE((SELECT sum(amount_kobo) FROM distribution_ledger WHERE affiliate_id=$1 AND status='AVAILABLE'),0)+COALESCE((SELECT sum(amount_kobo) FROM distribution_adjustments WHERE affiliate_id=$1 AND payout_id IS NULL),0))) available,(SELECT COALESCE(sum(amount_kobo),0) FROM distribution_payouts WHERE affiliate_id=$1 AND status='PAID') paid`,
      [a.id],
    )
  )[0];
  return (
    <div className="space-y-6 text-ink">
      <h1 className="text-3xl font-semibold">
        Welcome, {a.name.split(" ")[0]}
      </h1>
      <p>
        Account status: {a.status}. Commission eligibility follows your
        accepted, formally activated agreement.
      </p>
      <CopyReferralLink
        link={"https://jktl.com.ng/?ref=" + encodeURIComponent(a.referralCode)}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Valid referral visits", n.clicks],
          ["Signups", n.signups],
          ["Paying customers", n.payers],
          ["Held commissions", money(n.pending)],
          ["Available earnings", money(n.available)],
          ["Total paid", money(n.paid)],
        ].map(([label, value]) => (
          <article
            key={String(label)}
            className="rounded-xl border border-border bg-paper p-5"
          >
            <p className="text-sm text-ink-muted">{label}</p>
            <strong className="mt-2 block text-2xl">{String(value)}</strong>
          </article>
        ))}
      </div>
      <p className="text-sm text-ink-muted">
        Referral visits count valid, consented attribution visits. Signups and
        financial history are retained separately.
      </p>
      <div className="flex flex-wrap gap-4">
        <Link className="underline" href="/affiliates/resources">
          Get ready-to-share marketing materials
        </Link>
        <Link className="underline" href="/affiliates/commercial">
          View referrals, agreements and earnings
        </Link>
        <Link className="underline" href="/affiliates/support">
          Get support
        </Link>
      </div>
      <PartnerAlerts />
    </div>
  );
}
function money(v: unknown) {
  return (
    "₦" +
    (Number(v || 0) / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })
  );
}
