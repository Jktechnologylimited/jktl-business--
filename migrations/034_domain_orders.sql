CREATE TABLE IF NOT EXISTS domain_prices (
 extension text PRIMARY KEY CHECK(extension ~ '^\.[a-z]{2,}(\.[a-z]{2,})?$'),
 supplier text NOT NULL DEFAULT 'GO54', registration_cost bigint NOT NULL DEFAULT 0 CHECK(registration_cost>=0),
 registration_price bigint CHECK(registration_price>0), renewal_cost bigint NOT NULL DEFAULT 0 CHECK(renewal_cost>=0),
 renewal_price bigint CHECK(renewal_price>0), transfer_price bigint CHECK(transfer_price>0), currency text NOT NULL DEFAULT 'NGN' CHECK(currency='NGN'),
 enabled boolean NOT NULL DEFAULT false, max_years integer NOT NULL DEFAULT 1 CHECK(max_years BETWEEN 1 AND 10),
 requirements text NOT NULL DEFAULT '', revision integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO domain_prices(extension) VALUES('.com'),('.com.ng'),('.ng'),('.name.ng'),('.org'),('.net') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS domain_checks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 domain text NOT NULL, extension text NOT NULL REFERENCES domain_prices(extension), status text NOT NULL DEFAULT 'UNKNOWN' CHECK(status IN('UNKNOWN','AVAILABLE','UNAVAILABLE')),
 source text NOT NULL DEFAULT 'manual', price_revision integer NOT NULL DEFAULT 1, checked_at timestamptz, valid_until timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,domain)
);
CREATE TABLE IF NOT EXISTS domain_assets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 domain text NOT NULL UNIQUE, extension text NOT NULL REFERENCES domain_prices(extension), registered_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
 nameservers jsonb NOT NULL DEFAULT '[]', supplier_reference text NOT NULL,
 website_org_id uuid REFERENCES organizations(id), connection_status text NOT NULL DEFAULT 'NONE' CHECK(connection_status IN('NONE','PENDING','DNS_VERIFIED','CONNECTED')),
 connection_token text NOT NULL DEFAULT '', hosting_reference text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(website_org_id IS NULL OR website_org_id=organization_id), CHECK(expires_at>registered_at)
);
CREATE TABLE IF NOT EXISTS domain_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 domain text NOT NULL, extension text NOT NULL REFERENCES domain_prices(extension), kind text NOT NULL CHECK(kind IN('REGISTER','RENEW')),
 asset_id uuid REFERENCES domain_assets(id), years integer NOT NULL CHECK(years BETWEEN 1 AND 10),
 status text NOT NULL DEFAULT 'PENDING_PAYMENT' CHECK(status IN('PENDING_PAYMENT','PAID','PROCESSING','ACTIVE','FAILED','REFUND_PENDING','REFUNDED','CANCELLED')),
 amount_kobo bigint NOT NULL CHECK(amount_kobo>0), renewal_kobo bigint NOT NULL CHECK(renewal_kobo>0), currency text NOT NULL DEFAULT 'NGN' CHECK(currency='NGN'),
 price_revision integer NOT NULL, contact_ciphertext text NOT NULL, billing_email text NOT NULL,
 reference text NOT NULL UNIQUE, authorization_url text, checkout_state text NOT NULL DEFAULT 'reserved' CHECK(checkout_state IN('reserved','initializing','ready','unknown')),
 terms_version text NOT NULL, consent_at timestamptz NOT NULL DEFAULT now(), base_expiry timestamptz,
 supplier_reference text, registered_at timestamptz, expires_at timestamptz, nameservers jsonb NOT NULL DEFAULT '[]',
 failure_reason text NOT NULL DEFAULT '', refund_reference text, refunded_kobo bigint NOT NULL DEFAULT 0 CHECK(refunded_kobo>=0 AND refunded_kobo<=amount_kobo), revision integer NOT NULL DEFAULT 1,
 paid_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS domain_registration_hold ON domain_orders(domain) WHERE kind='REGISTER' AND status IN('PENDING_PAYMENT','PAID','PROCESSING','ACTIVE');
CREATE UNIQUE INDEX IF NOT EXISTS domain_renewal_hold ON domain_orders(asset_id) WHERE kind='RENEW' AND status IN('PENDING_PAYMENT','PAID','PROCESSING','REFUND_PENDING');
CREATE INDEX IF NOT EXISTS domain_orders_tenant ON domain_orders(organization_id,created_at DESC);
CREATE TABLE IF NOT EXISTS domain_payments (
 reference text PRIMARY KEY REFERENCES domain_orders(reference), provider_transaction text NOT NULL UNIQUE,
 amount_kobo bigint NOT NULL, paid_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS domain_tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), asset_id uuid REFERENCES domain_assets(id) ON DELETE CASCADE, order_id uuid REFERENCES domain_orders(id),
 organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, kind text NOT NULL CHECK(kind IN('DNS','NAMESERVERS','CONNECT','TRANSFER','SUPPORT')),
 message text NOT NULL, status text NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','PROCESSING','COMPLETED','REJECTED')), admin_note text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CHECK(asset_id IS NOT NULL OR order_id IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS domain_audit (
 id bigserial PRIMARY KEY, organization_id uuid REFERENCES organizations(id), order_id uuid REFERENCES domain_orders(id),
 actor_id uuid, actor_type text NOT NULL CHECK(actor_type IN('admin','customer','system')), event text NOT NULL, detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS domain_outbox (
 id bigserial PRIMARY KEY, event_key text NOT NULL UNIQUE, organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 domain text NOT NULL, event text NOT NULL, detail text NOT NULL DEFAULT '', sent_at timestamptz, attempts integer NOT NULL DEFAULT 0,
 lease_until timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS domain_rate_limits (bucket text PRIMARY KEY, hits integer NOT NULL, expires_at timestamptz NOT NULL);

CREATE TABLE IF NOT EXISTS domain_refunds (provider_id text PRIMARY KEY, reference text NOT NULL REFERENCES domain_payments(reference), amount_kobo bigint NOT NULL CHECK(amount_kobo>0), created_at timestamptz NOT NULL DEFAULT now());
