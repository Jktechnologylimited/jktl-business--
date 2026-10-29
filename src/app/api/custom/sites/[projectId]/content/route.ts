import { publicManagedSite } from "@/lib/custom/managed-site";
import { loadSiteContent } from "@/lib/custom/site-store";
import { query } from "@/lib/custom/service";
import { rateLimit } from "@/lib/domains/store";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const access = await publicManagedSite((await context.params).projectId);
    await rateLimit(query, access.project, "managed-site-public", 1000, 60);
    return Response.json(await loadSiteContent(access, "published"), {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json(
      { error: "Website content unavailable" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
}
