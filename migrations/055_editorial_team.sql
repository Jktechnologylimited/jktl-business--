ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;
ALTER TABLE admin_users ADD CONSTRAINT admin_users_role_check CHECK(role IN('owner','affiliate_manager','analyst','writer','editor','support','growth_gaming_lead'));
ALTER TABLE jktl_publications DROP CONSTRAINT IF EXISTS jktl_publications_kind_check;
ALTER TABLE jktl_publications ADD CONSTRAINT jktl_publications_kind_check CHECK(kind IN('blog','column','release','update'));
ALTER TABLE jktl_publications DROP CONSTRAINT IF EXISTS jktl_publications_status_check;
ALTER TABLE jktl_publications ADD CONSTRAINT jktl_publications_status_check CHECK(status IN('draft','submitted','in_review','approved','published','revision_requested','scheduled','rejected','unpublished'));
ALTER TABLE jktl_publications ADD COLUMN IF NOT EXISTS subtitle text NOT NULL DEFAULT '';
ALTER TABLE jktl_publications ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT '';
ALTER TABLE jktl_publications ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]';
ALTER TABLE jktl_publications ADD COLUMN IF NOT EXISTS seo_title text NOT NULL DEFAULT '';
ALTER TABLE jktl_publications ADD COLUMN IF NOT EXISTS meta_description text NOT NULL DEFAULT '';
ALTER TABLE jktl_publications ADD COLUMN IF NOT EXISTS series_slug text NOT NULL DEFAULT '';
ALTER TABLE jktl_publications ADD COLUMN IF NOT EXISTS chapter integer;
ALTER TABLE jktl_publications ADD COLUMN IF NOT EXISTS product text NOT NULL DEFAULT '';
ALTER TABLE jktl_publications ADD COLUMN IF NOT EXISTS version_label text NOT NULL DEFAULT '';
ALTER TABLE jktl_publications ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '[]';
ALTER TABLE jktl_publications ADD COLUMN IF NOT EXISTS sensitive boolean NOT NULL DEFAULT false;
ALTER TABLE jktl_publications ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;
ALTER TABLE jktl_publications ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES admin_users(id) ON DELETE SET NULL;
ALTER TABLE jktl_publications ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES admin_users(id) ON DELETE SET NULL;
ALTER TABLE jktl_publications ADD COLUMN IF NOT EXISTS published_by uuid REFERENCES admin_users(id) ON DELETE SET NULL;
ALTER TABLE jktl_publications ADD COLUMN IF NOT EXISTS scheduled_by uuid REFERENCES admin_users(id) ON DELETE SET NULL;
ALTER TABLE jktl_publications ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
CREATE TABLE IF NOT EXISTS editorial_profiles(
 user_id uuid PRIMARY KEY REFERENCES admin_users(id) ON DELETE CASCADE,
 slug text UNIQUE NOT NULL CHECK(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 display_name text NOT NULL, bio text NOT NULL DEFAULT '',avatar_url text NOT NULL DEFAULT '',updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS editorial_categories(name text PRIMARY KEY CHECK(length(name) BETWEEN 1 AND 80));
INSERT INTO editorial_categories(name) VALUES('Business'),('Technology'),('Fiction'),('Nonfiction'),('Essays'),('Tutorials'),('Company news'),('Product news'),('Operations'),('Security'),('Billing') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS editorial_revisions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),publication_id uuid NOT NULL REFERENCES jktl_publications(id) ON DELETE CASCADE,
 revision integer NOT NULL,actor_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,snapshot jsonb NOT NULL,comment text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(publication_id,revision)
);
CREATE TABLE IF NOT EXISTS editorial_media(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),url text NOT NULL,alt text NOT NULL,created_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS editorial_notices(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),publication_id uuid REFERENCES jktl_publications(id) ON DELETE CASCADE,recipient_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
 event text NOT NULL,revision integer NOT NULL DEFAULT 0,sent_at timestamptz,attempts integer NOT NULL DEFAULT 0,next_attempt_at timestamptz NOT NULL DEFAULT now(),lease_until timestamptz,
 UNIQUE(publication_id,recipient_id,event,revision)
);
CREATE TABLE IF NOT EXISTS editorial_invitations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,token_hash text NOT NULL UNIQUE,expires_at timestamptz NOT NULL,accepted_at timestamptz,created_by uuid REFERENCES admin_users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS editorial_due ON jktl_publications(scheduled_at) WHERE status='scheduled';
CREATE UNIQUE INDEX IF NOT EXISTS editorial_series_chapter ON jktl_publications(series_slug,chapter) WHERE kind='column' AND series_slug<>'' AND chapter IS NOT NULL;
