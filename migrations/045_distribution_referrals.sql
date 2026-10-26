CREATE TABLE IF NOT EXISTS distribution_referral_visits(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),affiliate_id uuid NOT NULL REFERENCES affiliates(id),expires_at timestamptz NOT NULL DEFAULT now()+interval '30 days',consumed_organization_id uuid REFERENCES organizations(id),created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS distribution_visits_profile ON distribution_referral_visits(affiliate_id,created_at);
CREATE INDEX IF NOT EXISTS distribution_visits_expiry ON distribution_referral_visits(expires_at) WHERE consumed_organization_id IS NULL;
