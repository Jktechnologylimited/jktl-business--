-- Additive renewal monitoring only; no charges, service status or existing due dates change.
CREATE TABLE IF NOT EXISTS renewal_settings(id boolean PRIMARY KEY DEFAULT true CHECK(id),enabled boolean NOT NULL DEFAULT false,last_scan_at timestamptz,last_dispatch_at timestamptz,last_error text,updated_at timestamptz NOT NULL DEFAULT now());
INSERT INTO renewal_settings(id) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS renewal_tracked_services(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,name text NOT NULL,kind text NOT NULL CHECK(kind IN('DOMAIN','HOSTING','BUSINESS_EMAIL','OTHER')),due_on date,amount_kobo bigint CHECK(amount_kobo>=0 AND amount_kobo<=2000000000),recipient text,status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','CANCELLED')),created_by text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS renewal_reminders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),item_key text NOT NULL,organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,due_on date NOT NULL,bucket text NOT NULL,send_day date NOT NULL DEFAULT (now() AT TIME ZONE 'Africa/Lagos')::date,recipient text NOT NULL,state text NOT NULL DEFAULT 'QUEUED' CHECK(state IN('QUEUED','SUBMITTING','ACCEPTED','FAILED','UNKNOWN','CANCELLED')),attempts int NOT NULL DEFAULT 0,payload jsonb,provider_id text,lease_until timestamptz,next_attempt_at timestamptz NOT NULL DEFAULT now(),last_error text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(item_key,due_on,bucket,recipient),UNIQUE(item_key,due_on,send_day,recipient));
CREATE INDEX IF NOT EXISTS renewal_reminder_pending ON renewal_reminders(state,next_attempt_at);
CREATE TABLE IF NOT EXISTS renewal_audit(id bigserial PRIMARY KEY,actor_id text NOT NULL,event text NOT NULL,item_key text,detail jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE domain_outbox ADD COLUMN IF NOT EXISTS renewal_superseded_at timestamptz;
ALTER TABLE email_outbox ADD COLUMN IF NOT EXISTS renewal_superseded_at timestamptz;
ALTER TABLE custom_outbox ADD COLUMN IF NOT EXISTS renewal_superseded_at timestamptz;
CREATE OR REPLACE VIEW renewal_items AS
WITH native AS (
 SELECT 'domain:'||id::text item_key,organization_id,'DOMAIN'::text kind,domain::text name,(expires_at AT TIME ZONE 'Africa/Lagos')::date due_on,NULL::bigint amount_kobo,'/business/domains'::text path,NULL::text recipient FROM domain_assets
 UNION ALL
 SELECT 'website:'||organization_id::text,organization_id,'HOSTING','Website & hosting — '||plan_id,(period_end AT TIME ZONE 'Africa/Lagos')::date,NULL::bigint,'/business',NULL::text FROM website_plan_subscriptions WHERE status IN('active','past_due') AND cancel_at_period_end=false
 UNION ALL
 SELECT 'hosting:'||a.id::text,a.organization_id,'HOSTING',a.plan_name,a.renewal_date,a.price_kobo_per_year,'/business',NULL::text FROM infrastructure_accounts a WHERE a.subscription_status IN('active','past_due') AND NOT EXISTS(SELECT 1 FROM website_plan_subscriptions w WHERE w.organization_id=a.organization_id AND w.status IN('active','past_due'))
 UNION ALL
 SELECT 'email:'||id::text,organization_id,'BUSINESS_EMAIL','Business email — '||domain,(renews_at AT TIME ZONE 'Africa/Lagos')::date,period_price_kobo,'/business/email',NULL::text FROM email_services WHERE license_type='PAID' AND status IN('ACTIVE','SUSPENDED')
 UNION ALL
 SELECT 'custom:'||s.id::text,s.organization_id,CASE s.category WHEN 'EMAIL' THEN 'BUSINESS_EMAIL' WHEN 'HOSTING' THEN 'HOSTING' ELSE 'OTHER' END,s.name,s.next_due_on,s.amount_kobo-s.discount_kobo,'/business/custom/'||s.project_id::text||'/portal',NULL::text FROM custom_services s JOIN custom_projects p ON p.id=s.project_id AND p.organization_id=s.organization_id WHERE s.status='ACTIVE' AND s.accepted_at IS NOT NULL AND s.interval IN('MONTHLY','ANNUAL') AND p.status IN('LIVE','CONFIGURING')
 UNION ALL
 SELECT 'tracked:'||id::text,organization_id,kind,name,due_on,amount_kobo,'/business/renewals',recipient FROM renewal_tracked_services WHERE status='ACTIVE'
)
SELECT n.item_key,n.organization_id,n.kind,n.name,n.due_on,n.amount_kobo,n.path,lower(COALESCE(NULLIF(n.recipient,''),o.email)) AS recipient,COALESCE(b.display_name,'Business account') business_name,
 (n.due_on-(now() AT TIME ZONE 'Africa/Lagos')::date)::int days_left,
 (SELECT max(sent_at) FROM (
 SELECT d.sent_at FROM domain_outbox d WHERE n.item_key LIKE 'domain:%' AND d.organization_id=n.organization_id AND d.domain=n.name AND d.event='Domain renewal reminder'
 UNION ALL SELECT e.sent_at FROM email_outbox e WHERE n.item_key LIKE 'email:%' AND e.organization_id=n.organization_id AND e.event_key LIKE 'renewal:'||split_part(n.item_key,':',2)||':%'
 UNION ALL SELECT c.sent_at FROM custom_outbox c JOIN custom_invoices i ON c.event_key LIKE 'reminder:'||i.id::text||':%' WHERE n.item_key='custom:'||i.service_id::text AND i.due_on=n.due_on
 ) legacy) legacy_reminded_at
FROM native n LEFT JOIN business_profiles b ON b.organization_id=n.organization_id
LEFT JOIN LATERAL(SELECT COALESCE(NULLIF(u.email,''),NULLIF(m.email,'')) email FROM organization_members m LEFT JOIN users u ON u.id=m.user_id WHERE m.organization_id=n.organization_id AND m.role='owner' AND m.active=true ORDER BY m.created_at,m.id LIMIT 1)o ON true;
