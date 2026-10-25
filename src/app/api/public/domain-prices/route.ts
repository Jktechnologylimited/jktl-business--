import { NextResponse } from "next/server";
import { publicPrices } from "@/lib/domains/service";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return NextResponse.json(
      { prices: await publicPrices() },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Domain catalogue unavailable", prices: [] },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
