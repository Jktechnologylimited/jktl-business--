-- The partner programme's real commission structure.
--
-- Replaces a percentage-of-payment model with three fixed tiers:
--
--   ₦20,000  when a referred business creates an account
--   ₦40,000  when that business subscribes
--   ₦3,500   every month it stays subscribed
--
-- Which is ₦102,000 from one referral in the first year — a number that is far
-- easier to sell than "20% recurring", and one an affiliate can predict.
--
-- **The signup bonus is recorded but not payable until the referral subscribes.**
-- A fixed payment for a bare signup is farmable: create a hundred free accounts
-- and collect ₦2m for nothing. So the ₦20,000 is written as `pending` — real, and
-- shown to the affiliate — and is released at the same moment the ₦40,000 is
-- earned. The structure is exactly what was asked for; only the timing of the
-- withdrawal is guarded, and the affiliate's own dashboard says so.
--
-- Idempotency is enforced by the database, not by careful calling:
--
--   * one `signup` and one `subscription` row per (affiliate, business), so a
--     redelivered Paystack webhook cannot double-pay ₦40,000;
--   * one `recurring` row per (affiliate, business, month), so a webhook replayed
--     in the same month cannot pay ₦3,500 twice.

ALTER TABLE affiliate_earnings
  -- 'signup' | 'subscription' | 'recurring' are the tiered programme.
  -- 'welcome' is the legacy one-time bonus and 'commission' the legacy
  -- percentage, both kept so historical rows still read correctly.
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'commission'
    CHECK (kind IN ('signup', 'subscription', 'recurring', 'welcome', 'commission')),
  -- 'pending'  — earned, shown to the affiliate, not yet withdrawable
  -- 'available' — cleared for payout
  -- 'paid'      — settled by a recorded payout
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('pending', 'available', 'paid')),
  -- 'YYYY-MM' for a recurring row; empty otherwise.
  ADD COLUMN IF NOT EXISTS period_key TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS note TEXT NOT NULL DEFAULT '';

-- The double-pay guard for the two one-off tiers.
CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_earnings_once_per_business
  ON affiliate_earnings(affiliate_id, organization_id, kind)
  WHERE kind IN ('signup', 'subscription', 'welcome');

-- The double-pay guard for the recurring tier: one payment per month, ever.
CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_earnings_recurring_period
  ON affiliate_earnings(affiliate_id, organization_id, period_key)
  WHERE kind = 'recurring';

-- The balance query filters on status, so it needs an index.
CREATE INDEX IF NOT EXISTS idx_affiliate_earnings_status
  ON affiliate_earnings(affiliate_id, status);

-- Per-affiliate terms, so a partner can be on a negotiated deal without a code
-- change. The defaults are the published programme.
ALTER TABLE affiliates
  ADD COLUMN IF NOT EXISTS commission_model TEXT NOT NULL DEFAULT 'tiered'
    CHECK (commission_model IN ('tiered', 'percentage')),
  ADD COLUMN IF NOT EXISTS signup_bonus_kobo BIGINT NOT NULL DEFAULT 2000000,
  ADD COLUMN IF NOT EXISTS subscription_bonus_kobo BIGINT NOT NULL DEFAULT 4000000,
  ADD COLUMN IF NOT EXISTS recurring_monthly_kobo BIGINT NOT NULL DEFAULT 350000,
  -- When the recurring commission stops. Empty means "for as long as they stay
  -- subscribed", which is the published promise.
  ADD COLUMN IF NOT EXISTS recurring_months_cap INTEGER NOT NULL DEFAULT 0
    CHECK (recurring_months_cap >= 0);

-- Attribution needs to survive the affiliate being found by code, and the payout
-- report needs to see which referred business each earning came from.
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_org ON affiliate_referrals(organization_id);

-- The recurring run needs to find every active referral for each affiliate.
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_affiliate_active
  ON affiliate_referrals(affiliate_id);
