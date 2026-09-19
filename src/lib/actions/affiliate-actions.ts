"use server";

import { verifyAffiliateLogin, changeAffiliatePassword } from "@/lib/db/affiliate-auth";
import { startAffiliateSession, endAffiliateSession, requireAffiliateSession } from "@/lib/affiliate-session";
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
  name: string;
  email: string;
  referralCode: string;
  referralLink: string;
  commissionBps: number;
  totalEarnedKobo: number;
  totalPaidOutKobo: number;
  balanceKobo: number;
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

    return {
      ok: true,
      data: {
        name: full.name,
        email: full.email,
        referralCode: full.referralCode,
        referralLink: `${appOrigin()}/signup?ref=${full.referralCode}`,
        commissionBps: full.commissionBps,
        ...balance,
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
