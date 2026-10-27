import "server-only";
import { productRules, nativeCommission } from "./product-rules";
import { query } from "@/lib/custom/service";
import { verifyTransaction } from "@/lib/paystack";
// The candidate source is the existing, verified website payment ledger, never
// amounts, organizations or payment references supplied by an affiliate browser.
export async function reconcileDistributionPayments() {
  await query(
    `WITH flagged AS(INSERT INTO distribution_fraud_flags(reference,reason,affiliate_id,organization_id) SELECT p.reference,'SELF_REFERRAL',a.id,p.organization_id FROM website_plan_payments p JOIN affiliate_referrals r ON r.organization_id=p.organization_id JOIN affiliates a ON a.id=r.affiliate_id WHERE a.commission_model='policy' AND EXISTS(SELECT 1 FROM organization_members m JOIN users u ON u.id=m.user_id WHERE m.organization_id=p.organization_id AND(lower(u.email)=lower(a.email) OR EXISTS(SELECT 1 FROM distribution_account_links k WHERE k.user_id=m.user_id AND k.affiliate_id=a.id))) ON CONFLICT DO NOTHING RETURNING reference,affiliate_id) INSERT INTO distribution_program_notices(event_key,affiliate_id,subject,detail,path,audience) SELECT 'fraud-self-'||reference,affiliate_id,'JKTL referral review required','A self-referral signal requires authorized review. Commission was not accrued.','/admin/distribution/finance','STAFF' FROM flagged ON CONFLICT DO NOTHING`,
  );
  const rows = await query(
    `SELECT p.*,r.affiliate_id,c.id AS contract_id,c.terms FROM website_plan_payments p JOIN affiliate_referrals r ON r.organization_id=p.organization_id JOIN affiliates a ON a.id=r.affiliate_id JOIN distribution_contracts c ON c.affiliate_id=a.id WHERE c.status='ACTIVE' AND c.model='REFERRAL' AND c.activated_at<=p.paid_at AND a.status='active' AND a.commission_model='policy' AND NOT EXISTS(SELECT 1 FROM distribution_eligibility_pauses ep WHERE ep.affiliate_id=a.id AND p.paid_at>=ep.paused_at AND(ep.resumed_at IS NULL OR p.paid_at<ep.resumed_at)) AND NOT EXISTS(SELECT 1 FROM website_plan_refund_requests rr WHERE rr.payment_reference=p.reference) AND NOT EXISTS(SELECT 1 FROM distribution_payment_risks z WHERE z.reference=p.reference AND NOT EXISTS(SELECT 1 FROM distribution_risk_state rs WHERE rs.reference=z.reference AND rs.state='CLEARED')) AND NOT EXISTS(SELECT 1 FROM distribution_verified_payments v WHERE v.reference=p.reference) AND NOT EXISTS(SELECT 1 FROM organization_members m JOIN users u ON u.id=m.user_id WHERE m.organization_id=p.organization_id AND (lower(u.email)=lower(a.email) OR EXISTS(SELECT 1 FROM distribution_account_links k WHERE k.user_id=m.user_id AND k.affiliate_id=a.id))) ORDER BY p.paid_at,p.reference LIMIT 20`,
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
        `WITH guarded AS(SELECT c.id FROM distribution_contracts c JOIN affiliates a ON a.id=c.affiliate_id WHERE c.id=$1 AND c.status='ACTIVE' AND c.model='REFERRAL' AND a.status='active' AND a.commission_model='policy' AND NOT EXISTS(SELECT 1 FROM distribution_payment_risks z WHERE z.reference=$2 AND NOT EXISTS(SELECT 1 FROM distribution_risk_state rs WHERE rs.reference=z.reference AND rs.state='CLEARED')) FOR UPDATE OF c),proof AS(INSERT INTO distribution_verified_payments(reference,contract_id,organization_id,amount_kobo,fees_kobo,provider_transaction,months) SELECT $2,$1,$3,$4,$5,$6,$7::integer FROM guarded ON CONFLICT DO NOTHING RETURNING *),allocated AS(INSERT INTO distribution_customer_periods(contract_id,organization_id,paid_months,last_allocation) SELECT $1,$3,LEAST($7::integer,$15::integer),LEAST($7::integer,$15::integer) FROM proof ON CONFLICT(contract_id,organization_id,product) DO UPDATE SET last_allocation=LEAST($7::integer,$15::integer-distribution_customer_periods.paid_months),paid_months=distribution_customer_periods.paid_months+LEAST($7::integer,$15::integer-distribution_customer_periods.paid_months) RETURNING last_allocation),net AS(SELECT GREATEST(0,$4::bigint-$5::bigint-floor($4::numeric*$8::numeric/(10000+$8))::bigint-$9::bigint) AS amount,last_allocation FROM allocated),ledger AS(INSERT INTO distribution_ledger(reference,affiliate_id,contract_id,organization_id,currency,net_kobo,rate_bps,amount_kobo,eligible_months,available_at) SELECT $2,$10,$1,$3,'NGN',amount,$11::integer,LEAST($12::bigint,GREATEST(0,amount-$13::bigint),floor(floor(amount::numeric*last_allocation/$7::integer)*$11::integer/10000)::bigint),last_allocation,now()+make_interval(days=>$14) FROM net RETURNING reference) INSERT INTO distribution_audit(actor_id,event,affiliate_id,detail) SELECT 'system','VERIFIED_COMMISSION_PENDING',$10,jsonb_build_object('reference',reference) FROM ledger RETURNING id`,
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
  const native = await reconcileNativePayments();
  return {
    processed: processed + native.processed,
    failed: failed + native.failed,
  };
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

/** Extends the same ledger; each native product is off unless the accepted
 * contract names it and an Owner has recorded actual supplier cost evidence. */
async function reconcileNativePayments() {
  const enabled = await query(
    `SELECT 1 FROM distribution_contracts WHERE status='ACTIVE' AND model='REFERRAL' AND jsonb_array_length(COALESCE(terms->'productRules','[]'))>0 UNION ALL SELECT 1 FROM distribution_ledger WHERE product<>'website_subscription' LIMIT 1`,
  );
  if (!enabled.length) return { processed: 0, failed: 0 };
  const rows = await query(`WITH payments AS(
 SELECT o.reference,o.id,o.organization_id,o.amount_kobo,o.paid_at,p.provider_transaction,o.billing_email,1 months,'domain_registration' product,'domain_order' metadata_type FROM domain_orders o JOIN domain_payments p ON p.reference=o.reference WHERE o.paid_at IS NOT NULL AND o.status IN('PAID','PROCESSING','ACTIVE') AND o.currency='NGN' AND o.refunded_kobo=0 AND p.amount_kobo=o.amount_kobo
 UNION ALL SELECT o.reference,o.id,o.organization_id,o.amount_kobo,o.paid_at,o.provider_transaction,o.billing_email,o.period_months,'business_email','business_email' FROM email_orders o WHERE o.paid_at IS NOT NULL AND o.status IN('PAYMENT_CONFIRMED','AWAITING_DOMAIN_VERIFICATION','PENDING_SETUP','CONFIGURING','ACTIVE')
 UNION ALL SELECT i.reference,i.id,i.organization_id,i.amount_kobo,i.paid_at,i.provider_transaction,i.billing_email,CASE s.interval WHEN 'ANNUAL' THEN 12 ELSE 1 END,'custom_project','custom_invoice' FROM custom_invoices i JOIN custom_services s ON s.id=i.service_id JOIN custom_projects j ON j.id=i.project_id WHERE i.status='PAID' AND i.paid_at IS NOT NULL AND j.billing_only=false AND NOT EXISTS(SELECT 1 FROM partner_commercial_quotes q WHERE q.invoice_id=i.id OR q.payment_reference=i.reference)
 ) SELECT p.*,c.id contract_id,c.terms,a.id affiliate_id,k.cost_kobo FROM payments p JOIN affiliate_referrals r ON r.organization_id=p.organization_id JOIN affiliates a ON a.id=r.affiliate_id JOIN distribution_contracts c ON c.affiliate_id=a.id JOIN distribution_product_costs k ON k.reference=p.reference AND k.product=p.product WHERE a.status='active' AND a.commission_model='policy' AND c.status='ACTIVE' AND c.model='REFERRAL' AND c.activated_at<=p.paid_at AND NOT EXISTS(SELECT 1 FROM distribution_eligibility_pauses ep WHERE ep.affiliate_id=a.id AND p.paid_at>=ep.paused_at AND(ep.resumed_at IS NULL OR p.paid_at<ep.resumed_at)) AND EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(c.terms->'productRules','[]')) rule WHERE rule->>'product'=p.product) AND NOT EXISTS(SELECT 1 FROM distribution_verified_payments v WHERE v.reference=p.reference) AND NOT EXISTS(SELECT 1 FROM distribution_risk_state z WHERE z.reference=p.reference AND z.state<>'CLEARED') AND NOT EXISTS(SELECT 1 FROM organization_members m JOIN users u ON u.id=m.user_id WHERE m.organization_id=p.organization_id AND(lower(u.email)=lower(a.email) OR EXISTS(SELECT 1 FROM distribution_account_links l WHERE l.user_id=u.id AND l.affiliate_id=a.id))) ORDER BY p.paid_at,p.reference LIMIT 20`);
  let processed = 0,
    failed = 0;
  for (const p of rows)
    try {
      const rule = productRules(
        (p.terms as Record<string, unknown>).productRules,
      ).find((r) => r.product === p.product);
      if (!rule) continue;
      const tx = await verifyTransaction(String(p.reference));
      const metadata = tx.metadata as Record<string, unknown> | null;
      if (
        tx.status !== "success" ||
        tx.domain !== "live" ||
        tx.currency !== "NGN" ||
        tx.reference !== p.reference ||
        Number(tx.amount) !== Number(p.amount_kobo) ||
        String(tx.id) !== String(p.provider_transaction) ||
        !Number.isSafeInteger(tx.fees) ||
        Number(tx.fees) < 0 ||
        String(tx.customer?.email || "").toLowerCase() !==
          String(p.billing_email).toLowerCase() ||
        metadata?.organizationId !== p.organization_id ||
        metadata?.type !== p.metadata_type ||
        (metadata?.orderId || metadata?.invoiceId) !== p.id
      )
        continue;
      const months = rule.recurring ? Number(p.months) : 1;
      if (!Number.isInteger(months) || months < 1 || months > 36) continue;
      // Serialize allocation with the existing contract lock. The insert is atomic;
      // actual month allocation and the final financial calculation happen in SQL.
      const preview = nativeCommission(
        rule,
        Number(p.amount_kobo),
        Number(tx.fees),
        Number(p.cost_kobo),
        months,
        months,
      );
      const result = await query(
        `WITH guarded AS(SELECT c.id FROM distribution_contracts c JOIN affiliates a ON a.id=c.affiliate_id WHERE c.id=$1 AND c.status='ACTIVE' AND c.model='REFERRAL' AND a.status='active' AND a.commission_model='policy' AND NOT EXISTS(SELECT 1 FROM distribution_risk_state z WHERE z.reference=$2 AND z.state<>'CLEARED') FOR UPDATE OF c),proof AS(INSERT INTO distribution_verified_payments(reference,contract_id,organization_id,amount_kobo,fees_kobo,provider_transaction,months,product,costs_kobo,tax_kobo) SELECT $2,$1,$3,$4,$5,$6,$7,$8,$9,$10 FROM guarded ON CONFLICT DO NOTHING RETURNING *),period AS(INSERT INTO distribution_customer_periods(contract_id,organization_id,product,paid_months,last_allocation) SELECT $1,$3,$8,LEAST($7::int,$11::int),LEAST($7::int,$11::int) FROM proof WHERE $12::boolean ON CONFLICT(contract_id,organization_id,product) DO UPDATE SET last_allocation=LEAST($7::int,$11::int-distribution_customer_periods.paid_months),paid_months=distribution_customer_periods.paid_months+LEAST($7::int,$11::int-distribution_customer_periods.paid_months) RETURNING last_allocation),allocation AS(SELECT last_allocation FROM period UNION ALL SELECT $7::int FROM proof WHERE NOT $12::boolean),ledger AS(INSERT INTO distribution_ledger(reference,affiliate_id,contract_id,organization_id,currency,product,net_kobo,rate_bps,amount_kobo,eligible_months,available_at) SELECT $2,$13,$1,$3,'NGN',$8,$14,$15,CASE WHEN last_allocation=0 THEN 0 ELSE LEAST($16::bigint,GREATEST(0,$14::bigint-$17::bigint),CASE WHEN $18='FIXED' THEN floor($19::numeric*last_allocation/$7::int)::bigint ELSE floor(floor($14::numeric*last_allocation/$7::int)*$15::int/10000)::bigint END) END,last_allocation,now()+make_interval(days=>$20) FROM allocation RETURNING reference) INSERT INTO distribution_audit(actor_id,event,affiliate_id,detail) SELECT 'system','NATIVE_PRODUCT_COMMISSION_PENDING',$13,jsonb_build_object('reference',reference,'product',$8::text,'costEvidence',true) FROM ledger RETURNING id`,
        [
          p.contract_id,
          p.reference,
          p.organization_id,
          Number(p.amount_kobo),
          Number(tx.fees),
          String(tx.id),
          months,
          p.product,
          Number(p.cost_kobo),
          preview.taxKobo,
          rule.paidMonths,
          rule.recurring,
          p.affiliate_id,
          preview.netKobo,
          rule.rateBps,
          rule.capKobo,
          rule.marginReserveKobo,
          rule.kind,
          rule.fixedKobo,
          Number((p.terms as Record<string, unknown>).holdDays),
        ],
      );
      processed += result.length;
    } catch {
      failed++;
    }
  await query(
    `WITH reversed AS(UPDATE distribution_ledger l SET status='REVERSED' FROM domain_orders d WHERE l.reference=d.reference AND d.refunded_kobo>0 AND l.status IN('PENDING','UNDER_REVIEW','AVAILABLE') RETURNING l.reference) INSERT INTO distribution_adjustments(reference,affiliate_id,amount_kobo,reason) SELECT l.reference,l.affiliate_id,-l.amount_kobo,'Verified domain refund; any partial entitlement requires Owner reconciliation' FROM distribution_ledger l JOIN domain_orders d ON d.reference=l.reference WHERE d.refunded_kobo>0 AND l.status='PAID' ON CONFLICT(reference) DO NOTHING`,
  );
  return { processed, failed };
}
