-- Stage 1: immutable legacy snapshots and proposed policy versions. No financial
-- rows are recalculated, and no draft policy is activated by this migration.
CREATE TABLE IF NOT EXISTS distribution_policies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE,
 program text NOT NULL CHECK(program IN('AFFILIATE','PARTNER')),
 version integer NOT NULL CHECK(version>0), name text NOT NULL,
 state text NOT NULL DEFAULT 'DRAFT' CHECK(state IN('DRAFT','LEGACY_SNAPSHOT','RETIRED')),
 terms jsonb NOT NULL, created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(program,version)
);
CREATE TABLE IF NOT EXISTS distribution_enrollments (
 affiliate_id uuid PRIMARY KEY REFERENCES affiliates(id),
 policy_id uuid NOT NULL REFERENCES distribution_policies(id),
 review_required boolean NOT NULL DEFAULT true,
 legacy_terms jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS distribution_audit (
 id bigserial PRIMARY KEY, actor_id text NOT NULL, event text NOT NULL,
 policy_id uuid REFERENCES distribution_policies(id), affiliate_id uuid REFERENCES affiliates(id),
 detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO distribution_policies(code,program,version,name,state,terms,created_by)
VALUES
('legacy-affiliate-v1','AFFILIATE',1,'Existing affiliate agreements','LEGACY_SNAPSHOT','{"mode":"account_snapshot","activation":"existing_obligations_only"}','migration-038'),
('legacy-partner-v1','PARTNER',1,'Existing partner agreements','LEGACY_SNAPSHOT','{"mode":"account_snapshot","activation":"existing_obligations_only"}','migration-038'),
('proposed-affiliate-v2','AFFILIATE',2,'Proposed affiliate subscription policy','DRAFT','{"rateBps":1500,"paidMonths":12,"holdDays":30,"currency":"NGN","products":["website_subscription"],"netDefinition":"captured_less_tax_processing_refunds_chargebacks_and_third_party_costs","renewalsBeyondTerm":false,"automaticPayouts":false}','migration-038'),
('proposed-partner-v2','PARTNER',2,'Proposed referral partner subscription policy','DRAFT','{"rateBps":2000,"paidMonths":12,"holdDays":30,"currency":"NGN","products":["website_subscription"],"netDefinition":"captured_less_tax_processing_refunds_chargebacks_and_third_party_costs","renewalsBeyondTerm":false,"automaticPayouts":false,"stackWithResellerDiscount":false}','migration-038')
ON CONFLICT(code) DO NOTHING;
INSERT INTO distribution_enrollments(affiliate_id,policy_id,legacy_terms)
SELECT a.id,p.id,jsonb_build_object('commissionModel',a.commission_model,'commissionBps',a.commission_bps,'signupBonusKobo',a.signup_bonus_kobo,'subscriptionBonusKobo',a.subscription_bonus_kobo,'recurringMonthlyKobo',a.recurring_monthly_kobo,'recurringMonthsCap',a.recurring_months_cap,'partnerAgreement',a.partner_agreement,'partnerTermsConfirmed',a.partner_terms_confirmed,'status',a.status,'payoutWindow','legacy_21st')
FROM affiliates a JOIN distribution_policies p ON p.code=CASE WHEN a.programme='partner' THEN 'legacy-partner-v1' ELSE 'legacy-affiliate-v1' END
ON CONFLICT(affiliate_id) DO NOTHING;
CREATE OR REPLACE FUNCTION distribution_snapshot_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR OLD.state<>'DRAFT' THEN RAISE EXCEPTION 'Published legacy policy records are immutable'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS distribution_policy_immutable ON distribution_policies;
CREATE TRIGGER distribution_policy_immutable BEFORE UPDATE OR DELETE ON distribution_policies FOR EACH ROW EXECUTE FUNCTION distribution_snapshot_immutable();
CREATE OR REPLACE FUNCTION distribution_enrollment_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR NEW.affiliate_id<>OLD.affiliate_id OR NEW.policy_id<>OLD.policy_id OR NEW.legacy_terms<>OLD.legacy_terms THEN RAISE EXCEPTION 'Legacy enrollment snapshots cannot be rewritten'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS distribution_enrollment_snapshot ON distribution_enrollments;
CREATE TRIGGER distribution_enrollment_snapshot BEFORE UPDATE OR DELETE ON distribution_enrollments FOR EACH ROW EXECUTE FUNCTION distribution_enrollment_immutable();
INSERT INTO feature_registry(slug,name,category,route,description) VALUES
('affiliates','JKTL Affiliates','Distribution','/affiliates','The affiliate referral programme.'),
('partners','JKTL Partners','Distribution','/partners','Professional partner programme.') ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION distribution_capture_enrollment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO distribution_enrollments(affiliate_id,policy_id,legacy_terms)
 SELECT NEW.id,p.id,jsonb_build_object('commissionModel',NEW.commission_model,'commissionBps',NEW.commission_bps,'signupBonusKobo',NEW.signup_bonus_kobo,'subscriptionBonusKobo',NEW.subscription_bonus_kobo,'recurringMonthlyKobo',NEW.recurring_monthly_kobo,'recurringMonthsCap',NEW.recurring_months_cap,'partnerAgreement',NEW.partner_agreement,'partnerTermsConfirmed',NEW.partner_terms_confirmed,'status',NEW.status,'payoutWindow','legacy_21st')
 FROM distribution_policies p WHERE p.code=CASE WHEN NEW.programme='partner' THEN 'legacy-partner-v1' ELSE 'legacy-affiliate-v1' END
 ON CONFLICT(affiliate_id) DO NOTHING;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS distribution_capture_new_enrollment ON affiliates;
CREATE TRIGGER distribution_capture_new_enrollment AFTER INSERT ON affiliates FOR EACH ROW EXECUTE FUNCTION distribution_capture_enrollment();
