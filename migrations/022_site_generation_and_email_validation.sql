-- Bulk website generation, email validation, and the real line-rental price.
--
-- Four things:
--
--  1. **The rental is priced in dollars, because that is how Twilio bills.**
--     $1.90 per number per month. A naira figure derived from today's rate would
--     quietly become a loss the next time the naira moves, so the dollar amount
--     is stored and the naira charge is computed at charge time. This is a
--     pass-through under Option A — a devaluation must not turn it into a
--     subsidy.
--
--  2. **Lead enrichment is kept as one JSONB blob.** Apify and Outscraper
--     already return photos, reviews, opening hours, categories and the
--     "about" text; the import was throwing all of it away and keeping only the
--     name and phone. One blob rather than fifteen columns because the shapes
--     differ between providers and change without notice, and because a single
--     jsonb parameter makes a 500-row batched insert tractable.
--
--  3. **Email validation state.** Sending 12,000 emails to unvalidated addresses
--     destroys a sending domain. Each address carries its verdict and when it
--     was reached.
--
--  4. **A generated site needs somewhere to put what it generates.** Services
--     and testimonials already have tables; gallery, hours, service areas, a
--     long-form about and FAQs had nowhere to live.

-- ---------------------------------------------------------------------------
-- 1. The line rental, in the currency it is actually billed in
-- ---------------------------------------------------------------------------

ALTER TABLE ai_receptionist_config
  -- Twilio's price for the number, in US cents. 190 = $1.90/month.
  ADD COLUMN IF NOT EXISTS line_rental_usd_cents INTEGER NOT NULL DEFAULT 190
    CHECK (line_rental_usd_cents >= 0),
  -- When the naira amount was last recalculated, so the console can show how
  -- stale the conversion is.
  ADD COLUMN IF NOT EXISTS line_rental_set_at TIMESTAMPTZ;

-- `line_rental_kobo_per_month` becomes a *cache* of the conversion rather than
-- the source of truth: the charge is recomputed from the dollar price at charge
-- time, so a rate change cannot silently make the pass-through a loss. A
-- non-zero manual value still wins, for a number on a legacy or negotiated price.
COMMENT ON COLUMN ai_receptionist_config.line_rental_kobo_per_month IS
  'Manual override of the monthly rental in kobo. Zero means derive from line_rental_usd_cents at the current USD_NGN_RATE.';

-- ---------------------------------------------------------------------------
-- 2. Lead enrichment
-- ---------------------------------------------------------------------------

ALTER TABLE prospects
  -- { photos: [], reviews: [{author, rating, text, when}], openingHours: [{day, hours}],
  --   categories: [], about: "", serviceAreas: [], products: [{name, description, price}],
  --   priceLevel: "", yearsInBusiness: null }
  ADD COLUMN IF NOT EXISTS enrichment JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- When the enrichment was extracted, so a re-import can refresh it.
  ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 3. Email validation
-- ---------------------------------------------------------------------------

ALTER TABLE prospects
  -- 'unknown'   — not checked yet
  -- 'valid'     — syntax, domain and MX all check out
  -- 'risky'     — deliverable domain, but a role address (info@) or a
  --               disposable provider: sends are allowed but treated as lower value
  -- 'invalid'   — malformed, dead domain, no mail exchanger, or known disposable
  ADD COLUMN IF NOT EXISTS email_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (email_status IN ('unknown', 'valid', 'risky', 'invalid')),
  ADD COLUMN IF NOT EXISTS email_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_check_note TEXT NOT NULL DEFAULT '';

-- The send path filters on this, so it needs an index.
CREATE INDEX IF NOT EXISTS idx_prospects_email_status
  ON prospects(email_status, status) WHERE email <> '';

-- ---------------------------------------------------------------------------
-- 4. Where generated site content lives
-- ---------------------------------------------------------------------------

ALTER TABLE business_profiles
  -- Real photographs from the business's own Google listing, so a generated site
  -- starts with its actual premises rather than stock imagery.
  ADD COLUMN IF NOT EXISTS gallery_urls TEXT[] NOT NULL DEFAULT '{}',
  -- [{ day: "Monday", hours: "9:00 AM – 6:00 PM" }] as published on their listing.
  ADD COLUMN IF NOT EXISTS opening_hours JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Neighbourhoods served, used for local search and to make the copy specific.
  ADD COLUMN IF NOT EXISTS service_areas TEXT[] NOT NULL DEFAULT '{}',
  -- The long-form about. Separate from the short intro so the homepage teaser and
  -- the about page can differ.
  ADD COLUMN IF NOT EXISTS about_long TEXT NOT NULL DEFAULT '',
  -- [{ question, answer }] — generated from what the listing actually says.
  ADD COLUMN IF NOT EXISTS faqs JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Which prospect this site was generated for, so regeneration is traceable.
  ADD COLUMN IF NOT EXISTS generated_from_prospect UUID;

-- A generated site is regenerated when the source data changes, so the link back
-- to the prospect is worth indexing.
CREATE INDEX IF NOT EXISTS idx_profiles_generated_from
  ON business_profiles(generated_from_prospect) WHERE generated_from_prospect IS NOT NULL;
