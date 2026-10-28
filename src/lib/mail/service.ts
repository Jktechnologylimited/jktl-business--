import "server-only";
import { deliveryHeaders, type ReplyCategory } from "./addresses";
import { query } from "@/lib/custom/service";
import {
  brandingSettings,
  DEFAULT_BRANDING,
  selectPromotions,
  mailLayout,
  type Promotion,
  type MailCategory,
} from "./layout";
export type MailContext = {
  category?: MailCategory;
  replyCategory?: ReplyCategory;
  replyTo?: string;
  suppressPromotions?: boolean;
  ownedProducts?: string[];
  outreachAuthorized?: boolean;
  unsubscribeUrl?: string;
};
export async function currentBranding() {
  try {
    return brandingSettings(
      (await query("SELECT settings FROM email_branding WHERE id=true"))[0]
        ?.settings,
    );
  } catch {
    return { ...DEFAULT_BRANDING };
  }
}
export async function brandEmail(
  to: string,
  title: string,
  bodyHtml: string,
  text: string,
  ctx: MailContext = {},
) {
  const category = ctx.category || "service",
    branding = await currentBranding();
  let promotions: Promotion[] = [],
    preferencesUrl: string | undefined;
  let permitted = true;
  try {
    if (category !== "security" && category !== "internal") {
      const p = (
        await query(
          `INSERT INTO email_preferences(email) VALUES(lower($1)) ON CONFLICT(email) DO UPDATE SET email=excluded.email RETURNING marketing_opt_in,marketing_suppressed,preference_token`,
          [to],
        )
      )[0];
      preferencesUrl =
        "https://business.jktl.com.ng/email-preferences?token=" +
        p.preference_token;
      const legacySuppressed =
        (
          await query(
            "SELECT 1 FROM prospects WHERE lower(email)=lower($1) AND(suppressed=true OR status='suppressed') LIMIT 1",
            [to],
          )
        ).length > 0;
      if (category === "marketing")
        permitted =
          !p.marketing_suppressed &&
          !legacySuppressed &&
          Boolean(p.marketing_opt_in || ctx.outreachAuthorized) &&
          Boolean(branding.postalAddress);
      if (
        !ctx.suppressPromotions &&
        p.marketing_opt_in &&
        !p.marketing_suppressed &&
        !legacySuppressed &&
        branding.postalAddress
      ) {
        const rows = await query(
          "SELECT * FROM email_promotions WHERE enabled=true ORDER BY priority,id",
        );
        const ownership = (
          await query(
            `SELECT bool_or(b.published) website,bool_or(EXISTS(SELECT 1 FROM domain_assets d WHERE d.organization_id=m.organization_id)) domains,bool_or(EXISTS(SELECT 1 FROM email_services e WHERE e.organization_id=m.organization_id AND e.status<>'CANCELLED')) email,bool_or(EXISTS(SELECT 1 FROM website_plan_subscriptions s WHERE s.organization_id=m.organization_id AND s.status='active')) plan FROM organization_members m LEFT JOIN business_profiles b ON b.organization_id=m.organization_id WHERE lower(m.email)=lower($1) AND m.active=true`,
            [to],
          )
        )[0];
        const owned = [
          ...(ctx.ownedProducts || []),
          ...(ownership?.website ? ["website-builder", "templates"] : []),
          ...(ownership?.domains ? ["domains"] : []),
          ...(ownership?.email ? ["business-email"] : []),
          ...(ownership?.plan ? ["plans"] : []),
        ];
        const eligible = ["website-builder", "templates", "plans", "partners"];
        const profiles = await query(
          "SELECT programme FROM affiliates WHERE lower(email)=lower($1) AND status='active'",
          [to],
        );
        if (profiles.some((p) => p.programme === "affiliate"))
          eligible.push("affiliate-resources");
        if (profiles.some((p) => p.programme === "partner")) {
          eligible.push("partner-support");
          owned.push("partners");
        }
        if (
          (
            await query(
              "SELECT 1 FROM domain_prices WHERE enabled=true AND registration_price>0 LIMIT 1",
            )
          ).length
        )
          eligible.push("domains");
        if (
          (
            await query(
              "SELECT 1 FROM email_plans WHERE enabled=true AND publicly_available=true LIMIT 1",
            )
          ).length
        )
          eligible.push("business-email");
        promotions = selectPromotions(
          rows.map((r) => ({
            id: String(r.id),
            title: String(r.title),
            description: String(r.description),
            url: String(r.url),
            productId: String(r.product_id),
            priority: Number(r.priority),
            categories: r.categories as string[],
            enabled: Boolean(r.enabled),
            startsAt: r.starts_at
              ? new Date(String(r.starts_at)).toISOString()
              : null,
            endsAt: r.ends_at
              ? new Date(String(r.ends_at)).toISOString()
              : null,
          })),
          branding,
          category,
          { consented: true, ownedProducts: owned, eligibleProducts: eligible },
        );
      }
    }
  } catch {
    promotions = [];
    if (category === "marketing") permitted = false;
  }
  return {
    ...mailLayout({
      title,
      bodyHtml,
      text,
      category,
      branding,
      promotions,
      preferencesUrl,
    }),
    permitted,
    delivery: deliveryHeaders(branding, {
      replyTo: ctx.replyTo,
      replyCategory:
        ctx.replyCategory ||
        (category === "affiliate" ||
        category === "partner" ||
        category === "support" ||
        category === "security"
          ? category
          : undefined),
    }),
    preferencesUrl,
  };
}
