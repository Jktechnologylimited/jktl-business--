-- An explicitly selected support cohort, not a paid plan or permission to edit customer sites.
CREATE TABLE IF NOT EXISTS customer_care(
 organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
 cohort text NOT NULL DEFAULT 'FOUNDING_21_2026',status text NOT NULL DEFAULT 'NEEDS_CONTACT' CHECK(status IN('NEEDS_CONTACT','IN_PROGRESS','WAITING_CUSTOMER','READY','COMPLETE')),
 assigned_to uuid REFERENCES admin_users(id) ON DELETE SET NULL,follow_up_on date,
 checked_steps text[] NOT NULL DEFAULT '{}',notes text NOT NULL DEFAULT '' CHECK(length(notes)<=2000),
 revision integer NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(checked_steps <@ ARRAY['brief','branding','template','quality','domain_email_renewals','training','signoff','live','feedback']::text[])
);
CREATE TABLE IF NOT EXISTS customer_care_audit(id bigserial PRIMARY KEY,organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,actor_id text NOT NULL,event text NOT NULL,detail jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
