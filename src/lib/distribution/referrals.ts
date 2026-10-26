import "server-only";
import { cookies } from "next/headers";
import { query } from "@/lib/custom/service";
export async function consumeReferralVisit(org: string) {
  const token = (await cookies()).get("jktl_referral_visit")?.value;
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return;
  const rows = await query(
    `WITH attributed AS(INSERT INTO affiliate_referrals(affiliate_id,organization_id) SELECT a.id,$2 FROM distribution_referral_visits v JOIN affiliates a ON a.id=v.affiliate_id JOIN organizations o ON o.id=$2 WHERE v.id=$1 AND v.expires_at>now() AND(v.consumed_organization_id IS NULL OR v.consumed_organization_id=$2) AND a.status='active' AND o.created_at>now()-interval '30 days' AND NOT EXISTS(SELECT 1 FROM website_plan_payments p WHERE p.organization_id=$2) AND NOT EXISTS(SELECT 1 FROM domain_orders p WHERE p.organization_id=$2 AND p.paid_at IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM email_orders p WHERE p.organization_id=$2 AND p.paid_at IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM infrastructure_accounts p WHERE p.organization_id=$2 AND p.subscription_status='active') AND NOT EXISTS(SELECT 1 FROM organization_members m JOIN users u ON u.id=m.user_id WHERE m.organization_id=$2 AND(lower(u.email)=lower(a.email) OR EXISTS(SELECT 1 FROM distribution_account_links l WHERE l.user_id=u.id AND l.affiliate_id=a.id))) ON CONFLICT(organization_id) DO NOTHING RETURNING affiliate_id,organization_id),pending_bonus AS(INSERT INTO affiliate_earnings(affiliate_id,organization_id,source_amount_kobo,commission_kobo,paystack_reference,kind,status,period_key,note) SELECT a.id,$2,0,a.signup_bonus_kobo,'','signup','pending','','Signup bonus held until a qualifying payment' FROM attributed r JOIN affiliates a ON a.id=r.affiliate_id WHERE a.commission_model<>'policy' AND a.signup_bonus_kobo>0 ON CONFLICT DO NOTHING RETURNING id),consumed AS(UPDATE distribution_referral_visits SET consumed_organization_id=$2 WHERE id=$1 AND EXISTS(SELECT 1 FROM attributed) RETURNING id) INSERT INTO distribution_audit(actor_id,event,affiliate_id,detail) SELECT 'system','CONSENTED_REFERRAL_ATTRIBUTED',affiliate_id,jsonb_build_object('organization',organization_id,'visit',$1::uuid) FROM attributed RETURNING id`,
    [token, org],
  );
  void rows;
}
export async function cleanReferralVisits() {
  await query(
    "DELETE FROM distribution_referral_visits WHERE expires_at<now() AND consumed_organization_id IS NULL",
  );
  return { failed: 0 };
}
