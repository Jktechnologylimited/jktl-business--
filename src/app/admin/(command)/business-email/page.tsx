import { guardAdminPage } from "@/lib/admin-page-guard";
import { adminEmailAction } from "@/lib/actions/business-email-actions";
import { EmailAdmin } from "@/components/business-email/email-admin";
export const dynamic = "force-dynamic";
export default async function Page() {
  await guardAdminPage("manage_email");
  const r = await adminEmailAction();
  return r.ok ? (
    <EmailAdmin initial={r.data} />
  ) : (
    <p>
      Business Email management is unavailable. Check database migration 036.
    </p>
  );
}
