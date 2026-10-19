/**
 * Partner reporting.
 *
 * The dashboard's job is to answer three questions a partner actually has, in
 * this order:
 *
 *   1. **What am I earning, right now, every month?** — the run-rate, not a
 *      lifetime total that includes money from a customer who left.
 *   2. **Is my effort working?** — how many of the businesses I sent actually
 *      subscribed, which is the only number that tells them whether their
 *      messaging or their audience is the problem.
 *   3. **What is one referral worth to me?** — so they can decide whether to keep
 *      chasing a particular kind of business.
 *
 * Pure and dependency-free, so the arithmetic behind a partner's statement is
 * unit tested rather than trusted. This is money owed to people outside the
 * company, and a report that disagrees with the ledger is worse than no report.
 */

import type { EarningKind, EarningStatus } from "./affiliate-commission";

export interface ReportEarning {
  kind: EarningKind;
  status: EarningStatus;
  commissionKobo: number;
  /** 'YYYY-MM' for recurring rows. */
  periodKey?: string;
  organizationId?: string;
  createdAt?: string;
}

export interface ReportReferral {
  organizationId: string;
  displayName: string;
  /** 'active' | 'past_due' | 'canceled' | 'inactive' | 'not_subscribed' … */
  subscriptionStatus: string;
  referredAt: string;
}

/** Statuses that mean the referral is currently paying, so recurring commission
 * is still owed. `past_due` is included deliberately: a card that failed this
 * month may well succeed next month, and dropping the partner's run-rate the
 * moment a customer's card expires would make the number lurch about for reasons
 * the partner cannot see or influence. */
const PAYING_STATUSES = new Set(["active", "past_due"]);

export function isPaying(status: string): boolean {
  return PAYING_STATUSES.has((status || "").toLowerCase());
}

/* -------------------------------------------------------------------------- */
/* Earnings by tier                                                           */
/* -------------------------------------------------------------------------- */

export interface EarningsByKind {
  signupKobo: number;
  subscriptionKobo: number;
  recurringKobo: number;
  /** Legacy rows from the percentage model, kept separate so a historical total
   * is never mixed into a tier. */
  legacyKobo: number;
  totalKobo: number;
}

export function earningsByKind(earnings: ReportEarning[]): EarningsByKind {
  const out: EarningsByKind = { signupKobo: 0, subscriptionKobo: 0, recurringKobo: 0, legacyKobo: 0, totalKobo: 0 };

  for (const earning of earnings) {
    const amount = earning.commissionKobo || 0;
    out.totalKobo += amount;
    switch (earning.kind) {
      case "signup":
        out.signupKobo += amount;
        break;
      case "subscription":
        out.subscriptionKobo += amount;
        break;
      case "recurring":
        out.recurringKobo += amount;
        break;
      default:
        // 'welcome' and 'commission' are the pre-tier programme.
        out.legacyKobo += amount;
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Monthly trend                                                              */
/* -------------------------------------------------------------------------- */

export interface MonthlyPoint {
  /** 'YYYY-MM' */
  month: string;
  amountKobo: number;
  count: number;
}

/**
 * Earnings per calendar month, oldest first.
 *
 * Only months with activity are returned, so the component decides how to fill
 * gaps. A partner with one referral should see one bar, not twelve with eleven
 * empty columns.
 */
export function earningsByMonth(earnings: ReportEarning[]): MonthlyPoint[] {
  const buckets = new Map<string, { amountKobo: number; count: number }>();

  for (const earning of earnings) {
    const month = (earning.createdAt ?? "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    const bucket = buckets.get(month) ?? { amountKobo: 0, count: 0 };
    bucket.amountKobo += earning.commissionKobo || 0;
    bucket.count += 1;
    buckets.set(month, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, amountKobo: v.amountKobo, count: v.count }));
}

/* -------------------------------------------------------------------------- */
/* The referral funnel                                                        */
/* -------------------------------------------------------------------------- */

export interface ReferralFunnel {
  /** Businesses that created an account through the link. */
  signedUp: number;
  /** Of those, how many ever subscribed. */
  subscribed: number;
  /** Of those, how many are still paying. */
  stillPaying: number;
  /** Percent of signups that subscribed. 0 when there are none — never NaN. */
  conversionPct: number;
  /** Percent of subscribers who have since stopped. */
  churnPct: number;
  /** The number that matters most, stated plainly for the dashboard. */
  headline: string;
}

export function referralFunnel(referrals: ReportReferral[], earnings: ReportEarning[] = []): ReferralFunnel {
  const signedUp = referrals.length;

  // "Subscribed" is read from the ledger rather than from the current status:
  // somebody who subscribed and later cancelled *did* subscribe, and counting
  // only current subscribers would make a partner's conversion rate fall as
  // their customers churn — the opposite of informative.
  const subscribedOrgs = new Set(
    earnings.filter((e) => e.kind === "subscription" || e.kind === "recurring").map((e) => e.organizationId).filter(Boolean),
  );
  // A currently-paying referral counts even if its ledger rows are missing,
  // which happens if commission was credited before this report existed.
  for (const referral of referrals) {
    if (isPaying(referral.subscriptionStatus)) subscribedOrgs.add(referral.organizationId);
  }
  const subscribed = subscribedOrgs.size;

  const stillPaying = referrals.filter((r) => isPaying(r.subscriptionStatus)).length;

  const conversionPct = signedUp > 0 ? round1((subscribed / signedUp) * 100) : 0;
  const churnPct = subscribed > 0 ? round1(((subscribed - stillPaying) / subscribed) * 100) : 0;

  let headline: string;
  if (signedUp === 0) {
    headline = "No referrals yet. Share your link to get the first one.";
  } else if (subscribed === 0) {
    headline = `${signedUp} signed up, none subscribed yet. Follow up with the ones who did.`;
  } else if (stillPaying === 0) {
    headline = `${subscribed} subscribed, but none are still paying.`;
  } else {
    headline = `${stillPaying} of ${signedUp} referrals are paying you ${conversionPct}% conversion.`;
  }

  return { signedUp, subscribed, stillPaying, conversionPct, churnPct, headline };
}

/* -------------------------------------------------------------------------- */
/* The run-rate                                                               */
/* -------------------------------------------------------------------------- */

export interface RunRate {
  /** What the recurring tier pays this month across everyone still subscribed. */
  monthlyKobo: number;
  /** That figure over twelve months — the one to put on the dashboard. */
  annualKobo: number;
  /** How many referrals are contributing to it. */
  payingReferrals: number;
  /** Average per paying referral, which should equal the tier unless a rate was
   * negotiated. */
  perReferralKobo: number;
  /** Last month's recurring total, so the dashboard can show a direction. */
  lastMonthKobo: number;
  /** Percent change against last month. 0 when there is nothing to compare. */
  changePct: number;
}

/**
 * The recurring run-rate.
 *
 * **Derived from who is still paying, not from the ledger's history.** The sum of
 * every recurring row ever credited grows forever and tells a partner nothing;
 * what they want to know is what arrives next month if nothing changes. So this
 * counts current subscribers and multiplies by the tier.
 */
export function recurringRunRate(params: {
  referrals: ReportReferral[];
  earnings: ReportEarning[];
  recurringMonthlyKobo: number;
  /** The month before the current one, for the direction. The caller computes it
   * because month arithmetic already lives in the commission module. */
  previousPeriod?: string;
}): RunRate {
  const { referrals, earnings, recurringMonthlyKobo, previousPeriod } = params;

  /*
   * **Status alone decides who is paying.**
   *
   * An earlier version also required a ledger row, to avoid counting a referral
   * that had never subscribed. That was wrong twice over: the subscription status
   * already comes from the billing table, so `active` genuinely means subscribed;
   * and the extra condition *understated* a partner's run-rate for any referral
   * whose first commission row had not been credited yet — which is exactly what
   * a partner would notice and resent. The ledger is used below for the direction
   * of travel, not to decide who counts.
   */
  const payingReferrals = referrals.filter((r) => isPaying(r.subscriptionStatus)).length;

  const monthlyKobo = payingReferrals * recurringMonthlyKobo;

  const sumFor = (period?: string): number => {
    if (!period) return 0;
    return earnings.filter((e) => e.kind === "recurring" && e.periodKey === period).reduce((sum, e) => sum + (e.commissionKobo || 0), 0);
  };
  const lastMonthKobo = sumFor(previousPeriod);
  const changePct = lastMonthKobo > 0 ? round1(((monthlyKobo - lastMonthKobo) / lastMonthKobo) * 100) : 0;

  return {
    monthlyKobo,
    annualKobo: monthlyKobo * 12,
    payingReferrals,
    perReferralKobo: payingReferrals > 0 ? Math.round(monthlyKobo / payingReferrals) : recurringMonthlyKobo,
    lastMonthKobo,
    changePct,
  };
}

/* -------------------------------------------------------------------------- */
/* What a referral is worth                                                   */
/* -------------------------------------------------------------------------- */

export interface ReferralValue {
  /** Total credited, across every tier, per referral on average. */
  averageKobo: number;
  /** The best-performing referral, for the "your Lekki clinics convert" insight. */
  bestBusinessName: string;
  bestKobo: number;
  /** What one referral is *modelled* to be worth in year one, from the tiers —
   * shown beside the actual figure so the difference is visible. */
  modelledFirstYearKobo: number;
}

export function referralValue(params: {
  earnings: ReportEarning[];
  businessNames: Record<string, string>;
  modelledFirstYearKobo: number;
}): ReferralValue {
  const { earnings, businessNames, modelledFirstYearKobo } = params;
  const byOrg = new Map<string, number>();

  for (const earning of earnings) {
    if (!earning.organizationId) continue;
    byOrg.set(earning.organizationId, (byOrg.get(earning.organizationId) ?? 0) + (earning.commissionKobo || 0));
  }

  let bestOrg = "";
  let bestKobo = 0;
  for (const [org, amount] of byOrg) {
    if (amount > bestKobo) {
      bestKobo = amount;
      bestOrg = org;
    }
  }

  const total = [...byOrg.values()].reduce((sum, v) => sum + v, 0);
  return {
    averageKobo: byOrg.size > 0 ? Math.round(total / byOrg.size) : 0,
    bestBusinessName: bestOrg ? (businessNames[bestOrg] ?? "A referral") : "",
    bestKobo,
    modelledFirstYearKobo,
  };
}

/* -------------------------------------------------------------------------- */
/* Projection                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * What the partner's book pays over the next twelve months if nothing changes.
 *
 * Stated as a projection, and labelled as one in the UI. A partner who reads it
 * as a promise and then loses a customer will trust the rest of the dashboard
 * less, so the wording matters as much as the arithmetic.
 */
export function projectedTwelveMonths(runRate: RunRate): number {
  return runRate.monthlyKobo * 12;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
