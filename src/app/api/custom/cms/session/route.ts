import { NextResponse } from "next/server";
import { validateCmsSession, query } from "@/lib/custom/service";
import { id } from "@/lib/custom/model";
import { rateLimit } from "@/lib/domains/store";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    if (Number(request.headers.get("content-length") || 0) > 2000)
      throw Error();
    const raw = await request.text();
    if (raw.length > 2000) throw Error();
    const body = JSON.parse(raw),
      key = request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
    if (!/^[a-f0-9]{64}$/.test(key)) throw Error();
    const project = id(body.projectId),
      user = id(body.userId),
      org = id(body.organizationId);
    const result = await validateCmsSession(project, key, user, org);
    if (!result)
      return NextResponse.json(
        { error: "CMS access unavailable" },
        { status: 401, headers },
      );
    await rateLimit(query, project, "cms-session", 120, 60);
    return NextResponse.json(
      {
        issuer: "https://business.jktl.com.ng",
        audience: project,
        subject: result.user_id,
        organizationId: result.organization_id,
        scope: result.cms_scopes,
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { error: "CMS access unavailable" },
      { status: 400, headers },
    );
  }
}
