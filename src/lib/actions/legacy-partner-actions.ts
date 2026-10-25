"use server";
import { randomBytes } from "node:crypto";
import { requireAdminCapability } from "@/lib/admin-session";
import { hashPassword } from "@/lib/db/auth";
import { query } from "@/lib/custom/service";
export async function legacyPartnerApplicationsAction() {
  await requireAdminCapability("manage_affiliates");
  const key = process.env.JKTL_PARTNER_BRIDGE_SECRET;
  if (!key || key.length < 32)
    return {
      configured: false,
      available: false,
      applications: [] as Record<string, unknown>[],
    };
  try {
    const response = await fetch(
      "https://jktl.com.ng/api/internal/partner-applications",
      {
        headers: { Authorization: `Bearer ${key}` },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) throw Error();
    const data = await response.json();
    return {
      configured: true,
      available: true,
      applications: Array.isArray(data.applications)
        ? (data.applications as Record<string, unknown>[])
        : [],
    };
  } catch {
    return {
      configured: true,
      available: false,
      applications: [] as Record<string, unknown>[],
    };
  }
}
export async function importLegacyPartnerAction(sourceId: string) {
  try {
    await requireAdminCapability("manage_affiliates");
    if (typeof sourceId !== "string" || sourceId.length > 100) throw Error();
    const data = await legacyPartnerApplicationsAction();
    const app = data.applications.find((a) => String(a.id) === sourceId);
    if (
      !app ||
      typeof app.email !== "string" ||
      !/^\S+@\S+\.\S+$/.test(app.email) ||
      app.email.length > 254 ||
      typeof app.name !== "string" ||
      !app.name.trim()
    )
      return {
        ok: false,
        error:
          "Application is unavailable from the verified Main inquiry source.",
      };
    const email = app.email.trim().toLowerCase();
    if (
      (await query("SELECT 1 FROM affiliates WHERE email=$1", [email])).length
    )
      return {
        ok: false,
        error:
          "A programme account already exists for this email. Review its existing application.",
      };
    const hash = await hashPassword(randomBytes(32).toString("hex"));
    await query(
      `INSERT INTO affiliates(name,email,password_hash,referral_code,commission_bps,status,application_note,programme,commission_model,signup_bonus_kobo,subscription_bonus_kobo,recurring_monthly_kobo,recurring_months_cap,partner_source_id) VALUES($1,$2,$3,$4,0,'pending',$5,'partner','percentage',0,0,0,0,$6)`,
      [
        app.name.trim().slice(0, 120),
        email,
        hash,
        randomBytes(6).toString("hex"),
        `${String(app.business_name || "").slice(0, 180)}\n${String(app.message || "").slice(0, 2000)}\nImported from the consented Main partner application.`,
        sourceId,
      ],
    );
    return { ok: true };
  } catch {
    return {
      ok: false,
      error:
        "Could not import this application. Check administrator access and bridge configuration.",
    };
  }
}
