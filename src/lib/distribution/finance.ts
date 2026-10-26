import "server-only";
import { query } from "@/lib/custom/service";
import { verifyTransaction } from "@/lib/paystack";
// The candidate source is the existing, verified website payment ledger, never
// amounts, organizations or payment references supplied by an affiliate browser.
export async function reconcileDistributionPayments() {
  await query(
    `WITH flagged AS(INSERT INTO distribution_fraud_flags(reference,reason,affiliate_id,organization_id) SELECT p.reference,'SELF_REFERRAL',a.id,p.organization_id FROM website_plan_payments p JOIN affiliate_referrals r ON r.organization_id=p.organization_id JOIN affiliates a ON a.id=r.affiliate_id WHERE a.commission_model='policy' AND EXISTS(SELECT 1 FROM organization_members m JOIN users u ON u.id=m.user_id WHERE m.organization_id=p.organization_id AND(lower(u.email)=lower(a.email) OR EXISTS(SELECT 1 FROM distribution_account_links k WHERE k.user_id=m.user_id AND k.affiliate_id=a.id))) ON CONFLICT DO NOTHING RETURNING reference,affiliate_id) INSERT INTO distribution_program_notices(event_key,affiliate_id,subject,detail,path,audience) SELECT 'fraud-self-'||reference,affiliate_id,'JKTL referral review required','A self-referral signal requires authorized review. Commission was not accrued.','/admin/distribution/finance','STAFF' FROM flagged ON CONFLICT DO NOTHING`,
  );
  const rows = await query(
    `SELECT p.*,r.affiliate_id,c.id AS contract_id,c.terms FROM website_plan_payments p JOIN affiliate_referrals r ON r.organization_id=p.organization_id JOIN affiliates a ON a.id=r.affiliate_id JOIN distribution_contracts c ON c.affiliate_id=a.id WHERE c.status='ACTIVE' AND c.model='REFERRAL' AND c.activated_at<=p.paid_at AND a.status='active' AND a.commission_model='policy' AND NOT EXISTS(SELECT 1 FROM website_plan_refund_requests rr WHERE rr.payment_reference=p.reference) AND NOT EXISTS(SELECT 1 FROM distribution_payment_risks z WHERE z.reference=p.reference AND NOT EXISTS(SELECT 1 FROM distribution_risk_state rs WHERE rs.reference=z.reference AND rs.state='CLEARED')) AND NOT EXISTS(SELECT 1 FROM distribution_verified_payments v WHERE v.reference=p.reference) AND NOT EXISTS(SELECT 1 FROM organization_members m JOIN users u ON u.id=m.user_id WHERE m.organization_id=p.organization_id AND (lower(u.email)=lower(a.email) OR EXISTS(SELECT 1 FROM distribution_account_links k WHERE k.user_id=m.user_id AND k.affiliate_id=a.id))) ORDER BY p.paid_at,p.reference LIMIT 20`,
  );
  let processed = 0,
    failed = 0;
  for (const p of rows)
    try {
      const tx = await verifyTransaction(String(p.reference));
      const terms = p.terms as Record<string, unknown>;
      if (
        tx.status !== "success" ||
        tx.domain !== "live" ||
        tx.reference !== p.reference ||
        tx.currency !== "NGN" ||
        Number(tx.amount) !== Number(p.amount_kobo) ||
        String(tx.id) !== String(p.provider_transaction_id) ||
        !Number.isSafeInteger(tx.fees) ||
        Number(tx.fees) < 0
      )
        continue;
      if (!Array.isArray(terms.plans) || !terms.plans.includes(p.plan_id))
        continue;
      const r = await query(
        `WITH guarded AS(SELECT c.id FROM distribution_contracts c JOIN affiliates a ON a.id=c.affiliate_id WHERE c.id=$1 AND c.status='ACTIVE' AND c.model='REFERRAL' AND a.status='active' AND a.commission_model='policy' AND NOT EXISTS(SELECT 1 FROM distribution_payment_risks z WHERE z.reference=$2 AND NOT EXISTS(SELECT 1 FROM distribution_risk_state rs WHERE rs.reference=z.reference AND rs.state='CLEARED')) FOR UPDATE OF c),proof AS(INSERT INTO distribution_verified_payments(reference,contract_id,organization_id,amount_kobo,fees_kobo,provider_transaction,months) SELECT $2,$1,$3,$4,$5,$6,$7::integer FROM guarded ON CONFLICT DO NOTHING RETURNING *),allocated AS(INSERT INTO distribution_customer_periods(contract_id,organization_id,paid_months,last_allocation) SELECT $1,$3,LEAST($7::integer,$15::integer),LEAST($7::integer,$15::integer) FROM proof ON CONFLICT(contract_id,organization_id) DO UPDATE SET last_allocation=LEAST($7::integer,$15::integer-distribution_customer_periods.paid_months),paid_months=distribution_customer_periods.paid_months+LEAST($7::integer,$15::integer-distribution_customer_periods.paid_months) RETURNING last_allocation),net AS(SELECT GREATEST(0,$4::bigint-$5::bigint-floor($4::numeric*$8::numeric/(10000+$8))::bigint-$9::bigint) AS amount,last_allocation FROM allocated),ledger AS(INSERT INTO distribution_ledger(reference,affiliate_id,contract_id,organization_id,currency,net_kobo,rate_bps,amount_kobo,eligible_months,available_at) SELECT $2,$10,$1,$3,'NGN',amount,$11::integer,LEAST($12::bigint,GREATEST(0,amount-$13::bigint),floor(floor(amount::numeric*last_allocation/$7::integer)*$11::integer/10000)::bigint),last_allocation,now()+make_interval(days=>$14) FROM net RETURNING reference) INSERT INTO distribution_audit(actor_id,event,affiliate_id,detail) SELECT 'system','VERIFIED_COMMISSION_PENDING',$10,jsonb_build_object('reference',reference) FROM ledger RETURNING id`,
        [
          p.contract_id,
          p.reference,
          p.organization_id,
          Number(p.amount_kobo),
          Number(tx.fees),
          String(tx.id),
          p.interval === "yearly" ? 12 : 1,
          Number(terms.taxBps),
          Number(terms.thirdPartyCostKobo),
          p.affiliate_id,
          Number(terms.rateBps),
          Number(terms.capKobo),
          Number(terms.marginReserveKobo),
          Number(terms.holdDays),
          Number(terms.paidMonths),
        ],
      );
      processed += r.length;
    } catch {
      failed++;
    }
  // Existing confirmed refund records are authoritative for these products.
  // A paid ledger row stays PAID; a separate negative adjustment records the debt.
  await query(
    `WITH reversed AS(UPDATE distribution_ledger l SET status='REVERSED' FROM website_plan_refund_requests r WHERE r.payment_reference=l.reference AND r.status='refunded' AND l.status IN('PENDING','UNDER_REVIEW','AVAILABLE') RETURNING l.reference),adjusted AS(INSERT INTO distribution_adjustments(reference,affiliate_id,amount_kobo,reason) SELECT l.reference,l.affiliate_id,-l.amount_kobo,'Verified website refund' FROM distribution_ledger l JOIN website_plan_refund_requests r ON r.payment_reference=l.reference WHERE r.status='refunded' AND l.status='PAID' ON CONFLICT(reference) DO NOTHING RETURNING id) SELECT count(*) FROM adjusted`,
  );
  return { processed, failed };
}

/** Called only after Paystack signature validation. Store even when charge
 * fulfilment is late, so an out-of-order refund cannot earn a commission. */
export async function recordDistributionRisk(
  event: string,
  data: Record<string, unknown>,
) {
  if (
    ![
      "refund.processed",
      "charge.dispute.create",
      "charge.dispute.remind",
      "charge.dispute.resolve",
    ].includes(event)
  )
    return;
  const transaction =
    data.transaction && typeof data.transaction === "object"
      ? (data.transaction as Record<string, unknown>)
      : {};
  const reference = String(
    transaction.reference || data.transaction_reference || data.reference || "",
  );
  if (!reference || reference.length > 200) return;
  await query(
    `WITH event AS(INSERT INTO distribution_payment_risks(event_key,reference,kind) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING reference) INSERT INTO distribution_risk_state(reference,state) SELECT reference,$4 FROM event ON CONFLICT(reference) DO UPDATE SET state=CASE WHEN distribution_risk_state.state IN('REFUNDED','LOST') THEN distribution_risk_state.state ELSE excluded.state END,updated_at=now()`,
    [
      event + ":" + String(data.id || reference),
      reference,
      event,
      event === "refund.processed" ? "REFUNDED" : "OPEN",
    ],
  );
  if (event === "refund.processed")
    await query(
      `WITH reversed AS(UPDATE distribution_ledger SET status='REVERSED' WHERE reference=$1 AND status IN('PENDING','UNDER_REVIEW','AVAILABLE') RETURNING reference) INSERT INTO distribution_adjustments(reference,affiliate_id,amount_kobo,reason) SELECT reference,affiliate_id,-amount_kobo,$2 FROM distribution_ledger WHERE reference=$1 AND status='PAID' ON CONFLICT(reference) DO NOTHING`,
      [reference, event],
    );
  else
    await query(
      "UPDATE distribution_ledger SET status='UNDER_REVIEW' WHERE reference=$1 AND status IN('PENDING','AVAILABLE')",
      [reference],
    );
}
