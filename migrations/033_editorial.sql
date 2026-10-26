ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;
ALTER TABLE admin_users ADD CONSTRAINT admin_users_role_check CHECK (role IN ('owner','affiliate_manager','analyst','editor','support','growth_gaming_lead'));
CREATE TABLE IF NOT EXISTS jktl_publications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 kind text NOT NULL CHECK (kind IN ('blog','release')),
 title text NOT NULL,
 excerpt text NOT NULL,
 body text NOT NULL,
 cover_image text NOT NULL DEFAULT '',
 author text NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
 revision integer NOT NULL DEFAULT 1 CHECK (revision>0),
 created_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
 updated_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
 published_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jktl_publications_public ON jktl_publications(kind,published_at DESC) WHERE status='published';
