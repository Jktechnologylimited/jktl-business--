import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getSql } from "@/lib/db/client";
import { getWebsiteTemplate, templatePageKind } from "@/lib/website-templates";
import { parseSiteEvent, recordSiteEvent } from "@/lib/site-metrics";
export const dynamic = "force-dynamic";
let lastRateCleanup = 0;
export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).host !== request.headers.get("host"))
      return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    if (
      /bot|crawler|spider|headless/i.test(
        request.headers.get("user-agent") || "",
      )
    )
      return new NextResponse(null, { status: 204 });
    const raw = await request.text();
    if (raw.length > 2048)
      return NextResponse.json({ error: "Event too large." }, { status: 413 });
    let event;
    try {
      event = parseSiteEvent(JSON.parse(raw));
    } catch {
      return NextResponse.json({ error: "Invalid event." }, { status: 400 });
    }
    const template = getWebsiteTemplate(event.templateId);
    if (!template)
      return NextResponse.json({ error: "Unknown template." }, { status: 400 });
    const sql = getSql();
    const rows =
      await sql`SELECT organization_id,subdomain,custom_domain,custom_domain_verified FROM business_profiles WHERE subdomain=${event.subdomain} AND website_template_id=${event.templateId} AND published=true LIMIT 1`;
    const profile = rows[0];
    if (!profile)
      return NextResponse.json(
        { error: "Website not published." },
        { status: 404 },
      );
    const hostname = (request.headers.get("host") || "")
      .split(":")[0]
      .toLowerCase();
    const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "jktl.com.ng";
    if (
      ![
        "localhost",
        "127.0.0.1",
        `business.${root}`,
        `${event.subdomain}.${root}`,
        ...(profile.custom_domain_verified
          ? [String(profile.custom_domain)]
          : []),
      ].includes(hostname)
    )
      return NextResponse.json(
        { error: "Invalid website host." },
        { status: 403 },
      );
    const hour = Math.floor(Date.now() / 3600000);
    const remote = (request.headers.get("x-forwarded-for") || "local")
      .split(",")[0]
      .trim();
    const bucket = createHash("sha256")
      .update(
        `${hour}:${profile.organization_id}:${remote}:${Math.floor(Date.now() / 60000)}`,
      )
      .digest("hex");
    const allowed =
      await sql`INSERT INTO website_metric_rate_limits(bucket,count,expires_at) VALUES(${bucket},1,now()+interval '1 hour') ON CONFLICT(bucket) DO UPDATE SET count=website_metric_rate_limits.count+1 WHERE website_metric_rate_limits.count<120 RETURNING count`;
    if (!allowed.length) return new NextResponse(null, { status: 429 });
    await recordSiteEvent((text, params) => sql.query(text, params), {
      organizationId: String(profile.organization_id),
      templateId: event.templateId,
      eventId: event.eventId,
      event: event.event,
      kind: templatePageKind(template),
    });
    if (Date.now() - lastRateCleanup > 3600000) {
      lastRateCleanup = Date.now();
      await sql
        .query(
          "DELETE FROM website_metric_rate_limits WHERE expires_at < now()",
          [],
        )
        .catch(() => {});
    }
    return new NextResponse(null, {
      status: 202,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Metrics unavailable." },
      { status: 503 },
    );
  }
}
