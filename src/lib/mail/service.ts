import "server-only";
import { listPromotions, promotionRows } from "./promotions";
import { deliveryHeaders, type ReplyCategory } from "./addresses";
import { query } from "@/lib/custom/service";
import {
  brandingSettings,
  DEFAULT_BRANDING,
  selectPromotions,
  serviceDiscoveryCategory,
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
    if (category !== "security") {
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
        !p.marketing_suppressed &&
        !legacySuppressed &&
        (serviceDiscoveryCategory(category) ||
          (p.marketing_opt_in && branding.postalAddress))
      ) {
        const rows = await listPromotions(query);
        promotions = selectPromotions(promotionRows(rows), branding, category, {
          consented: Boolean(p.marketing_opt_in),
          suppressed: Boolean(p.marketing_suppressed || legacySuppressed),
        });
      }
    }
  } catch {
    // Do not break essential mail, but never silently hide a catalogue/query failure.
    // No addresses, tokens, credentials or database errors enter application logs.
    console.error("[mail] Optional footer lookup failed", { category });
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
