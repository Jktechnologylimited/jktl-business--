-- Option A: the dedicated phone line is billed to the clinic's own
-- communication wallet, exactly like messaging.
--
-- This closes the gap that has been in the model since the first version: every
-- clinic needs its own number for inbound-call routing, the number costs money
-- every month, and nobody was paying for it. JKTL was absorbing it silently,
-- which is the one thing the communication-wallet guardrail exists to prevent.
--
-- Three pieces:
--
--  1. **The line's own state on the config**, including what it costs per month
--     and which Twilio number it is, so the console can show a clinic what it is
--     paying for rather than a line item with no explanation.
--
--  2. **A ledger of rental charges, one row per month**, using the same
--     primary-key-as-lock pattern as subscription collection. A cron that runs
--     daily cannot charge two months for the same period, and a month that could
--     not be paid stays visible as `unpaid` rather than disappearing.
--
--  3. **An exclusion reason on prospects**, so a business that is already a
--     JKTL customer is skipped and *says why* — rather than being silently
--     dropped from a 12,000-row import and leaving someone to wonder.

ALTER TABLE ai_receptionist_config
  -- What the number costs the clinic per month, in kobo. Zero means unbilled
  -- (a number the clinic already owned, or a promotional line).
  ADD COLUMN IF NOT EXISTS line_rental_kobo_per_month BIGINT NOT NULL DEFAULT 0
    CHECK (line_rental_kobo_per_month >= 0),
  -- 'none'      — no dedicated line yet
  -- 'requested' — the clinic has asked for one; ops has not provisioned it
  -- 'active'    — provisioned and routing calls
  -- 'released'  — given up; the Twilio number should be released
  ADD COLUMN IF NOT EXISTS line_status TEXT NOT NULL DEFAULT 'none'
    CHECK (line_status IN ('none', 'requested', 'active', 'released')),
  -- Twilio's IncomingPhoneNumber SID, needed to release or reconfigure it.
  ADD COLUMN IF NOT EXISTS line_number_sid TEXT NOT NULL DEFAULT '',
  -- The country the number was bought in, which decides the rental and the
  -- expected dial code.
  ADD COLUMN IF NOT EXISTS line_country TEXT NOT NULL DEFAULT 'NG',
  ADD COLUMN IF NOT EXISTS line_provisioned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS line_requested_at TIMESTAMPTZ,
  -- What the clinic asked for, so ops can act on the request without a phone
  -- call: the area they want the number to look local to.
  ADD COLUMN IF NOT EXISTS line_request_note TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS line_rental_charges (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- 'YYYY-MM', so a month can only ever be charged once.
  period_key TEXT NOT NULL,
  amount_kobo BIGINT NOT NULL CHECK (amount_kobo >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'charged', 'unpaid', 'waived')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  error TEXT NOT NULL DEFAULT '',
  provider_ref TEXT NOT NULL DEFAULT '',
  charge_id UUID REFERENCES comm_wallet_transactions(id) ON DELETE SET NULL,
  first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One row per month, forever. This primary key is the double-charge guard.
  PRIMARY KEY (organization_id, period_key)
);
CREATE INDEX IF NOT EXISTS idx_line_rental_status ON line_rental_charges(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_line_rental_unpaid ON line_rental_charges(organization_id) WHERE status = 'unpaid';

-- Why a lead was skipped, so an import of thousands of rows is auditable.
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS excluded_reason TEXT NOT NULL DEFAULT '';

-- The dedupe query at import scale matches a scraped phone against an existing
-- tenant, so it needs an index. Prospects are matched on the digits-only tail.
CREATE INDEX IF NOT EXISTS idx_prospects_phone ON prospects(phone) WHERE phone <> '';
CREATE INDEX IF NOT EXISTS idx_business_profiles_phone ON business_profiles(phone) WHERE phone <> '';

-- Which affluent area a lead came from. Used to keep the outreach copy relevant
-- ("we noticed you're in Lekki") and to report which areas convert.
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS search_area TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_prospects_area ON prospects(search_area) WHERE search_area <> '';
