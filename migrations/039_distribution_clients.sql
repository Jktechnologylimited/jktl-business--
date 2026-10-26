CREATE TABLE IF NOT EXISTS distribution_account_links (
 user_id uuid NOT NULL REFERENCES users(id), affiliate_id uuid NOT NULL UNIQUE REFERENCES affiliates(id),
 program text NOT NULL CHECK(program IN('affiliate','partner')), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,program)
);
CREATE TABLE IF NOT EXISTS partner_client_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),partner_id uuid NOT NULL REFERENCES affiliates(id),token_hash text NOT NULL UNIQUE,
 label text NOT NULL CHECK(length(label) BETWEEN 1 AND 160),expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',
 accepted_org uuid REFERENCES organizations(id),accepted_by uuid REFERENCES users(id),accepted_at timestamptz,
 revoked_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS partner_client_access (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),partner_id uuid NOT NULL REFERENCES affiliates(id),organization_id uuid NOT NULL REFERENCES organizations(id),
 invitation_id uuid NOT NULL UNIQUE REFERENCES partner_client_invitations(id),granted_by uuid NOT NULL REFERENCES users(id),
 scopes text[] NOT NULL DEFAULT '{}',revoked_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(scopes <@ ARRAY['VIEW_ALLOWED_SERVICES','REQUEST_SERVICE_CHANGES']::text[])
);
CREATE UNIQUE INDEX IF NOT EXISTS partner_one_active_relationship ON partner_client_access(partner_id,organization_id) WHERE revoked_at IS NULL;
CREATE TABLE IF NOT EXISTS partner_service_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),relationship_id uuid NOT NULL REFERENCES partner_client_access(id),
 product text NOT NULL CHECK(product IN('website','domain','email','training','custom','managed-services')),
 message text NOT NULL CHECK(length(message) BETWEEN 10 AND 2000),status text NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','IN_REVIEW','COMPLETED','DECLINED')),
 reply text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO feature_registry(slug,name,category,route,description) VALUES
('program-accounts','Program account access','Distribution','/business/distribution','Connect an approved program to your Business account.'),
('partner-clients','Partner clients','Distribution','/partners/clients','Client invitations and authorized service requests.') ON CONFLICT DO NOTHING;
