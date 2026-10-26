"use server";
import { after } from "next/server";
import { flushProgramNotices } from "@/lib/distribution/notifications";
import { requireAdminCapability } from "@/lib/admin-session";
import { requireAffiliateSession } from "@/lib/affiliate-session";
import { query } from "@/lib/custom/service";
import { revalidatePath } from "next/cache";
function int(f: FormData, key: string, min: number, max: number) {
  const raw = f.get(key);
  if (raw === null || String(raw).trim() === "") throw Error("Check " + key);
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < min || n > max)
    throw Error("Check " + key);
  return n;
}
export async function offerDistributionContractAction(f: FormData) {
  const a = await requireAdminCapability("manage_team");
  const model = String(f.get("model"));
  if (!["REFERRAL", "RESELLER"].includes(model))
    throw Error("Choose a commercial model");
  const terms = {
    refundTermPolicy:
      "Refunds reverse commission without automatically extending the acquisition term; disputed timing requires administrator reconciliation.",
    rateBps: int(f, "rateBps", 0, 5000),
    paidMonths: int(f, "duration", 1, 12),
    holdDays: int(f, "holdDays", 14, 365),
    taxBps: int(f, "taxBps", 0, 10000),
    thirdPartyCostKobo: int(f, "thirdPartyCostKobo", 0, 2000000000),
    marginReserveKobo: int(f, "marginReserveKobo", 0, 2000000000),
    capKobo: int(f, "capKobo", 1, 2000000000),
    currency: "NGN",
    plans: f.getAll("plans").map(String),
    wholesaleNote: String(f.get("wholesaleNote") || "")
      .trim()
      .slice(0, 3000),
    netDefinition:
      "Captured amount less actual processing fees, included sales tax and agreed pass-through costs; discounts already excluded. No commission on refunded or disputed payments.",
  };
  if (
    model === "RESELLER" &&
    (terms.rateBps !== 0 || terms.wholesaleNote.length < 20)
  )
    throw Error(
      "Reseller terms require zero referral commission and a detailed wholesale agreement",
    );
  if (!terms.plans.length && model === "REFERRAL")
    throw Error("Choose eligible plans");
  const r = await query(
    `WITH offered AS(INSERT INTO distribution_contracts(affiliate_id,policy_id,terms,model,created_by) SELECT a.id,p.id,$3::jsonb,$4,$5 FROM affiliates a JOIN distribution_policies p ON p.id=$2 WHERE a.id=$1 AND($4='REFERRAL' OR a.programme='partner') AND p.state='DRAFT' AND p.program=upper(a.programme) AND NOT EXISTS(SELECT 1 FROM affiliate_referrals r WHERE r.affiliate_id=a.id) AND NOT EXISTS(SELECT 1 FROM affiliate_earnings e WHERE e.affiliate_id=a.id) RETURNING id,affiliate_id) INSERT INTO distribution_audit(actor_id,event,affiliate_id,detail) SELECT $5,'COMMERCIAL_TERMS_OFFERED',affiliate_id,jsonb_build_object('contract',id,'terms',$3::jsonb,'model',$4::text) FROM offered RETURNING id`,
    [
      String(f.get("affiliate")),
      String(f.get("policy")),
      JSON.stringify(terms),
      model,
      a.id,
    ],
  );
  if (!r.length)
    throw Error(
      "Only new participants without existing referrals or earnings can receive this agreement. Legacy accounts require separate reconciliation.",
    );
  after(async () => {
    try {
      await flushProgramNotices();
    } catch {}
  });
  revalidatePath("/admin/distribution/finance");
}
export async function acceptDistributionContractAction(f: FormData) {
  const p = await requireAffiliateSession();
  if (f.get("consent") !== "on")
    throw Error("Read and accept the commercial terms");
  const r = await query(
    `WITH accepted AS(UPDATE distribution_contracts SET status='ACCEPTED',accepted_at=now() WHERE id=$1 AND affiliate_id=$2 AND status='OFFERED' RETURNING id) INSERT INTO distribution_audit(actor_id,event,affiliate_id,detail) SELECT $2,'COMMERCIAL_TERMS_ACCEPTED',$2,jsonb_build_object('contract',id) FROM accepted RETURNING id`,
    [String(f.get("id")), p.id],
  );
  if (!r.length) throw Error("Agreement unavailable");
  revalidatePath("/partners/commercial");
  revalidatePath("/affiliates/commercial");
}
export async function activateDistributionContractAction(f: FormData) {
  const a = await requireAdminCapability("manage_team");
  if (f.get("approved") !== "on")
    throw Error(
      "Confirm the agreement, economics and coordinated terms approval",
    );
  const r = await query(
    `WITH eligible AS(SELECT c.id,c.affiliate_id FROM distribution_contracts c JOIN affiliates a ON a.id=c.affiliate_id WHERE c.id=$1 AND c.status='ACCEPTED' AND a.status='active' AND NOT EXISTS(SELECT 1 FROM affiliate_referrals r WHERE r.affiliate_id=a.id) AND NOT EXISTS(SELECT 1 FROM affiliate_earnings e WHERE e.affiliate_id=a.id) FOR UPDATE OF c,a),activated AS(UPDATE distribution_contracts c SET status='ACTIVE',activated_at=now(),activated_by=$2 FROM eligible e WHERE c.id=e.id RETURNING c.id,c.affiliate_id,c.terms),converted AS(UPDATE affiliates a SET commission_model='policy',commission_bps=(c.terms->>'rateBps')::integer,signup_bonus_kobo=0,subscription_bonus_kobo=0,recurring_monthly_kobo=0 FROM activated c WHERE a.id=c.affiliate_id RETURNING a.id) INSERT INTO distribution_audit(actor_id,event,affiliate_id,detail) SELECT $2,'NEW_COHORT_AGREEMENT_ACTIVATED',c.affiliate_id,jsonb_build_object('contract',c.id) FROM activated c JOIN converted a ON a.id=c.affiliate_id RETURNING id`,
    [String(f.get("id")), a.id],
  );
  if (!r.length)
    throw Error(
      "Activation blocked. Accepted terms, approval and no existing legacy obligations are required.",
    );
  after(async () => {
    try {
      await flushProgramNotices();
    } catch {}
  });
  revalidatePath("/admin/distribution/finance");
}
export async function reviewDistributionCommissionAction(f: FormData) {
  const a = await requireAdminCapability("record_payouts");
  const reject = f.get("reject") === "on",
    reason = String(f.get("reason") || "").trim();
  if (reason.length < 10 || reason.length > 2000)
    throw Error("A reconciliation reason is required");
  const r = await query(
    `WITH reviewed AS(UPDATE distribution_ledger l SET status=CASE WHEN $2 THEN 'REJECTED' ELSE 'AVAILABLE' END FROM distribution_contracts c,affiliates a WHERE l.reference=$1 AND l.contract_id=c.id AND a.id=l.affiliate_id AND a.status='active' AND c.status='ACTIVE' AND l.status IN('PENDING','UNDER_REVIEW') AND($2 OR l.available_at<=now()) AND NOT EXISTS(SELECT 1 FROM distribution_payment_risks z WHERE z.reference=l.reference AND NOT EXISTS(SELECT 1 FROM distribution_risk_state rs WHERE rs.reference=z.reference AND rs.state='CLEARED')) AND NOT EXISTS(SELECT 1 FROM website_plan_refund_requests r WHERE r.payment_reference=l.reference AND r.status IN('requested','processing','refunded')) RETURNING l.reference,l.affiliate_id) INSERT INTO distribution_audit(actor_id,event,affiliate_id,detail) SELECT $3,'COMMISSION_REVIEWED',affiliate_id,jsonb_build_object('reference',reference,'rejected',$2::boolean,'reason',$4::text) FROM reviewed RETURNING id`,
    [String(f.get("reference")), reject, a.id, reason],
  );
  if (!r.length)
    throw Error(
      "Commission is held, already processed, under a payment review or outside its eligibility window",
    );
  after(async () => {
    try {
      await flushProgramNotices();
    } catch {}
  });
  revalidatePath("/admin/distribution/finance");
}
export async function requestDistributionPayoutAction() {
  const p = await requireAffiliateSession();
  const r = await query(
    `WITH eligible AS(SELECT a.* FROM affiliates a WHERE a.id=$1 AND a.status='active' AND a.bank_verified_at IS NOT NULL AND a.commission_model='policy' AND NOT EXISTS(SELECT 1 FROM distribution_ledger l JOIN distribution_risk_state rs ON rs.reference=l.reference WHERE l.affiliate_id=a.id AND rs.state='OPEN') AND NOT EXISTS(SELECT 1 FROM distribution_payouts p WHERE p.affiliate_id=a.id AND p.status IN('REQUESTED','APPROVED')) FOR UPDATE),earned AS(SELECT COALESCE(sum(l.amount_kobo),0) total FROM distribution_ledger l CROSS JOIN eligible a WHERE l.affiliate_id=a.id AND l.status='AVAILABLE' AND NOT EXISTS(SELECT 1 FROM website_plan_refund_requests r WHERE r.payment_reference=l.reference) AND NOT EXISTS(SELECT 1 FROM distribution_payment_risks z WHERE z.reference=l.reference AND NOT EXISTS(SELECT 1 FROM distribution_risk_state rs WHERE rs.reference=z.reference AND rs.state='CLEARED'))),debts AS(SELECT COALESCE(sum(d.amount_kobo),0) total FROM distribution_adjustments d CROSS JOIN eligible a WHERE d.affiliate_id=a.id AND d.payout_id IS NULL),created AS(INSERT INTO distribution_payouts(affiliate_id,amount_kobo,bank_snapshot) SELECT a.id,e.total+d.total,jsonb_build_object('bankName',a.bank_name,'bankCode',a.bank_code,'accountNumber',a.account_number,'accountName',a.account_name) FROM eligible a CROSS JOIN earned e CROSS JOIN debts d CROSS JOIN distribution_finance_settings s WHERE e.total+d.total>=s.minimum_payout_kobo AND extract(day FROM now() AT TIME ZONE 'Africa/Lagos')>=s.payout_day RETURNING id),reserved AS(UPDATE distribution_ledger l SET status='RESERVED',payout_id=(SELECT id FROM created) WHERE affiliate_id=$1 AND status='AVAILABLE' AND EXISTS(SELECT 1 FROM created) AND NOT EXISTS(SELECT 1 FROM website_plan_refund_requests r WHERE r.payment_reference=l.reference) AND NOT EXISTS(SELECT 1 FROM distribution_payment_risks z WHERE z.reference=l.reference AND NOT EXISTS(SELECT 1 FROM distribution_risk_state rs WHERE rs.reference=z.reference AND rs.state='CLEARED')) RETURNING reference),debt_linked AS(UPDATE distribution_adjustments SET payout_id=(SELECT id FROM created) WHERE affiliate_id=$1 AND payout_id IS NULL AND EXISTS(SELECT 1 FROM created) RETURNING id) INSERT INTO distribution_audit(actor_id,event,affiliate_id,detail) SELECT $1,'PAYOUT_REQUESTED',$1,jsonb_build_object('payout',id) FROM created RETURNING id`,
    [p.id],
  );
  if (!r.length)
    throw Error(
      "Payout unavailable. Verify bank details, available balance, minimum amount and the monthly request window.",
    );
  revalidatePath("/partners/commercial");
  revalidatePath("/affiliates/commercial");
}
export async function manageDistributionPayoutAction(f: FormData) {
  const a = await requireAdminCapability("record_payouts");
  const status = String(f.get("status")),
    id = String(f.get("id")),
    reference = String(f.get("bankReference") || "").trim();
  if (
    !["APPROVED", "PAID", "DECLINED"].includes(status) ||
    (status === "PAID" &&
      (f.get("confirmed") !== "on" ||
        reference.length < 5 ||
        reference.length > 200))
  )
    throw Error(
      "Confirm the actual bank transfer and reference before marking paid",
    );
  const result = await query(
    `WITH changed AS(UPDATE distribution_payouts p SET status=$2,bank_reference=CASE WHEN $2='PAID' THEN $3 ELSE bank_reference END,confirmed_by=CASE WHEN $2='PAID' THEN $4 ELSE confirmed_by END,confirmed_at=CASE WHEN $2='PAID' THEN now() ELSE confirmed_at END WHERE id=$1 AND(status='REQUESTED' AND $2 IN('APPROVED','DECLINED') OR status='APPROVED' AND $2 IN('PAID','DECLINED')) AND($2='DECLINED' OR EXISTS(SELECT 1 FROM affiliates a WHERE a.id=p.affiliate_id AND a.status='active') AND NOT EXISTS(SELECT 1 FROM distribution_ledger l JOIN distribution_risk_state rs ON rs.reference=l.reference WHERE l.affiliate_id=p.affiliate_id AND rs.state='OPEN') AND NOT EXISTS(SELECT 1 FROM distribution_ledger l JOIN distribution_payment_risks r ON r.reference=l.reference WHERE l.payout_id=p.id AND NOT EXISTS(SELECT 1 FROM distribution_risk_state rs WHERE rs.reference=r.reference AND rs.state='CLEARED')) AND NOT EXISTS(SELECT 1 FROM distribution_ledger l JOIN website_plan_refund_requests r ON r.payment_reference=l.reference WHERE l.payout_id=p.id)) RETURNING id,affiliate_id),ledger AS(UPDATE distribution_ledger l SET status=CASE WHEN $2='PAID' THEN 'PAID' WHEN $2='DECLINED' THEN CASE WHEN EXISTS(SELECT 1 FROM distribution_payment_risks r WHERE r.reference=l.reference AND NOT EXISTS(SELECT 1 FROM distribution_risk_state rs WHERE rs.reference=r.reference AND rs.state='CLEARED')) THEN CASE WHEN EXISTS(SELECT 1 FROM distribution_risk_state rs WHERE rs.reference=l.reference AND rs.state='OPEN') THEN 'UNDER_REVIEW' ELSE 'REVERSED' END WHEN EXISTS(SELECT 1 FROM website_plan_refund_requests rf WHERE rf.payment_reference=l.reference) THEN CASE WHEN EXISTS(SELECT 1 FROM website_plan_refund_requests rf WHERE rf.payment_reference=l.reference AND rf.status='refunded') THEN 'REVERSED' ELSE 'UNDER_REVIEW' END ELSE 'AVAILABLE' END ELSE l.status END,payout_id=CASE WHEN $2='DECLINED' THEN NULL ELSE l.payout_id END FROM changed p WHERE l.payout_id=p.id RETURNING l.reference),debts AS(UPDATE distribution_adjustments d SET payout_id=NULL FROM changed p WHERE d.payout_id=p.id AND $2='DECLINED' RETURNING d.id) INSERT INTO distribution_audit(actor_id,event,affiliate_id,detail) SELECT $4,'PAYOUT_'||$2,affiliate_id,jsonb_build_object('payout',id,'bankReference',NULLIF($3,'')) FROM changed RETURNING id`,
    [id, status, reference, a.id],
  );
  if (!result.length)
    throw Error(
      "Payout is already processed or a payment risk blocks this transition",
    );
  after(async () => {
    try {
      await flushProgramNotices();
    } catch {}
  });
  revalidatePath("/admin/distribution/finance");
}
export async function reconcileDistributionAction() {
  await requireAdminCapability("record_payouts");
  const { reconcileDistributionPayments } =
    await import("@/lib/distribution/finance");
  return reconcileDistributionPayments();
}

export async function resolveDistributionRiskAction(f: FormData) {
  const a = await requireAdminCapability("manage_team");
  const state = String(f.get("state")),
    reference = String(f.get("reference")),
    evidence = String(f.get("evidence") || "").trim();
  if (
    !["CLEARED", "LOST"].includes(state) ||
    evidence.length < 10 ||
    evidence.length > 2000 ||
    f.get("confirmed") !== "on"
  )
    throw Error("Verify the actual provider outcome and record its evidence");
  const r = await query(
    `WITH resolved AS(UPDATE distribution_risk_state SET state=$2,evidence=$3,updated_by=$4,updated_at=now() WHERE reference=$1 AND state='OPEN' RETURNING reference),changed AS(UPDATE distribution_ledger l SET status=CASE WHEN $2='CLEARED' THEN 'PENDING' ELSE 'REVERSED' END FROM resolved r WHERE l.reference=r.reference AND l.status IN('PENDING','UNDER_REVIEW','AVAILABLE') RETURNING l.reference),debts AS(INSERT INTO distribution_adjustments(reference,affiliate_id,amount_kobo,reason) SELECT l.reference,l.affiliate_id,-l.amount_kobo,'Verified lost dispute: '||$3 FROM distribution_ledger l JOIN resolved r ON r.reference=l.reference WHERE $2='LOST' AND l.status='PAID' ON CONFLICT(reference) DO NOTHING RETURNING id) INSERT INTO distribution_audit(actor_id,event,detail) SELECT $4,'DISPUTE_RECONCILED',jsonb_build_object('reference',reference,'outcome',$2::text,'evidence',$3::text) FROM resolved RETURNING id`,
    [reference, state, evidence, a.id],
  );
  if (!r.length)
    throw Error(
      "Only an open dispute can be reconciled; confirmed refunds and prior losses remain in history",
    );
  revalidatePath("/admin/distribution/finance");
}
export async function distributionBeneficiaryAction(id: string) {
  const a = await requireAdminCapability("record_payouts");
  const p = (
    await query(
      "SELECT bank_snapshot FROM distribution_payouts WHERE id=$1 AND status IN('REQUESTED','APPROVED')",
      [id],
    )
  )[0];
  if (!p) throw Error("Open payout not found");
  await query(
    "INSERT INTO distribution_audit(actor_id,event,detail) VALUES($1,'PAYOUT_BENEFICIARY_VIEWED',jsonb_build_object('payout',$2::uuid))",
    [a.id, id],
  );
  const b = p.bank_snapshot as Record<string, unknown>;
  return {
    bankName: String(b.bankName || ""),
    bankCode: String(b.bankCode || ""),
    accountNumber: String(b.accountNumber || ""),
    accountName: String(b.accountName || ""),
  };
}
export async function setDistributionPayoutSettingsAction(f: FormData) {
  const a = await requireAdminCapability("manage_team");
  const minimum = int(f, "minimum", 1, 2000000000),
    day = int(f, "day", 1, 28);
  await query(
    `WITH changed AS(UPDATE distribution_finance_settings SET minimum_payout_kobo=$1,payout_day=$2 WHERE id=true RETURNING id) INSERT INTO distribution_audit(actor_id,event,detail) SELECT $3,'NEW_POLICY_PAYOUT_SETTINGS_CHANGED',jsonb_build_object('minimumKobo',$1::bigint,'day',$2::integer) FROM changed`,
    [minimum, day, a.id],
  );
  revalidatePath("/admin/distribution/finance");
}
