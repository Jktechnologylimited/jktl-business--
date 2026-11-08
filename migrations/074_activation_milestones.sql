-- First observed milestones only: no invented historical dates or visitor counts.
CREATE TABLE IF NOT EXISTS activation_tracking(
 id boolean PRIMARY KEY DEFAULT true CHECK(id),installed_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO activation_tracking(id) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS activation_milestones(
 organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 milestone text NOT NULL CHECK(milestone IN('registered','template_selected','website_published','website_paid')),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,milestone)
);
CREATE INDEX IF NOT EXISTS activation_milestone_date ON activation_milestones(milestone,occurred_at);
CREATE OR REPLACE FUNCTION record_activation_milestone() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE org uuid; selected boolean:=false; published_now boolean:=false;
BEGIN
 IF TG_TABLE_NAME='organization_members' THEN
  IF NEW.role='owner' AND NEW.active AND EXISTS(SELECT 1 FROM lifecycle_current c WHERE c.organization_id=NEW.organization_id) THEN
   IF TG_OP='INSERT' OR OLD.role<>'owner' OR NOT OLD.active THEN
    INSERT INTO activation_milestones(organization_id,milestone) VALUES(NEW.organization_id,'registered') ON CONFLICT DO NOTHING;
   END IF;
  END IF;
 ELSIF TG_TABLE_NAME='website_plan_payments' THEN
  -- This is the verified-payment ledger, not checkout initiation or client events.
  INSERT INTO activation_milestones(organization_id,milestone) VALUES(NEW.organization_id,'website_paid') ON CONFLICT DO NOTHING;
 ELSE
  org:=NEW.organization_id;
  IF TG_TABLE_NAME='business_profiles' THEN
   selected:=COALESCE(NEW.website_template_id,'')<>'';
   IF TG_OP='UPDATE' THEN selected:=selected AND COALESCE(OLD.website_template_id,'')=''; END IF;
  ELSE
   selected:=TG_OP='INSERT';
  END IF;
  published_now:=NEW.published;
  IF TG_OP='UPDATE' THEN published_now:=published_now AND NOT OLD.published; END IF;
  IF selected THEN INSERT INTO activation_milestones(organization_id,milestone) VALUES(org,'template_selected') ON CONFLICT DO NOTHING; END IF;
  IF published_now THEN INSERT INTO activation_milestones(organization_id,milestone) VALUES(org,'website_published') ON CONFLICT DO NOTHING; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS activation_registration ON organization_members;
CREATE TRIGGER activation_registration AFTER INSERT OR UPDATE OF role,active ON organization_members FOR EACH ROW EXECUTE FUNCTION record_activation_milestone();
DROP TRIGGER IF EXISTS activation_primary ON business_profiles;
CREATE TRIGGER activation_primary AFTER INSERT OR UPDATE OF website_template_id,published ON business_profiles FOR EACH ROW EXECUTE FUNCTION record_activation_milestone();
DROP TRIGGER IF EXISTS activation_additional ON business_websites;
CREATE TRIGGER activation_additional AFTER INSERT OR UPDATE OF published ON business_websites FOR EACH ROW EXECUTE FUNCTION record_activation_milestone();
DROP TRIGGER IF EXISTS activation_payment ON website_plan_payments;
CREATE TRIGGER activation_payment AFTER INSERT ON website_plan_payments FOR EACH ROW EXECUTE FUNCTION record_activation_milestone();
