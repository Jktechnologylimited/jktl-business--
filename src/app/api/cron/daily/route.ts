import { NextRequest, NextResponse } from "next/server";
import { runDailySweep } from "@/lib/cron/daily-sweep";

/**
 * The one scheduled job.
 *
 * Vercel's Hobby plan allows **two** cron jobs per project, each once a day, with
 * ±1 hour timing precision and no retries — and it *fails the deployment* if any
 * schedule is more frequent than daily. The app previously declared five, one of
 * them every five minutes, so it could not deploy on Hobby at all.
 *
 * Everything now runs from here. See `src/lib/cron/daily-sweep.ts` for the order
 * and the reasoning, and `/admin/insights` for what the results mean.
 *
 * The response body is the only failure signal there is: Vercel does not retry a
 * failed cron or alert anyone, so each step's outcome is reported in the JSON and
 * a non-2xx status is returned when any step failed, so an uptime check or an
 * external scheduler can see it.
 *
 * The per-feature routes (`/api/cron/receptionist`, `/api/cron/build-sites`,
 * …) are still there and still work — useful for triggering a step by hand or
 * from an external scheduler when you outgrow Hobby. They are simply no longer
 * scheduled.
 */

/** Vercel Hobby caps a function at 60s. The sweep has its own 45s budget so it
 * returns a report instead of being killed mid-write. */
export const maxDuration = 60;

/**
 * The internal budget, overridable.
 *
 * Hobby may cap the function lower than 60s depending on whether Fluid compute is
 * enabled. If a run is killed part-way, the steps that already finished stay
 * finished — every one is idempotent — and because the money steps run first, the
 * step that gets lost is the site build, which is the only one that can simply
 * wait for tomorrow or be triggered by hand.
 */
function budgetMs(): number {
  const configured = Number(process.env.CRON_BUDGET_MS);
  return Number.isFinite(configured) && configured > 5_000 ? configured : 35_000;
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured — refusing to run." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDailySweep(budgetMs());
    return NextResponse.json(
      { ok: result.failed === 0, ...result },
      // 207 when some steps failed: the run did happen, and the caller should be
      // able to tell that apart from "the route is broken".
      { status: result.failed === 0 ? 200 : 207 },
    );
  } catch (err) {
    console.error("daily cron failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
