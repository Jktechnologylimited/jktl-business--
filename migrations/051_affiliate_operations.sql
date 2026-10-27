-- Existing accounts and earned financial records are deliberately unchanged.
CREATE TABLE IF NOT EXISTS affiliate_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,email text NOT NULL,
 policy_id uuid NOT NULL REFERENCES distribution_policies(id),terms jsonb NOT NULL,message text NOT NULL DEFAULT '',
 token_hash text NOT NULL UNIQUE,expires_at timestamptz NOT NULL DEFAULT now()+interval '30 days',
 created_by text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),sent_at timestamptz,
 accepted_at timestamptz,accepted_by uuid REFERENCES users(id),affiliate_id uuid REFERENCES affiliates(id),revoked_at timestamptz,reminded_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS affiliate_live_invitation ON affiliate_invitations(lower(email)) WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE TABLE IF NOT EXISTS affiliate_activity_settings(
 id boolean PRIMARY KEY DEFAULT true CHECK(id),warning_days int NOT NULL DEFAULT 60 CHECK(warning_days>=30),dormant_days int NOT NULL DEFAULT 90,suspend_after_days int NOT NULL DEFAULT 14 CHECK(suspend_after_days>=14),automatic_suspension boolean NOT NULL DEFAULT false,invitation_reminder_days int NOT NULL DEFAULT 7 CHECK(invitation_reminder_days BETWEEN 1 AND 29),invitation_expiry_days int NOT NULL DEFAULT 30 CHECK(invitation_expiry_days BETWEEN 2 AND 90),CHECK(invitation_expiry_days>invitation_reminder_days),
 CHECK(dormant_days>warning_days)
);
INSERT INTO affiliate_activity_settings(id) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS affiliate_activity(
 affiliate_id uuid PRIMARY KEY REFERENCES affiliates(id),state text NOT NULL DEFAULT 'ACTIVE' CHECK(state IN('ACTIVE','WARNED','DORMANT','SUSPENDED')),
 warned_at timestamptz,dormant_at timestamptz,exempt boolean NOT NULL DEFAULT true,contract_reviewed boolean NOT NULL DEFAULT false,last_qualified_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
-- Only accepted invitations join the new inactivity cohort. Legacy accounts stay exempt.
CREATE OR REPLACE FUNCTION track_affiliate_visit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO affiliate_activity(affiliate_id,last_qualified_at) SELECT NEW.affiliate_id,NEW.created_at FROM affiliates WHERE id=NEW.affiliate_id AND programme='affiliate'
 ON CONFLICT(affiliate_id) DO UPDATE SET last_qualified_at=GREATEST(affiliate_activity.last_qualified_at,excluded.last_qualified_at),warned_at=NULL,dormant_at=NULL,state=CASE WHEN affiliate_activity.state='SUSPENDED' THEN 'SUSPENDED' ELSE 'ACTIVE' END,updated_at=now();
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS affiliate_valid_visit ON distribution_referral_visits;
CREATE TRIGGER affiliate_valid_visit AFTER INSERT ON distribution_referral_visits FOR EACH ROW EXECUTE FUNCTION track_affiliate_visit();
DROP TRIGGER IF EXISTS affiliate_valid_signup ON affiliate_referrals;
CREATE TRIGGER affiliate_valid_signup AFTER INSERT ON affiliate_referrals FOR EACH ROW EXECUTE FUNCTION track_affiliate_visit();
DROP TRIGGER IF EXISTS affiliate_valid_purchase ON distribution_ledger;
CREATE TRIGGER affiliate_valid_purchase AFTER INSERT ON distribution_ledger FOR EACH ROW EXECUTE FUNCTION track_affiliate_visit();
