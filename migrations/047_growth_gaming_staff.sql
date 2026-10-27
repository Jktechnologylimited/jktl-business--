-- Extend existing staff records; authentication remains on the linked Business user.
ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;
ALTER TABLE admin_users ADD CONSTRAINT admin_users_role_check CHECK(role IN('owner','affiliate_manager','analyst','writer','editor','support','growth_gaming_lead'));
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS business_user_id uuid UNIQUE REFERENCES users(id);
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS permission_overrides jsonb NOT NULL DEFAULT '{}';
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS staff_assigned_at timestamptz;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS staff_revoked_at timestamptz;
ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS growth_staff_identity_check;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS assigned_staff_id uuid REFERENCES admin_users(id);
CREATE INDEX IF NOT EXISTS prospects_assigned_staff ON prospects(assigned_staff_id,created_at DESC);
ALTER TABLE jktl_publications ADD COLUMN IF NOT EXISTS growth_category text CHECK(growth_category IN('marketing','social','games','community','landing'));
ALTER TABLE jktl_publications ADD COLUMN IF NOT EXISTS growth_link text NOT NULL DEFAULT '';
ALTER TABLE jktl_publications ADD COLUMN IF NOT EXISTS growth_approved_revision integer;
ALTER TABLE jktl_publications ADD COLUMN IF NOT EXISTS growth_approved_by uuid REFERENCES admin_users(id);
CREATE TABLE IF NOT EXISTS growth_application_reviews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),affiliate_id uuid NOT NULL REFERENCES affiliates(id),reviewer_id uuid NOT NULL REFERENCES admin_users(id),recommendation text NOT NULL CHECK(recommendation IN('REVIEW','APPROVE','REJECT')),note text NOT NULL,applicant_message text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS growth_application_review_profile ON growth_application_reviews(affiliate_id,created_at DESC);
