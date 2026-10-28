import {
  mailAddress,
  REPLY_CATEGORIES,
  type DeliverySettings,
} from "./addresses";
/** Canonical, provider-independent email renderer. Synced into connected apps. */
export const MAIL_CATEGORIES = [
  "security",
  "invitation",
  "onboarding",
  "website",
  "domain",
  "business_email",
  "payment",
  "subscription",
  "affiliate",
  "partner",
  "support",
  "internal",
  "service",
  "marketing",
] as const;
export type MailCategory = (typeof MAIL_CATEGORIES)[number];
export type Branding = DeliverySettings & {
  companyName: string;
  logoUrl: string;
  headerColor: string;
  alignment: "left" | "center";
  signature: string;
  supportEmail: string;
  supportUrl: string;
  phone: string;
  postalAddress: string;
  socialLinks: { label: string; url: string }[];
  promotionsEnabled: boolean;
  supportPromotions: boolean;
  maxPromotions: number;
  copyright: string;
};
export type Promotion = {
  id: string;
  title: string;
  description: string;
  url: string;
  productId: string;
  priority: number;
  categories: string[];
  enabled: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
};
export const DEFAULT_BRANDING: Branding = {
  senderDisplayName: "",
  senderEmail: "",
  defaultReplyTo: "",
  categoryReplyTo: {},
  verifiedReplyTo: [],
  companyName: "JK Technology Limited",
  logoUrl: "https://business.jktl.com.ng/jktl-logo.png",
  headerColor: "#060e2a",
  alignment: "left",
  signature: "The JKTL Team",
  supportEmail: "info@jktl.com.ng",
  supportUrl: "https://jktl.com.ng/contact",
  phone: "",
  postalAddress: "",
  socialLinks: [],
  promotionsEnabled: true,
  supportPromotions: false,
  maxPromotions: 3,
  copyright: "© {year} JK Technology Limited. All rights reserved.",
};
export function escapeHtml(v: unknown) {
  return String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function httpsUrl(value: unknown, companyOnly = false) {
  try {
    const u = new URL(String(value));
    if (u.protocol !== "https:" || u.username || u.password) return "";
    if (
      companyOnly &&
      u.hostname !== "jktl.com.ng" &&
      !u.hostname.endsWith(".jktl.com.ng")
    )
      return "";
    if (
      [...u.searchParams.keys()].some((k) =>
        /^(token|key|password|secret)$/i.test(k),
      )
    )
      return "";
    return u.href;
  } catch {
    return "";
  }
}
export function brandingSettings(raw: unknown): Branding {
  const s = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const b = { ...DEFAULT_BRANDING };
  for (const key of [
    "companyName",
    "signature",
    "supportEmail",
    "phone",
    "postalAddress",
    "copyright",
  ] as const) {
    if (typeof s[key] === "string")
      b[key] = String(s[key])
        .trim()
        .slice(0, key === "postalAddress" ? 500 : 300);
  }
  if (!b.companyName) b.companyName = DEFAULT_BRANDING.companyName;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.supportEmail))
    b.supportEmail = DEFAULT_BRANDING.supportEmail;
  b.logoUrl = httpsUrl(s.logoUrl) || b.logoUrl;
  b.supportUrl = httpsUrl(s.supportUrl, true) || b.supportUrl;
  b.alignment = s.alignment === "center" ? "center" : "left";
  if (
    typeof s.headerColor === "string" &&
    /^#[0-9a-f]{6}$/i.test(s.headerColor)
  ) {
    const rgb = s.headerColor
      .slice(1)
      .match(/../g)!
      .map((c) => parseInt(c, 16) / 255)
      .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    if (
      (0.815 + 0.05) /
        (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] + 0.05) >=
      4.5
    )
      b.headerColor = s.headerColor;
  }
  b.promotionsEnabled = s.promotionsEnabled !== false;
  b.supportPromotions = s.supportPromotions === true;
  b.maxPromotions = Number.isInteger(s.maxPromotions)
    ? Math.max(0, Math.min(4, Number(s.maxPromotions)))
    : 3;
  b.socialLinks = Array.isArray(s.socialLinks)
    ? s.socialLinks
        .slice(0, 5)
        .filter((x) => x && typeof x === "object" && httpsUrl(x.url))
        .map((x) => ({
          label: String(x.label || "Social").slice(0, 40),
          url: httpsUrl(x.url),
        }))
    : [];
  b.senderDisplayName =
    typeof s.senderDisplayName === "string" &&
    !/[<>\r\n\x00-\x1f\x7f]/.test(s.senderDisplayName)
      ? s.senderDisplayName.trim().slice(0, 100)
      : "";
  b.senderEmail = mailAddress(s.senderEmail);
  b.verifiedReplyTo = Array.isArray(s.verifiedReplyTo)
    ? [...new Set(s.verifiedReplyTo.map(mailAddress).filter(Boolean))].slice(
        0,
        30,
      )
    : [];
  b.defaultReplyTo = b.verifiedReplyTo.includes(mailAddress(s.defaultReplyTo))
    ? mailAddress(s.defaultReplyTo)
    : "";
  b.categoryReplyTo = {};
  const replies =
    s.categoryReplyTo && typeof s.categoryReplyTo === "object"
      ? (s.categoryReplyTo as Record<string, unknown>)
      : {};
  for (const category of REPLY_CATEGORIES) {
    const address = mailAddress(replies[category]);
    if (address && b.verifiedReplyTo.includes(address))
      b.categoryReplyTo[category] = address;
  }
  return b;
}
/** Shared service links accompany ordinary mail; this never opts a recipient
 * into standalone marketing campaigns. Security mail is always excluded. */
export function serviceDiscoveryCategory(category: MailCategory) {
  return category !== "security" && category !== "marketing";
}
export function selectPromotions(
  rows: Promotion[],
  b: Branding,
  category: MailCategory,
  options: {
    consented?: boolean;
    suppressed?: boolean;
    ownedProducts?: string[];
    now?: number;
    eligibleProducts?: string[];
  } = {},
) {
  if (
    category === "security" ||
    !b.promotionsEnabled ||
    options.suppressed ||
    (!serviceDiscoveryCategory(category) &&
      (!options.consented || !b.postalAddress))
  )
    return [];
  const now = options.now ?? Date.now(),
    seen = new Set<string>();
  return rows
    .filter(
      (p) =>
        p.enabled &&
        (serviceDiscoveryCategory(category) ||
          p.categories.includes(category)) &&
        httpsUrl(p.url, true) &&
        (!p.startsAt || Date.parse(p.startsAt) <= now) &&
        (!p.endsAt || Date.parse(p.endsAt) > now) &&
        (!p.productId || !options.ownedProducts?.includes(p.productId)) &&
        (!p.productId ||
          !options.eligibleProducts ||
          options.eligibleProducts.includes(p.productId)),
    )
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
    .filter((p) => {
      if (seen.has(p.url)) return false;
      seen.add(p.url);
      return true;
    })
    .slice(0, b.maxPromotions);
}
export function mailAction(label: string, url: string) {
  if (!/^https:\/\//i.test(url)) return "";
  return `<table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#c9a84c" style="border-radius:8px"><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 20px;color:#060e2a;text-decoration:none;font-weight:bold">${escapeHtml(label)}</a></td></tr></table>`;
}
export function mailLayout(input: {
  title: string;
  bodyHtml: string;
  text: string;
  category: MailCategory;
  branding?: Branding;
  promotions?: Promotion[];
  preferencesUrl?: string;
}) {
  const b = input.branding || DEFAULT_BRANDING,
    promos =
      input.category === "security" || !b.promotionsEnabled
        ? []
        : (input.promotions || []).slice(0, b.maxPromotions),
    e = escapeHtml;
  const copy = b.copyright.replaceAll(
    "{year}",
    new Date().getFullYear().toString(),
  );
  const promoHtml = promos.length
    ? `<tr><td bgcolor="#f5f0df" style="padding:22px 24px;border-top:1px solid #dfd5b8;font-size:14px;line-height:1.6"><h2 style="margin:0 0 14px;font-size:17px;color:#060e2a">Explore More from JKTL</h2>${promos.map((p) => `<p style="margin:0 0 16px"><a href="${e(p.url)}" style="color:#112055;font-weight:bold">${e(p.title)}</a><br><span style="color:#25304d">${e(p.description)}</span></p>`).join("")}</td></tr>`
    : "";
  const prefs =
    input.preferencesUrl && input.category !== "security"
      ? `<p><a href="${e(input.preferencesUrl)}" style="color:#112055">Email preferences / unsubscribe from marketing</a></p>`
      : "";
  return {
    html: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${e(input.title)}</title></head><body style="margin:0;padding:0;background:#eee9da;color:#060e2a;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#eee9da"><tr><td align="center" style="padding:20px 10px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;table-layout:fixed;background:#fffdf8;border:1px solid #dfd5b8;border-radius:12px;overflow:hidden"><tr><td bgcolor="${e(b.headerColor)}" style="padding:26px 24px;text-align:${b.alignment};color:#eee9da"><img src="${e(b.logoUrl)}" alt="JKTL logo" width="64" height="64" style="display:inline-block;border:0;max-width:64px;height:auto"><p style="font-size:18px;font-weight:bold;margin:12px 0 0;color:#eee9da">JKTL Business<br>${e(b.companyName)}</p></td></tr><tr><td bgcolor="#fffdf8" style="padding:28px 24px;font-size:16px;line-height:1.65;color:#060e2a;word-wrap:break-word;overflow-wrap:anywhere"><h1 style="font-size:24px;line-height:1.3;margin:0 0 20px;color:#060e2a">${e(input.title)}</h1>${input.bodyHtml}<p style="margin:26px 0 0;color:#060e2a">${e(b.signature)}</p></td></tr>${promoHtml}<tr><td bgcolor="#eee9da" style="padding:22px 24px;border-top:1px solid #dfd5b8;font-size:12px;line-height:1.7;color:#35405a"><strong>${e(b.companyName)}</strong>${b.postalAddress ? `<br>${e(b.postalAddress)}` : ""}<br><a style="color:#112055" href="mailto:${e(b.supportEmail)}">${e(b.supportEmail)}</a>${b.phone ? " · " + e(b.phone) : ""}<br><a style="color:#112055" href="${e(b.supportUrl)}">Contact JKTL support</a>${b.socialLinks.length && input.category !== "security" ? "<p>" + b.socialLinks.map((s) => `<a style="color:#112055" href="${e(s.url)}">${e(s.label)}</a>`).join(" · ") + "</p>" : ""}${prefs}<p style="margin-bottom:0">${e(copy)}</p></td></tr></table></td></tr></table></body></html>`,
    text: [
      b.companyName,
      input.title,
      input.text,
      b.signature,
      ...(promos.length
        ? [
            "Explore More from JKTL",
            ...promos.map(
              (p) => p.title + " — " + p.description + "\n" + p.url,
            ),
          ]
        : []),
      b.companyName,
      b.postalAddress,
      b.supportEmail,
      b.phone,
      b.supportUrl,
      ...(input.category === "security" || !b.promotionsEnabled
        ? []
        : b.socialLinks.map((s) => s.label + ": " + s.url)),
      ...(input.preferencesUrl && input.category !== "security"
        ? ["Email preferences / unsubscribe: " + input.preferencesUrl]
        : []),
      copy,
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}
