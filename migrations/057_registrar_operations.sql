-- Additive only: retain every existing order, asset, payment and subscription.
ALTER TABLE domain_prices ADD COLUMN IF NOT EXISTS transfer_cost bigint NOT NULL DEFAULT 0 CHECK(transfer_cost>=0);
ALTER TABLE domain_prices ADD COLUMN IF NOT EXISTS markup_bps integer NOT NULL DEFAULT 0 CHECK(markup_bps BETWEEN 0 AND 100000);
ALTER TABLE domain_prices ADD COLUMN IF NOT EXISTS markup_fixed_kobo bigint NOT NULL DEFAULT 0 CHECK(markup_fixed_kobo BETWEEN 0 AND 1000000000);
ALTER TABLE domain_prices ADD COLUMN IF NOT EXISTS pricing_mode text NOT NULL DEFAULT 'MANUAL' CHECK(pricing_mode IN('MANUAL','MARKUP'));
ALTER TABLE domain_prices ADD COLUMN IF NOT EXISTS wholesale_synced_at timestamptz;
CREATE TABLE IF NOT EXISTS domain_registrar_state (
 id boolean PRIMARY KEY DEFAULT true CHECK(id),
 provider text NOT NULL DEFAULT 'GO54' CHECK(provider='GO54'),
 wallet_kobo bigint CHECK(wallet_kobo>=0),currency text NOT NULL DEFAULT 'NGN' CHECK(currency='NGN'),
 wallet_checked_at timestamptz, wallet_source text CHECK(wallet_source IN('API','OPERATOR')),
 low_balance_kobo bigint NOT NULL DEFAULT 0 CHECK(low_balance_kobo>=0),
 low_balance_active boolean NOT NULL DEFAULT false,revision integer NOT NULL DEFAULT 1,
 inflight_operation_id uuid,
 updated_by uuid REFERENCES admin_users(id), updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO domain_registrar_state(id) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS domain_registrar_alerts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_key text NOT NULL UNIQUE,
 subject text NOT NULL, detail text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 delivered_at timestamptz,lease_until timestamptz,attempts integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS domain_registrar_operations (
 id uuid PRIMARY KEY,order_id uuid NOT NULL REFERENCES domain_orders(id),
 kind text NOT NULL CHECK(kind IN('REGISTER','RENEW')),
 domain text NOT NULL,attempt integer NOT NULL CHECK(attempt>0),
 state text NOT NULL DEFAULT 'PRECHECK' CHECK(state IN('PRECHECK','SUBMITTED','UNKNOWN','CONFIRMED','NOT_APPLIED')),
 transaction_reference text,registered_at timestamptz,expires_at timestamptz,nameservers jsonb,
 reserved_cost_kobo bigint NOT NULL DEFAULT 0 CHECK(reserved_cost_kobo>=0),
 submitted_at timestamptz,reconciled_at timestamptz,confirmation_recorded_at timestamptz,
 reason text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(order_id,attempt)
);
CREATE UNIQUE INDEX IF NOT EXISTS domain_registrar_order_guard ON domain_registrar_operations(order_id) WHERE state<>'NOT_APPLIED';
CREATE UNIQUE INDEX IF NOT EXISTS domain_registrar_transaction_guard ON domain_registrar_operations(transaction_reference) WHERE transaction_reference IS NOT NULL;
