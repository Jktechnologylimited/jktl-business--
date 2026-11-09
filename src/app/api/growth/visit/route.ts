import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/custom/service";
import { authRateLimit } from "@/lib/security/auth-rate-limit";
import {
  VISIT_COOKIE,
  validVisit,
  publicGrowthPath,
} from "@/lib/growth/visits";
const allowed = new Set([
  "https://jktl.com.ng",
  "https://www.jktl.com.ng",
  "https://business.jktl.com.ng",
]);
function origin(req: NextRequest) {
  const o = req.headers.get("origin") || "";
  return allowed.has(o) ? o : null;
}
function cors(o: string) {
  return {
    "Access-Control-Allow-Origin": o,
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}
export async function OPTIONS(req: NextRequest) {
  const o = origin(req);
  return new NextResponse(null, {
    status: o ? 204 : 403,
    headers: o
      ? {
          ...cors(o),
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        }
      : {},
  });
}
export async function POST(req: NextRequest) {
  const o = origin(req);
  if (!o)
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  const reply = (v: unknown, status = 200) =>
    NextResponse.json(v, {
      status,
      headers: { ...cors(o), "Cache-Control": "no-store" },
    });
  try {
    if (Number(req.headers.get("content-length") || 0) > 1000)
      return reply({ error: "Invalid request" }, 413);
    const text = await req.text();
    if (text.length > 1000) return reply({ error: "Invalid request" }, 413);
    const body = JSON.parse(text);
    const current = req.cookies.get(VISIT_COOKIE)?.value;
    const cookie = {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      domain: ".jktl.com.ng",
      path: "/",
    };
    if (body.consent === false) {
      if (current && validVisit(current))
        await query("DELETE FROM growth_visits WHERE id=$1", [current]);
      const r = reply({ ok: true });
      r.cookies.set(VISIT_COOKIE, "", { ...cookie, maxAge: 0 });
      return r;
    }
    const pathname = publicGrowthPath(body.path);
    const intent = ["registration_started", "template_selected"].includes(
      body.event,
    );
    if (
      body.consent !== true ||
      (!pathname && !intent) ||
      req.headers.get("sec-gpc") === "1" ||
      req.headers.get("dnt") === "1"
    )
      return reply({ error: "Optional analytics not permitted" }, 400);
    await authRateLimit(
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown",
      "growth-visit",
      30,
      3600,
    );
    const existing =
      current && validVisit(current)
        ? (
            await query(
              "SELECT id FROM growth_visits WHERE id=$1 AND expires_at>now()",
              [current],
            )
          )[0]
        : null;
    const id =
      existing?.id ||
      (await query("INSERT INTO growth_visits DEFAULT VALUES RETURNING id"))[0]
        .id;
    if (pathname)
      await query(
        "INSERT INTO growth_visit_pages(visit_id,path) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [id, pathname],
      );
    await query("UPDATE growth_visits SET last_seen_at=now() WHERE id=$1", [
      id,
    ]);
    await import("@/lib/growth/funnel").then((m) =>
      m.recordConsentedFunnel(String(id), pathname, body.event, body.utm),
    );
    const r = reply({ ok: true });
    if (!existing)
      r.cookies.set(VISIT_COOKIE, String(id), {
        ...cookie,
        maxAge: 30 * 86400,
      });
    return r;
  } catch {
    return reply({ error: "Analytics temporarily unavailable" }, 503);
  }
}
