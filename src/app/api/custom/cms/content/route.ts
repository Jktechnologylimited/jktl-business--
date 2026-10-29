import {
  authorizeSite,
  boundedBody,
  loadSiteContent,
  saveSiteContent,
  SiteError,
} from "@/lib/custom/site-store";
export const runtime = "nodejs";
const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
function failure(e: unknown) {
  return Response.json(
    {
      error:
        "Website content request unavailable. Reload before retrying a save.",
    },
    { status: e instanceof SiteError ? e.status : 400, headers },
  );
}
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams,
      view = params.get("view") || "published";
    if (!["draft", "published"].includes(view)) throw new SiteError(400);
    const access = await authorizeSite(
      request,
      params.get("projectId"),
      view === "draft" ? "read" : "public",
    );
    return Response.json(
      await loadSiteContent(access, view as "draft" | "published"),
      { headers },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const project = new URL(request.url).searchParams.get("projectId");
    const raw = await boundedBody(request, 220000);
    const body = JSON.parse(raw.toString("utf8"));
    if (!["draft", "publish"].includes(body.mode)) throw new SiteError(400);
    const access = await authorizeSite(
      request,
      project,
      body.mode === "publish" ? "publish" : "write",
    );
    return Response.json(
      await saveSiteContent(access, body.fields, body.revision, body.mode),
      { headers },
    );
  } catch (e) {
    return failure(e);
  }
}
