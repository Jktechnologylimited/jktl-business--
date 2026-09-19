-- Three additions to the affiliate program, all requested together:
--
-- 1. A one-time ₦2,000 "welcome bonus" per affiliate, credited (not just
--    promised) the first time a business they referred actually pays for
--    a subscription — never at approval time. This is deliberately a
--    timestamp flag (`welcome_bonus_claimed_at`), not a balance column:
--    the bonus becomes a real row in `affiliate_earnings` (see
--    `claimWelcomeBonusIfEligible` in src/lib/db/affiliates.ts), so the
--    existing "balance = SUM(earnings) - SUM(payouts), never a stored
--    counter" invariant from migration 012 still holds. The flag just
--    guards against crediting it twice.
--
-- 2. Bank details, verified through Paystack's free account-resolve
--    endpoint (same one Settings → Payments already uses for a business's
--    own payout account) so the command center has a *confirmed* account
--    to pay into, not just whatever an affiliate typed. This does NOT set
--    up automated Paystack transfers — payouts are still a manual bank
--    transfer the admin makes and records, exactly as scoped in the
--    original affiliate-program round. Verification only removes the
--    "did I copy the account number right" risk from that manual step.
--
-- 3. A payout-request lifecycle: an affiliate requests a payout (their
--    full balance, once a month) instead of just waiting for the admin to
--    notice and pay them. Requests only open once a request-window has
--    started (the 21st of the month onward — see `isPayoutWindowOpen` in
--    src/lib/db/affiliates.ts) and are capped at one per affiliate per
--    calendar month via the UNIQUE constraint on (affiliate_id,
--    window_key) below.

ALTER TABLE affiliates
  ADD COLUMN IF NOT EXISTS welcome_bonus_claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bank_code TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS account_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS account_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_verified_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  amount_kobo BIGINT NOT NULL,
  -- 'YYYY-MM' in Africa/Lagos time — one request per affiliate per
  -- calendar month, enforced by the UNIQUE constraint below rather than
  -- application-level locking (same pattern as storage_overage_charges'
  -- cycle_key from migration 013).
  window_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'paid' | 'declined'
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  UNIQUE (affiliate_id, window_key)
);
CREATE INDEX IF NOT EXISTS idx_payout_requests_affiliate ON payout_requests(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);
