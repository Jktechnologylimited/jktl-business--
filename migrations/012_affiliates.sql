-- Affiliate program — command-center-managed referral accounts that earn a
-- recurring commission on the Website & Hosting subscription revenue of
-- businesses that signed up through their referral link. Same isolation
-- pattern as admin_users/admin_sessions (migration 009): its own
-- credential and its own session table, no foreign key into `users` or
-- `organizations` for login purposes — an affiliate account is a third,
-- completely separate kind of login, never confusable with a business
-- account or a command-center account.
--
-- There is no public affiliate signup. An affiliate account is created
-- from the command center (Admin → Affiliates), which sets the initial
-- password directly — same reasoning as admin accounts having no public
-- signup either: this represents a real payout relationship, so it's
-- deliberately not self-service.

CREATE TABLE IF NOT EXISTS affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  referral_code TEXT NOT NULL UNIQUE,
  -- Basis points, not a percent, to avoid float rounding when computing a
  -- commission (2000 = 20%). Set per-affiliate rather than platform-wide
  -- so different agencies can be offered different rates.
  commission_bps INTEGER NOT NULL DEFAULT 2000,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'suspended'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS affiliate_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_affiliate_sessions_affiliate ON affiliate_sessions(affiliate_id);

-- One row per business that signed up through a referral link. First
-- touch wins — an organization can only ever be credited to the one
-- affiliate it signed up under (enforced by the UNIQUE on
-- organization_id) — captured at signup time from a `?ref=` code in the
-- URL (see signupAction / recordReferralIfValid).
CREATE TABLE IF NOT EXISTS affiliate_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_affiliate ON affiliate_referrals(affiliate_id);

-- A ledger, not a running balance column — an affiliate's balance is
-- always SUM(earnings) - SUM(payouts), computed on read, so it can never
-- silently drift out of sync with what actually happened. One row per
-- commission, accrued only from the Paystack webhook (the authoritative
-- side of a subscription charge — see the webhook route), never from the
-- optimistic checkout-callback path, so a single real payment can never
-- be double-counted.
CREATE TABLE IF NOT EXISTS affiliate_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_amount_kobo BIGINT NOT NULL,
  commission_kobo BIGINT NOT NULL,
  paystack_reference TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_affiliate_earnings_affiliate ON affiliate_earnings(affiliate_id);

-- Manual payout records. You pay the affiliate yourself (bank transfer)
-- and log it here so their balance reflects it — no Paystack transfer
-- integration, by design (see this round's CHECKPOINT entry).
CREATE TABLE IF NOT EXISTS affiliate_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  amount_kobo BIGINT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_affiliate ON affiliate_payouts(affiliate_id);
