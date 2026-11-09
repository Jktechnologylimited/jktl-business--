import "server-only";
import { query } from "@/lib/custom/service";
import { requireAdminCapability } from "@/lib/admin-session";
import { invoiceAccess } from "@/lib/invoicing/access";
import { reportPeriod, type Period } from "@/lib/investor/model";
export type PaymentFilters = {
  status?: string;
  source?: string;
  provider?: string;
  business?: string;
};
const STATES = [
  "SUCCESS",
  "REFUNDED",
  "DISPUTED",
  "REVIEW",
  "PENDING",
  "FAILED",
];
export function checkedPaymentFilters(f: PaymentFilters) {
  if (
    (f.status && !STATES.includes(f.status)) ||
    (f.source && !["INVOICE", "WEBSITE"].includes(f.source)) ||
    (f.provider && f.provider !== "paystack") ||
    (f.business &&
      !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(f.business))
  )
    throw Error("Choose valid payment filters.");
  return f;
}
/** A successful row is a verified provider charge. Settlement and refunds are separate evidence. */
const BASE = `WITH records AS(
 SELECT p.reference,p.organization_id,p.invoice_id,p.provider,p.source,p.mode,
 CASE WHEN EXISTS(SELECT 1 FROM merchant_payment_events e WHERE e.reference=p.reference AND e.kind='DISPUTE') THEN 'DISPUTED' WHEN EXISTS(SELECT 1 FROM merchant_payment_events e WHERE e.reference=p.reference AND e.kind='REFUND') THEN 'REFUNDED' WHEN NOT p.applied_to_invoice THEN 'REVIEW' ELSE 'SUCCESS' END status,
 p.principal_kobo,p.gross_fee_kobo,p.charged_kobo,COALESCE(p.processor_kobo,(SELECT e.amount_kobo FROM merchant_payment_events e WHERE e.reference=p.reference AND e.kind='PROCESSOR_COST' LIMIT 1)) processor_kobo,
 (p.mode='live' OR EXISTS(SELECT 1 FROM merchant_payment_events e WHERE e.reference=p.reference AND e.kind='LIVE_MODE_CONFIRMED')) live_evidenced,p.settlement_status,p.paid_at occurred_at,COALESCE((SELECT sum(e.amount_kobo) FROM merchant_payment_events e WHERE e.reference=p.reference AND e.kind='REFUND'),0) refunded_kobo,
 COALESCE((SELECT sum(-e.fee_delta_kobo) FROM merchant_payment_events e WHERE e.reference=p.reference AND e.kind='FEE_ADJUSTMENT'),0) reversed_fee_kobo,
 CASE WHEN (p.mode='live' OR EXISTS(SELECT 1 FROM merchant_payment_events e WHERE e.reference=p.reference AND e.kind='LIVE_MODE_CONFIRMED')) AND (p.split_evidenced OR EXISTS(SELECT 1 FROM merchant_payment_events e WHERE e.reference=p.reference AND e.kind='SPLIT_CONFIRMED')) AND (p.applied_to_invoice OR EXISTS(SELECT 1 FROM merchant_payment_events e WHERE e.reference=p.reference AND e.kind='RECONCILED')) AND NOT EXISTS(SELECT 1 FROM merchant_payment_events e WHERE e.reference=p.reference AND e.kind IN('REFUND','DISPUTE') AND NOT EXISTS(SELECT 1 FROM merchant_payment_events z WHERE z.reference=e.reference AND z.kind='RECONCILED' AND z.created_at>=e.created_at)) THEN p.gross_fee_kobo+COALESCE((SELECT sum(e.fee_delta_kobo) FROM merchant_payment_events e WHERE e.reference=p.reference AND e.kind='FEE_ADJUSTMENT'),0) ELSE NULL END earned_fee_kobo
 FROM merchant_payments p JOIN organizations o ON o.id=p.organization_id WHERE COALESCE(o.slug,'')<>'demo' AND COALESCE(to_jsonb(o)->>'is_demo','false')<>'true'
 UNION ALL SELECT a.reference,a.organization_id,a.invoice_id,'paystack','INVOICE','unknown',CASE WHEN a.state='FAILED' THEN 'FAILED' WHEN a.state='REVIEW' THEN 'REVIEW' ELSE 'PENDING' END,a.principal_kobo,a.fee_kobo,a.principal_kobo+a.fee_kobo,NULL,false,'UNCONFIRMED',a.created_at,0,0,NULL FROM merchant_payment_attempts a JOIN organizations o ON o.id=a.organization_id WHERE COALESCE(o.slug,'')<>'demo' AND COALESCE(to_jsonb(o)->>'is_demo','false')<>'true' AND a.state<>'SUCCESS' AND NOT EXISTS(SELECT 1 FROM merchant_payments p WHERE p.reference=a.reference)
),selected AS(SELECT * FROM records WHERE occurred_at>=$1 AND occurred_at<$2 AND ($3::uuid IS NULL OR organization_id=$3) AND($4::text='' OR status=$4) AND($5::text='' OR source=$5) AND($6::text='' OR provider=$6))`;
async function read(
  period: Period,
  f: PaymentFilters,
  organizationId: string | null,
) {
  if (
    !(await query("SELECT to_regclass('public.merchant_payments') present"))[0]
      ?.present
  )
    return { installed: false, rows: [], businesses: [], sources: [] };
  const params = [
    period.start,
    period.end,
    organizationId || f.business || null,
    f.status || "",
    f.source || "",
    f.provider || "",
  ];
  const [rows, businesses, sources] = await Promise.all([
    query(
      `${BASE} SELECT * FROM selected ORDER BY occurred_at DESC,reference LIMIT 100`,
      params,
    ),
    query(
      `${BASE} SELECT organization_id,count(*) FILTER(WHERE status NOT IN('PENDING','FAILED') AND live_evidenced) transactions,COALESCE(sum(principal_kobo) FILTER(WHERE status NOT IN('PENDING','FAILED') AND live_evidenced),0) gpv,COALESCE(sum(earned_fee_kobo),0) earned FROM selected GROUP BY organization_id ORDER BY gpv DESC LIMIT 100`,
      params,
    ),
    query(
      `${BASE} SELECT source,count(*) transactions,COALESCE(sum(earned_fee_kobo),0) earned FROM selected GROUP BY source ORDER BY source`,
      params,
    ),
  ]);
  return { installed: true, rows, businesses, sources };
}
export async function companyPaymentReport(
  period: Period,
  filters: PaymentFilters,
) {
  await requireAdminCapability("view_company_finance");
  const report = await read(period, checkedPaymentFilters(filters), null);
  const businessOptions = report.installed
    ? await query(
        "SELECT o.id,COALESCE(NULLIF(b.display_name,''),o.name,o.slug) name FROM organizations o LEFT JOIN business_profiles b ON b.organization_id=o.id WHERE o.slug<>'demo' ORDER BY name LIMIT 500",
      )
    : [];
  return { ...report, businessOptions };
}
export async function businessPaymentReport(
  from?: string,
  to?: string,
  status?: string,
) {
  const s = await invoiceAccess();
  return read(
    reportPeriod(from, to),
    checkedPaymentFilters({ status }),
    s.organizationId,
  );
}
