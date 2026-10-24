CREATE TABLE IF NOT EXISTS website_metric_events (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id UUID NOT NULL,
  template_id TEXT NOT NULL,
  page_kind TEXT NOT NULL CHECK (page_kind IN ('website','landing','blank')),
  event_type TEXT NOT NULL CHECK (event_type IN ('view','cta','contact','booking')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,event_id)
);
CREATE INDEX IF NOT EXISTS website_metric_reporting ON website_metric_events(organization_id,created_at,template_id);
CREATE TABLE IF NOT EXISTS website_metric_rate_limits (
  bucket TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at TIMESTAMPTZ NOT NULL
);
