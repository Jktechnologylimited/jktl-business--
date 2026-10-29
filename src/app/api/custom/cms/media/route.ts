import {
  authorizeSite,
  boundedBody,
  loadSiteMedia,
  saveSiteMedia,
  SiteError,
} from "@/lib/custom/site-store";
import { id } from "@/lib/custom/model";
export const runtime = "nodejs";
const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
function failure(e: unknown) {
  return Response.json(
    { error: "Website image request unavailable" },
    { status: e instanceof SiteError ? e.status : 400, headers },
  );
}
export async function GET(request: Request) {
  try {
    const p = new URL(request.url).searchParams,
      access = await authorizeSite(request, p.get("projectId"), "public"),
      media = await loadSiteMedia(access, id(p.get("mediaId")));
    return new Response(media.bytes, {
      headers: { ...headers, "Content-Type": media.type },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const p = new URL(request.url).searchParams,
      access = await authorizeSite(request, p.get("projectId"), "upload"),
      bytes = await boundedBody(request, 3145728),
      type = await saveSiteMedia(access, id(p.get("mediaId")), bytes);
    return Response.json({ ok: true, contentType: type }, { headers });
  } catch (e) {
    return failure(e);
  }
}
