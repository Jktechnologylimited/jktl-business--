import "server-only";
import { runAutoCharge } from "@/lib/ai/auto-charge";
import { runLineRentals } from "@/lib/ai/line-rental";
import { listNudgeCandidates, runNudges } from "@/lib/db/nudges";
import { getContract, listContractsDue, listLowBalanceWallets } from "@/lib/db/receptionist";
import { getBusinessProfile, getOwnerEmail, listUpcomingRenewals } from "@/lib/db/organizations";
import { listDailySummaries } from "@/lib/db/push";
import { sendPush } from "@/lib/push";
import { sendProspectOutreachEmail, sendRenewalReminderEmail, sendReceptionistOpsEmail } from "@/lib/email";
import { formatKobo } from "@/lib/format";
import { lagosYesterdayRangeUTC } from "@/lib/timezone";
import { accrueDueRecurringCommissions } from "@/lib/db/affiliates";
import { pruneAffiliatePasswordResets } from "@/lib/db/affiliate-auth";
import { advanceSiteBuildJob, getRunningSiteBuildJob } from "@/lib/prospects/site-batch";
import { amountForMonth, DEFAULT_CONTRACT_TERMS } from "@/lib/ai/pricing";
import {
  advanceSequence,
  countSentToday,
  countryRuleMap,
  getOutreachSettings,
  listDueSequenceSends,
  recordBlockedReason,
  recordSequenceOutreach,
} from "@/lib/db/prospects";
import { dueStep, nextOutreachAt, renderStep } from "@/lib/prospects/sequence";
import { decideOutreach } from "@/lib/prospects/jurisdictions";
import { unsubscribeUrlFor } from "@/lib/prospects/outreach";

/**
 * Everything the platform has to do on its own, in one run.
 *
 * **This exists because of a hard hosting limit.** Vercel's Hobby plan allows
 * *two* cron jobs per project and each may run only **once a day** — a schedule
 * like `*​/5 * * * *` fails the deployment outright. The app had five jobs, one of
 * them every five minutes, so it could not deploy on Hobby at all. Everything is
 * now one daily sweep.
 *
 * Consequences that shaped the design:
 *
 *   - **Order matters.** Money is collected before anyone is chased for it, so
 *     anything still outstanding afterwards is a genuine exception rather than an
 *     artefact of the order.
 *   - **A step may not take the run down.** Each is isolated: one failing does not
 *     stop the next, and its error is reported rather than swallowed. There are no
 *     cron retries and no failure alerts on any plan, so the returned summary is
 *     the only signal an operator gets.
 *   - **There is a deadline.** Serverless functions are killed at a limit; a sweep
 *     that is still working when that happens loses the rest silently. Every step
 *     checks the clock before starting, and the slow one (site generation) runs
 *     last with whatever time is left.
 *   - **Every step is idempotent.** It has to be: the timing window on Hobby is a
 *     whole hour, runs can be 23 or 25 hours apart, and a deploy can re-trigger
 *     one. Subscription months, line rentals, commissions and tokens are all
 *     guarded by unique keys, so running twice costs nothing.
 */

export interface StepResult {
  name: string;
  ok: boolean;
  /** Human-readable outcome — the count, or the error. */
  detail: string;
  ms: number;
}

export interface DailySweepResult {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  steps: StepResult[];
  /** True when the deadline stopped steps from starting. */
  truncated: boolean;
  failed: number;
}

/** Default budget. Vercel Hobby caps a function at 60s; leaving headroom means we
 * return a report rather than being killed mid-write. */
const DEFAULT_BUDGET_MS = 45_000;

/** The public origin, for the site link and the unsubscribe link in a sequence
 * email. Same resolution order as the admin send path; local so the cron does
 * not depend on a Server Action module (and its `revalidatePath`). */
function appOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "jktl.com.ng";
  return `https://${root}`;
}

export async function runDailySweep(budgetMs = DEFAULT_BUDGET_MS): Promise<DailySweepResult> {
  const startedAt = new Date();
  const deadline = startedAt.getTime() + budgetMs;
  const steps: StepResult[] = [];
  let truncated = false;

  const remaining = () => deadline - Date.now();

  async function step(name: string, run: () => Promise<string>): Promise<void> {
    if (remaining() <= 2_000) {
      truncated = true;
      steps.push({ name, ok: false, detail: "Skipped — out of time budget", ms: 0 });
      return;
    }
    const t0 = Date.now();
    try {
      const detail = await run();
      steps.push({ name, ok: true, detail, ms: Date.now() - t0 });
    } catch (err) {
      // Reported, never rethrown: one broken integration must not stop the money
      // being collected by the next step.
      steps.push({
        name,
        ok: false,
        detail: err instanceof Error ? err.message.slice(0, 300) : "failed",
        ms: Date.now() - t0,
      });
    }
  }

  /* ---------------------------------------------------------------------- */
  /* 1. Money in                                                            */
  /* ---------------------------------------------------------------------- */

  await step("subscription-collection", async () => {
    const result = await runAutoCharge();
    return `${result.charged} charged, ${result.failed} failed, ${result.noCard} without a card (of ${result.attempted})`;
  });

  await step("line-rentals", async () => {
    const result = await runLineRentals();
    return `${result.charged} charged, ${result.unpaid} unpaid wallets`;
  });

  await step("affiliate-commissions", async () => {
    const result = await accrueDueRecurringCommissions();
    return `${result.credited} month${result.credited === 1 ? "" : "s"} credited across ${result.affiliates} partner(s)`;
  });

  /* ---------------------------------------------------------------------- */
  /* 2. Chase the exceptions                                                */
  /* ---------------------------------------------------------------------- */

  await step("receptionist-reminders", async () => {
    const [lowWallets, allDue] = await Promise.all([listLowBalanceWallets(200), listContractsDue(200)]);

    const dueContracts = [];
    for (const contract of allDue) {
      const fresh = await getContract(contract.organizationId);
      if (!fresh?.nextChargeAt) continue;
      if (new Date(fresh.nextChargeAt).getTime() > Date.now()) continue;
      dueContracts.push(fresh);
    }

    const results = await Promise.allSettled([
      ...lowWallets.map(async (wallet) => {
        const [profile, ownerEmail] = await Promise.all([
          getBusinessProfile(wallet.organizationId),
          getOwnerEmail(wallet.organizationId),
        ]);
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
    return `${lowWallets.length} low wallet(s), ${dueContracts.length} due contract(s), ${failed} failed`;
  });

  /* ---------------------------------------------------------------------- */
  /* 3. Nudges                                                              */
  /* ---------------------------------------------------------------------- */

  await step("setup-nudges", async () => {
    const targets = await listNudgeCandidates(200);
    const result = await runNudges(targets);
    return `${result.sent} sent of ${result.evaluated} evaluated`;
  });

  /* ---------------------------------------------------------------------- */
  /* 4. Plan renewals and the morning summary                               */
  /* ---------------------------------------------------------------------- */

  await step("renewal-reminders", async () => {
    // Seven days ahead, matched exactly, so one email per renewal cycle. With
    // Hobby's hour-wide window the run still lands on the right day.
    const renewals = await listUpcomingRenewals(7);
    const results = await Promise.allSettled(
      renewals.map((renewal) =>
        sendRenewalReminderEmail({
          to: renewal.ownerEmail,
          businessName: renewal.businessName,
          renewalDate: renewal.renewalDate,
          priceKobo: renewal.priceKoboPerYear,
        }),
      ),
    );
    return `${results.filter((r) => r.status === "fulfilled").length} of ${renewals.length} sent`;
  });

  await step("daily-summary", async () => {
    const { start, end } = lagosYesterdayRangeUTC();
    const summaries = await listDailySummaries(start, end);
    const results = await Promise.allSettled(
      summaries.map((summary) => {
        const parts: string[] = [];
        if (summary.todayBookings > 0) parts.push(`${summary.todayBookings} booked today`);
        parts.push(`${formatKobo(summary.revenueKobo)} yesterday`);
        if (summary.overdueCount > 0) parts.push(`${formatKobo(summary.owedKobo)} overdue`);
        else if (summary.owedKobo > 0) parts.push(`${formatKobo(summary.owedKobo)} outstanding`);
        return sendPush(summary.organizationId, {
          title: summary.overdueCount > 0 ? "You're owed money" : "Your day ahead",
          body: parts.join(" · "),
          url: "/business/reports",
        });
      }),
    );
    return `${results.filter((r) => r.status === "fulfilled").length} of ${summaries.length} sent`;
  });

  /* ---------------------------------------------------------------------- */
  /* 5. Housekeeping                                                        */
  /* ---------------------------------------------------------------------- */

  await step("prune-reset-tokens", async () => {
    const pruned = await pruneAffiliatePasswordResets(7);
    return `${pruned} expired token(s) removed`;
  });

  /* ---------------------------------------------------------------------- */
  /* 5b. The staged outreach sequence                                       */
  /* ---------------------------------------------------------------------- */

  /**
   * One sequence step per prospect, capped, before the slow site build.
   *
   * **Why this runs here and not in the admin action.** A four-step sequence
   * spread over three weeks only works if something sends step two without a
   * human remembering to, and the daily sweep is the only thing that runs on its
   * own.
   *
   * Three limits, all deliberate:
   *
   *   - **The daily send cap is shared with the manual send.** `countSentToday`
   *     counts every send in the last 24 hours, so the sequence and the admin
   *     cannot together exceed the cap that keeps the sending domain alive.
   *   - **The batch is bounded by the remaining cap**, so the limit is the cap
   *     rather than whatever happens to be due.
   *   - **The clock is checked inside the loop.** Serverless functions are killed
   *     at a limit, and a sweep killed mid-loop loses the rest silently; stopping
   *     early leaves those prospects due tomorrow instead.
   *
   * One prospect cannot take the run down: every iteration is wrapped, and a
   * failure is counted and reported rather than rethrown. The jurisdiction gate
   * is enforced here exactly as it is in `sendOutreachAction`, with the refusal
   * recorded on the prospect — this is the guard that keeps the company out of
   * trouble, so it is not optional for automated sends.
   */
  await step("outreach-sequences", async () => {
    const settings = await getOutreachSettings();
    const sentSoFar = await countSentToday();
    const budget = Math.max(0, settings.dailySendCap - sentSoFar);
    if (budget === 0) return `daily cap of ${settings.dailySendCap} already reached`;

    const now = new Date();
    const candidates = await listDueSequenceSends(budget);
    if (candidates.length === 0) return "nothing due";

    // Loaded once rather than per prospect: a country rule lookup per row would
    // be forty round trips for a forty-row batch.
    const rules = await countryRuleMap();
    const origin = appOrigin();

    let sent = 0;
    let skipped = 0;
    let blocked = 0;
    let failed = 0;
    const problems: string[] = [];

    for (const prospect of candidates) {
      if (sent >= budget) break;
      if (remaining() < 5_000) break;

      try {
        const stepKey = dueStep({
          currentStepKey: prospect.currentStepKey,
          lastSentAt: prospect.lastSentAt,
          now,
          replied: prospect.status === "replied",
          unsubscribed: prospect.suppressed || prospect.status === "suppressed",
          converted: prospect.status === "converted",
        });
        // Not actually due yet (a row scheduled early, or already finished): the
        // query is a coarse filter, the pure rule is the decision.
        if (!stepKey) {
          skipped += 1;
          continue;
        }

        const decision = decideOutreach({
          country: prospect.country,
          consentAt: prospect.consentAt,
          overrideRule: rules[(prospect.country || "").toUpperCase()],
        });
        if (!decision.allowed) {
          blocked += 1;
          await recordBlockedReason(prospect.id, decision.reason);
          continue;
        }

        const email = renderStep(stepKey, {
          businessName: prospect.businessName,
          city: prospect.city,
          siteUrl: `${origin}/sites/${prospect.siteSubdomain}`,
          myBusiness: settings.senderBusinessName,
          unsubscribeUrl: unsubscribeUrlFor(origin, prospect.unsubscribeToken),
        });
        if (!email) {
          skipped += 1;
          continue;
        }

        const result = await sendProspectOutreachEmail({
          to: prospect.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
          replyTo: settings.replyTo || undefined,
        });

        if (result.ok) {
          await recordSequenceOutreach({
            prospectId: prospect.id,
            toEmail: prospect.email,
            subject: email.subject,
            body: email.text,
            stepKey,
            status: "sent",
          });
          // Null on the final step, which is what takes the prospect out of the
          // due query for good without a second "finished" flag.
          await advanceSequence(prospect.id, stepKey, nextOutreachAt(stepKey, now));
          sent += 1;
        } else {
          failed += 1;
          problems.push(`${prospect.businessName}: ${result.error}`);
          // Recorded with step_key '' so this failure does not consume the
          // unique slot and retire the step for a transient provider error.
          await recordSequenceOutreach({
            prospectId: prospect.id,
            toEmail: prospect.email,
            subject: email.subject,
            body: email.text,
            stepKey,
            status: "failed",
            error: result.error,
          });
        }
      } catch (err) {
        failed += 1;
        problems.push(`${prospect.businessName}: ${err instanceof Error ? err.message.slice(0, 120) : "failed"}`);
      }
    }

    const detail = `${sent} sent, ${blocked} blocked by country rule, ${failed} failed, ${skipped} not due`;
    return problems.length ? `${detail} — first: ${problems[0]}` : detail;
  });

  /* ---------------------------------------------------------------------- */
  /* 6. The slow one, last, with whatever time is left                      */
  /* ---------------------------------------------------------------------- */

  await step("site-build", async () => {
    const job = await getRunningSiteBuildJob();
    if (!job) return "no job in progress";

    // One batch per day is the Hobby reality. The batch itself multiplies site
    // count, not wall clock, so it is bounded by the remaining budget rather than
    // by a fixed number.
    let built = 0;
    let batches = 0;
    while (remaining() > 8_000 && batches < 4) {
      const before = job.built;
      const after = await advanceSiteBuildJob(job.id);
      batches += 1;
      if (!after) break;
      built += Math.max(0, after.built - before) + Math.max(0, after.skipped - job.skipped);
      if (after.status !== "running") {
        return `${after.built} built of ${after.total} this job, now ${after.status}`;
      }
      if (after.built === before && after.skipped === job.skipped) break;
    }
    return `${built} site(s) built this run (${batches} batch(es)); job still running`;
  });

  const finishedAt = new Date();
  return {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    steps,
    truncated,
    failed: steps.filter((s) => !s.ok).length,
  };
}
