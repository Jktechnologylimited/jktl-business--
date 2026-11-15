import "server-only";
import { unstable_cache } from "next/cache";
import { query } from "./service";
import { id } from "./model";
import { loadSiteContent, SiteError, type SiteAccess } from "./site-store";
import { publicManagedSiteEligibility } from "./managed-site";
import { RateLimitError, rateLimitWindow } from "@/lib/domains/store";
import { managedOrganizationTag, managedSiteTag } from "./site-cache-tags";

type PublicAccess = SiteAccess & {
  contentRevision: number;
  projectRevision: number;
};

/** One authoritative admission + one distributed rate-limit write, even on cache hits. */
export async function admitPublishedSite(projectValue: unknown): Promise<PublicAccess> {
  let project: string;
  try { project = id(projectValue).toLowerCase(); }
  catch { throw new SiteError(404); }
  const window = rateLimitWindow(project, "managed-site-public", 60);
  const rows = await query(
    `WITH eligible AS MATERIALIZED (
      SELECT p.organization_id,p.revision AS project_revision,COALESCE(c.revision,0) AS content_revision
      FROM custom_projects p LEFT JOIN custom_site_content c ON c.project_id=p.id AND c.organization_id=p.organization_id
      WHERE p.id=$1 AND ${publicManagedSiteEligibility}
    ), admitted AS (
      INSERT INTO domain_rate_limits(bucket,hits,expires_at)
      SELECT $2,1,now()+$3::int*interval '1 second' FROM eligible
      ON CONFLICT(bucket) DO UPDATE SET hits=domain_rate_limits.hits+1 WHERE domain_rate_limits.hits<$4
      RETURNING hits
    ) SELECT eligible.*,admitted.hits FROM eligible LEFT JOIN admitted ON true`,
    [project, window.bucket, 120, 1000],
  );
  const row = rows[0];
  if (!row) throw new SiteError(404);
  if (row.hits == null) throw new RateLimitError(window.retryAfter);
  return {
    project, organization: String(row.organization_id), scopes: [],
    contentRevision: Number(row.content_revision), projectRevision: Number(row.project_revision),
  };
}

export function publishedContentRevalidation() {
  const seconds = Number(process.env.JKTL_MANAGED_CONTENT_REVALIDATE_SECONDS || 300);
  return Number.isSafeInteger(seconds) && seconds >= 30 && seconds <= 3600 ? seconds : 300;
}

async function readPublished(project: string, organization: string, revision: number) {
  return loadSiteContent({ project, organization, scopes: [] }, "published", revision);
}

type Published = Awaited<ReturnType<typeof readPublished>>;
const pending = new Map<string, Promise<Published>>();

/** Only public snapshots enter the Data Cache. Authorization/admission is outside it. */
export async function cachedPublishedSite(access: PublicAccess) {
  const { project, organization, contentRevision, projectRevision } = access;
  const key = JSON.stringify([project, organization, projectRevision, contentRevision]);
  const existing = pending.get(key);
  if (existing) return existing;
  const read = unstable_cache(readPublished, ["managed-site-published-v1", String(projectRevision)], {
    tags: [managedSiteTag(project), managedOrganizationTag(organization)],
    revalidate: publishedContentRevalidation(),
  });
  const result = read(project, organization, contentRevision);
  // Coalesce concurrent misses in this instance without an unbounded process cache.
  if (pending.size < 128) pending.set(key, result);
  try { return await result; }
  finally { if (pending.get(key) === result) pending.delete(key); }
}
