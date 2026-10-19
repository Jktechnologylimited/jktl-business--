-- Three additions:
--
--  1. **Card on file for the receptionist subscription.** The contract was
--     invoice-and-remember: the console showed a "Pay month N" button and a
--     weekly email, and somebody had to press it. That is fine for a pilot and
--     useless at scale — a clinic is not going to log in every month to keep
--     its phone line answering. So the contract now stores a reusable Paystack
--     authorization, captured from any successful payment (the manual "Pay
--     month" button doubles as "add a card"), plus the card's brand and last
--     four so the billing screen can show what will be charged.
--
--  2. **A per-month charge lock.** `contract_charge_attempts` exists so that
--     charging the same month twice is *structurally* impossible rather than
--     merely unlikely. The row is claimed with an `ON CONFLICT ... WHERE
--     status <> 'charged'` before Paystack is called, so two concurrent cron
--     invocations, a retry after a timeout, or a redelivered webhook cannot
--     take a second payment for a month that has already been paid. The row
--     also keeps the attempt count and the last error, which is exactly what
--     the billing screen needs to say "we tried three times, the card was
--     declined".
--
--  3. **Nudge bookkeeping.** Automated push notifications that prompt a
--     business to finish setting something up (add a card, add a number, top
--     up) need to be sent once and then leave the person alone. `org_nudges`
--     records what was sent, how often, and when to next consider it.

-- ---------------------------------------------------------------------------
-- 1 & 2. Subscription collection
-- ---------------------------------------------------------------------------

ALTER TABLE ai_receptionist_contracts
  ADD COLUMN IF NOT EXISTS paystack_authorization_code TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS card_brand TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS card_last4 TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS card_exp_month TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS card_exp_year TEXT NOT NULL DEFAULT '',
  -- On by default: a subscription that needs reminding is a subscription that
  -- lapses. A clinic can turn it off and pay manually if it prefers.
  ADD COLUMN IF NOT EXISTS auto_charge_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_charge_error TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_charge_attempt_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS contract_charge_attempts (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- 1-based month of the contract, matching `amountForMonth()`.
  month_index INTEGER NOT NULL CHECK (month_index > 0),
  amount_kobo BIGINT NOT NULL CHECK (amount_kobo >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'charged', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  error TEXT NOT NULL DEFAULT '',
  provider_ref TEXT NOT NULL DEFAULT '',
  first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One row per month, forever. This primary key is the double-charge guard.
  PRIMARY KEY (organization_id, month_index)
);
CREATE INDEX IF NOT EXISTS idx_charge_attempts_status ON contract_charge_attempts(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_charge_attempts_org ON contract_charge_attempts(organization_id, month_index DESC);

-- ---------------------------------------------------------------------------
-- 3. Nudges
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS org_nudges (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Stable id from the catalogue in src/lib/ai/nudges.ts.
  nudge_id TEXT NOT NULL,
  sent_count INTEGER NOT NULL DEFAULT 0 CHECK (sent_count >= 0),
  first_sent_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ,
  -- Set when the condition stopped being true (they added the card, topped
  -- up), so the same nudge can fire again if it becomes true a second time.
  resolved_at TIMESTAMPTZ,
  PRIMARY KEY (organization_id, nudge_id)
);
CREATE INDEX IF NOT EXISTS idx_org_nudges_last_sent ON org_nudges(last_sent_at DESC);

-- ---------------------------------------------------------------------------
-- Invoice payment notifications
-- ---------------------------------------------------------------------------

-- `sendInvoiceEmail` and the payment receipt are the two moments a business
-- most wants to hear about, and both should reach a phone. The existing
-- notification preferences cover bookings, stock, invoices and a daily
-- summary; this adds the two payment-side switches without disturbing them.
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS invoice_sent_alerts BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS payout_alerts BOOLEAN NOT NULL DEFAULT true;
