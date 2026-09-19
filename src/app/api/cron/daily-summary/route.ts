import { NextRequest, NextResponse } from "next/server";
import { listDailySummaries } from "@/lib/db/push";
import { sendPush } from "@/lib/push";
import { formatKobo } from "@/lib/format";
import { lagosYesterdayRangeUTC } from "@/lib/timezone";

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
      summaries.map((s) =>
        sendPush(s.organizationId, {
          title: "Yesterday's numbers",
          body: `${s.salesCount} sale${s.salesCount === 1 ? "" : "s"} · ${formatKobo(s.revenueKobo)} · ${s.bookingsCount} booking${s.bookingsCount === 1 ? "" : "s"}`,
          url: "/business/reports",
        }),
      ),
    );
    const sent = results.filter((r) => r.status === "fulfilled").length;
    return NextResponse.json({ checked: summaries.length, sent });
  } catch (err) {
    console.error("daily-summary cron failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
