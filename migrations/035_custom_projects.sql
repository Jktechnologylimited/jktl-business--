-- Independent custom applications retain their own data and deployments.
CREATE TABLE IF NOT EXISTS custom_clients (
 organization_id uuid PRIMARY KEY REFERENCES organizations(id),
 user_id uuid NOT NULL REFERENCES users(id),
 activation_required boolean NOT NULL DEFAULT false,
 pilot_ready boolean NOT NULL DEFAULT false,
 activated_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS custom_projects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES custom_clients(organization_id),
 name text NOT NULL,
 website_url text NOT NULL,
 status text NOT NULL DEFAULT 'CONFIGURING' CHECK(status IN('CONFIGURING','LIVE','PAUSED','ARCHIVED')),
 cms_url text NOT NULL DEFAULT '',
 cms_key_hash text NOT NULL DEFAULT '',
 cms_tested_at timestamptz,
 analytics_url text NOT NULL DEFAULT '',
 domain_asset_id uuid REFERENCES domain_assets(id),
 description text NOT NULL DEFAULT '',
 revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,organization_id)
);
CREATE TABLE IF NOT EXISTS custom_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES custom_clients(organization_id),
 user_id uuid NOT NULL REFERENCES users(id),
 token_hash text NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL,
 used_at timestamptz,
 sent_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS custom_services (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL,
 organization_id uuid NOT NULL,
 name text NOT NULL,
 category text NOT NULL CHECK(category IN('HOSTING','MAINTENANCE','EMAIL','DEVELOPMENT','OTHER')),
 description text NOT NULL,
 amount_kobo bigint NOT NULL CHECK(amount_kobo>0 AND amount_kobo<=2000000000),
 discount_kobo bigint NOT NULL DEFAULT 0 CHECK(discount_kobo>=0 AND discount_kobo<amount_kobo),
 interval text NOT NULL CHECK(interval IN('MONTHLY','ANNUAL','ONCE')),
 starts_on date NOT NULL,
 next_due_on date NOT NULL,
 status text NOT NULL DEFAULT 'PROPOSED' CHECK(status IN('PROPOSED','ACTIVE','PAUSED','CANCELLED')),
 accepted_by uuid REFERENCES users(id),
 accepted_at timestamptz,
 revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(project_id,organization_id) REFERENCES custom_projects(id,organization_id)
);
CREATE TABLE IF NOT EXISTS custom_invoices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 service_id uuid NOT NULL REFERENCES custom_services(id),
 organization_id uuid NOT NULL REFERENCES custom_clients(organization_id),
 project_id uuid NOT NULL REFERENCES custom_projects(id),
 due_on date NOT NULL,
 description text NOT NULL,
 amount_kobo bigint NOT NULL CHECK(amount_kobo>0),
 status text NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','PAID','VOID')),
 reference text UNIQUE,
 checkout_state text NOT NULL DEFAULT 'reserved' CHECK(checkout_state IN('reserved','initializing','ready','unknown')),
 authorization_url text,
 billing_email text,
 provider_transaction text UNIQUE,
 paid_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(service_id,due_on)
);
CREATE TABLE IF NOT EXISTS custom_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL,
 organization_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN('CONTENT','FIX','DEVELOPMENT','EMAIL','SUPPORT')),
 message text NOT NULL,
 status text NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','PROCESSING','COMPLETED','DECLINED')),
 reply text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(project_id,organization_id) REFERENCES custom_projects(id,organization_id)
);
CREATE TABLE IF NOT EXISTS custom_cms_grants (
 token_hash text PRIMARY KEY,
 project_id uuid NOT NULL,
 organization_id uuid NOT NULL,
 user_id uuid NOT NULL REFERENCES users(id),
 expires_at timestamptz NOT NULL,
 used_at timestamptz,
 FOREIGN KEY(project_id,organization_id) REFERENCES custom_projects(id,organization_id)
);
CREATE TABLE IF NOT EXISTS custom_audit (
 id bigserial PRIMARY KEY,
 organization_id uuid NOT NULL REFERENCES organizations(id),
 project_id uuid,
 actor_id text NOT NULL,
 event text NOT NULL,
 detail jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS custom_projects_org ON custom_projects(organization_id);
CREATE INDEX IF NOT EXISTS custom_invoices_org ON custom_invoices(organization_id,due_on);
CREATE INDEX IF NOT EXISTS custom_requests_queue ON custom_requests(status,created_at);
CREATE TABLE IF NOT EXISTS custom_outbox (
 id bigserial PRIMARY KEY,
 event_key text NOT NULL UNIQUE,
 organization_id uuid NOT NULL REFERENCES custom_clients(organization_id),
 subject text NOT NULL,
 detail text NOT NULL,
 sent_at timestamptz,
 lease_until timestamptz,
 attempts integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now()
);
