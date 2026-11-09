/** All queries return aggregate JSON only. Parameters: period start/end, previous start, snapshot time. */
const ELIGIBLE = `SELECT c.organization_id,c.stage,o.created_at,COALESCE(NULLIF(bp.country_code,''),'UNKNOWN') country FROM lifecycle_current c JOIN organizations o ON o.id=c.organization_id LEFT JOIN business_profiles bp ON bp.organization_id=o.id WHERE o.created_at<$4::timestamptz`;
export { RECEIPTS_CTE } from "./receipt-sql";
import { RECEIPTS_CTE } from "./receipt-sql";
import {
  executiveSql,
  merchantSql,
  profitabilitySql,
  funnelSql,
  subscriptionLifecycleSql,
  campaignSql,
  retentionSql,
  channelSql,
} from "@/lib/company-finance/queries";
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
const partners = `SELECT jsonb_build_object('programmes',COALESCE((SELECT jsonb_agg(s ORDER BY programme,status) FROM(SELECT programme,status,count(*) count FROM affiliates WHERE created_at<$4 GROUP BY programme,status)s),'[]'),'available',COALESCE((SELECT sum(amount_kobo) FROM distribution_ledger WHERE currency='NGN' AND status IN('AVAILABLE','RESERVED')),0),'held',COALESCE((SELECT sum(amount_kobo) FROM distribution_ledger WHERE currency='NGN' AND status IN('PENDING','UNDER_REVIEW')),0),'reversed',COALESCE((SELECT sum(amount_kobo) FROM distribution_ledger WHERE currency='NGN' AND status='REVERSED'),0),'paidLedger',COALESCE((SELECT sum(amount_kobo) FROM distribution_ledger WHERE currency='NGN' AND status='PAID'),0),'paidOut',COALESCE((SELECT sum(amount_kobo) FROM distribution_payouts WHERE currency='NGN' AND status='PAID' AND confirmed_at>=$1 AND confirmed_at<LEAST($2::timestamptz,$4::timestamptz)),0)) data`;
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
const activation = `WITH eligible AS(${ELIGIBLE}), events AS(
 SELECT m.* FROM activation_milestones m JOIN eligible e USING(organization_id)
 WHERE m.occurred_at>=$1 AND m.occurred_at<LEAST($2::timestamptz,$4::timestamptz)
) SELECT jsonb_build_object(
 'trackingSince',(SELECT installed_at FROM activation_tracking WHERE id=true),
 'registered',count(*) FILTER(WHERE milestone='registered'),
 'selected',count(*) FILTER(WHERE milestone='template_selected'),
 'published',count(*) FILTER(WHERE milestone='website_published'),
 'paid',count(*) FILTER(WHERE milestone='website_paid')
) data FROM events`;
const acquisition = `${RECEIPTS_CTE}, eligible AS(${ELIGIBLE}), customer_receipts AS(
 SELECT organization_id,sum(amount_kobo) gross,sum(retained) retained FROM receipts
 WHERE paid_at>=$1 AND paid_at<LEAST($2::timestamptz,$4::timestamptz) GROUP BY organization_id
), sources AS(
 SELECT a.id,a.name source,a.programme,count(e.organization_id) registered,
 count(e.organization_id) FILTER(WHERE e.stage IN('FREE_DOMAIN','CONNECT_DOMAIN','COMPLETE')) published,
 count(e.organization_id) FILTER(WHERE r.retained>0) paying,
 COALESCE(sum(r.gross),0) gross,COALESCE(sum(r.retained),0) retained
 FROM affiliates a LEFT JOIN affiliate_referrals f ON f.affiliate_id=a.id
 LEFT JOIN eligible e ON e.organization_id=f.organization_id
 LEFT JOIN customer_receipts r ON r.organization_id=e.organization_id
 WHERE a.created_at<$4 GROUP BY a.id,a.name,a.programme
) SELECT jsonb_build_object('sources',COALESCE((SELECT jsonb_agg(to_jsonb(s)-'id' ORDER BY retained DESC,source,id) FROM sources s),'[]')) data`;
const receivables = `WITH open_invoices AS(
 SELECT GREATEST(0,i.amount_kobo-i.paid_kobo) balance,i.due_on,i.payment_review
 FROM custom_invoices i JOIN lifecycle_current c USING(organization_id)
 WHERE i.status='OPEN' AND i.currency='NGN' AND i.issued_at IS NOT NULL AND i.issued_at<$4
) SELECT jsonb_build_object(
 'outstanding',COALESCE(sum(balance),0),'invoices',count(*) FILTER(WHERE balance>0),
 'overdue',COALESCE(sum(balance) FILTER(WHERE due_on<($4::timestamptz AT TIME ZONE 'Africa/Lagos')::date),0),
 'underReview',COALESCE(sum(balance) FILTER(WHERE payment_review),0)
) data FROM open_invoices`;
export const COMPANY_RECURRING_CTE = `${RECEIPTS_CTE}, website_latest AS(
 SELECT DISTINCT ON(organization_id) * FROM receipts WHERE product='Website plans' ORDER BY organization_id,paid_at DESC,reference
), website_recurring AS(
 SELECT 'website:'||s.organization_id::text service_key,s.organization_id,'Website plans' product,round(p.amount_kobo::numeric/CASE WHEN s.interval='yearly' THEN 12 ELSE 1 END)::bigint mrr
 FROM website_plan_subscriptions s JOIN website_latest p USING(organization_id) JOIN lifecycle_current c USING(organization_id)
 WHERE s.status='active' AND s.period_end>$4 AND p.paid_period_end>$4 AND p.retained=p.amount_kobo AND s.plan_id=p.plan_id AND s.interval=p.billing_interval
), legacy_recurring AS(
 SELECT 'legacy:'||i.organization_id::text service_key,i.organization_id,'Legacy hosting' product,round(p.amount_kobo::numeric/p.months)::bigint mrr
 FROM infrastructure_accounts i JOIN lifecycle_current c USING(organization_id) JOIN LATERAL(SELECT * FROM growth_legacy_payments p WHERE p.organization_id=i.organization_id ORDER BY paid_at DESC,reference LIMIT 1)p ON true
 WHERE i.subscription_status='active' AND i.renewal_date>=($4::timestamptz AT TIME ZONE 'Africa/Lagos')::date AND p.period_end>$4 AND p.amount_kobo=i.price_kobo_per_cycle AND NOT EXISTS(SELECT 1 FROM website_recurring w WHERE w.organization_id=i.organization_id)
 AND NOT EXISTS(SELECT 1 FROM distribution_payment_risks z WHERE z.reference=p.reference AND NOT EXISTS(SELECT 1 FROM distribution_risk_state r WHERE r.reference=z.reference AND r.state='CLEARED'))
), email_latest AS(
 SELECT DISTINCT ON(service_id) * FROM email_orders WHERE paid_at IS NOT NULL AND provider_transaction IS NOT NULL ORDER BY service_id,paid_at DESC,id
), email_recurring AS(
 SELECT 'email:'||e.id::text service_key,e.organization_id,'Business email' product,round(p.amount_kobo::numeric/p.period_months)::bigint mrr
 FROM email_services e JOIN lifecycle_current c USING(organization_id) JOIN email_latest p ON p.service_id=e.id AND p.organization_id=e.organization_id
 JOIN receipts r ON r.reference=p.reference AND r.organization_id=e.organization_id AND r.product='Business email'
 WHERE e.status='ACTIVE' AND e.license_type='PAID' AND e.renews_at>$4 AND p.period_months BETWEEN 1 AND 36 AND e.period_months=p.period_months AND e.period_price_kobo=p.amount_kobo AND e.plan_id=p.plan_id AND p.consent_at IS NOT NULL AND r.retained=r.amount_kobo
), custom_recurring AS(
 SELECT 'custom:'||s.id::text service_key,s.organization_id,'Custom recurring services' product,round((s.amount_kobo-s.discount_kobo)::numeric/CASE WHEN s.interval='ANNUAL' THEN 12 ELSE 1 END)::bigint mrr
 FROM custom_services s JOIN lifecycle_current c USING(organization_id)
 WHERE s.status='ACTIVE' AND s.accepted_at IS NOT NULL AND s.accepted_by IS NOT NULL AND s.interval IN('MONTHLY','ANNUAL') AND s.starts_on<=($4::timestamptz AT TIME ZONE 'Africa/Lagos')::date
 AND NOT (s.category='HOSTING' AND (EXISTS(SELECT 1 FROM website_recurring w WHERE w.organization_id=s.organization_id) OR EXISTS(SELECT 1 FROM legacy_recurring l WHERE l.organization_id=s.organization_id)))
 AND NOT (s.category='EMAIL' AND EXISTS(SELECT 1 FROM email_recurring e WHERE e.organization_id=s.organization_id))
 AND EXISTS(SELECT 1 FROM custom_invoices i WHERE i.service_id=s.id AND i.organization_id=s.organization_id AND i.status='PAID' AND i.currency='NGN' AND i.amount_kobo=s.amount_kobo-s.discount_kobo AND i.paid_at<$4 AND i.due_on<=($4::timestamptz AT TIME ZONE 'Africa/Lagos')::date AND i.due_on+CASE WHEN s.interval='ANNUAL' THEN interval '1 year' ELSE interval '1 month' END>$4
 AND (SELECT COALESCE(sum(r.retained),0) FROM receipts r WHERE r.organization_id=s.organization_id AND r.product='Custom projects' AND (r.reference=i.reference OR EXISTS(SELECT 1 FROM custom_invoice_payments p WHERE p.invoice_id=i.id AND p.reference=r.reference)))>=i.amount_kobo)
), recurring_items AS(SELECT * FROM website_recurring UNION ALL SELECT * FROM email_recurring UNION ALL SELECT * FROM custom_recurring UNION ALL SELECT * FROM legacy_recurring)
`;
const allReceipts = `${RECEIPTS_CTE}, all_receipts AS(
 SELECT reference,provider,organization_id,amount_kobo,paid_at,risk FROM receipts
 UNION ALL SELECT p.reference,p.provider_transaction,p.organization_id,p.amount_kobo,p.paid_at,CASE WHEN EXISTS(SELECT 1 FROM distribution_payment_risks z WHERE z.reference=p.reference AND NOT EXISTS(SELECT 1 FROM distribution_risk_state s WHERE s.reference=z.reference AND s.state='CLEARED')) THEN p.amount_kobo ELSE 0 END
 FROM growth_legacy_payments p JOIN lifecycle_current c USING(organization_id) WHERE p.paid_at<$4 AND NOT EXISTS(SELECT 1 FROM receipts r WHERE r.reference=p.reference OR r.provider=p.provider_transaction)
)`;
const collections = `${allReceipts} SELECT jsonb_build_object('gross',COALESCE(sum(amount_kobo),0),'transactions',count(*),'risk',COALESCE(sum(risk),0),'legacyGross',COALESCE(sum(amount_kobo) FILTER(WHERE EXISTS(SELECT 1 FROM growth_legacy_payments p WHERE p.reference=all_receipts.reference)),0)) data FROM all_receipts WHERE paid_at>=$1 AND paid_at<LEAST($2::timestamptz,$4::timestamptz)`;
const companyRecurring = `${COMPANY_RECURRING_CTE} SELECT jsonb_build_object('mrr',COALESCE(sum(mrr),0),'arr',COALESCE(sum(mrr),0)*12,'services',count(*),'products',COALESCE((SELECT jsonb_agg(t ORDER BY product) FROM(SELECT product,sum(mrr) mrr,count(*) services FROM recurring_items GROUP BY product)t),'[]'),'legacyHostingExcluded',(SELECT count(*) FROM infrastructure_accounts i JOIN lifecycle_current c USING(organization_id) WHERE subscription_status='active' AND renewal_date>=($4::timestamptz AT TIME ZONE 'Africa/Lagos')::date AND NOT EXISTS(SELECT 1 FROM legacy_recurring l WHERE l.organization_id=i.organization_id) AND NOT EXISTS(SELECT 1 FROM website_recurring w WHERE w.organization_id=i.organization_id)),'customCandidatesExcluded',(SELECT count(*) FROM custom_services s JOIN lifecycle_current c USING(organization_id) WHERE s.status='ACTIVE' AND s.interval IN('MONTHLY','ANNUAL') AND NOT EXISTS(SELECT 1 FROM custom_recurring r WHERE r.service_key='custom:'||s.id::text))) data FROM recurring_items`;
const conversion = `WITH visitors AS(SELECT v.* FROM growth_visits v WHERE v.created_at>=$1 AND v.created_at<LEAST($2::timestamptz,$4::timestamptz)), flags AS(
 SELECT v.*,EXISTS(SELECT 1 FROM activation_milestones m WHERE m.organization_id=v.organization_id AND m.milestone='template_selected' AND m.occurred_at>v.created_at AND m.occurred_at<$4) selected,
 EXISTS(SELECT 1 FROM activation_milestones m WHERE m.organization_id=v.organization_id AND m.milestone='website_published' AND m.occurred_at>v.created_at AND m.occurred_at<$4) published,
 EXISTS(SELECT 1 FROM activation_milestones m WHERE m.organization_id=v.organization_id AND m.milestone='website_paid' AND m.occurred_at>v.created_at AND m.occurred_at<$4) paid FROM visitors v
) SELECT jsonb_build_object('visitors',count(*),'registered',count(*) FILTER(WHERE organization_id IS NOT NULL),'selected',count(*) FILTER(WHERE organization_id IS NOT NULL AND selected),'published',count(*) FILTER(WHERE organization_id IS NOT NULL AND selected AND published),'paid',count(*) FILTER(WHERE organization_id IS NOT NULL AND selected AND published AND paid),'coverage','Consenting browsers first seen in the selected period; 30-day retention. Milestones observed by report time. Not all visitors, people or lifetime conversions.') data FROM flags`;
const acquisitionCosts = `${allReceipts}, first_paid AS(SELECT organization_id,min(paid_at) first_at FROM all_receipts WHERE amount_kobo>risk AND NOT EXISTS(SELECT 1 FROM receipts r WHERE r.reference=all_receipts.reference AND r.retained=0) GROUP BY organization_id), customers AS(SELECT f.organization_id,a.affiliate_id FROM first_paid f JOIN lifecycle_current c USING(organization_id) JOIN affiliate_referrals a USING(organization_id) WHERE f.first_at>=$1 AND f.first_at<LEAST($2::timestamptz,$4::timestamptz)), costs AS(SELECT affiliate_id,sum(amount_kobo) spend FROM growth_acquisition_costs WHERE voided_at IS NULL AND spent_on>=($1::timestamptz AT TIME ZONE 'Africa/Lagos')::date AND spent_on<($2::timestamptz AT TIME ZONE 'Africa/Lagos')::date GROUP BY affiliate_id) SELECT jsonb_build_object('sources',COALESCE((SELECT jsonb_agg(t ORDER BY source) FROM(SELECT a.name source,COALESCE(c.spend,0) spend,(SELECT count(*) FROM customers x WHERE x.affiliate_id=a.id) "newPaying",CASE WHEN c.spend>0 AND EXISTS(SELECT 1 FROM customers x WHERE x.affiliate_id=a.id) THEN round(c.spend::numeric/(SELECT count(*) FROM customers x WHERE x.affiliate_id=a.id)) ELSE NULL END cac FROM affiliates a LEFT JOIN costs c ON c.affiliate_id=a.id)t),'[]'),'unallocatedSpend',COALESCE((SELECT spend FROM costs WHERE affiliate_id IS NULL),0)) data`;
const movements = `WITH ranked AS(SELECT *,lag(items) OVER(ORDER BY day) previous_items,lag(day) OVER(ORDER BY day) previous_day FROM growth_recurring_snapshots WHERE day<=($4::timestamptz AT TIME ZONE 'Africa/Lagos')::date), pairs AS(SELECT * FROM ranked WHERE day>=($1::timestamptz AT TIME ZONE 'Africa/Lagos')::date AND day<($2::timestamptz AT TIME ZONE 'Africa/Lagos')::date AND previous_day=day-1), deltas AS(SELECT p.day,b.service_key key,COALESCE(b.new_mrr,0) current_mrr,COALESCE(b.old_mrr,0) previous_mrr FROM pairs p CROSS JOIN LATERAL(SELECT COALESCE(n.service_key,o.service_key) service_key,n.mrr new_mrr,o.mrr old_mrr FROM jsonb_to_recordset(p.items) AS n(service_key text,mrr bigint) FULL JOIN jsonb_to_recordset(p.previous_items) AS o(service_key text,mrr bigint) USING(service_key)) b) SELECT jsonb_build_object('daysCompared',(SELECT count(*) FROM pairs),'churnedMrr',COALESCE(sum(previous_mrr) FILTER(WHERE current_mrr=0),0),'newMrr',COALESCE(sum(current_mrr) FILTER(WHERE previous_mrr=0),0),'expansionMrr',COALESCE(sum(current_mrr-previous_mrr) FILTER(WHERE previous_mrr>0 AND current_mrr>previous_mrr),0),'contractionMrr',COALESCE(sum(previous_mrr-current_mrr) FILTER(WHERE current_mrr>0 AND current_mrr<previous_mrr),0),'series',COALESCE((SELECT jsonb_agg(t ORDER BY day) FROM(SELECT day,sum(current_mrr-previous_mrr) net FROM deltas GROUP BY day)t),'[]')) data FROM deltas`;

export const SOURCES = {
  executiveInventory: {
    sql: executiveSql,
    tables: [
      "organizations",
      "lifecycle_current",
      "business_profiles",
      "business_websites",
      "custom_projects",
      "website_plan_subscriptions",
      "growth_recurring_snapshots",
    ],
  },
  retention: { sql: retentionSql, tables: ["growth_recurring_snapshots"] },
  channelFinancials: {
    sql: channelSql,
    tables: [
      "merchant_payments",
      "merchant_payment_events",
      "organizations",
      "affiliates",
      "affiliate_referrals",
      "growth_recurring_snapshots",
    ],
  },
  extendedFunnel: {
    sql: funnelSql,
    tables: [
      "growth_funnel_events",
      "growth_visits",
      "company_finance_settings",
      "growth_activity_days",
    ],
  },
  subscriptionLifecycle: {
    sql: subscriptionLifecycleSql,
    tables: [
      ...RECEIPT_TABLES,
      "website_plan_subscriptions",
      "growth_subscription_events",
    ],
  },
  campaigns: {
    sql: campaignSql,
    tables: [
      ...RECEIPT_TABLES,
      "growth_campaigns",
      "growth_visits",
      "merchant_payments",
      "merchant_payment_events",
    ],
  },
  merchantTransactions: {
    sql: merchantSql,
    tables: [
      "merchant_payments",
      "merchant_payment_events",
      "merchant_payment_attempts",
      "organizations",
    ],
  },
  profitability: {
    sql: profitabilitySql,
    tables: [
      ...RECEIPT_TABLES,
      "merchant_payments",
      "merchant_payment_events",
      "company_cost_entries",
      "company_cost_categories",
      "company_finance_periods",
      "growth_acquisition_costs",
      "distribution_product_costs",
      "distribution_payouts",
      "growth_legacy_payments",
    ],
  },
  collections: {
    sql: collections,
    tables: [...RECEIPT_TABLES, "growth_legacy_payments"],
  },
  companyRecurring: {
    sql: companyRecurring,
    tables: [
      ...RECEIPT_TABLES,
      "website_plan_subscriptions",
      "email_services",
      "custom_services",
      "infrastructure_accounts",
      "growth_legacy_payments",
    ],
  },
  conversion: {
    sql: conversion,
    tables: ["growth_visits", "activation_milestones"],
  },
  acquisitionCosts: {
    sql: acquisitionCosts,
    tables: [
      ...RECEIPT_TABLES,
      "affiliates",
      "affiliate_referrals",
      "growth_acquisition_costs",
      "growth_legacy_payments",
    ],
  },
  movements: { sql: movements, tables: ["growth_recurring_snapshots"] },
  activation: {
    sql: activation,
    tables: [
      "activation_tracking",
      "activation_milestones",
      "lifecycle_current",
      "organizations",
      "business_profiles",
    ],
  },
  acquisition: {
    sql: acquisition,
    tables: [
      ...RECEIPT_TABLES,
      "affiliates",
      "affiliate_referrals",
      "business_profiles",
    ],
  },
  receivables: {
    sql: receivables,
    tables: ["custom_invoices", "lifecycle_current"],
  },
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
