"use server";
import { consumeReferralVisit } from "@/lib/distribution/referrals";

import { headers } from "next/headers";
import {
  signup,
  verifyLogin,
  findUserByEmail,
  createPasswordResetToken,
  consumePasswordResetToken,
  changePassword,
  validNewPassword,
} from "@/lib/db/auth";
import { getBusinessProfile, getUser } from "@/lib/db/organizations";
import {
  startSession,
  endSession,
  getSession,
  requireSession,
} from "@/lib/session";
import { sendWelcomeEmail, sendPasswordResetEmail } from "@/lib/email";
import type { ActionResult } from "./types";
import type { BusinessType } from "@/lib/types";
import { authRateLimit } from "@/lib/security/auth-rate-limit";

async function limitIp(action: string, limit: number, seconds: number) {
  const h = await headers();
  // Vercel sets x-vercel-forwarded-for itself; configure equivalent trusted
  // proxy normalization when self-hosting. Never accept an IP from form input.
  const ip = (h.get("x-vercel-forwarded-for") || h.get("x-real-ip") || "unknown").split(",")[0].trim().slice(0, 64);
  await authRateLimit(ip, action, limit, seconds);
}

export interface SignupPayload {
  name: string;
  email: string;
  password: string;
  businessName: string;
  businessType: BusinessType;
  /** From a `?ref=<code>` on the signup link (see src/app/signup/page.tsx)
   * — best-effort only, see recordReferralIfValid. */
  referralCode?: string | null;
}

export async function signupAction(
  input: SignupPayload,
): Promise<ActionResult<{ organizationId: string }>> {
  try {
    await limitIp("signup", 8, 3600);
    if (!input || !validNewPassword(input.password)) {
      return { ok: false, error: "Use at least 10 characters and at most 72 UTF-8 bytes for your password." };
    }
    if (typeof input.email !== "string" || input.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) ||
      typeof input.name !== "string" || !input.name.trim() || input.name.length > 120 ||
      typeof input.businessName !== "string" || !input.businessName.trim() || input.businessName.length > 160 ||
      !["salon", "nail_tech", "lash_tech", "nail_lash_studio", "restaurant", "auto_parts", "building_materials", "plumbing", "personal_care", "gas", "filling_station", "wedding_events", "photographer", "videographer", "content_creator", "mens_health", "aesthetics", "elderly_care", "general"].includes(input.businessType))
      return { ok: false, error: "Enter a valid name, email and business type." };
    const { userId, organizationId } = await signup(input);
    await startSession(userId, organizationId);
    await consumeReferralVisit(organizationId).catch(() => {});
    await sendWelcomeEmail(input.email, input.name, input.businessName).catch(
      () => undefined,
    );
    return { ok: true, data: { organizationId } };
  } catch (err) {
    console.error("signupAction failed:", err instanceof Error ? err.name : "unknown");
    if (isUniqueViolation(err)) {
      return { ok: false, error: "An account with that email already exists." };
    }
    return {
      ok: false,
      error: "Couldn't create your account. Please try again.",
    };
  }
}

export async function loginAction(
  email: string,
  password: string,
): Promise<ActionResult<{ organizationId: string }>> {
  try {
    await limitIp("login-ip", 30, 600);
    const result = await verifyLogin(email, password);
    if (!result) {
      return {
        ok: false,
        error: "That email and password don't match a JKTL Business account.",
      };
    }
    await startSession(result.user.id, result.organizationId);
    await consumeReferralVisit(result.organizationId).catch(() => {});
    return { ok: true, data: { organizationId: result.organizationId } };
  } catch (err) {
    console.error(err instanceof Error ? err.name : "unknown");
    return {
      ok: false,
      error: "Couldn't sign in right now. Please try again.",
    };
  }
}

export async function logoutAction(): Promise<void> {
  await endSession();
}

/** Used on load to rehydrate a live session into the client store. */
export async function currentSessionAction(): Promise<
  ActionResult<{
    organizationId: string;
    businessType: BusinessType;
    displayName: string;
  }>
> {
  try {
    const session = await getSession();
    if (!session) return { ok: false, error: "Not signed in." };
    const [profile, user] = await Promise.all([
      getBusinessProfile(session.organizationId),
      getUser(session.userId),
    ]);
    if (!profile || !user) return { ok: false, error: "Account not found." };
    return {
      ok: true,
      data: {
        organizationId: session.organizationId,
        businessType: profile.businessType,
        displayName: profile.displayName,
      },
    };
  } catch (err) {
    console.error(err instanceof Error ? err.name : "unknown");
    return { ok: false, error: "Couldn't restore your session." };
  }
}

async function currentOrigin(): Promise<string> {
  // Password-reset links must never inherit a request's Host (tenant domains
  // and forwarded headers are not a trusted account recovery destination).
  const url = new URL(process.env.NEXT_PUBLIC_APP_URL || "https://business.jktl.com.ng");
  if (url.username || url.password || (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))))
    throw new Error("Invalid account origin configuration.");
  return url.origin;
}

/**
 * Always returns ok:true regardless of whether the email matches an account —
 * revealing that would let anyone probe which emails have a JKTL Business
 * account. The email itself (sent only when a match exists) is the real
 * signal back to the actual owner.
 */
export async function requestPasswordResetAction(
  email: string,
): Promise<ActionResult<null>> {
  try {
    await limitIp("reset-request-ip", 8, 3600);
    if (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: true, data: null };
    await authRateLimit(email.trim().toLowerCase(), "reset-request-email", 3, 3600);
    const user = await findUserByEmail(email);
    if (user) {
      const rawToken = await createPasswordResetToken(user.id);
      const origin = await currentOrigin();
      const resetUrl = `${origin}/reset-password?token=${rawToken}`;
      await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl,
      }).catch((err) => console.error("sendPasswordResetEmail failed:", err instanceof Error ? err.name : "unknown"));
    }
    return { ok: true, data: null };
  } catch (err) {
    console.error(err instanceof Error ? err.name : "unknown");
    // Still report success — a failed lookup shouldn't leak account existence either.
    return { ok: true, data: null };
  }
}

export async function resetPasswordAction(
  token: string,
  newPassword: string,
): Promise<ActionResult<null>> {
  try {
    await limitIp("reset-submit-ip", 10, 3600);
    if (!validNewPassword(newPassword)) {
      return { ok: false, error: "Use at least 10 characters and at most 72 UTF-8 bytes for your password." };
    }
    const ok = await consumePasswordResetToken(token, newPassword);
    if (!ok)
      return {
        ok: false,
        error: "This reset link is invalid or has expired. Request a new one.",
      };
    return { ok: true, data: null };
  } catch (err) {
    console.error(err instanceof Error ? err.name : "unknown");
    return {
      ok: false,
      error: "Couldn't reset your password right now. Please try again.",
    };
  }
}

export async function changePasswordAction(
  currentPassword: string,
  newPassword: string,
): Promise<ActionResult<null>> {
  try {
    if (!validNewPassword(newPassword)) {
      return {
        ok: false,
        error: "Use at least 10 characters and at most 72 UTF-8 bytes for your password.",
      };
    }
    const { userId } = await requireSession();
    await authRateLimit(userId, "change-password", 10, 3600);
    const ok = await changePassword(userId, currentPassword, newPassword);
    if (!ok)
      return { ok: false, error: "Your current password isn't correct." };
    return { ok: true, data: null };
  } catch (err) {
    console.error(err instanceof Error ? err.name : "unknown");
    return { ok: false, error: "Couldn't update your password right now." };
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "23505"
  );
}
