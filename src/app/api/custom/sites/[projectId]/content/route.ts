import { admitPublishedSite, cachedPublishedSite } from "@/lib/custom/published-site";
import { SiteError } from "@/lib/custom/site-store";
import { RateLimitError } from "@/lib/domains/store";
export const runtime = "nodejs";
// CDN/browser caching would bypass eligibility checks and the distributed limit.
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "no-store",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const access = await admitPublishedSite((await context.params).projectId);
    return Response.json(await cachedPublishedSite(access), { headers });
  } catch (error) {
    if (error instanceof RateLimitError)
      return Response.json({ error: "Too many requests. Please try again shortly." }, {
        status: 429, headers: { ...headers, "Retry-After": String(error.retryAfter) },
      });
    const missing = error instanceof SiteError && error.status === 404;
    return Response.json(
      { error: "Website content unavailable" },
      { status: missing ? 404 : 503, headers },
    );
  }
}
