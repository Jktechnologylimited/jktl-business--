/**
 * Shared (client + server) billing constants for the "Website & Hosting"
 * add-on. Publishing a website on a *.jktl.com.ng subdomain is free — that
 * costs nothing extra per business (one shared wildcard cert, one shared
 * deployment) — and so is the CRM itself. What this subscription actually
 * gates, because each has a real per-business cost, all three built and live:
 *   1. **Team seats** — the owner is free; a 2nd+ member needs it (see
 *      `FREE_TEAM_SEATS` below and `addMemberAction`).
 *   2. **Storage past the free 50MB quota** — image uploads (logos, avatars,
 *      receipts, product photos) only; see `src/lib/db/storage.ts`.
 *   3. **A custom domain** — DNS-verified, manually added in Vercel; see
 *      `src/lib/actions/domain-actions.ts`.
 *
 * Prices are flat regardless of business size — no per-seat or per-GB
 * tiering beyond the one free-tier cutoff for each of the above. That's a
 * deliberate simplicity choice: real cost variance between a solo operator
 * and a busy salon is small at this scale, and finer tiering would mean
 * more Paystack plans and more UI to explain for not much benefit yet.
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
