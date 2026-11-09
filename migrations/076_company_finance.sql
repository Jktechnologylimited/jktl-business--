-- Additive company evidence only. Existing prices, entitlements and tenant balances stay unchanged.
CREATE TABLE IF NOT EXISTS merchant_payment_attempts(
 reference text PRIMARY KEY,organization_id uuid NOT NULL REFERENCES organizations(id),invoice_id uuid NOT NULL REFERENCES invoices(id),
 principal_kobo bigint NOT NULL CHECK(principal_kobo>0),fee_kobo bigint NOT NULL CHECK(fee_kobo>=0),currency text NOT NULL DEFAULT 'NGN' CHECK(currency='NGN'),
 subaccount_code text NOT NULL,fee_bearer text NOT NULL DEFAULT 'account' CHECK(fee_bearer='account'),
 state text NOT NULL DEFAULT 'INITIALIZING' CHECK(state IN('INITIALIZING','READY','UNKNOWN','SUCCESS','FAILED','REVIEW')),
 authorization_url text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS merchant_one_checkout ON merchant_payment_attempts(invoice_id) WHERE state IN('INITIALIZING','READY','UNKNOWN');
CREATE INDEX IF NOT EXISTS merchant_attempt_org ON merchant_payment_attempts(organization_id,created_at DESC);
CREATE TABLE IF NOT EXISTS merchant_payments(
 reference text PRIMARY KEY,provider text NOT NULL DEFAULT 'paystack',provider_transaction text NOT NULL UNIQUE,
 organization_id uuid NOT NULL REFERENCES organizations(id),invoice_id uuid NOT NULL REFERENCES invoices(id),source text NOT NULL CHECK(source IN('INVOICE','WEBSITE')),
 currency text NOT NULL,mode text NOT NULL CHECK(mode IN('live','test','unknown')),
 principal_kobo bigint NOT NULL CHECK(principal_kobo>0),charged_kobo bigint NOT NULL CHECK(charged_kobo>=principal_kobo),gross_fee_kobo bigint NOT NULL CHECK(gross_fee_kobo>=0),
 processor_kobo bigint CHECK(processor_kobo>=0),split_evidenced boolean NOT NULL,applied_to_invoice boolean NOT NULL,
 settlement_status text NOT NULL DEFAULT 'UNCONFIRMED' CHECK(settlement_status IN('UNCONFIRMED','CONFIRMED')),
 paid_at timestamptz NOT NULL,verified_at timestamptz NOT NULL DEFAULT now(),created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(charged_kobo=principal_kobo+gross_fee_kobo)
);
CREATE INDEX IF NOT EXISTS merchant_payment_date ON merchant_payments(paid_at,organization_id);
CREATE TABLE IF NOT EXISTS merchant_payment_events(
 event_key text PRIMARY KEY,reference text NOT NULL REFERENCES merchant_payments(reference),kind text NOT NULL CHECK(kind IN('REFUND','DISPUTE','FEE_ADJUSTMENT','RECONCILED','PROCESSOR_COST','SPLIT_CONFIRMED','LIVE_MODE_CONFIRMED')),
 amount_kobo bigint NOT NULL DEFAULT 0 CHECK(amount_kobo>=0),fee_delta_kobo bigint CHECK(fee_delta_kobo<=0),
 evidence text NOT NULL CHECK(length(evidence) BETWEEN 5 AND 1000),actor_id text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS merchant_events_reference ON merchant_payment_events(reference,created_at);
CREATE TABLE IF NOT EXISTS company_cost_categories(
 id text PRIMARY KEY CHECK(id~'^[a-z][a-z0-9_-]{1,49}$'),name text NOT NULL CHECK(length(name) BETWEEN 2 AND 100),
 classification text NOT NULL CHECK(classification IN('DIRECT','OPEX','TAX')),enabled boolean NOT NULL DEFAULT true
);
INSERT INTO company_cost_categories(id,name,classification) VALUES
('hosting','Cloud hosting','DIRECT'),('database','Database infrastructure','DIRECT'),('storage','Object storage','DIRECT'),('ai','AI/API usage','DIRECT'),('processor','Payment processing','DIRECT'),('email','Email infrastructure','DIRECT'),('domains','Domain registration','DIRECT'),('support','Customer support','OPEX'),('team','Employees and contractors','OPEX'),('marketing','Marketing and advertising','OPEX'),('commissions','Affiliate commissions','OPEX'),('other','Other operating costs','OPEX'),('tax','Taxes','TAX') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS company_cost_entries(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),category_id text NOT NULL REFERENCES company_cost_categories(id),
 incurred_on date NOT NULL,amount_minor bigint NOT NULL CHECK(amount_minor<>0 AND abs(amount_minor)<=200000000000),currency text NOT NULL CHECK(currency~'^[A-Z]{3}$'),
 ngn_kobo bigint NOT NULL CHECK(ngn_kobo<>0 AND abs(ngn_kobo)<=200000000000),fx_rate numeric(20,8),
 economic_key text NOT NULL UNIQUE CHECK(length(economic_key) BETWEEN 5 AND 200),evidence text NOT NULL CHECK(length(evidence) BETWEEN 5 AND 1000),
 reverses_id uuid UNIQUE REFERENCES company_cost_entries(id),created_by uuid NOT NULL REFERENCES admin_users(id),created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((currency='NGN' AND ngn_kobo=amount_minor AND (fx_rate IS NULL OR fx_rate=1)) OR(currency<>'NGN' AND fx_rate>0)),
 CHECK((reverses_id IS NULL AND amount_minor>0 AND ngn_kobo>0) OR(reverses_id IS NOT NULL AND amount_minor<0 AND ngn_kobo<0))
);
CREATE INDEX IF NOT EXISTS company_cost_period ON company_cost_entries(incurred_on,category_id);
CREATE TABLE IF NOT EXISTS company_finance_periods(
 from_day date NOT NULL,to_day date NOT NULL,rev bigint NOT NULL DEFAULT 1,
 revenue_complete boolean NOT NULL DEFAULT false,direct_complete boolean NOT NULL DEFAULT false,opex_complete boolean NOT NULL DEFAULT false,tax_complete boolean NOT NULL DEFAULT false,
 evidence text NOT NULL,verified_by uuid NOT NULL REFERENCES admin_users(id),verified_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(from_day,to_day),CHECK(to_day>=from_day)
);
CREATE TABLE IF NOT EXISTS company_finance_audit(
 id bigserial PRIMARY KEY,actor_id text NOT NULL,event text NOT NULL,detail jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION company_finance_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Company financial evidence is immutable; append a compensating entry'; END $$;
DO $$ DECLARE tab text; BEGIN FOREACH tab IN ARRAY ARRAY['merchant_payments','merchant_payment_events','company_cost_entries','company_finance_audit'] LOOP
 EXECUTE format('DROP TRIGGER IF EXISTS company_finance_immutable ON %I',tab);
 EXECUTE format('CREATE TRIGGER company_finance_immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION company_finance_immutable()',tab);
END LOOP; END $$;
CREATE OR REPLACE FUNCTION merchant_quote_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.reference<>OLD.reference OR NEW.organization_id<>OLD.organization_id OR NEW.invoice_id<>OLD.invoice_id OR NEW.principal_kobo<>OLD.principal_kobo OR NEW.fee_kobo<>OLD.fee_kobo OR NEW.currency<>OLD.currency OR NEW.subaccount_code<>OLD.subaccount_code OR NEW.fee_bearer<>OLD.fee_bearer THEN RAISE EXCEPTION 'Issued checkout quotes are immutable'; END IF;RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS merchant_quote_immutable ON merchant_payment_attempts;
CREATE TRIGGER merchant_quote_immutable BEFORE UPDATE ON merchant_payment_attempts FOR EACH ROW EXECUTE FUNCTION merchant_quote_immutable();
CREATE OR REPLACE FUNCTION merchant_fee_adjustment_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE original bigint; balance bigint; prior merchant_payment_events%ROWTYPE;
BEGIN
 SELECT gross_fee_kobo INTO original FROM merchant_payments WHERE reference=NEW.reference FOR UPDATE;
 SELECT * INTO prior FROM merchant_payment_events WHERE event_key=NEW.event_key;
 IF FOUND THEN
  IF prior.reference IS DISTINCT FROM NEW.reference OR prior.kind IS DISTINCT FROM NEW.kind OR prior.amount_kobo IS DISTINCT FROM NEW.amount_kobo OR prior.fee_delta_kobo IS DISTINCT FROM NEW.fee_delta_kobo OR prior.evidence IS DISTINCT FROM NEW.evidence THEN RAISE EXCEPTION 'Conflicting financial event evidence';END IF;
  RETURN NEW;
 END IF;
 IF NEW.kind='FEE_ADJUSTMENT' THEN
  IF NEW.fee_delta_kobo IS NULL THEN RAISE EXCEPTION 'A fee adjustment requires an explicit amount';END IF;
  SELECT original+COALESCE(sum(fee_delta_kobo),0)+NEW.fee_delta_kobo INTO balance FROM merchant_payment_events WHERE reference=NEW.reference AND kind='FEE_ADJUSTMENT';
  IF balance<0 OR balance>original THEN RAISE EXCEPTION 'Fee adjustments must reconcile within the original verified fee';END IF;
 ELSIF NEW.fee_delta_kobo IS NOT NULL THEN RAISE EXCEPTION 'Only explicit fee adjustments may change fee balances'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS merchant_fee_adjustment_guard ON merchant_payment_events;
CREATE TRIGGER merchant_fee_adjustment_guard BEFORE INSERT ON merchant_payment_events FOR EACH ROW EXECUTE FUNCTION merchant_fee_adjustment_guard();
ALTER TABLE company_cost_entries ADD COLUMN IF NOT EXISTS classification text CHECK(classification IN('DIRECT','OPEX','TAX'));
CREATE OR REPLACE FUNCTION company_cost_category_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.classification<>OLD.classification AND EXISTS(SELECT 1 FROM company_cost_entries WHERE category_id=OLD.id) THEN RAISE EXCEPTION 'Used cost categories cannot change accounting classification';END IF;RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS company_cost_category_guard ON company_cost_categories;
CREATE TRIGGER company_cost_category_guard BEFORE UPDATE ON company_cost_categories FOR EACH ROW EXECUTE FUNCTION company_cost_category_guard();
CREATE OR REPLACE FUNCTION company_period_invalidate() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE doc jsonb; effective date; ref text;
BEGIN
 IF TG_OP='UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
 IF TG_OP='DELETE' THEN doc:=to_jsonb(OLD);ELSE doc:=to_jsonb(NEW);END IF;
 ref:=COALESCE(doc->>'reference',doc->>'payment_reference');
 -- Source corrections can affect older receipts through joins. Invalidate all
 -- coverage conservatively when the effective period cannot be proved locally.
 IF TG_TABLE_NAME NOT IN('merchant_payments','merchant_payment_events','company_cost_entries') THEN
  UPDATE company_finance_periods SET revenue_complete=false,direct_complete=false,opex_complete=false,tax_complete=false,rev=rev+1;
 ELSE
  effective:=COALESCE((doc->>'incurred_on')::date,((doc->>'paid_at')::timestamptz AT TIME ZONE 'Africa/Lagos')::date,(now() AT TIME ZONE 'Africa/Lagos')::date);
  IF TG_TABLE_NAME='merchant_payment_events' THEN SELECT (paid_at AT TIME ZONE 'Africa/Lagos')::date INTO effective FROM merchant_payments WHERE reference=ref;END IF;
  UPDATE company_finance_periods SET revenue_complete=false,direct_complete=false,opex_complete=false,tax_complete=false,rev=rev+1 WHERE effective BETWEEN from_day AND to_day;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE tab text; BEGIN FOREACH tab IN ARRAY ARRAY['merchant_payments','merchant_payment_events','company_cost_entries','growth_acquisition_costs','website_plan_payments','website_plan_refund_requests','domain_payments','email_orders','custom_invoice_payments','custom_invoices','domain_orders','growth_legacy_payments','distribution_product_costs','distribution_payment_risks','distribution_risk_state','distribution_payouts'] LOOP
 IF to_regclass('public.'||tab) IS NOT NULL THEN
 EXECUTE format('DROP TRIGGER IF EXISTS company_period_invalidate ON %I',tab);
 EXECUTE format('CREATE TRIGGER company_period_invalidate AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION company_period_invalidate()',tab);
 END IF;
END LOOP; END $$;
CREATE TABLE IF NOT EXISTS growth_campaigns(
 id text PRIMARY KEY CHECK(id~'^[a-z0-9][a-z0-9_-]{1,79}$'),name text NOT NULL,utm_source text NOT NULL,utm_medium text NOT NULL,utm_campaign text NOT NULL,enabled boolean NOT NULL DEFAULT true,UNIQUE(utm_source,utm_medium,utm_campaign)
);
ALTER TABLE growth_visits ADD COLUMN IF NOT EXISTS campaign_id text REFERENCES growth_campaigns(id);
CREATE TABLE IF NOT EXISTS growth_funnel_events(
 event_key text PRIMARY KEY,organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,visit_id uuid REFERENCES growth_visits(id) ON DELETE SET NULL,
 stage text NOT NULL CHECK(stage IN('gallery_visit','template_preview','template_selected','registration_started','registration_completed','website_creation_started','website_content_added','website_published','paid_plan_viewed','checkout_started','subscription_paid')),
 origin text NOT NULL CHECK(origin IN('CONSENTED','VERIFIED')),occurred_at timestamptz NOT NULL DEFAULT now(),CHECK(organization_id IS NOT NULL OR origin='CONSENTED')
);
CREATE UNIQUE INDEX IF NOT EXISTS growth_funnel_org_stage ON growth_funnel_events(organization_id,stage) WHERE organization_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS growth_funnel_visit_stage ON growth_funnel_events(visit_id,stage) WHERE organization_id IS NULL;
CREATE INDEX IF NOT EXISTS growth_funnel_period ON growth_funnel_events(occurred_at,stage);
CREATE TABLE IF NOT EXISTS growth_subscription_events(
 id bigserial PRIMARY KEY,organization_id uuid NOT NULL REFERENCES organizations(id),kind text NOT NULL,period_end timestamptz NOT NULL,observed_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,kind,period_end)
);
CREATE TABLE IF NOT EXISTS growth_activity_days(organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,day date NOT NULL DEFAULT (now() AT TIME ZONE 'Africa/Lagos')::date,PRIMARY KEY(organization_id,day));
CREATE INDEX IF NOT EXISTS growth_activity_period ON growth_activity_days(day,organization_id);
CREATE OR REPLACE FUNCTION company_growth_events() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE doc jsonb;old_doc jsonb;org uuid;event_stage text;document_changed boolean:=false;
BEGIN
 doc:=to_jsonb(NEW);IF TG_OP='UPDATE' THEN old_doc:=to_jsonb(OLD);ELSE old_doc:='{}';END IF;
 org:=(doc->>'organization_id')::uuid;
 IF TG_TABLE_NAME='activation_milestones' THEN event_stage:=CASE doc->>'milestone' WHEN 'registered' THEN 'registration_completed' WHEN 'template_selected' THEN 'template_selected' WHEN 'website_published' THEN 'website_published' WHEN 'website_paid' THEN 'subscription_paid' END;
 ELSIF TG_TABLE_NAME='website_plan_checkouts' THEN event_stage:='checkout_started';
 ELSIF TG_TABLE_NAME='growth_signals' THEN IF doc->>'kind'='PAID_FEATURE' THEN event_stage:='paid_plan_viewed';END IF;
 ELSIF TG_TABLE_NAME IN('business_websites','business_profiles') THEN
  IF TG_TABLE_NAME='business_websites' AND TG_OP='INSERT' OR COALESCE(old_doc->>'website_template_id','')='' AND COALESCE(doc->>'website_template_id','')<>'' THEN event_stage:='website_creation_started';
  ELSIF TG_OP='UPDATE' AND ((COALESCE(doc->'document','{}'::jsonb)<>'{}'::jsonb AND doc->'document' IS DISTINCT FROM old_doc->'document') OR (COALESCE(doc->'website_document','{}'::jsonb)<>'{}'::jsonb AND doc->'website_document' IS DISTINCT FROM old_doc->'website_document')) THEN event_stage:='website_content_added';END IF;
 ELSIF TG_TABLE_NAME='website_plan_subscriptions' THEN
  IF doc->>'status' IS DISTINCT FROM old_doc->>'status' THEN INSERT INTO growth_subscription_events(organization_id,kind,period_end) VALUES(org,doc->>'status',(doc->>'period_end')::timestamptz) ON CONFLICT DO NOTHING;END IF;
 END IF;
 IF event_stage IN('website_creation_started','website_content_added','website_published','paid_plan_viewed','checkout_started') THEN INSERT INTO growth_activity_days(organization_id) VALUES(org) ON CONFLICT DO NOTHING;END IF;
 IF event_stage IS NOT NULL THEN INSERT INTO growth_funnel_events(event_key,organization_id,stage,origin) VALUES('org:'||org::text||':'||event_stage,org,event_stage,'VERIFIED') ON CONFLICT DO NOTHING;END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE tab text; BEGIN FOREACH tab IN ARRAY ARRAY['activation_milestones','website_plan_checkouts','growth_signals','business_websites','business_profiles','website_plan_subscriptions'] LOOP
 IF to_regclass('public.'||tab) IS NOT NULL THEN EXECUTE format('DROP TRIGGER IF EXISTS company_growth_events ON %I',tab);EXECUTE format('CREATE TRIGGER company_growth_events AFTER INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION company_growth_events()',tab);END IF;
END LOOP;END $$;
CREATE TABLE IF NOT EXISTS merchant_reconciliation_issues(reference text PRIMARY KEY,provider_transaction text,reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),resolved_at timestamptz);
CREATE OR REPLACE FUNCTION company_cost_duplicate_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_cost company_cost_entries%ROWTYPE;
BEGIN SELECT * INTO old_cost FROM company_cost_entries WHERE economic_key=NEW.economic_key;
 IF FOUND AND (old_cost.amount_minor<>NEW.amount_minor OR old_cost.ngn_kobo<>NEW.ngn_kobo OR old_cost.currency<>NEW.currency OR old_cost.category_id<>NEW.category_id OR old_cost.incurred_on<>NEW.incurred_on) THEN RAISE EXCEPTION 'Existing supplier reference has different cost evidence; use a compensating entry';END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS company_cost_duplicate_guard ON company_cost_entries;
CREATE TRIGGER company_cost_duplicate_guard BEFORE INSERT ON company_cost_entries FOR EACH ROW EXECUTE FUNCTION company_cost_duplicate_guard();
CREATE TABLE IF NOT EXISTS company_finance_settings(id boolean PRIMARY KEY DEFAULT true CHECK(id),installed_at timestamptz NOT NULL DEFAULT now());
INSERT INTO company_finance_settings(id) VALUES(true) ON CONFLICT DO NOTHING;
-- Planning only. The application has no approved native website checkout fee policy.
-- This draft cannot be enabled and is never read by payment initialization.
CREATE TABLE IF NOT EXISTS company_fee_policy_drafts(
 source text PRIMARY KEY CHECK(source='WEBSITE'),fee_type text NOT NULL CHECK(fee_type IN('FIXED','PERCENTAGE')),
 fee_value bigint NOT NULL CHECK(fee_value>0),currency text NOT NULL DEFAULT 'NGN' CHECK(currency='NGN'),
 fee_bearer text NOT NULL CHECK(fee_bearer IN('PAYER','MERCHANT')),
 enabled boolean NOT NULL DEFAULT false CHECK(enabled=false),evidence text NOT NULL CHECK(length(evidence) BETWEEN 10 AND 1000),
 updated_by uuid NOT NULL REFERENCES admin_users(id),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(fee_type<>'PERCENTAGE' OR fee_value<=10000)
);
