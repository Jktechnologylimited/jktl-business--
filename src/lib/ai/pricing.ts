/**
 * The unit economics of the AI receptionist, as plain arithmetic.
 *
 * Deliberately dependency-free (no imports at all) so it can be unit tested
 * directly by `npm test` under `node --test`, and so the same numbers can be
 * rendered in three places that must never disagree:
 *   1. the ROI calculator the medical director sees during a pitch,
 *   2. the receptionist console the clinic sees every day,
 *   3. the invoice/contract rows this app writes.
 *
 * Every constant below is stated once, named after the thing it prices, and
 * quoted in kobo to match the rest of the schema. If a number changes in
 * negotiation, it changes here and every surface follows.
 */

/**
 * The Strategic Turnkey Launch Package — ₦650,000, paid as **six monthly
 * instalments** of ₦108,333.33 rather than upfront, and deliberately *not*
 * presented as six free months. It is a payment plan for work already
 * delivered (line provisioning, data cleaning, calendar sync, clinical triage
 * rule ingestion), which is what makes the contract cancellable from month 1
 * without JKTL having financed the whole build.
 */
export const SETUP_FEE_KOBO = 65_000_000;
/** How many instalments the package is split into. */
export const SETUP_MONTHS = 6;
/**
 * ₦108,333.33 — `SETUP_FEE_KOBO / SETUP_MONTHS`, rounded down to the kobo.
 * The true per-month figure is ₦108,333.3333…, so the *schedule* below
 * distributes the remaining 2 kobo across the first two instalments and the
 * six payments sum to exactly ₦650,000. Never compute a customer-facing
 * amount from this constant alone — use `setupAmortization()`.
 */
export const SETUP_MONTHLY_KOBO = 10_833_333;
/** ₦59,000 — the platform tier, from month 7 onward. */
export const MONTHLY_FEE_KOBO = 5_900_000;
/**
 * ₦15,000 of free communication credit, granted when a business activates the
 * receptionist — roughly 3,300 callback SMS at the unit cost below.
 *
 * This is the "free credits first" promise: the agent spends the free balance
 * before a clinic ever tops up, and only once it is gone does the wallet
 * guardrail start holding callbacks back and asking for money. It is a grant,
 * not a discount — the ledger records it as `kind = 'grant'`, so it never
 * counts as revenue.
 */
export const FREE_CREDIT_KOBO = 1_500_000;

/** Cancellation is allowed from month one — there is no minimum term and no
 * early-exit fee. Any instalments not yet billed are simply never billed,
 * which is what "cancel anytime" has to mean to be honest. The exposure this
 * creates is quantified by `cancellationSummary()` so it is a known number
 * rather than a surprise. */
export const CANCEL_ANY_TIME = true;

/** ₦4.50 — blended SMS cost per 160-character segment. Verify against the
 * actual Twilio invoice for Nigerian destinations before quoting a margin. */
export const SMS_UNIT_COST_KOBO = 450;
/** ₦7.00 — WhatsApp template message, used once a clinic opts into
 * the WhatsApp channel. */
export const WHATSAPP_UNIT_COST_KOBO = 700;

/**
 * DeepSeek token pricing, USD per million tokens, converted to kobo.
 *
 * The whole "$1B valuation" argument rests on this being small: Western
 * frontier models bill roughly an order of magnitude more per million
 * tokens, and the blueprint's margin moat is the gap between those two
 * numbers. Cache hits are the second half of that moat — a booking
 * conversation re-sends the same system prompt (business hours, service
 * list, triage rules) on every turn, so most input tokens are billed at the
 * cache-hit rate rather than the full rate.
 *
 * Source: DeepSeek's published API pricing for deepseek-chat. Overridable
 * via env in `src/lib/deepseek.ts` so a price change doesn't need a deploy.
 */
export const DEEPSEEK_USD_PER_MTOKENS = {
  inputCacheMiss: 0.27,
  inputCacheHit: 0.07,
  output: 1.1,
} as const;

/** Assumed NGN per USD for converting the token prices above. Deliberately
 * conservative (a stronger naira makes our margins look worse, not better). */
export const USD_NGN_RATE = 1600;

/** Kobo per single token, derived from the USD/M rates above. 1 USD is 100
 * kobo-per-naira * naira-per-usd kobo, so:
 *   kobo/token = (usd / 1_000_000) * USD_NGN_RATE * 100 */
export function koboPerToken(usdPerMillionTokens: number, usdNgnRate = USD_NGN_RATE): number {
  return (usdPerMillionTokens / 1_000_000) * usdNgnRate * 100;
}

export interface TokenUsage {
  /** Prompt tokens billed at the full (cache-miss) rate. */
  inputTokens: number;
  /** Prompt tokens that hit DeepSeek's context cache and bill cheaper. */
  cachedInputTokens?: number;
  outputTokens: number;
}

/**
 * Cost of one conversation's model usage, in kobo, rounded up to the nearest
 * kobo — rounding down would systematically under-report cost, which is the
 * one direction a margin calculation must never drift.
 */
export function aiUsageCostKobo(usage: TokenUsage, usdNgnRate = USD_NGN_RATE): number {
  const input = Math.max(0, usage.inputTokens) * koboPerToken(DEEPSEEK_USD_PER_MTOKENS.inputCacheMiss, usdNgnRate);
  const cached = Math.max(0, usage.cachedInputTokens ?? 0) * koboPerToken(DEEPSEEK_USD_PER_MTOKENS.inputCacheHit, usdNgnRate);
  const output = Math.max(0, usage.outputTokens) * koboPerToken(DEEPSEEK_USD_PER_MTOKENS.output, usdNgnRate);
  return Math.ceil(input + cached + output);
}

/**
 * A realistic multi-turn booking session, used by the ROI calculator when no
 * real usage data exists yet (i.e. during a pitch, before the clinic has
 * sent a single call).
 *
 *   12 turns, ~2,000 prompt tokens each (system prompt + service list +
 *   history), ~150 output tokens each, 60% of prompt tokens served from
 *   cache. That lands at roughly ₦5–₦10 per completed booking — the figure
 *   quoted in the blueprint — and the test suite pins it inside that band so
 *   a quiet pricing change can't silently break the sales claim.
 */
export const TYPICAL_SESSION_USAGE: Required<TokenUsage> = {
  inputTokens: 9_600,
  cachedInputTokens: 14_400,
  outputTokens: 1_800,
};

export function typicalSessionCostKobo(usdNgnRate = USD_NGN_RATE): number {
  return aiUsageCostKobo(TYPICAL_SESSION_USAGE, usdNgnRate);
}

/**
 * Gross margin on the AI subscription layer, as a ratio in [0, 1].
 *
 * Note what is *not* in `costKobo`: SMS and WhatsApp spend. Those are
 * deducted from the clinic's own prepaid communication wallet (see
 * `src/lib/db/receptionist.ts`), so they never touch JKTL's margin — they
 * are a pass-through. That separation is the guardrail, and the reason a
 * clinic with runaway call volume can't wipe out the subscription margin.
 */
export function grossMargin(revenueKobo: number, costKobo: number): number {
  if (revenueKobo <= 0) return 0;
  const margin = (revenueKobo - costKobo) / revenueKobo;
  return Math.max(0, Math.min(1, margin));
}

export interface SubscriptionEconomics {
  monthlyFeeKobo: number;
  /** Number of conversations (one per recovered missed call) in the month. */
  sessionsPerMonth: number;
  costPerSessionKobo: number;
  /**
   * Per-clinic recurring infrastructure JKTL pays for: the dedicated virtual
   * line (DID) each tenant's calls are routed through, plus any per-seat
   * platform cost.
   *
   * Defaults to 0 because it is a **commercial decision that has not been
   * made**: `subscribeEconomics` originally modelled inference only, and the
   * line rental is the single biggest threat to the 95% claim — at ₦10,000 a
   * month it takes the platform tier to ~81%, and at ₦25,000 to ~56%. Either
   * price it into the tier, or bill it to the clinic's wallet as a
   * pass-through like messaging; until one of those is chosen, quote the
   * margin with this parameter set to the real quoted line cost.
   */
  lineRentalKobo?: number;
}

/** Monthly contribution and margin for one clinic at a given volume. */
export function subscriptionEconomics(params: SubscriptionEconomics): {
  revenueKobo: number;
  aiCostKobo: number;
  lineRentalKobo: number;
  grossProfitKobo: number;
  grossMargin: number;
} {
  const revenueKobo = params.monthlyFeeKobo;
  const aiCostKobo = Math.round(params.sessionsPerMonth * params.costPerSessionKobo);
  const lineRentalKobo = Math.max(0, Math.round(params.lineRentalKobo ?? 0));
  const totalCostKobo = aiCostKobo + lineRentalKobo;
  const grossProfitKobo = revenueKobo - totalCostKobo;
  return {
    revenueKobo,
    aiCostKobo,
    lineRentalKobo,
    grossProfitKobo,
    grossMargin: grossMargin(revenueKobo, totalCostKobo),
  };
}

/**
 * How many conversations a clinic can have in a month before the "95% gross
 * margin" claim stops being true, i.e. before inference cost eats 5% of the
 * ₦59,000 subscription.
 *
 * This is the honest edge of the margin moat, and it belongs in the model
 * rather than in a footnote: at the documented ₦5–₦10 per conversation, a
 * clinic would have to run several hundred booking chats a month — far more
 * than a single front desk generates — before the claim is at risk. Beyond
 * this number, margin falls; it does not collapse, and `subscriptionEconomics`
 * reports the real figure for any volume an investor asks about.
 */
export function sessionsAtMargin(
  targetMargin = 0.95,
  monthlyFeeKobo = MONTHLY_FEE_KOBO,
  costPerSessionKobo = typicalSessionCostKobo(),
  lineRentalKobo = 0,
): number {
  if (costPerSessionKobo <= 0) return Number.POSITIVE_INFINITY;
  const allowedCost = monthlyFeeKobo * (1 - targetMargin) - Math.max(0, lineRentalKobo);
  if (allowedCost <= 0) return 0;
  return Math.floor(allowedCost / costPerSessionKobo);
}

/* -------------------------------------------------------------------------- */
/* Contract timing                                                            */
/* -------------------------------------------------------------------------- */

export interface ContractTerms {
  setupFeeKobo: number;
  setupMonths: number;
  monthlyFeeKobo: number;
}

export const DEFAULT_CONTRACT_TERMS: ContractTerms = {
  setupFeeKobo: SETUP_FEE_KOBO,
  setupMonths: SETUP_MONTHS,
  monthlyFeeKobo: MONTHLY_FEE_KOBO,
};

/**
 * Splits `totalKobo` into `months` payments that sum to **exactly** the total.
 *
 * The remainder matters: ₦650,000 ÷ 6 is ₦108,333.33⅓, and six payments of
 * ₦108,333 would lose 2 kobo against the contract. Rather than accept a
 * rounding drift (which shows up as an unexplained balance in a customer's
 * records), the odd kobo are added to the earliest instalments, so the first
 * two are ₦108,333.34 and the rest ₦108,333.33.
 */
export function amortize(totalKobo: number, months: number): number[] {
  const n = Math.max(1, Math.floor(months));
  const base = Math.floor(totalKobo / n);
  const remainder = totalKobo - base * n;
  return Array.from({ length: n }, (_, index) => base + (index < remainder ? 1 : 0));
}

/** The six instalments of the turnkey package. */
export function setupAmortization(terms: ContractTerms = DEFAULT_CONTRACT_TERMS): number[] {
  return amortize(terms.setupFeeKobo, terms.setupMonths);
}

export type ContractPhase = "setup" | "platform" | "cancelled";

export interface ScheduledPayment {
  /** 1-based month of the contract. */
  monthIndex: number;
  dueAt: Date;
  amountKobo: number;
  phase: Exclude<ContractPhase, "cancelled">;
}

function addMonthsUtc(date: Date, months: number): Date {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

/** What month `monthIndex` (1-based) costs. Months 1–6 are the instalments;
 * month 7 onward is the platform tier. */
export function amountForMonth(monthIndex: number, terms: ContractTerms = DEFAULT_CONTRACT_TERMS): number {
  if (monthIndex < 1) return 0;
  if (monthIndex <= terms.setupMonths) return amortize(terms.setupFeeKobo, terms.setupMonths)[monthIndex - 1];
  return terms.monthlyFeeKobo;
}

export function phaseForMonth(monthIndex: number, terms: ContractTerms = DEFAULT_CONTRACT_TERMS): "setup" | "platform" {
  return monthIndex <= terms.setupMonths ? "setup" : "platform";
}

/**
 * The first `months` payments, month 1 falling due at `startedAt` — the
 * clinic pays the first instalment when it signs, not a month later.
 */
export function contractSchedule(
  startedAt: Date,
  months = 18,
  terms: ContractTerms = DEFAULT_CONTRACT_TERMS,
): ScheduledPayment[] {
  const instalments = amortize(terms.setupFeeKobo, terms.setupMonths);
  return Array.from({ length: Math.max(0, Math.floor(months)) }, (_, index) => {
    const monthIndex = index + 1;
    const phase = phaseForMonth(monthIndex, terms);
    return {
      monthIndex,
      dueAt: addMonthsUtc(startedAt, index),
      amountKobo: phase === "setup" ? instalments[monthIndex - 1] : terms.monthlyFeeKobo,
      phase,
    };
  });
}

/** When the ₦59,000 tier takes over: month 7, i.e. `setupMonths` after the
 * contract began. UTC arithmetic (setUTCMonth) so it agrees with
 * `addBillingCycle` in src/lib/billing.ts. */
export function platformPhaseStart(startedAt: Date, terms: ContractTerms = DEFAULT_CONTRACT_TERMS): Date {
  return addMonthsUtc(startedAt, terms.setupMonths);
}

/** Which month of the contract `now` falls in; 0 before it started. */
export function currentMonthIndex(startedAt: Date, now = new Date()): number {
  if (now < startedAt) return 0;
  return (
    (now.getUTCFullYear() - startedAt.getUTCFullYear()) * 12 + (now.getUTCMonth() - startedAt.getUTCMonth()) + 1
  );
}

export function currentPhase(
  startedAt: Date,
  now = new Date(),
  terms: ContractTerms = DEFAULT_CONTRACT_TERMS,
): ContractPhase {
  if (now < startedAt) return "setup";
  return phaseForMonth(currentMonthIndex(startedAt, now), terms);
}

/** Whole months left before the platform tier begins; 0 once it has. Used for
 * the "₦108,333 for the next 3 months" line in the console. */
export function monthsUntilPlatformPhase(
  startedAt: Date,
  now = new Date(),
  terms: ContractTerms = DEFAULT_CONTRACT_TERMS,
): number {
  const start = platformPhaseStart(startedAt, terms);
  if (now >= start) return 0;
  const months = (start.getUTCFullYear() - now.getUTCFullYear()) * 12 + (start.getUTCMonth() - now.getUTCMonth());
  return start.getUTCDate() > now.getUTCDate() ? Math.max(0, months - 1) : Math.max(0, months);
}

export function isPlatformPhase(
  startedAt: Date,
  now = new Date(),
  terms: ContractTerms = DEFAULT_CONTRACT_TERMS,
): boolean {
  return now >= platformPhaseStart(startedAt, terms);
}

/** The next payment due from `now`, or null once `months` have elapsed. */
export function nextPaymentDue(
  startedAt: Date,
  now = new Date(),
  months = 24,
  terms: ContractTerms = DEFAULT_CONTRACT_TERMS,
): ScheduledPayment | null {
  return contractSchedule(startedAt, months, terms).find((payment) => payment.dueAt >= now) ?? null;
}

/** Total billed over the first `months` of the contract. */
export function totalContractValue(months: number, terms: ContractTerms = DEFAULT_CONTRACT_TERMS): number {
  return contractSchedule(new Date(0), months, terms).reduce((sum, payment) => sum + payment.amountKobo, 0);
}

export function averageMonthlyKobo(months: number, terms: ContractTerms = DEFAULT_CONTRACT_TERMS): number {
  if (months <= 0) return 0;
  return Math.round(totalContractValue(months, terms) / months);
}

/**
 * What a cancellation collects, and what it writes off.
 *
 * This is the honest counterpart to "cancel anytime from month one". The
 * instalments are a payment plan for work already delivered, so cancelling in
 * month 2 means the remaining ₦541,666 of the package is never billed — JKTL
 * has delivered the build and recovered a sixth of it. That number is worth
 * watching: it is the real cost of the no-lock-in promise, and it is the
 * reason the package is amortised rather than discounted into the monthly fee.
 */
export function cancellationSummary(
  startedAt: Date,
  cancelledAt: Date,
  terms: ContractTerms = DEFAULT_CONTRACT_TERMS,
): {
  monthsBilled: number;
  collectedKobo: number;
  unbilledSetupKobo: number;
  phase: ContractPhase;
  /** True while the package itself is still being paid off — the window where
   * a cancellation leaves delivered work unrecovered. */
  insideSetupWindow: boolean;
} {
  const monthsBilled = Math.max(0, currentMonthIndex(startedAt, cancelledAt) - 1);
  const collectedKobo = contractSchedule(startedAt, monthsBilled, terms).reduce((sum, p) => sum + p.amountKobo, 0);
  const paidTowardsSetup = Math.min(monthsBilled, terms.setupMonths);
  const unbilledSetupKobo = terms.setupFeeKobo - collectedKobo > 0 ? terms.setupFeeKobo - collectedKobo : 0;
  return {
    monthsBilled,
    collectedKobo,
    unbilledSetupKobo: paidTowardsSetup >= terms.setupMonths ? 0 : unbilledSetupKobo,
    phase: phaseForMonth(Math.max(1, monthsBilled + 1), terms),
    insideSetupWindow: monthsBilled < terms.setupMonths,
  };
}

/**
 * Monthly payments needed to cover a given monthly cost, from the clinic's
 * side of the table. During the instalment phase the bar is higher (₦108,333
 * needs five ₦25,000 consultations, not three), and the console says so rather
 * than quoting the month-7 figure for the whole contract.
 */
export function breakEvenBookings(monthlyCostKobo: number, averageConsultValueKobo: number): number {
  if (averageConsultValueKobo <= 0) return 0;
  return Math.ceil(monthlyCostKobo / averageConsultValueKobo);
}

/* -------------------------------------------------------------------------- */
/* The ROI pitch to a medical director                                        */
/* -------------------------------------------------------------------------- */

export interface ClinicRoiInput {
  /** Missed calls per day. Blueprint baseline: 3. */
  missedCallsPerDay: number;
  /** Average value of the consultation or scan the call would have booked.
   * Blueprint baseline: ₦25,000. */
  averageConsultValueKobo: number;
  /** Share of missed calls the agent successfully turns into a booking.
   * 20% is the conservative planning number — real recovery on an
   * SMS-plus-AI intercept runs above this, but a pitch that only works at
   * optimistic assumptions isn't a pitch, it's a hope. */
  recoveryRate: number;
  /** Working days per month used to annualise the daily figure. */
  workingDaysPerMonth: number;
  monthlyFeeKobo: number;
}

export const DEFAULT_CLINIC_ROI_INPUT: ClinicRoiInput = {
  missedCallsPerDay: 3,
  averageConsultValueKobo: 2_500_000,
  recoveryRate: 0.2,
  workingDaysPerMonth: 26,
  monthlyFeeKobo: MONTHLY_FEE_KOBO,
};

export interface ClinicRoiResult {
  /** What the missed calls are worth per day before JKTL. */
  dailyLossKobo: number;
  monthlyLossKobo: number;
  /** Missed calls the agent is expected to convert per month. */
  recoveredPerMonth: number;
  /** Value of those recovered bookings. */
  recoveredValueKobo: number;
  /** Recovered value minus the monthly subscription. */
  netGainKobo: number;
  /** Recovered bookings needed to exactly cover the subscription. */
  bookingsToBreakEven: number;
  /** Multiple of the subscription that recovered revenue represents. */
  returnMultiple: number;
}

/**
 * The core sales calculation. Pure, so the pitch deck, the console's ROI
 * panel and the test suite all quote the same arithmetic — the failure mode
 * this prevents is a medical director finding a different number in the app
 * than the one printed in the proposal.
 */
export function clinicRoi(input: Partial<ClinicRoiInput> = {}): ClinicRoiResult {
  const params: ClinicRoiInput = { ...DEFAULT_CLINIC_ROI_INPUT, ...input };
  const {
    missedCallsPerDay,
    averageConsultValueKobo,
    recoveryRate,
    workingDaysPerMonth,
    monthlyFeeKobo,
  } = params;

  const dailyLossKobo = Math.round(missedCallsPerDay * averageConsultValueKobo);
  const monthlyLossKobo = Math.round(dailyLossKobo * workingDaysPerMonth);
  const recoveredPerMonth = missedCallsPerDay * workingDaysPerMonth * recoveryRate;
  const recoveredValueKobo = Math.round(recoveredPerMonth * averageConsultValueKobo);
  const netGainKobo = recoveredValueKobo - monthlyFeeKobo;
  const bookingsToBreakEven =
    averageConsultValueKobo > 0 ? Math.ceil(monthlyFeeKobo / averageConsultValueKobo) : 0;
  const returnMultiple = monthlyFeeKobo > 0 ? recoveredValueKobo / monthlyFeeKobo : 0;

  return {
    dailyLossKobo,
    monthlyLossKobo,
    recoveredPerMonth: Math.round(recoveredPerMonth * 100) / 100,
    recoveredValueKobo,
    netGainKobo,
    bookingsToBreakEven,
    returnMultiple: Math.round(returnMultiple * 100) / 100,
  };
}

/* -------------------------------------------------------------------------- */
/* Valuation math (the unicorn roadmap)                                       */
/* -------------------------------------------------------------------------- */

/** Annual recurring revenue from N clinics on the monthly tier. */
export function arrKobo(clinicCount: number, monthlyFeeKobo = MONTHLY_FEE_KOBO): number {
  return Math.round(clinicCount * monthlyFeeKobo * 12);
}

/**
 * Enterprise-value range for a given ARR, at the 10x–15x ARR multiple the
 * blueprint claims for high-margin vertical SaaS. Returns kobo so callers
 * format it like every other money value in the app.
 */
export function valuationRangeKobo(arr: number, lowMultiple = 10, highMultiple = 15): { lowKobo: number; highKobo: number } {
  return { lowKobo: Math.round(arr * lowMultiple), highKobo: Math.round(arr * highMultiple) };
}

/** Clinics needed for a $1B valuation at the given multiple and FX rate.
 * Expressed in kobo throughout, so 1 USD = USD_NGN_RATE * 100 kobo. */
export function clinicsForValuation(
  targetUsd = 1_000_000_000,
  multiple = 12,
  monthlyFeeKobo = MONTHLY_FEE_KOBO,
  usdNgnRate = USD_NGN_RATE,
): number {
  const targetArrKobo = targetUsd * usdNgnRate * 100;
  const revenueNeededKobo = targetArrKobo / multiple;
  return Math.ceil(revenueNeededKobo / (monthlyFeeKobo * 12));
}

/**
 * The current billing period in Lagos time, as 'YYYY-MM'.
 *
 * Used as the idempotency key for anything charged monthly — the dedicated phone
 * line, for one — so it must be stable across a day and roll over at Lagos
 * midnight rather than UTC's. A clinic in Yenagoa charged at 00:30 local is still
 * in the previous month by UTC reckoning, and billing February twice is exactly
 * what that would cause.
 *
 * Pure apart from `Intl`, so it is unit tested directly: passing a date is how a
 * midnight boundary gets tested at all.
 */
export function periodKeyFor(now: Date = new Date()): string {
  // en-CA formats as ISO-shaped parts without pulling in a date library.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}
