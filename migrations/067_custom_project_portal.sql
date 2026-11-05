-- Extends the existing custom invoice and support stores. No customer contracts are repriced.
ALTER TABLE custom_invoices ALTER COLUMN service_id DROP NOT NULL;
ALTER TABLE custom_invoices DROP CONSTRAINT IF EXISTS custom_invoices_status_check;
ALTER TABLE custom_invoices ADD CONSTRAINT custom_invoices_status_check CHECK(status IN('DRAFT','OPEN','PAID','VOID'));
ALTER TABLE custom_invoices ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE custom_invoices ADD COLUMN IF NOT EXISTS invoice_number text;
CREATE UNIQUE INDEX IF NOT EXISTS custom_invoice_number ON custom_invoices(invoice_number) WHERE invoice_number IS NOT NULL;
ALTER TABLE custom_invoices ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'NGN' CHECK(currency='NGN');
ALTER TABLE custom_invoices ADD COLUMN IF NOT EXISTS issued_at timestamptz;
ALTER TABLE custom_invoices ADD COLUMN IF NOT EXISTS line_items jsonb NOT NULL DEFAULT '[]';
ALTER TABLE custom_invoices ADD COLUMN IF NOT EXISTS instalments jsonb NOT NULL DEFAULT '[]';
ALTER TABLE custom_invoices ADD COLUMN IF NOT EXISTS paid_kobo bigint NOT NULL DEFAULT 0 CHECK(paid_kobo>=0);
ALTER TABLE custom_invoices ADD COLUMN IF NOT EXISTS payment_review boolean NOT NULL DEFAULT false;
ALTER TABLE custom_invoices ADD COLUMN IF NOT EXISTS customer_name text NOT NULL DEFAULT '';
ALTER TABLE custom_invoices ADD COLUMN IF NOT EXISTS project_name text NOT NULL DEFAULT '';
-- Only existing settled legacy invoices receive this one-time backfill.
UPDATE custom_invoices SET paid_kobo=amount_kobo WHERE version=1 AND status='PAID' AND paid_kobo=0;
ALTER TABLE custom_projects ADD COLUMN IF NOT EXISTS portal_enabled boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS custom_project_owners(
 project_id uuid NOT NULL, organization_id uuid NOT NULL, user_id uuid NOT NULL REFERENCES users(id),
 local_subject text NOT NULL CHECK(length(local_subject) BETWEEN 1 AND 200),
 scopes text[] NOT NULL, active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(project_id,local_subject), FOREIGN KEY(project_id,organization_id) REFERENCES custom_projects(id,organization_id)
);
CREATE TABLE IF NOT EXISTS custom_project_keys(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL,organization_id uuid NOT NULL,
 key_hash text NOT NULL UNIQUE,label text NOT NULL,scopes text[] NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),revoked_at timestamptz,
 FOREIGN KEY(project_id,organization_id) REFERENCES custom_projects(id,organization_id)
);
CREATE TABLE IF NOT EXISTS custom_project_nonces(
 key_id uuid NOT NULL REFERENCES custom_project_keys(id),nonce text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(key_id,nonce)
);
CREATE TABLE IF NOT EXISTS custom_invoice_payments(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),invoice_id uuid NOT NULL REFERENCES custom_invoices(id),
 reference text NOT NULL UNIQUE,amount_kobo bigint NOT NULL CHECK(amount_kobo>0),
 currency text NOT NULL DEFAULT 'NGN' CHECK(currency='NGN'),billing_email text NOT NULL,
 state text NOT NULL CHECK(state IN('initializing','ready','unknown','failed','success')),
 authorization_url text,provider_transaction text UNIQUE,verified_at timestamptz,
 refunded_kobo bigint NOT NULL DEFAULT 0 CHECK(refunded_kobo>=0 AND refunded_kobo<=amount_kobo),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS custom_invoice_one_pending ON custom_invoice_payments(invoice_id) WHERE state IN('initializing','ready','unknown');
CREATE TABLE IF NOT EXISTS custom_invoice_refunds(
 provider_refund text PRIMARY KEY,payment_id uuid NOT NULL REFERENCES custom_invoice_payments(id),amount_kobo bigint NOT NULL CHECK(amount_kobo>0),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS custom_invoice_project_due ON custom_invoices(project_id,due_on);
CREATE OR REPLACE FUNCTION protect_custom_invoice() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.version=2 AND OLD.status<>'DRAFT' AND (NEW.amount_kobo<>OLD.amount_kobo OR NEW.line_items<>OLD.line_items OR NEW.instalments<>OLD.instalments OR NEW.due_on<>OLD.due_on OR NEW.organization_id<>OLD.organization_id OR NEW.project_id<>OLD.project_id OR NEW.customer_name<>OLD.customer_name OR NEW.project_name<>OLD.project_name OR NEW.invoice_number IS DISTINCT FROM OLD.invoice_number OR NEW.currency<>OLD.currency OR NEW.version<>OLD.version OR NEW.issued_at IS DISTINCT FROM OLD.issued_at OR NEW.status='DRAFT') THEN
  RAISE EXCEPTION 'Issued invoices are immutable; void and replace with an auditable invoice';
 END IF;
 IF NEW.status='VOID' AND (NEW.paid_kobo>0 OR EXISTS(SELECT 1 FROM custom_invoice_payments WHERE invoice_id=OLD.id AND (state IN('initializing','ready','unknown','review') OR state='success' AND refunded_kobo<amount_kobo))) THEN RAISE EXCEPTION 'Reconcile payments before voiding'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS custom_invoice_immutable ON custom_invoices;
CREATE TRIGGER custom_invoice_immutable BEFORE UPDATE ON custom_invoices FOR EACH ROW EXECUTE FUNCTION protect_custom_invoice();

ALTER TABLE custom_outbox ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES custom_projects(id);
-- Shared support engine attachments, stored privately; no external blob service.
ALTER TABLE support_cases ADD COLUMN IF NOT EXISTS attachment_bytes integer NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS support_case_attachments(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid NOT NULL REFERENCES support_cases(id),organization_id uuid NOT NULL REFERENCES organizations(id),
 actor_id uuid NOT NULL REFERENCES users(id),file_name text NOT NULL,mime text NOT NULL,size integer NOT NULL CHECK(size BETWEEN 1 AND 524288),body text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_attachment_case ON support_case_attachments(case_id);
ALTER TABLE custom_projects ADD COLUMN IF NOT EXISTS portal_return_path text NOT NULL DEFAULT '/admin/billing';
ALTER TABLE custom_invoice_payments DROP CONSTRAINT IF EXISTS custom_invoice_payments_state_check;
ALTER TABLE custom_invoice_payments ADD CONSTRAINT custom_invoice_payments_state_check CHECK(state IN('initializing','ready','unknown','failed','success','review'));
CREATE UNIQUE INDEX IF NOT EXISTS custom_project_one_active_key ON custom_project_keys(project_id) WHERE revoked_at IS NULL;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='custom_invoice_project_tenant') THEN
  ALTER TABLE custom_invoices ADD CONSTRAINT custom_invoice_project_tenant FOREIGN KEY(project_id,organization_id) REFERENCES custom_projects(id,organization_id);
 END IF;
END $$;
