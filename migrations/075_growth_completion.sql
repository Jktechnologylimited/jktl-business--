-- Forward-only, optional analytics and recurring-revenue evidence. No customer balances change.
CREATE TABLE IF NOT EXISTS growth_visits(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),created_at timestamptz NOT NULL DEFAULT now(),
 last_seen_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL DEFAULT now()+interval '30 days',
 organization_id uuid UNIQUE REFERENCES organizations(id) ON DELETE SET NULL,registered_at timestamptz
);
CREATE TABLE IF NOT EXISTS growth_visit_pages(
 visit_id uuid NOT NULL REFERENCES growth_visits(id) ON DELETE CASCADE,day date NOT NULL DEFAULT (now() AT TIME ZONE 'Africa/Lagos')::date,
 path text NOT NULL CHECK(length(path)<=200),PRIMARY KEY(visit_id,day,path)
);
CREATE INDEX IF NOT EXISTS growth_visits_expiry ON growth_visits(expires_at);
CREATE TABLE IF NOT EXISTS growth_acquisition_costs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),affiliate_id uuid REFERENCES affiliates(id),
 spent_on date NOT NULL,amount_kobo bigint NOT NULL CHECK(amount_kobo>0 AND amount_kobo<=2000000000),
 evidence text NOT NULL CHECK(length(evidence) BETWEEN 5 AND 500),created_by uuid NOT NULL REFERENCES admin_users(id),
 created_at timestamptz NOT NULL DEFAULT now(),voided_at timestamptz,voided_by uuid REFERENCES admin_users(id)
);
CREATE TABLE IF NOT EXISTS growth_recurring_snapshots(
 day date PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT now(),items jsonb NOT NULL CHECK(jsonb_typeof(items)='array'),
 coverage jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS growth_signals(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN('PUBLISHED','FIRST_ENQUIRY','PAYMENT_FAILED','PAID_FEATURE')),
 source_key text NOT NULL,occurred_at timestamptz NOT NULL DEFAULT now(),UNIQUE(kind,source_key)
);
CREATE INDEX IF NOT EXISTS growth_signals_date ON growth_signals(occurred_at);
ALTER TABLE lifecycle_events ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'SETUP';
ALTER TABLE lifecycle_events ADD COLUMN IF NOT EXISTS signal_id uuid REFERENCES growth_signals(id);
ALTER TABLE lifecycle_events DROP CONSTRAINT IF EXISTS lifecycle_events_organization_id_cycle_step_key;
CREATE UNIQUE INDEX IF NOT EXISTS lifecycle_cycle_purpose ON lifecycle_events(organization_id,cycle,step,purpose);
CREATE UNIQUE INDEX IF NOT EXISTS lifecycle_signal_once ON lifecycle_events(signal_id) WHERE signal_id IS NOT NULL;
CREATE OR REPLACE FUNCTION growth_record_signal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='activation_milestones' THEN
  IF NEW.milestone='website_published' THEN
   INSERT INTO growth_signals(organization_id,kind,source_key) VALUES(NEW.organization_id,'PUBLISHED',NEW.organization_id::text) ON CONFLICT DO NOTHING;
  END IF;
 ELSIF TG_TABLE_NAME='chatbot_leads' THEN
  INSERT INTO growth_signals(organization_id,kind,source_key) VALUES(NEW.organization_id,'FIRST_ENQUIRY',NEW.organization_id::text) ON CONFLICT DO NOTHING;
 ELSIF TG_TABLE_NAME='website_plan_subscriptions' THEN
  IF NEW.status='past_due' THEN
   IF TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO growth_signals(organization_id,kind,source_key) VALUES(NEW.organization_id,'PAYMENT_FAILED',NEW.organization_id::text||':'||NEW.period_end::text) ON CONFLICT DO NOTHING;
   END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS growth_published ON activation_milestones;
CREATE TRIGGER growth_published AFTER INSERT ON activation_milestones FOR EACH ROW EXECUTE FUNCTION growth_record_signal();
DROP TRIGGER IF EXISTS growth_enquiry ON chatbot_leads;
CREATE TRIGGER growth_enquiry AFTER INSERT ON chatbot_leads FOR EACH ROW EXECUTE FUNCTION growth_record_signal();
DROP TRIGGER IF EXISTS growth_payment_failed ON website_plan_subscriptions;
CREATE TRIGGER growth_payment_failed AFTER INSERT OR UPDATE OF status ON website_plan_subscriptions FOR EACH ROW EXECUTE FUNCTION growth_record_signal();
CREATE TABLE IF NOT EXISTS growth_legacy_payments(
 reference text PRIMARY KEY,organization_id uuid NOT NULL REFERENCES organizations(id),provider_transaction text NOT NULL UNIQUE,
 amount_kobo bigint NOT NULL CHECK(amount_kobo>0),months integer NOT NULL CHECK(months IN(1,3,6,12)),paid_at timestamptz NOT NULL,period_end timestamptz NOT NULL,
 verified_by uuid REFERENCES admin_users(id),verification_source text NOT NULL DEFAULT 'TEAM' CHECK(verification_source IN('TEAM','PROVIDER')),verified_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS growth_cost_evidence ON growth_acquisition_costs(COALESCE(affiliate_id,'00000000-0000-0000-0000-000000000000'::uuid),spent_on,md5(evidence)) WHERE voided_at IS NULL;
CREATE TABLE IF NOT EXISTS growth_operational_checks(
 kind text PRIMARY KEY CHECK(kind IN('BACKUP_RESTORE','MONITORING','WEBHOOK','SCHEDULER')),
 evidence text NOT NULL CHECK(length(evidence) BETWEEN 10 AND 1000),verified_by uuid NOT NULL REFERENCES admin_users(id),verified_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION growth_snapshot_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Recurring revenue evidence snapshots are immutable'; END $$;
DROP TRIGGER IF EXISTS growth_snapshot_immutable ON growth_recurring_snapshots;
CREATE TRIGGER growth_snapshot_immutable BEFORE UPDATE OR DELETE ON growth_recurring_snapshots FOR EACH ROW EXECUTE FUNCTION growth_snapshot_immutable();
