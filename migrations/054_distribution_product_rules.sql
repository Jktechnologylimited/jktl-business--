-- One verified payment/commission ledger across approved product rules.
ALTER TABLE distribution_verified_payments DROP CONSTRAINT IF EXISTS distribution_verified_payments_reference_fkey;
ALTER TABLE distribution_verified_payments ADD COLUMN IF NOT EXISTS product text NOT NULL DEFAULT 'website_subscription';
ALTER TABLE distribution_verified_payments ADD COLUMN IF NOT EXISTS costs_kobo bigint NOT NULL DEFAULT 0 CHECK(costs_kobo>=0);
ALTER TABLE distribution_verified_payments ADD COLUMN IF NOT EXISTS tax_kobo bigint NOT NULL DEFAULT 0 CHECK(tax_kobo>=0);
ALTER TABLE distribution_verified_payments DROP CONSTRAINT IF EXISTS distribution_verified_payments_months_check;
ALTER TABLE distribution_verified_payments ADD CONSTRAINT distribution_verified_payments_months_check CHECK(months BETWEEN 1 AND 36);
ALTER TABLE distribution_customer_periods ADD COLUMN IF NOT EXISTS product text NOT NULL DEFAULT 'website_subscription';
ALTER TABLE distribution_customer_periods DROP CONSTRAINT IF EXISTS distribution_customer_periods_pkey;
ALTER TABLE distribution_customer_periods ADD PRIMARY KEY(contract_id,organization_id,product);
CREATE TABLE IF NOT EXISTS distribution_product_costs(reference text PRIMARY KEY,product text NOT NULL CHECK(product IN('business_email','domain_registration','custom_project')),cost_kobo bigint NOT NULL CHECK(cost_kobo>=0 AND cost_kobo<=2000000000),supplier_reference text NOT NULL,evidence text NOT NULL,verified_by text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE OR REPLACE FUNCTION distribution_payment_source_proof() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE valid boolean:=false;
BEGIN
 IF NEW.product='website_subscription' THEN
 SELECT EXISTS(SELECT 1 FROM website_plan_payments p WHERE p.reference=NEW.reference AND p.organization_id=NEW.organization_id AND p.amount_kobo=NEW.amount_kobo AND p.currency='NGN' AND p.paid_at IS NOT NULL AND p.provider_transaction_id=NEW.provider_transaction) INTO valid;
 ELSIF NEW.product='business_email' THEN
 SELECT EXISTS(SELECT 1 FROM email_orders o JOIN distribution_product_costs k ON k.reference=o.reference AND k.product=NEW.product AND k.cost_kobo=NEW.costs_kobo WHERE o.reference=NEW.reference AND o.organization_id=NEW.organization_id AND o.amount_kobo=NEW.amount_kobo AND o.provider_transaction=NEW.provider_transaction AND o.paid_at IS NOT NULL AND o.status IN('PAYMENT_CONFIRMED','AWAITING_DOMAIN_VERIFICATION','PENDING_SETUP','CONFIGURING','ACTIVE')) INTO valid;
 ELSIF NEW.product='domain_registration' THEN
 SELECT EXISTS(SELECT 1 FROM domain_orders o JOIN domain_payments p ON p.reference=o.reference JOIN distribution_product_costs k ON k.reference=o.reference AND k.product=NEW.product AND k.cost_kobo=NEW.costs_kobo WHERE o.reference=NEW.reference AND o.organization_id=NEW.organization_id AND o.amount_kobo=NEW.amount_kobo AND p.provider_transaction=NEW.provider_transaction AND p.amount_kobo=o.amount_kobo AND o.paid_at IS NOT NULL AND o.currency='NGN' AND o.refunded_kobo=0 AND o.status IN('PAID','PROCESSING','ACTIVE')) INTO valid;
 ELSIF NEW.product='custom_project' THEN
 SELECT EXISTS(SELECT 1 FROM custom_invoices o JOIN custom_projects j ON j.id=o.project_id JOIN distribution_product_costs k ON k.reference=o.reference AND k.product=NEW.product AND k.cost_kobo=NEW.costs_kobo WHERE o.reference=NEW.reference AND o.organization_id=NEW.organization_id AND o.amount_kobo=NEW.amount_kobo AND o.provider_transaction=NEW.provider_transaction AND o.paid_at IS NOT NULL AND o.status='PAID' AND j.billing_only=false AND NOT EXISTS(SELECT 1 FROM partner_commercial_quotes q WHERE q.invoice_id=o.id OR q.payment_reference=o.reference)) INTO valid;
 END IF;
 IF NOT valid THEN RAISE EXCEPTION 'Exact verified native payment and actual cost evidence required'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS distribution_payment_source ON distribution_verified_payments;
CREATE TRIGGER distribution_payment_source BEFORE INSERT ON distribution_verified_payments FOR EACH ROW EXECUTE FUNCTION distribution_payment_source_proof();
CREATE OR REPLACE FUNCTION distribution_cost_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM distribution_verified_payments WHERE reference=OLD.reference) THEN RAISE EXCEPTION 'Accrued cost evidence is immutable'; END IF;RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS distribution_cost_guard ON distribution_product_costs;
CREATE TRIGGER distribution_cost_guard BEFORE UPDATE OR DELETE ON distribution_product_costs FOR EACH ROW EXECUTE FUNCTION distribution_cost_history();
ALTER TABLE distribution_ledger DROP CONSTRAINT IF EXISTS distribution_ledger_source_identity;
ALTER TABLE distribution_verified_payments DROP CONSTRAINT IF EXISTS distribution_verified_source_identity;
ALTER TABLE distribution_verified_payments ADD CONSTRAINT distribution_verified_source_identity UNIQUE(reference,contract_id,organization_id,product);
ALTER TABLE distribution_ledger ADD CONSTRAINT distribution_ledger_source_identity FOREIGN KEY(reference,contract_id,organization_id,product) REFERENCES distribution_verified_payments(reference,contract_id,organization_id,product);
-- Preserve existing new-cohort payout settings when future defaults change.
ALTER TABLE distribution_finance_settings ADD COLUMN IF NOT EXISTS payment_day int NOT NULL DEFAULT 28 CHECK(payment_day BETWEEN 1 AND 28);
CREATE TABLE IF NOT EXISTS distribution_contract_payout_terms(contract_id uuid PRIMARY KEY REFERENCES distribution_contracts(id),minimum_kobo bigint NOT NULL,request_day int NOT NULL,payment_day int NOT NULL);
INSERT INTO distribution_contract_payout_terms(contract_id,minimum_kobo,request_day,payment_day) SELECT c.id,s.minimum_payout_kobo,s.payout_day,s.payment_day FROM distribution_contracts c CROSS JOIN distribution_finance_settings s WHERE NOT(c.terms ? 'payoutMinimumKobo') ON CONFLICT DO NOTHING;
UPDATE distribution_finance_settings SET minimum_payout_kobo=5000000 WHERE minimum_payout_kobo=1000000 AND NOT EXISTS(SELECT 1 FROM distribution_audit WHERE event='NEW_POLICY_PAYOUT_SETTINGS_CHANGED') AND NOT EXISTS(SELECT 1 FROM distribution_audit WHERE event='PAYOUT_FUTURE_DEFAULTS_054');
INSERT INTO distribution_audit(actor_id,event) SELECT 'migration-054','PAYOUT_FUTURE_DEFAULTS_054' WHERE NOT EXISTS(SELECT 1 FROM distribution_audit WHERE event='PAYOUT_FUTURE_DEFAULTS_054');
CREATE TABLE IF NOT EXISTS distribution_eligibility_pauses(id bigserial PRIMARY KEY,affiliate_id uuid NOT NULL REFERENCES affiliates(id),paused_at timestamptz NOT NULL DEFAULT now(),resumed_at timestamptz);
CREATE UNIQUE INDEX IF NOT EXISTS one_distribution_pause ON distribution_eligibility_pauses(affiliate_id) WHERE resumed_at IS NULL;
CREATE OR REPLACE FUNCTION distribution_status_period() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status='active' AND NEW.status<>'active' THEN INSERT INTO distribution_eligibility_pauses(affiliate_id) VALUES(NEW.id) ON CONFLICT DO NOTHING;
 ELSIF OLD.status<>'active' AND NEW.status='active' THEN UPDATE distribution_eligibility_pauses SET resumed_at=now() WHERE affiliate_id=NEW.id AND resumed_at IS NULL;
 END IF;RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS distribution_status_eligibility ON affiliates;
CREATE TRIGGER distribution_status_eligibility AFTER UPDATE OF status ON affiliates FOR EACH ROW EXECUTE FUNCTION distribution_status_period();
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
UPDATE affiliates a SET last_login_at=s.last_login FROM(SELECT affiliate_id,max(created_at) last_login FROM affiliate_sessions GROUP BY affiliate_id) s WHERE a.id=s.affiliate_id AND a.last_login_at IS NULL;
CREATE OR REPLACE FUNCTION distribution_record_login() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE affiliates SET last_login_at=NEW.created_at WHERE id=NEW.affiliate_id;RETURN NEW;END $$;
DROP TRIGGER IF EXISTS distribution_session_login ON affiliate_sessions;
CREATE TRIGGER distribution_session_login AFTER INSERT ON affiliate_sessions FOR EACH ROW EXECUTE FUNCTION distribution_record_login();
CREATE OR REPLACE FUNCTION prevent_duplicate_reseller_payment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='FULFILLED' AND NEW.invoice_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM custom_invoices i WHERE i.id=NEW.invoice_id AND i.status='PAID' AND i.reference=NEW.payment_reference AND i.organization_id=NEW.billing_organization_id AND i.amount_kobo=NEW.amount_kobo) THEN RAISE EXCEPTION 'Quote requires its exact verified paid invoice'; END IF;
 IF NEW.status='FULFILLED' AND EXISTS(SELECT 1 FROM distribution_ledger l WHERE l.reference=NEW.payment_reference AND l.amount_kobo>0 AND l.status NOT IN('REVERSED','REJECTED')) THEN RAISE EXCEPTION 'Referral commission and reseller discount cannot be stacked; reconcile the existing reward first'; END IF;
 RETURN NEW;
END $$;
ALTER TABLE IF EXISTS affiliate_activity ADD COLUMN IF NOT EXISTS qualified_visit_count bigint NOT NULL DEFAULT 0 CHECK(qualified_visit_count>=0);
DO $$ BEGIN
 IF to_regclass('public.affiliate_activity') IS NOT NULL THEN
 INSERT INTO affiliate_activity(affiliate_id,last_qualified_at,qualified_visit_count) SELECT v.affiliate_id,max(v.created_at),count(*) FROM distribution_referral_visits v JOIN affiliates a ON a.id=v.affiliate_id WHERE a.programme='affiliate' GROUP BY v.affiliate_id ON CONFLICT(affiliate_id) DO UPDATE SET qualified_visit_count=GREATEST(affiliate_activity.qualified_visit_count,excluded.qualified_visit_count),last_qualified_at=GREATEST(affiliate_activity.last_qualified_at,excluded.last_qualified_at);
 END IF;
END $$;
CREATE OR REPLACE FUNCTION track_affiliate_visit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO affiliate_activity(affiliate_id,last_qualified_at,qualified_visit_count) SELECT NEW.affiliate_id,NEW.created_at,CASE WHEN TG_TABLE_NAME='distribution_referral_visits' THEN 1 ELSE 0 END FROM affiliates WHERE id=NEW.affiliate_id AND programme='affiliate'
 ON CONFLICT(affiliate_id) DO UPDATE SET last_qualified_at=GREATEST(affiliate_activity.last_qualified_at,excluded.last_qualified_at),qualified_visit_count=affiliate_activity.qualified_visit_count+excluded.qualified_visit_count,warned_at=NULL,dormant_at=NULL,state=CASE WHEN affiliate_activity.state='SUSPENDED' THEN 'SUSPENDED' ELSE 'ACTIVE' END,updated_at=now();RETURN NEW;
END $$;
