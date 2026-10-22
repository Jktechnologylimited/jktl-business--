-- Existing JKTL clients, distinct from cold leads.
--
-- Some businesses already bought a custom website and business email from JKTL.
-- They are not cold leads: they have paid, they know who we are, and the pitch that
-- works on them is "your platform account is ready" — not "I built you a website".
--
-- Treating them as ordinary prospects produces the worst possible email: telling a
-- client who already paid us for a website that their website is poor. So they are
-- marked, skipped by the audit and the site generator, and contacted with an
-- onboarding email instead of a cold sequence.

ALTER TABLE prospects
  -- True for a business that already has a JKTL-built custom website and/or
  -- business email. Skips the website audit and the site build, and switches the
  -- outreach copy.
  ADD COLUMN IF NOT EXISTS existing_client BOOLEAN NOT NULL DEFAULT false,
  -- The address we provisioned for them, so the invite goes somewhere they
  -- actually read rather than a scraped info@.
  ADD COLUMN IF NOT EXISTS business_email TEXT NOT NULL DEFAULT '',
  -- Set once an account is created, so the same business cannot be onboarded
  -- twice and end up with two organizations and two bills.
  ADD COLUMN IF NOT EXISTS account_organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
  -- The user we created for them, so support can find the account from the lead.
  ADD COLUMN IF NOT EXISTS account_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- The clients page lists these directly.
CREATE INDEX IF NOT EXISTS idx_prospects_existing_client
  ON prospects(existing_client) WHERE existing_client = true;

-- One account per prospect: the unique index makes a double-click, or two admins
-- working the same list, structurally unable to create two organizations.
CREATE UNIQUE INDEX IF NOT EXISTS idx_prospects_account_once
  ON prospects(account_organization_id) WHERE account_organization_id IS NOT NULL;
