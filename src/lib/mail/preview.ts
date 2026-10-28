import { ROLE_LABEL } from "@/lib/admin-permissions";
import { mailAction, type MailCategory } from "./layout";
export const MAIL_PREVIEWS: Record<
  string,
  {
    title: string;
    category: MailCategory;
    body: string;
    action: string;
    url: string;
    owned: string[];
  }
> = {
  registration: {
    title: "Welcome to JKTL Business",
    category: "onboarding",
    body: "Hello Preview Customer, your sample business workspace is ready to explore.",
    action: "Open JKTL Business",
    url: "https://business.jktl.com.ng/business",
    owned: [],
  },
  website: {
    title: "Your website is published",
    category: "website",
    body: "Your sample website has been published through JKTL Business. Manage your content and review your contact details.",
    action: "Manage your website",
    url: "https://business.jktl.com.ng/business/website",
    owned: ["website-builder", "templates"],
  },
  domain: {
    title: "Domain order update",
    category: "domain",
    body: "Sample domain: example.com.ng. Sample status: awaiting provisioning. Payment does not itself confirm registration.",
    action: "View My Domains",
    url: "https://business.jktl.com.ng/business/domains",
    owned: ["domains"],
  },
  email: {
    title: "Business Email service update",
    category: "business_email",
    body: "Sample service status: ACTIVE. This preview does not provision any mailboxes.",
    action: "Manage Business Email",
    url: "https://business.jktl.com.ng/business/email",
    owned: ["business-email"],
  },
  payment: {
    title: "Payment confirmation",
    category: "payment",
    body: "Sample receipt: NGN 5,000.00. Reference: PREVIEW-ONLY. No payment was made.",
    action: "View your workspace",
    url: "https://business.jktl.com.ng/business",
    owned: [],
  },
  affiliate: {
    title: "Affiliate application approved",
    category: "affiliate",
    body: "Sample approved application. Your own accepted agreement determines eligible earnings; this preview does not activate rates.",
    action: "Open Affiliate resources",
    url: "https://business.jktl.com.ng/affiliates/resources",
    owned: ["partners"],
  },
  partner: {
    title: "Partner application approved",
    category: "partner",
    body: "Sample approved Partner. Invite owners to claim client workspaces and choose their permissions.",
    action: "Open Partner workspace",
    url: "https://business.jktl.com.ng/partners/workspace",
    owned: ["partners"],
  },
  support: {
    title: "JKTL Partner support reply",
    category: "support",
    body: "Ticket PREVIEW-001: Website setup. JKTL Support Team: Please review your contact details before publishing. Internal notes are excluded.",
    action: "Open Partner support",
    url: "https://business.jktl.com.ng/partners/support",
    owned: ["partners"],
  },
  renewal: {
    title: "Subscription renewal reminder",
    category: "subscription",
    body: "Sample subscription reminder. Review current terms in your workspace; this message does not charge your account.",
    action: "Review subscription",
    url: "https://business.jktl.com.ng/business",
    owned: ["plans"],
  },
  security: {
    title: "Reset your JKTL password",
    category: "security",
    body: "This is a security email preview. No reset token or credential is included.",
    action: "Open sign-in",
    url: "https://business.jktl.com.ng/login",
    owned: [],
  },
};
for (const [role, label] of Object.entries({
  ...ROLE_LABEL,
  affiliate: "Affiliate",
  partner: "Partner",
}))
  MAIL_PREVIEWS["invite-" + role] = {
    title: "Invitation: " + label,
    category: "security",
    body:
      "Hello Preview Recipient. You are invited to join JKTL as " +
      label +
      ". This is a sample only; no role, account or invitation has been created. Live invitations contain a single-use link and exact expiry.",
    action: "Open sign-in",
    url: "https://business.jktl.com.ng/admin/login",
    owned: [],
  };
export function previewBody(id: string) {
  const sample = MAIL_PREVIEWS[id];
  if (!sample) throw Error("Choose a preview");
  return {
    sample,
    html:
      "<p><strong>TEST PREVIEW ONLY — no account, service or payment was changed.</strong></p><p>" +
      sample.body +
      "</p>" +
      mailAction(sample.action, sample.url),
    text:
      "TEST PREVIEW ONLY — no account, service or payment was changed.\n\n" +
      sample.body +
      "\n\n" +
      sample.url,
  };
}
