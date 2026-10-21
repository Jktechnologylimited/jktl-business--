import { NextRequest, NextResponse } from "next/server";
import { getContract, listContractsDue, listLowBalanceWallets } from "@/lib/db/receptionist";
import { runAutoCharge } from "@/lib/ai/auto-charge";
import { runLineRentals } from "@/lib/ai/line-rental";
import { listNudgeCandidates, runNudges } from "@/lib/db/nudges";
import { getBusinessProfile, getOwnerEmail } from "@/lib/db/organizations";
import { sendReceptionistOpsEmail } from "@/lib/email";
import { sendPush } from "@/lib/push";
import { amountForMonth, DEFAULT_CONTRACT_TERMS } from "@/lib/ai/pricing";
import { formatKobo } from "@/lib/format";

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
 * Daily operational sweep for the AI receptionist. Three jobs:
 *
 *   1. **Collect the subscription.** Every contract with a card on file that
 *      has a month due is charged automatically. This is the job that means a
 *      clinic never has to log in to keep its phone line answering.
 *   2. **Nudge what is missing.** Automated push notifications for app users —
 *      add a card so you get paid while you sleep, add a number, top up. At
 *      most one per business per run, so setup arrives as a sequence rather
 *      than an avalanche.
 *   3. **Chase the exceptions.** A clinic with no card, or a failed charge, or
 *      a wallet running dry:
 *
 *   1. **Low communication wallets.** A clinic below its threshold is one
 *      message away from the pipeline recording `sms_blocked` calls instead of
 *      recovering them. That is a silent failure mode from the clinic's point
 *      of view, so it is chased by email and push until topped up.
 *   2. **Platform fees that have come due.** The ₦59,000 monthly tier starts
 *      in month 7 (see `billingStartFrom`) — this is the reminder, not the
 *      charge. Collection reuses the same Paystack subscription machinery as
 *      the Website & Hosting plan.
 *
 * The reminder emails are safe to run daily because they only go to contracts
 * that could not be collected automatically — a clinic whose card works never
 * hears from this job at all.
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
    // 1. Take the money first, so anything still due afterwards is genuinely an
    //    exception rather than an artefact of the order things run in.
    const autoCharge = await runAutoCharge();

    // 2. Bill each clinic for its own dedicated line, out of the same wallet it
    //    uses for messaging — Option A. Runs after subscription collection so a
    //    clinic that has just been charged is not also chased for rent in the
    //    same breath.
    const lineRentals = await runLineRentals();

    // 3. Nudge app users about what is missing.
    const nudgeTargets = await listNudgeCandidates(200);
    const nudges = await runNudges(nudgeTargets);

    const [lowWallets, allDue] = await Promise.all([listLowBalanceWallets(200), listContractsDue(200)]);

    // 4. Only the contracts that auto-charge could not settle need a human.
    const dueContracts = [];
    for (const contract of allDue) {
      const fresh = await getContract(contract.organizationId);
      if (!fresh?.nextChargeAt) continue;
      if (new Date(fresh.nextChargeAt).getTime() > Date.now()) continue;
      dueContracts.push(fresh);
    }

    const results = await Promise.allSettled([
      ...lowWallets.map(async (wallet) => {
        const [profile, ownerEmail] = await Promise.all([getBusinessProfile(wallet.organizationId), getOwnerEmail(wallet.organizationId)]);
        const businessName = profile?.displayName ?? "your business";
        await sendPush(wallet.organizationId, {
          title: "Communication wallet running low",
          body: `${businessName}: the AI assistant will stop texting patients back soon. Top up to keep recovering calls.`,
          url: "/business/receptionist",
        });
        if (ownerEmail) {
          await sendReceptionistOpsEmail({
            to: ownerEmail,
            businessName,
            kind: "low_balance",
            amountKobo: wallet.thresholdKobo,
            balanceKobo: wallet.balanceKobo,
          });
        }
      }),
      ...dueContracts.map(async (contract) => {
        const [profile, ownerEmail] = await Promise.all([
          getBusinessProfile(contract.organizationId),
          getOwnerEmail(contract.organizationId),
        ]);
        const businessName = profile?.displayName ?? "your business";
        // What this clinic actually owes next — an instalment of the package
        // during the first six months, the platform tier after — from the same
        // schedule the console's "Pay" button uses.
        const monthIndex = contract.chargesPaid + 1;
        const amountKobo = amountForMonth(monthIndex);
        const isInstalment = monthIndex <= DEFAULT_CONTRACT_TERMS.setupMonths;
        await sendPush(contract.organizationId, {
          title: isInstalment ? "Launch package instalment due" : "AI receptionist fee due",
          body: `${businessName}: ${formatKobo(amountKobo)} is due for month ${monthIndex}.`,
          url: "/business/receptionist",
        });
        if (ownerEmail) {
          await sendReceptionistOpsEmail({
            to: ownerEmail,
            businessName,
            kind: "fee_due",
            amountKobo,
            monthIndex,
            isInstalment,
          });
        }
      }),
    ]);

    const failed = results.filter((r) => r.status === "rejected").length;
    return NextResponse.json({
      ok: true,
      autoCharge,
      lineRentals: { attempted: lineRentals.attempted, charged: lineRentals.charged, unpaid: lineRentals.unpaid },
      nudges: { evaluated: nudges.evaluated, sent: nudges.sent },
      lowWallets: lowWallets.length,
      dueContracts: dueContracts.length,
      failed,
    });
  } catch (err) {
    console.error("receptionist cron failed", err);
    return NextResponse.json({ ok: false, error: "Cron run failed." }, { status: 500 });
  }
}
