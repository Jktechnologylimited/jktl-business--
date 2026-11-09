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
