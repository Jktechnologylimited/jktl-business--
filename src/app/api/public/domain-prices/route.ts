import { NextResponse } from "next/server";
import { publicPrices } from "@/lib/domains/service";
import { publicResponseCache, noResponseCache } from "@/lib/public-response-cache";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return NextResponse.json(
      { prices: await publicPrices() },
      {
        headers: publicResponseCache(),
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Domain catalogue unavailable", prices: [] },
      { status: 503, headers: noResponseCache },
    );
  }
}
