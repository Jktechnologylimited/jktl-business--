-- New, explicitly accepted agreements only. Legacy earnings and payouts are never rewritten.
ALTER TABLE affiliates DROP CONSTRAINT IF EXISTS affiliates_commission_model_check;
ALTER TABLE affiliates ADD CONSTRAINT affiliates_commission_model_check CHECK(commission_model IN('tiered','percentage','policy'));
CREATE TABLE IF NOT EXISTS distribution_contracts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),affiliate_id uuid NOT NULL REFERENCES affiliates(id),policy_id uuid NOT NULL REFERENCES distribution_policies(id),terms jsonb NOT NULL,
 model text NOT NULL CHECK(model IN('REFERRAL','RESELLER')),status text NOT NULL DEFAULT 'OFFERED' CHECK(status IN('OFFERED','ACCEPTED','ACTIVE','SUSPENDED')),
 accepted_at timestamptz,activated_at timestamptz,created_by text NOT NULL,activated_by text,
 paid_months integer NOT NULL DEFAULT 0,last_allocation integer NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS one_current_distribution_contract ON distribution_contracts(affiliate_id) WHERE status IN('OFFERED','ACCEPTED','ACTIVE');
CREATE TABLE IF NOT EXISTS distribution_customer_periods(contract_id uuid NOT NULL REFERENCES distribution_contracts(id),organization_id uuid NOT NULL REFERENCES organizations(id),paid_months integer NOT NULL DEFAULT 0 CHECK(paid_months BETWEEN 0 AND 12),last_allocation integer NOT NULL DEFAULT 0,PRIMARY KEY(contract_id,organization_id));
CREATE TABLE IF NOT EXISTS distribution_verified_payments(reference text PRIMARY KEY REFERENCES website_plan_payments(reference),contract_id uuid NOT NULL REFERENCES distribution_contracts(id),organization_id uuid NOT NULL REFERENCES organizations(id),amount_kobo bigint NOT NULL,fees_kobo bigint NOT NULL,provider_transaction text NOT NULL UNIQUE,months integer NOT NULL CHECK(months IN(1,12)),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS distribution_ledger(reference text PRIMARY KEY REFERENCES distribution_verified_payments(reference),affiliate_id uuid NOT NULL REFERENCES affiliates(id),contract_id uuid NOT NULL REFERENCES distribution_contracts(id),organization_id uuid NOT NULL REFERENCES organizations(id),currency text NOT NULL CHECK(currency='NGN'),product text NOT NULL DEFAULT 'website_subscription',net_kobo bigint NOT NULL CHECK(net_kobo>=0),rate_bps integer NOT NULL,amount_kobo bigint NOT NULL CHECK(amount_kobo>=0),eligible_months integer NOT NULL CHECK(eligible_months BETWEEN 0 AND 12),status text NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','UNDER_REVIEW','AVAILABLE','RESERVED','PAID','REVERSED','REJECTED')),available_at timestamptz NOT NULL,payout_id uuid,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS distribution_payouts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),affiliate_id uuid NOT NULL REFERENCES affiliates(id),amount_kobo bigint NOT NULL CHECK(amount_kobo>0),currency text NOT NULL DEFAULT 'NGN' CHECK(currency='NGN'),status text NOT NULL DEFAULT 'REQUESTED' CHECK(status IN('REQUESTED','APPROVED','PAID','DECLINED')),bank_snapshot jsonb NOT NULL,bank_reference text UNIQUE,confirmed_by text,confirmed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS one_open_distribution_payout ON distribution_payouts(affiliate_id,currency) WHERE status IN('REQUESTED','APPROVED');
ALTER TABLE distribution_ledger DROP CONSTRAINT IF EXISTS distribution_ledger_payout_id_fkey;
ALTER TABLE distribution_ledger ADD CONSTRAINT distribution_ledger_payout_id_fkey FOREIGN KEY(payout_id) REFERENCES distribution_payouts(id);
CREATE TABLE IF NOT EXISTS distribution_adjustments(id bigserial PRIMARY KEY,reference text NOT NULL UNIQUE REFERENCES distribution_ledger(reference),affiliate_id uuid NOT NULL REFERENCES affiliates(id),amount_kobo bigint NOT NULL CHECK(amount_kobo<=0),reason text NOT NULL,payout_id uuid REFERENCES distribution_payouts(id),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS distribution_finance_settings(id boolean PRIMARY KEY DEFAULT true CHECK(id),minimum_payout_kobo bigint NOT NULL DEFAULT 1000000 CHECK(minimum_payout_kobo>0),payout_day int NOT NULL DEFAULT 21 CHECK(payout_day BETWEEN 1 AND 28));
INSERT INTO distribution_finance_settings(id) VALUES(true) ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION distribution_contract_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.affiliate_id<>OLD.affiliate_id OR NEW.policy_id<>OLD.policy_id OR NEW.terms<>OLD.terms OR NEW.model<>OLD.model THEN RAISE EXCEPTION 'Issued commercial terms are immutable; create a new version'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS distribution_contract_terms ON distribution_contracts;
CREATE TRIGGER distribution_contract_terms BEFORE UPDATE ON distribution_contracts FOR EACH ROW EXECUTE FUNCTION distribution_contract_immutable();
CREATE TABLE IF NOT EXISTS distribution_payment_risks(event_key text PRIMARY KEY,reference text NOT NULL,kind text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS distribution_payment_risk_reference ON distribution_payment_risks(reference);
CREATE TABLE IF NOT EXISTS distribution_risk_state(reference text PRIMARY KEY,state text NOT NULL CHECK(state IN('OPEN','REFUNDED','LOST','CLEARED')),evidence text,updated_by text,updated_at timestamptz NOT NULL DEFAULT now());
CREATE OR REPLACE FUNCTION distribution_ledger_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Commission history cannot be deleted'; END IF;
 IF NEW.reference<>OLD.reference OR NEW.affiliate_id<>OLD.affiliate_id OR NEW.contract_id<>OLD.contract_id OR NEW.organization_id<>OLD.organization_id OR NEW.currency<>OLD.currency OR NEW.product<>OLD.product OR NEW.net_kobo<>OLD.net_kobo OR NEW.rate_bps<>OLD.rate_bps OR NEW.amount_kobo<>OLD.amount_kobo OR NEW.eligible_months<>OLD.eligible_months OR NEW.created_at<>OLD.created_at THEN RAISE EXCEPTION 'Commission facts are immutable'; END IF;
 IF OLD.status IN('PAID','REVERSED','REJECTED') AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Final ledger entries require separate adjustments'; END IF;
 IF NEW.status<>OLD.status AND NOT((OLD.status='PENDING' AND NEW.status IN('UNDER_REVIEW','AVAILABLE','REVERSED','REJECTED')) OR(OLD.status='UNDER_REVIEW' AND NEW.status IN('PENDING','AVAILABLE','REVERSED','REJECTED')) OR(OLD.status='AVAILABLE' AND NEW.status IN('RESERVED','UNDER_REVIEW','REVERSED')) OR(OLD.status='RESERVED' AND NEW.status IN('PAID','AVAILABLE','UNDER_REVIEW','REVERSED'))) THEN RAISE EXCEPTION 'Invalid commission transition'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS distribution_ledger_history ON distribution_ledger;
CREATE TRIGGER distribution_ledger_history BEFORE UPDATE OR DELETE ON distribution_ledger FOR EACH ROW EXECUTE FUNCTION distribution_ledger_guard();
CREATE OR REPLACE FUNCTION distribution_payout_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Payout history cannot be deleted'; END IF;
 IF NEW.affiliate_id<>OLD.affiliate_id OR NEW.amount_kobo<>OLD.amount_kobo OR NEW.currency<>OLD.currency OR NEW.bank_snapshot<>OLD.bank_snapshot OR NEW.created_at<>OLD.created_at THEN RAISE EXCEPTION 'Payout beneficiary and amount snapshots are immutable'; END IF;
 IF OLD.status IN('PAID','DECLINED') AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Final payouts are immutable'; END IF;
 IF NEW.status<>OLD.status AND NOT(OLD.status='REQUESTED' AND NEW.status IN('APPROVED','DECLINED') OR OLD.status='APPROVED' AND NEW.status IN('PAID','DECLINED')) THEN RAISE EXCEPTION 'Invalid payout transition'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS distribution_payout_history ON distribution_payouts;
CREATE TRIGGER distribution_payout_history BEFORE UPDATE OR DELETE ON distribution_payouts FOR EACH ROW EXECUTE FUNCTION distribution_payout_guard();

CREATE INDEX IF NOT EXISTS distribution_ledger_profile_date ON distribution_ledger(affiliate_id,created_at DESC);
CREATE INDEX IF NOT EXISTS distribution_ledger_profile_status ON distribution_ledger(affiliate_id,status);
CREATE INDEX IF NOT EXISTS distribution_payout_queue ON distribution_payouts(status,created_at);
