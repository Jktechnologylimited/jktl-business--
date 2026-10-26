"use server";

import { query } from "@/lib/custom/service";
import { after } from "next/server";
import { flushProgramNotices } from "@/lib/distribution/notifications";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { signInGrowthStaff } from "@/lib/growth/auth";
import { verifyAdminLogin } from "@/lib/db/admin-auth";
import {
  startAdminSession,
  endAdminSession,
  requireAdminCapability,
} from "@/lib/admin-session";
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
  PAYOUT_REQUEST_DAY,
} from "@/lib/db/affiliates";
import {
  ADMIN_EMAIL_TAKEN,
  countEnabledOwners,
  createAdminUser,
  deleteAdminUser,
  listAdminTeam,
  setAdminPassword,
  setAdminDisabled,
  type AdminTeamMember,
} from "@/lib/db/admin-auth";
import type { AdminUser } from "@/lib/db/admin-auth";
import type { AdminRole } from "@/lib/admin-permissions";
import { firstYearValueKobo } from "@/lib/affiliate-commission";
import {
  sendPartnerApprovedEmail,
  sendAffiliateApprovedEmail,
  sendAffiliateDeclinedEmail,
} from "@/lib/email";
import { runDailySweep } from "@/lib/cron/daily-sweep";
import { getSql } from "@/lib/db/client";
import { deleteBusinessAccount, getBusinessOwnerUserId } from "@/lib/db/admin";
import { createPasswordResetToken } from "@/lib/db/auth";
import { sendPasswordResetEmail } from "@/lib/email";
import type { AdminBroadcast } from "@/lib/db/admin";
import type { ActionResult } from "./types";

/** Public base URL, so links in outgoing email point at the app rather than at
 * whatever host happened to serve the admin request. */
function appOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  return `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN || "jktl.com.ng"}`;
}

/**
 * Signs an admin in and tells the caller **where to go next**.
 *
 * It used to return nothing, and the login page pushed everyone to `/admin` —
 * which requires "view businesses". An affiliate manager or analyst therefore
 * landed on a page their role cannot open. `/admin/insights` is the one page all
 * three roles share, so it is the safe landing for everyone.
 */
export async function adminLoginAction(
  email: string,
  password: string,
): Promise<ActionResult<{ path: string }>> {
  try {
    const admin = await verifyAdminLogin(email, password);
    if (!admin) {
      const path = await signInGrowthStaff(email, password);
      if (path) return { ok: true, data: { path } };
    }
    if (!admin)
      return {
        ok: false,
        error: "That email and password don't match a command-center account.",
      };
    await startAdminSession(admin.id);
    return {
      ok: true,
      data: {
        path:
          admin.role === "support"
            ? "/admin/support"
            : admin.role === "editor"
              ? "/admin/content"
              : "/admin/insights",
      },
    };
  } catch (err) {
    console.error(err);
    return {
      ok: false,
      error: "Couldn't sign in right now. Please try again.",
    };
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
    const admin = await requireAdminCapability("send_broadcasts");
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

export async function listBroadcastsAction(): Promise<
  ActionResult<AdminBroadcast[]>
> {
  try {
    await requireAdminCapability("send_broadcasts");
    return { ok: true, data: await listBroadcasts() };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't load broadcast history." };
  }
}

export async function listAffiliatesAction(): Promise<
  ActionResult<AffiliateStats[]>
> {
  try {
    await requireAdminCapability("manage_affiliates");
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
    await requireAdminCapability("manage_affiliates");
    if (!input.name.trim() || !input.email.trim())
      return { ok: false, error: "Name and email are both required." };
    if (input.password.length < 6)
      return { ok: false, error: "Password must be at least 6 characters." };
    if (
      !Number.isFinite(input.commissionBps) ||
      input.commissionBps < 0 ||
      input.commissionBps > 10000
    ) {
      return {
        ok: false,
        error: "Commission rate must be between 0% and 100%.",
      };
    }
    const affiliate = await createAffiliate(input);
    return {
      ok: true,
      data: {
        ...affiliate,
        referralCount: 0,
        totalEarnedKobo: 0,
        totalPaidOutKobo: 0,
        balanceKobo: 0,
      },
    };
  } catch (err) {
    if (err instanceof Error && err.message === AFFILIATE_EMAIL_TAKEN) {
      return {
        ok: false,
        error: "An affiliate with that email already exists.",
      };
    }
    console.error(err);
    return { ok: false, error: "Couldn't create that affiliate." };
  }
}

export async function setAffiliateStatusAction(
  affiliateId: string,
  status: "active" | "suspended",
): Promise<ActionResult<null>> {
  try {
    await requireAdminCapability("manage_affiliates");
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
export async function approveAffiliateApplicationAction(
  affiliateId: string,
): Promise<ActionResult<null>> {
  try {
    await requireAdminCapability("manage_affiliates");
    const affiliate = await approveAffiliateApplication(affiliateId);
    // `null` means it was not pending — already approved, or never existed.
    // Returning success without emailing is right: the first approval already
    // sent the message.
    if (!affiliate) return { ok: true, data: null };

    /*
     * Tell them. This is the step whose absence broke the programme's loop: an
     * applicant set a password, sat in the queue, was approved, and never heard
     * anything — so from their side they had applied into a void.
     *
     * Best-effort, and after the status flip: the approval is the thing that
     * matters, and a mail failure must not undo it. The admin sees the result in
     * the UI either way.
     */
    const businessLinked =
      (
        await query(
          "SELECT 1 FROM distribution_account_links WHERE affiliate_id=$1",
          [affiliate.id],
        )
      ).length > 0;
    if (businessLinked)
      after(async () => {
        try {
          await flushProgramNotices();
        } catch {}
      });
    else if (affiliate.programme === "partner")
      await sendPartnerApprovedEmail({
        to: affiliate.email,
        name: affiliate.name,
        signInUrl: `${appOrigin()}/partners/login`,
        referralLink: `${appOrigin()}/signup?ref=${affiliate.referralCode}`,
        commissionBps: affiliate.commissionBps,
        needsPasswordSetup: Boolean(affiliate.partnerSourceId),
      });
    else
      await sendAffiliateApprovedEmail({
        to: affiliate.email,
        name: affiliate.name,
        signInUrl: `${appOrigin()}/affiliates/login`,
        referralLink: `${appOrigin()}/signup?ref=${affiliate.referralCode}`,
        signupBonusKobo: affiliate.signupBonusKobo,
        subscriptionBonusKobo: affiliate.subscriptionBonusKobo,
        recurringMonthlyKobo: affiliate.recurringMonthlyKobo,
        firstYearValueKobo: firstYearValueKobo({
          signupBonusKobo: affiliate.signupBonusKobo,
          subscriptionBonusKobo: affiliate.subscriptionBonusKobo,
          recurringMonthlyKobo: affiliate.recurringMonthlyKobo,
          recurringMonthsCap: affiliate.recurringMonthsCap,
        }),
        payoutDay: PAYOUT_REQUEST_DAY,
      }).catch((err) =>
        console.error("approveAffiliate: approval email failed", err),
      );

    revalidatePath("/admin/affiliates");
    return { ok: true, data: null };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't approve that application." };
  }
}

/** Retain rejected applications, policy snapshots and audit history. */
export async function rejectAffiliateApplicationAction(
  affiliateId: string,
): Promise<ActionResult<null>> {
  try {
    await requireAdminCapability("manage_affiliates");
    const applicant = await rejectAffiliateApplication(affiliateId);
    if (!applicant) return { ok: true, data: null };

    // Notify the applicant while preserving the rejected application record.
    await sendAffiliateDeclinedEmail({
      to: applicant.email,
      name: applicant.name,
    }).catch((err) =>
      console.error("rejectAffiliate: decline email failed", err),
    );

    revalidatePath("/admin/affiliates");
    return { ok: true, data: null };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't reject that application." };
  }
}

export async function recordAffiliatePayoutAction(
  affiliateId: string,
  amountKobo: number,
  note: string,
): Promise<ActionResult<AffiliatePayout>> {
  try {
    const admin = await requireAdminCapability("record_payouts");
    if (!Number.isFinite(amountKobo) || amountKobo <= 0)
      return { ok: false, error: "Enter a valid payout amount." };
    const payout = await recordPayout(
      affiliateId,
      admin.id,
      amountKobo,
      note.trim(),
    );
    return { ok: true, data: payout };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't record that payout." };
  }
}

export async function listPendingPayoutRequestsAction(): Promise<
  ActionResult<PendingPayoutRequest[]>
> {
  try {
    await requireAdminCapability("record_payouts");
    return { ok: true, data: await listPendingPayoutRequests() };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't load payout requests." };
  }
}

/** Pays a request via the same ledger the manual "Record payout" form
 * uses (see `markPayoutRequestPaid`'s own comment), then marks the
 * request resolved. */
export async function markPayoutRequestPaidAction(
  requestId: string,
  note: string,
): Promise<ActionResult<AffiliatePayout>> {
  try {
    const admin = await requireAdminCapability("record_payouts");
    const payout = await markPayoutRequestPaid(
      requestId,
      admin.id,
      note.trim(),
    );
    return { ok: true, data: payout };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't mark that payout request paid." };
  }
}

export async function declinePayoutRequestAction(
  requestId: string,
): Promise<ActionResult<null>> {
  try {
    const admin = await requireAdminCapability("record_payouts");
    await declinePayoutRequest(requestId, admin.id);
    return { ok: true, data: null };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't decline that payout request." };
  }
}

/**
 * Runs the daily sweep now, from the admin.
 *
 * The Vercel Hobby plan runs a cron once a day and cannot promise *when* inside
 * the hour. That is fine for money — it is a daily schedule either way — but it is
 * miserable when you have just imported 400 leads and want to know whether site
 * generation works. This lets an operator press the same button the cron presses.
 *
 * Runs in a server action, which has the same wall-clock limit as the cron route,
 * so it uses the same internal budget and reports the same per-step outcomes
 * rather than a spinner that may be killed.
 */
export async function runDailySweepNowAction(): Promise<
  ActionResult<{
    steps: Array<{ name: string; ok: boolean; detail: string; ms: number }>;
    truncated: boolean;
  }>
> {
  try {
    await requireAdminCapability("run_daily_job");
    const result = await runDailySweep();
    revalidatePath("/admin/insights");
    return {
      ok: true,
      data: {
        steps: result.steps.map((s) => ({
          name: s.name,
          ok: s.ok,
          detail: s.detail,
          ms: s.ms,
        })),
        truncated: result.truncated,
      },
    };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't run the daily job." };
  }
}

/* -------------------------------------------------------------------------- */
/* Team accounts                                                              */
/* -------------------------------------------------------------------------- */

/** Everyone with a command-centre account. Owner-only: see who else has access
 * is itself privileged information. */
export async function listAdminTeamAction(): Promise<
  ActionResult<AdminTeamMember[]>
> {
  try {
    await requireAdminCapability("manage_team");
    return { ok: true, data: await listAdminTeam() };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't load the team." };
  }
}

/**
 * Creates a colleague's account.
 *
 * Owner-only, because an account that can create accounts is an account that can
 * create an owner. The password is chosen here and shown once; it is deliberately
 * not emailed.
 */
export async function createAdminTeamMemberAction(input: {
  name: string;
  email: string;
  password: string;
  role: AdminRole;
}): Promise<ActionResult<AdminUser>> {
  try {
    const acting = await requireAdminCapability("manage_team");
    if (input.role === "growth_gaming_lead")
      return {
        ok: false,
        error:
          "Assign Growth & Gaming Lead to an existing Business account in Staff management.",
      };
    if (!input.name.trim()) return { ok: false, error: "Enter their name." };
    if (!input.email.includes("@"))
      return { ok: false, error: "Enter a valid email address." };
    if (input.password.length < 8)
      return { ok: false, error: "Use a password of at least 8 characters." };

    const created = await createAdminUser({
      name: input.name,
      email: input.email,
      password: input.password,
      role: input.role,
      createdBy: acting.id,
    });
    revalidatePath("/admin/team");
    return { ok: true, data: created };
  } catch (err) {
    if (err instanceof Error && err.message === ADMIN_EMAIL_TAKEN) {
      return {
        ok: false,
        error: "There's already an admin account with that email.",
      };
    }
    console.error(err);
    return { ok: false, error: "Couldn't create that account." };
  }
}

/**
 * Switches an account off (or back on).
 *
 * Refuses two things, both of which make the command centre unrecoverable: an
 * owner disabling themselves, and disabling the last enabled owner.
 */
export async function setAdminDisabledAction(
  adminUserId: string,
  disabled: boolean,
): Promise<ActionResult<null>> {
  try {
    const acting = await requireAdminCapability("manage_team");
    if (adminUserId === acting.id && disabled) {
      return { ok: false, error: "You can't disable your own account." };
    }
    if (disabled && (await countEnabledOwners()) <= 1) {
      const team = await listAdminTeam();
      const target = team.find((member) => member.id === adminUserId);
      if (target?.role === "owner" && !target.disabledAt) {
        return {
          ok: false,
          error:
            "That's the last owner. Promote someone else first, or you'd lock yourself out.",
        };
      }
    }

    await setAdminDisabled(adminUserId, disabled, acting.id);
    revalidatePath("/admin/team");
    return { ok: true, data: null };
  } catch (err) {
    console.error(err);
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Couldn't change that account.",
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Business accounts                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Sends a password-reset link to a business's owner.
 *
 * The support case this exists for: "I can't log in" on a phone call, where an
 * admin could previously only say "use the forgot password page" — which fails
 * whenever the owner no longer controls the email on file, or never set one.
 *
 * Owner-only. It is a credential action against somebody else's account, so it
 * must not be something an affiliate manager can do. It never *shows* the admin a
 * password — it emails a one-time link to the owner, so the reset happens between
 * the owner and their own inbox.
 */
export async function resetBusinessPasswordAction(
  organizationId: string,
): Promise<ActionResult<{ email: string }>> {
  try {
    await requireAdminCapability("view_businesses");

    const ownerId = await getBusinessOwnerUserId(organizationId);
    if (!ownerId) {
      return {
        ok: false,
        error:
          "That business has no owner account to reset. Check its team list.",
      };
    }

    const sql = getSql();
    const rows = await sql`SELECT name, email FROM users WHERE id = ${ownerId}`;
    const owner = rows[0];
    if (!owner?.email)
      return { ok: false, error: "That owner has no email address on file." };

    const token = await createPasswordResetToken(ownerId);
    const resetUrl = `${appOrigin()}/reset-password?token=${encodeURIComponent(token)}`;
    await sendPasswordResetEmail({
      to: owner.email as string,
      name: (owner.name as string) ?? "",
      resetUrl,
    });

    return { ok: true, data: { email: owner.email as string } };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't send that reset link." };
  }
}

/**
 * Deletes a business account and everything in it.
 *
 * **Irreversible.** Every tenant table cascades from `organizations`, so this takes
 * the customers, bookings, sales, invoices, wallet and contract with it. The
 * confirmation is the business's own name typed back, because a list of similarly
 * named clinics is exactly where a mis-click happens, and there is no undo.
 */
export async function deleteBusinessAccountAction(
  organizationId: string,
  confirmName: string,
): Promise<ActionResult<null>> {
  try {
    await requireAdminCapability("view_businesses");

    const sql = getSql();
    const rows =
      await sql`SELECT name FROM organizations WHERE id = ${organizationId}`;
    const actual = (rows[0]?.name as string) ?? "";
    if (!actual) return { ok: false, error: "That business no longer exists." };

    if (confirmName.trim().toLowerCase() !== actual.trim().toLowerCase()) {
      return {
        ok: false,
        error: `Type the business name exactly to confirm: "${actual}".`,
      };
    }

    await deleteBusinessAccount(organizationId);
    revalidatePath("/admin");
    return { ok: true, data: null };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't delete that business." };
  }
}

/** Sets a new password for a teammate and signs them out everywhere. Owner-only. */
export async function resetAdminPasswordAction(
  adminUserId: string,
  password: string,
): Promise<ActionResult<null>> {
  try {
    const acting = await requireAdminCapability("manage_team");
    if (password.length < 8)
      return { ok: false, error: "Use a password of at least 8 characters." };
    await setAdminPassword(adminUserId, password, acting.id);
    revalidatePath("/admin/team");
    return { ok: true, data: null };
  } catch (err) {
    console.error(err);
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Couldn't reset that password.",
    };
  }
}

/** Deletes a teammate's account. Owner-only, with the same lockout guards as
 * disabling — deleting the last owner is not recoverable from inside the app. */
export async function deleteAdminAccountAction(
  adminUserId: string,
): Promise<ActionResult<null>> {
  try {
    const acting = await requireAdminCapability("manage_team");
    if (adminUserId === acting.id)
      return { ok: false, error: "You can't delete your own account." };
    await deleteAdminUser(adminUserId, acting.id);
    revalidatePath("/admin/team");
    return { ok: true, data: null };
  } catch (err) {
    console.error(err);
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Couldn't delete that account.",
    };
  }
}
