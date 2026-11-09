-- Proposed bands are seeded as an inactive draft. No existing fee/transaction is changed.
CREATE OR REPLACE FUNCTION merchant_fee_bands_valid(b jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE x jsonb;lower_bound bigint;fee bigint;previous bigint:=-1;
BEGIN
 IF jsonb_typeof(b) IS DISTINCT FROM 'array' OR jsonb_array_length(b) NOT BETWEEN 1 AND 12 THEN RETURN false;END IF;
 FOR x IN SELECT * FROM jsonb_array_elements(b) LOOP
  IF jsonb_typeof(x->'minKobo') IS DISTINCT FROM 'number' OR jsonb_typeof(x->'feeKobo') IS DISTINCT FROM 'number' OR (x->>'minKobo')!~'^\d+$' OR (x->>'feeKobo')!~'^\d+$' THEN RETURN false;END IF;
  lower_bound:=(x->>'minKobo')::bigint;fee:=(x->>'feeKobo')::bigint;
  IF lower_bound<=previous OR lower_bound>200000000000 OR fee<0 OR fee>200000000000 OR(previous=-1 AND lower_bound<>0) THEN RETURN false;END IF;
  previous:=lower_bound;
 END LOOP;RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
CREATE TABLE IF NOT EXISTS merchant_fee_policies(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),version bigserial UNIQUE,label text NOT NULL CHECK(length(label) BETWEEN 3 AND 100),
 enabled boolean NOT NULL DEFAULT true,currency text NOT NULL DEFAULT 'NGN' CHECK(currency='NGN'),
 bands jsonb NOT NULL CHECK(merchant_fee_bands_valid(bands)),sources text[] NOT NULL CHECK(sources<@ARRAY['INVOICE','WEBSITE']::text[]),
 exempt_organizations uuid[] NOT NULL DEFAULT '{}',refund_rule text NOT NULL DEFAULT 'PROVIDER_EVIDENCE' CHECK(refund_rule='PROVIDER_EVIDENCE'),
 created_by text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS merchant_fee_configuration(
 id boolean PRIMARY KEY DEFAULT true CHECK(id),active_policy_id uuid REFERENCES merchant_fee_policies(id),rev bigint NOT NULL DEFAULT 0,
 approved_by text,approved_at timestamptz,provider_evidence text,requirements_evidence text
);
INSERT INTO merchant_fee_configuration(id) VALUES(true) ON CONFLICT DO NOTHING;
INSERT INTO merchant_fee_policies(id,label,bands,sources,created_by) VALUES(
 '00000000-0000-4000-8000-000000000077','Proposed NGN buyer-paid fees',
 '[{"minKobo":0,"feeKobo":0},{"minKobo":500000,"feeKobo":10000},{"minKobo":5000000,"feeKobo":20000}]',ARRAY['INVOICE','WEBSITE'],'migration:077') ON CONFLICT(id) DO NOTHING;
DROP TRIGGER IF EXISTS merchant_fee_policy_immutable ON merchant_fee_policies;
CREATE TRIGGER merchant_fee_policy_immutable BEFORE UPDATE OR DELETE ON merchant_fee_policies FOR EACH ROW EXECUTE FUNCTION company_finance_immutable();
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS online_received_kobo bigint NOT NULL DEFAULT 0 CHECK(online_received_kobo>=0);
ALTER TABLE merchant_payment_attempts ADD COLUMN IF NOT EXISTS invoice_total_kobo bigint,ADD COLUMN IF NOT EXISTS balance_before_kobo bigint,
 ADD COLUMN IF NOT EXISTS fee_policy_id uuid REFERENCES merchant_fee_policies(id),ADD COLUMN IF NOT EXISTS fee_snapshot jsonb NOT NULL DEFAULT '{}';
ALTER TABLE merchant_payments ADD COLUMN IF NOT EXISTS fee_policy_id uuid REFERENCES merchant_fee_policies(id),ADD COLUMN IF NOT EXISTS fee_snapshot jsonb NOT NULL DEFAULT '{}';
CREATE OR REPLACE FUNCTION merchant_quote_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.reference<>OLD.reference OR NEW.organization_id<>OLD.organization_id OR NEW.invoice_id<>OLD.invoice_id OR NEW.principal_kobo<>OLD.principal_kobo OR NEW.fee_kobo<>OLD.fee_kobo OR NEW.currency<>OLD.currency OR NEW.subaccount_code<>OLD.subaccount_code OR NEW.fee_bearer<>OLD.fee_bearer OR NEW.invoice_total_kobo IS DISTINCT FROM OLD.invoice_total_kobo OR NEW.balance_before_kobo IS DISTINCT FROM OLD.balance_before_kobo OR NEW.fee_policy_id IS DISTINCT FROM OLD.fee_policy_id OR NEW.fee_snapshot IS DISTINCT FROM OLD.fee_snapshot THEN RAISE EXCEPTION 'Issued checkout quotes are immutable'; END IF;RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION merchant_invoice_credit_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.total_kobo<OLD.online_received_kobo THEN RAISE EXCEPTION 'Invoice total cannot be reduced below verified principal received';END IF;
 IF NEW.online_received_kobo<OLD.online_received_kobo OR NEW.online_received_kobo>NEW.total_kobo THEN RAISE EXCEPTION 'Verified invoice principal cannot be removed or overpaid';END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS merchant_invoice_credit_guard ON invoices;
CREATE TRIGGER merchant_invoice_credit_guard BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION merchant_invoice_credit_guard();
