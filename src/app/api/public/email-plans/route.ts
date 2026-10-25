import { NextResponse } from "next/server";
import { emailPlans } from "@/lib/business-email/service";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return NextResponse.json(
      { plans: await emailPlans() },
      {
        headers: {
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "https://jktl.com.ng",
        },
      },
    );
  } catch {
    return NextResponse.json({ plans: [] }, { status: 503 });
  }
}
