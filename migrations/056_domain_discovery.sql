CREATE TABLE IF NOT EXISTS domain_purchase_controls(
 id boolean PRIMARY KEY DEFAULT true CHECK(id),purchases_enabled boolean NOT NULL DEFAULT false,
 automation_enabled boolean NOT NULL DEFAULT false,readonly_verified_at timestamptz,e2e_verified_at timestamptz,
 updated_by uuid REFERENCES admin_users(id),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(NOT purchases_enabled OR readonly_verified_at IS NOT NULL AND e2e_verified_at IS NOT NULL),
 CHECK(NOT automation_enabled OR purchases_enabled)
);
INSERT INTO domain_purchase_controls(id) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS domain_public_searches(
 domain text PRIMARY KEY,price_revision integer NOT NULL,result jsonb NOT NULL DEFAULT '{}',valid_until timestamptz NOT NULL DEFAULT now(),
 lease_until timestamptz,lease_token uuid,updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS domain_public_search_cleanup ON domain_public_searches(updated_at);
