-- Staged cold-outreach sequences.
--
-- The lead engine could already send exactly one email per prospect. That is the
-- weakest possible version of cold outreach: most businesses that would have
-- bought simply did not open it on the day it arrived, and there was no way to
-- follow up without a human remembering to.
--
-- This adds the state a four-step sequence needs and nothing else:
--
--   sequence_step       — which step was last SENT. "" means not started.
--   sequence_started_at — when it was enrolled, so "how far along is this lead"
--                         is answerable without replaying the send log.
--   next_outreach_at    — when the NEXT step is due. NULL means "not scheduled",
--                         which is how a finished sequence drops out of the due
--                         query instead of needing a second flag.
--
-- Deliberately no MONEY here: outreach is platform spend, not a tenant balance,
-- and nothing in this feature touches kobo.
--
-- Every statement is IF NOT EXISTS because `scripts/migrate.mjs` re-applies every
-- file on every run — a migration that is not idempotent breaks the next deploy.

-- ---------------------------------------------------------------------------
-- 1. Where each prospect is in its sequence
-- ---------------------------------------------------------------------------

ALTER TABLE prospects
  -- '' for "not enrolled". Stored as text rather than an enum because adding a
  -- step later must not require an ALTER TYPE on a table this large, and because
  -- the step list lives in one pure module (`src/lib/prospects/sequence.ts`)
  -- where it is unit tested.
  ADD COLUMN IF NOT EXISTS sequence_step TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sequence_started_at TIMESTAMPTZ,
  -- The scheduling cursor. Set to now() on enrolment, then to the computed date
  -- of the following step after each send; NULL once the sequence is finished.
  ADD COLUMN IF NOT EXISTS next_outreach_at TIMESTAMPTZ;

-- The cron asks one question — "what is due?" — on every run, and it must be
-- cheap even with 12,000 prospects. A partial index keeps unscheduled prospects
-- (the vast majority: never enrolled, or finished) out of it entirely.
CREATE INDEX IF NOT EXISTS idx_prospects_next_outreach
  ON prospects(next_outreach_at) WHERE next_outreach_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Which step each send was
-- ---------------------------------------------------------------------------

ALTER TABLE prospect_outreach
  -- '' for the one-off sends that predate sequences and for manual sends.
  ADD COLUMN IF NOT EXISTS step_key TEXT NOT NULL DEFAULT '';

-- **The same step can never be sent twice to one prospect.**
--
-- This is the guard that makes the sequence safe to re-run: the cron has no
-- retries and a deploy can re-trigger a sweep, so without a database constraint
-- a race between two runs would email a business the same pitch twice — the
-- single fastest way to look like a spammer. A unique partial index is used
-- rather than a constraint because the one-off sends all carry step_key = ''
-- and must not collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS idx_prospect_outreach_step_once
  ON prospect_outreach(prospect_id, step_key) WHERE step_key <> '';
