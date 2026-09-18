import { NextRequest, NextResponse } from "next/server";
import { listUpcomingRenewals } from "@/lib/db/organizations";
import { sendRenewalReminderEmail } from "@/lib/email";

// How many days before renewal the reminder goes out. The query below looks
// for an exact match on this, so each organization gets exactly one email
// per renewal cycle — not a fresh one every day inside a "within N days"
// window. Trade-off: if this route doesn't run on that exact day (a missed
// or delayed cron invocation), that org's reminder for this cycle is simply
// skipped rather than caught up later.
const REMINDER_DAYS_AHEAD = 7;

/**
 * Triggered by Vercel Cron (see `vercel.json`) once a day. Not meant to be
 * called by anything else — protected by `CRON_SECRET`, which Vercel
 * automatically sends as a Bearer token when it invokes a cron job once
 * that environment variable is set on the project. Without `CRON_SECRET`
 * configured, this route refuses every request rather than running exposed
 * to the open internet.
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
    const renewals = await listUpcomingRenewals(REMINDER_DAYS_AHEAD);
    const results = await Promise.allSettled(
      renewals.map((r) =>
        sendRenewalReminderEmail({
          to: r.ownerEmail,
          businessName: r.businessName,
          renewalDate: r.renewalDate,
          priceKobo: r.priceKoboPerYear,
        }),
      ),
    );
    const sent = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;

    return NextResponse.json({ checked: renewals.length, sent, failed: renewals.length - sent });
  } catch (err) {
    console.error("renewal-reminders cron failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
