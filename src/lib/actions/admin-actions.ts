"use server";

import { redirect } from "next/navigation";
import { verifyAdminLogin } from "@/lib/db/admin-auth";
import { startAdminSession, endAdminSession, requireAdminSession } from "@/lib/admin-session";
import { listBroadcastSubscriptions } from "@/lib/db/push";
import { sendBroadcastPush } from "@/lib/push";
import { recordBroadcast, listBroadcasts } from "@/lib/db/admin";
import {
  listAffiliatesWithStats,
  createAffiliate,
  setAffiliateStatus,
  approveAffiliateApplication,
  rejectAffiliateApplication,
  recordPayout,
  listPendingPayoutRequests,
  markPayoutRequestPaid,
  declinePayoutRequest,
  AFFILIATE_EMAIL_TAKEN,
  type AffiliateStats,
  type AffiliatePayout,
  type PendingPayoutRequest,
} from "@/lib/db/affiliates";
import type { AdminBroadcast } from "@/lib/db/admin";
import type { ActionResult } from "./types";

export async function adminLoginAction(email: string, password: string): Promise<ActionResult<null>> {
  try {
    const admin = await verifyAdminLogin(email, password);
    if (!admin) return { ok: false, error: "That email and password don't match a command-center account." };
    await startAdminSession(admin.id);
    return { ok: true, data: null };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't sign in right now. Please try again." };
  }
}

/** Used directly as a `<form action={adminLogoutAction}>` — ending the
 * session and redirecting in the same server action means there's no
 * client-side round trip that could be skipped. */
export async function adminLogoutAction(): Promise<void> {
  await endAdminSession();
  redirect("/admin/login");
}

/**
 * Sends a push notification to every business that has push on and hasn't
 * opted out of platform announcements (downtime notices, promotions,
 * etc.) — see src/lib/db/push.ts's listBroadcastSubscriptions. Unlike the
 * rest of the command center, this is the one thing here that *writes*
 * something outward rather than just viewing account-level stats — it
 * never touches a business's own operational data, only pushes a message
 * to their device.
 */
export async function sendBroadcastAction(input: {
  category: string;
  title: string;
  body: string;
  url: string;
}): Promise<ActionResult<AdminBroadcast>> {
  try {
    const admin = await requireAdminSession();
    if (!input.title.trim() || !input.body.trim()) {
      return { ok: false, error: "Title and message are both required." };
    }

    const subscriptions = await listBroadcastSubscriptions();
    const recipientCount = await sendBroadcastPush(subscriptions, {
      title: input.title.trim(),
      body: input.body.trim(),
      url: input.url.trim() || undefined,
    });

    const record = await recordBroadcast(admin.id, {
      category: input.category,
      title: input.title.trim(),
      body: input.body.trim(),
      url: input.url.trim(),
      recipientCount,
    });
    return { ok: true, data: record };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't send that broadcast." };
  }
}

export async function listBroadcastsAction(): Promise<ActionResult<AdminBroadcast[]>> {
  try {
    await requireAdminSession();
    return { ok: true, data: await listBroadcasts() };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't load broadcast history." };
  }
}

export async function listAffiliatesAction(): Promise<ActionResult<AffiliateStats[]>> {
  try {
    await requireAdminSession();
    return { ok: true, data: await listAffiliatesWithStats() };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't load affiliates." };
  }
}

export async function createAffiliateAction(input: {
  name: string;
  email: string;
  password: string;
  commissionBps: number;
}): Promise<ActionResult<AffiliateStats>> {
  try {
    await requireAdminSession();
    if (!input.name.trim() || !input.email.trim()) return { ok: false, error: "Name and email are both required." };
    if (input.password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };
    if (!Number.isFinite(input.commissionBps) || input.commissionBps < 0 || input.commissionBps > 10000) {
      return { ok: false, error: "Commission rate must be between 0% and 100%." };
    }
    const affiliate = await createAffiliate(input);
    return { ok: true, data: { ...affiliate, referralCount: 0, totalEarnedKobo: 0, totalPaidOutKobo: 0, balanceKobo: 0 } };
  } catch (err) {
    if (err instanceof Error && err.message === AFFILIATE_EMAIL_TAKEN) {
      return { ok: false, error: "An affiliate with that email already exists." };
    }
    console.error(err);
    return { ok: false, error: "Couldn't create that affiliate." };
  }
}

export async function setAffiliateStatusAction(affiliateId: string, status: "active" | "suspended"): Promise<ActionResult<null>> {
  try {
    await requireAdminSession();
    await setAffiliateStatus(affiliateId, status);
    return { ok: true, data: null };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't update that affiliate." };
  }
}

/** Approves a self-serve application (migration 014) — the applicant
 * already set their own password when they applied, so this is just a
 * status flip to 'active'; nothing to generate or share with them. */
export async function approveAffiliateApplicationAction(affiliateId: string): Promise<ActionResult<null>> {
  try {
    await requireAdminSession();
    await approveAffiliateApplication(affiliateId);
    return { ok: true, data: null };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't approve that application." };
  }
}

/** Deletes the application outright — see rejectAffiliateApplication's own
 * comment for why that's fine (nothing worth keeping about one nobody
 * approved). */
export async function rejectAffiliateApplicationAction(affiliateId: string): Promise<ActionResult<null>> {
  try {
    await requireAdminSession();
    await rejectAffiliateApplication(affiliateId);
    return { ok: true, data: null };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't reject that application." };
  }
}

export async function recordAffiliatePayoutAction(affiliateId: string, amountKobo: number, note: string): Promise<ActionResult<AffiliatePayout>> {
  try {
    const admin = await requireAdminSession();
    if (!Number.isFinite(amountKobo) || amountKobo <= 0) return { ok: false, error: "Enter a valid payout amount." };
    const payout = await recordPayout(affiliateId, admin.id, amountKobo, note.trim());
    return { ok: true, data: payout };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't record that payout." };
  }
}

export async function listPendingPayoutRequestsAction(): Promise<ActionResult<PendingPayoutRequest[]>> {
  try {
    await requireAdminSession();
    return { ok: true, data: await listPendingPayoutRequests() };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't load payout requests." };
  }
}

/** Pays a request via the same ledger the manual "Record payout" form
 * uses (see `markPayoutRequestPaid`'s own comment), then marks the
 * request resolved. */
export async function markPayoutRequestPaidAction(requestId: string, note: string): Promise<ActionResult<AffiliatePayout>> {
  try {
    const admin = await requireAdminSession();
    const payout = await markPayoutRequestPaid(requestId, admin.id, note.trim());
    return { ok: true, data: payout };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't mark that payout request paid." };
  }
}

export async function declinePayoutRequestAction(requestId: string): Promise<ActionResult<null>> {
  try {
    const admin = await requireAdminSession();
    await declinePayoutRequest(requestId, admin.id);
    return { ok: true, data: null };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't decline that payout request." };
  }
}
