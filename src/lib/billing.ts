/**
 * Shared (client + server) billing constants for the "Website & Hosting"
 * add-on. Publishing a website on a *.jktl.com.ng subdomain is free — that
 * costs nothing extra per business (one shared wildcard cert, one shared
 * deployment) — and so is the CRM itself. What this subscription actually
 * gates, because each has a real per-business cost, all three built and live:
 *   1. **Team seats** — the owner is free; a 2nd+ member needs it (see
 *      `FREE_TEAM_SEATS` below and `addMemberAction`).
 *   2. **Going past the free storage quota at all** — image uploads (logos,
 *      avatars, receipts, product photos) only; see `src/lib/db/storage.ts`.
 *      Being subscribed is what lets a business exceed the quota in the
 *      first place — but unlike the other two gates, exceeding it isn't
 *      free once unlocked. See `STORAGE_OVERAGE_RATE_KOBO_PER_GB` below:
 *      the overage itself is billed separately, on top of this flat price,
 *      each time the subscription renews (`src/lib/db/storage-overage.ts`).
 *   3. **A custom domain** — DNS-verified, manually added in Vercel; see
 *      `src/lib/actions/domain-actions.ts`.
 *
 * Prices are flat regardless of business size — no per-seat tiering beyond
 * the one free-seat cutoff. That's a deliberate simplicity choice: real
 * cost variance between a solo operator and a busy salon is small at this
 * scale for seats and domains, and finer tiering would mean more Paystack
 * plans and more UI to explain for not much benefit yet. Storage is the one
 * exception, because unlike seats or a domain, storage cost scales
 * continuously with how many photos a business uploads rather than sitting
 * at one of a couple of discrete levels — so it gets metered instead.
 */

export type BillingCycle = "monthly" | "quarterly" | "biannually" | "yearly";

export interface BillingCycleDef {
  id: BillingCycle;
  label: string;
  /** Price in kobo for this cycle (NGN — Paystack's `amount` field for NGN
   * is already in kobo, so this is used directly with no conversion). */
  priceKobo: number;
  /** How many calendar months this cycle covers — used to compute the next
   * renewal date after a successful charge. */
  months: number;
  /** Paystack's own `interval` enum value for the Plan object. Note this
   * doesn't always match our `id` string (their "yearly" is "annually"). */
  paystackInterval: "monthly" | "quarterly" | "biannually" | "annually";
}

export const BILLING_CYCLES: BillingCycleDef[] = [
  { id: "monthly", label: "Monthly", priceKobo: 500_000, months: 1, paystackInterval: "monthly" },
  { id: "quarterly", label: "Quarterly", priceKobo: 1_450_000, months: 3, paystackInterval: "quarterly" },
  { id: "biannually", label: "Every 6 months", priceKobo: 2_700_000, months: 6, paystackInterval: "biannually" },
  { id: "yearly", label: "Yearly", priceKobo: 5_000_000, months: 12, paystackInterval: "annually" },
];

export function getCycleDef(cycle: string): BillingCycleDef | undefined {
  return BILLING_CYCLES.find((c) => c.id === cycle);
}

/** Naira-per-year this cycle works out to, for a small "cheapest per year"
 * comparison line in the UI (e.g. "₦60,000/yr paid monthly"). */
export function annualizedKobo(cycle: BillingCycleDef): number {
  return Math.round((cycle.priceKobo / cycle.months) * 12);
}

export function addBillingCycle(date: Date, cycleId: BillingCycle): Date {
  const cycle = getCycleDef(cycleId);
  const months = cycle?.months ?? 12;
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

/** Free team seats (the owner, created at signup) before a Website &
 * Hosting subscription is required to add another. Checked in
 * `addMemberAction` — see `src/lib/actions/member-actions.ts`. */
export const FREE_TEAM_SEATS = 1;

export const PLAN_NAME_PREFIX = "Website & Hosting";

export function planNameFor(cycle: BillingCycle): string {
  const def = getCycleDef(cycle);
  return `${PLAN_NAME_PREFIX} — ${def?.label ?? cycle}`;
}

// ---- Storage overage (metered, on top of the flat plan above) ----
//
// Neon's real marginal cost is $0.35/GB-month (~₦465 at ₦1,330/$1, Sept
// 2026). This charges roughly 4x that — a normal cost-plus markup for a
// usage-based SaaS storage add-on (the going range is 3-5x raw infra cost),
// covering Vercel/Paystack overhead and the fact that a metered charge this
// small still costs Paystack's flat ₦100-or-so per transaction regardless
// of amount. Rounded to a clean number for UI copy rather than carrying
// the exact multiple.

/** ₦2,000 per GB of storage over the free quota, per billing cycle. */
export const STORAGE_OVERAGE_RATE_KOBO_PER_GB = 200_000;

/** Below this, a cycle's overage charge is skipped rather than billed —
 * Paystack's own per-transaction overhead would eat a meaningful share of
 * anything smaller than this, and it's not worth surprising a business
 * with a trivial line item for a few extra photos. The overage simply
 * isn't collected for that cycle; it doesn't carry forward or compound. */
export const MIN_OVERAGE_CHARGE_KOBO = 5_000;

/**
 * What a business owes for storage over its free quota, in kobo, for one
 * billing cycle — proportional to the exact overage rather than rounded up
 * to a whole GB, so being a little over the line doesn't cost a full extra
 * gigabyte. Returns 0 both when there's no overage at all and when there
 * is some but it's below `MIN_OVERAGE_CHARGE_KOBO` — callers should treat
 * either case as "nothing to charge this cycle."
 */
export function computeStorageOverageKobo(usedBytes: number, limitBytes: number): number {
  const overageBytes = Math.max(0, usedBytes - limitBytes);
  if (overageBytes === 0) return 0;
  const overageGb = overageBytes / (1024 * 1024 * 1024);
  const amountKobo = Math.round(overageGb * STORAGE_OVERAGE_RATE_KOBO_PER_GB);
  return amountKobo >= MIN_OVERAGE_CHARGE_KOBO ? amountKobo : 0;
}
