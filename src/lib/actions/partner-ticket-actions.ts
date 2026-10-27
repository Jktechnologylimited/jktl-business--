"use server";
import { after } from "next/server";
import { processPartnerNotices } from "@/lib/partners/notifications";
import { query } from "@/lib/custom/service";
import { approvedProgramme, workspace } from "@/lib/partners/access";
import { programmeSupportAgent } from "@/lib/partners/support-access";
import { sensitive } from "@/lib/support/model";
import { rate } from "@/lib/support/service";
import { revalidatePath } from "next/cache";
export async function createPartnerTicketAction(f: FormData) {
  const p = await approvedProgramme();
  await rate("partner-ticket:" + p.id, 10);
  const subject = String(f.get("subject") || "").trim(),
    body = String(f.get("body") || "").trim(),
    category = String(f.get("category") || "General Assistance"),
    priority = String(f.get("priority") || "NORMAL"),
    id = String(f.get("workspace") || "");
  if (id) await workspace(id);
  if (
    subject.length < 5 ||
    subject.length > 160 ||
    body.length < 10 ||
    body.length > 5000 ||
    category.length > 80 ||
    !["LOW", "NORMAL", "HIGH"].includes(priority)
  )
    throw Error("Check ticket details");
  await query(
    `WITH added AS(INSERT INTO partner_tickets(partner_id,workspace_id,subject,category,priority,sensitive) VALUES($1,$2,$3,$4,$5,$6) RETURNING id) INSERT INTO partner_ticket_messages(ticket_id,actor_id,kind,body) SELECT id,$1,'PARTNER',$7 FROM added`,
    [
      p.id,
      id || null,
      subject,
      category,
      priority,
      ["Billing", "Commissions", "Payouts", "Account Access"].includes(
        category,
      ) || sensitive(subject + " " + body),
      body,
    ],
  );
  after(async () => {
    try {
      await processPartnerNotices();
    } catch {}
  });
  revalidatePath("/partners/support");
  revalidatePath("/affiliates/support");
}
export async function partnerTicketReplyAction(f: FormData) {
  const p = await approvedProgramme();
  await rate("partner-ticket-reply:" + p.id, 40);
  const body = String(f.get("body") || "").trim();
  if (body.length < 1 || body.length > 5000) throw Error("Message required");
  await query(
    `WITH allowed AS(UPDATE partner_tickets SET status=CASE WHEN status='RESOLVED' THEN 'OPEN' ELSE status END,sensitive=sensitive OR $4,assigned_to=CASE WHEN $4 THEN NULL ELSE assigned_to END,updated_at=now() WHERE id=$1 AND partner_id=$2 AND status<>'CLOSED' RETURNING id) INSERT INTO partner_ticket_messages(ticket_id,actor_id,kind,body) SELECT id,$2,'PARTNER',$3 FROM allowed`,
    [String(f.get("id")), p.id, body, sensitive(body)],
  );
  after(async () => {
    try {
      await processPartnerNotices();
    } catch {}
  });
  revalidatePath("/partners/support");
  revalidatePath("/affiliates/support");
}
export async function staffPartnerTicketAction(f: FormData) {
  const a = await programmeSupportAgent();
  const id = String(f.get("id")),
    body = String(f.get("body") || "").trim(),
    status = String(f.get("status")),
    internal = f.get("internal") === "on";
  if (
    body.length < 1 ||
    body.length > 5000 ||
    ![
      "ASSIGNED",
      "IN_PROGRESS",
      "WAITING_FOR_PARTNER",
      "WAITING_FOR_CUSTOMER",
      "WAITING_FOR_PROVIDER",
      "RESOLVED",
      "CLOSED",
    ].includes(status)
  )
    throw Error("Response and status required");
  const result = await query(
    `WITH allowed AS(UPDATE partner_tickets SET assigned_to=$2,status=$3,updated_at=now() WHERE id=$1 AND($4 IN('owner','support') OR EXISTS(SELECT 1 FROM affiliates p WHERE p.id=partner_tickets.partner_id AND p.programme='affiliate')) AND($4='owner' OR(sensitive=false AND(assigned_to IS NULL OR assigned_to=$2))) RETURNING id),msg AS(INSERT INTO partner_ticket_messages(ticket_id,actor_id,kind,body) SELECT id,$2,CASE WHEN $5 THEN 'NOTE' ELSE 'STAFF' END,$6 FROM allowed RETURNING ticket_id) INSERT INTO partner_ticket_messages(ticket_id,actor_id,kind,body) SELECT ticket_id,$2,'EVENT',$3 FROM msg RETURNING id`,
    [id, a.id, status, a.role, internal, body],
  );
  if (!result.length)
    throw Error("Ticket requires the assigned agent or an owner");
  after(async () => {
    try {
      await processPartnerNotices();
    } catch {}
  });
  revalidatePath("/admin/partner-support");
}
