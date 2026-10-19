import { NextRequest, NextResponse } from "next/server";
import { accrueDueRecurringCommissions } from "@/lib/db/affiliates";
import { pruneAffiliatePasswordResets } from "@/lib/db/affiliate-auth";

/**
 * Credits the recurring ₦3,500 a month each active referral is owed.
 *
 * Separate from the Paystack webhook, which credits a month at the moment a
 * payment arrives. This is the safety net for the months that arrive some other
 * way: a subscription renewing by a route we do not process, a webhook that was
 * lost, or a payment that was recorded by hand. Without it a partner silently
 * loses a month, and "we noticed we underpaid you" is not a recoverable
 * conversation.
 *
 * Safe to run daily and safe to run twice: the unique index on
 * (affiliate, business, month) means a month can only ever be credited once, so
 * this can only ever fill a gap.
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
    const result = await accrueDueRecurringCommissions();

    // Password-reset tokens are short-lived credentials; an expired row is only a
    // liability, and the table should not grow forever. A week of slack in case
    // anybody is investigating an abuse report.
    const prunedResets = await pruneAffiliatePasswordResets(7).catch((err) => {
      console.error("pruneAffiliatePasswordResets failed:", err);
      return 0;
    });

    return NextResponse.json({ ok: true, ...result, prunedResets });
  } catch (err) {
    console.error("affiliate-commissions cron failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
