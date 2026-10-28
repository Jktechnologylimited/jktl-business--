"use server";
import { listPromotions, promotionRows } from "@/lib/mail/promotions";
import {
  PROMOTION_CATEGORIES,
  DEFAULT_PROMOTIONS,
} from "@/lib/mail/promotion-defaults";
import {
  mailAddress,
  REPLY_CATEGORIES,
  verifiedSenders,
  deliveryHeaders,
} from "@/lib/mail/addresses";
import { requireAdminCapability } from "@/lib/admin-session";
import { query } from "@/lib/custom/service";
import {
  brandingSettings,
  MAIL_CATEGORIES,
  httpsUrl,
  selectPromotions,
  mailLayout,
  type Promotion,
} from "@/lib/mail/layout";
import { previewBody } from "@/lib/mail/preview";
import { rate } from "@/lib/support/service";
import { sendMailPreview } from "@/lib/email";
import { revalidatePath } from "next/cache";
export async function saveMailBrandingAction(f: FormData) {
  const a = await requireAdminCapability("manage_communications");
  const settings: Record<string, unknown> = {};
  for (const k of [
    "companyName",
    "logoUrl",
    "headerColor",
    "alignment",
    "signature",
    "supportEmail",
    "supportUrl",
    "phone",
    "postalAddress",
    "copyright",
  ]) {
    settings[k] = String(f.get(k) || "").trim();
    if (String(settings[k]).length > 2000) throw Error("Check " + k);
  }
  if (!httpsUrl(settings.logoUrl) || !httpsUrl(settings.supportUrl, true))
    throw Error("Use an HTTPS logo and JKTL support URL");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(settings.supportEmail)))
    throw Error("Check support email");
  const previous = brandingSettings(
    (await query("SELECT settings FROM email_branding WHERE id=true"))[0]
      ?.settings,
  );
  settings.promotionsEnabled = f.has("maxPromotions")
    ? f.get("promotionsEnabled") === "on"
    : previous.promotionsEnabled;
  settings.supportPromotions = f.has("maxPromotions")
    ? f.get("supportPromotions") === "on"
    : previous.supportPromotions;
  settings.maxPromotions = f.has("maxPromotions")
    ? Number(f.get("maxPromotions"))
    : previous.maxPromotions;
  if (
    !Number.isInteger(settings.maxPromotions) ||
    Number(settings.maxPromotions) < 0 ||
    Number(settings.maxPromotions) > 4
  )
    throw Error("Choose 0–4 promotions");
  settings.socialLinks = ["facebook", "instagram", "linkedin"].flatMap(
    (label) => {
      const url = String(f.get(label) || "").trim();
      if (url && !httpsUrl(url)) throw Error("Use HTTPS social links");
      return url ? [{ label, url }] : [];
    },
  );
  settings.senderDisplayName = String(f.get("senderDisplayName") || "").trim();
  settings.senderEmail = String(f.get("senderEmail") || "")
    .trim()
    .toLowerCase();
  if (
    String(settings.senderDisplayName).length > 100 ||
    /[<>\r\n\x00-\x1f\x7f]/.test(String(settings.senderDisplayName))
  )
    throw Error("Check sender display name");
  if (
    settings.senderEmail &&
    (!mailAddress(settings.senderEmail) ||
      !verifiedSenders().includes(String(settings.senderEmail)))
  )
    throw Error(
      "Choose a provider-verified sender configured in the secure sender allowlist",
    );
  const address = (name: string) => {
    const value = String(f.get(name) || "")
      .trim()
      .toLowerCase();
    if (value && !mailAddress(value))
      throw Error("Use one valid email address for " + name);
    return value;
  };
  settings.defaultReplyTo = address("defaultReplyTo");
  settings.categoryReplyTo = Object.fromEntries(
    REPLY_CATEGORIES.map((c) => [c, address("reply_" + c)]).filter(
      ([, v]) => v,
    ),
  );
  const extra = String(f.get("additionalReplyTo") || "")
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((v) => v.toLowerCase());
  if (extra.length > 20 || extra.some((v) => !mailAddress(v)))
    throw Error("Use valid verified reply mailboxes");
  const all = [
    ...new Set(
      [
        String(settings.defaultReplyTo),
        ...Object.values(settings.categoryReplyTo as Record<string, string>),
        ...extra,
      ].filter(Boolean),
    ),
  ];
  if (
    all.some((v) => !previous.verifiedReplyTo.includes(v)) &&
    f.get("mailboxesVerified") !== "on"
  )
    throw Error(
      "Verify that each new Reply-To mailbox exists and is authorized to receive JKTL replies before confirming it",
    );
  settings.verifiedReplyTo = all;
  settings.invitationHours = Number(f.get("invitationHours") || 48);
  if (
    !Number.isInteger(settings.invitationHours) ||
    Number(settings.invitationHours) < 1 ||
    Number(settings.invitationHours) > 168
  )
    throw Error("Choose an invitation expiry from 1 to 168 hours");
  const normalized = brandingSettings(settings);
  if (normalized.headerColor !== settings.headerColor)
    throw Error("Choose a dark header color with readable light text");
  const rows = await query(
    `WITH saved AS(UPDATE email_branding SET settings=$1::jsonb,revision=revision+1,updated_by=$2,updated_at=now() WHERE id=true AND revision=$3 RETURNING revision) INSERT INTO distribution_audit(actor_id,event,detail) SELECT $2,'EMAIL_BRANDING_SAVED',jsonb_build_object('revision',revision,'replyMailboxesVerified',true) FROM saved RETURNING id`,
    [
      JSON.stringify({
        ...normalized,
        invitationHours: settings.invitationHours,
      }),
      a.id,
      Number(f.get("revision")),
    ],
  );
  if (!rows.length) throw Error("This branding changed. Reload before saving.");
  revalidatePath("/admin/communications");
  revalidatePath("/admin/emails/branding");
}
export async function saveMailPromotionAction(f: FormData) {
  const a = await requireAdminCapability("manage_communications");
  await listPromotions(query);
  const id = String(f.get("id") || "");
  const previousPromotion = id
    ? (
        await query(
          "SELECT * FROM email_promotions WHERE id=$1 AND deleted_at IS NULL",
          [id],
        )
      )[0]
    : undefined;
  if (id && !previousPromotion)
    throw Error("Current promotion changed. Reload before saving.");
  const title = String(f.get("title") || "").trim(),
    description = String(f.get("description") || "").trim(),
    url = httpsUrl(f.get("url"), true),
    product = String(
      f.get("productId") ||
        DEFAULT_PROMOTIONS.find((p) => new URL(p.url).href === url)
          ?.productId ||
        "",
    ),
    categories = f.has("categories")
      ? f.getAll("categories").map(String)
      : (previousPromotion?.categories as string[]) || PROMOTION_CATEGORIES,
    priority = f.has("priority")
      ? Number(f.get("priority"))
      : previousPromotion
        ? Number(previousPromotion.priority)
        : Number(
            (
              await query(
                "SELECT COALESCE(min(priority),10)-10 priority FROM email_promotions WHERE deleted_at IS NULL",
              )
            )[0]?.priority || 10,
          );
  if (
    !title ||
    title.length > 120 ||
    !description ||
    description.length > 500 ||
    !url ||
    ![
      "",
      "jktl-business",
      "website-builder",
      "templates",
      "business-email",
      "domains",
      "plans",
      "partners",
      "affiliate-resources",
      "partner-support",
    ].includes(product) ||
    !Number.isInteger(priority) ||
    priority < -1000000 ||
    priority > 1000000 ||
    !categories.length ||
    categories.some(
      (c) =>
        !(MAIL_CATEGORIES as readonly string[]).includes(c) ||
        ["security", "internal"].includes(c),
    )
  )
    throw Error("Check promotion fields, JKTL destination and categories");
  const date = (k: string) => {
    const v = String(f.get(k) || "");
    if (!v) return null;
    const n = Date.parse(v.length === 16 ? v + ":00Z" : v);
    if (!Number.isFinite(n)) throw Error("Check " + k);
    return new Date(n).toISOString();
  };
  const start = f.has("startsAt")
      ? date("startsAt")
      : previousPromotion?.starts_at || null,
    end = f.has("endsAt") ? date("endsAt") : previousPromotion?.ends_at || null;
  if (start && end && end <= start)
    throw Error("Expiration must follow the start date");
  const values = [
    title,
    description,
    url,
    product,
    f.get("enabled") === "on",
    priority,
    start,
    end,
    categories,
    a.id,
  ];
  const rows = id
    ? await query(
        `UPDATE email_promotions SET title=$1,description=$2,url=$3,product_id=$4,enabled=$5,priority=$6,starts_at=$7,ends_at=$8,categories=$9::text[],updated_by=$10,updated_at=now(),revision=revision+1 WHERE id=$11 AND revision=$12 AND deleted_at IS NULL RETURNING id`,
        [...values, id, Number(f.get("revision"))],
      )
    : await query(
        `INSERT INTO email_promotions(title,description,url,product_id,enabled,priority,starts_at,ends_at,categories,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::text[],$10) RETURNING id`,
        values,
      );
  if (!rows.length)
    throw Error("This promotion changed. Reload before saving.");
  await query(
    "INSERT INTO distribution_audit(actor_id,event,detail) VALUES($1,'EMAIL_PROMOTION_SAVED',$2::jsonb)",
    [
      a.id,
      JSON.stringify({ promotion: rows[0].id, enabled: values[4], priority }),
    ],
  );
  revalidatePath("/admin/emails/branding");
}
export async function previewMailAction(id: string) {
  await requireAdminCapability("manage_communications");
  const settings = (
    await query("SELECT settings FROM email_branding WHERE id=true")
  )[0];
  const branding = brandingSettings(settings?.settings);
  const rows = await listPromotions(query);
  const { sample, html, text } = previewBody(id);
  const promos = promotionRows(rows);
  return {
    ...mailLayout({
      title: sample.title,
      bodyHtml: html,
      text,
      category: sample.category,
      branding,
      promotions: selectPromotions(promos, branding, sample.category, {
        consented: true,
        ownedProducts: sample.owned,
      }),
      preferencesUrl:
        sample.category === "security"
          ? undefined
          : "https://business.jktl.com.ng/business/email-preferences",
    }),
    title: sample.title,
    category: sample.category,
    replyTo: deliveryHeaders(branding, {
      replyCategory: ["affiliate", "partner", "support", "security"].includes(
        sample.category,
      )
        ? (sample.category as "affiliate" | "partner" | "support" | "security")
        : undefined,
    }).replyTo,
  };
}
export async function sendTestMailAction(id: string) {
  const a = await requireAdminCapability("manage_communications");
  await rate("mail-preview:" + a.id, 5);
  const sample = await previewMailAction(id);
  return sendMailPreview(a.email, sample, sample.title);
}

export async function footerManagerDataAction() {
  await requireAdminCapability("manage_communications");
  const rows = await listPromotions(query),
    row = (
      await query("SELECT settings,revision FROM email_branding WHERE id=true")
    )[0];
  return {
    items: promotionRows(rows).map((p, i) => ({
      ...p,
      revision: Number(rows[i].revision),
    })),
    branding: brandingSettings(row?.settings),
    revision: Number(row?.revision || 1),
  };
}
export async function saveFooterSettingsAction(f: FormData) {
  const a = await requireAdminCapability("manage_communications");
  await listPromotions(query);
  const count = Number(f.get("maxPromotions"));
  if (!Number.isInteger(count) || count < 0 || count > 4)
    throw Error("Choose 0–4 promotions.");
  const rows = await query(
    `WITH changed AS(UPDATE email_branding SET settings=jsonb_set(jsonb_set(settings,'{promotionsEnabled}',$1::jsonb),'{maxPromotions}',$2::jsonb),revision=revision+1,updated_by=$3,updated_at=now() WHERE id=true AND revision=$4 RETURNING revision)
 INSERT INTO distribution_audit(actor_id,event,detail) SELECT $3,'EMAIL_FOOTER_SETTINGS_SAVED',jsonb_build_object('revision',revision) FROM changed RETURNING id`,
    [
      JSON.stringify(f.get("enabled") === "on"),
      JSON.stringify(count),
      a.id,
      Number(f.get("revision")),
    ],
  );
  if (!rows.length)
    throw Error("Current footer settings changed. Reload before saving.");
  revalidatePath("/admin/emails/branding");
}
export async function deleteMailPromotionAction(f: FormData) {
  const a = await requireAdminCapability("manage_communications");
  if (f.get("confirm") !== "on")
    throw Error("Confirm deleting this promotion.");
  await listPromotions(query);
  const rows = await query(
    `WITH changed AS(UPDATE email_promotions SET deleted_at=now(),enabled=false,revision=revision+1,updated_by=$3,updated_at=now() WHERE id=$1 AND revision=$2 AND deleted_at IS NULL RETURNING id)
 INSERT INTO distribution_audit(actor_id,event,detail) SELECT $3,'EMAIL_PROMOTION_DELETED',jsonb_build_object('promotion',id) FROM changed RETURNING id`,
    [String(f.get("id")), Number(f.get("revision")), a.id],
  );
  if (!rows.length)
    throw Error("Current promotion changed. Reload before deleting.");
  revalidatePath("/admin/emails/branding");
}
export async function reorderMailPromotionAction(f: FormData) {
  const a = await requireAdminCapability("manage_communications");
  await listPromotions(query);
  const direction = String(f.get("direction"));
  if (!["UP", "DOWN"].includes(direction))
    throw Error("Choose an order direction.");
  const rows = await query(
    `WITH locked AS(SELECT id,priority,revision FROM email_promotions WHERE deleted_at IS NULL ORDER BY priority,id FOR UPDATE),ranked AS(SELECT *,row_number() OVER(ORDER BY priority,id)::int n FROM locked),target AS(SELECT n FROM ranked WHERE id=$1 AND revision=$2),changed AS(
 UPDATE email_promotions p SET priority=10*(CASE WHEN r.n=t.n THEN t.n+$3::int WHEN r.n=t.n+$3::int THEN t.n ELSE r.n END),revision=p.revision+1,updated_by=$4,updated_at=now() FROM ranked r CROSS JOIN target t WHERE p.id=r.id AND EXISTS(SELECT 1 FROM ranked WHERE n=t.n+$3::int) RETURNING p.id)
 INSERT INTO distribution_audit(actor_id,event,detail) SELECT $4,'EMAIL_PROMOTION_REORDERED',jsonb_build_object('promotion',$1::uuid,'direction',$3::int) WHERE EXISTS(SELECT 1 FROM changed) RETURNING id`,
    [
      String(f.get("id")),
      Number(f.get("revision")),
      direction === "UP" ? -1 : 1,
      a.id,
    ],
  );
  if (!rows.length)
    throw Error("Current order changed or the item is already at the edge.");
  revalidatePath("/admin/emails/branding");
}
/** Preview the complete shared layout with unsaved footer edits; never send or
 * activate an invitation. Saved settings are not changed by this action. */
export async function previewFooterDraftAction(raw: {
  sample: string;
  enabled: boolean;
  max: number;
  candidate?: {
    id: string;
    title: string;
    description: string;
    url: string;
    enabled: boolean;
  };
}) {
  await requireAdminCapability("manage_communications");
  if (
    !raw ||
    typeof raw.enabled !== "boolean" ||
    !Number.isInteger(raw.max) ||
    raw.max < 0 ||
    raw.max > 4
  )
    throw Error("Check footer preview settings.");
  const { branding, items } = await footerManagerDataAction();
  branding.promotionsEnabled = raw.enabled;
  branding.maxPromotions = raw.max;
  let previews: Promotion[] = items;
  if (raw.candidate) {
    const p = raw.candidate,
      url = httpsUrl(p.url, true);
    if (
      !p.title.trim() ||
      p.title.length > 120 ||
      !p.description.trim() ||
      p.description.length > 500 ||
      !url ||
      typeof p.enabled !== "boolean"
    )
      throw Error("Check the promotion title, description and HTTPS URL.");
    const existing = items.find((i) => i.id === p.id);
    const candidate: Promotion = {
      ...p,
      url,
      productId: "",
      priority: existing
        ? existing.priority
        : Math.min(10, ...items.map((i) => i.priority)) - 10,
      categories: PROMOTION_CATEGORIES,
    };
    previews = [...items.filter((i) => i.id !== p.id), candidate];
  }
  const { sample, html, text } = previewBody(raw.sample);
  return {
    ...mailLayout({
      title: sample.title,
      bodyHtml: html,
      text,
      category: sample.category,
      branding,
      promotions: selectPromotions(previews, branding, sample.category, {
        consented: true,
        ownedProducts: sample.owned,
      }),
      preferencesUrl: "https://business.jktl.com.ng/business/email-preferences",
    }),
    warning: !branding.postalAddress
      ? "Configure the genuine company postal address before live promotional sending. The sample does not invent an address."
      : "Sample assumes an eligible, opted-in recipient. Actual sends recheck preferences and relevance.",
  };
}

export async function setMailPromotionEnabledAction(f: FormData) {
  const a = await requireAdminCapability("manage_communications");
  await listPromotions(query);
  if (!["on", "off"].includes(String(f.get("enabled"))))
    throw Error("Choose enabled or disabled.");
  const rows = await query(
    `WITH changed AS(UPDATE email_promotions SET enabled=$3,revision=revision+1,updated_by=$4,updated_at=now() WHERE id=$1 AND revision=$2 AND deleted_at IS NULL RETURNING id)
 INSERT INTO distribution_audit(actor_id,event,detail) SELECT $4,'EMAIL_PROMOTION_SAVED',jsonb_build_object('promotion',id,'enabled',$3::boolean) FROM changed RETURNING id`,
    [
      String(f.get("id")),
      Number(f.get("revision")),
      f.get("enabled") === "on",
      a.id,
    ],
  );
  if (!rows.length)
    throw Error("Current promotion changed. Reload before saving.");
  revalidatePath("/admin/emails/branding");
}
