"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { SCHEMA_OUT_OF_DATE_MESSAGE, isSchemaOutOfDateError } from "@/lib/db/client";
import { getBusinessProfile } from "@/lib/db/organizations";
import { handleMissedCall } from "@/lib/ai/missed-call";
import {
  activateReceptionistContract,
  amountDueNow,
  applyContractPayment,
  applyWalletTopUp,
  cancelReceptionistContract,
  saveContractCard,
  setAutoCharge,
} from "@/lib/ai/billing-fulfilment";
import { collectDueMonth, getChargeHistory } from "@/lib/ai/auto-charge";
import { getPack, packForBusinessType, type PackId } from "@/lib/ai/industry-packs";
import { CANCEL_ANY_TIME, FREE_CREDIT_KOBO, MONTHLY_FEE_KOBO, SETUP_FEE_KOBO, SETUP_MONTHS, setupAmortization, totalContractValue } from "@/lib/ai/pricing";
import { formatKobo } from "@/lib/format";
import { initializeContractPayment, initializeWalletTopUp, verifyTransaction } from "@/lib/paystack";
import { isDeepSeekConfigured } from "@/lib/deepseek";
import { isMessagingConfigured } from "@/lib/twilio";
import {
  ensureSetup,
  getConfig,
  getContract,
  getMissedCall,
  getStats,
  getWalletSettings,
  listChatMessages,
  listChatSessions,
  listMissedCalls,
  listWalletTransactions,
  updateConfig,
  updateMissedCall,
  walletBalance,
  creditWallet,
} from "@/lib/db/receptionist";
import type { ActionResult } from "./types";
import type { AiReceptionistConfig, MissedCall, ReceptionistContract, ReceptionistMessage, ReceptionistOverview } from "@/lib/ai/types";

/**
 * Server actions for the AI receptionist console.
 *
 * Every one of these starts with `requireSession()` and derives the
 * organization from the session — a business can only ever read or change
 * its own receptionist, its own wallet and its own calls. That is also why
 * `handleMissedCall`, which has no session at all, is called with a payload
 * built *from* the session's own config in `simulateMissedCallAction` rather
 * than accepting a dialled number from the client.
 */

function appOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "jktl.com.ng";
  return `https://business.${root}`;
}

/** Creates the config/wallet/contract rows if this business has never opened
 * the console, seeded from its business profile — so a men's health clinic
 * arrives with the men's health pack and its own phone number already set. */
async function ensureForSession(orgId: string) {
  const profile = await getBusinessProfile(orgId);
  await ensureSetup(orgId, {
    packId: packForBusinessType(profile?.businessType).id,
    escalationPhone: profile?.phone ?? "",
    escalationEmail: profile?.email ?? "",
  });
  return profile;
}

/**
 * Turns a missing-table failure into the command that fixes it.
 *
 * Without this, a half-migrated database shows "Couldn't load the console" and
 * logs a raw Postgres error — the developer has to know that 42P01 means "run the
 * migrations". One line here saves that entirely, and this is the page most
 * likely to be opened first on a fresh install.
 */
function describeOverviewFailure(err: unknown): string {
  return isSchemaOutOfDateError(err) ? SCHEMA_OUT_OF_DATE_MESSAGE : "Couldn't load the AI receptionist console just now.";
}

export async function getReceptionistOverviewAction(windowDays = 30): Promise<ActionResult<ReceptionistOverview>> {
  try {
    const { organizationId } = await requireSession();
    await ensureForSession(organizationId);

    const days = Math.min(365, Math.max(1, Math.round(windowDays)));
    const [config, wallet, contract, stats, missedCalls, sessions, transactions] = await Promise.all([
      getConfig(organizationId),
      getWalletSettings(organizationId),
      getContract(organizationId),
      getStats(organizationId, days),
      listMissedCalls(organizationId, 40),
      listChatSessions(organizationId, 20),
      listWalletTransactions(organizationId, 25),
    ]);

    if (!config) return { ok: false, error: "The receptionist could not be initialised." };

    return {
      ok: true,
      data: {
        config,
        wallet,
        contract,
        stats,
        missedCalls,
        sessions,
        transactions,
        integrations: { messaging: isMessagingConfigured(), deepseek: isDeepSeekConfigured() },
      },
    };
  } catch (err) {
    console.error(err);
    return { ok: false, error: describeOverviewFailure(err) };
  }
}

export interface SaveConfigInput {
  enabled: boolean;
  packId: string;
  voiceNumber: string;
  smsSenderId: string;
  greeting: string;
  escalationPhone: string;
  escalationEmail: string;
  triageEnabled: boolean;
  autoBook: boolean;
  averageConsultValueNaira: number;
  quietHoursStart: string;
  quietHoursEnd: string;
}

const VALID_PACKS: PackId[] = ["mens_health", "aesthetics", "elderly_care", "general"];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function saveReceptionistConfigAction(input: SaveConfigInput): Promise<ActionResult<AiReceptionistConfig>> {
  try {
    const { organizationId } = await requireSession();

    const packId: PackId = VALID_PACKS.includes(input.packId as PackId) ? (input.packId as PackId) : "general";
    const voiceNumber = input.voiceNumber.replace(/[^\d+]/g, "").slice(0, 20);
    const escalationEmail = input.escalationEmail.trim().slice(0, 200);
    if (escalationEmail && !escalationEmail.includes("@")) {
      return { ok: false, error: "Please enter a valid escalation email address." };
    }
    if (input.quietHoursStart && !HHMM.test(input.quietHoursStart)) return { ok: false, error: "Quiet hours must be in HH:MM format." };
    if (input.quietHoursEnd && !HHMM.test(input.quietHoursEnd)) return { ok: false, error: "Quiet hours must be in HH:MM format." };

    // A value of zero would make every recovery look worthless in the ROI
    // report; clamp to the ₦1,000 floor rather than accept it silently.
    const averageConsultValueKobo = Math.max(100_000, Math.round(input.averageConsultValueNaira * 100));

    const config = await updateConfig(organizationId, {
      enabled: Boolean(input.enabled),
      packId,
      voiceNumber,
      smsSenderId: input.smsSenderId.trim().slice(0, 11).toUpperCase(),
      greeting: input.greeting.trim().slice(0, 400),
      escalationPhone: input.escalationPhone.trim().slice(0, 30),
      escalationEmail,
      triageEnabled: Boolean(input.triageEnabled),
      autoBook: Boolean(input.autoBook),
      averageConsultValueKobo,
      quietHoursStart: input.quietHoursStart,
      quietHoursEnd: input.quietHoursEnd,
    });

    revalidatePath("/business/receptionist");
    return { ok: true, data: config };
  } catch (err) {
    console.error(err);
    // The most likely failure by far is the unique index on voice_number,
    // which is exactly the case the operator needs explained rather than a
    // generic error.
    const message = err instanceof Error && /voice_number/.test(err.message)
      ? "That clinic line is already assigned to another business."
      : "Couldn't save the settings.";
    return { ok: false, error: message };
  }
}

/* -------------------------------------------------------------------------- */
/* Money                                                                      */
/* -------------------------------------------------------------------------- */

export async function startWalletTopUpAction(amountNaira: number): Promise<ActionResult<{ authorizationUrl: string }>> {
  try {
    const { organizationId } = await requireSession();
    const amountKobo = Math.round(amountNaira * 100);
    if (!Number.isFinite(amountKobo) || amountKobo < 50_000) return { ok: false, error: "The minimum top-up is ₦500." };
    if (amountKobo > 50_000_000) return { ok: false, error: "For a top-up above ₦500,000 please contact us directly." };

    const profile = await getBusinessProfile(organizationId);
    const email = profile?.email?.includes("@") ? profile.email : `wallet-${organizationId}@jktl.com.ng`;

    const { authorizationUrl } = await initializeWalletTopUp({
      email,
      amountKobo,
      callbackUrl: `${appOrigin()}/business/receptionist/callback`,
      organizationId,
    });
    return { ok: true, data: { authorizationUrl } };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't start the payment — please try again." };
  }
}

/**
 * Records a top-up that arrived by bank transfer. `reference` is the
 * caller's idempotency key (generated once when the form was opened), so a
 * double-tap cannot credit the wallet twice — the ledger's
 * `(provider, provider_ref)` uniqueness rejects the second insert.
 */
export async function recordManualTopUpAction(amountNaira: number, reference: string, note: string): Promise<ActionResult<{ balanceKobo: number }>> {
  try {
    const { organizationId } = await requireSession();
    const amountKobo = Math.round(amountNaira * 100);
    if (!Number.isFinite(amountKobo) || amountKobo <= 0) return { ok: false, error: "Enter the amount you received." };
    if (!reference.trim()) return { ok: false, error: "Missing reference — please reopen this form." };

    await creditWallet({
      organizationId,
      kind: "topup",
      amountKobo,
      provider: "manual",
      providerRef: reference.trim().slice(0, 80),
      description: note.trim().slice(0, 200) || "Communication wallet top-up (bank transfer)",
    });

    const balanceKobo = await walletBalance(organizationId);
    revalidatePath("/business/receptionist");
    return { ok: true, data: { balanceKobo } };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't record that top-up." };
  }
}

/**
 * Starts a hosted checkout for the month of the contract that is due now.
 *
 * The amount is not a parameter: it comes from `amountDueNow()`, which reads
 * the schedule in `src/lib/ai/pricing.ts` (₦108,333.33 for the first six
 * months, ₦59,000 after). A caller cannot ask to be charged something else,
 * and the console's "Pay ₦X" button and the weekly reminder therefore cannot
 * disagree about the figure.
 */
export async function startContractPaymentAction(): Promise<
  ActionResult<{ authorizationUrl: string; amountKobo: number; monthIndex: number }>
> {
  try {
    const { organizationId } = await requireSession();
    await ensureForSession(organizationId);

    const due = await amountDueNow(organizationId);
    if (!due.due) {
      return {
        ok: false,
        error:
          due.reason === "cancelled"
            ? "This contract is cancelled — there is nothing to pay."
            : due.reason === "not_started"
              ? "Start the contract first."
              : "You're up to date — the next payment isn't due yet.",
      };
    }

    const profile = await getBusinessProfile(organizationId);
    const email = profile?.email?.includes("@") ? profile.email : `contract-${organizationId}@jktl.com.ng`;

    const { authorizationUrl } = await initializeContractPayment({
      email,
      amountKobo: due.amountKobo,
      monthIndex: due.monthIndex,
      callbackUrl: `${appOrigin()}/business/receptionist/callback`,
      organizationId,
    });

    return { ok: true, data: { authorizationUrl, amountKobo: due.amountKobo, monthIndex: due.monthIndex } };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't start the payment — please try again." };
  }
}

/**
 * Cancels the contract. Allowed from month 1, which is the whole point — and
 * the reason the console shows what the cancellation writes off rather than
 * only confirming it.
 */
export async function cancelContractAction(reason: string): Promise<ActionResult<{ cancelled: boolean; detail: string }>> {
  try {
    const { organizationId } = await requireSession();
    const result = await cancelReceptionistContract(organizationId, reason.trim().slice(0, 300) || "Cancelled by the business");
    if (!result.cancelled) {
      return { ok: false, error: result.reason === "already_cancelled" ? "This contract is already cancelled." : "There's no active contract to cancel." };
    }
    revalidatePath("/business/receptionist");
    return { ok: true, data: { cancelled: true, detail: "Cancelled. No further payments will be taken." } };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't cancel the contract." };
  }
}

/**
 * Confirms a Paystack payment after the redirect back, and applies it.
 *
 * The webhook remains authoritative (it fires even if the browser is closed),
 * and both paths funnel into the same idempotent fulfilment functions, so
 * arriving here second is expected and harmless — the ledger reference is
 * what guarantees a single credit.
 */
export async function reconcilePaymentAction(reference: string): Promise<ActionResult<{ kind: string; amountKobo: number; detail: string }>> {
  try {
    const { organizationId } = await requireSession();
    if (!reference.trim()) return { ok: false, error: "Missing payment reference." };

    const data = await verifyTransaction(reference.trim());
    if (data.status !== "success") {
      return { ok: false, error: `That payment is ${data.status}. If you were debited, contact us with reference ${data.reference}.` };
    }

    const metadata = (data.metadata ?? {}) as Record<string, unknown>;
    // The metadata organizationId must match the signed-in business; a
    // reference from another tenant must not credit this wallet.
    if (metadata.organizationId && metadata.organizationId !== organizationId) {
      return { ok: false, error: "That payment belongs to a different account." };
    }

    const amountKobo = Number(data.amount ?? 0);

    // A month of the contract. `receptionist_setup` is the pre-amortisation
    // name, treated as month 1 so a checkout already in flight still lands.
    if (metadata.type === "receptionist_month" || metadata.type === "receptionist_setup") {
      const hint = Number(metadata.monthIndex ?? 0);
      const monthIndex = metadata.type === "receptionist_setup" ? 1 : hint > 0 ? hint : undefined;

      // Ensure the contract exists before attaching a payment to it — the
      // first checkout is often the first thing a clinic does.
      const activated = await activateReceptionistContract({
        organizationId,
        startedAt: data.paid_at ? new Date(data.paid_at) : undefined,
        reference: data.reference,
      });

      const applied = await applyContractPayment({
        organizationId,
        amountKobo,
        reference: data.reference,
        paidAt: data.paid_at ? new Date(data.paid_at) : new Date(),
        monthIndex,
      });

      revalidatePath("/business/receptionist");
      return {
        ok: true,
        data: {
          kind: "contract",
          amountKobo,
          detail: applied.applied
            ? `Payment received for month ${applied.monthIndex}.${activated.activated ? ` ${formatKobo(FREE_CREDIT_KOBO)} of launch communication credit is now in your wallet.` : ""}`
            : applied.reason === "already_recorded"
              ? "This month was already recorded — nothing was charged twice."
              : applied.reason === "underpaid"
                ? `We received ${formatKobo(amountKobo)} but this month is ${formatKobo(applied.expectedKobo ?? 0)}. Please contact us and we'll sort it out.`
                : "Payment received, but it could not be applied to the contract. Please contact us.",
        },
      };
    }

    if (metadata.type === "wallet_topup") {
      const result = await applyWalletTopUp({ organizationId, amountKobo, reference: data.reference });
      revalidatePath("/business/receptionist");
      return {
        ok: true,
        data: {
          kind: "topup",
          amountKobo,
          detail: result.duplicate ? "This top-up was already credited." : "Wallet topped up.",
        },
      };
    }

    return { ok: false, error: "That payment isn't for the AI receptionist." };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't confirm the payment yet — it will be applied automatically once Paystack confirms it." };
  }
}

/* -------------------------------------------------------------------------- */
/* Operations                                                                 */
/* -------------------------------------------------------------------------- */

export interface SimulateResult {
  /** Whether the pipeline itself succeeded — a blocked wallet is a valid
   * result to render, not a failure of the action. */
  success: boolean;
  outcome: string;
  detail: string;
  sms?: string;
  segments?: number;
  costKobo?: number;
  walletBalanceKobo?: number;
}

/**
 * Runs the real intercept pipeline against a made-up missed call, using this
 * business's own configured line. It exists so a clinic can prove the whole
 * chain — webhook, wallet debit, SMS, chat link — before pointing their live
 * number at it, and so the sales conversation can end with a text message
 * arriving on the medical director's own phone.
 *
 * It is not a simulation of the pipeline; it *is* the pipeline, including the
 * wallet charge and a real Twilio send.
 */
export async function simulateMissedCallAction(callerPhone: string): Promise<ActionResult<SimulateResult>> {
  try {
    const { organizationId } = await requireSession();
    const profile = await ensureForSession(organizationId);
    const config = await getConfig(organizationId);
    if (!config) return { ok: false, error: "The receptionist could not be initialised." };
    if (!config.voiceNumber) return { ok: false, error: "Save a clinic line first — the simulated call has to arrive somewhere." };

    const phone = callerPhone.replace(/[^\d+]/g, "");
    if (phone.replace(/\D/g, "").length < 10) return { ok: false, error: "Enter a valid phone number to send the test message to." };

    const result = await handleMissedCall({
      caller_id: phone,
      to: config.voiceNumber,
      call_id: `sim-${crypto.randomUUID()}`,
      timestamp: new Date().toISOString(),
      status: "missed",
      business_name: profile?.displayName ?? "",
    });

    revalidatePath("/business/receptionist");
    return {
      ok: true,
      data: {
        success: result.ok,
        outcome: result.outcome,
        detail: result.detail,
        sms: result.sms,
        segments: result.segments,
        costKobo: result.costKobo,
        walletBalanceKobo: result.walletBalanceKobo,
      },
    };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "The test call couldn't be run." };
  }
}

/** Re-runs a call whose message never left (empty wallet, provider error). */
export async function retryMissedCallAction(missedCallId: string): Promise<ActionResult<SimulateResult>> {
  try {
    const { organizationId } = await requireSession();
    const call = await getMissedCall(organizationId, missedCallId);
    if (!call) return { ok: false, error: "That call isn't on this account." };
    if (call.status !== "sms_failed" && call.status !== "sms_blocked") {
      return { ok: false, error: "That call already has a message out — nothing to retry." };
    }

    const result = await handleMissedCall({
      caller_id: call.callerPhone,
      to: call.calledNumber,
      // Re-sending the *original* provider call id (or, when the provider
      // sent none, the original timestamp) is what makes this a retry of the
      // same record rather than a second missed call — the pipeline's replay
      // guards match it and continue the failed send.
      call_id: call.providerCallId,
      timestamp: call.receivedAt,
      status: "missed",
    });

    revalidatePath("/business/receptionist");
    return {
      ok: true,
      data: {
        success: result.ok,
        outcome: result.outcome,
        detail: result.detail,
        sms: result.sms,
        segments: result.segments,
        costKobo: result.costKobo,
        walletBalanceKobo: result.walletBalanceKobo,
      },
    };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't retry that call." };
  }
}

/**
 * Attributes a booking to a missed call after the fact — the clinic booked
 * the patient by phone, but the call is what brought them back. Without this
 * the ROI report only counts bookings the agent itself wrote, which
 * understates the product and would make the pitch conservative in a way the
 * clinic's own front desk can correct.
 */
export async function markRecoveredAction(missedCallId: string, valueNaira: number): Promise<ActionResult<MissedCall>> {
  try {
    const { organizationId } = await requireSession();
    const call = await getMissedCall(organizationId, missedCallId);
    if (!call) return { ok: false, error: "That call isn't on this account." };

    const config = await getConfig(organizationId);
    const valueKobo = Number.isFinite(valueNaira) && valueNaira > 0
      ? Math.round(valueNaira * 100)
      : (config?.averageConsultValueKobo ?? 2_500_000);

    const updated = await updateMissedCall(organizationId, missedCallId, {
      status: "recovered",
      recoveredValueKobo: valueKobo,
      notes: "Recovered booking recorded by the clinic.",
    });
    if (!updated) return { ok: false, error: "Couldn't update that call." };

    revalidatePath("/business/receptionist");
    return { ok: true, data: updated };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't record that recovery." };
  }
}

/** The conversation behind one missed call, for the console's transcript. */
export async function getTranscriptAction(sessionId: string): Promise<ActionResult<ReceptionistMessage[]>> {
  try {
    const { organizationId } = await requireSession();
    const sessions = await listChatSessions(organizationId, 200);
    if (!sessions.some((s) => s.id === sessionId)) return { ok: false, error: "That conversation isn't on this account." };
    const messages = await listChatMessages(sessionId, 100);
    return { ok: true, data: messages };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't load the conversation." };
  }
}

/**
 * Records the reusable card from a successful manual payment, so the
 * subscription can renew itself from next month on.
 *
 * The manual "Pay month N" button therefore doubles as "add a card": the first
 * payment is made by hand and every one after it happens automatically. That
 * avoids building a separate card-capture flow for a payment we are taking
 * anyway.
 */
export async function saveCardFromPaymentAction(reference: string): Promise<ActionResult<{ saved: boolean }>> {
  try {
    const { organizationId } = await requireSession();
    const data = await verifyTransaction(reference);
    const authorization = (data.metadata ?? {}) as Record<string, unknown>;
    if (data.status !== "success") return { ok: false, error: "That payment did not succeed." };
    if ((authorization.organizationId as string) && authorization.organizationId !== organizationId) {
      return { ok: false, error: "That payment belongs to a different account." };
    }

    const auth = data.authorization ?? {};
    const saved = await saveContractCard(organizationId, {
      authorizationCode: auth.authorization_code ?? "",
      reusable: auth.reusable === true,
      brand: auth.brand ?? "",
      last4: auth.last4 ?? "",
      expMonth: auth.exp_month ?? "",
      expYear: auth.exp_year ?? "",
    });

    revalidatePath("/business/receptionist");
    return {
      ok: true,
      data: {
        saved,
      },
    };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Could not save the card for next month." };
  }
}

export async function setAutoChargeAction(enabled: boolean): Promise<ActionResult<{ enabled: boolean }>> {
  try {
    const { organizationId } = await requireSession();
    const contract = await getContract(organizationId);
    if (!contract) return { ok: false, error: "There's no subscription to change yet." };
    if (enabled && !contract.hasCard) {
      return { ok: false, error: "Add a card first — make one payment and we'll use it for the months after." };
    }
    await setAutoCharge(organizationId, enabled);
    revalidatePath("/business/receptionist");
    return { ok: true, data: { enabled } };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Could not change that setting." };
  }
}

/** Retries a failed collection immediately, for a clinic that has just fixed
 * its card and doesn't want to wait for tomorrow's run. */
export async function retryChargeNowAction(): Promise<ActionResult<{ status: string; detail: string }>> {
  try {
    const { organizationId } = await requireSession();
    const outcome = await collectDueMonth(organizationId);
    revalidatePath("/business/receptionist");
    switch (outcome.status) {
      case "charged":
        return { ok: true, data: { status: "charged", detail: `Paid ${formatKobo(outcome.amountKobo)} for month ${outcome.monthIndex}.` } };
      case "failed":
        return { ok: false, error: `The card was declined: ${outcome.error}` };
      case "no_card":
        return { ok: false, error: "There's no card on file yet." };
      case "already_charged":
        return { ok: true, data: { status: "charged", detail: `Month ${outcome.monthIndex} is already settled.` } };
      case "cancelled":
        return { ok: false, error: "This subscription is cancelled." };
      default:
        return { ok: true, data: { status: "not_due", detail: "Nothing is due yet." } };
    }
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Could not run the payment." };
  }
}

/**
 * Everything the billing screen needs about the subscription, in one call:
 * the schedule, the card, what has been collected, and what happened last time
 * we tried. Deliberately one action rather than four, so the screen cannot show
 * a card next to a stale amount.
 */
export async function getSubscriptionBillingAction(): Promise<
  ActionResult<{
    contract: ReceptionistContract | null;
    due: { due: boolean; monthIndex: number; amountKobo: number; phase: string } | null;
    history: Array<{ monthIndex: number; amountKobo: number; status: string; attempts: number; error: string; updatedAt: string }>;
    monthsPaid: number;
  }>
> {
  try {
    const { organizationId } = await requireSession();
    const [contract, due, history] = await Promise.all([
      getContract(organizationId),
      amountDueNow(organizationId),
      getChargeHistory(organizationId),
    ]);
    return {
      ok: true,
      data: {
        contract,
        due: due.due ? { due: true, monthIndex: due.monthIndex, amountKobo: due.amountKobo, phase: due.phase } : null,
        history,
        monthsPaid: contract?.chargesPaid ?? 0,
      },
    };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Could not load your subscription billing." };
  }
}

/** The pack's own text, for the console's read-only policy preview. */
export async function getPackPreviewAction(packId: string): Promise<ActionResult<{ label: string; summary: string; rules: Array<{ id: string; label: string; severity: string }> }>> {
  const pack = getPack(VALID_PACKS.includes(packId as PackId) ? (packId as PackId) : "general");
  return {
    ok: true,
    data: {
      label: pack.label,
      summary: pack.summary,
      rules: pack.triageRules.map((r) => ({ id: r.id, label: r.label, severity: r.severity })),
    },
  };
}

/** The commercial terms the console shows, from the single pricing module. */
/**
 * The commercial terms the console renders, taken from the single pricing
 * module — including the real amortisation schedule, so the six instalments
 * shown to a clinic are the same ones it will be billed and the same ones the
 * tests assert sum to exactly ₦650,000.
 */
export async function getTermsAction(): Promise<
  ActionResult<{
    setupFeeKobo: number;
    setupMonths: number;
    setupInstalmentsKobo: number[];
    monthlyFeeKobo: number;
    includedCreditKobo: number;
    firstYearTotalKobo: number;
    cancellableAnyTime: boolean;
  }>
> {
  return {
    ok: true,
    data: {
      setupFeeKobo: SETUP_FEE_KOBO,
      setupMonths: SETUP_MONTHS,
      setupInstalmentsKobo: setupAmortization(),
      monthlyFeeKobo: MONTHLY_FEE_KOBO,
      includedCreditKobo: FREE_CREDIT_KOBO,
      firstYearTotalKobo: totalContractValue(12),
      cancellableAnyTime: CANCEL_ANY_TIME,
    },
  };
}
