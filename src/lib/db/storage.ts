import "server-only";
import { getSql } from "./client";
import { isSubscriptionActive } from "./billing";

/**
 * Tracks and enforces the "Website & Hosting" storage quota — see
 * migration 005 for why this only measures image uploads (logos, avatars,
 * receipt photos) rather than every table's row growth: photos are the
 * dominant, owner-controllable driver of real storage cost, and plain CRM
 * rows are negligible next to them even for a busy business.
 */

export interface StorageUsage {
  usedBytes: number;
  limitBytes: number;
}

export async function getStorageUsage(orgId: string): Promise<StorageUsage> {
  const sql = getSql();
  const rows = await sql`
    SELECT storage_used_bytes, storage_limit_bytes FROM infrastructure_accounts WHERE organization_id = ${orgId}
  `;
  const row = rows[0];
  return {
    usedBytes: Number(row?.storage_used_bytes ?? 0),
    limitBytes: Number(row?.storage_limit_bytes ?? 52_428_800),
  };
}

/**
 * True when uploading `additionalBytes` more would fit within the free
 * quota, OR the org has an active subscription (which lifts the quota
 * entirely — there's no separate "paid quota" ceiling right now, just
 * free-vs-unlimited). Checked before every image upload in `blob.ts`.
 */
export async function hasStorageQuota(orgId: string, additionalBytes: number): Promise<boolean> {
  const usage = await getStorageUsage(orgId);
  if (usage.usedBytes + additionalBytes <= usage.limitBytes) return true;
  return isSubscriptionActive(orgId);
}

/** Records a newly-stored image (Blob-hosted or inline, either way costs
 * something real) and adds its size to the running usage counter. */
export async function recordImageUpload(orgId: string, url: string, sizeBytes: number): Promise<void> {
  const sql = getSql();
  await sql`INSERT INTO image_uploads (organization_id, url, size_bytes) VALUES (${orgId}, ${url}, ${sizeBytes})`;
  await sql`UPDATE infrastructure_accounts SET storage_used_bytes = storage_used_bytes + ${sizeBytes} WHERE organization_id = ${orgId}`;
}

/**
 * Releases a previously-recorded image (on replace or removal) — deletes
 * its tracking row(s) and subtracts their size from the usage counter,
 * floored at 0 so a bookkeeping mismatch can't push usage negative. Safe
 * to call for a URL that was never tracked (a pre-migration image, or one
 * that failed to record) — it just finds nothing and is a no-op.
 */
export async function releaseImageUsage(orgId: string, url: string): Promise<void> {
  if (!url) return;
  const sql = getSql();
  const rows = await sql`DELETE FROM image_uploads WHERE organization_id = ${orgId} AND url = ${url} RETURNING size_bytes`;
  const freed = rows.reduce((sum, row) => sum + Number(row.size_bytes), 0);
  if (freed > 0) {
    await sql`
      UPDATE infrastructure_accounts
      SET storage_used_bytes = GREATEST(0, storage_used_bytes - ${freed})
      WHERE organization_id = ${orgId}
    `;
  }
}
