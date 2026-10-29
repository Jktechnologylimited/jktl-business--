-- Additive project metadata; stable UUIDs and existing billing relationships are retained.
ALTER TABLE custom_projects ADD COLUMN IF NOT EXISTS deployment_provider text NOT NULL DEFAULT '';
ALTER TABLE custom_projects ADD COLUMN IF NOT EXISTS vercel_project_ref text NOT NULL DEFAULT '';
ALTER TABLE custom_projects ADD COLUMN IF NOT EXISTS github_repository_ref text NOT NULL DEFAULT '';
ALTER TABLE custom_projects ADD COLUMN IF NOT EXISTS internal_notes text NOT NULL DEFAULT '';
ALTER TABLE custom_projects ADD COLUMN IF NOT EXISTS maintenance_agreement text NOT NULL DEFAULT '';
ALTER TABLE custom_projects ADD COLUMN IF NOT EXISTS email_service_id uuid;
ALTER TABLE custom_projects ADD COLUMN IF NOT EXISTS cms_fields text[] NOT NULL DEFAULT '{}';
ALTER TABLE custom_projects ADD COLUMN IF NOT EXISTS cms_scopes text[];
-- Backfill once. Rerunning must never re-expand a deliberately reduced permission set.
UPDATE custom_projects SET cms_scopes=CASE WHEN cms_tested_at IS NOT NULL THEN ARRAY['content:read','content:write','content:publish'] ELSE ARRAY['content:read'] END WHERE cms_scopes IS NULL;
ALTER TABLE custom_projects ALTER COLUMN cms_scopes SET DEFAULT ARRAY['content:read'];
ALTER TABLE custom_projects ALTER COLUMN cms_scopes SET NOT NULL;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='custom_project_email_tenant') THEN
  ALTER TABLE custom_projects ADD CONSTRAINT custom_project_email_tenant FOREIGN KEY(email_service_id,organization_id) REFERENCES email_services(id,organization_id);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='custom_project_cms_scopes') THEN
  ALTER TABLE custom_projects ADD CONSTRAINT custom_project_cms_scopes CHECK(cms_scopes <@ ARRAY['content:read','content:write','content:publish']::text[] AND 'content:read'=ANY(cms_scopes));
 END IF;
END $$;
ALTER TABLE custom_cms_grants ADD COLUMN IF NOT EXISTS scopes text[] NOT NULL DEFAULT ARRAY['content:read','content:write','content:publish'];
-- Reuse the existing support inbox and retain legacy custom_requests history.
ALTER TABLE support_cases ADD COLUMN IF NOT EXISTS custom_project_id uuid;
ALTER TABLE support_cases ADD COLUMN IF NOT EXISTS project_category text;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='support_custom_project_tenant') THEN
  ALTER TABLE support_cases ADD CONSTRAINT support_custom_project_tenant FOREIGN KEY(custom_project_id,organization_id) REFERENCES custom_projects(id,organization_id);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='support_custom_project_category') THEN
  ALTER TABLE support_cases ADD CONSTRAINT support_custom_project_category CHECK(project_category IS NULL OR project_category IN('WEBSITE_CONTENT','WEBSITE_TECHNICAL','DOMAIN','EMAIL','BILLING','MAINTENANCE','FEATURE_REQUEST'));
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS support_custom_project ON support_cases(custom_project_id,updated_at);

ALTER TABLE custom_invitations ADD COLUMN IF NOT EXISTS accepted_at timestamptz;
ALTER TABLE custom_invitations ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
