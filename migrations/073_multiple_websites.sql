-- Additional sites are additive. Existing primary sites stay on business_profiles.
CREATE TABLE IF NOT EXISTS business_websites(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 160),subdomain text NOT NULL UNIQUE,
 template_id text NOT NULL,document jsonb NOT NULL,revision integer NOT NULL DEFAULT 0,published boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_websites_org ON business_websites(organization_id,created_at DESC);
CREATE TABLE IF NOT EXISTS website_subdomains(
 subdomain text PRIMARY KEY,organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,site_id uuid UNIQUE,
 CHECK(length(subdomain)>0)
);
CREATE UNIQUE INDEX IF NOT EXISTS website_primary_address ON website_subdomains(organization_id) WHERE site_id IS NULL;
INSERT INTO website_subdomains(subdomain,organization_id,site_id) SELECT subdomain,organization_id,NULL FROM business_profiles WHERE COALESCE(subdomain,'')<>'' ON CONFLICT DO NOTHING;
INSERT INTO website_subdomains(subdomain,organization_id,site_id) SELECT subdomain,organization_id,id FROM business_websites ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION claim_website_subdomain() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE site uuid; claimed text;
BEGIN
 IF TG_OP='DELETE' THEN
  IF TG_TABLE_NAME='business_websites' THEN DELETE FROM website_subdomains WHERE site_id=OLD.id;
  ELSE DELETE FROM website_subdomains WHERE organization_id=OLD.organization_id AND site_id IS NULL; END IF;
  RETURN OLD;
 END IF;
 IF TG_TABLE_NAME='business_websites' THEN site:=NEW.id; ELSE site:=NULL; END IF;
 IF TG_OP='UPDATE' AND OLD.subdomain IS DISTINCT FROM NEW.subdomain THEN
  DELETE FROM website_subdomains WHERE subdomain=OLD.subdomain AND organization_id=OLD.organization_id AND site_id IS NOT DISTINCT FROM site;
 END IF;
 IF COALESCE(NEW.subdomain,'')='' THEN RETURN NEW; END IF;
 INSERT INTO website_subdomains(subdomain,organization_id,site_id) VALUES(NEW.subdomain,NEW.organization_id,site)
 ON CONFLICT(subdomain) DO UPDATE SET subdomain=excluded.subdomain
 WHERE website_subdomains.organization_id=excluded.organization_id AND website_subdomains.site_id IS NOT DISTINCT FROM excluded.site_id
 RETURNING subdomain INTO claimed;
 IF claimed IS NULL THEN RAISE EXCEPTION 'Website address is already in use' USING ERRCODE='23505'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS website_address_claim ON business_profiles;
CREATE TRIGGER website_address_claim AFTER INSERT OR UPDATE OF subdomain OR DELETE ON business_profiles FOR EACH ROW EXECUTE FUNCTION claim_website_subdomain();
DROP TRIGGER IF EXISTS website_address_claim ON business_websites;
CREATE TRIGGER website_address_claim AFTER INSERT OR UPDATE OF subdomain OR DELETE ON business_websites FOR EACH ROW EXECUTE FUNCTION claim_website_subdomain();
ALTER TABLE website_metric_events ADD COLUMN IF NOT EXISTS site_id uuid;
ALTER TABLE website_metric_events ADD COLUMN IF NOT EXISTS subdomain text;
CREATE INDEX IF NOT EXISTS website_metrics_site ON website_metric_events(organization_id,site_id,created_at DESC);

-- Account journeys must recognize additional drafts and published sites.
DO $$ BEGIN IF to_regclass('public.lifecycle_current') IS NOT NULL THEN EXECUTE $view$
CREATE OR REPLACE VIEW lifecycle_current AS
SELECT o.id organization_id,COALESCE(NULLIF(b.display_name,''),o.name,'Business account') business_name,lower(owner.email) recipient,
 CASE WHEN EXISTS(SELECT 1 FROM custom_clients cc WHERE cc.organization_id=o.id) THEN 'MANAGED'
 WHEN b.published=true AND COALESCE(b.custom_domain,'')<>'' AND b.custom_domain_verified=true THEN 'COMPLETE'
 WHEN (b.published=true OR EXISTS(SELECT 1 FROM business_websites w WHERE w.organization_id=o.id AND w.published=true)) AND(COALESCE(b.custom_domain,'')<>'' OR EXISTS(SELECT 1 FROM domain_assets d WHERE d.organization_id=o.id AND d.expires_at>now())) THEN 'CONNECT_DOMAIN'
 WHEN b.published=true OR EXISTS(SELECT 1 FROM business_websites w WHERE w.organization_id=o.id AND w.published=true) THEN 'FREE_DOMAIN'
 WHEN EXISTS(SELECT 1 FROM business_websites w WHERE w.organization_id=o.id) OR COALESCE(b.website_template_id,'')<>'' OR COALESCE(b.website_document,'{}'::jsonb)<>'{}'::jsonb THEN 'DRAFT' ELSE 'NO_SITE' END stage,
 EXISTS(SELECT 1 FROM domain_assets d WHERE d.organization_id=o.id AND d.expires_at>now()) OR COALESCE(b.custom_domain,'')<>'' has_domain
FROM organizations o LEFT JOIN business_profiles b ON b.organization_id=o.id
LEFT JOIN LATERAL(SELECT COALESCE(NULLIF(u.email,''),NULLIF(m.email,'')) email FROM organization_members m JOIN users u ON u.id=m.user_id WHERE m.organization_id=o.id AND m.role='owner' AND m.active=true AND to_jsonb(u)->>'disabled_at' IS NULL AND to_jsonb(u)->>'deleted_at' IS NULL ORDER BY m.created_at,m.id LIMIT 1)owner ON true
WHERE COALESCE(o.slug,'')<>'demo' AND COALESCE(to_jsonb(o)->>'is_demo','false')<>'true' AND EXISTS(SELECT 1 FROM organization_members registered JOIN users active_user ON active_user.id=registered.user_id WHERE registered.organization_id=o.id AND registered.role='owner' AND registered.active=true AND to_jsonb(active_user)->>'disabled_at' IS NULL AND to_jsonb(active_user)->>'deleted_at' IS NULL);
$view$; END IF; END $$;
