import { NextResponse } from "next/server";
import { emailPlans } from "@/lib/business-email/service";
import { publicResponseCache, noResponseCache } from "@/lib/public-response-cache";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return NextResponse.json(
      { plans: await emailPlans() },
      {
        headers: {
          ...publicResponseCache(),
          "Access-Control-Allow-Origin": "https://jktl.com.ng",
        },
      },
    );
  } catch {
    return NextResponse.json({ plans: [] }, { status: 503, headers: {
      ...noResponseCache, "Access-Control-Allow-Origin": "https://jktl.com.ng",
    } });
  }
}
