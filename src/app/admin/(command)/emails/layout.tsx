import { SectionNav } from "@/components/admin/section-nav";
import { guardAdminPage } from "@/lib/admin-page-guard";
import { requireAdminSession } from "@/lib/admin-session";
import { can } from "@/lib/admin-permissions";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  await guardAdminPage("compose_email");
  const a = await requireAdminSession();
  return (
    <div className="space-y-4 text-ink">
      <h1 className="text-2xl font-semibold">Emails</h1>
      <SectionNav label="Email sections" items={[
          ["Compose Email", "/admin/emails"],
          ["Invite User", "/admin/emails/invite"],
          ["Email History", "/admin/emails/history"],
          ...(can(a.role, "manage_communications", a.permissions)
            ? [
                ["Account Journey", "/admin/emails/automation"],
                ["Renewals & Reminders", "/admin/emails/renewals"],
              ]
            : []),
          ...(can(a.role, "manage_communications", a.permissions)
            ? [["Email Branding", "/admin/emails/branding"]]
            : []),
        ].map(([label, href]) => ({ label, href }))} />
      {children}
    </div>
  );
}
