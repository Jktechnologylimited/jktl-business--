"use server";
import { unstable_cache, revalidatePath } from "next/cache";
import {
  requireAdminSession,
  requireAdminCapability,
} from "@/lib/admin-session";
import { getSql } from "@/lib/db/client";
import { authRateLimit } from "@/lib/security/auth-rate-limit";
import { listBanks, resolveAccountNumber } from "@/lib/paystack";
import {
  ownDetails,
  verifyBank,
  submitDetails,
  reviewDetails,
  removeDetails,
  reviewQueue,
  revealDetails,
} from "@/lib/team-payments/service";
import { paymentsConfigured } from "@/lib/team-payments/model";
const banks = unstable_cache(listBanks, ["team-payment-nigerian-banks"], {
  revalidate: 3600,
});
const provider = { banks, resolve: resolveAccountNumber };
const q = (text: string, values: unknown[] = []) =>
  getSql().query(text, values);
function refresh() {
  revalidatePath("/admin/team/payment-details");
  revalidatePath("/admin/team/payments");
}
async function result<T>(work: () => Promise<T>) {
  try {
    return { ok: true as const, data: await work() };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const safe =
      /^(Too many requests|Access denied\.|Not signed in|Choose |Confirm |We could not|The bank returned|Team payment details are not configured|Saved payment details cannot|Invalid (team|review)|Payment details changed|These details changed|You cannot view|Reload the latest)/.test(
        message,
      );
    return {
      ok: false as const,
      error: safe
        ? message
        : "Payment details are temporarily unavailable. Please retry or contact your Owner.",
    };
  }
}
export async function teamPaymentHomeAction() {
  return result(async () => {
    const a = await requireAdminSession();
    return {
      details: await ownDetails(q, a),
      configured: paymentsConfigured(),
    };
  });
}
export async function teamPaymentBanksAction() {
  return result(async () => {
    const a = await requireAdminSession();
    await authRateLimit(a.id, "team-payment-banks", 30, 600);
    if (!paymentsConfigured())
      throw Error(
        "Team payment details are not configured yet. Contact your Owner.",
      );
    return banks();
  });
}
export async function verifyTeamBankAction(input: {
  bankCode: string;
  accountNumber: string;
}) {
  return result(async () => {
    const a = await requireAdminSession();
    await authRateLimit(a.id, "team-bank-resolve", 8, 3600);
    return verifyBank(q, a, input, provider);
  });
}
export async function submitTeamBankAction(input: {
  bankCode: string;
  accountNumber: string;
  revision: number;
  confirmed: boolean;
}) {
  return result(async () => {
    const a = await requireAdminSession();
    await authRateLimit(a.id, "team-bank-save", 8, 3600);
    const value = await submitDetails(q, a, input, provider);
    refresh();
    return value;
  });
}
export async function removeTeamBankAction(revision: number) {
  return result(async () => {
    const a = await requireAdminSession();
    await authRateLimit(a.id, "team-bank-remove", 8, 3600);
    const value = await removeDetails(q, a, revision);
    refresh();
    return value;
  });
}
export async function teamPaymentQueueAction(page = 0, status = "ALL") {
  return result(async () => {
    const a = await requireAdminCapability("manage_team_payments");
    return reviewQueue(q, a, page, status);
  });
}
export async function reviewTeamBankAction(input: {
  adminId: string;
  revision: number;
  decision: "APPROVED" | "REJECTED";
  note: string;
}) {
  return result(async () => {
    const a = await requireAdminCapability("manage_team_payments");
    await authRateLimit(a.id, "team-bank-review", 60, 3600);
    const value = await reviewDetails(q, a, input);
    refresh();
    return value;
  });
}
export async function revealTeamBankAction(input: {
  adminId: string;
  revision: number;
  reason: "SELF_REVIEW" | "PAYMENT_PREPARATION";
}) {
  return result(async () => {
    const a = await requireAdminSession();
    await authRateLimit(a.id, "team-bank-reveal", 20, 600);
    return revealDetails(q, a, input);
  });
}
