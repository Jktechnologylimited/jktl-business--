"use server";
import { requireAdminCapability } from "@/lib/admin-session";
import { query } from "@/lib/custom/service";
import { revalidatePath } from "next/cache";
export async function saveDistributionDraftAction(form: FormData) {
  const admin = await requireAdminCapability("manage_team");
  const program = form.get("program");
  const name = String(form.get("name") || "").trim();
  const bps = Number(form.get("rateBps"));
  const months = Number(form.get("paidMonths"));
  const hold = Number(form.get("holdDays"));
  if (
    !["AFFILIATE", "PARTNER"].includes(String(program)) ||
    name.length < 5 ||
    name.length > 160 ||
    !Number.isInteger(bps) ||
    bps < 0 ||
    bps > 5000 ||
    !Number.isInteger(months) ||
    months < 1 ||
    months > 36 ||
    !Number.isInteger(hold) ||
    hold < 14 ||
    hold > 365
  )
    throw Error("Invalid draft policy fields");
  const terms = {
    rateBps: bps,
    paidMonths: months,
    holdDays: hold,
    currency: "NGN",
    products: ["website_subscription"],
    netDefinition:
      "captured_less_tax_processing_refunds_chargebacks_and_third_party_costs",
    discounts: "already_excluded_from_captured",
    renewalsBeyondTerm: false,
    automaticPayouts: false,
    stackWithResellerDiscount: false,
  };
  // Each save is a new immutable-by-convention draft version. No active enrolment,
  // financial balance or public offer changes. Audit and insertion are atomic.
  await query(
    `WITH added AS (INSERT INTO distribution_policies(code,program,version,name,terms,created_by) SELECT gen_random_uuid()::text,$1,COALESCE(MAX(version),0)+1,$2,$3::jsonb,$4 FROM distribution_policies WHERE program=$1 RETURNING id) INSERT INTO distribution_audit(actor_id,event,policy_id,detail) SELECT $4,'DRAFT_CREATED',id,$3::jsonb FROM added`,
    [program, name, JSON.stringify(terms), admin.id],
  );
  revalidatePath("/admin/distribution");
}
export async function reviewLegacyEnrollmentAction(form: FormData) {
  const a = await requireAdminCapability("manage_team");
  const id = String(form.get("id") || "");
  const note = String(form.get("note") || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id) || note.length < 10 || note.length > 2000)
    throw Error("An account and detailed reconciliation note are required");
  await query(
    `WITH reviewed AS(UPDATE distribution_enrollments SET review_required=false WHERE affiliate_id=$1 AND review_required=true RETURNING affiliate_id,policy_id) INSERT INTO distribution_audit(actor_id,event,affiliate_id,policy_id,detail) SELECT $2,'LEGACY_SNAPSHOT_REVIEWED',affiliate_id,policy_id,jsonb_build_object('note',$3::text) FROM reviewed`,
    [id, a.id, note],
  );
  revalidatePath("/admin/distribution");
}
