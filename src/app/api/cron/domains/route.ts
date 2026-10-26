import { cleanReferralVisits } from "@/lib/distribution/referrals";
import { flushProgramNotices } from "@/lib/distribution/notifications";
import { reconcileDistributionPayments } from "@/lib/distribution/finance";
import { processPartnerNotices } from "@/lib/partners/notifications";
import { processSupportNotifications } from "@/lib/support/notifications";
import { runEmailMaintenance } from "@/lib/business-email/notifications";
import { runCustomMaintenance } from "@/lib/custom/notifications";
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { runDomainMaintenance } from "@/lib/domains/notifications";
export const maxDuration = 60;
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 503 },
    );
  const supplied = Buffer.from(req.headers.get("authorization") || "");
  const expected = Buffer.from("Bearer " + secret);
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const results = await Promise.allSettled([
      processSupportNotifications(),
      runDomainMaintenance(),
      runCustomMaintenance(),
      runEmailMaintenance(),
      processPartnerNotices(),
      reconcileDistributionPayments(),
      flushProgramNotices(),
      cleanReferralVisits(),
    ]);
    const failed = results.some(
      (r) =>
        r.status === "rejected" ||
        (r.status === "fulfilled" &&
          typeof r.value === "object" &&
          r.value.failed > 0),
    );
    return NextResponse.json(
      {
        ok: !failed,
        domain:
          results[1].status === "fulfilled"
            ? results[1].value
            : "Retry required",
        email:
          results[3].status === "fulfilled"
            ? results[3].value
            : "Retry required",
        custom:
          results[2].status === "fulfilled"
            ? results[2].value
            : "Retry required",
      },
      { status: failed ? 503 : 200 },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Domain notifications will retry. Check database and transactional email configuration.",
      },
      { status: 503 },
    );
  }
}
