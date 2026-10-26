ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS application_stage text NOT NULL DEFAULT 'PENDING' CHECK(application_stage IN('PENDING','UNDER_REVIEW','APPROVED','REJECTED','SUSPENDED','TERMINATED'));
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS application_data jsonb NOT NULL DEFAULT '{}';
UPDATE affiliates SET application_stage=CASE WHEN status='active' THEN 'APPROVED' WHEN status='suspended' THEN 'SUSPENDED' ELSE 'PENDING' END WHERE application_data='{}' AND application_stage='PENDING';
CREATE OR REPLACE FUNCTION distribution_application_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status THEN
 NEW.application_stage=CASE WHEN NEW.status='active' THEN 'APPROVED' WHEN NEW.status='suspended' THEN CASE WHEN NEW.application_stage IN('REJECTED','TERMINATED') THEN NEW.application_stage ELSE 'SUSPENDED' END ELSE 'PENDING' END;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS distribution_application_status_sync ON affiliates;
CREATE TRIGGER distribution_application_status_sync BEFORE UPDATE OF status ON affiliates FOR EACH ROW EXECUTE FUNCTION distribution_application_status();
CREATE TABLE IF NOT EXISTS distribution_assets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text NOT NULL,description text NOT NULL,url text NOT NULL,audience text NOT NULL CHECK(audience IN('AFFILIATE','PARTNER','BOTH')),enabled boolean NOT NULL DEFAULT true,created_by text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
INSERT INTO distribution_assets(id,title,description,url,audience,created_by) VALUES('10000000-1111-4111-8111-000000000001','JKTL logo','Approved JKTL brand mark. Do not change the logo or make unsupported product or earnings claims.','https://business.jktl.com.ng/jktl-logo.png','BOTH','migration-043') ON CONFLICT(id) DO NOTHING;
CREATE TABLE IF NOT EXISTS partner_commercial_quotes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_id uuid NOT NULL REFERENCES partner_service_requests(id),contract_id uuid NOT NULL REFERENCES distribution_contracts(id),amount_kobo bigint NOT NULL CHECK(amount_kobo>0 AND amount_kobo<=2000000000),currency text NOT NULL DEFAULT 'NGN' CHECK(currency='NGN'),billing_party text NOT NULL CHECK(billing_party IN('CUSTOMER','PARTNER')),scope text NOT NULL,expires_at timestamptz NOT NULL,status text NOT NULL DEFAULT 'OFFERED' CHECK(status IN('OFFERED','ACCEPTED','DECLINED','FULFILLED')),accepted_by uuid REFERENCES users(id),billing_organization_id uuid REFERENCES organizations(id),accepted_at timestamptz,fulfillment_reference text,created_by text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS one_open_partner_quote ON partner_commercial_quotes(request_id) WHERE status IN('OFFERED','ACCEPTED');
CREATE TABLE IF NOT EXISTS distribution_program_notices(id bigserial PRIMARY KEY,event_key text NOT NULL UNIQUE,affiliate_id uuid NOT NULL REFERENCES affiliates(id),subject text NOT NULL,detail text NOT NULL,path text NOT NULL,delivered_at timestamptz,attempts int NOT NULL DEFAULT 0,lease_until timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE OR REPLACE FUNCTION queue_distribution_contract_notice() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
 INSERT INTO distribution_program_notices(event_key,affiliate_id,subject,detail,path) SELECT 'contract-'||NEW.id||'-'||NEW.status,NEW.affiliate_id,'JKTL commercial agreement update','Your commercial agreement has an update. Sign in to read the exact terms and current status.',CASE WHEN a.programme='partner' THEN '/partners/commercial' ELSE '/affiliates/commercial' END FROM affiliates a WHERE a.id=NEW.affiliate_id ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS distribution_contract_notice ON distribution_contracts;
CREATE TRIGGER distribution_contract_notice AFTER INSERT OR UPDATE ON distribution_contracts FOR EACH ROW EXECUTE FUNCTION queue_distribution_contract_notice();
CREATE OR REPLACE FUNCTION queue_distribution_ledger_notice() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
 INSERT INTO distribution_program_notices(event_key,affiliate_id,subject,detail,path) SELECT 'ledger-'||NEW.reference||'-'||NEW.status,NEW.affiliate_id,'JKTL commission update','Your verified earnings ledger has an update. Sign in to review eligibility and payout status.',CASE WHEN a.programme='partner' THEN '/partners/commercial' ELSE '/affiliates/commercial' END FROM affiliates a WHERE a.id=NEW.affiliate_id ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS distribution_ledger_notice ON distribution_ledger;
CREATE TRIGGER distribution_ledger_notice AFTER INSERT OR UPDATE ON distribution_ledger FOR EACH ROW EXECUTE FUNCTION queue_distribution_ledger_notice();
CREATE OR REPLACE FUNCTION queue_distribution_payout_notice() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
 INSERT INTO distribution_program_notices(event_key,affiliate_id,subject,detail,path) SELECT 'payout-'||NEW.id||'-'||NEW.status,NEW.affiliate_id,'JKTL payout update','Your payout request has an update. Only a PAID record with a confirmed bank transfer reference represents completed payment.',CASE WHEN a.programme='partner' THEN '/partners/commercial' ELSE '/affiliates/commercial' END FROM affiliates a WHERE a.id=NEW.affiliate_id ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS distribution_payout_notice ON distribution_payouts;
CREATE TRIGGER distribution_payout_notice AFTER INSERT OR UPDATE ON distribution_payouts FOR EACH ROW EXECUTE FUNCTION queue_distribution_payout_notice();
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS applicant_message text NOT NULL DEFAULT '';
ALTER TABLE distribution_program_notices ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'PROGRAM' CHECK(audience IN('PROGRAM','STAFF'));
CREATE OR REPLACE FUNCTION queue_distribution_application_notice() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.application_stage IS DISTINCT FROM OLD.application_stage OR NEW.applicant_message IS DISTINCT FROM OLD.applicant_message THEN
 INSERT INTO distribution_program_notices(event_key,affiliate_id,subject,detail,path)
 VALUES('application-'||NEW.id||'-'||NEW.application_stage||'-'||md5(NEW.applicant_message),NEW.id,'JKTL program application update','Your application status is '||NEW.application_stage||'. '||NEW.applicant_message,CASE WHEN NEW.application_data->>'accountSource'='BUSINESS' THEN '/business/distribution' WHEN NEW.programme='partner' THEN '/partners/login' ELSE '/affiliates/login' END) ON CONFLICT DO NOTHING;
 IF TG_OP='INSERT' THEN
 INSERT INTO distribution_program_notices(event_key,affiliate_id,subject,detail,path,audience) VALUES('staff-application-'||NEW.id,NEW.id,'JKTL application needs review','A new program application is waiting for authorized review.','/admin/distribution/applications','STAFF') ON CONFLICT DO NOTHING;
 END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS distribution_application_notice ON affiliates;
CREATE TRIGGER distribution_application_notice AFTER INSERT OR UPDATE ON affiliates FOR EACH ROW EXECUTE FUNCTION queue_distribution_application_notice();
CREATE OR REPLACE FUNCTION queue_distribution_staff_review() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO distribution_program_notices(event_key,affiliate_id,subject,detail,path,audience) VALUES('staff-payout-'||NEW.id,NEW.affiliate_id,'JKTL payout review required','A commission payout request requires authorized review. No transfer has been executed.','/admin/distribution/finance','STAFF') ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS distribution_staff_payout_notice ON distribution_payouts;
CREATE TRIGGER distribution_staff_payout_notice AFTER INSERT ON distribution_payouts FOR EACH ROW EXECUTE FUNCTION queue_distribution_staff_review();
CREATE TABLE IF NOT EXISTS distribution_fraud_flags(reference text NOT NULL,reason text NOT NULL,affiliate_id uuid NOT NULL REFERENCES affiliates(id),organization_id uuid NOT NULL REFERENCES organizations(id),created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(reference,reason));
CREATE OR REPLACE FUNCTION queue_distribution_adjustment_notice() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO distribution_program_notices(event_key,affiliate_id,subject,detail,path) SELECT 'adjustment-'||NEW.reference,NEW.affiliate_id,'JKTL commission adjustment','A verified refund or dispute adjustment has been recorded separately from paid history. Sign in to review your earnings statement.',CASE WHEN a.programme='partner' THEN '/partners/commercial' ELSE '/affiliates/commercial' END FROM affiliates a WHERE a.id=NEW.affiliate_id ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS distribution_adjustment_notice ON distribution_adjustments;
CREATE TRIGGER distribution_adjustment_notice AFTER INSERT ON distribution_adjustments FOR EACH ROW EXECUTE FUNCTION queue_distribution_adjustment_notice();

CREATE INDEX IF NOT EXISTS distribution_program_notice_pending ON distribution_program_notices(created_at) WHERE delivered_at IS NULL;
ALTER TABLE partner_commercial_quotes ADD COLUMN IF NOT EXISTS payment_reference text UNIQUE;
ALTER TABLE partner_commercial_quotes ADD COLUMN IF NOT EXISTS supplier_reference text;
ALTER TABLE partner_commercial_quotes ADD COLUMN IF NOT EXISTS actual_supplier_cost_kobo bigint CHECK(actual_supplier_cost_kobo>=0 AND actual_supplier_cost_kobo<=amount_kobo);
CREATE OR REPLACE FUNCTION partner_quote_history_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Commercial quote history cannot be deleted'; END IF;
 IF NEW.request_id<>OLD.request_id OR NEW.contract_id<>OLD.contract_id OR NEW.amount_kobo<>OLD.amount_kobo OR NEW.currency<>OLD.currency OR NEW.billing_party<>OLD.billing_party OR NEW.scope<>OLD.scope OR NEW.expires_at<>OLD.expires_at THEN RAISE EXCEPTION 'Issued quote terms are immutable'; END IF;
 IF OLD.status IN('FULFILLED','DECLINED') AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Final quotes are immutable'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS partner_quote_history ON partner_commercial_quotes;
CREATE TRIGGER partner_quote_history BEFORE UPDATE OR DELETE ON partner_commercial_quotes FOR EACH ROW EXECUTE FUNCTION partner_quote_history_guard();
