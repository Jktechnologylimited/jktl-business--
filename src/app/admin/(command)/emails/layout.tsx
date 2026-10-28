import Link from "next/link";
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
    <div className="space-y-6 text-ink">
      <h1 className="text-3xl font-semibold">Emails</h1>
      <nav className="flex flex-wrap gap-3" aria-label="Email sections">
        {[
          ["Compose Email", "/admin/emails"],
          ["Invite User", "/admin/emails/invite"],
          ["Email History", "/admin/emails/history"],
          ...(can(a.role, "manage_communications", a.permissions)
            ? [["Email Branding", "/admin/emails/branding"]]
            : []),
        ].map(([label, url]) => (
          <Link
            key={url}
            href={url}
            className="rounded-lg border border-border p-3"
          >
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
