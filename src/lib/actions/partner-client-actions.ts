"use server";
import { randomBytes, createHash } from "node:crypto";
import { query, owner } from "@/lib/custom/service";
import { requireSession } from "@/lib/session";
import {
  requireAffiliateSession,
  startAffiliateSession,
} from "@/lib/affiliate-session";
import { verifyAffiliateLogin } from "@/lib/db/affiliate-auth";
import { rate } from "@/lib/support/service";
import { clientScopes, validInviteToken } from "@/lib/distribution/access";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
function digest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
async function partner() {
  const s = await requireAffiliateSession();
  if (
    !(
      await query(
        "SELECT 1 FROM affiliates WHERE id=$1 AND programme='partner' AND status='active' AND partner_terms_confirmed=true",
        [s.id],
      )
    ).length
  )
    throw Error("Approved partner agreement required");
  return s;
}
export async function connectProgramAction(form: FormData) {
  const s = await requireSession();
  await rate("program-link:" + s.userId, 10);
  const login = await verifyAffiliateLogin(
    String(form.get("email") || "").slice(0, 254),
    String(form.get("password") || "").slice(0, 72),
    form.get("program") === "partner" ? "partner" : "affiliate",
  );
  if (!login.ok) throw Error("Approved program account credentials required");
  const a = login.affiliate;
  await query(
    `WITH linked AS(INSERT INTO distribution_account_links(user_id,affiliate_id,program) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING *) INSERT INTO distribution_audit(actor_id,event,affiliate_id,detail) SELECT $1,'ACCOUNT_LINKED',affiliate_id,jsonb_build_object('program',program) FROM linked`,
    [s.userId, a.id, a.programme || "affiliate"],
  );
  revalidatePath("/business/distribution");
}
export async function openProgramAction(form: FormData) {
  const s = await requireSession();
  const program = String(form.get("program"));
  if (!["affiliate", "partner"].includes(program))
    throw Error("Invalid program");
  const a = (
    await query(
      `SELECT a.id FROM distribution_account_links l JOIN affiliates a ON a.id=l.affiliate_id WHERE l.user_id=$1 AND l.program=$2 AND a.programme=$2 AND a.status='active' AND($2='affiliate' OR a.partner_terms_confirmed=true)`,
      [s.userId, program],
    )
  )[0];
  if (!a) throw Error("Approved linked account required");
  await startAffiliateSession(String(a.id));
  redirect(program === "partner" ? "/partners" : "/affiliates");
}
export async function unlinkProgramAction(form: FormData) {
  const s = await requireSession();
  await query(
    "DELETE FROM distribution_account_links WHERE user_id=$1 AND program=$2",
    [s.userId, String(form.get("program"))],
  );
  revalidatePath("/business/distribution");
}
export async function invitePartnerClientAction(label: string) {
  const p = await partner();
  await rate("partner-invite:" + p.id, 20);
  label = label.trim();
  if (label.length < 1 || label.length > 160)
    throw Error("Client label required");
  const token = randomBytes(32).toString("hex");
  await query(
    `WITH added AS(INSERT INTO partner_client_invitations(partner_id,token_hash,label) VALUES($1,$2,$3) RETURNING id) INSERT INTO distribution_audit(actor_id,event,affiliate_id,detail) SELECT $1,'CLIENT_INVITED',$1,jsonb_build_object('invitation',id) FROM added`,
    [p.id, digest(token), label],
  );
  return {
    url: "https://business.jktl.com.ng/business/distribution?invite=" + token,
  };
}
export async function acceptPartnerInviteAction(form: FormData) {
  const s = await owner();
  const token = String(form.get("token") || "");
  if (!validInviteToken(token)) throw Error("Invalid invitation");
  const scopes = clientScopes(form.getAll("scopes"));
  if (form.get("consent") !== "on")
    throw Error("Confirm access before accepting");
  const result = await query(
    `WITH accepted AS(UPDATE partner_client_invitations i SET accepted_org=$2,accepted_by=$3,accepted_at=now() FROM affiliates p WHERE i.token_hash=$1 AND i.partner_id=p.id AND p.status='active' AND p.programme='partner' AND p.partner_terms_confirmed=true AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>now() AND NOT EXISTS(SELECT 1 FROM distribution_account_links l WHERE l.user_id=$3 AND l.affiliate_id=p.id) RETURNING i.*), claimed AS(UPDATE partner_workspaces w SET organization_id=$2 FROM accepted i WHERE w.id=i.workspace_id AND w.partner_id=i.partner_id AND w.organization_id IS NULL RETURNING w.id), granted AS(INSERT INTO partner_client_access(partner_id,organization_id,invitation_id,granted_by,scopes) SELECT partner_id,$2,id,$3,$4::text[] FROM accepted WHERE workspace_id IS NULL OR workspace_id IN(SELECT id FROM claimed) RETURNING *),attributed AS(INSERT INTO affiliate_referrals(affiliate_id,organization_id) SELECT g.partner_id,$2 FROM granted g JOIN affiliates a ON a.id=g.partner_id JOIN distribution_contracts c ON c.affiliate_id=a.id JOIN organizations o ON o.id=$2 WHERE a.commission_model='policy' AND c.status='ACTIVE' AND c.model='REFERRAL' AND o.created_at>now()-interval '30 days' AND NOT EXISTS(SELECT 1 FROM website_plan_payments p WHERE p.organization_id=$2) AND NOT EXISTS(SELECT 1 FROM domain_orders p WHERE p.organization_id=$2 AND p.paid_at IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM email_orders p WHERE p.organization_id=$2 AND p.paid_at IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM infrastructure_accounts p WHERE p.organization_id=$2 AND p.subscription_status='active') AND NOT EXISTS(SELECT 1 FROM organization_members m JOIN users u ON u.id=m.user_id WHERE m.organization_id=$2 AND lower(u.email)=lower(a.email)) ON CONFLICT(organization_id) DO NOTHING RETURNING affiliate_id),attribution_audit AS(INSERT INTO distribution_audit(actor_id,event,affiliate_id,detail) SELECT $3,'CONSENTED_PARTNER_ACQUISITION',affiliate_id,jsonb_build_object('organization',$2::uuid) FROM attributed RETURNING id) INSERT INTO distribution_audit(actor_id,event,affiliate_id,detail) SELECT $3,'CLIENT_ACCESS_GRANTED',partner_id,jsonb_build_object('relationship',id,'scopes',scopes) FROM granted RETURNING id`,
    [digest(token), s.organizationId, s.userId, scopes],
  );
  if (!result.length)
    throw Error("Invitation unavailable, expired or already used");
  revalidatePath("/business/distribution");
}
export async function revokePartnerAccessAction(form: FormData) {
  const s = await owner();
  await query(
    `WITH revoked AS(UPDATE partner_client_access SET revoked_at=now(),scopes='{}' WHERE id=$1 AND organization_id=$2 AND revoked_at IS NULL RETURNING *) INSERT INTO distribution_audit(actor_id,event,affiliate_id,detail) SELECT $3,'CLIENT_ACCESS_REVOKED',partner_id,jsonb_build_object('relationship',id) FROM revoked`,
    [String(form.get("id")), s.organizationId, s.userId],
  );
  revalidatePath("/business/distribution");
}
export async function requestPartnerServiceAction(form: FormData) {
  const p = await partner();
  await rate("partner-request:" + p.id, 20);
  const message = String(form.get("message") || "").trim();
  const product = String(form.get("product"));
  if (message.length < 10 || message.length > 2000 || product.length > 100)
    throw Error("Choose a service and describe the request");
  const aliases: Record<string, string> = {
    website: "website-builder",
    domain: "domains",
    email: "business-email",
    training: "business-tools",
  };
  const slug = aliases[product] || product;
  if (
    !(
      await query(
        "SELECT 1 FROM feature_registry WHERE slug=$1 AND partner_mode<>'UNAVAILABLE' AND 'REQUEST_SETUP'=ANY(partner_actions)",
        [slug],
      )
    ).length
  )
    throw Error("This product is not available for partner requests");
  const r = await query(
    `WITH access AS(SELECT id FROM partner_client_access WHERE id=$1 AND partner_id=$2 AND revoked_at IS NULL AND 'REQUEST_SERVICE_CHANGES'=ANY(scopes) AND EXISTS(SELECT 1 FROM feature_registry WHERE slug=$5 AND partner_mode<>'UNAVAILABLE' AND 'REQUEST_SETUP'=ANY(partner_actions)) FOR UPDATE),added AS(INSERT INTO partner_service_requests(relationship_id,product,message) SELECT id,$3,$4 FROM access RETURNING id) INSERT INTO distribution_audit(actor_id,event,affiliate_id,detail) SELECT $2,'PARTNER_SERVICE_REQUESTED',$2,jsonb_build_object('request',id,'product',$3::text) FROM added RETURNING id`,
    [String(form.get("relationship")), p.id, product, message, slug],
  );
  if (!r.length) throw Error("Current client permission required");
  revalidatePath("/partners/clients");
}
export async function respondPartnerServiceAction(form: FormData) {
  const { requireAdminCapability } = await import("@/lib/admin-session");
  const a = await requireAdminCapability("manage_affiliates");
  const status = String(form.get("status"));
  const reply = String(form.get("reply") || "").trim();
  if (
    !["OPEN", "IN_REVIEW", "COMPLETED", "DECLINED"].includes(status) ||
    reply.length < 1 ||
    reply.length > 2000
  )
    throw Error("Status and response required");
  await query(
    `WITH changed AS(UPDATE partner_service_requests SET status=$2,reply=$3 WHERE id=$1 RETURNING id) INSERT INTO distribution_audit(actor_id,event,detail) SELECT $4,'SERVICE_REQUEST_RESPONDED',jsonb_build_object('request',id,'status',$2::text) FROM changed`,
    [String(form.get("id")), status, reply, a.id],
  );
  revalidatePath("/admin/distribution/requests");
}
