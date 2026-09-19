-- Turns `infrastructure_accounts` (previously just an informational
-- display, seeded at signup but never actually billed) into the real
-- record behind the "Website & Hosting" Paystack subscription. Four
-- cycles are supported (monthly/quarterly/biannually/yearly); the app
-- gates public-website publishing on `subscription_status = 'active'` —
-- everything else in JKTL Business stays free regardless of this table.
ALTER TABLE infrastructure_accounts
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT NOT NULL DEFAULT 'yearly'
    CHECK (billing_cycle IN ('monthly', 'quarterly', 'biannually', 'yearly')),
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'inactive'
    CHECK (subscription_status IN ('inactive', 'active', 'past_due', 'canceled')),
  ADD COLUMN IF NOT EXISTS price_kobo_per_cycle BIGINT NOT NULL DEFAULT 5000000,
  ADD COLUMN IF NOT EXISTS paystack_customer_code TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS paystack_subscription_code TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS paystack_email_token TEXT NOT NULL DEFAULT '';

-- Every row that already exists (from signups before this migration ran)
-- defaults to subscription_status = 'inactive' above. That's intentional —
-- nobody has actually paid for anything yet, so nobody should silently
-- become gated *or* silently be treated as a paying customer. A business
-- that already published its site before this shipped keeps working until
-- its infrastructure_accounts.renewal_date is in the past (the daily
-- renewal-reminders cron sweeps those and unpublishes them) or the owner
-- touches the Publish toggle again, whichever comes first.

-- Caches the Paystack Plan object created for each cycle (see
-- `ensurePlanCode` in src/lib/db/billing.ts) so the app provisions its own
-- Paystack plans on first use instead of requiring the business owner to
-- create them by hand in the Paystack dashboard.
CREATE TABLE IF NOT EXISTS billing_plans (
  cycle TEXT PRIMARY KEY CHECK (cycle IN ('monthly', 'quarterly', 'biannually', 'yearly')),
  paystack_plan_code TEXT NOT NULL,
  price_kobo BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Paystack redelivers webhooks (timeouts, retries), so handling one is made
-- idempotent by remembering which (event, subject) pairs already ran.
CREATE TABLE IF NOT EXISTS paystack_webhook_events (
  dedupe_key TEXT PRIMARY KEY,
  event TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
