import "server-only";
import { getSql } from "@/lib/db/client";
import { chargeAuthorization } from "@/lib/paystack";
import { getBusinessProfile, getOwnerEmail } from "@/lib/db/organizations";
import { applyContractPayment, markContractPaidExternally } from "./billing-fulfilment";
import { amountForMonth, DEFAULT_CONTRACT_TERMS } from "./pricing";
import { notifyChargeFailed, notifyChargeSucceeded } from "@/lib/notify";

/**
 * Automatic monthly collection for the receptionist subscription.
 *
 * The contract is a schedule (₦108,333.33 for the first six months, ₦59,000
 * after), and this is what turns that schedule into money without anybody
 * logging in. It runs from a daily cron.
 *
 * Two design decisions worth stating, because both are about not taking money
 * we shouldn't:
 *
 *  1. **The month is claimed before Paystack is called.** `contract_charge_attempts`
 *     has one row per (organization, month) and the claim is an
 *     `ON CONFLICT ... WHERE status <> 'charged'`, so a second concurrent
 *     attempt — a retry after a timeout, an overlapping cron, a redelivered
 *     webhook — finds the row already charged and stops. A duplicate charge is
 *     structurally impossible rather than merely unlikely.
 *
 *  2. **A failure never retries within the same run.** Paystack's own retry
 *     guidance for card declines is to wait, so a failed attempt is recorded
 *     with its error and left until the next daily run. Three failures and the
 *     contract is marked past due, which is what stops us silently hammering a
 *     dead card every day for a month.
 */

export type ChargeOutcome =
  | { status: "charged"; monthIndex: number; amountKobo: number; reference: string }
  | { status: "no_card" }
  | { status: "not_due" }
  | { status: "already_charged"; monthIndex: number }
  | { status: "cancelled" }
  | { status: "failed"; monthIndex: number; error: string; attempts: number };

/** How many failed attempts before the contract is flagged past due. */
const FAILURES_BEFORE_PAST_DUE = 3;

/**
 * Claims the next unpaid month for this organization.
 *
 * Returns null when there is nothing to charge — no active contract, auto-charge
 * off, or a month already in flight and charged. The claim increments the
 * attempt counter, so a run that dies between claiming and charging leaves an
 * honest record rather than silence.
 */
async function claimNextMonth(orgId: string): Promise<{ monthIndex: number; amountKobo: number; attempts: number } | null> {
  const sql = getSql();
  const contract = (
    await sql`
      SELECT charges_paid, status, auto_charge_enabled, paystack_authorization_code, started_at, next_charge_at
      FROM ai_receptionist_contracts WHERE organization_id = ${orgId}
    `
  )[0];
  if (!contract) return null;
  if ((contract.status as string) === "cancelled") return null;
  if (!contract.auto_charge_enabled) return null;
  if (!(contract.paystack_authorization_code as string)) return null;
  if (!contract.started_at) return null;

  const monthIndex = Number(contract.charges_paid ?? 0) + 1;
  const amountKobo = amountForMonth(monthIndex, DEFAULT_CONTRACT_TERMS);

  // Not due yet: the contract's own next_charge_at is the clock, so a clinic
  // that prepaid a month is not charged again early.
  const dueAt = contract.next_charge_at ? new Date(contract.next_charge_at as string) : new Date(contract.started_at as string);
  if (dueAt.getTime() > Date.now() + 24 * 60 * 60 * 1000) return null;

  const claimed = await sql`
    INSERT INTO contract_charge_attempts (organization_id, month_index, amount_kobo, status, attempts)
    VALUES (${orgId}, ${monthIndex}, ${amountKobo}, 'pending', 1)
    ON CONFLICT (organization_id, month_index) DO UPDATE SET
      attempts = contract_charge_attempts.attempts + 1,
      status = 'pending',
      error = '',
      updated_at = now()
    WHERE contract_charge_attempts.status <> 'charged'
    RETURNING month_index, amount_kobo, attempts
  `;
  // The WHERE clause is the lock: if this month already charged, nothing
  // comes back and we stop before touching Paystack.
  if (!claimed[0]) return null;

  return {
    monthIndex: Number(claimed[0].month_index),
    amountKobo: Number(claimed[0].amount_kobo),
    attempts: Number(claimed[0].attempts),
  };
}

async function settleAttempt(
  orgId: string,
  monthIndex: number,
  result: { status: "charged" | "failed"; error?: string; reference?: string },
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE contract_charge_attempts SET
      status = ${result.status},
      error = ${result.error ?? ""},
      provider_ref = ${result.reference ?? ""},
      updated_at = now()
    WHERE organization_id = ${orgId} AND month_index = ${monthIndex}
  `;
}

/**
 * Attempts to collect the next due month for one business.
 *
 * Deliberately returns an outcome rather than throwing: the cron iterates many
 * organizations and one dead card must not stop the rest of the run.
 */
export async function collectDueMonth(orgId: string): Promise<ChargeOutcome> {
  const claimed = await claimNextMonth(orgId);
  if (!claimed) {
    const sql = getSql();
    const row = (await sql`SELECT status, auto_charge_enabled, paystack_authorization_code FROM ai_receptionist_contracts WHERE organization_id = ${orgId}`)[0];
    if (!row) return { status: "not_due" };
    if ((row.status as string) === "cancelled") return { status: "cancelled" };
    if (!(row.paystack_authorization_code as string)) return { status: "no_card" };
    return { status: "not_due" };
  }

  const sql = getSql();
  const contract = (await sql`SELECT paystack_authorization_code FROM ai_receptionist_contracts WHERE organization_id = ${orgId}`)[0];
  const authorizationCode = (contract?.paystack_authorization_code as string) ?? "";
  const [profile, ownerEmail] = await Promise.all([getBusinessProfile(orgId), getOwnerEmail(orgId)]);
  const email = ownerEmail || profile?.email || `contract-${orgId}@jktl.com.ng`;

  try {
    const charge = await chargeAuthorization({
      authorizationCode,
      email,
      amountKobo: claimed.amountKobo,
      metadata: { type: "receptionist_month", organizationId: orgId, monthIndex: claimed.monthIndex },
    });

    const paidAt = new Date();
    const nextChargeAt = new Date(paidAt);
    nextChargeAt.setUTCMonth(nextChargeAt.getUTCMonth() + 1);

    await applyContractPayment({
      organizationId: orgId,
      amountKobo: claimed.amountKobo,
      reference: charge.reference,
      paidAt,
      monthIndex: claimed.monthIndex,
    });
    await settleAttempt(orgId, claimed.monthIndex, { status: "charged", reference: charge.reference });
    await markContractPaidExternally(orgId, { paidAt, attempts: claimed.attempts });

    void notifyChargeSucceeded(orgId, {
      amountKobo: claimed.amountKobo,
      monthIndex: claimed.monthIndex,
      nextChargeAt: nextChargeAt.toISOString(),
    });

    return { status: "charged", monthIndex: claimed.monthIndex, amountKobo: claimed.amountKobo, reference: charge.reference };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Card charge failed.";
    await settleAttempt(orgId, claimed.monthIndex, { status: "failed", error: message });
    await markContractPaidExternally(orgId, { paidAt: null, attempts: claimed.attempts, error: message });

    // Only shout about it on the attempt that crosses the line, so a clinic
    // with a dead card gets one clear message rather than one a day.
    if (claimed.attempts === FAILURES_BEFORE_PAST_DUE) {
      void notifyChargeFailed(orgId, { amountKobo: claimed.amountKobo, monthIndex: claimed.monthIndex, error: message });
    }

    return { status: "failed", monthIndex: claimed.monthIndex, error: message, attempts: claimed.attempts };
  }
}

/**
 * Every contract with auto-charge on that has a month due. Bounded so a single
 * cron invocation cannot run indefinitely; the next day picks up the rest.
 */
export async function listAutoChargeCandidates(limit = 50): Promise<string[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT organization_id FROM ai_receptionist_contracts
    WHERE status IN ('active', 'past_due')
      AND auto_charge_enabled = true
      AND paystack_authorization_code <> ''
      AND started_at IS NOT NULL
      AND COALESCE(next_charge_at, started_at) <= now()
    ORDER BY COALESCE(next_charge_at, started_at) ASC
    LIMIT ${limit}
  `;
  return rows.map((row) => row.organization_id as string);
}

/** The whole run: what the daily cron calls. */
export async function runAutoCharge(): Promise<{
  attempted: number;
  charged: number;
  failed: number;
  noCard: number;
  results: ChargeOutcome[];
}> {
  const candidates = await listAutoChargeCandidates();
  const results: ChargeOutcome[] = [];

  for (const orgId of candidates) {
    results.push(await collectDueMonth(orgId));
  }

  return {
    attempted: results.length,
    charged: results.filter((r) => r.status === "charged").length,
    failed: results.filter((r) => r.status === "failed").length,
    noCard: results.filter((r) => r.status === "no_card").length,
    results,
  };
}

/** What the billing screen shows: the card, the next charge, and what
 * happened last time we tried. */
export async function getChargeHistory(orgId: string, limit = 12): Promise<
  Array<{ monthIndex: number; amountKobo: number; status: string; attempts: number; error: string; updatedAt: string }>
> {
  const sql = getSql();
  const rows = await sql`
    SELECT month_index, amount_kobo, status, attempts, error, updated_at
    FROM contract_charge_attempts
    WHERE organization_id = ${orgId}
    ORDER BY month_index DESC
    LIMIT ${limit}
  `;
  return rows.map((row) => ({
    monthIndex: Number(row.month_index),
    amountKobo: Number(row.amount_kobo),
    status: row.status as string,
    attempts: Number(row.attempts),
    error: (row.error as string) ?? "",
    updatedAt: new Date(row.updated_at as string).toISOString(),
  }));
}
