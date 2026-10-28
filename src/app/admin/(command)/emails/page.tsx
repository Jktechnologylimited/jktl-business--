import { guardAdminPage } from "@/lib/admin-page-guard";
import { requireAdminCapability } from "@/lib/admin-session";
import { can } from "@/lib/admin-permissions";
import { EMAIL_AUDIENCES } from "@/lib/mail/compose";
import { currentBranding } from "@/lib/mail/service";
import { ComposeEmail } from "@/components/mail/compose-email";
export const dynamic = "force-dynamic";
export default async function Page() {
  await guardAdminPage("compose_email");
  const a = await requireAdminCapability("compose_email"),
    branding = await currentBranding();
  const audiences = Object.fromEntries(
    Object.entries(EMAIL_AUDIENCES).filter(
      ([k]) =>
        can(a.role, "manage_communications", a.permissions) ||
        [
          "SELECTED",
          "AFFILIATES",
          "ACTIVE_AFFILIATES",
          "DORMANT_AFFILIATES",
          "PARTNERS",
          "APPROVED_PARTNERS",
        ].includes(k),
    ),
  );
  return (
    <ComposeEmail
      audiences={audiences}
      defaultReplyTo={branding.defaultReplyTo}
      approvedReplyTo={branding.verifiedReplyTo.filter(
        (v) =>
          can(a.role, "manage_communications", a.permissions) ||
          [
            branding.defaultReplyTo,
            branding.categoryReplyTo.affiliate,
            branding.categoryReplyTo.partner,
            branding.categoryReplyTo.support,
          ].includes(v),
      )}
    />
  );
}
