"use server";
import { cookies } from "next/headers";
import { query } from "@/lib/custom/service";
import { approvedPartner } from "@/lib/partners/access";
import { requireAdminCapability } from "@/lib/admin-session";
import { pushSubscription } from "@/lib/support/model";
import { rate } from "@/lib/support/service";
import { revalidatePath } from "next/cache";
export async function savePartnerPushAction(input: unknown) {
  const p = await approvedPartner();
  const sub = pushSubscription(input);
  if (
    !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    !process.env.VAPID_PRIVATE_KEY
  )
    throw Error("Notifications are not configured");
  const session = (await cookies()).get("jktl_affiliate_session")?.value;
  const r = await query(
    `INSERT INTO partner_push_subscriptions(endpoint,affiliate_id,session_id,p256dh,auth) SELECT $1,$2,s.id,$4,$5 FROM affiliate_sessions s WHERE s.id=$3 AND s.affiliate_id=$2 AND s.expires_at>now() ON CONFLICT(endpoint) DO UPDATE SET affiliate_id=excluded.affiliate_id,session_id=excluded.session_id,p256dh=excluded.p256dh,auth=excluded.auth RETURNING endpoint`,
    [sub.endpoint, p.id, session, sub.p256dh, sub.auth],
  );
  if (!r.length) throw Error("Sign in again before enabling alerts");
}
export async function removePartnerPushAction(endpoint: string) {
  const p = await approvedPartner();
  await query(
    "DELETE FROM partner_push_subscriptions WHERE endpoint=$1 AND affiliate_id=$2",
    [endpoint, p.id],
  );
}
export async function uploadPartnerAttachmentAction(f: FormData) {
  const p = await approvedPartner();
  await rate("partner-attachment:" + p.id, 20);
  const file = f.get("file");
  if (!(file instanceof File) || file.size < 1 || file.size > 524288)
    throw Error("Choose a PNG, JPEG, WebP or PDF no larger than 512 KB");
  const b = Buffer.from(await file.arrayBuffer());
  let mime = "";
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    mime = "image/png";
  else if (b[0] === 255 && b[1] === 216 && b[2] === 255) mime = "image/jpeg";
  else if (
    b.subarray(0, 4).toString() === "RIFF" &&
    b.subarray(8, 12).toString() === "WEBP"
  )
    mime = "image/webp";
  else if (b.subarray(0, 5).toString() === "%PDF-") mime = "application/pdf";
  if (!mime || mime !== file.type)
    throw Error("File format does not match the selected file");
  const name =
    file.name.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 120) || "attachment";
  const r = await query(
    `WITH allowed AS(UPDATE partner_tickets SET attachment_bytes=attachment_bytes+$3,updated_at=now() WHERE id=$1 AND partner_id=$2 AND status<>'CLOSED' AND EXISTS(SELECT 1 FROM affiliates a WHERE a.id=$2 AND a.status='active' AND a.programme='partner' AND a.partner_terms_confirmed=true) AND attachment_bytes+$3<=5242880 RETURNING id),added AS(INSERT INTO partner_ticket_attachments(ticket_id,actor_id,file_name,mime,size,body) SELECT id,$2,$4,$5,$3,$6 FROM allowed RETURNING ticket_id) INSERT INTO partner_ticket_messages(ticket_id,actor_id,kind,body) SELECT ticket_id,$2,'PARTNER','Attachment uploaded. Open the protected attachment list to download.' FROM added RETURNING id`,
    [String(f.get("id")), p.id, b.length, name, mime, b.toString("base64")],
  );
  if (!r.length)
    throw Error("Ticket unavailable, closed or attachment limit reached");
  revalidatePath("/partners/support");
}
export async function assignPartnerTicketAction(f: FormData) {
  const a = await requireAdminCapability("manage_team");
  const target = String(f.get("assignedTo") || ""),
    id = String(f.get("id")),
    priority = String(f.get("priority"));
  if (!["LOW", "NORMAL", "HIGH"].includes(priority))
    throw Error("Invalid priority");
  const r = await query(
    `WITH assigned AS(UPDATE partner_tickets t SET assigned_to=a.id,priority=$3,status='ASSIGNED',updated_at=now() FROM admin_users a WHERE t.id=$1 AND a.id=$2 AND a.disabled_at IS NULL AND(a.role='owner' OR(a.role='support' AND t.sensitive=false)) RETURNING t.id) INSERT INTO partner_ticket_messages(ticket_id,actor_id,kind,body) SELECT id,$4,'EVENT','Staff assignment updated' FROM assigned RETURNING id`,
    [id, target, priority, a.id],
  );
  if (!r.length) throw Error("Choose an eligible active team member");
  revalidatePath("/admin/partner-support");
}
export async function partnerResponseTargetAction(f: FormData) {
  const a = await requireAdminCapability("manage_team");
  const hours = Number(f.get("hours"));
  if (!Number.isInteger(hours) || hours < 1 || hours > 720)
    throw Error("Choose between 1 and 720 hours");
  await query(
    `WITH changed AS(UPDATE partner_support_settings SET response_hours=$1,updated_by=$2,updated_at=now() WHERE id=true RETURNING response_hours) INSERT INTO distribution_audit(actor_id,event,detail) SELECT $2,'PARTNER_RESPONSE_TARGET_CHANGED',jsonb_build_object('hours',response_hours) FROM changed`,
    [hours, a.id],
  );
  revalidatePath("/admin/partner-support");
}
export async function retryPartnerNoticesAction() {
  await requireAdminCapability("manage_support");
  const { processPartnerNotices } =
    await import("@/lib/partners/notifications");
  return processPartnerNotices();
}
