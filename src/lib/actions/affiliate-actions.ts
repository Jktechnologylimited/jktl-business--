"use server";

import { verifyAffiliateLogin, changeAffiliatePassword } from "@/lib/db/affiliate-auth";
import { startAffiliateSession, endAffiliateSession, requireAffiliateSession } from "@/lib/affiliate-session";
import { firstYearValueKobo } from "@/lib/affiliate-commission";
import {
  earningsByKind,
  earningsByMonth,
  projectedTwelveMonths,
  recurringRunRate,
  referralFunnel,
  referralValue,
} from "@/lib/affiliate-report";
import { periodKeyFor } from "@/lib/ai/pricing";
import {
  RESET_TOKEN_TTL_MINUTES,
  resetFailureMessage,
  validateNewPassword,
} from "@/lib/affiliate-reset-token";
import {
  completeAffiliatePasswordReset,
  lookupAffiliatePasswordReset,
  requestAffiliatePasswordReset,
} from "@/lib/db/affiliate-auth";
import { sendAffiliatePasswordResetEmail } from "@/lib/email";
import { listBanks, resolveAccountNumber, type PaystackBank } from "@/lib/paystack";
import {
  listReferredBusinesses,
  listEarnings,
  listPayouts,
  getAffiliateBalance,
  getAffiliateById,
  applyAsAffiliate,
  saveAffiliateBankDetails,
  requestPayout,
  getCurrentPayoutRequest,
  isPayoutWindowOpen,
  AFFILIATE_EMAIL_TAKEN,
  PAYOUT_WINDOW_CLOSED,
  PAYOUT_ALREADY_REQUESTED,
  PAYOUT_NOTHING_TO_REQUEST,
  PAYOUT_BANK_NOT_VERIFIED,
  type AffiliateReferredBusiness,
  type AffiliateEarning,
  type AffiliatePayout,
  type PayoutRequest,
} from "@/lib/db/affiliates";
import type { ActionResult } from "./types";

/** The month before a 'YYYY-MM' key. Local, because the affiliate report must not
 * depend on the AI receptionist's billing module for date arithmetic. */
function monthBefore(periodKey: string): string {
  const [year, month] = periodKey.split("-").map(Number);
  if (!year || !month) return "";
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
}

function appOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "jktl.com.ng";
  return `https://business.${root}`;
}

const LOGIN_ERROR: Record<"not_found" | "pending" | "suspended" | "wrong_password", string> = {
  not_found: "That email doesn't match an affiliate account. Applied recently? Check the email you applied with.",
  pending: "Your application is still under review — you'll be able to sign in once it's approved.",
  suspended: "Your affiliate account has been suspended.",
  wrong_password: "That password isn't correct.",
};

export async function affiliateLoginAction(email: string, password: string): Promise<ActionResult<null>> {
  try {
    const result = await verifyAffiliateLogin(email, password);
    if (!result.ok) return { ok: false, error: LOGIN_ERROR[result.reason] };
    await startAffiliateSession(result.affiliate.id);
    return { ok: true, data: null };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't sign in right now. Please try again." };
  }
}

/**
 * Public self-serve application (migration 014) — anyone can submit one at
 * /affiliates/apply, landing in `status = 'pending'` until an admin
 * approves it from the command center. No session is started here; there's
 * nothing to sign into yet.
 */
export async function applyAsAffiliateAction(input: {
  name: string;
  email: string;
  password: string;
  applicationNote: string;
}): Promise<ActionResult<null>> {
  try {
    if (!input.name.trim() || !input.email.trim()) return { ok: false, error: "Name and email are both required." };
    if (input.password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };
    await applyAsAffiliate({
      name: input.name.trim(),
      email: input.email.trim(),
      password: input.password,
      applicationNote: input.applicationNote.trim(),
    });
    return { ok: true, data: null };
  } catch (err) {
    if (err instanceof Error && err.message === AFFILIATE_EMAIL_TAKEN) {
      return { ok: false, error: "There's already an affiliate account (or a pending application) with that email." };
    }
    console.error(err);
    return { ok: false, error: "Couldn't submit your application right now. Please try again." };
  }
}

export async function affiliateLogoutAction(): Promise<void> {
  await endAffiliateSession();
}

export interface AffiliateDashboardData {
 programme?: "affiliate" | "partner";
  name: string;
  email: string;
  referralCode: string;
  referralLink: string;
  commissionBps: number;
  /** 'tiered' is the published programme; 'percentage' is a legacy override. */
  commissionModel: string;
  totalEarnedKobo: number;
  totalPaidOutKobo: number;
  /** Released and withdrawable. */
  balanceKobo: number;
  /** Earned but held: the signup bonus before the referral subscribes. */
  pendingKobo: number;
  /** The recurring run-rate, so a partner can see what their book is worth. */
  recurringMonthlyKobo: number;
  /** The published tiers, so the dashboard never states a rate the ledger does
   * not pay. */
  terms: { signupBonusKobo: number; subscriptionBonusKobo: number; recurringMonthlyKobo: number };
  /** What one referral is worth in year one. */
  firstYearValueKobo: number;
  /** Reporting, computed from the ledger rather than stored. */
  report: {
    byKind: ReturnType<typeof earningsByKind>;
    byMonth: ReturnType<typeof earningsByMonth>;
    funnel: ReturnType<typeof referralFunnel>;
    runRate: ReturnType<typeof recurringRunRate>;
    value: ReturnType<typeof referralValue>;
    projectedTwelveMonthsKobo: number;
  };
  referredBusinesses: AffiliateReferredBusiness[];
  earnings: AffiliateEarning[];
  payouts: AffiliatePayout[];
  welcomeBonusClaimedAt: string | null;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  bankVerifiedAt: string | null;
  payoutWindowOpen: boolean;
  currentPayoutRequest: PayoutRequest | null;
}

export async function getAffiliateDashboardAction(): Promise<ActionResult<AffiliateDashboardData>> {
  try {
    const session = await requireAffiliateSession();
    const [full, balance, referredBusinesses, earnings, payouts, currentPayoutRequest] = await Promise.all([
      getAffiliateById(session.id),
      getAffiliateBalance(session.id),
      listReferredBusinesses(session.id),
      listEarnings(session.id),
      listPayouts(session.id),
      getCurrentPayoutRequest(session.id),
    ]);
    if (!full) return { ok: false, error: "Couldn't load your dashboard." };

    /*
     * Reporting is derived here rather than stored. Every figure comes from the
     * same rows the balance is built from, so the dashboard cannot show a
     * run-rate that disagrees with the ledger it sits beside.
     */
    const terms = {
      signupBonusKobo: full.signupBonusKobo,
      subscriptionBonusKobo: full.subscriptionBonusKobo,
      recurringMonthlyKobo: full.recurringMonthlyKobo,
      recurringMonthsCap: full.recurringMonthsCap,
    };
    const thisPeriod = periodKeyFor();
    const businessNames = Object.fromEntries(referredBusinesses.map((b) => [b.organizationId, b.displayName]));

    const report = {
      byKind: earningsByKind(earnings),
      byMonth: earningsByMonth(earnings),
      funnel: referralFunnel(referredBusinesses, earnings),
      runRate: recurringRunRate({
        referrals: referredBusinesses,
        earnings,
        recurringMonthlyKobo: terms.recurringMonthlyKobo,
        previousPeriod: monthBefore(thisPeriod),
      }),
      value: referralValue({ earnings, businessNames, modelledFirstYearKobo: firstYearValueKobo(terms) }),
      projectedTwelveMonthsKobo: 0,
    };
    report.projectedTwelveMonthsKobo = projectedTwelveMonths(report.runRate);

    return {
      ok: true,
      data: {
        programme:full.programme,
        name: full.name,
        email: full.email,
        referralCode: full.referralCode,
        referralLink: `${appOrigin()}/signup?ref=${full.referralCode}`,
        commissionBps: full.commissionBps,
        commissionModel: full.commissionModel,
        terms: {
          signupBonusKobo: full.signupBonusKobo,
          subscriptionBonusKobo: full.subscriptionBonusKobo,
          recurringMonthlyKobo: full.recurringMonthlyKobo,
        },
        firstYearValueKobo: firstYearValueKobo({
          signupBonusKobo: full.signupBonusKobo,
          subscriptionBonusKobo: full.subscriptionBonusKobo,
          recurringMonthlyKobo: full.recurringMonthlyKobo,
          recurringMonthsCap: full.recurringMonthsCap,
        }),
        ...balance,
        report,
        referredBusinesses,
        earnings,
        payouts,
        welcomeBonusClaimedAt: full.welcomeBonusClaimedAt,
        bankCode: full.bankCode,
        bankName: full.bankName,
        accountNumber: full.accountNumber,
        accountName: full.accountName,
        bankVerifiedAt: full.bankVerifiedAt,
        payoutWindowOpen: isPayoutWindowOpen(),
        currentPayoutRequest,
      },
    };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't load your dashboard." };
  }
}

// ---- Bank details (verified via Paystack, same free resolve endpoint
// Settings → Payments uses for a business's own payout account) ----

export async function listBanksForAffiliateAction(): Promise<ActionResult<PaystackBank[]>> {
  try {
    await requireAffiliateSession();
    return { ok: true, data: await listBanks() };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't load the bank list right now." };
  }
}

/** Looks up the real account name so the form can show it back for
 * confirmation before saving — mirrors verifyAccountAction in
 * payment-settings-actions.ts, just gated by an affiliate session instead
 * of a business one. */
export async function verifyAffiliateAccountAction(bankCode: string, accountNumber: string): Promise<ActionResult<{ accountName: string }>> {
  try {
    await requireAffiliateSession();
    if (!bankCode || accountNumber.trim().length < 10) {
      return { ok: false, error: "Choose a bank and enter a 10-digit account number." };
    }
    const resolved = await resolveAccountNumber(accountNumber.trim(), bankCode);
    return { ok: true, data: { accountName: resolved.accountName } };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't verify that account — double-check the bank and account number." };
  }
}

/** Always re-resolves server-side right before saving — never trusts a
 * client-supplied account name, even one shown back from an earlier
 * verify call, since the account number could have changed in between. */
export async function saveAffiliateBankDetailsAction(input: { bankCode: string; bankName: string; accountNumber: string }): Promise<ActionResult<null>> {
  try {
    const affiliate = await requireAffiliateSession();
    const accountNumber = input.accountNumber.trim();
    if (!input.bankCode || accountNumber.length < 10) {
      return { ok: false, error: "Choose a bank and enter a 10-digit account number." };
    }
    const resolved = await resolveAccountNumber(accountNumber, input.bankCode);
    await saveAffiliateBankDetails(affiliate.id, {
      bankCode: input.bankCode,
      bankName: input.bankName,
      accountNumber: resolved.accountNumber,
      accountName: resolved.accountName,
    });
    return { ok: true, data: null };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't save your bank details — double-check the account number and try again." };
  }
}

const PAYOUT_REQUEST_ERROR: Record<string, string> = {
  [PAYOUT_WINDOW_CLOSED]: "Payout requests open on the 21st of each month.",
  [PAYOUT_ALREADY_REQUESTED]: "You've already requested a payout this month.",
  [PAYOUT_NOTHING_TO_REQUEST]: "You don't have a balance to request yet.",
  [PAYOUT_BANK_NOT_VERIFIED]: "Add and verify your bank details above before requesting a payout.",
};

export async function requestAffiliatePayoutAction(): Promise<ActionResult<PayoutRequest>> {
  try {
    const affiliate = await requireAffiliateSession();
    const request = await requestPayout(affiliate.id);
    return { ok: true, data: request };
  } catch (err) {
    if (err instanceof Error && PAYOUT_REQUEST_ERROR[err.message]) {
      return { ok: false, error: PAYOUT_REQUEST_ERROR[err.message] };
    }
    console.error(err);
    return { ok: false, error: "Couldn't request a payout right now." };
  }
}

export async function changeAffiliatePasswordAction(currentPassword: string, newPassword: string): Promise<ActionResult<null>> {
  try {
    if (newPassword.length < 6) return { ok: false, error: "New password must be at least 6 characters." };
    const affiliate = await requireAffiliateSession();
    const ok = await changeAffiliatePassword(affiliate.id, currentPassword, newPassword);
    if (!ok) return { ok: false, error: "Your current password isn't correct." };
    return { ok: true, data: null };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't update your password right now." };
  }
}

/* -------------------------------------------------------------------------- */
/* Self-serve password reset                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Requests a reset link.
 *
 * **The response is identical whether or not the address belongs to a partner.**
 * An endpoint that says "no account with that email" is an account-enumeration
 * oracle, and on a partner programme the email list is the sales pipeline — so the
 * caller is told "check your inbox" in every case except the rate limit, which has
 * to be visible or the form would appear to work while silently dropping the
 * request.
 *
 * The email send is awaited rather than fired and forgotten: nothing else happens
 * on this request, and a partner staring at a "check your inbox" message deserves
 * to know the mail actually left.
 */
export async function requestAffiliatePasswordResetAction(email: string): Promise<ActionResult<{ message: string }>> {
  const GENERIC = "If that email belongs to an approved partner, a reset link is on its way. Check your inbox and your spam folder.";
  try {
    const address = email.trim();
    if (!address || !address.includes("@")) return { ok: false, error: "Enter the email address you applied with." };

    const outcome = await requestAffiliatePasswordReset(address);

    if (outcome.rateLimited) {
      return {
        ok: false,
        error: "That address has already been sent a few reset links in the last hour. Wait a little, then try again, or check your inbox.",
      };
    }

    if (outcome.sent && outcome.token && outcome.recipient) {
      const origin = appOrigin();
      await sendAffiliatePasswordResetEmail({
        to: outcome.recipient.email,
        name: outcome.recipient.name,
        resetUrl: `${origin}/affiliates/reset-password?token=${encodeURIComponent(outcome.token)}`,
        expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
      }).catch((err) => {
        // Logged, never surfaced: whether mail succeeded is not something to
        // reveal per-address, or the response stops being generic.
        console.error("affiliate reset email failed:", err);
      });
    }

    return { ok: true, data: { message: GENERIC } };
  } catch (err) {
    console.error(err);
    // Still generic. An error path that behaves differently for a known address
    // is the same oracle by another route.
    return { ok: true, data: { message: GENERIC } };
  }
}

/** Checks a token before rendering the form, so an expired link says so on the
 * page rather than after the partner has typed a password twice. */
export async function checkAffiliateResetTokenAction(token: string): Promise<ActionResult<{ name: string; email: string }>> {
  try {
    const lookup = await lookupAffiliatePasswordReset(token);
    if (!lookup.ok) return { ok: false, error: resetFailureMessage(lookup.state) };
    return { ok: true, data: { name: lookup.name, email: lookup.email } };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "We couldn't check that link. Try opening it again." };
  }
}

/**
 * Completes the reset.
 *
 * Also signs the partner out of everywhere: `completeAffiliatePasswordReset`
 * deletes every session row for them. That is the point of a reset — the usual
 * reason somebody does this is that they think their password has leaked, and
 * leaving the other session alive would make the whole exercise decorative.
 */
export async function resetAffiliatePasswordAction(input: {
  token: string;
  password: string;
  confirm: string;
}): Promise<ActionResult<{ message: string }>> {
  try {
    const check = validateNewPassword(input.password, input.confirm);
    if (!check.ok) return { ok: false, error: check.error };

    const result = await completeAffiliatePasswordReset({ token: input.token, newPassword: input.password });
    if (!result.ok) return { ok: false, error: resetFailureMessage(result.state) };

    return {
      ok: true,
      data: { message: "Your password is set. Sign in with your new password — any other device you were signed in on has been signed out." },
    };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't reset your password just now. Please try again." };
  }
}
