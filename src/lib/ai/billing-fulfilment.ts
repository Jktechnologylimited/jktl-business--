import "server-only";
import { getSql } from "@/lib/db/client";
import { accrueCommissionForOrg } from "@/lib/db/affiliates";
import {
  cancelContract,
  creditWallet,
  ensureSetup,
  getContract,
  grantFreeCredits,
  recordContractPayment,
  startContract,
} from "@/lib/db/receptionist";
import { getBusinessProfile } from "@/lib/db/organizations";
import { packForBusinessType } from "./industry-packs";
import {
  amountForMonth,
  DEFAULT_CONTRACT_TERMS,
  FREE_CREDIT_KOBO,
  MONTHLY_FEE_KOBO,
  platformPhaseStart,
  SETUP_MONTHS,
  SETUP_MONTHLY_KOBO,
  type ContractTerms,
} from "./pricing";

/**
 * Turns a successful Paystack charge into the thing the clinic bought.
 *
 * One implementation, two callers — the Paystack webhook (authoritative, fires
 * even if the buyer closes the browser) and the checkout callback page
 * (immediate feedback). Every effect is idempotent on the Paystack reference
 * or on the contract's own month counter, so both running is not just safe but
 * expected.
 *
 * The billing shape, in full:
 *
 *   months 1–6   ₦108,333.33/month   (the ₦650,000 package, amortised)
 *   month 7+     ₦59,000/month       (platform tier)
 *   cancellation from month 1, no minimum term, no early-exit fee
 */

/**
 * Hands a business its free communication allocation.
 *
 * Keyed on the organisation rather than a payment reference: it is a grant,
 * not part of any one instalment, and it must land exactly once. It is
 * recorded as `kind = 'grant'` with the free bucket, so the clinic spends it
 * before touching paid balance and JKTL's revenue reporting never counts it as
 * income.
 */
async function grantIncludedCredit(organizationId: string): Promise<void> {
  await grantFreeCredits({
    organizationId,
    amountKobo: FREE_CREDIT_KOBO,
    providerRef: `free-credit:${organizationId}`,
    description: `Free communication credit (${FREE_CREDIT_KOBO / 100 >= 1000 ? "welcome allocation" : "grant"})`,
  });
}

/** A clinic topped up its communication wallet by card. Idempotent on the
 * Paystack reference, which is the ledger's `provider_ref`. */
export async function applyWalletTopUp(params: {
  organizationId: string;
  amountKobo: number;
  reference: string;
  description?: string;
}): Promise<{ credited: boolean; duplicate: boolean }> {
  const result = await creditWallet({
    organizationId: params.organizationId,
    kind: "topup",
    amountKobo: params.amountKobo,
    provider: "paystack",
    providerRef: params.reference,
    description: params.description ?? "Communication wallet top-up (card)",
  });
  return { credited: true, duplicate: result.duplicate };
}

/**
 * Activates the receptionist contract: month 1 falls due now, the platform
 * tier takes over in month 7, and the bundled launch credit lands in the
 * wallet so the agent can send from day one.
 *
 * Guarded on `started_at`, so re-running this cannot move the schedule or hand
 * out a second credit.
 */
export async function activateReceptionistContract(params: {
  organizationId: string;
  startedAt?: Date;
  reference: string;
}): Promise<{ activated: boolean; alreadyActive: boolean; startedAt: string | null }> {
  const organizationId = params.organizationId;

  // A clinic can activate before it ever opens the console, and an
  // INSERT-less UPDATE would silently do nothing.
  const profile = await getBusinessProfile(organizationId);
  await ensureSetup(organizationId, {
    packId: packForBusinessType(profile?.businessType).id,
    escalationPhone: profile?.phone ?? "",
    escalationEmail: profile?.email ?? "",
  });

  const existing = await getContract(organizationId);
  if (existing?.startedAt) {
    await grantIncludedCredit(organizationId);
    return { activated: false, alreadyActive: true, startedAt: existing.startedAt };
  }

  const startedAt = params.startedAt ?? new Date();
  const contract = await startContract(organizationId, {
    startedAt,
    billingStartsAt: platformPhaseStart(startedAt),
    paymentRef: params.reference,
    includedCreditKobo: FREE_CREDIT_KOBO,
    monthlyFeeKobo: MONTHLY_FEE_KOBO,
    setupMonths: SETUP_MONTHS,
    setupMonthlyKobo: SETUP_MONTHLY_KOBO,
  });

  await grantIncludedCredit(organizationId);
  return { activated: true, alreadyActive: false, startedAt: contract?.startedAt ?? startedAt.toISOString() };
}

/**
 * Saves the reusable card a successful payment came from, so the next month
 * can be collected without the clinic doing anything. Called from the webhook
 * and from the contract-payment action, both of which receive Paystack's
 * authorization block.
 *
 * Only a `reusable` authorization is stored: a one-off token cannot be charged
 * again, so saving it would just mean a future attempt fails against a dead
 * card instead of reporting "no card on file".
 */
export async function saveContractCard(
  organizationId: string,
  card: { authorizationCode: string; reusable: boolean; brand?: string; last4?: string; expMonth?: string; expYear?: string },
): Promise<boolean> {
  if (!card.reusable || !card.authorizationCode) return false;
  const sql = getSql();
  await sql`
    UPDATE ai_receptionist_contracts SET
      paystack_authorization_code = ${card.authorizationCode},
      card_brand = ${card.brand ?? ""},
      card_last4 = ${card.last4 ?? ""},
      card_exp_month = ${card.expMonth ?? ""},
      card_exp_year = ${card.expYear ?? ""},
      last_charge_error = '',
      updated_at = now()
    WHERE organization_id = ${organizationId}
  `;
  return true;
}

/**
 * Records the outcome of an automatic collection on the contract itself —
 * when it last tried, what went wrong, and whether it has failed often enough
 * to be flagged past due.
 */
export async function markContractPaidExternally(
  organizationId: string,
  outcome: { paidAt: Date | null; attempts: number; error?: string },
): Promise<void> {
  const sql = getSql();
  if (outcome.paidAt) {
    await sql`
      UPDATE ai_receptionist_contracts SET
        last_charge_at = ${outcome.paidAt.toISOString()},
        last_charge_attempt_at = now(),
        last_charge_error = '',
        status = CASE WHEN status = 'cancelled' THEN status ELSE 'active' END,
        updated_at = now()
      WHERE organization_id = ${organizationId}
    `;
    return;
  }

  // Three failures and the contract is flagged, which stops the cron retrying a
  // dead card every single day for a month.
  const shouldFlag = outcome.attempts >= 3;
  await sql`
    UPDATE ai_receptionist_contracts SET
      last_charge_attempt_at = now(),
      last_charge_error = ${outcome.error ?? ""},
      status = CASE WHEN ${shouldFlag} AND status = 'active' THEN 'past_due' ELSE status END,
      updated_at = now()
    WHERE organization_id = ${organizationId}
  `;
}

export async function setAutoCharge(organizationId: string, enabled: boolean): Promise<void> {
  const sql = getSql();
  await sql`UPDATE ai_receptionist_contracts SET auto_charge_enabled = ${enabled}, updated_at = now() WHERE organization_id = ${organizationId}`;
}

export type ContractPaymentOutcome =
  | { applied: true; monthIndex: number; nextChargeAt: string | null; chargesPaid: number }
  | { applied: false; reason: "not_started" | "cancelled" | "already_recorded" | "underpaid"; expectedKobo?: number };

/**
 * Applies one collected monthly payment.
 *
 * Three things are checked rather than assumed, because this is the money:
 *
 *   - the contract exists and is running;
 *   - the amount actually collected covers the month being paid for
 *     (`amountForMonth`), so a tampered or partial charge cannot advance the
 *     schedule. The amount comes from Paystack's own `data.amount`, never from
 *     the metadata we sent out;
 *   - the month being paid for is the one the contract is actually expecting,
 *     which is what stops a redelivered webhook from advancing it twice.
 */
export async function applyContractPayment(params: {
  organizationId: string;
  amountKobo: number;
  reference: string;
  paidAt?: Date;
  monthIndex?: number;
  terms?: ContractTerms;
}): Promise<ContractPaymentOutcome> {
  const terms = params.terms ?? DEFAULT_CONTRACT_TERMS;
  const contract = await getContract(params.organizationId);
  if (!contract?.startedAt) return { applied: false, reason: "not_started" };
  if (contract.status === "cancelled") return { applied: false, reason: "cancelled" };

  const monthIndex = Math.max(1, Math.floor(params.monthIndex ?? contract.chargesPaid + 1));
  const expectedKobo = amountForMonth(monthIndex, terms);
  if (params.amountKobo + 1 < expectedKobo) {
    // +1 kobo of tolerance: naira rounding at the checkout must not fail a
    // legitimate payment.
    return { applied: false, reason: "underpaid", expectedKobo };
  }

  const paidAt = params.paidAt ?? new Date();
  const nextChargeAt = new Date(paidAt);
  nextChargeAt.setUTCMonth(nextChargeAt.getUTCMonth() + 1);

  const result = await recordContractPayment(params.organizationId, {
    paidAt,
    nextChargeAt,
    reference: params.reference,
    // The payment being recorded must be the next one the contract expects.
    expectedMonth: monthIndex - 1,
  });

  if (!result.recorded) return { applied: false, reason: "already_recorded" };

  // Partner commission. The receptionist *is* a subscription, so a referred
  // clinic paying for it has subscribed in every sense the programme means.
  // Accrued here rather than in the webhook because a month collected
  // automatically never passes through the webhook, and a partner silently
  // missing commission on the months that renew themselves would be the worst
  // possible bug in this feature.
  //
  // Best-effort: a commission bookkeeping failure must never fail a payment that
  // has already been recorded.
  await accrueCommissionForOrg(params.organizationId, params.amountKobo, params.reference, params.paidAt ?? new Date()).catch((err) =>
    console.error("applyContractPayment: accrueCommissionForOrg failed", err),
  );

  return {
    applied: true,
    monthIndex,
    nextChargeAt: result.contract?.nextChargeAt ?? nextChargeAt.toISOString(),
    chargesPaid: result.contract?.chargesPaid ?? monthIndex,
  };
}

/**
 * The monthly payment a clinic owes right now, and what it covers — the single
 * source of truth for both the console's "Pay ₦X" button and the cron's
 * reminder, so they can never disagree about the amount.
 */
export async function amountDueNow(organizationId: string, terms: ContractTerms = DEFAULT_CONTRACT_TERMS): Promise<
  | { due: false; reason: "not_started" | "cancelled" | "up_to_date" }
  | { due: true; monthIndex: number; amountKobo: number; phase: "setup" | "platform" }
> {
  const contract = await getContract(organizationId);
  if (!contract?.startedAt) return { due: false, reason: "not_started" };
  if (contract.status === "cancelled") return { due: false, reason: "cancelled" };

  const monthIndex = contract.chargesPaid + 1;
  const nextChargeAt = contract.nextChargeAt ? new Date(contract.nextChargeAt) : new Date(contract.startedAt);
  // Billing runs on the calendar, not on the clinic's enthusiasm: nothing is
  // due until the next charge date arrives.
  if (nextChargeAt.getTime() > Date.now() + 24 * 60 * 60 * 1000) return { due: false, reason: "up_to_date" };

  return {
    due: true,
    monthIndex,
    amountKobo: amountForMonth(monthIndex, terms),
    phase: monthIndex <= terms.setupMonths ? "setup" : "platform",
  };
}

/** Cancels the contract. See `cancelContract` in the query layer for what the
 * no-lock-in promise costs. */
export async function cancelReceptionistContract(
  organizationId: string,
  reason: string,
): Promise<{ cancelled: boolean; reason: string }> {
  const before = await getContract(organizationId);
  if (!before) return { cancelled: false, reason: "not_started" };
  if (before.status === "cancelled") return { cancelled: false, reason: "already_cancelled" };
  await cancelContract(organizationId, { cancelledAt: new Date(), reason });
  return { cancelled: true, reason: "cancelled" };
}
