-- Managed editors use the existing Business session and database, with no client secrets.
ALTER TABLE custom_projects ADD COLUMN IF NOT EXISTS managed_cms boolean NOT NULL DEFAULT false;
ALTER TABLE custom_projects ADD COLUMN IF NOT EXISTS cms_manifest jsonb NOT NULL DEFAULT '{}';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='custom_project_cms_manifest') THEN
  ALTER TABLE custom_projects ADD CONSTRAINT custom_project_cms_manifest CHECK(jsonb_typeof(cms_manifest)='object' AND octet_length(cms_manifest::text)<=500000);
 END IF;
END $$;
