-- JKTL Business — migration 002
-- Adds: password reset tokens, and partial-payment/receipt tracking on sales.
-- Safe to re-run: every statement is idempotent (this project has no
-- migration-tracking table — scripts/migrate.mjs just replays every file).

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);

-- Only the SHA-256 hash of the raw token ever touches the database — the raw
-- token is emailed once and never stored, same principle as password_hash.

ALTER TABLE sales ADD COLUMN IF NOT EXISTS amount_paid_kobo BIGINT NOT NULL DEFAULT 0 CHECK (amount_paid_kobo >= 0);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS receipt_photo_url TEXT;

-- Backfill rows created before this column existed so amount_paid_kobo stays
-- consistent with payment_status (paid == fully paid; pending/partial == 0,
-- since we have no historical record of what, if anything, was paid).
UPDATE sales SET amount_paid_kobo = total_kobo WHERE payment_status = 'paid' AND amount_paid_kobo = 0;
