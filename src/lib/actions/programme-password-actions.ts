"use server";
import { headers } from "next/headers";
import {
  requestAffiliatePasswordReset,
  lookupAffiliatePasswordReset,
  completeAffiliatePasswordReset,
} from "@/lib/db/affiliate-auth";
import { sendAffiliatePasswordResetEmail } from "@/lib/email";
import {
  RESET_TOKEN_TTL_MINUTES,
  resetFailureMessage,
  validateNewPassword,
} from "@/lib/affiliate-reset-token";
import { authRateLimit } from "@/lib/security/auth-rate-limit";
import type { ActionResult } from "./types";
type Programme = "partner" | "affiliate";
function valid(programme: unknown): programme is Programme {
  return programme === "partner" || programme === "affiliate";
}
function origin() {
  const url = new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://business.jktl.com.ng",
  );
  if (url.username || url.password || url.protocol !== "https:")
    throw Error("Invalid account origin");
  return url.origin;
}
export async function requestProgrammePasswordResetAction(
  programme: Programme,
  email: string,
): Promise<ActionResult<{ message: string }>> {
  if (!valid(programme))
    return { ok: false, error: "Choose the correct programme sign-in page." };
  const generic = {
    ok: true as const,
    data: {
      message: `If that email belongs to an approved ${programme}, a reset link is on its way. Check your inbox and spam folder.`,
    },
  };
  try {
    const h = await headers(),
      ip = (h.get("x-vercel-forwarded-for") || h.get("x-real-ip") || "unknown")
        .split(",")[0]
        .trim()
        .slice(0, 64);
    await authRateLimit(ip, "programme-reset-request", 8, 3600);
    if (
      typeof email !== "string" ||
      email.length > 254 ||
      !/^\S+@\S+\.\S+$/.test(email)
    )
      return generic;
    const outcome = await requestAffiliatePasswordReset(
      email.trim(),
      ip,
      new Date(),
      programme,
    );
    if (outcome.rateLimited) return generic;
    if (outcome.sent && outcome.token && outcome.recipient)
      await sendAffiliatePasswordResetEmail({
        to: outcome.recipient.email,
        name: outcome.recipient.name,
        resetUrl: `${origin()}/${programme === "partner" ? "partners" : "affiliates"}/reset-password?token=${encodeURIComponent(outcome.token)}`,
        expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
        programme,
      });
    return generic;
  } catch {
    return generic;
  }
}
export async function checkProgrammeResetTokenAction(
  programme: Programme,
  token: string,
): Promise<ActionResult<{ name: string; email: string }>> {
  try {
    if (!valid(programme) || typeof token !== "string")
      return {
        ok: false,
        error:
          "This reset link is invalid. Request a new link from your programme sign-in page.",
      };
    const result = await lookupAffiliatePasswordReset(
      token,
      new Date(),
      programme,
    );
    return result.ok
      ? { ok: true, data: { name: result.name, email: result.email } }
      : { ok: false, error: resetFailureMessage(result.state) };
  } catch {
    return { ok: false, error: "Could not check this link. Please retry." };
  }
}
export async function resetProgrammePasswordAction(
  programme: Programme,
  input: { token: string; password: string; confirm: string },
): Promise<ActionResult<{ message: string }>> {
  try {
    if (
      !valid(programme) ||
      !input ||
      typeof input.token !== "string" ||
      typeof input.password !== "string" ||
      typeof input.confirm !== "string"
    )
      return { ok: false, error: "Check the reset link and password fields." };
    const h = await headers(),
      ip = (h.get("x-vercel-forwarded-for") || h.get("x-real-ip") || "unknown")
        .split(",")[0]
        .trim()
        .slice(0, 64);
    await authRateLimit(ip, "programme-reset-submit", 10, 3600);
    const checked = validateNewPassword(input.password, input.confirm);
    if (!checked.ok) return checked;
    if (Buffer.byteLength(input.password, "utf8") > 72)
      return { ok: false, error: "Use a password of at most 72 UTF-8 bytes." };
    const result = await completeAffiliatePasswordReset({
      token: input.token,
      newPassword: input.password,
      programme,
    });
    if (!result.ok)
      return { ok: false, error: resetFailureMessage(result.state) };
    return {
      ok: true,
      data: {
        message: `Your ${programme} password is set. Sign in below with your new password. Other programme sessions have been signed out.`,
      },
    };
  } catch {
    return { ok: false, error: "Could not reset your password. Please retry." };
  }
}
