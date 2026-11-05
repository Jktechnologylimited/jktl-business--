"use server";
import { after } from "next/server";
import { requireAdminCapability } from "@/lib/admin-session";
import { query } from "@/lib/custom/service";
import { rate } from "@/lib/support/service";
import {
  composeBody,
  mailRecipients,
  authorizeEmailAudience,
  authorizeComposeReplyTo,
} from "@/lib/mail/compose";
import { currentBranding } from "@/lib/mail/service";
import { deliveryHeaders } from "@/lib/mail/addresses";
import { mailLayout } from "@/lib/mail/layout";
import { flushProgramNotices } from "@/lib/distribution/notifications";
export async function previewComposedEmailAction(raw: {
  audience: string;
  selected: string;
  subject: string;
  body: string;
  replyTo: string;
  kind: "marketing" | "operational";
}) {
  const a = await requireAdminCapability("compose_email");
  await rate("email-compose:" + a.id, 10);
  if (
    !raw ||
    !["marketing", "operational"].includes(raw.kind) ||
    typeof raw.subject !== "string" ||
    raw.subject.trim().length < 3 ||
    raw.subject.length > 160 ||
    /[\r\n\x00-\x1f\x7f]/.test(raw.subject) ||
    typeof raw.selected !== "string" ||
    raw.selected.length > 20000
  )
    throw Error("Check the message, subject and recipients.");
  const selected = [
    ...new Set(
      raw.selected
        .split(/[\s,]+/)
        .filter(Boolean)
        .map((s) => s.toLowerCase()),
    ),
  ];
  const recipients = await mailRecipients(
    query,
    a.role,
    raw.audience,
    selected,
    undefined,
    raw.kind,
  );
  if (!recipients.length)
    throw Error(
      "No eligible recipients match this audience and its email preferences.",
    );
  const body = composeBody(raw.body),
    branding = await currentBranding(),
    delivery = deliveryHeaders(branding, {
      replyTo: raw.replyTo?.trim().toLowerCase() || undefined,
    });
  authorizeComposeReplyTo(a.role, branding, delivery.replyTo || "");
  const draft = (
    await query(
      "INSERT INTO affiliate_campaigns(subject,body,audience,recipients,created_by,message_kind,reply_to,interface) VALUES($1,$2,$3,$4::jsonb,$5,$6,$7,'emails') RETURNING id",
      [
        raw.subject.trim(),
        raw.body,
        raw.audience,
        JSON.stringify(recipients),
        a.id,
        raw.kind,
        delivery.replyTo || "",
      ],
    )
  )[0];
  return {
    id: String(draft.id),
    count: recipients.length,
    replyTo: delivery.replyTo || "",
    ...mailLayout({
      title: raw.subject.trim(),
      bodyHtml: body.html,
      text: body.text,
      category: raw.kind === "marketing" ? "marketing" : "service",
      branding,
      promotions: [],
    }),
  };
}
export async function sendComposedEmailAction(raw: {
  id: string;
  count: number;
  confirmed: boolean;
  operationalConfirmed: boolean;
}) {
  const a = await requireAdminCapability("compose_email");
  await rate("email-confirm:" + a.id, 5);
  if (
    raw?.confirmed !== true ||
    !Number.isInteger(raw.count) ||
    raw.count < 1 ||
    raw.count > 500 ||
    !/^[a-f0-9-]{36}$/i.test(raw.id)
  )
    throw Error("Confirm the exact unique recipient count.");
  const draft = (
    await query(
      "SELECT * FROM affiliate_campaigns WHERE id=$1 AND created_by=$2 AND interface='emails' AND status='DRAFT'",
      [raw.id, a.id],
    )
  )[0];
  if (!draft) throw Error("This draft changed or is outside your permissions.");
  authorizeEmailAudience(a.role, String(draft.audience));
  const selected = draft.recipients as string[];
  const current = await mailRecipients(
    query,
    a.role,
    String(draft.audience),
    selected,
    undefined,
    draft.message_kind as "marketing" | "operational",
  );
  // Intersect the original snapshot: new group members never get silently added.
  const recipients = current.filter((v) => selected.includes(v));
  if (recipients.length !== raw.count || selected.length !== raw.count)
    throw Error("Recipient eligibility changed. Preview the message again.");
  if (draft.message_kind === "operational" && raw.operationalConfirmed !== true)
    throw Error(
      "Confirm the main message is necessary operational information, not a marketing campaign.",
    );
  const branding = await currentBranding();
  authorizeComposeReplyTo(a.role, branding, String(draft.reply_to || ""));
  deliveryHeaders(branding, { replyTo: String(draft.reply_to || "") });
  if (draft.message_kind === "marketing" && !branding.postalAddress)
    throw Error(
      "Configure the genuine company postal address before promotional email.",
    );
  const rows = await query(
    `WITH confirmed AS(UPDATE affiliate_campaigns SET status='QUEUED',confirmed_by=$2,confirmed_at=now() WHERE id=$1 AND created_by=$2 AND interface='emails' AND status='DRAFT' RETURNING *),
 queued AS(INSERT INTO distribution_program_notices(event_key,recipient_email,subject,detail,path,category,push_delivered_at,composed_id,reply_to)
 SELECT 'composed-'||c.id::text||'-'||md5(email),email,c.subject,c.body,'/business',CASE WHEN c.message_kind='marketing' THEN 'marketing' ELSE 'service' END,now(),c.id,c.reply_to FROM confirmed c CROSS JOIN LATERAL jsonb_array_elements_text(c.recipients) email ON CONFLICT DO NOTHING RETURNING id)
 INSERT INTO distribution_audit(actor_id,event,detail) SELECT $2,'EMAIL_COMPOSE_QUEUED',jsonb_build_object('message',id,'recipientCount',$3::int) FROM confirmed RETURNING id`,
    [draft.id, a.id, recipients.length],
  );
  if (!rows.length)
    throw Error("This message was already queued. Do not send it again.");
  after(async () => {
    try {
      await flushProgramNotices({
        composedId: String(draft.id),
        limit: Math.min(50, recipients.length),
      });
    } catch {
      /* existing cron retries queued entries */
    }
  });
  return { ok: true as const };
}
export async function retryComposedEmailAction(id: string) {
  const a = await requireAdminCapability("compose_email");
  await rate("email-retry:" + a.id, 5);
  const campaign = (
    await query(
      "SELECT * FROM affiliate_campaigns WHERE id=$1 AND created_by=$2 AND interface='emails'",
      [id, a.id],
    )
  )[0];
  if (!campaign) throw Error("Message unavailable.");
  authorizeEmailAudience(a.role, String(campaign.audience));
  await query(
    "UPDATE distribution_program_notices SET send_state='QUEUED',lease_until=NULL,last_error=NULL WHERE composed_id=$1 AND send_state='FAILED' AND delivered_at IS NULL AND provider_message_id IS NULL AND suppressed_at IS NULL AND attempts<10",
    [id],
  );
  after(async () => {
    try {
      await flushProgramNotices({ composedId: id, limit: 50 });
    } catch {}
  });
  return { ok: true as const };
}

export async function retryComposedEmailFormAction(f: FormData) {
  if (f.get("confirm") !== "on")
    throw Error("Confirm the eligible failed recipients before retrying.");
  return retryComposedEmailAction(String(f.get("id") || ""));
}

/** Read-only account audience review; creates no drafts, notices or consent records. */
export async function reviewBusinessEmailAudienceAction(input: {
  audience: string;
  kind: "marketing" | "operational";
  selected: string;
}) {
  const a = await requireAdminCapability("manage_communications");
  await rate("business-email-review:" + a.id, 120);
  const { BUSINESS_EMAIL_AUDIENCES } =
    await import("@/lib/mail/business-outreach");
  if (
    !input ||
    !Object.hasOwn(BUSINESS_EMAIL_AUDIENCES, input.audience) ||
    !["marketing", "operational"].includes(input.kind) ||
    typeof input.selected !== "string" ||
    input.selected.length > 20000
  )
    throw Error("Choose a business audience and message type.");
  const selected = [
    ...new Set(
      input.selected
        .split(/[\s,]+/)
        .filter(Boolean)
        .map((v) => v.toLowerCase()),
    ),
  ];
  const group =
    input.audience === "SELECTED_BUSINESSES"
      ? "BUSINESS_ACCOUNTS"
      : input.audience;
  const candidates = await mailRecipients(
    query,
    a.role,
    group,
    [],
    undefined,
    "operational",
  );
  const eligible =
    input.audience === "SELECTED_BUSINESSES" && !selected.length
      ? []
      : await mailRecipients(
          query,
          a.role,
          input.audience,
          selected,
          undefined,
          input.kind,
        );
  const contacts = candidates.length
    ? await query(
        `SELECT lower(u.email) AS email,max(u.name) AS name,min(u.created_at) AS joined_at,array_agg(DISTINCT o.name) AS business_names,array_agg(DISTINCT CASE WHEN b.published=true THEN b.subdomain ELSE NULL END) FILTER(WHERE b.published=true) AS published_subdomains,bool_or(b.published=true AND b.subdomain<>'' AND COALESCE(trim(b.custom_domain),'')='') AS free_subdomain,COALESCE(p.marketing_opt_in,false) AS marketing_opt_in,COALESCE(p.marketing_suppressed,false) AS marketing_suppressed,bool_or(COALESCE(x.suppressed,false) OR COALESCE(x.status='suppressed',false)) AS legacy_suppressed FROM users u JOIN organization_members m ON m.user_id=u.id AND m.active=true AND m.role='owner' JOIN organizations o ON o.id=m.organization_id LEFT JOIN business_profiles b ON b.organization_id=o.id LEFT JOIN email_preferences p ON p.email=lower(u.email) LEFT JOIN prospects x ON lower(x.email)=lower(u.email) WHERE lower(u.email)=ANY($1::text[]) GROUP BY lower(u.email),p.marketing_opt_in,p.marketing_suppressed ORDER BY email`,
        [candidates],
      )
    : [];
  const branding = await currentBranding();
  return {
    matched: candidates.length,
    eligible: eligible.length,
    contacts: contacts.map(
      (c): Record<string, unknown> & { eligible: boolean } => ({
        ...c,
        eligible: eligible.includes(String(c.email)),
      }),
    ),
    hasPostalAddress: Boolean(branding.postalAddress),
    replyTo: branding.defaultReplyTo,
  };
}
