-- Additive template storage. Existing websites continue using their original renderer.
ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS website_template_id TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS website_document JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS website_revision INTEGER NOT NULL DEFAULT 0;
