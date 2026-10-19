-- Two additions:
--
--  1. **Free credits.** Every business gets a free communication allocation
--     before it ever tops up: the agent spends the free balance first, and
--     only once that is gone does the wallet guardrail start holding callbacks
--     back and prompting a top-up. This needs the ledger to distinguish the
--     two buckets (free vs paid) without breaking the invariant everything
--     else depends on: balance = SUM(amount_kobo).
--
--     The trick is to keep `amount_kobo` as the single signed total per row
--     and split it, so the invariant is untouched while both buckets remain
--     individually computable:
--
--       free_remaining = SUM(free_amount_kobo)
--       paid_remaining = SUM(paid_amount_kobo)
--       balance        = free_remaining + paid_remaining = SUM(amount_kobo)
--
--     A CHECK constraint enforces the split on every row, so the two views of
--     the ledger can never drift apart.
--
--  2. **The prospecting engine.** Google Maps leads (Apify / Outscraper / CSV),
--     a website audit to find the businesses with no site or a poor one, a
--     generated JKTL site for each qualified lead, and the outreach emails.
--     Prospecting runs at the platform level (admin), not inside a tenant, so
--     none of these tables carry an organization_id — except the organizations
--     a generated site creates, which are marked as prospects until claimed.

-- ---------------------------------------------------------------------------
-- 1. Free credits
-- ---------------------------------------------------------------------------

ALTER TABLE comm_wallet_transactions
  ADD COLUMN IF NOT EXISTS free_amount_kobo BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_amount_kobo BIGINT NOT NULL DEFAULT 0;

-- Rows written before this migration have no bucket information. Treating
-- them all as paid is the conservative reading: it never invents free credit
-- that a clinic wasn't promised, and it keeps the balance identical.
UPDATE comm_wallet_transactions
  SET paid_amount_kobo = amount_kobo
  WHERE free_amount_kobo = 0 AND paid_amount_kobo = 0 AND amount_kobo <> 0;

-- The two buckets must always add up to the row's own signed amount.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comm_wallet_bucket_split') THEN
    ALTER TABLE comm_wallet_transactions
      ADD CONSTRAINT comm_wallet_bucket_split
      CHECK (free_amount_kobo + paid_amount_kobo = amount_kobo);
  END IF;
END $$;

-- 'grant' is a credit that did not come from the clinic's money — the free
-- allocation, a goodwill credit, a launch promotion. Kept distinct from
-- 'topup' so revenue reporting never counts a grant as income.
ALTER TABLE comm_wallet_transactions DROP CONSTRAINT IF EXISTS comm_wallet_transactions_kind_check;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comm_wallet_kind_valid') THEN
    ALTER TABLE comm_wallet_transactions
      ADD CONSTRAINT comm_wallet_kind_valid
      CHECK (kind IN ('topup', 'grant', 'sms', 'whatsapp', 'voice', 'refund', 'adjustment'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_comm_wallet_free
  ON comm_wallet_transactions(organization_id) WHERE free_amount_kobo <> 0;

-- Per-org view of how much free credit is left, so a report can say
-- "1,200 messages of free credit left" rather than a bare balance.
--
-- `free_exhausted` needs care: zero free credit only means "used up" if there
-- was an allocation to begin with. A business that was never granted anything
-- is not exhausted, it simply started on paid balance — and telling it its
-- free credit has run out would be a lie. Hence the explicit `granted > 0`
-- test against the same aggregate, which is why this is computed in a CTE
-- rather than inline (an alias cannot be referenced in its own SELECT list).
CREATE OR REPLACE VIEW comm_wallet_buckets AS
WITH totals AS (
  SELECT
    t.organization_id,
    COALESCE(SUM(t.amount_kobo), 0)::BIGINT AS balance_kobo,
    COALESCE(SUM(t.free_amount_kobo), 0)::BIGINT AS free_kobo,
    COALESCE(SUM(t.paid_amount_kobo), 0)::BIGINT AS paid_kobo,
    COALESCE(SUM(t.amount_kobo) FILTER (WHERE t.kind = 'topup'), 0)::BIGINT AS topped_up_kobo,
    COALESCE(SUM(t.amount_kobo) FILTER (WHERE t.kind = 'grant'), 0)::BIGINT AS granted_kobo
  FROM comm_wallet_transactions t
  GROUP BY t.organization_id
)
SELECT
  s.organization_id,
  COALESCE(totals.balance_kobo, 0)::BIGINT AS balance_kobo,
  COALESCE(totals.free_kobo, 0)::BIGINT AS free_kobo,
  COALESCE(totals.paid_kobo, 0)::BIGINT AS paid_kobo,
  COALESCE(totals.topped_up_kobo, 0)::BIGINT AS topped_up_kobo,
  COALESCE(totals.granted_kobo, 0)::BIGINT AS granted_kobo,
  (COALESCE(totals.granted_kobo, 0) > 0 AND COALESCE(totals.free_kobo, 0) <= 0) AS free_exhausted
FROM comm_wallet_settings s
LEFT JOIN totals ON totals.organization_id = s.organization_id;

-- ---------------------------------------------------------------------------
-- 2. Prospecting
-- ---------------------------------------------------------------------------

-- Marks an organization that exists only because we built a prospect a
-- website. It is a real tenant — a real subdomain, a real published site —
-- with nobody signed in behind it yet, and it stays distinguishable so it
-- never appears in customer counts or revenue reporting.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS is_prospect BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('apify', 'outscraper', 'csv', 'manual')),
  -- The provider's own id for this place. Used to dedupe a re-scrape of the
  -- same search, which otherwise re-imports every business every time.
  source_ref TEXT NOT NULL DEFAULT '',
  business_name TEXT NOT NULL,
  -- Our own industry id where the provider's category maps onto one of the
  -- verticals (mens_health / aesthetics / elderly_care), else ''.
  niche TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'NG',
  website TEXT NOT NULL DEFAULT '',
  rating NUMERIC(3, 2),
  reviews INTEGER,
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  -- The audit: why this business is a lead.
  -- 'none'        — no website at all (the best lead there is)
  -- 'social_only' — a Facebook/Instagram page or a directory listing instead
  -- 'poor'        — a real site that scores badly (no mobile viewport, no
  --                 HTTPS, no way to book, slow, or abandoned)
  -- 'unreachable' — a URL that does not respond
  website_status TEXT NOT NULL DEFAULT 'unaudited'
    CHECK (website_status IN ('unaudited', 'none', 'social_only', 'poor', 'ok', 'good', 'unreachable')),
  website_score INTEGER CHECK (website_score IS NULL OR (website_score >= 0 AND website_score <= 100)),
  audit_findings JSONB,
  audited_at TIMESTAMPTZ,
  -- The generated site.
  site_organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  site_subdomain TEXT NOT NULL DEFAULT '',
  site_built_at TIMESTAMPTZ,
  -- Outreach lifecycle.
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'qualified', 'rejected', 'site_built', 'contacted', 'replied', 'converted', 'suppressed')),
  suppressed BOOLEAN NOT NULL DEFAULT false,
  -- Random, non-guessable, and the only thing an unsubscribe link carries.
  unsubscribe_token TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A re-scrape of the same search must not re-import the same business.
CREATE UNIQUE INDEX IF NOT EXISTS idx_prospects_source_ref
  ON prospects(source, source_ref) WHERE source_ref <> '';
CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status, website_status);
CREATE INDEX IF NOT EXISTS idx_prospects_niche_city ON prospects(niche, city);
CREATE UNIQUE INDEX IF NOT EXISTS idx_prospects_unsub_token
  ON prospects(unsubscribe_token) WHERE unsubscribe_token <> '';

-- One row per scrape, so a run that imports nothing is visible as a failed
-- query rather than silence.
CREATE TABLE IF NOT EXISTS prospect_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  niche TEXT NOT NULL DEFAULT '',
  query TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  requested_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  found INTEGER NOT NULL DEFAULT 0,
  imported INTEGER NOT NULL DEFAULT 0,
  duplicates INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'ok', 'failed')),
  error TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_prospect_runs_created ON prospect_runs(created_at DESC);

-- Every email actually sent, so a second send to the same business is a
-- decision rather than an accident.
CREATE TABLE IF NOT EXISTS prospect_outreach (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'resend',
  provider_ref TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  error TEXT NOT NULL DEFAULT '',
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prospect_outreach_prospect ON prospect_outreach(prospect_id);
CREATE INDEX IF NOT EXISTS idx_prospect_outreach_sent ON prospect_outreach(sent_at DESC);

-- Sender identity and the subject template, editable without a deploy. The
-- subject carries both business names, which is the whole personalisation
-- claim: "{their_business}, {my_business} built you a website".
CREATE TABLE IF NOT EXISTS outreach_settings (
  id TEXT PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  sender_business_name TEXT NOT NULL DEFAULT 'JKTL Business',
  from_email TEXT NOT NULL DEFAULT '',
  reply_to TEXT NOT NULL DEFAULT '',
  subject_template TEXT NOT NULL DEFAULT '{their_business}, {my_business} built you a website',
  -- A hard ceiling on outbound cold email per day. A lead engine that can
  -- send 500 emails in a minute is a lead engine that gets the sending domain
  -- blacklisted, so the cap is enforced server-side on every send.
  daily_send_cap INTEGER NOT NULL DEFAULT 40 CHECK (daily_send_cap > 0),
  include_audit BOOLEAN NOT NULL DEFAULT true,
  calendar_link TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO outreach_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

-- The website a prospect's generated site belongs to, so the admin view can
-- jump from lead to live preview.
ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_business_profiles_prospect ON business_profiles(prospect_id);
