import "server-only";
import { put, del } from "@vercel/blob";
import { hasStorageQuota, recordImageUpload, releaseImageUsage } from "@/lib/db/storage";

const DATA_URL_RE = /^data:([^;]+);base64,([\s\S]+)$/;

/** Thrown by `persistImage` when a new upload would exceed the free
 * storage quota and the organization has no active subscription. Callers
 * catch this by `instanceof` to surface its message directly instead of a
 * generic "couldn't save" error — see any of the call sites in
 * `src/lib/actions/`. */
export class StorageQuotaError extends Error {
  constructor() {
    super("You've reached the free storage limit. Upgrade to Website & Hosting under Settings → Plan for more.");
    this.name = "StorageQuotaError";
  }
}

/**
 * Uploads a `data:` URL to real object storage (Vercel Blob) and returns its
 * public URL. If the value isn't a data URL (already a plain URL, empty, or
 * null/undefined) it's returned unchanged — nothing to upload, and nothing
 * to check against the quota.
 *
 * Degrades gracefully when no Blob store is configured: without
 * `BLOB_READ_WRITE_TOKEN`, the data URL is returned as-is and gets stored
 * inline in Postgres, exactly like before this existed. That keeps the app
 * fully working with zero setup, and upgrades automatically the moment a
 * Blob store is connected — no code change, no migration. Either way, the
 * image's size counts against `orgId`'s storage quota the same way — an
 * inline image costs real Postgres storage just as a Blob-hosted one costs
 * real Blob storage.
 *
 * @throws {StorageQuotaError} if this upload would exceed the free quota
 * and the org has no active subscription. Thrown *before* anything is
 * uploaded or written.
 */
export async function persistImage(
  value: string | null | undefined,
  folder: "avatars" | "receipts" | "logos" | "covers" | "products" | "services",
  orgId: string,
): Promise<string | null | undefined> {
  if (!value) return value;
  const match = DATA_URL_RE.exec(value);
  if (!match) return value; // not a data URL — either already a hosted URL, or nothing to do

  const [, mime, base64] = match;
  const buffer = Buffer.from(base64, "base64");

  if (!(await hasStorageQuota(orgId, buffer.length))) {
    throw new StorageQuotaError();
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    await recordImageUpload(orgId, value, buffer.length);
    return value;
  }

  const ext = mime.split("/")[1]?.split(/[+;]/)[0] || "jpg";
  const pathname = `${folder}/${crypto.randomUUID()}.${ext}`;

  try {
    const blob = await put(pathname, buffer, { access: "public", contentType: mime, addRandomSuffix: false });
    await recordImageUpload(orgId, blob.url, buffer.length);
    return blob.url;
  } catch (err) {
    console.error("persistImage: upload to Blob storage failed, falling back to inline storage:", err);
    await recordImageUpload(orgId, value, buffer.length);
    return value;
  }
}

/** Releases a previous image on replace or removal: best-effort deletes it
 * from Vercel Blob (only when it's actually hosted there and a store is
 * configured — never attempts to delete an inline data URL or some other
 * arbitrary string) and always releases its tracked bytes from the
 * storage-quota counter, regardless of where it was stored. Never throws —
 * failing to clean up shouldn't fail the action that replaced or removed
 * the image. */
export async function releaseImage(url: string | null | undefined, orgId: string): Promise<void> {
  if (!url) return;
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN && url.includes(".public.blob.vercel-storage.com")) {
      await del(url);
    }
    await releaseImageUsage(orgId, url);
  } catch (err) {
    console.error("releaseImage failed (non-fatal):", err);
  }
}
