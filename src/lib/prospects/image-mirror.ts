import "server-only";
import { put } from "@vercel/blob";

/**
 * Copies a business's photographs off Google's servers and onto ours.
 *
 * Hot-linking the listing's image URLs is not good enough for a page whose entire
 * job is to impress somebody into claiming it:
 *
 *   * Google serves full-resolution originals — often several megabytes each.
 *     Eight of those on a Nigerian mobile connection is a page that takes half a
 *     minute to show anything, which reads as "this developer is bad at their job"
 *     rather than "Google's CDN is slow".
 *   * Those URLs are not ours. They can be rate-limited, rotated, or withdrawn,
 *     and a demo whose hero photograph is a broken-image icon is worse than one
 *     with no photograph at all.
 *   * We cannot resize or serve modern formats from a URL we do not control.
 *
 * So each image is fetched once, size- and type-checked, and re-uploaded. On any
 * failure the original URL is kept — a working page with a hot-linked image beats
 * a page with a hole in it, and mirroring is an optimisation, never a
 * requirement.
 */

/** Nothing bigger than this is worth putting on a landing page. */
const MAX_BYTES = 3 * 1024 * 1024;
/** Google's image CDN is fast; if it has not started responding in 8s, move on.
 * A build of several hundred sites cannot afford one stalled socket per site. */
const FETCH_TIMEOUT_MS = 8_000;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export interface MirrorOutcome {
  /** The URL to store: ours on success, the original on failure. */
  url: string;
  /** True only when the bytes are now on our own storage. */
  mirrored: boolean;
  bytes: number;
  error?: string;
}

function extensionFor(contentType: string): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("avif")) return "avif";
  return "jpg";
}

/**
 * Fetches one image and re-uploads it.
 *
 * Reads `content-length` first and refuses an oversized image before downloading
 * it, so a 40MB panorama does not have to arrive before being rejected.
 */
export async function mirrorImage(sourceUrl: string, folder = "sites"): Promise<MirrorOutcome> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    // No object storage configured: keep the original rather than storing
    // megabytes inline in Postgres, which would be worse in every way.
    return { url: sourceUrl, mirrored: false, bytes: 0, error: "No blob storage configured" };
  }
  if (!sourceUrl.startsWith("http")) {
    return { url: sourceUrl, mirrored: false, bytes: 0, error: "Not a remote URL" };
  }

  try {
    const response = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      // Google's CDN honours this; a browser-shaped request is less likely to be
      // throttled than a bare one.
      headers: { "User-Agent": "JKTL-Business/1.0 (+https://jktl.com.ng)", Accept: "image/*" },
    });

    if (!response.ok) {
      return { url: sourceUrl, mirrored: false, bytes: 0, error: `Upstream returned ${response.status}` };
    }

    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES) {
      return { url: sourceUrl, mirrored: false, bytes: 0, error: `Too large (${Math.round(declared / 1024)}KB)` };
    }

    const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    // A URL ending in .jpg that serves HTML is a redirect to a login page, not a
    // photograph. Storing it would put a broken image on the site.
    if (!ALLOWED_TYPES.has(contentType)) {
      return { url: sourceUrl, mirrored: false, bytes: 0, error: `Unsupported type ${contentType || "unknown"}` };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    // Re-check after download: a chunked response declares no length, and this is
    // the only thing standing between a hostile URL and our storage bill.
    if (buffer.length > MAX_BYTES) {
      return { url: sourceUrl, mirrored: false, bytes: 0, error: `Too large (${Math.round(buffer.length / 1024)}KB)` };
    }
    if (buffer.length < 1024) {
      return { url: sourceUrl, mirrored: false, bytes: 0, error: "Suspiciously small; probably not an image" };
    }

    const blob = await put(`${folder}/${crypto.randomUUID()}.${extensionFor(contentType)}`, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });

    return { url: blob.url, mirrored: true, bytes: buffer.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : "fetch failed";
    return { url: sourceUrl, mirrored: false, bytes: 0, error: message.slice(0, 120) };
  }
}

export interface MirrorBatchResult {
  urls: string[];
  mirrored: number;
  bytes: number;
  failures: string[];
}

/**
 * Mirrors a gallery, bounded and best-effort.
 *
 * Concurrency is capped at four: these are downloads of multi-megabyte files, and
 * a batch build already runs several sites in parallel, so an unbounded fan-out
 * would open hundreds of sockets and get us throttled by exactly the CDN we are
 * trying to be polite to.
 *
 * Order is preserved, because Google returns the best hero shot first.
 */
export async function mirrorGallery(urls: string[], concurrency = 4, folder = "sites"): Promise<MirrorBatchResult> {
  const results: MirrorOutcome[] = new Array(urls.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(Math.max(concurrency, 1), urls.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= urls.length) return;
      results[index] = await mirrorImage(urls[index], folder);
    }
  });
  await Promise.all(workers);

  const failures: string[] = [];
  let mirrored = 0;
  let bytes = 0;
  for (const [index, outcome] of results.entries()) {
    if (outcome.mirrored) {
      mirrored += 1;
      bytes += outcome.bytes;
    } else if (outcome.error) {
      failures.push(`${urls[index].slice(0, 60)}: ${outcome.error}`);
    }
  }

  return { urls: results.map((r, i) => r?.url ?? urls[i]), mirrored, bytes, failures };
}
