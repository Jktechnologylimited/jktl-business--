-- JKTL AI Booking Agent & Missed-Call Revenue Recovery (the "intercept
-- pipeline"). Everything in this file exists to make one flow work and be
-- auditable end to end:
--
--   patient calls clinic line  ->  busy / unanswered
--     -> Termii voice webhook  -> this backend
--       -> outbound SMS with a tracking link
--         -> patient opens /chat?id=<session>&phone=<msisdn>
--           -> DeepSeek-backed agent books the appointment
--
-- Design notes, all deliberate:
--
--   * Nothing here stores a running wallet balance. `comm_wallet_settings`
--     holds only the org's *configuration* (thresholds, per-unit costs) and
--     `comm_wallet_transactions` is the append-only ledger; balance is
--     always SUM(amount_kobo). Same invariant the affiliate program uses
--     (migration 012) and for the same reason: a stored counter can drift
--     from its own history, and a ledger can't. `balance_after_kobo` is
--     kept alongside each row purely as an audit trail of what the balance
--     was believed to be at the time of the write — never read as truth.
--
--   * Money is BIGINT kobo everywhere, as in every other migration.
--
--   * Webhook replays must be harmless. Termii retries, and a retried
--     missed call would otherwise text the patient twice and bill the
--     clinic twice. Three separate guards: a partial unique index on the
--     provider's own call id, a partial unique index on
--     (organization, caller, received_at) for providers that don't send
--     one, and a partial unique index on (provider, provider_ref) on the
--     ledger for the SMS charge itself.
--
--   * `bookings.source` is added so "revenue recovered by the agent" is a
--     query, not a spreadsheet — the ROI pitch in the sales deck has to be
--     backed by a number this database can produce on demand.

-- ---------------------------------------------------------------------------
-- Per-organization configuration
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_receptionist_config (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  -- Which clinical pack governs what the agent may say. 'general' for
  -- businesses outside the three blueprint verticals. Mirrors
  -- BusinessType for the health verticals — see src/lib/ai/industry-packs.ts.
  pack_id TEXT NOT NULL DEFAULT 'general',
  -- The Termii virtual line / DID this business's calls land on. Globally
  -- unique once set — see the generated key column and index below, because
  -- uniqueness has to hold on the *number*, not on how someone typed it.
  voice_number TEXT NOT NULL DEFAULT '',
  -- Last nine digits of `voice_number` (the subscriber part of a Nigerian
  -- number, with or without +234 / a leading 0 / spaces). This is what makes
  -- "0700 000 1234", "07000001234" and "+2347000001234" the same line.
  --
  -- It exists because routing an inbound call depends on matching a webhook's
  -- number against this column: if two businesses could register the same
  -- line written differently, `findConfigByVoiceNumber` would pick whichever
  -- row happened to come first and text a patient on behalf of the wrong
  -- clinic. Enforcing uniqueness on the digits removes that possibility
  -- rather than relying on operators to type consistently.
  --
  -- Generated rather than written by the application, so it can never drift
  -- from `voice_number`.
  voice_number_key TEXT GENERATED ALWAYS AS (right(regexp_replace(voice_number, '[^0-9]', '', 'g'), 9)) STORED,
  -- Termii sender ID shown on the SMS ("JKTL" style, max 11 chars, must be
  -- pre-registered with Termii or sends are rejected).
  sms_sender_id TEXT NOT NULL DEFAULT '',
  -- Overrides the pack's default opening line when non-empty.
  greeting TEXT NOT NULL DEFAULT '',
  -- Where a red-flag escalation goes. This is the human the triage engine
  -- pings when someone describes an emergency — it is not optional in
  -- practice, and the console warns when it's empty.
  escalation_phone TEXT NOT NULL DEFAULT '',
  escalation_email TEXT NOT NULL DEFAULT '',
  triage_enabled BOOLEAN NOT NULL DEFAULT true,
  -- Whether the agent may write a booking itself. Off means it captures the
  -- request and hands off to a human instead.
  auto_book BOOLEAN NOT NULL DEFAULT true,
  -- Used by the ROI panel (and the sales calculator) to value a recovered
  -- call. Default is the ₦25,000 average consultation from the blueprint.
  average_consult_value_kobo BIGINT NOT NULL DEFAULT 2500000 CHECK (average_consult_value_kobo >= 0),
  -- Optional: only respond to missed calls inside these hours (Africa/Lagos).
  -- Empty string means always on, which is the default.
  quiet_hours_start TEXT NOT NULL DEFAULT '',
  quiet_hours_end TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Covers installations whose `ai_receptionist_config` was created before the
-- generated key column existed (the table above is skipped entirely when it
-- already exists, so the inline definition wouldn't apply).
ALTER TABLE ai_receptionist_config
  ADD COLUMN IF NOT EXISTS voice_number_key TEXT
    GENERATED ALWAYS AS (right(regexp_replace(voice_number, '[^0-9]', '', 'g'), 9)) STORED;

-- Superseded by the keyed index below. Dropped rather than left in place so
-- that a database which ran an earlier revision of this migration ends up in
-- exactly the same shape as a fresh one.
DROP INDEX IF EXISTS idx_ai_config_voice_number;

-- One line, one tenant — compared on the digits. Partial so the (very
-- common) unset '' default doesn't collide across every org.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_config_voice_number_key
  ON ai_receptionist_config(voice_number_key) WHERE voice_number_key <> '';

-- ---------------------------------------------------------------------------
-- The intercept: one row per missed call, from webhook to outcome
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS missed_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  caller_phone TEXT NOT NULL,
  -- The number the patient dialled (the clinic's virtual line). Stored
  -- rather than joined, so the history still reads correctly after a
  -- business changes its line.
  called_number TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT 'termii',
  provider_call_id TEXT NOT NULL DEFAULT '',
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 'received'    — webhook accepted, SMS not yet attempted
  -- 'sms_sent'    — outbound text handed to Termii successfully
  -- 'sms_failed'  — Termii rejected/errored (network, sender ID, DND)
  -- 'sms_blocked' — wallet too low to send; the guardrail, not an error
  -- 'chat_opened' — patient tapped the tracking link
  -- 'booked'      — agent completed a booking in the chat
  -- 'recovered'   — a booking (or sale) attributable to this call was paid
  -- 'lost'        — no response within the follow-up window
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'sms_sent', 'sms_failed', 'sms_blocked', 'chat_opened', 'booked', 'recovered', 'lost')),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  -- Set once the SMS link is opened and a chat session exists. FK added at
  -- the bottom of this file — the two tables reference each other.
  chat_session_id UUID,
  sms_body TEXT NOT NULL DEFAULT '',
  sms_units INTEGER NOT NULL DEFAULT 0 CHECK (sms_units >= 0),
  sms_cost_kobo BIGINT NOT NULL DEFAULT 0 CHECK (sms_cost_kobo >= 0),
  sms_provider_ref TEXT NOT NULL DEFAULT '',
  sms_sent_at TIMESTAMPTZ,
  sms_error TEXT NOT NULL DEFAULT '',
  -- Attribution for the ROI report: the booked slot and what it's worth.
  recovered_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  recovered_value_kobo BIGINT NOT NULL DEFAULT 0 CHECK (recovered_value_kobo >= 0),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_missed_calls_org_received ON missed_calls(organization_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_missed_calls_status ON missed_calls(organization_id, status);

-- Replay guard #1: the provider's own id, when it sends one.
CREATE UNIQUE INDEX IF NOT EXISTS idx_missed_calls_provider_ref
  ON missed_calls(provider, provider_call_id) WHERE provider_call_id <> '';
-- Replay guard #2: same caller, same org, same timestamp — catches
-- providers that omit an id, and duplicate deliveries with slightly
-- different payload shapes.
CREATE UNIQUE INDEX IF NOT EXISTS idx_missed_calls_dedupe
  ON missed_calls(organization_id, caller_phone, received_at);

-- ---------------------------------------------------------------------------
-- The conversation
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  missed_call_id UUID REFERENCES missed_calls(id) ON DELETE SET NULL,
  -- 'missed_call_sms' — the inbound half of the intercept pipeline
  -- 'website_widget'  — a visitor who opened the site's chat directly
  -- 'whatsapp'        — reserved: same agent over WhatsApp
  channel TEXT NOT NULL DEFAULT 'missed_call_sms'
    CHECK (channel IN ('missed_call_sms', 'website_widget', 'whatsapp')),
  visitor_phone TEXT NOT NULL DEFAULT '',
  -- A random id the website widget keeps in the visitor's own browser, so a
  -- patient who reloads the page (or returns tomorrow) continues the same
  -- conversation instead of starting a new session on every page view. It is
  -- a continuity token, never a credential: it grants nothing beyond reusing
  -- one conversation, and the session's own row remains authoritative.
  visitor_key TEXT NOT NULL DEFAULT '',
  visitor_name TEXT NOT NULL DEFAULT '',
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'booked', 'handed_off', 'closed', 'abandoned')),
  -- Clinical triage outcome. `escalation_rule_id` names the exact rule from
  -- the pack that fired, so an audit can answer "why did the bot stop
  -- talking?" without replaying the model's reasoning.
  escalated BOOLEAN NOT NULL DEFAULT false,
  escalation_rule_id TEXT NOT NULL DEFAULT '',
  escalation_reason TEXT NOT NULL DEFAULT '',
  escalated_at TIMESTAMPTZ,
  intent TEXT NOT NULL DEFAULT '',
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  pack_id TEXT NOT NULL DEFAULT 'general',
  model TEXT NOT NULL DEFAULT '',
  -- Token accounting, kept per-session so unit economics per booking are a
  -- query. cached_tokens_in is DeepSeek's context-cache hit count — the
  -- number that makes the 95% margin claim real rather than aspirational.
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  cached_tokens_in INTEGER NOT NULL DEFAULT 0,
  ai_cost_kobo BIGINT NOT NULL DEFAULT 0 CHECK (ai_cost_kobo >= 0),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_org_started ON ai_chat_sessions(organization_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_missed_call ON ai_chat_sessions(missed_call_id);
-- Resuming a website conversation: the most recent session for this visitor
-- within this business.
CREATE INDEX IF NOT EXISTS idx_ai_sessions_visitor
  ON ai_chat_sessions(organization_id, visitor_key, started_at DESC) WHERE visitor_key <> '';

CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  -- For role='tool': which function the model called and its arguments.
  tool_name TEXT NOT NULL DEFAULT '',
  tool_payload JSONB,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_messages_session ON ai_chat_messages(session_id, created_at);

-- Same two-table circularity as missed_calls <-> ai_chat_sessions, resolved
-- the same way: add the FK once both exist. Guarded so re-running the
-- migration (migrate.mjs re-applies every file) is a no-op.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'missed_calls_chat_session_fk') THEN
    ALTER TABLE missed_calls
      ADD CONSTRAINT missed_calls_chat_session_fk
      FOREIGN KEY (chat_session_id) REFERENCES ai_chat_sessions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- The communication wallet (pay-as-you-go guardrail)
-- ---------------------------------------------------------------------------

-- Configuration only. The balance is SUM(amount_kobo) over the ledger
-- below — never read from, or written to, this table.
CREATE TABLE IF NOT EXISTS comm_wallet_settings (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  low_balance_threshold_kobo BIGINT NOT NULL DEFAULT 225000 CHECK (low_balance_threshold_kobo >= 0),
  -- Defaults track JKTL's actual blended Termii cost; overridable per org
  -- so a reseller on different Termii pricing doesn't need a code change.
  sms_unit_cost_kobo BIGINT NOT NULL DEFAULT 450 CHECK (sms_unit_cost_kobo >= 0),
  whatsapp_unit_cost_kobo BIGINT NOT NULL DEFAULT 700 CHECK (whatsapp_unit_cost_kobo >= 0),
  -- Wallet auto-recharge. Off by default: the whole point of the guardrail
  -- is that the clinic's money, not JKTL's, absorbs network traffic.
  auto_topup_enabled BOOLEAN NOT NULL DEFAULT false,
  auto_topup_amount_kobo BIGINT NOT NULL DEFAULT 5000000 CHECK (auto_topup_amount_kobo >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comm_wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- 'topup'     — money in (Paystack or manual bank transfer, recorded)
  -- 'sms'       — outbound SMS charge
  -- 'whatsapp'  — outbound WhatsApp charge
  -- 'voice'     — inbound/outbound voice minutes
  -- 'refund'    — credit back (failed send, duplicate guard, goodwill)
  -- 'adjustment'— manual correction, requires a description
  --
  -- Note what is absent: DeepSeek token cost. That is JKTL's own cost of
  -- goods, covered by the subscription, and is recorded per session in
  -- `ai_chat_sessions.ai_cost_kobo` instead. Keeping it out of this ledger
  -- is what makes the wallet a pure communication float — the clinic's
  -- money paying for the clinic's traffic, never for JKTL's inference — and
  -- it is why high call volume cannot erode the subscription margin.
  kind TEXT NOT NULL
    CHECK (kind IN ('topup', 'sms', 'whatsapp', 'voice', 'refund', 'adjustment')),
  -- SIGNED. Positive credits the wallet, negative debits it. Summing this
  -- column is the balance, so the sign convention is the contract.
  amount_kobo BIGINT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_cost_kobo BIGINT NOT NULL DEFAULT 0 CHECK (unit_cost_kobo >= 0),
  -- Audit snapshot at insert time, not a source of truth.
  balance_after_kobo BIGINT NOT NULL,
  provider TEXT NOT NULL DEFAULT '',
  provider_ref TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  missed_call_id UUID REFERENCES missed_calls(id) ON DELETE SET NULL,
  session_id UUID REFERENCES ai_chat_sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- An 'adjustment' has to explain itself; everything else may be terse.
  CONSTRAINT comm_wallet_adjustment_needs_description
    CHECK (kind <> 'adjustment' OR description <> '')
);
CREATE INDEX IF NOT EXISTS idx_comm_wallet_org_created ON comm_wallet_transactions(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comm_wallet_kind ON comm_wallet_transactions(organization_id, kind);

-- Replay guard #3: a retried send can't double-charge. Partial, because
-- manual topups and adjustments legitimately have no provider reference.
CREATE UNIQUE INDEX IF NOT EXISTS idx_comm_wallet_provider_ref
  ON comm_wallet_transactions(provider, provider_ref) WHERE provider_ref <> '';

-- ---------------------------------------------------------------------------
-- The commercial contract (₦650,000 setup + ₦59,000/month from month 7)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_receptionist_contracts (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  -- The ₦650,000 turnkey package. Paid as six monthly instalments of
  -- ₦108,333.33 rather than upfront, so a clinic's first payment is
  -- affordable and the work already delivered is recovered over the first
  -- half-year. `setup_monthly_kobo` is the display figure; the exact
  -- schedule (which absorbs the 2 kobo of rounding) is computed by
  -- `amortize()` in src/lib/ai/pricing.ts.
  setup_fee_kobo BIGINT NOT NULL DEFAULT 65000000 CHECK (setup_fee_kobo >= 0),
  setup_months INTEGER NOT NULL DEFAULT 6 CHECK (setup_months > 0),
  setup_monthly_kobo BIGINT NOT NULL DEFAULT 10833333 CHECK (setup_monthly_kobo >= 0),
  -- When the contract began. Month 1 falls due on this date; the platform
  -- tier takes over `setup_months` later, in month 7.
  started_at TIMESTAMPTZ,
  setup_payment_ref TEXT NOT NULL DEFAULT '',
  -- The pre-allocated communication credit bundled into the package. Granted
  -- into the wallet when the contract activates (see
  -- `applyReceptionistSetup`), as a real ledger row rather than a promise.
  included_token_credit_kobo BIGINT NOT NULL DEFAULT 0 CHECK (included_token_credit_kobo >= 0),
  monthly_fee_kobo BIGINT NOT NULL DEFAULT 5900000 CHECK (monthly_fee_kobo >= 0),
  -- Month 7. Derived from started_at by `platformPhaseStart()` rather than by
  -- a trigger, so the rule lives in one testable place.
  billing_starts_at TIMESTAMPTZ,
  next_charge_at TIMESTAMPTZ,
  last_charge_at TIMESTAMPTZ,
  -- How many monthly payments have actually been collected. The schedule is
  -- driven by elapsed months, but this is what proves a payment landed — the
  -- console compares the two and flags a mismatch rather than quietly
  -- continuing to serve a clinic that stopped paying.
  charges_paid INTEGER NOT NULL DEFAULT 0 CHECK (charges_paid >= 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'past_due', 'cancelled')),
  -- Cancellation is allowed from month one: there is no minimum term and no
  -- early-exit fee. Unbilled instalments are simply never billed, which is
  -- what "cancel anytime" has to mean to be honest. `cancellationSummary()`
  -- quantifies what that writes off.
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_contracts_status ON ai_receptionist_contracts(status, next_charge_at);

-- Converges a database that ran an earlier revision of this migration, where
-- the contract began only once a ₦650,000 payment cleared.
ALTER TABLE ai_receptionist_contracts
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS setup_months INTEGER NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS setup_monthly_kobo BIGINT NOT NULL DEFAULT 10833333,
  ADD COLUMN IF NOT EXISTS last_charge_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS charges_paid INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT NOT NULL DEFAULT '';

DO $$
BEGIN
  -- Carry a legacy "setup was paid" timestamp across to the new name.
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'ai_receptionist_contracts' AND column_name = 'setup_paid_at') THEN
    EXECUTE 'UPDATE ai_receptionist_contracts SET started_at = COALESCE(started_at, setup_paid_at) WHERE setup_paid_at IS NOT NULL';
    EXECUTE 'ALTER TABLE ai_receptionist_contracts DROP COLUMN setup_paid_at';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Attribution on bookings
-- ---------------------------------------------------------------------------

-- Lets the ROI panel say "the agent booked ₦X this month" with a WHERE
-- clause instead of a heuristic join on timestamps.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'staff'
    CHECK (source IN ('staff', 'public_site', 'ai_receptionist'));
CREATE INDEX IF NOT EXISTS idx_bookings_org_source ON bookings(organization_id, source);

-- ---------------------------------------------------------------------------
-- Reporting view: wallet balance per org, one row, no drift possible
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW comm_wallet_balances AS
SELECT
  s.organization_id,
  COALESCE(SUM(t.amount_kobo), 0)::BIGINT AS balance_kobo,
  s.low_balance_threshold_kobo,
  s.sms_unit_cost_kobo,
  s.whatsapp_unit_cost_kobo,
  (COALESCE(SUM(t.amount_kobo), 0) < s.low_balance_threshold_kobo) AS is_low
FROM comm_wallet_settings s
LEFT JOIN comm_wallet_transactions t ON t.organization_id = s.organization_id
GROUP BY s.organization_id, s.low_balance_threshold_kobo, s.sms_unit_cost_kobo, s.whatsapp_unit_cost_kobo;
