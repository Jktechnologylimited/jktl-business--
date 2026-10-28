ALTER TABLE email_branding ADD COLUMN IF NOT EXISTS promotions_initialized_at timestamptz;
ALTER TABLE email_promotions ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
-- One-time initialization is performed atomically by the shared catalogue loader.
-- A timestamp, rather than an empty-row test, preserves deliberate empty lists.
CREATE INDEX IF NOT EXISTS email_promotions_active_order ON email_promotions(priority,id) WHERE deleted_at IS NULL;
