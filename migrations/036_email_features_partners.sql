ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS programme text NOT NULL DEFAULT 'affiliate' CHECK(programme IN('affiliate','partner'));
CREATE TABLE IF NOT EXISTS email_plans (
 id text PRIMARY KEY, name text NOT NULL, description text NOT NULL,
 price_kobo bigint CHECK(price_kobo>0 AND price_kobo<=2000000000), period_months integer NOT NULL DEFAULT 12 CHECK(period_months BETWEEN 1 AND 36),
 mailbox_limit integer NOT NULL CHECK(mailbox_limit BETWEEN 1 AND 1000), storage_gb integer NOT NULL CHECK(storage_gb BETWEEN 1 AND 10000),
 features jsonb NOT NULL DEFAULT '[]', enabled boolean NOT NULL DEFAULT true, publicly_available boolean NOT NULL DEFAULT true,
 purchasable boolean NOT NULL DEFAULT false, recommended boolean NOT NULL DEFAULT false,
 procurement_cost_kobo bigint CHECK(procurement_cost_kobo>=0), resale_confirmed boolean NOT NULL DEFAULT false,
 paid_license_confirmed boolean NOT NULL DEFAULT false, features_confirmed boolean NOT NULL DEFAULT false,
 revision integer NOT NULL DEFAULT 1, updated_by text, updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO email_plans(id,name,description,price_kobo,mailbox_limit,storage_gb,features,recommended) VALUES
('starter','Email Starter','Professional email for your business.',2500000,1,5,'["Custom domain email address","Webmail access","Email sending and receiving","Spam filtering","Standard email security","Initial mailbox configuration","Basic technical support"]',false),
('team','Email Team','Professional mailboxes for your growing team.',6500000,3,5,'["Custom domain email addresses","Webmail access","Email sending and receiving","Spam filtering","Standard email security","Initial mailbox configuration","Basic mailbox administration","Priority setup assistance"]',true),
('business','Email Business','A coordinated email service for your business.',12000000,5,5,'["Custom domain email addresses","Webmail access","Email sending and receiving","Spam filtering","Standard email security","Initial mailbox configuration","Mailbox administration assistance","Priority technical support"]',false),
('custom','Email Custom','Tailored email for teams needing 10 or more mailboxes.',NULL,10,5,'["Custom mailbox quantities","Storage requirements assessment","Business email migration options","Multiple-domain requirements assessment","Custom onboarding","Custom technical support arrangements","Tailored pricing"]',false)
ON CONFLICT(id) DO NOTHING;
CREATE TABLE IF NOT EXISTS email_price_overrides (
 organization_id uuid NOT NULL REFERENCES organizations(id),plan_id text NOT NULL REFERENCES email_plans(id),
 price_kobo bigint NOT NULL CHECK(price_kobo>0 AND price_kobo<=2000000000),note text NOT NULL,
 revision integer NOT NULL DEFAULT 1,updated_by text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,plan_id)
);
CREATE TABLE IF NOT EXISTS email_services (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES organizations(id),domain text NOT NULL UNIQUE,
 plan_id text REFERENCES email_plans(id),plan_name text NOT NULL,mailbox_limit integer NOT NULL CHECK(mailbox_limit BETWEEN 1 AND 1000),storage_gb integer NOT NULL CHECK(storage_gb>0),
 status text NOT NULL CHECK(status IN('AWAITING_DOMAIN_VERIFICATION','PENDING_SETUP','CONFIGURING','ACTIVE','SETUP_FAILED','SUSPENDED','CANCELLED')),
 ownership_token text NOT NULL,verified_at timestamptz,dns_records jsonb NOT NULL DEFAULT '[]',
 provider_plan text NOT NULL DEFAULT '',license_type text NOT NULL CHECK(license_type IN('PAID','LEGACY_FREE')),
 provider_reference text NOT NULL DEFAULT '',webmail_url text NOT NULL DEFAULT '',activation_url text NOT NULL DEFAULT '',
 send_receive_confirmed boolean NOT NULL DEFAULT false,dns_confirmed boolean NOT NULL DEFAULT false,
 starts_at timestamptz,renews_at timestamptz,period_price_kobo bigint,period_months integer,
 management_fee_kobo bigint NOT NULL DEFAULT 0 CHECK(management_fee_kobo>=0),revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(id,organization_id)
);
CREATE TABLE IF NOT EXISTS email_mailboxes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),service_id uuid NOT NULL REFERENCES email_services(id),address text NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'ALLOCATED' CHECK(status IN('ALLOCATED','REMOVED')),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS email_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES organizations(id),service_id uuid REFERENCES email_services(id),
 kind text NOT NULL CHECK(kind IN('NEW','RENEW')),domain text NOT NULL,plan_id text NOT NULL REFERENCES email_plans(id),plan_revision integer NOT NULL,
 plan_name text NOT NULL,mailbox_limit integer NOT NULL,storage_gb integer NOT NULL,period_months integer NOT NULL,features jsonb NOT NULL,
 amount_kobo bigint NOT NULL CHECK(amount_kobo>0),mailboxes jsonb NOT NULL,terms_version text NOT NULL,consent_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'PENDING_PAYMENT' CHECK(status IN('PENDING_PAYMENT','PAYMENT_REVIEW','PAYMENT_CONFIRMED','AWAITING_DOMAIN_VERIFICATION','PENDING_SETUP','CONFIGURING','ACTIVE','SETUP_FAILED','SUSPENDED','CANCELLED')),
 reference text NOT NULL UNIQUE,billing_email text NOT NULL,authorization_url text,checkout_state text NOT NULL DEFAULT 'reserved' CHECK(checkout_state IN('reserved','initializing','ready','unknown')),
 provider_transaction text UNIQUE,paid_at timestamptz,base_expiry timestamptz,revision integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS email_order_domain_hold ON email_orders(domain) WHERE status IN('PENDING_PAYMENT','PAYMENT_CONFIRMED','AWAITING_DOMAIN_VERIFICATION','PENDING_SETUP','CONFIGURING');
CREATE TABLE IF NOT EXISTS email_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES organizations(id),service_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN('ADD_MAILBOX','REMOVE_MAILBOX','ALIAS','UPGRADE','MIGRATION','SUPPORT','PASSWORD_RESET','BILLING')),
 message text NOT NULL,status text NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','PROCESSING','COMPLETED','DECLINED')),reply text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(service_id,organization_id) REFERENCES email_services(id,organization_id)
);
CREATE TABLE IF NOT EXISTS email_audit (
 id bigserial PRIMARY KEY,organization_id uuid REFERENCES organizations(id),actor_id text NOT NULL,event text NOT NULL,detail jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS email_outbox (
 id bigserial PRIMARY KEY,event_key text NOT NULL UNIQUE,organization_id uuid NOT NULL REFERENCES organizations(id),subject text NOT NULL,detail text NOT NULL,
 sent_at timestamptz,lease_until timestamptz,attempts integer NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS feature_registry (
 slug text PRIMARY KEY,name text NOT NULL,category text NOT NULL,route text NOT NULL UNIQUE,description text NOT NULL,
 is_new boolean NOT NULL DEFAULT false,starts_at timestamptz,ends_at timestamptz,revision integer NOT NULL DEFAULT 1,updated_by text,updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_at IS NULL OR starts_at IS NULL OR ends_at>starts_at)
);
CREATE TABLE IF NOT EXISTS feature_badge_audit (
 id bigserial PRIMARY KEY,feature_slug text NOT NULL REFERENCES feature_registry(slug),actor_id text NOT NULL,detail jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO feature_registry(slug,name,category,route,description) VALUES
('business-email','JKTL Business Email','Product','/business/email','Professional mailboxes and email services.'),
('domains','Domains','Product','/business/domains','Domain orders and renewals.'),
('custom','JKTL Custom','Product','/business/custom','Independent custom websites and client services.'),
('website-builder','Website builder','Product','/business/website','Create and publish your website.'),
('templates','Website templates','Product','/templates','Website designs and blank canvases.'),
('landing-pages','Landing pages','Product','/landing-pages','Focused campaign pages.'),
('business-tools','Business tools','Product','/business','Customers, bookings and invoicing.'),
('managed-services','Managed services','Service','/products/managed-services','Website care and support.'),
('ai-receptionist','AI receptionist','Product','/business/receptionist','Call and customer communication tools.'),
('tycoon','Business Tycoon','Game','/play/tycoon','A Nigerian business simulation.'),
('fantasy','JKTL Fantasy','Game','/games/fantasy','Fantasy trading experience.') ON CONFLICT(slug) DO NOTHING;
CREATE INDEX IF NOT EXISTS email_services_org ON email_services(organization_id);
CREATE INDEX IF NOT EXISTS email_orders_org ON email_orders(organization_id,created_at);
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS partner_agreement text NOT NULL DEFAULT '';
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS partner_terms_confirmed boolean NOT NULL DEFAULT false;
ALTER TABLE email_orders ADD COLUMN IF NOT EXISTS pricing_note text NOT NULL DEFAULT '';
INSERT INTO feature_registry(slug,name,category,route,description) VALUES
('customers','Customer records','Tool','/business/customers','Customer information and history.'),
('bookings','Bookings and sales','Tool','/business/bookings','Appointments and business activity.'),
('payments','Invoicing and payments','Tool','/business/invoices','Invoices and payment tracking.'),
('inventory','Inventory','Tool','/business/inventory','Stock records and movements.'),
('expenses','Expenses','Tool','/business/expenses','Business spending records.'),
('mobile-app','Installable app','Feature','/business/more','Add JKTL Business to your home screen.'),
('team','Team access','Feature','/business/settings','Organization members and roles.') ON CONFLICT(slug) DO NOTHING;
ALTER TABLE email_plans ADD COLUMN IF NOT EXISTS reminder_days jsonb NOT NULL DEFAULT '[30,14,7,0]';
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS partner_source_id text UNIQUE;
CREATE UNIQUE INDEX IF NOT EXISTS email_new_domain_claim ON email_orders(domain)
WHERE kind='NEW' AND(service_id IS NOT NULL OR status IN('PENDING_PAYMENT','PAYMENT_CONFIRMED','AWAITING_DOMAIN_VERIFICATION','PENDING_SETUP','CONFIGURING'));
