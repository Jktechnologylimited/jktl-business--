import { NextRequest, NextResponse } from "next/server";
import { publicDomainSearch } from "@/lib/domains/discovery";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  try {
    if (
      !req.headers.get("content-type")?.startsWith("application/json") ||
      Number(req.headers.get("content-length") || 0) > 1024
    )
      return NextResponse.json(
        { error: "Invalid search." },
        { status: 400, headers },
      );
    const text = await req.text();
    if (text.length > 1024)
      return NextResponse.json(
        { error: "Invalid search." },
        { status: 400, headers },
      );
    const ip = (
      req.headers.get("x-vercel-forwarded-for") ||
      req.headers.get("x-forwarded-for") ||
      "unknown"
    )
      .split(",")[0]
      .trim()
      .slice(0, 100);
    return NextResponse.json(await publicDomainSearch(JSON.parse(text), ip), {
      headers,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    const limited = message.startsWith("Too many");
    const valid = /^(Enter |Use |Choose |JKTL platform)/.test(message);
    return NextResponse.json(
      {
        error: limited
          ? "Too many searches. Please try again shortly."
          : valid
            ? message
            : "Availability could not be confirmed. Please try again shortly.",
      },
      {
        status: limited ? 429 : valid ? 400 : 503,
        headers: { ...headers, ...(limited ? { "Retry-After": "60" } : {}) },
      },
    );
  }
}
