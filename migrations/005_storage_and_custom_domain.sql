-- Real enforcement for two of the three things decided as the actual
-- "Website & Hosting" gates (team seats — see migration 004 and
-- `addMemberAction` — already went live in the app before this migration).

-- Storage: tracked in bytes, not the old NUMERIC(6,2) GB columns (too
-- coarse to represent a 50MB free quota precisely). Grounded in Neon's own
-- free-plan limit — 0.5GB *total, for the whole platform, across every
-- business* — so a per-business quota needs to be small enough that a
-- realistic number of businesses can coexist on it comfortably, and cheap
-- enough that it's a rounding error once you're on Neon's paid tier
-- ($0.35/GB-month, metered — 50MB is a fraction of a cent/month there).
-- Deliberately only tracks image uploads (logos, avatars, receipt photos)
-- via `image_uploads` below, not general row growth across every table —
-- plain CRM data (customers, bookings, sales rows with no photo attached)
-- is negligible next to photos even for a very active business, so this is
-- a genuinely good-enough proxy for "storage used" without instrumenting
-- byte-counting on every table in the schema.
ALTER TABLE infrastructure_accounts
  ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS storage_limit_bytes BIGINT NOT NULL DEFAULT 52428800; -- 50MB

-- One row per stored image (Blob-hosted or inline-in-Postgres, either way —
-- both cost something real, so both count). Keyed loosely by URL (not a
-- unique constraint — an inline data: URL could theoretically collide on
-- byte-identical content, which is fine to just double-count rather than
-- engineer around) so a later replace/remove can look up and release the
-- exact size that was added, instead of trying to re-derive it from the
-- URL alone (impossible for a Blob URL without an extra network call).
-- NOTE: this table deliberately has NO index on `url`. It originally did
-- (`idx_image_uploads_url`), and that was wrong: without a Blob store
-- configured, `url` holds a full inline base64 `data:` image — routinely
-- 50-250KB+ — and Postgres refuses to index anything past roughly 2.7KB in
-- a standard btree ("index row requires N bytes, maximum size is 8191"),
-- so that index broke every inline image upload. Migration 007 drops it.
-- Since this app has no migration ledger and simply replays every file in
-- order on every `npm run db:migrate` (see scripts/migrate.mjs), leaving
-- the `CREATE INDEX` here would silently recreate the exact same broken
-- index on the very next full replay — which is exactly what happened:
-- once any inline image existed in this table, re-running migrations from
-- scratch hit this same error again, this time failing migration 005
-- itself and blocking every migration after it. So the fix belongs here,
-- not just in 007 — a file in this project must be safe to replay forever.
CREATE TABLE IF NOT EXISTS image_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_image_uploads_org ON image_uploads(organization_id);

-- Custom domain: manual setup (per your choice) — the business proves
-- ownership with a DNS TXT record, then adds the domain to the Vercel
-- project by hand, same as you already do for jktl.com.ng's wildcard.
-- Requires an active subscription to start verifying (see
-- `startCustomDomainVerificationAction`).
ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS custom_domain TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS custom_domain_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_domain_token TEXT NOT NULL DEFAULT '';

-- Only one business can claim a given custom domain. The partial index
-- (WHERE custom_domain <> '') means the many businesses with no custom
-- domain set (the default '') don't collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS idx_business_profiles_custom_domain
  ON business_profiles (custom_domain) WHERE custom_domain <> '';
