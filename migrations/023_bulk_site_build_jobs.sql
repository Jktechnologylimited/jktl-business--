-- Bulk site generation, as a resumable job.
--
-- `buildSitesAction` built up to 20 sites per call. That is fine for a handful
-- and useless for the number this is actually for: a few hundred prospect sites,
-- each of which is the pitch — "here is the website I already built you, claim
-- it" converts in a way "would you like a website?" never will. Generating those
-- inside one HTTP request is not possible; a request that takes twenty minutes
-- has already timed out.
--
-- So generation becomes a job with its own progress, advanced a batch at a time
-- by a cron (or by an admin pressing go again). Two tables:
--
--   * the **job** — one row with the counters, so progress is a single read and
--     a restart never re-counts;
--   * the **targets** — one row per business to build, which is what makes the
--     job resumable after a crash, and gives the admin a per-business error
--     rather than a batch that "failed".
--
-- Also records the image mirroring, because hot-linking Google's photo URLs is
-- not good enough for a page whose job is to impress somebody: those URLs are
-- large originals, they can be rate-limited or withdrawn, and a demo whose hero
-- photograph is broken is worse than one with no photograph.

CREATE TABLE IF NOT EXISTS site_build_jobs (
  id UUID PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'cancelled', 'failed')),
  -- How many businesses the job will attempt, fixed at creation.
  total INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0),
  built INTEGER NOT NULL DEFAULT 0 CHECK (built >= 0),
  failed INTEGER NOT NULL DEFAULT 0 CHECK (failed >= 0),
  skipped INTEGER NOT NULL DEFAULT 0 CHECK (skipped >= 0),
  -- Images pulled off the listing and re-hosted on our own storage.
  images_mirrored INTEGER NOT NULL DEFAULT 0 CHECK (images_mirrored >= 0),
  image_bytes BIGINT NOT NULL DEFAULT 0 CHECK (image_bytes >= 0),
  error TEXT NOT NULL DEFAULT '',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The cron asks for the oldest still-running job, so this is its lookup.
CREATE INDEX IF NOT EXISTS idx_site_build_jobs_running
  ON site_build_jobs(status, started_at) WHERE status = 'running';

CREATE TABLE IF NOT EXISTS site_build_targets (
  job_id UUID NOT NULL REFERENCES site_build_jobs(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'built', 'failed', 'skipped')),
  organization_id UUID,
  subdomain TEXT NOT NULL DEFAULT '',
  content_score INTEGER NOT NULL DEFAULT 0,
  images_mirrored INTEGER NOT NULL DEFAULT 0,
  error TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One row per business per job, so a retry cannot double-build.
  PRIMARY KEY (job_id, prospect_id)
);

-- The batch worker's work list: the next pending targets in a job.
CREATE INDEX IF NOT EXISTS idx_site_build_targets_pending
  ON site_build_targets(job_id, status) WHERE status = 'pending';

-- A business can only be in one pending build at a time in practice, but the
-- cheap guard that matters is not creating a second site for a prospect that
-- already has one — that is checked in code against `prospects.site_organization_id`.
CREATE INDEX IF NOT EXISTS idx_site_build_targets_prospect ON site_build_targets(prospect_id);

-- Which job built a given site, so a bad batch can be found and regenerated.
ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS generated_by_job UUID;
CREATE INDEX IF NOT EXISTS idx_profiles_generated_by_job
  ON business_profiles(generated_by_job) WHERE generated_by_job IS NOT NULL;
