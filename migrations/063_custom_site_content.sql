-- JKTL-managed content for independent client websites. No client DB credentials.
CREATE TABLE IF NOT EXISTS custom_site_content (
 project_id uuid PRIMARY KEY, organization_id uuid NOT NULL,
 revision integer NOT NULL CHECK(revision>0),
 draft jsonb NOT NULL CHECK(jsonb_typeof(draft)='object'),
 published jsonb CHECK(published IS NULL OR jsonb_typeof(published)='object'),
 audit jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(audit)='array' AND jsonb_array_length(audit)<=100),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(project_id,organization_id) REFERENCES custom_projects(id,organization_id)
);
CREATE TABLE IF NOT EXISTS custom_site_media (
 id uuid PRIMARY KEY, project_id uuid NOT NULL, organization_id uuid NOT NULL,
 content_type text NOT NULL CHECK(content_type IN('image/png','image/jpeg','image/webp')),
 data bytea NOT NULL CHECK(octet_length(data) BETWEEN 12 AND 3145728),
 uploaded_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(project_id,organization_id) REFERENCES custom_projects(id,organization_id)
);
CREATE INDEX IF NOT EXISTS custom_site_media_project ON custom_site_media(project_id,created_at);
