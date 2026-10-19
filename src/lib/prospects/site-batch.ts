import "server-only";
import { getSql } from "@/lib/db/client";
import { buildOneSite } from "./build-site";
import type { Prospect } from "@/lib/prospects/types";

/**
 * The bulk site build: a job that can be started, watched, resumed and finished.
 *
 * Why a job rather than a bigger loop: a few hundred sites inside one HTTP
 * request is not possible. Each site mirrors up to a dozen images and writes a
 * dozen rows, so the work is measured in minutes, and a request that takes twenty
 * minutes has already timed out and lost everything it did.
 *
 * So `startSiteBuildJob` records *what* to build and returns immediately, and
 * `advanceSiteBuildJob` does a bounded slice of it. A cron calls the advance
 * every few minutes; the admin can also press it. Progress lives in the database,
 * which is what makes a restart safe: the targets table knows exactly which
 * businesses are done, so no work is repeated and none is silently skipped.
 */

/** How many sites one batch handles. Chosen against the platform's request
 * timeout, not by feel: ~6 sites in parallel, each a few seconds of images and
 * a dozen writes, is comfortably inside a minute. */
const DEFAULT_BATCH = 6;
const MAX_BATCH = 20;
/** Sites built at once. Images are the slow part and they are network-bound, so
 * a small amount of parallelism is a large win; more than this and the CDN
 * starts throttling us, which makes it slower overall. */
const SITE_CONCURRENCY = 3;

export interface SiteBuildJob {
  id: string;
  status: string;
  total: number;
  built: number;
  failed: number;
  skipped: number;
  imagesMirrored: number;
  imageBytes: number;
  error: string;
  startedAt: string;
  finishedAt: string | null;
  percent: number;
  pending: number;
}

function mapJob(row: Record<string, unknown>): SiteBuildJob {
  const total = Number(row.total ?? 0);
  const built = Number(row.built ?? 0);
  const failed = Number(row.failed ?? 0);
  const skipped = Number(row.skipped ?? 0);
  const settled = built + failed + skipped;
  return {
    id: row.id as string,
    status: row.status as string,
    total,
    built,
    failed,
    skipped,
    imagesMirrored: Number(row.images_mirrored ?? 0),
    imageBytes: Number(row.image_bytes ?? 0),
    error: (row.error as string) ?? "",
    startedAt: new Date(row.started_at as string).toISOString(),
    finishedAt: row.finished_at ? new Date(row.finished_at as string).toISOString() : null,
    // Rounded down, so "100%" is only ever shown when it is genuinely finished.
    percent: total === 0 ? 0 : Math.floor((settled / total) * 100),
    pending: Math.max(0, total - settled),
  };
}

/**
 * Creates a job for every qualified lead that does not already have a site.
 *
 * The candidate list is snapshotted into `site_build_targets` up front rather
 * than re-queried per batch. That means a job's scope cannot move while it runs —
 * if a hundred more leads are imported mid-build, they belong to the next job, not
 * this one — and the totals the admin is watching actually mean something.
 */
export async function startSiteBuildJob(params: { limit?: number; onlyWithPhotos?: boolean } = {}): Promise<SiteBuildJob> {
  const sql = getSql();
  const limit = Math.min(Math.max(params.limit ?? 500, 1), 5000);

  const jobId = crypto.randomUUID();
  await sql`
    INSERT INTO site_build_jobs (id, status, total)
    VALUES (${jobId}, 'running', 0)
  `;

  /**
   * Qualified leads with no site yet. `is_qualified_lead` was already enforced
   * when the status was set, so `status = 'qualified'` is the gate here — plus
   * the two things that make a site actually worth generating: an audited website
   * status, and (optionally) photographs to show.
   */
  const inserted = await sql`
    INSERT INTO site_build_targets (job_id, prospect_id)
    SELECT ${jobId}, p.id
    FROM prospects p
    WHERE p.status = 'qualified'
      AND p.site_organization_id IS NULL
      AND p.excluded_reason = ''
      ${params.onlyWithPhotos ? sql`AND jsonb_array_length(COALESCE(p.enrichment->'photos', '[]'::jsonb)) >= 3` : sql``}
    ORDER BY
      -- Best content first: a business with photos and reviews produces a
      -- persuasive page, and those are the ones worth having early.
      jsonb_array_length(COALESCE(p.enrichment->'photos', '[]'::jsonb)) DESC,
      COALESCE(p.reviews, 0) DESC,
      p.created_at ASC
    LIMIT ${limit}
    ON CONFLICT DO NOTHING
    RETURNING prospect_id
  `;

  const total = inserted.length;
  await sql`UPDATE site_build_jobs SET total = ${total}, updated_at = now() WHERE id = ${jobId}`;

  // An empty job is finished, not running forever.
  if (total === 0) {
    await sql`UPDATE site_build_jobs SET status = 'done', finished_at = now(), updated_at = now() WHERE id = ${jobId}`;
  }

  return (await getSiteBuildJob(jobId))!;
}

export async function getSiteBuildJob(jobId: string): Promise<SiteBuildJob | null> {
  const sql = getSql();
  const row = (await sql`SELECT * FROM site_build_jobs WHERE id = ${jobId}`)[0];
  return row ? mapJob(row) : null;
}

/** The job a cron should carry on with, if any. */
export async function getRunningSiteBuildJob(): Promise<SiteBuildJob | null> {
  const sql = getSql();
  const row = (await sql`SELECT * FROM site_build_jobs WHERE status = 'running' ORDER BY started_at ASC LIMIT 1`)[0];
  return row ? mapJob(row) : null;
}

export async function listSiteBuildJobs(limit = 10): Promise<SiteBuildJob[]> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM site_build_jobs ORDER BY started_at DESC LIMIT ${limit}`;
  return rows.map(mapJob);
}

/**
 * Builds the next slice of a job.
 *
 * Returns without doing anything when the job is finished or cancelled, so
 * calling it repeatedly — which is exactly what a cron does — is safe.
 *
 * Failure is per target, never per batch: one business with a malformed listing
 * must not stop the other five, and its error is recorded against its own row so
 * the admin can see which one and why.
 */
export async function advanceSiteBuildJob(jobId: string, batchSize = DEFAULT_BATCH): Promise<SiteBuildJob | null> {
  const sql = getSql();
  const size = Math.min(Math.max(batchSize, 1), MAX_BATCH);

  const job = (await sql`SELECT * FROM site_build_jobs WHERE id = ${jobId}`)[0];
  if (!job) return null;
  if ((job.status as string) !== "running") return mapJob(job);

  const targets = await sql`
    SELECT t.prospect_id, p.*
    FROM site_build_targets t
    JOIN prospects p ON p.id = t.prospect_id
    WHERE t.job_id = ${jobId} AND t.status = 'pending'
    ORDER BY t.prospect_id
    LIMIT ${size}
  `;

  if (targets.length === 0) {
    await sql`UPDATE site_build_jobs SET status = 'done', finished_at = now(), updated_at = now() WHERE id = ${jobId}`;
    return getSiteBuildJob(jobId);
  }

  let built = 0;
  let failed = 0;
  let skipped = 0;
  let imagesMirrored = 0;
  let imageBytes = 0;

  // Bounded parallelism. Each worker pulls the next target, so a slow site does
  // not hold up the others and no worker idles while work remains.
  let cursor = 0;
  const workers = Array.from({ length: Math.min(SITE_CONCURRENCY, targets.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= targets.length) return;

      const raw = targets[index] as Record<string, unknown>;
      const prospectId = raw.prospect_id as string;

      // The row is a join of `prospects`, so it is already the shape the mapper
      // wants — but the mapper is not exported, so the fields are read directly
      // and defensively here rather than duplicating a second prospect shape.
      const prospect = {
        id: prospectId,
        source: (raw.source as Prospect["source"]) ?? "apify",
        sourceRef: (raw.source_ref as string) ?? "",
        businessName: (raw.business_name as string) ?? "",
        niche: (raw.niche as string) ?? "general",
        category: (raw.category as string) ?? "",
        phone: (raw.phone as string) ?? "",
        email: (raw.email as string) ?? "",
        address: (raw.address as string) ?? "",
        city: (raw.city as string) ?? "",
        state: (raw.state as string) ?? "",
        country: (raw.country as string) ?? "NG",
        website: (raw.website as string) ?? "",
        rating: raw.rating === null || raw.rating === undefined ? null : Number(raw.rating),
        reviews: raw.reviews === null || raw.reviews === undefined ? null : Number(raw.reviews),
        latitude: raw.latitude === null || raw.latitude === undefined ? null : Number(raw.latitude),
        longitude: raw.longitude === null || raw.longitude === undefined ? null : Number(raw.longitude),
        enrichment: (raw.enrichment as Record<string, unknown>) ?? {},
      } as Prospect;

      try {
        const outcome = await buildOneSite(prospect, jobId);
        if (outcome.ok) {
          built += 1;
          imagesMirrored += outcome.imagesMirrored;
          imageBytes += outcome.imageBytes;
          await sql`
            UPDATE site_build_targets SET
              status = 'built', organization_id = ${outcome.organizationId}, subdomain = ${outcome.subdomain},
              content_score = ${outcome.contentScore}, images_mirrored = ${outcome.imagesMirrored},
              error = '', updated_at = now()
            WHERE job_id = ${jobId} AND prospect_id = ${prospectId}
          `;
        } else {
          skipped += 1;
          await sql`
            UPDATE site_build_targets SET status = 'skipped', error = ${outcome.reason}, updated_at = now()
            WHERE job_id = ${jobId} AND prospect_id = ${prospectId}
          `;
        }
      } catch (err) {
        failed += 1;
        const message = (err instanceof Error ? err.message : "build failed").slice(0, 300);
        await sql`
          UPDATE site_build_targets SET status = 'failed', error = ${message}, updated_at = now()
          WHERE job_id = ${jobId} AND prospect_id = ${prospectId}
        `;
      }
    }
  });
  await Promise.all(workers);

  // Counters are incremented, never recomputed, so concurrent batches cannot
  // clobber each other's totals.
  await sql`
    UPDATE site_build_jobs SET
      built = built + ${built},
      failed = failed + ${failed},
      skipped = skipped + ${skipped},
      images_mirrored = images_mirrored + ${imagesMirrored},
      image_bytes = image_bytes + ${imageBytes},
      updated_at = now()
    WHERE id = ${jobId}
  `;

  // Finish only when nothing is pending — checked after the counters land, so a
  // job that just completed its last target is closed on this pass.
  const remaining = await sql`
    SELECT COUNT(*)::int AS n FROM site_build_targets WHERE job_id = ${jobId} AND status = 'pending'
  `;
  if (Number((remaining[0] as Record<string, unknown>)?.n ?? 0) === 0) {
    await sql`UPDATE site_build_jobs SET status = 'done', finished_at = now(), updated_at = now() WHERE id = ${jobId}`;
  }

  return getSiteBuildJob(jobId);
}

export async function cancelSiteBuildJob(jobId: string): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE site_build_jobs SET status = 'cancelled', finished_at = now(), updated_at = now()
    WHERE id = ${jobId} AND status = 'running'
  `;
  // Anything still pending is settled as skipped, so the progress bar reaches a
  // truthful end rather than sitting at 60% forever.
  await sql`
    UPDATE site_build_targets SET status = 'skipped', error = 'Job cancelled', updated_at = now()
    WHERE job_id = ${jobId} AND status = 'pending'
  `;
}

/** The per-business failures from a job — what the admin actually has to act on. */
export async function listSiteBuildFailures(
  jobId: string,
  limit = 50,
): Promise<Array<{ businessName: string; status: string; error: string; subdomain: string }>> {
  const sql = getSql();
  const rows = await sql`
    SELECT p.business_name, t.status, t.error, t.subdomain
    FROM site_build_targets t
    JOIN prospects p ON p.id = t.prospect_id
    WHERE t.job_id = ${jobId} AND t.status IN ('failed', 'skipped')
    ORDER BY t.updated_at DESC
    LIMIT ${limit}
  `;
  return rows.map((row) => ({
    businessName: (row.business_name as string) ?? "",
    status: (row.status as string) ?? "",
    error: (row.error as string) ?? "",
    subdomain: (row.subdomain as string) ?? "",
  }));
}
