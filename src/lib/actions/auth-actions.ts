"use server";

import { signup, verifyLogin } from "@/lib/db/auth";
import { getBusinessProfile, getUser } from "@/lib/db/organizations";
import { startSession, endSession, getSession } from "@/lib/session";
import { sendWelcomeEmail } from "@/lib/email";
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

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505";
}
