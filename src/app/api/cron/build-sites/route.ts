import { NextRequest, NextResponse } from "next/server";
import { advanceSiteBuildJob, getRunningSiteBuildJob } from "@/lib/prospects/site-batch";

/**
 * Advances a running site-build job by one batch.
 *
 * Separate from `/api/cron/receptionist` on purpose. That job handles money and
 * notifications and must stay fast and predictable; this one generates websites,
 * which is slow and entirely opportunistic. Mixing them would mean a build
 * problem could delay a payment collection.
 *
 * Runs every few minutes. Each invocation does a bounded slice — a handful of
 * sites — so it always finishes inside the platform's request timeout, and the
 * job's own progress in the database is what carries the work across invocations.
 * When there is no job running, it returns immediately.
 *
 * Protected by `CRON_SECRET` exactly like the app's other cron routes.
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
    const running = await getRunningSiteBuildJob();
    if (!running) {
      // Nothing to do. Not an error — most invocations of a cron that runs every
      // few minutes land here.
      return NextResponse.json({ ok: true, job: null, detail: "No site build in progress." });
    }

    const job = await advanceSiteBuildJob(running.id);
    return NextResponse.json({
      ok: true,
      job: job
        ? {
            id: job.id,
            status: job.status,
            built: job.built,
            failed: job.failed,
            skipped: job.skipped,
            total: job.total,
            percent: job.percent,
            pending: job.pending,
            imagesMirrored: job.imagesMirrored,
          }
        : null,
    });
  } catch (err) {
    console.error("build-sites cron failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
