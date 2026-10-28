"use server";
import { mailAddress } from "@/lib/mail/addresses";
import { after } from "next/server";
import { flushProgramNotices } from "@/lib/distribution/notifications";
import { randomBytes, createHash } from "node:crypto";
import { query } from "@/lib/custom/service";
import { requireAdminCapability } from "@/lib/admin-session";
import { requireSession } from "@/lib/session";
import { startAffiliateSession } from "@/lib/affiliate-session";
import { hashPassword } from "@/lib/db/auth";
import { sendPartnerNoticeEmail } from "@/lib/email";
import { rate } from "@/lib/support/service";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
export async function inviteAffiliateAction(f: FormData) {
  const a = await requireAdminCapability("manage_affiliates");
  await rate("affiliate-invite:" + a.id, 10);
  const name = String(f.get("name") || "").trim(),
    email = String(f.get("email") || "")
      .trim()
      .toLowerCase(),
    message = String(f.get("message") || "").trim(),
    policy = String(f.get("policy")),
    program = String(f.get("program") || "affiliate"),
    hours = Number(f.get("hours") || 48);
  if (
    !["affiliate", "partner"].includes(program) ||
    !Number.isInteger(hours) ||
    hours < 1 ||
    hours > 168 ||
    name.length < 2 ||
    name.length > 120 ||
    !mailAddress(email) ||
    email.length > 254 ||
    message.length > 2000
  )
    throw Error("Provide a name, valid email and a short invitation message");
  const token = randomBytes(32).toString("hex");
  const rows = await query(
    `WITH eligible AS(SELECT id,terms FROM distribution_policies WHERE id=$4 AND program=upper($7) AND state='DRAFT'),old AS(UPDATE affiliate_invitations SET revoked_at=now() WHERE lower(email)=$2 AND program=$7 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at<=now() RETURNING id),added AS(INSERT INTO affiliate_invitations(name,email,message,policy_id,terms,token_hash,created_by,expires_at,program) SELECT $1,$2,$3,e.id,e.terms,$5,$6,now()+$8::int*interval '1 hour',$7 FROM eligible e CROSS JOIN affiliate_activity_settings s WHERE (SELECT count(*) FROM old)>=0 AND NOT EXISTS(SELECT 1 FROM affiliates WHERE lower(email)=$2 AND programme=$7) RETURNING id) INSERT INTO distribution_audit(actor_id,event,detail) SELECT $6,CASE WHEN $7='partner' THEN 'PARTNER_INVITED' ELSE 'AFFILIATE_INVITED' END,jsonb_build_object('invitation',id,'policy',$4::uuid) FROM added RETURNING detail->>'invitation' id`,
    [
      name,
      email,
      message,
      policy,
      createHash("sha256").update(token).digest("hex"),
      a.id,
      program,
      hours,
    ],
  );
  if (!rows.length)
    throw Error(
      "A valid draft programme policy is required, and existing programme accounts must use their current account",
    );
  const sent = await sendPartnerNoticeEmail({
    to: email,
    subject:
      program === "partner"
        ? "Your invitation to JKTL Partners"
        : "Your invitation to JKTL Affiliates",
    detail: `Hello ${name},\nJoin JKTL ${program === "partner" ? "Partners" : "Affiliates"} to introduce our business tools to your audience. ${message}\nUse your existing JKTL Business account, or create one and choose your own password. Review the proposed programme terms before accepting. Financial eligibility requires a separately accepted, formally activated agreement. This single-use link expires on the date shown on the invitation page.`,
    path: "/affiliates/invitation?token=" + token,
    key: "affiliate-invite-" + rows[0].id,
    category: "security",
    replyCategory: program as "affiliate" | "partner",
  });
  if (sent.ok)
    await query("UPDATE affiliate_invitations SET sent_at=now() WHERE id=$1", [
      rows[0].id,
    ]);
  revalidatePath("/admin/affiliates/invitations");
  revalidatePath("/admin/emails/invite");
  if (!sent.ok)
    throw Error(
      "Invitation saved but email was not accepted by the provider. Use resend to issue a new secure link.",
    );
}
export async function resendAffiliateInviteAction(f: FormData) {
  const a = await requireAdminCapability("manage_affiliates");
  await rate("affiliate-invite:" + a.id, 10);
  const token = randomBytes(32).toString("hex"),
    hours = Number(f.get("hours") || 48);
  if (!Number.isInteger(hours) || hours < 1 || hours > 168)
    throw Error("Choose 1–168 hours.");
  const rows = await query(
    `UPDATE affiliate_invitations SET token_hash=$2,expires_at=now()+$3::int*interval '1 hour' WHERE id=$1 AND accepted_at IS NULL AND revoked_at IS NULL RETURNING id,email,name,program`,
    [
      String(f.get("id")),
      createHash("sha256").update(token).digest("hex"),
      hours,
    ],
  );
  if (!rows[0]) throw Error("Current unused invitation required");
  const r = rows[0];
  const sent = await sendPartnerNoticeEmail({
    to: String(r.email),
    subject:r.program==="partner"?"Your secure JKTL Partner invitation":"Your secure JKTL Affiliate invitation",
    detail: `Hello ${r.name}, use this replacement invitation to review and accept your JKTL ${r.program==="partner"?"Partner":"Affiliate"} invitation. Previous links no longer work. Choose your own password or sign in with your existing Business account.`,
    path: "/affiliates/invitation?token=" + token,
    key:
      "affiliate-invite-resend-" +
      r.id +
      "-" +
      createHash("sha256").update(token).digest("hex").slice(0, 12),
    category: "security",
    replyCategory: r.program as "affiliate" | "partner",
  });
  if (!sent.ok)
    throw Error("Email provider did not accept the invitation. Please retry.");
  await query(
    "UPDATE affiliate_invitations SET sent_at=now(),reminded_at=now() WHERE id=$1",
    [r.id],
  );
  revalidatePath("/admin/affiliates/invitations");
  revalidatePath("/admin/emails/invite");
}
export async function acceptAffiliateInvitationAction(f: FormData) {
  const s = await requireSession();
  await rate("affiliate-accept:" + s.userId, 5);
  const token = String(f.get("token") || "");
  if (!/^[a-f0-9]{64}$/.test(token) || f.get("consent") !== "on")
    throw Error("Review and accept the invitation terms");
  const password = await hashPassword(randomBytes(40).toString("hex"));
  const rows = await query(
    `WITH eligible AS(SELECT i.* FROM affiliate_invitations i JOIN users u ON u.id=$2 AND lower(u.email)=i.email WHERE i.token_hash=$1 AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>now() FOR UPDATE OF i),added AS(INSERT INTO affiliates(name,email,password_hash,referral_code,programme,status,commission_model,commission_bps,signup_bonus_kobo,subscription_bonus_kobo,recurring_monthly_kobo,application_stage,application_data) SELECT name,email,$3,$4,program,CASE WHEN program='partner' THEN 'pending' ELSE 'active' END,'policy',0,0,0,0,CASE WHEN program='partner' THEN 'PENDING' ELSE 'APPROVED' END,jsonb_build_object('accountSource','BUSINESS','invitation',id) FROM eligible WHERE NOT EXISTS(SELECT 1 FROM affiliates a WHERE lower(a.email)=eligible.email AND a.programme=eligible.program) RETURNING id,programme),linked AS(INSERT INTO distribution_account_links(user_id,affiliate_id,program) SELECT $2,id,programme FROM added RETURNING affiliate_id,program),activity AS(INSERT INTO affiliate_activity(affiliate_id,exempt) SELECT affiliate_id,true FROM linked WHERE program='affiliate' RETURNING affiliate_id),accepted AS(UPDATE affiliate_invitations i SET accepted_at=now(),accepted_by=$2,affiliate_id=l.affiliate_id FROM linked l WHERE i.id IN(SELECT id FROM eligible) RETURNING i.*),audit AS(INSERT INTO distribution_audit(actor_id,event,affiliate_id,detail) SELECT $2,CASE WHEN program='partner' THEN 'PARTNER_INVITATION_ACCEPTED' ELSE 'AFFILIATE_INVITATION_ACCEPTED' END,affiliate_id,jsonb_build_object('invitation',id,'policy',policy_id,'acceptedTerms',terms) FROM accepted RETURNING affiliate_id) SELECT affiliate_id,program FROM accepted`,
    [
      createHash("sha256").update(token).digest("hex"),
      s.userId,
      password,
      randomBytes(8).toString("hex").toUpperCase(),
    ],
  );
  if (!rows[0])
    throw Error(
      "Invitation expired, already used, or belongs to a different email. Sign in with the invited Business account.",
    );
  if (rows[0].program !== "partner")
    await startAffiliateSession(String(rows[0].affiliate_id));
  after(async () => {
    try {
      await flushProgramNotices();
    } catch {}
  });
  redirect(
    rows[0].program === "partner" ? "/business/distribution" : "/affiliates",
  );
}

export async function revokeProgramInvitationAction(f: FormData) {
  const a = await requireAdminCapability("manage_affiliates");
  await query(
    "WITH changed AS(UPDATE affiliate_invitations SET revoked_at=now() WHERE id=$1 AND accepted_at IS NULL AND revoked_at IS NULL RETURNING id) INSERT INTO distribution_audit(actor_id,event,detail) SELECT $2,'PROGRAM_INVITATION_REVOKED',jsonb_build_object('invitation',id) FROM changed",
    [String(f.get("id")), a.id],
  );
  revalidatePath("/admin/emails/invite");
}
