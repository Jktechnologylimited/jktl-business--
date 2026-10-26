import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { query } from "@/lib/custom/service";
import { rateLimit } from "@/lib/domains/store";
function origin(req: NextRequest) {
  const value = req.headers.get("origin") || "";
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "jktl.com.ng";
  const trusted = [
    `https://${root}`,
    `https://www.${root}`,
    `https://business.${root}`,
    `https://app.${root}`,
  ];
  if (value === req.nextUrl.origin || trusted.includes(value)) return value;
  return null;
}
function headers(value: string) {
  return {
    "Access-Control-Allow-Origin": value,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
    "Cache-Control": "no-store",
  };
}
export async function OPTIONS(req: NextRequest) {
  const o = origin(req);
  return new NextResponse(null, {
    status: o ? 204 : 403,
    headers: o ? headers(o) : undefined,
  });
}
export async function POST(req: NextRequest) {
  const o = origin(req);
  if (!o)
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400, headers: headers(o) },
    );
  }
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "jktl.com.ng",
    host = req.nextUrl.hostname;
  const cookie = {
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax" as const,
    path: "/",
    ...(host === root || host.endsWith("." + root) ? { domain: root } : {}),
  };
  if (body.decline === true) {
    const response = NextResponse.json(
      { tracked: false },
      { headers: headers(o) },
    );
    response.cookies.set("jktl_referral_visit", "", { ...cookie, maxAge: 0 });
    return response;
  }
  const code = String(body.code || "").toUpperCase();
  if (body.consent !== true || !/^[A-Z0-9_-]{3,64}$/.test(code))
    return NextResponse.json(
      { error: "Consent and a valid referral code are required" },
      { status: 400, headers: headers(o) },
    );
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    await rateLimit(
      query,
      createHash("sha256").update(ip).digest("hex"),
      "referral-capture",
      12,
      3600,
    );
    const a = (
      await query(
        "SELECT id FROM affiliates WHERE referral_code=$1 AND status='active'",
        [code],
      )
    )[0];
    if (!a)
      return NextResponse.json({ tracked: false }, { headers: headers(o) });
    const previous = req.cookies.get("jktl_referral_visit")?.value;
    let v: Record<string, unknown> | undefined;
    if (previous && /^[0-9a-f-]{36}$/i.test(previous))
      v = (
        await query(
          "SELECT id FROM distribution_referral_visits WHERE id=$1 AND affiliate_id=$2 AND expires_at>now() AND consumed_organization_id IS NULL",
          [previous, a.id],
        )
      )[0];
    if (!v)
      v = (
        await query(
          "INSERT INTO distribution_referral_visits(affiliate_id) VALUES($1) RETURNING id",
          [a.id],
        )
      )[0];
    const response = NextResponse.json(
      { tracked: true },
      { headers: headers(o) },
    );
    response.cookies.set("jktl_referral_visit", String(v.id), {
      ...cookie,
      maxAge: 30 * 86400,
    });
    return response;
  } catch {
    return NextResponse.json(
      {
        error:
          "Referral tracking is temporarily unavailable. You can continue without it.",
      },
      { status: 503, headers: headers(o) },
    );
  }
}
