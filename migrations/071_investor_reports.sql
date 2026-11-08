-- Frozen aggregate management reports; no customer records or financial mutations.
CREATE TABLE IF NOT EXISTS investor_reports(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),created_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
 generated_at timestamptz NOT NULL,from_day date NOT NULL,to_day date NOT NULL,
 payload jsonb NOT NULL,digest text NOT NULL CHECK(length(digest)=64),version integer NOT NULL DEFAULT 1,
 CHECK(to_day>=from_day)
);
CREATE INDEX IF NOT EXISTS investor_reports_generated ON investor_reports(generated_at DESC);
