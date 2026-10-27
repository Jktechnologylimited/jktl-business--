"use server";
import { query } from "@/lib/custom/service";
import { requireAdminCapability } from "@/lib/admin-session";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { monitorAffiliateActivity } from "@/lib/distribution/activity";
import { flushProgramNotices } from "@/lib/distribution/notifications";
export async function affiliateActivitySettingsAction(f: FormData) {
  const a = await requireAdminCapability("manage_team");
  const warning = Number(f.get("warning")),
    dormant = Number(f.get("dormant")),
    suspend = Number(f.get("suspend")),
    reminder = Number(f.get("reminder")),
    expiry = Number(f.get("expiry"));
  if (
    ![warning, dormant, suspend, reminder, expiry].every(
      Number.isSafeInteger,
    ) ||
    warning < 30 ||
    dormant <= warning ||
    dormant > 730 ||
    suspend < 14 ||
    suspend > 365 ||
    reminder < 1 ||
    reminder > 29 ||
    expiry <= reminder ||
    expiry > 90
  )
    throw Error("Choose valid inactivity windows");
  await query(
    `WITH updated AS(UPDATE affiliate_activity_settings SET warning_days=$1,dormant_days=$2,suspend_after_days=$3,automatic_suspension=$4,invitation_reminder_days=$6,invitation_expiry_days=$7 WHERE id=true RETURNING *) INSERT INTO distribution_audit(actor_id,event,detail) SELECT $5,'AFFILIATE_ACTIVITY_SETTINGS',to_jsonb(updated) FROM updated`,
    [
      warning,
      dormant,
      suspend,
      f.get("automatic") === "on",
      a.id,
      reminder,
      expiry,
    ],
  );
  revalidatePath("/admin/affiliates/settings");
}
export async function reviewAffiliateActivityAction(f: FormData) {
  const a = await requireAdminCapability("manage_team");
  const note = String(f.get("note") || "").trim();
  if (note.length < 20 || note.length > 2000 || f.get("reviewed") !== "on")
    throw Error(
      "Review the actual contractual inactivity provisions and record the reason",
    );
  await query(
    `WITH updated AS(INSERT INTO affiliate_activity(affiliate_id,exempt,contract_reviewed) SELECT id,$2,true FROM affiliates WHERE id=$1 AND programme='affiliate' ON CONFLICT(affiliate_id) DO UPDATE SET exempt=$2,contract_reviewed=true RETURNING affiliate_id) INSERT INTO distribution_audit(actor_id,event,affiliate_id,detail) SELECT $3,'AFFILIATE_INACTIVITY_CONTRACT_REVIEW',affiliate_id,jsonb_build_object('exempt',$2::boolean,'reason',$4::text) FROM updated`,
    [String(f.get("id")), f.get("exempt") === "on", a.id, note],
  );
  revalidatePath("/admin/affiliates/settings");
}
export async function monitorAffiliateActivityAction() {
  await requireAdminCapability("manage_affiliates");
  const result = await monitorAffiliateActivity();
  after(async () => {
    await flushProgramNotices();
  });
  revalidatePath("/admin/affiliates/settings");
  return result;
}

export async function setAffiliatePrivilegesAction(f: FormData) {
  const a = await requireAdminCapability("manage_team");
  const status = String(f.get("status")),
    note = String(f.get("note") || "").trim();
  if (
    !["active", "suspended"].includes(status) ||
    note.length < 20 ||
    note.length > 2000
  )
    throw Error(
      "Record a reviewed reason before changing Affiliate privileges",
    );
  const r = await query(
    `WITH changed AS(UPDATE affiliates SET status=$2 WHERE id=$1 AND programme='affiliate' AND status IN('active','suspended') AND status<>$2 RETURNING id),activity AS(INSERT INTO affiliate_activity(affiliate_id,state,exempt) SELECT id,CASE WHEN $2='active' THEN 'ACTIVE' ELSE 'SUSPENDED' END,true FROM changed ON CONFLICT(affiliate_id) DO UPDATE SET state=excluded.state,exempt=true,updated_at=now() RETURNING affiliate_id),notice AS(INSERT INTO distribution_program_notices(event_key,affiliate_id,subject,detail,path,category) SELECT 'privilege-'||affiliate_id||'-'||extract(epoch FROM now())::text,affiliate_id,'JKTL Affiliate account update',CASE WHEN $2='active' THEN 'Your Affiliate privileges have been reactivated after review. Your applicable accepted agreements remain in force.' ELSE 'Your Affiliate privileges have been suspended after review. Your Business account, referred customer subscriptions and earned financial obligations remain intact. Contact JKTL support for a review.' END,'/affiliates','security' FROM activity RETURNING id) INSERT INTO distribution_audit(actor_id,event,affiliate_id,detail) SELECT $3,'AFFILIATE_PRIVILEGES_CHANGED',id,jsonb_build_object('status',$2::text,'reason',$4::text,'inactivityExemption',true) FROM changed RETURNING id`,
    [String(f.get("id")), status, a.id, note],
  );
  if (!r.length)
    throw Error("Current Affiliate account and a different status required");
  after(async () => {
    await flushProgramNotices();
  });
  revalidatePath("/admin/affiliates/settings");
}
