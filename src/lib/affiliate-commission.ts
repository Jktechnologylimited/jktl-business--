/**
 * The partner programme's commission structure.
 *
 * Three fixed tiers, replacing a percentage of whatever the referred business
 * happened to pay:
 *
 *   ₦20,000  when they create an account
 *   ₦40,000  when they subscribe
 *   ₦3,500   every month they stay subscribed
 *
 * **₦102,000 from one referral in the first year.** That is the number to sell
 * with, and the reason for fixed amounts: "20% recurring" makes a partner do
 * arithmetic against a price list, while "₦102,000 per referral" does not.
 *
 * Pure and dependency-free so the ledger's rules are unit tested — this is money
 * owed to people outside the company, and the rules about *when* it becomes
 * payable are the part that matters.
 */

/** ₦20,000 in kobo, credited when a referred business creates an account. */
export const SIGNUP_BONUS_KOBO = 2_000_000;
/** ₦40,000 in kobo, credited when that business subscribes. */
export const SUBSCRIPTION_BONUS_KOBO = 4_000_000;
/** ₦3,500 in kobo, credited for each month a subscription stays active. */
export const RECURRING_MONTHLY_KOBO = 350_000;

export type EarningKind = "signup" | "subscription" | "recurring" | "welcome" | "commission";
export type EarningStatus = "pending" | "available" | "paid";

export interface CommissionTerms {
  signupBonusKobo: number;
  subscriptionBonusKobo: number;
  recurringMonthlyKobo: number;
  /** 0 means uncapped — payable for as long as they stay subscribed. */
  recurringMonthsCap: number;
}

export const DEFAULT_TERMS: CommissionTerms = {
  signupBonusKobo: SIGNUP_BONUS_KOBO,
  subscriptionBonusKobo: SUBSCRIPTION_BONUS_KOBO,
  recurringMonthlyKobo: RECURRING_MONTHLY_KOBO,
  recurringMonthsCap: 0,
};

/** What one referral is worth in year one, for the pitch and the dashboard. */
export function firstYearValueKobo(terms: CommissionTerms = DEFAULT_TERMS, months = 12): number {
  const recurringMonths = terms.recurringMonthsCap > 0 ? Math.min(months, terms.recurringMonthsCap) : months;
  return terms.signupBonusKobo + terms.subscriptionBonusKobo + terms.recurringMonthlyKobo * recurringMonths;
}

/**
 * What the subscription payment should credit.
 *
 * The first real payment earns the ₦40,000 subscription bonus *and* releases the
 * ₦20,000 signup bonus that was recorded at account creation. Every payment after
 * that earns ₦3,500 for its own month.
 *
 * `alreadySubscribed` is passed in rather than inferred here so the caller's
 * database check is the single source of truth — two concurrent webhook
 * deliveries must both see the same answer, and only the unique index can
 * actually guarantee that.
 */
export function commissionForPayment(params: {
  isFirstPayment: boolean;
  /** 'YYYY-MM' in Lagos time. Only used for the recurring tier. */
  periodKey: string;
  paymentAmountKobo: number;
  terms?: CommissionTerms;
}): Array<{ kind: EarningKind; commissionKobo: number; status: EarningStatus; periodKey: string; note: string }> {
  const terms = params.terms ?? DEFAULT_TERMS;
  const rows: Array<{ kind: EarningKind; commissionKobo: number; status: EarningStatus; periodKey: string; note: string }> = [];

  if (params.isFirstPayment) {
    // The signup bonus becomes payable now, at the same moment the subscription
    // bonus is earned. This is the anti-farming guard: ₦20,000 for a bare signup
    // is a hundred free accounts and ₦2m for nothing.
    rows.push({
      kind: "signup",
      commissionKobo: terms.signupBonusKobo,
      status: "available",
      periodKey: "",
      note: "Signup bonus, released on first subscription",
    });
    rows.push({
      kind: "subscription",
      commissionKobo: terms.subscriptionBonusKobo,
      status: "available",
      periodKey: "",
      note: "Subscription bonus",
    });
  }

  /**
   * The recurring tier pays for **every** month the subscription is live,
   * including the first — "₦3,500 every month they stay subscribed" is exactly
   * what was asked for, and the first month is a month. An earlier version
   * started the series the following month, which quietly made the advertised
   * first-year figure ₦98,500 instead of the ₦102,000 on the marketing site. The
   * two have to agree, so the promise won.
   */
  const recurring = terms.recurringMonthlyKobo;
  if (recurring > 0) {
    rows.push({
      kind: "recurring",
      commissionKobo: recurring,
      status: "available",
      periodKey: params.periodKey,
      note: `Recurring commission — ${params.periodKey}`,
    });
  }
  return rows;
}

/**
 * Which months a referral is still owed for.
 *
 * The recurring tier pays for months the subscription is active, so a partner
 * who joined in March must not be paid for January. Returns the periods that are
 * due but not yet credited, oldest first, capped by any agreed limit.
 *
 * Pure: the caller supplies what has already been paid, because the unique index
 * in the database remains the only real guarantee against a double payment.
 */
export function dueRecurringPeriods(params: {
  /** First month the subscription was paid, 'YYYY-MM'. */
  startedPeriod: string;
  /** The current month, 'YYYY-MM'. */
  currentPeriod: string;
  /** Periods already credited, any order. */
  alreadyPaid: string[];
  terms?: CommissionTerms;
}): string[] {
  const terms = params.terms ?? DEFAULT_TERMS;
  if (terms.recurringMonthlyKobo <= 0) return [];

  // Both keys must be validated before the loop. Comparing unvalidated strings
  // is how "nonsense" sorts above every real month and the loop runs to its
  // guard — which would propose hundreds of months of commission nobody earned.
  if (!isPeriodKey(params.startedPeriod) || !isPeriodKey(params.currentPeriod)) return [];

  const paid = new Set(params.alreadyPaid);
  const due: string[] = [];
  // The series starts on the subscription month itself, because every month the
  // subscription is live earns a month of recurring commission. The webhook
  // credits that first month at the moment of the payment, so `alreadyPaid`
  // normally contains it and the cron will not propose it again.
  let cursor: string | null = params.startedPeriod;
  let guard = 0;

  while (cursor && cursor <= params.currentPeriod && guard < 240) {
    if (!paid.has(cursor)) due.push(cursor);
    cursor = monthAfter(cursor);
    guard += 1;
  }

  return terms.recurringMonthsCap > 0 ? due.slice(0, terms.recurringMonthsCap) : due;
}

/** Whether a string is a well-formed 'YYYY-MM' period key. */
export function isPeriodKey(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test((value ?? "").trim());
}

/** 'YYYY-MM' → the next month. Returns null on anything malformed, because a
 * bad period key must not turn into an unbounded loop. */
export function monthAfter(periodKey: string): string | null {
  const match = /^(\d{4})-(\d{2})$/.exec(periodKey.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
}

/* -------------------------------------------------------------------------- */
/* Balances                                                                   */
/* -------------------------------------------------------------------------- */

export interface EarningRow {
  kind: EarningKind;
  status: EarningStatus;
  commissionKobo: number;
  periodKey?: string;
}

export interface AffiliateBalance {
  /** Everything ever earned, including money not yet released. */
  totalEarnedKobo: number;
  /** Released and withdrawable. */
  availableKobo: number;
  /** Earned but held — the signup bonus before the referral subscribes. */
  pendingKobo: number;
  /** Named to match the dashboard's existing field, so no UI had to change. */
  totalPaidOutKobo: number;
  /** What they can actually ask for. `available` minus what has been paid. */
  balanceKobo: number;
  /** Monthly run-rate from the recurring tier, for the dashboard. */
  recurringMonthlyKobo: number;
}

/**
 * The balance, with the distinction that matters: **`pending` is not
 * withdrawable.**
 *
 * An earlier model treated everything earned as payable, which would have let a
 * partner withdraw the ₦20,000 signup bonus the day a referral created an
 * account — before that referral had paid anything. The programme would have been
 * paying out against free accounts.
 */
export function summariseEarnings(earnings: EarningRow[], paidOutKobo: number): AffiliateBalance {
  let totalEarnedKobo = 0;
  let availableKobo = 0;
  let pendingKobo = 0;
  let recurringMonthlyKobo = 0;

  for (const earning of earnings) {
    totalEarnedKobo += earning.commissionKobo;
    if (earning.status === "pending") pendingKobo += earning.commissionKobo;
    // `paid` money is not available — it has already left, and counting it would
    // let the same naira be withdrawn twice.
    else if (earning.status === "available") availableKobo += earning.commissionKobo;
    if (earning.kind === "recurring" && earning.status !== "paid") recurringMonthlyKobo += earning.commissionKobo;
  }

  return {
    totalEarnedKobo,
    availableKobo,
    pendingKobo,
    totalPaidOutKobo: paidOutKobo,
    // Never negative: an overpayment is a data problem to fix, not a debt for the
    // dashboard to display.
    balanceKobo: Math.max(0, availableKobo - paidOutKobo),
    recurringMonthlyKobo,
  };
}

/** What to pay per month per referral, at the published rate. */
export function monthlyPerReferralKobo(terms: CommissionTerms = DEFAULT_TERMS): number {
  return terms.recurringMonthlyKobo;
}
