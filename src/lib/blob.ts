import "server-only";
import { put, del } from "@vercel/blob";

const DATA_URL_RE = /^data:([^;]+);base64,([\s\S]+)$/;

/**
 * Uploads a `data:` URL to real object storage (Vercel Blob) and returns its
 * public URL. If the value isn't a data URL (already a plain URL, empty, or
 * null/undefined) it's returned unchanged — nothing to upload.
 *
 * Degrades gracefully when no Blob store is configured: without
 * `BLOB_READ_WRITE_TOKEN`, the data URL is returned as-is and gets stored
 * inline in Postgres, exactly like before this existed. That keeps the app
 * fully working with zero setup, and upgrades automatically the moment a
 * Blob store is connected — no code change, no migration.
 */
export async function persistImage(
  value: string | null | undefined,
  folder: "avatars" | "receipts" | "logos",
): Promise<string | null | undefined> {
  if (!value) return value;
  const match = DATA_URL_RE.exec(value);
  if (!match) return value; // not a data URL — either already a hosted URL, or nothing to do

  if (!process.env.BLOB_READ_WRITE_TOKEN) return value;

  const [, mime, base64] = match;
  const buffer = Buffer.from(base64, "base64");
  const ext = mime.split("/")[1]?.split(/[+;]/)[0] || "jpg";
  const pathname = `${folder}/${crypto.randomUUID()}.${ext}`;

  try {
    const blob = await put(pathname, buffer, { access: "public", contentType: mime, addRandomSuffix: false });
    return blob.url;
  } catch (err) {
    console.error("persistImage: upload to Blob storage failed, falling back to inline storage:", err);
    return value;
  }
}

/** Best-effort delete of a previous image, only when it's actually hosted on
 * Vercel Blob (never attempts to delete an inline data URL or some other
 * arbitrary string) and only when a store is configured. Never throws —
 * failing to clean up an orphaned blob shouldn't fail the action that
 * replaced or removed it. */
export async function deleteImageIfBlob(url: string | null | undefined): Promise<void> {
  if (!url || !process.env.BLOB_READ_WRITE_TOKEN) return;
  if (!url.includes(".public.blob.vercel-storage.com")) return;
  try {
    await del(url);
  } catch (err) {
    console.error("deleteImageIfBlob failed (non-fatal):", err);
  }
}
