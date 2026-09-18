"use server";

import { headers } from "next/headers";
import { signup, verifyLogin, findUserByEmail, createPasswordResetToken, consumePasswordResetToken, changePassword } from "@/lib/db/auth";
import { getBusinessProfile, getUser } from "@/lib/db/organizations";
import { startSession, endSession, getSession, requireSession } from "@/lib/session";
import { sendWelcomeEmail, sendPasswordResetEmail } from "@/lib/email";
import type { ActionResult } from "./types";
import type { BusinessType } from "@/lib/types";

export interface SignupPayload {
  name: string;
  email: string;
  password: string;
  businessName: string;
  businessType: BusinessType;
}

export async function signupAction(input: SignupPayload): Promise<ActionResult<{ organizationId: string }>> {
  try {
    if (input.password.length < 6) {
      return { ok: false, error: "Password must be at least 6 characters." };
    }
    const { userId, organizationId } = await signup(input);
    await startSession(userId, organizationId);
    await sendWelcomeEmail(input.email, input.name, input.businessName).catch(() => undefined);
    return { ok: true, data: { organizationId } };
  } catch (err) {
    console.error("signupAction failed:", err);
    if (isUniqueViolation(err)) {
      return { ok: false, error: "An account with that email already exists." };
    }
    return { ok: false, error: "Couldn't create your account. Please try again." };
  }
}

export async function loginAction(email: string, password: string): Promise<ActionResult<{ organizationId: string }>> {
  try {
    const result = await verifyLogin(email, password);
    if (!result) {
      return { ok: false, error: "That email and password don't match a JKTL Business account." };
    }
    await startSession(result.user.id, result.organizationId);
    return { ok: true, data: { organizationId: result.organizationId } };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't sign in right now. Please try again." };
  }
}

export async function logoutAction(): Promise<void> {
  await endSession();
}

/** Used on load to rehydrate a live session into the client store. */
export async function currentSessionAction(): Promise<ActionResult<{ organizationId: string; businessType: BusinessType; displayName: string }>> {
  try {
    const session = await getSession();
    if (!session) return { ok: false, error: "Not signed in." };
    const [profile, user] = await Promise.all([getBusinessProfile(session.organizationId), getUser(session.userId)]);
    if (!profile || !user) return { ok: false, error: "Account not found." };
    return { ok: true, data: { organizationId: session.organizationId, businessType: profile.businessType, displayName: profile.displayName } };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't restore your session." };
  }
}

async function currentOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${protocol}://${host}`;
}

/**
 * Always returns ok:true regardless of whether the email matches an account —
 * revealing that would let anyone probe which emails have a JKTL Business
 * account. The email itself (sent only when a match exists) is the real
 * signal back to the actual owner.
 */
export async function requestPasswordResetAction(email: string): Promise<ActionResult<null>> {
  try {
    const user = await findUserByEmail(email);
    if (user) {
      const rawToken = await createPasswordResetToken(user.id);
      const origin = await currentOrigin();
      const resetUrl = `${origin}/reset-password?token=${rawToken}`;
      await sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl }).catch((err) => console.error("sendPasswordResetEmail failed:", err));
    }
    return { ok: true, data: null };
  } catch (err) {
    console.error(err);
    // Still report success — a failed lookup shouldn't leak account existence either.
    return { ok: true, data: null };
  }
}

export async function resetPasswordAction(token: string, newPassword: string): Promise<ActionResult<null>> {
  try {
    if (newPassword.length < 6) {
      return { ok: false, error: "Password must be at least 6 characters." };
    }
    const ok = await consumePasswordResetToken(token, newPassword);
    if (!ok) return { ok: false, error: "This reset link is invalid or has expired. Request a new one." };
    return { ok: true, data: null };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't reset your password right now. Please try again." };
  }
}

export async function changePasswordAction(currentPassword: string, newPassword: string): Promise<ActionResult<null>> {
  try {
    if (newPassword.length < 6) {
      return { ok: false, error: "New password must be at least 6 characters." };
    }
    const { userId } = await requireSession();
    const ok = await changePassword(userId, currentPassword, newPassword);
    if (!ok) return { ok: false, error: "Your current password isn't correct." };
    return { ok: true, data: null };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't update your password right now." };
  }
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505";
}
