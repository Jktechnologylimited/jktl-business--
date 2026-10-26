ALTER TABLE feature_registry ADD COLUMN IF NOT EXISTS partner_mode text NOT NULL DEFAULT 'UNAVAILABLE' CHECK(partner_mode IN('UNAVAILABLE','SELF_SERVICE','ASSISTED','QUOTE'));
ALTER TABLE feature_registry ADD COLUMN IF NOT EXISTS partner_actions text[] NOT NULL DEFAULT '{}';
UPDATE feature_registry SET partner_mode='SELF_SERVICE',partner_actions=ARRAY['VIEW','PREVIEW','CONFIGURE','MANAGE','REQUEST_SETUP','REQUEST_SUPPORT'] WHERE slug IN('templates','website-builder') AND partner_mode='UNAVAILABLE' AND NOT EXISTS(SELECT 1 FROM distribution_audit WHERE event='PARTNER_PRODUCT_DEFAULTS_040');
UPDATE feature_registry SET partner_mode='ASSISTED',partner_actions=ARRAY['VIEW','REQUEST_SETUP','REQUEST_SUPPORT'] WHERE slug IN('domains','business-email','managed-services','business-tools','ai-receptionist') AND partner_mode='UNAVAILABLE' AND NOT EXISTS(SELECT 1 FROM distribution_audit WHERE event='PARTNER_PRODUCT_DEFAULTS_040');
UPDATE feature_registry SET partner_mode='QUOTE',partner_actions=ARRAY['VIEW','REQUEST_SETUP','REQUEST_SUPPORT'] WHERE slug='custom' AND partner_mode='UNAVAILABLE' AND NOT EXISTS(SELECT 1 FROM distribution_audit WHERE event='PARTNER_PRODUCT_DEFAULTS_040');
INSERT INTO distribution_audit(actor_id,event) SELECT 'migration-040','PARTNER_PRODUCT_DEFAULTS_040' WHERE NOT EXISTS(SELECT 1 FROM distribution_audit WHERE event='PARTNER_PRODUCT_DEFAULTS_040');
CREATE TABLE IF NOT EXISTS partner_workspaces(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),partner_id uuid NOT NULL REFERENCES affiliates(id),organization_id uuid REFERENCES organizations(id),
 business_name text NOT NULL,business_category text NOT NULL DEFAULT '',contact_name text NOT NULL,contact_email text NOT NULL,phone text NOT NULL DEFAULT '',country text NOT NULL DEFAULT 'NG',preferred_domain text NOT NULL DEFAULT '',requirements text NOT NULL DEFAULT '',
 selected_services text[] NOT NULL DEFAULT '{}',template_id text NOT NULL DEFAULT '',document jsonb NOT NULL DEFAULT '{}',revision integer NOT NULL DEFAULT 0,checklist jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(id,partner_id)
);
ALTER TABLE partner_client_invitations ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES partner_workspaces(id);
ALTER TABLE partner_client_access DROP CONSTRAINT IF EXISTS partner_client_access_scopes_check;
ALTER TABLE partner_client_access ADD CONSTRAINT partner_client_access_scopes_check CHECK(scopes <@ ARRAY['VIEW_ALLOWED_SERVICES','REQUEST_SERVICE_CHANGES','MANAGE_WEBSITE_CONTENT','PUBLISH_WEBSITE']::text[]);
INSERT INTO feature_registry(slug,name,category,route,description) VALUES('partner-workspace','Partner Workspace','Distribution','/partners/workspace','Multi-client website setup and service operations.'),('partner-support','Partner Support','Distribution','/partners/support','Partner assistance and ticket history.') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS partner_tickets(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),partner_id uuid NOT NULL REFERENCES affiliates(id),workspace_id uuid REFERENCES partner_workspaces(id),
 category text NOT NULL,subject text NOT NULL,priority text NOT NULL DEFAULT 'NORMAL' CHECK(priority IN('LOW','NORMAL','HIGH')),
 status text NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','ASSIGNED','IN_PROGRESS','WAITING_FOR_PARTNER','WAITING_FOR_CUSTOMER','WAITING_FOR_PROVIDER','RESOLVED','CLOSED')),
 sensitive boolean NOT NULL DEFAULT false,assigned_to uuid REFERENCES admin_users(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS partner_ticket_messages(
 id bigserial PRIMARY KEY,ticket_id uuid NOT NULL REFERENCES partner_tickets(id),actor_id text NOT NULL,kind text NOT NULL CHECK(kind IN('PARTNER','STAFF','NOTE','EVENT')),body text NOT NULL CHECK(length(body) BETWEEN 1 AND 5000),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS partner_tickets_queue ON partner_tickets(status,updated_at);

ALTER TABLE partner_service_requests DROP CONSTRAINT IF EXISTS partner_service_requests_product_check;
ALTER TABLE partner_service_requests ADD CONSTRAINT partner_service_requests_product_check CHECK(length(product) BETWEEN 1 AND 100);
