-- Internal communication details are separate from sign-in identities and public sites.
CREATE TABLE IF NOT EXISTS business_communication_profiles(
 organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
 business_name text NOT NULL DEFAULT '' CHECK(length(business_name)<=200),
 contact_name text NOT NULL DEFAULT '' CHECK(length(contact_name)<=200),
 billing_email text NOT NULL DEFAULT '' CHECK(length(billing_email)<=254),
 phone text NOT NULL DEFAULT '' CHECK(length(phone)<=50),
 additional_emails text[] NOT NULL DEFAULT '{}' CHECK(cardinality(additional_emails)<=5),
 client_status text NOT NULL DEFAULT 'ACTIVE' CHECK(client_status IN('ACTIVE','PAUSED','CLOSED')),
 notes text NOT NULL DEFAULT '' CHECK(length(notes)<=2000),
 revision integer NOT NULL DEFAULT 1,updated_by text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE renewal_tracked_services ADD COLUMN IF NOT EXISTS billing_interval text CHECK(billing_interval IN('ANNUAL','MONTHLY','ONCE'));
ALTER TABLE renewal_tracked_services ADD COLUMN IF NOT EXISTS service_scope text NOT NULL DEFAULT '' CHECK(length(service_scope)<=2000);
ALTER TABLE renewal_tracked_services ADD COLUMN IF NOT EXISTS last_paid_on date;
ALTER TABLE renewal_tracked_services ADD COLUMN IF NOT EXISTS last_paid_kobo bigint CHECK(last_paid_kobo BETWEEN 0 AND 2000000000);
ALTER TABLE renewal_tracked_services ADD COLUMN IF NOT EXISTS payment_note text NOT NULL DEFAULT '' CHECK(length(payment_note)<=1000);
ALTER TABLE renewal_tracked_services ADD COLUMN IF NOT EXISTS reminders_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE renewal_tracked_services ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
ALTER TABLE renewal_tracked_services ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE renewal_tracked_services ADD COLUMN IF NOT EXISTS source_custom_service_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS custom_services_id_org ON custom_services(id,organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS custom_projects_id_org ON custom_projects(id,organization_id);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='renewal_tracked_project_tenant') THEN
  ALTER TABLE renewal_tracked_services ADD CONSTRAINT renewal_tracked_project_tenant FOREIGN KEY(project_id,organization_id) REFERENCES custom_projects(id,organization_id);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='renewal_tracked_service_tenant') THEN
  ALTER TABLE renewal_tracked_services ADD CONSTRAINT renewal_tracked_service_tenant FOREIGN KEY(source_custom_service_id,organization_id) REFERENCES custom_services(id,organization_id);
 END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS renewal_tracked_custom_source ON renewal_tracked_services(source_custom_service_id) WHERE source_custom_service_id IS NOT NULL AND status='ACTIVE';

-- Preserve the existing view columns while applying contact overrides and pauses
-- to older deployments too. Monthly reminders begin at seven days, not thirty.
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
SELECT n.item_key,n.organization_id,n.kind,n.name,n.due_on,n.amount_kobo,n.path,CASE WHEN COALESCE(communication.client_status,'ACTIVE')<>'ACTIVE' OR NOT COALESCE(delivery.reminders_enabled,true)
 OR(delivery.billing_interval='MONTHLY' AND n.due_on-(now() AT TIME ZONE 'Africa/Lagos')::date>7)
 OR COALESCE(linked_contract.status,'PROPOSED') IN('PAUSED','CANCELLED') THEN NULL::text
 ELSE lower(COALESCE(NULLIF(n.recipient,''),NULLIF(communication.billing_email,''),o.email)) END AS recipient,
 COALESCE(NULLIF(communication.business_name,''),b.display_name,'Business account') business_name,
 (n.due_on-(now() AT TIME ZONE 'Africa/Lagos')::date)::int days_left,
 (SELECT max(sent_at) FROM (
 SELECT d.sent_at FROM domain_outbox d WHERE n.item_key LIKE 'domain:%' AND d.organization_id=n.organization_id AND d.domain=n.name AND d.event='Domain renewal reminder'
 UNION ALL SELECT e.sent_at FROM email_outbox e WHERE n.item_key LIKE 'email:%' AND e.organization_id=n.organization_id AND e.event_key LIKE 'renewal:'||split_part(n.item_key,':',2)||':%'
 UNION ALL SELECT c.sent_at FROM custom_outbox c JOIN custom_invoices i ON c.event_key LIKE 'reminder:'||i.id::text||':%' WHERE n.item_key='custom:'||i.service_id::text AND i.due_on=n.due_on
 ) legacy) legacy_reminded_at
FROM native n LEFT JOIN business_profiles b ON b.organization_id=n.organization_id
LEFT JOIN business_communication_profiles communication ON communication.organization_id=n.organization_id
LEFT JOIN renewal_tracked_services delivery ON delivery.organization_id=n.organization_id AND delivery.status='ACTIVE' AND(n.item_key='tracked:'||delivery.id::text OR n.item_key='custom:'||delivery.source_custom_service_id::text)
LEFT JOIN custom_services linked_contract ON linked_contract.id=delivery.source_custom_service_id AND linked_contract.organization_id=n.organization_id
LEFT JOIN LATERAL(SELECT COALESCE(NULLIF(u.email,''),NULLIF(m.email,'')) email FROM organization_members m LEFT JOIN users u ON u.id=m.user_id WHERE m.organization_id=n.organization_id AND m.role='owner' AND m.active=true ORDER BY m.created_at,m.id LIMIT 1)o ON true;

-- Keep the original register/view contract intact for older deployments.
-- The enriched view transfers a linked reminder to its accepted native contract,
-- rather than sending once for the manual record and again for the native service.
CREATE OR REPLACE VIEW renewal_details AS
SELECT CASE WHEN t.source_custom_service_id IS NOT NULL THEN 'tracked:'||t.id::text ELSE i.item_key END AS item_key,i.organization_id,i.kind,i.name,i.due_on,i.amount_kobo,
 CASE WHEN COALESCE(t.project_id,s.project_id) IS NOT NULL THEN '/business/custom/'||COALESCE(t.project_id,s.project_id)::text||'/portal' ELSE i.path END AS path,
 lower(COALESCE(NULLIF(t.recipient,''),NULLIF(c.billing_email,''),i.recipient,owner.email)) AS recipient,
 COALESCE(NULLIF(c.business_name,''),i.business_name) AS business_name,
 i.days_left,i.legacy_reminded_at,
 COALESCE(NULLIF(t.service_scope,''),NULLIF(s.description,''),i.name) AS service_scope,
 COALESCE(t.billing_interval,s.interval,CASE WHEN i.kind='DOMAIN' THEN 'ANNUAL' END) AS billing_interval,
 t.last_paid_on,t.last_paid_kobo,t.payment_note,
 COALESCE(t.reminders_enabled,true) AND COALESCE(c.client_status,'ACTIVE')='ACTIVE'
 AND COALESCE(s.status,'ACTIVE') NOT IN('PAUSED','CANCELLED') AS reminders_enabled,
 COALESCE(t.project_id,s.project_id) AS project_id
FROM renewal_items i
LEFT JOIN renewal_tracked_services t ON t.organization_id=i.organization_id AND t.status='ACTIVE' AND(i.item_key='tracked:'||t.id::text OR i.item_key='custom:'||t.source_custom_service_id::text)
LEFT JOIN custom_services s ON s.organization_id=i.organization_id AND(s.id=t.source_custom_service_id OR i.item_key='custom:'||s.id::text)
LEFT JOIN business_communication_profiles c ON c.organization_id=i.organization_id
LEFT JOIN LATERAL(SELECT u.email FROM organization_members m JOIN users u ON u.id=m.user_id WHERE m.organization_id=i.organization_id AND m.active=true AND m.role='owner' ORDER BY m.created_at,m.id LIMIT 1)owner ON true
WHERE NOT(COALESCE(i.item_key LIKE 'tracked:%' AND s.status='ACTIVE' AND s.accepted_at IS NOT NULL AND s.interval IN('ANNUAL','MONTHLY') AND EXISTS(SELECT 1 FROM custom_projects p WHERE p.id=s.project_id AND p.organization_id=s.organization_id AND p.status IN('LIVE','CONFIGURING')),false));
