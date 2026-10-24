-- Additive website subscriptions. Legacy infrastructure and AI contracts are untouched.
CREATE TABLE IF NOT EXISTS website_plan_provider_plans (
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 plan_id TEXT NOT NULL CHECK(plan_id IN ('starter','growth','business','elite')),
 interval TEXT NOT NULL CHECK(interval IN ('monthly','yearly')),
 amount_kobo BIGINT NOT NULL CHECK(amount_kobo>0),
 plan_code TEXT UNIQUE,
 lease_token TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,plan_id,interval)
);
CREATE TABLE IF NOT EXISTS website_plan_checkouts (
 reference TEXT PRIMARY KEY,
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 plan_id TEXT NOT NULL CHECK(plan_id IN ('starter','growth','business','elite')),
 interval TEXT NOT NULL CHECK(interval IN ('monthly','yearly')),
 amount_kobo BIGINT NOT NULL CHECK(amount_kobo>0),
 currency TEXT NOT NULL DEFAULT 'NGN' CHECK(currency='NGN'),
 provider_plan_code TEXT,
 status TEXT NOT NULL DEFAULT 'initializing' CHECK(status IN ('initializing','ready','paid','failed')),
 authorization_url TEXT,
 terms_version TEXT NOT NULL DEFAULT 'website-2026-10-24',
 consent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS website_plan_one_checkout ON website_plan_checkouts(organization_id) WHERE status IN ('initializing','ready');
CREATE TABLE IF NOT EXISTS website_plan_subscriptions (
 organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
 plan_id TEXT NOT NULL CHECK(plan_id IN ('starter','growth','business','elite')),
 interval TEXT NOT NULL CHECK(interval IN ('monthly','yearly')),
 status TEXT NOT NULL CHECK(status IN ('active','past_due','cancelled')),
 period_end TIMESTAMPTZ NOT NULL,
 first_paid_at TIMESTAMPTZ NOT NULL,
 last_paid_at TIMESTAMPTZ NOT NULL,
 provider_plan_code TEXT NOT NULL,
 subscription_code TEXT UNIQUE,
 email_token TEXT,
 customer_code TEXT,
 cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
 next_plan_id TEXT CHECK(next_plan_id IN ('free','starter','growth','business','elite')),
 next_interval TEXT CHECK(next_interval IN ('monthly','yearly'))
);
CREATE TABLE IF NOT EXISTS website_plan_payments (
 reference TEXT PRIMARY KEY,
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 plan_id TEXT NOT NULL,
 interval TEXT NOT NULL,
 amount_kobo BIGINT NOT NULL CHECK(amount_kobo>0),
 currency TEXT NOT NULL CHECK(currency='NGN'),
 paid_at TIMESTAMPTZ NOT NULL,
 period_end TIMESTAMPTZ NOT NULL,
 provider_transaction_id TEXT NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS website_plan_payments_org ON website_plan_payments(organization_id,paid_at DESC);
CREATE TABLE IF NOT EXISTS website_plan_refund_requests (
 organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
 payment_reference TEXT NOT NULL UNIQUE REFERENCES website_plan_payments(reference),
 reason TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','processing','refunded')),
 requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
