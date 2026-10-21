import { NextRequest, NextResponse } from "next/server";
import { listDailySummaries } from "@/lib/db/push";
import { sendPush } from "@/lib/push";
import { formatKobo } from "@/lib/format";
import { lagosYesterdayRangeUTC } from "@/lib/timezone";

/**
 * NO LONGER SCHEDULED — see `/api/cron/daily`.
 *
 * Vercel's Hobby plan allows only two cron jobs per project and each may run once
 * a day, so every job was consolidated into the daily sweep. This route is kept
 * because it is genuinely useful: trigger one step by hand while debugging, or
 * point an external scheduler at it once you outgrow Hobby. Its logic is the same
 * code the sweep calls.
 */


/**
 * Triggered by Vercel Cron (see `vercel.json`) once a day. Same
 * `CRON_SECRET`-gated pattern as `/api/cron/renewal-reminders` — refuses
 * to run at all if the secret isn't configured, and requires Vercel's own
 * Bearer token otherwise, so this can't be hit by anyone else.
 *
 * Replaces the old "Daily summary email" placeholder (Resend was never
 * actually wired up for it) with a real push notification, sent only to
 * businesses that have both push and this specific toggle turned on.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured — refusing to run." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { start, end } = lagosYesterdayRangeUTC();
    const summaries = await listDailySummaries(start, end);
    const results = await Promise.allSettled(
      summaries.map((s) => {
        // Lead with whatever the owner needs to act on. "You are owed ₦X" is
        // worth more at 6am than a tally of yesterday, and a business with a
        // clean book gets the plain numbers instead of a scolding.
        const parts: string[] = [];
        if (s.todayBookings > 0) parts.push(`${s.todayBookings} booked today`);
        parts.push(`${formatKobo(s.revenueKobo)} yesterday`);
        if (s.overdueCount > 0) parts.push(`${formatKobo(s.owedKobo)} overdue`);
        else if (s.owedKobo > 0) parts.push(`${formatKobo(s.owedKobo)} outstanding`);

        return sendPush(s.organizationId, {
          title: s.overdueCount > 0 ? "You're owed money" : "Your day ahead",
          body: parts.join(" · "),
          url: "/business/reports",
        });
      }),
    );
    const sent = results.filter((r) => r.status === "fulfilled").length;
    return NextResponse.json({ checked: summaries.length, sent });
  } catch (err) {
    console.error("daily-summary cron failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
