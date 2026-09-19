-- Public-website v3: social links, an "about" section, a curated font-pairing
-- choice (paired with the accent-color choice already in theme_color), photos
-- on services (products already got this in migration 006), and owner-entered
-- testimonials.

ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS about_text TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS instagram_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tiktok_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS facebook_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS snapchat_url TEXT NOT NULL DEFAULT '',
  -- One of the ids in src/lib/site-fonts.ts (a display+body Google Font
  -- pairing for the public site, chosen independently of the accent color).
  -- 'classic' — the same Cormorant Garamond/Plus Jakarta Sans pairing the
  -- dashboard itself now uses — is the default so an unmigrated/unset
  -- business still gets a deliberate, on-brand look rather than a blank id.
  ADD COLUMN IF NOT EXISTS font_pair_id TEXT NOT NULL DEFAULT 'classic';

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Owner-entered only (no public submission form / moderation queue — see
-- CHECKPOINT.md), same trust model as every other list in this app. `id` is
-- supplied by the client (same pattern as services/products) so optimistic
-- offline-outbox creates work the same way.
CREATE TABLE IF NOT EXISTS testimonials (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  quote TEXT NOT NULL,
  rating SMALLINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_testimonials_org ON testimonials(organization_id);
