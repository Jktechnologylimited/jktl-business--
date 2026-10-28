"use server";
/** Compatibility actions for earlier Affiliate drafts. The unified Emails UI
 * uses email-compose-actions and the same existing draft table/provider/outbox.
 * Keep these until outstanding legacy drafts and old client sessions retire. */
import { query } from "@/lib/custom/service";
import { requireAdminCapability } from "@/lib/admin-session";
import { rate } from "@/lib/support/service";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { flushProgramNotices } from "@/lib/distribution/notifications";
export async function draftAffiliateCampaignAction(f: FormData) {
  const a = await requireAdminCapability("manage_affiliates");
  await rate("affiliate-campaign:" + a.id, 5);
  const subject = String(f.get("subject") || "").trim(),
    body = String(f.get("body") || "").trim(),
    audience = String(f.get("audience")),
    selected = f
      .getAll("selected")
      .flatMap((v) => String(v).split(/[\s,]+/))
      .filter(Boolean);
  if (
    subject.length < 5 ||
    subject.length > 160 ||
    body.length < 20 ||
    body.length > 5000 ||
    !["ACTIVE", "DORMANT", "INVITED", "SELECTED"].includes(audience) ||
    selected.length > 100
  )
    throw Error(
      "Check subject, message and audience (up to 100 accounts per campaign)",
    );
  const rows = await query(
    `SELECT DISTINCT r.email FROM(SELECT a.email FROM affiliates a LEFT JOIN affiliate_activity x ON x.affiliate_id=a.id WHERE a.programme='affiliate' AND($1='ACTIVE' AND a.status='active' OR $1='DORMANT' AND x.state='DORMANT' OR $1='SELECTED' AND a.id::text=ANY($2::text[])) UNION SELECT email FROM affiliate_invitations WHERE $1='INVITED' AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now()) r JOIN email_preferences p ON p.email=lower(r.email) WHERE p.marketing_opt_in=true AND p.marketing_suppressed=false AND NOT EXISTS(SELECT 1 FROM prospects s WHERE lower(s.email)=lower(r.email) AND(s.suppressed=true OR s.status='suppressed')) ORDER BY r.email LIMIT 101`,
    [audience, selected],
  );
  if (!rows.length || rows.length > 100)
    throw Error(
      "Choose an audience with 1–100 opted-in recipients. Narrow the selection for larger audiences.",
    );
  await query(
    `WITH added AS(INSERT INTO affiliate_campaigns(subject,body,audience,recipients,created_by) VALUES($1,$2,$3,$4::jsonb,$5) RETURNING id) INSERT INTO distribution_audit(actor_id,event,detail) SELECT $5,'AFFILIATE_CAMPAIGN_DRAFT',jsonb_build_object('campaign',id,'recipientCount',$6::integer) FROM added`,
    [
      subject,
      body,
      audience,
      JSON.stringify(rows.map((r) => r.email)),
      a.id,
      rows.length,
    ],
  );
  revalidatePath("/admin/affiliates/communications");
}
export async function confirmAffiliateCampaignAction(f: FormData) {
  const a = await requireAdminCapability("manage_affiliates");
  await rate("affiliate-campaign-send:" + a.id, 3);
  if (f.get("confirm") !== "on")
    throw Error("Confirm the preview and recipient list before sending");
  const rows = await query(
    `WITH confirmed AS(UPDATE affiliate_campaigns SET status='QUEUED',confirmed_by=$2,confirmed_at=now() WHERE id=$1 AND status='DRAFT' AND jsonb_array_length(recipients)=$3 AND EXISTS(SELECT 1 FROM email_branding WHERE id=true AND length(settings->>'postalAddress')>0) RETURNING *),queued AS(INSERT INTO distribution_program_notices(event_key,recipient_email,subject,detail,path,category,push_delivered_at) SELECT 'affiliate-campaign-'||c.id||'-'||md5(email),email,c.subject,c.body,'/affiliates/resources','marketing',now() FROM confirmed c CROSS JOIN LATERAL jsonb_array_elements_text(c.recipients) email ON CONFLICT DO NOTHING RETURNING id) INSERT INTO distribution_audit(actor_id,event,detail) SELECT $2,'AFFILIATE_CAMPAIGN_CONFIRMED',jsonb_build_object('campaign',id,'recipientCount',$3::integer) FROM confirmed RETURNING id`,
    [String(f.get("id")), a.id, Number(f.get("count"))],
  );
  if (!rows.length)
    throw Error(
      "Current draft, exact recipient count and configured company postal address required",
    );
  after(async () => {
    await flushProgramNotices();
  });
  revalidatePath("/admin/affiliates/communications");
}
