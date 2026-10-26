"use server";
import { headers } from "next/headers";
import { randomBytes, createHash } from "node:crypto";
import { hashPassword } from "@/lib/db/auth";
import { verifyAffiliateLogin } from "@/lib/db/affiliate-auth";
import { startAffiliateSession } from "@/lib/affiliate-session";
import { requireAdminCapability } from "@/lib/admin-session";
import { approveAffiliateApplicationAction } from "@/lib/actions/admin-actions";
import { query } from "@/lib/custom/service";
import { rateLimit } from "@/lib/domains/store";
export async function applyPartnerAction(input: {
  name: string;
  email: string;
  password: string;
  company: string;
  specialism: string;
  clients: number;
  message: string;
  consent: boolean;
}) {
  try {
    if (
      typeof input.name !== "string" ||
      !input.name.trim() ||
      input.name.length > 120 ||
      typeof input.email !== "string" ||
      input.email.length > 254 ||
      !/^\S+@\S+\.\S+$/.test(input.email) ||
      typeof input.password !== "string" ||
      input.password.length < 12 ||
      Buffer.byteLength(input.password, "utf8") > 72 ||
      typeof input.company !== "string" ||
      !input.company.trim() ||
      input.company.length > 180 ||
      ![
        "Website developer",
        "Digital marketing agency",
        "Business consultant",
        "CAC registration agent",
        "Other business professional",
      ].includes(input.specialism) ||
      !Number.isInteger(input.clients) ||
      input.clients < 1 ||
      input.clients > 10000 ||
      typeof input.message !== "string" ||
      !input.message.trim() ||
      input.message.length > 2000 ||
      input.consent !== true
    )
      return {
        ok: false,
        error:
          "Complete the partner application, use a 12-character password and accept the programme terms.",
      };
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0] || "unknown";
    await rateLimit(
      query,
      createHash("sha256").update(ip).digest("hex"),
      "partner-apply",
      5,
      3600,
    );
    const email = input.email.trim().toLowerCase();
    if (
      (await query("SELECT 1 FROM affiliates WHERE email=$1", [email])).length
    )
      return {
        ok: false,
        error:
          "An application or programme account already exists for this email. Use sign in or password reset.",
      };
    const password = await hashPassword(input.password);
    await query(
      `INSERT INTO affiliates(name,email,password_hash,referral_code,commission_bps,status,application_note,programme,commission_model,signup_bonus_kobo,subscription_bonus_kobo,recurring_monthly_kobo,recurring_months_cap) VALUES($1,$2,$3,$4,0,'pending',$5,'partner','percentage',0,0,0,0)`,
      [
        input.name.trim(),
        email,
        password,
        randomBytes(6).toString("hex"),
        `${input.company.trim()}\n${input.specialism}\n${input.clients} clients/month\n${input.message.trim()}`,
      ],
    );
    return { ok: true };
  } catch {
    return {
      ok: false,
      error:
        "Could not save the partner application. Check your entries and retry.",
    };
  }
}
export async function partnerLoginAction(email: string, password: string) {
  try {
    if (
      typeof email !== "string" ||
      email.length > 254 ||
      typeof password !== "string" ||
      Buffer.byteLength(password, "utf8") > 72
    )
      return { ok: false, error: "Email or password is incorrect." };
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0] || "unknown";
    await rateLimit(
      query,
      createHash("sha256").update(ip).digest("hex"),
      "partner-login",
      10,
      60,
    );
    const result = await verifyAffiliateLogin(email, password, "partner");
    if (!result.ok)
      return {
        ok: false,
        error:
          result.reason === "pending"
            ? "Your application is awaiting approval."
            : result.reason === "suspended"
              ? "Your partner account is suspended."
              : "Email or password is incorrect.",
      };
    const rows = await query(
      "SELECT 1 FROM affiliates WHERE id=$1 AND programme='partner' AND partner_terms_confirmed=true",
      [result.affiliate.id],
    );
    if (!rows.length)
      return {
        ok: false,
        error:
          "Use the sign-in page for your programme, or contact JKTL about your partner agreement.",
      };
    await startAffiliateSession(result.affiliate.id);
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not sign in. Please retry." };
  }
}
export async function approvePartnerAction(
  partnerId: string,
  bps: number,
  agreement: string,
) {
  try {
    await requireAdminCapability("manage_affiliates");
    if (
      !Number.isInteger(bps) ||
      bps < 0 ||
      bps > 10000 ||
      typeof agreement !== "string" ||
      agreement.trim().length < 20 ||
      agreement.length > 3000
    )
      return {
        ok: false,
        error:
          "Record the agreed commission basis points and written partner terms.",
      };
    const rows = await query(
      "UPDATE affiliates SET commission_bps=$2,partner_agreement=$3,partner_terms_confirmed=true WHERE id=$1 AND programme='partner' AND status='pending' RETURNING id",
      [partnerId, bps, agreement.trim()],
    );
    if (!rows.length)
      return {
        ok: false,
        error: "Partner application changed. Reload the page.",
      };
    return await approveAffiliateApplicationAction(partnerId);
  } catch {
    return {
      ok: false,
      error: "Could not approve this partner. Check team member access.",
    };
  }
}
