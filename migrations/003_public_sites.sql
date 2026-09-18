-- JKTL Business — public business website (Phase 3, Stage 1)
--
-- Adds the fields needed to publish a per-tenant public site at
-- businessname.jktl.com.ng: whether it's live, a short tagline shown in the
-- hero, and a brand color used to theme the page. `subdomain` and `logo_url`
-- already exist (see 001_init.sql) and are reused as-is.

ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS tagline TEXT NOT NULL DEFAULT '';
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS theme_color TEXT NOT NULL DEFAULT '#0f6e5c';
