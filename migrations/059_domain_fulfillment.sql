-- Extend the existing order, not a parallel ordering/payment system.
ALTER TABLE domain_purchase_controls ADD COLUMN IF NOT EXISTS default_fulfillment_mode text NOT NULL DEFAULT 'MANUAL' CHECK(default_fulfillment_mode IN('AUTOMATIC','MANUAL'));
ALTER TABLE domain_prices ADD COLUMN IF NOT EXISTS manual_only boolean NOT NULL DEFAULT true;
ALTER TABLE domain_orders ADD COLUMN IF NOT EXISTS fulfillment_mode text NOT NULL DEFAULT 'MANUAL' CHECK(fulfillment_mode IN('AUTOMATIC','MANUAL'));
ALTER TABLE domain_orders ADD COLUMN IF NOT EXISTS fulfillment_stage text NOT NULL DEFAULT 'PENDING_PAYMENT' CHECK(fulfillment_stage IN('PENDING_PAYMENT','PAID','VERIFYING_AVAILABILITY','PENDING_REGISTRATION','REGISTERING','RECONCILIATION_REQUIRED','MANUAL_REVIEW','ACTIVE','FAILED','REFUND_PENDING','REFUNDED','CANCELLED'));
ALTER TABLE domain_orders ADD COLUMN IF NOT EXISTS fallback_reason text NOT NULL DEFAULT '';
ALTER TABLE domain_orders ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES admin_users(id);
ALTER TABLE domain_orders ADD COLUMN IF NOT EXISTS fulfillment_revision integer NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS domain_manual_queue ON domain_orders(fulfillment_stage,assigned_to,created_at) WHERE status IN('PAID','PROCESSING');
-- Preserve legacy payment/financial statuses and all existing holds. Expose
-- the more detailed fulfillment stage separately; never rewrite paid totals.
CREATE OR REPLACE FUNCTION domain_sync_fulfillment_stage() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status THEN
  IF NEW.status='PROCESSING' THEN
   IF NEW.fulfillment_stage NOT IN('VERIFYING_AVAILABILITY','PENDING_REGISTRATION','REGISTERING','RECONCILIATION_REQUIRED') THEN NEW.fulfillment_stage='MANUAL_REVIEW'; END IF;
  ELSE NEW.fulfillment_stage=NEW.status; END IF;
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS domain_fulfillment_status ON domain_orders;
CREATE TRIGGER domain_fulfillment_status BEFORE UPDATE OF status ON domain_orders FOR EACH ROW EXECUTE FUNCTION domain_sync_fulfillment_stage();
UPDATE domain_orders SET fulfillment_stage=CASE WHEN status='PROCESSING' THEN 'MANUAL_REVIEW' ELSE status END WHERE fulfillment_stage='PENDING_PAYMENT' AND status<>'PENDING_PAYMENT';
-- A stuck SUBMITTED operation is uncertain even if its worker crashed before
-- recording UNKNOWN. Never route this state into a new manual purchase.
UPDATE domain_orders o SET fulfillment_stage='RECONCILIATION_REQUIRED' WHERE status IN('PAID','PROCESSING') AND EXISTS(SELECT 1 FROM domain_registrar_operations r WHERE r.order_id=o.id AND r.state IN('SUBMITTED','UNKNOWN'));
-- Enforce safe manual completion across every existing mutation path, including
-- a concurrent operator action. Actual refund receipts remain recordable.
CREATE OR REPLACE FUNCTION domain_guard_manual_completion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN('ACTIVE','FAILED') THEN
  IF EXISTS(SELECT 1 FROM domain_registrar_operations WHERE order_id=NEW.id AND state IN('SUBMITTED','UNKNOWN')) THEN
   RAISE EXCEPTION 'The registrar outcome requires reconciliation before fulfillment or failure';
  END IF;
  IF NEW.status='ACTIVE' AND EXISTS(SELECT 1 FROM domain_registrar_operations WHERE order_id=NEW.id AND state='CONFIRMED' AND transaction_reference IS DISTINCT FROM NEW.supplier_reference) THEN
   RAISE EXCEPTION 'The registrar confirmation does not match this order';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS domain_manual_completion_guard ON domain_orders;
CREATE TRIGGER domain_manual_completion_guard BEFORE UPDATE OF status ON domain_orders FOR EACH ROW EXECUTE FUNCTION domain_guard_manual_completion();

ALTER TABLE domain_checks ADD COLUMN IF NOT EXISTS availability_status text NOT NULL DEFAULT 'UNKNOWN' CHECK(availability_status IN('REGISTERED','APPEARS_AVAILABLE','UNKNOWN','UNSUPPORTED'));
-- No existing partner receives new purchasing authority. An owner must grant
-- the new scope explicitly through the existing client-permissions screen.
DO $$
BEGIN
 IF to_regclass('public.partner_client_access') IS NOT NULL THEN
  ALTER TABLE partner_client_access DROP CONSTRAINT IF EXISTS partner_client_access_scopes_check;
  ALTER TABLE partner_client_access ADD CONSTRAINT partner_client_access_scopes_check CHECK(scopes <@ ARRAY['VIEW_ALLOWED_SERVICES','REQUEST_SERVICE_CHANGES','MANAGE_WEBSITE_CONTENT','PUBLISH_WEBSITE','PURCHASE_DOMAINS']::text[]);
 END IF;
END;
$$;
-- Refresh the manual-queue stage under the row lock, including an operation
-- that committed while the operator waited for the order lock.
CREATE OR REPLACE FUNCTION domain_guard_manual_stage() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status IN('PAID','PROCESSING') AND NEW.fulfillment_stage='MANUAL_REVIEW'
 AND EXISTS(SELECT 1 FROM domain_registrar_operations WHERE order_id=NEW.id AND state IN('SUBMITTED','UNKNOWN','CONFIRMED')) THEN
  NEW.fulfillment_stage='RECONCILIATION_REQUIRED';
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS domain_manual_stage_guard ON domain_orders;
CREATE TRIGGER domain_manual_stage_guard BEFORE UPDATE OF fulfillment_stage ON domain_orders FOR EACH ROW EXECUTE FUNCTION domain_guard_manual_stage();
