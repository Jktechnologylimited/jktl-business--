CREATE TABLE IF NOT EXISTS email_branding(id boolean PRIMARY KEY DEFAULT true CHECK(id),settings jsonb NOT NULL DEFAULT '{}',revision integer NOT NULL DEFAULT 1,updated_by text,updated_at timestamptz NOT NULL DEFAULT now());
INSERT INTO email_branding(id) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS email_promotions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text NOT NULL,description text NOT NULL,url text NOT NULL,product_id text NOT NULL,enabled boolean NOT NULL DEFAULT true,priority integer NOT NULL DEFAULT 50,starts_at timestamptz,ends_at timestamptz,categories text[] NOT NULL,revision integer NOT NULL DEFAULT 1,updated_by text,updated_at timestamptz NOT NULL DEFAULT now(),CHECK(ends_at IS NULL OR starts_at IS NULL OR ends_at>starts_at));
INSERT INTO email_promotions(id,title,description,url,product_id,priority,categories) VALUES
('10000000-4444-4444-8444-000000000001','Website Builder','Create a professional website using JKTL’s ready-made designs.','https://jktl.com.ng/products/website-builder','website-builder',20,ARRAY['onboarding','domain','business_email']),
('10000000-4444-4444-8444-000000000002','Website Templates','Explore templates and find the right design for your business.','https://jktl.com.ng/templates','templates',30,ARRAY['onboarding','partner','affiliate']),
('10000000-4444-4444-8444-000000000003','Business Email','Build credibility with professional email that matches your domain.','https://jktl.com.ng/products/business-email','business-email',10,ARRAY['website','domain','onboarding']),
('10000000-4444-4444-8444-000000000004','Domains','Find and register a domain that represents your business.','https://jktl.com.ng/products/domains','domains',10,ARRAY['website','onboarding']),
('10000000-4444-4444-8444-000000000005','JKTL Business Plans','Explore tools to support your business as it grows.','https://jktl.com.ng/pricing','plans',40,ARRAY['website','business_email','onboarding']),
('10000000-4444-4444-8444-000000000006','JKTL Partners','Already help businesses grow? Explore JKTL’s Partner programme.','https://jktl.com.ng/partners','partners',50,ARRAY['marketing']) ON CONFLICT(id) DO NOTHING;
CREATE TABLE IF NOT EXISTS email_preferences(email text PRIMARY KEY,marketing_opt_in boolean NOT NULL DEFAULT false,marketing_suppressed boolean NOT NULL DEFAULT false,preference_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,consent_version text,updated_at timestamptz NOT NULL DEFAULT now());
-- Reuse the existing durable service-email queue for actual website events.
ALTER TABLE email_outbox ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'business_email';
ALTER TABLE email_outbox ADD COLUMN IF NOT EXISTS path text NOT NULL DEFAULT '/business/email';
CREATE OR REPLACE FUNCTION queue_website_mail() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.published=true AND OLD.published=false THEN
 INSERT INTO email_outbox(event_key,organization_id,subject,detail,category,path) VALUES('website-published:'||NEW.organization_id||':'||NEW.website_revision,NEW.organization_id,'Your website is published','Your website has been published through JKTL Business. Open Website to review its live address and manage your content.','website','/business/website') ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS website_published_mail ON business_profiles;
CREATE TRIGGER website_published_mail AFTER UPDATE OF published ON business_profiles FOR EACH ROW EXECUTE FUNCTION queue_website_mail();
CREATE OR REPLACE FUNCTION queue_website_payment_mail() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO email_outbox(event_key,organization_id,subject,detail,category,path) VALUES('website-payment:'||NEW.reference,NEW.organization_id,'JKTL website payment received','Your verified website payment of '||NEW.currency||' '||to_char(NEW.amount_kobo::numeric/100,'FM999999999990.00')||' was received. Reference: '||NEW.reference||'. Review your plan and subscription in JKTL Business.','payment','/business/website') ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS website_payment_mail ON website_plan_payments;
CREATE TRIGGER website_payment_mail AFTER INSERT ON website_plan_payments FOR EACH ROW EXECUTE FUNCTION queue_website_payment_mail();
CREATE INDEX IF NOT EXISTS prospects_email_suppression ON prospects(lower(email)) WHERE suppressed=true OR status='suppressed';
