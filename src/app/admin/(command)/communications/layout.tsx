import Link from "next/link";
import { guardAdminPage } from "@/lib/admin-page-guard";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  await guardAdminPage("manage_communications");
  return (
    <div className="space-y-6 text-ink">
      <h1 className="text-3xl font-semibold">Communications</h1>
      <nav className="flex flex-wrap gap-3" aria-label="Communications">
        <Link
          className="rounded border border-border p-3"
          href="/admin/communications"
        >
          Email Branding
        </Link>
        <Link
          className="rounded border border-border p-3"
          href="/admin/communications/promotions"
        >
          Email Promotions
        </Link>
        <Link
          className="rounded border border-border p-3"
          href="/admin/communications/preview"
        >
          Preview & Test
        </Link>
      </nav>
      {children}
    </div>
  );
}
