import "server-only";
import { getSql } from "@/lib/db/client";
import { chargeWallet, creditWallet, listLineRentalCandidates } from "@/lib/db/receptionist";
// Re-exported so callers of this module keep one import for the line's billing.
import { periodKeyFor, USD_NGN_RATE } from "./pricing";

export { periodKeyFor };

/**
 * A dollar price in naira kobo, at the configured rate.
 *
 * Rounded up to the nearest naira, never down: rounding a pass-through cost down
 * means JKTL eats the fraction every month, and on a charge that is a pure
 * pass-through there is no margin to absorb it from.
 */
export function nairaKoboForUsdCents(usdCents: number, usdNgnRate = USD_NGN_RATE): number {
  if (!Number.isFinite(usdCents) || usdCents <= 0) return 0;
  const naira = (usdCents / 100) * usdNgnRate;
  return Math.ceil(naira) * 100;
}
import { notifyLineRentalUnpaid } from "@/lib/notify";

/**
 * The dedicated phone line, billed to the clinic's own communication wallet.
 *
 * **Option A**, as decided: the number is a pass-through cost, exactly like an
 * SMS. The clinic's free credit covers the first months; after that the rental
 * comes out of the same balance they top up for messaging. JKTL's subscription
 * margin is untouched, and a clinic can see precisely what running its own line
 * costs.
 *
 * Two rules, both about not lying to anybody:
 *
 *   1. **The wallet guardrail cannot be bypassed.** The rental goes through the
 *      same atomic `chargeWallet` as a message, so an empty wallet does not get
 *      a line on credit. Unlike a message, though, the number keeps working —
 *      Twilio bills JKTL regardless — so an unpaid month is *recorded as debt*
 *      and chased, not ignored.
 *
 *   2. **A month is charged at most once.** `line_rental_charges` is keyed on
 *      (organization, 'YYYY-MM') and claimed the same way the subscription is,
 *      so a daily cron cannot bill February twice.
 */

export type LineRentalOutcome =
  | { status: "charged"; periodKey: string; amountKobo: number }
  | { status: "unpaid"; periodKey: string; amountKobo: number; balanceKobo: number }
  | { status: "already_charged"; periodKey: string }
  | { status: "not_applicable" };

/**
 * Charges one clinic one month of line rental.
 *
 * Claims the period first. If the wallet cannot cover it, the claim is marked
 * `unpaid` rather than rolled back: the clinic owes the money, the line is still
 * answering, and the console should say so.
 */
export async function chargeLineRental(orgId: string, now = new Date()): Promise<LineRentalOutcome> {
  const sql = getSql();
  const config = (
    await sql`
      SELECT line_rental_kobo_per_month, line_rental_usd_cents, line_status, voice_number
      FROM ai_receptionist_config WHERE organization_id = ${orgId}
    `
  )[0];

  if (!config) return { status: "not_applicable" };
  const status = config.line_status as string;
  // Nothing to bill for a line that does not exist.
  if (status !== "active" && status !== "requested") return { status: "not_applicable" };

  const manualKobo = Number(config.line_rental_kobo_per_month ?? 0);
  const usdCents = Number(config.line_rental_usd_cents ?? 0);
  /**
   * Twilio bills in dollars — $1.90 per number per month — so that is what is
   * stored, and the naira figure is computed here, at charge time.
   *
   * This matters more than it looks. Under Option A the rental is a
   * pass-through: the clinic pays what the number costs. A naira price fixed on
   * the day the account was opened would quietly become a loss the next time the
   * naira moves, and JKTL would be absorbing a cost it does not control — which
   * is the exact subsidy Option A exists to prevent. A manual naira value still
   * wins, for a number on a negotiated or legacy price.
   */
  const amountKobo = manualKobo > 0 ? manualKobo : usdCents > 0 ? nairaKoboForUsdCents(usdCents) : 0;
  if (amountKobo <= 0) return { status: "not_applicable" };

  const periodKey = periodKeyFor(now);

  // Claim the month. The WHERE clause is the lock: a period already charged
  // matches nothing.
  const claimed = await sql`
    INSERT INTO line_rental_charges (organization_id, period_key, amount_kobo, status, attempts)
    VALUES (${orgId}, ${periodKey}, ${amountKobo}, 'pending', 1)
    ON CONFLICT (organization_id, period_key) DO UPDATE SET
      attempts = line_rental_charges.attempts + 1,
      status = CASE WHEN line_rental_charges.status = 'waived' THEN 'waived' ELSE 'pending' END,
      error = '',
      updated_at = now()
    WHERE line_rental_charges.status IN ('pending', 'unpaid')
    RETURNING period_key
  `;
  if (!claimed[0]) return { status: "already_charged", periodKey };

  const charge = await chargeWallet({
    organizationId: orgId,
    kind: "voice",
    amountKobo,
    quantity: 1,
    unitCostKobo: amountKobo,
    provider: "twilio",
    // Idempotency on the period, so a retry after a crash cannot bill twice.
    providerRef: `line-rental:${orgId}:${periodKey}`,
    description: `Dedicated business line — ${periodKey}`,
  });

  if (!charge.ok) {
    await sql`
      UPDATE line_rental_charges SET
        status = 'unpaid',
        error = ${`Wallet balance ${charge.balanceKobo} kobo, needed ${charge.neededKobo} kobo.`},
        updated_at = now()
      WHERE organization_id = ${orgId} AND period_key = ${periodKey}
    `;
    // Only shout on the first unpaid attempt of the month, so a clinic with an
    // empty wallet gets one clear message rather than one a day.
    if (charge.balanceKobo >= 0) {
      void notifyLineRentalUnpaid(orgId, { amountKobo, periodKey });
    }
    return { status: "unpaid", periodKey, amountKobo, balanceKobo: charge.balanceKobo };
  }

  await sql`
    UPDATE line_rental_charges SET
      status = 'charged', error = '', provider_ref = ${charge.transaction.providerRef || periodKey},
      charge_id = ${charge.transaction.id}, updated_at = now()
    WHERE organization_id = ${orgId} AND period_key = ${periodKey}
  `;
  return { status: "charged", periodKey, amountKobo };
}

/** Retries every unpaid rental and charges the current month where due. */
export async function runLineRentals(now = new Date()): Promise<{
  attempted: number;
  charged: number;
  unpaid: number;
  results: LineRentalOutcome[];
}> {
  const orgIds = await listLineRentalCandidates();
  const results: LineRentalOutcome[] = [];
  for (const orgId of orgIds) {
    results.push(await chargeLineRental(orgId, now));
  }
  return {
    attempted: results.length,
    charged: results.filter((r) => r.status === "charged").length,
    unpaid: results.filter((r) => r.status === "unpaid").length,
    results,
  };
}

/**
 * Waives a period — for a month the line was down, or as goodwill. Recorded
 * rather than deleted, because "why wasn't I charged in March" needs an answer.
 */
export async function waiveLineRental(orgId: string, periodKey: string, reason: string): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE line_rental_charges SET status = 'waived', error = ${reason.slice(0, 300)}, updated_at = now()
    WHERE organization_id = ${orgId} AND period_key = ${periodKey}
  `;
  // If it had already been taken, give it back.
  const refund = await sql`
    SELECT charge_id, amount_kobo FROM line_rental_charges
    WHERE organization_id = ${orgId} AND period_key = ${periodKey} AND charge_id IS NOT NULL
  `;
  if (refund[0]) {
    await creditWallet({
      organizationId: orgId,
      kind: "refund",
      amountKobo: Number(refund[0].amount_kobo),
      provider: "jktl",
      providerRef: `line-rental-waived:${orgId}:${periodKey}`,
      description: `Line rental waived — ${periodKey}: ${reason.slice(0, 120)}`,
    });
  }
}

export interface LineRentalSummary {
  monthlyKobo: number;
  /** The dollar price Twilio actually charges, in cents. */
  usdCents: number;
  status: string;
  unpaidKobo: number;
  unpaidPeriods: string[];
  history: Array<{ periodKey: string; amountKobo: number; status: string; attempts: number; error: string }>;
}

/** What the console shows: what the line costs, and whether it has been paid. */
export async function getLineRentalSummary(orgId: string): Promise<LineRentalSummary> {
  const sql = getSql();
  const config = (await sql`SELECT line_rental_kobo_per_month, line_rental_usd_cents, line_status FROM ai_receptionist_config WHERE organization_id = ${orgId}`)[0];
  const manualKobo = Number(config?.line_rental_kobo_per_month ?? 0);
  const usdCents = Number(config?.line_rental_usd_cents ?? 0);
  const rows = await sql`
    SELECT period_key, amount_kobo, status, attempts, error
    FROM line_rental_charges WHERE organization_id = ${orgId}
    ORDER BY period_key DESC LIMIT 12
  `;
  const history = rows.map((row) => ({
    periodKey: row.period_key as string,
    amountKobo: Number(row.amount_kobo ?? 0),
    status: row.status as string,
    attempts: Number(row.attempts ?? 0),
    error: (row.error as string) ?? "",
  }));
  const unpaid = history.filter((h) => h.status === "unpaid");
  return {
    // What will actually be charged, which is the dollar price converted unless
    // a manual naira value overrides it.
    monthlyKobo: manualKobo > 0 ? manualKobo : nairaKoboForUsdCents(usdCents),
    usdCents,
    status: (config?.line_status as string) ?? "none",
    unpaidKobo: unpaid.reduce((sum, h) => sum + h.amountKobo, 0),
    unpaidPeriods: unpaid.map((h) => h.periodKey),
    history,
  };
}
