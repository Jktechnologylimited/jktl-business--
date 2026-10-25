import { NextResponse } from "next/server";
import { query } from "@/lib/custom/service";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const headers = {
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin":
      request.headers.get("origin") === "https://www.jktl.com.ng"
        ? "https://www.jktl.com.ng"
        : "https://jktl.com.ng",
    Vary: "Origin",
  };
  try {
    const features = await query(
      `SELECT slug,name,category,route,description,(is_new AND(starts_at IS NULL OR starts_at<=now())AND(ends_at IS NULL OR ends_at>now())) AS show_new,ends_at,starts_at FROM feature_registry ORDER BY name`,
    );
    return NextResponse.json({ features }, { headers });
  } catch {
    return NextResponse.json({ features: [] }, { headers, status: 503 });
  }
}
