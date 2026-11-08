"use server";
import { requireAdminCapability } from "@/lib/admin-session";
import { query } from "@/lib/custom/service";
import { revalidatePath } from "next/cache";
import { CHANGE_PARTNER_RATE_SQL } from "@/lib/distribution/partner-rates";
export async function updatePartnerRateAction(input: {
  id: string;
  percentage: string;
  expectedBps: number;
  reason: string;
  agreed: boolean;
}) {
  try {
    const actor = await requireAdminCapability("manage_affiliates");
    if (
      !input ||
      typeof input.percentage !== "string" ||
      !/^\d{1,3}(\.\d{1,2})?$/.test(input.percentage.trim()) ||
      !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(input.id) ||
      !Number.isInteger(input.expectedBps) ||
      input.expectedBps < 0 ||
      input.expectedBps > 10000 ||
      typeof input.reason !== "string" ||
      input.reason.trim().length < 10 ||
      input.reason.length > 3000 ||
      input.agreed !== true
    )
      return {
        ok: false,
        error:
          "Enter a percentage with up to two decimal places, an agreed change note and confirmation.",
      };
    const bps = Math.round(Number(input.percentage.trim()) * 100);
    if (bps < 0 || bps > 10000)
      return { ok: false, error: "Use a percentage between 0 and 100." };
    const rows = await query(CHANGE_PARTNER_RATE_SQL, [
      input.id,
      bps,
      input.expectedBps,
      input.reason.trim(),
      actor.id,
    ]);
    if (!rows.length)
      return {
        ok: false,
        error:
          "No change saved. Reload to check the current rate and agreement. Policy rates are limited to 50%; reseller and issued offers use Commercial terms.",
      };
    revalidatePath("/admin/partners");
    revalidatePath("/partners");
    revalidatePath("/partners/commercial");
    return {
      ok: true,
      rateBps: Number(rows[0].rate_bps),
      proposal: Boolean(rows[0].proposal),
      effectiveAt: String(rows[0].effective_at),
    };
  } catch {
    return {
      ok: false,
      error:
        "Could not save the commission change. Check your Team access and retry.",
    };
  }
}
