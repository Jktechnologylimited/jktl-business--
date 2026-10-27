ALTER TABLE distribution_program_notices ADD COLUMN IF NOT EXISTS push_delivered_at timestamptz;
ALTER TABLE distribution_program_notices ADD COLUMN IF NOT EXISTS push_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE distribution_program_notices ADD COLUMN IF NOT EXISTS push_lease_until timestamptz;
ALTER TABLE distribution_program_notices ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'partner';
-- Introducing push must not replay historical programme notices to existing devices.
UPDATE distribution_program_notices SET push_delivered_at=now() WHERE NOT EXISTS(SELECT 1 FROM distribution_audit WHERE event='PROGRAMME_PUSH_CUTOVER_050');
INSERT INTO distribution_audit(actor_id,event) SELECT 'migration-050','PROGRAMME_PUSH_CUTOVER_050' WHERE NOT EXISTS(SELECT 1 FROM distribution_audit WHERE event='PROGRAMME_PUSH_CUTOVER_050');
CREATE INDEX IF NOT EXISTS programme_push_pending ON distribution_program_notices(id) WHERE push_delivered_at IS NULL;
ALTER TABLE partner_commercial_quotes ADD COLUMN IF NOT EXISTS invoice_id uuid UNIQUE REFERENCES custom_invoices(id);
CREATE OR REPLACE FUNCTION prevent_duplicate_reseller_payment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='FULFILLED' AND NEW.invoice_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM custom_invoices i WHERE i.id=NEW.invoice_id AND i.status='PAID' AND i.reference=NEW.payment_reference AND i.organization_id=NEW.billing_organization_id AND i.amount_kobo=NEW.amount_kobo) THEN RAISE EXCEPTION 'Quote requires its exact verified paid invoice'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS reseller_invoice_proof ON partner_commercial_quotes;
CREATE TRIGGER reseller_invoice_proof BEFORE UPDATE ON partner_commercial_quotes FOR EACH ROW EXECUTE FUNCTION prevent_duplicate_reseller_payment();
ALTER TABLE custom_projects ADD COLUMN IF NOT EXISTS billing_only boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION distribution_notice_category() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.audience='STAFF' OR NEW.event_key ~ '^(contract-|ledger-|payout-|adjustment-)' THEN NEW.category='internal'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS distribution_notice_category_trigger ON distribution_program_notices;
CREATE TRIGGER distribution_notice_category_trigger BEFORE INSERT ON distribution_program_notices FOR EACH ROW EXECUTE FUNCTION distribution_notice_category();
ALTER TABLE partner_notice_outbox ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;
ALTER TABLE partner_notice_outbox ADD COLUMN IF NOT EXISTS push_sent_at timestamptz;
-- Existing completed events remain completed; new events track each channel independently.
-- Link programme alerts to the existing Business session for assigned Growth users.
ALTER TABLE support_push_subscriptions ALTER COLUMN session_id DROP NOT NULL;
ALTER TABLE support_push_subscriptions ADD COLUMN IF NOT EXISTS business_session_id uuid REFERENCES sessions(id) ON DELETE CASCADE;
ALTER TABLE support_push_subscriptions DROP CONSTRAINT IF EXISTS support_push_identity_check;
ALTER TABLE support_push_subscriptions ADD CONSTRAINT support_push_identity_check CHECK((session_id IS NULL)<>(business_session_id IS NULL));

UPDATE distribution_program_notices SET category='internal' WHERE audience='STAFF' OR event_key ~ '^(contract-|ledger-|payout-|adjustment-)';
