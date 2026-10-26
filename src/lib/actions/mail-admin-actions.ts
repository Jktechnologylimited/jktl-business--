"use server";
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
  settings.promotionsEnabled = f.get("promotionsEnabled") === "on";
  settings.supportPromotions = f.get("supportPromotions") === "on";
  settings.maxPromotions = Number(f.get("maxPromotions"));
  if (
    !Number.isInteger(settings.maxPromotions) ||
    Number(settings.maxPromotions) < 0 ||
    Number(settings.maxPromotions) > 3
  )
    throw Error("Choose 0–3 promotions");
  settings.socialLinks = ["facebook", "instagram", "linkedin"].flatMap(
    (label) => {
      const url = String(f.get(label) || "").trim();
      if (url && !httpsUrl(url)) throw Error("Use HTTPS social links");
      return url ? [{ label, url }] : [];
    },
  );
  const normalized = brandingSettings(settings);
  if (normalized.headerColor !== settings.headerColor)
    throw Error("Choose a dark header color with readable light text");
  const rows = await query(
    `WITH saved AS(UPDATE email_branding SET settings=$1::jsonb,revision=revision+1,updated_by=$2,updated_at=now() WHERE id=true AND revision=$3 RETURNING revision) INSERT INTO distribution_audit(actor_id,event,detail) SELECT $2,'EMAIL_BRANDING_SAVED',jsonb_build_object('revision',revision) FROM saved RETURNING id`,
    [JSON.stringify(normalized), a.id, Number(f.get("revision"))],
  );
  if (!rows.length) throw Error("This branding changed. Reload before saving.");
  revalidatePath("/admin/communications");
}
export async function saveMailPromotionAction(f: FormData) {
  const a = await requireAdminCapability("manage_communications");
  const title = String(f.get("title") || "").trim(),
    description = String(f.get("description") || "").trim(),
    url = httpsUrl(f.get("url"), true),
    product = String(f.get("productId")),
    categories = f.getAll("categories").map(String),
    priority = Number(f.get("priority"));
  if (
    !title ||
    title.length > 120 ||
    !description ||
    description.length > 500 ||
    !url ||
    ![
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
    priority < 0 ||
    priority > 1000 ||
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
  const start = date("startsAt"),
    end = date("endsAt");
  if (start && end && end <= start)
    throw Error("Expiration must follow the start date");
  const id = String(f.get("id") || "");
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
        `UPDATE email_promotions SET title=$1,description=$2,url=$3,product_id=$4,enabled=$5,priority=$6,starts_at=$7,ends_at=$8,categories=$9::text[],updated_by=$10,updated_at=now(),revision=revision+1 WHERE id=$11 AND revision=$12 RETURNING id`,
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
  revalidatePath("/admin/communications/promotions");
}
export async function previewMailAction(id: string) {
  await requireAdminCapability("manage_communications");
  const settings = (
    await query("SELECT settings FROM email_branding WHERE id=true")
  )[0];
  const branding = brandingSettings(settings?.settings);
  const rows = await query(
    "SELECT * FROM email_promotions ORDER BY priority,id",
  );
  const { sample, html, text } = previewBody(id);
  const promos: Promotion[] = rows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    description: String(r.description),
    url: String(r.url),
    productId: String(r.product_id),
    categories: r.categories as string[],
    priority: Number(r.priority),
    enabled: Boolean(r.enabled),
    startsAt: r.starts_at ? new Date(String(r.starts_at)).toISOString() : null,
    endsAt: r.ends_at ? new Date(String(r.ends_at)).toISOString() : null,
  }));
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
  };
}
export async function sendTestMailAction(id: string) {
  const a = await requireAdminCapability("manage_communications");
  await rate("mail-preview:" + a.id, 5);
  const sample = await previewMailAction(id);
  return sendMailPreview(a.email, sample, sample.title);
}
