/** All queries return aggregate JSON only. Parameters: period start/end, previous start, snapshot time. */
const ELIGIBLE = `SELECT c.organization_id,c.stage,o.created_at,COALESCE(NULLIF(bp.country_code,''),'UNKNOWN') country FROM lifecycle_current c JOIN organizations o ON o.id=c.organization_id LEFT JOIN business_profiles bp ON bp.organization_id=o.id WHERE o.created_at<$4::timestamptz`;
export const RECEIPTS_CTE = `
WITH raw AS(
 SELECT 1 priority,'Website plans' product,p.reference,p.provider_transaction_id provider,p.organization_id,p.amount_kobo,p.currency,p.paid_at,CASE WHEN r.status='refunded' THEN p.amount_kobo ELSE 0 END::bigint refunded,p.plan_id,p.interval billing_interval,p.period_end paid_period_end FROM website_plan_payments p LEFT JOIN website_plan_refund_requests r ON r.payment_reference=p.reference
 UNION ALL SELECT 2,'Domains',p.reference,p.provider_transaction,o.organization_id,p.amount_kobo,o.currency,p.paid_at,LEAST(p.amount_kobo,o.refunded_kobo),NULL::text,NULL::text,NULL::timestamptz FROM domain_payments p JOIN domain_orders o USING(reference)
 UNION ALL SELECT 3,'Business email',reference,provider_transaction,organization_id,amount_kobo,'NGN',paid_at,0,NULL::text,NULL::text,NULL::timestamptz FROM email_orders WHERE paid_at IS NOT NULL AND provider_transaction IS NOT NULL
 UNION ALL SELECT 4,'Custom projects',p.reference,p.provider_transaction,i.organization_id,p.amount_kobo,p.currency,p.verified_at,LEAST(p.amount_kobo,p.refunded_kobo),NULL::text,NULL::text,NULL::timestamptz FROM custom_invoice_payments p JOIN custom_invoices i ON i.id=p.invoice_id WHERE p.state='success' AND p.verified_at IS NOT NULL
 UNION ALL SELECT 5,'Custom projects',i.reference,i.provider_transaction,i.organization_id,i.amount_kobo,i.currency,i.paid_at,0,NULL::text,NULL::text,NULL::timestamptz FROM custom_invoices i WHERE i.version=1 AND i.status='PAID' AND i.paid_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM custom_invoice_payments p WHERE p.invoice_id=i.id AND p.state='success')
), valid AS(SELECT r.* FROM raw r JOIN organizations o ON o.id=r.organization_id WHERE r.paid_at<$4::timestamptz AND r.paid_at IS NOT NULL AND r.amount_kobo>0 AND COALESCE(r.reference,'')<>'' AND COALESCE(r.provider,'')<>'' AND r.currency='NGN' AND COALESCE(o.slug,'')<>'demo' AND COALESCE(to_jsonb(o)->>'is_demo','false')<>'true'),
 provider_dedup AS(SELECT DISTINCT ON(provider) * FROM valid ORDER BY provider,priority,paid_at,reference),
 dedup AS(SELECT DISTINCT ON(reference) * FROM provider_dedup ORDER BY reference,priority,paid_at),
 evidenced AS(SELECT d.*,CASE WHEN EXISTS(SELECT 1 FROM distribution_payment_risks z WHERE z.reference=d.reference) AND NOT EXISTS(SELECT 1 FROM distribution_risk_state s WHERE s.reference=d.reference AND s.state='CLEARED') THEN GREATEST(0,d.amount_kobo-d.refunded) ELSE 0 END::bigint risk FROM dedup d),
 receipts AS(SELECT *,GREATEST(0,amount_kobo-refunded-risk)::bigint retained FROM evidenced)
`;
const receipts = `${RECEIPTS_CTE}
SELECT jsonb_build_object(
 'gross',COALESCE((SELECT sum(amount_kobo) FROM receipts WHERE paid_at>=$1 AND paid_at<LEAST($2::timestamptz,$4::timestamptz)),0),
 'refunds',COALESCE((SELECT sum(refunded) FROM receipts WHERE paid_at>=$1 AND paid_at<LEAST($2::timestamptz,$4::timestamptz)),0),
 'risk',COALESCE((SELECT sum(risk) FROM receipts WHERE paid_at>=$1 AND paid_at<LEAST($2::timestamptz,$4::timestamptz)),0),
 'retained',COALESCE((SELECT sum(retained) FROM receipts WHERE paid_at>=$1 AND paid_at<LEAST($2::timestamptz,$4::timestamptz)),0),
 'transactions',(SELECT count(*) FROM receipts WHERE paid_at>=$1 AND paid_at<LEAST($2::timestamptz,$4::timestamptz)),
 'previousGross',COALESCE((SELECT sum(amount_kobo) FROM receipts WHERE paid_at>=$3 AND paid_at<$1),0),
 'payingBusinesses',(SELECT count(DISTINCT r.organization_id) FROM receipts r JOIN lifecycle_current c ON c.organization_id=r.organization_id WHERE r.retained>0),
 'duplicates',(SELECT count(*) FROM valid)-(SELECT count(*) FROM dedup),
 'invalid',(SELECT count(*) FROM raw WHERE paid_at<$4 AND (amount_kobo<=0 OR COALESCE(reference,'')='' OR COALESCE(provider,'')='')),
 'unsupported',(SELECT count(*) FROM raw WHERE paid_at<$4 AND currency<>'NGN'),
 'series',COALESCE((SELECT jsonb_agg(s ORDER BY month) FROM(SELECT to_char(paid_at AT TIME ZONE 'Africa/Lagos','YYYY-MM') AS month,sum(amount_kobo) gross,sum(refunded) refunds,sum(risk) risk,sum(retained) retained,count(*) transactions FROM receipts WHERE paid_at>=$1 AND paid_at<LEAST($2::timestamptz,$4::timestamptz) GROUP BY 1)s),'[]'),
 'products',COALESCE((SELECT jsonb_agg(s ORDER BY product) FROM(SELECT product,sum(amount_kobo) gross,sum(refunded) refunds,sum(risk) risk,sum(retained) retained,count(*) transactions FROM receipts WHERE paid_at>=$1 AND paid_at<LEAST($2::timestamptz,$4::timestamptz) GROUP BY product)s),'[]')
) data`;
const accounts = `WITH eligible AS(${ELIGIBLE}) SELECT jsonb_build_object(
 'total',count(*),'published',count(*) FILTER(WHERE stage IN('FREE_DOMAIN','CONNECT_DOMAIN','COMPLETE')),'started',count(*) FILTER(WHERE stage IN('DRAFT','FREE_DOMAIN','CONNECT_DOMAIN','COMPLETE')),'drafts',count(*) FILTER(WHERE stage='DRAFT'),'notStarted',count(*) FILTER(WHERE stage='NO_SITE'),'custom',count(*) FILTER(WHERE stage='MANAGED'),'customDomains',count(*) FILTER(WHERE stage='COMPLETE'),
 'newPeriod',count(*) FILTER(WHERE created_at>=$1 AND created_at<$2),'previousPeriod',count(*) FILTER(WHERE created_at>=$3 AND created_at<$1),
 'stages',COALESCE((SELECT jsonb_agg(s ORDER BY stage) FROM(SELECT stage,count(*) count FROM eligible GROUP BY stage)s),'[]'),
 'countries',COALESCE((SELECT jsonb_agg(s ORDER BY count DESC,code) FROM(SELECT country code,count(*) count FROM eligible GROUP BY country)s),'[]'),
 'series',COALESCE((SELECT jsonb_agg(s ORDER BY month) FROM(SELECT to_char(created_at AT TIME ZONE 'Africa/Lagos','YYYY-MM') AS month,count(*) count FROM eligible WHERE created_at>=$1 AND created_at<$2 GROUP BY 1)s),'[]')
) data FROM eligible`;
const subscriptions = `${RECEIPTS_CTE}, latest AS(SELECT DISTINCT ON(organization_id) * FROM receipts WHERE product='Website plans' ORDER BY organization_id,paid_at DESC,reference), active AS(SELECT s.*,p.amount_kobo,p.plan_id payment_plan,p.billing_interval payment_interval,p.retained payment_retained,p.paid_period_end FROM website_plan_subscriptions s LEFT JOIN latest p USING(organization_id) WHERE s.status='active' AND s.period_end>$4::timestamptz), verified AS(SELECT * FROM active WHERE amount_kobo IS NOT NULL AND payment_retained=amount_kobo AND paid_period_end>$4::timestamptz AND plan_id=payment_plan AND interval=payment_interval), normalized AS(SELECT COALESCE(round(sum(amount_kobo::numeric/CASE WHEN interval='yearly' THEN 12 ELSE 1 END)),0)::bigint mrr FROM verified)
SELECT jsonb_build_object('mrr',(SELECT mrr FROM normalized),'arr',(SELECT mrr*12 FROM normalized),'verified',(SELECT count(*) FROM verified),'active',(SELECT count(*) FROM active),'unverified',(SELECT count(*) FROM active)-(SELECT count(*) FROM verified),'plans',COALESCE((SELECT jsonb_agg(s ORDER BY plan) FROM(SELECT plan_id plan,count(*) count FROM verified GROUP BY plan_id)s),'[]')) data`;
const activity = `WITH e AS(SELECT e.* FROM website_metric_events e JOIN lifecycle_current c USING(organization_id) WHERE e.created_at>=$1 AND e.created_at<LEAST($2::timestamptz,$4::timestamptz)) SELECT jsonb_build_object('views',count(*) FILTER(WHERE event_type='view'),'cta',count(*) FILTER(WHERE event_type='cta'),'contacts',count(*) FILTER(WHERE event_type='contact'),'bookings',count(*) FILTER(WHERE event_type='booking'),'sites',count(DISTINCT organization_id),'recentSavers',(SELECT count(*) FROM tycoon_saves WHERE updated_at>=$1 AND updated_at<LEAST($2::timestamptz,$4::timestamptz)),'series',COALESCE((SELECT jsonb_agg(s ORDER BY month) FROM(SELECT to_char(created_at AT TIME ZONE 'Africa/Lagos','YYYY-MM') AS month,count(*) views FROM e WHERE event_type='view' GROUP BY 1)s),'[]')) data FROM e`;
const partners = `SELECT jsonb_build_object('programmes',COALESCE((SELECT jsonb_agg(s ORDER BY programme,status) FROM(SELECT programme,status,count(*) count FROM affiliates WHERE created_at<$4 GROUP BY programme,status)s),'[]'),'available',COALESCE((SELECT sum(amount_kobo) FROM distribution_ledger WHERE currency='NGN' AND status IN('AVAILABLE','RESERVED')),0),'held',COALESCE((SELECT sum(amount_kobo) FROM distribution_ledger WHERE currency='NGN' AND status IN('PENDING','UNDER_REVIEW')),0),'paidOut',COALESCE((SELECT sum(amount_kobo) FROM distribution_payouts WHERE currency='NGN' AND status='PAID' AND confirmed_at>=$1 AND confirmed_at<LEAST($2::timestamptz,$4::timestamptz)),0)) data`;
const portfolio = `SELECT jsonb_build_object('customProjects',(SELECT count(*) FROM custom_projects p JOIN lifecycle_current c USING(organization_id)),'activeCustomProjects',(SELECT count(*) FROM custom_projects p JOIN lifecycle_current c USING(organization_id) WHERE p.status='LIVE'),'domains',(SELECT count(*) FROM domain_assets d JOIN lifecycle_current c USING(organization_id) WHERE d.expires_at>$4),'emailServices',(SELECT count(*) FROM email_services e JOIN lifecycle_current c USING(organization_id) WHERE e.status='ACTIVE' AND e.renews_at>$4),'openSupport',(SELECT count(*) FROM support_cases s JOIN lifecycle_current c USING(organization_id) WHERE s.status<>'RESOLVED'),'newSupport',(SELECT count(*) FROM support_cases s JOIN lifecycle_current c USING(organization_id) WHERE s.created_at>=$1 AND s.created_at<LEAST($2::timestamptz,$4::timestamptz)),'renewalsDue',(SELECT count(*) FROM renewal_items i JOIN lifecycle_current c USING(organization_id) WHERE i.due_on BETWEEN ($4::timestamptz AT TIME ZONE 'Africa/Lagos')::date AND ($4::timestamptz AT TIME ZONE 'Africa/Lagos')::date+30),'renewalsOverdue',(SELECT count(*) FROM renewal_items i JOIN lifecycle_current c USING(organization_id) WHERE i.due_on<($4::timestamptz AT TIME ZONE 'Africa/Lagos')::date),'missingRenewalDates',(SELECT count(*) FROM renewal_items i JOIN lifecycle_current c USING(organization_id) WHERE i.due_on IS NULL),'prospectInventory',(SELECT count(*) FROM organizations o WHERE o.is_prospect=true AND NOT EXISTS(SELECT 1 FROM lifecycle_current c WHERE c.organization_id=o.id))) data`;
const RECEIPT_TABLES = [
  "organizations",
  "lifecycle_current",
  "website_plan_payments",
  "website_plan_refund_requests",
  "domain_payments",
  "domain_orders",
  "email_orders",
  "custom_invoice_payments",
  "custom_invoices",
  "distribution_payment_risks",
  "distribution_risk_state",
];
export const SOURCES = {
  accounts: {
    sql: accounts,
    tables: ["lifecycle_current", "organizations", "business_profiles"],
  },
  receipts: { sql: receipts, tables: RECEIPT_TABLES },
  subscriptions: {
    sql: subscriptions,
    tables: [...RECEIPT_TABLES, "website_plan_subscriptions"],
  },
  activity: {
    sql: activity,
    tables: ["website_metric_events", "lifecycle_current", "tycoon_saves"],
  },
  partners: {
    sql: partners,
    tables: ["affiliates", "distribution_ledger", "distribution_payouts"],
  },
  portfolio: {
    sql: portfolio,
    tables: [
      "custom_projects",
      "lifecycle_current",
      "domain_assets",
      "email_services",
      "support_cases",
      "renewal_items",
      "organizations",
    ],
  },
} as const;

export function preparedSourceSql(sql: string) {
  const bounds =
    "WITH report_bounds AS(SELECT $1::timestamptz start_at,$2::timestamptz end_at,$3::timestamptz previous_at,$4::timestamptz snapshot_at)";
  const query = sql.trim();
  return /^WITH\s/i.test(query)
    ? query.replace(/^WITH\s/i, bounds + ", ")
    : bounds + " " + query;
}
