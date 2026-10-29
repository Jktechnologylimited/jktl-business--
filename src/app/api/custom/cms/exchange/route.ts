import { NextResponse } from "next/server";
import { redeemGrant } from "@/lib/custom/service";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (Number(request.headers.get("content-length") || 0) > 2000)
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400, headers },
    );
  try {
    const raw = await request.text();
    if (raw.length > 2000) throw Error();
    const b = JSON.parse(raw),
      key = request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
    if (
      !/^[a-f0-9]{64}$/.test(b.code) ||
      !/^[a-f0-9-]{36}$/.test(b.projectId) ||
      !/^[a-f0-9]{64}$/.test(key)
    )
      throw Error();
    const result = await redeemGrant(b.code, b.projectId, key);
    if (!result)
      return NextResponse.json(
        { error: "Invalid or expired grant" },
        { status: 401, headers },
      );
    return NextResponse.json(
      {
        issuer: "https://business.jktl.com.ng",
        audience: b.projectId,
        subject: result.user_id,
        organizationId: result.organization_id,
        email: result.email,
        name: result.name,
        scope:
          Array.isArray(result.scopes) && Array.isArray(result.current_scopes)
            ? result.scopes.filter((v: string) =>
                result.current_scopes.includes(v),
              )
            : [],
        expiresIn: 300,
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { error: "Grant exchange unavailable or invalid" },
      { status: 400, headers },
    );
  }
}
