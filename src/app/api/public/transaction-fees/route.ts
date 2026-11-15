import { NextResponse } from "next/server";
import { activeFeePolicy, activationGate } from "@/lib/merchant-fees/service";
import { publicResponseCache, noResponseCache } from "@/lib/public-response-cache";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const policy = activationGate() === "live" ? await activeFeePolicy() : null;
    return NextResponse.json(
      policy
        ? {
            approved: true,
            currency: "NGN",
            buyerPaid: true,
            bands: policy.enabled && policy.sources.includes("INVOICE") ? policy.bands : [{ minKobo: 0, feeKobo: 0 }],
            sources: ["INVOICE"],
          }
        : { approved: false },
      { headers: publicResponseCache() },
    );
  } catch {
    return NextResponse.json(
      { approved: false },
      { status: 503, headers: noResponseCache },
    );
  }
}
