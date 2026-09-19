import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, LogOut } from "lucide-react";
import { JktlMark } from "@/components/app/logo";
import { getAdminSession } from "@/lib/admin-session";
import { adminLogoutAction } from "@/lib/actions/admin-actions";

/**
 * Guards everything under `/admin` except `/admin/login` (a sibling route
 * outside this `(command)` group, so it never passes through here). A
 * plain server-side redirect — no client store, no offline mode, no demo
 * mode: the command center only ever talks to the real database, so there
 * is nothing for it to do while signed out except send you to sign in.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin/login");

  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-5">
          <div className="flex items-center gap-2.5">
            <JktlMark className="size-7" />
            <div className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink">
              <ShieldCheck className="size-4 text-primary" /> Command center
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-ink-muted sm:inline">{admin.name}</span>
            <form action={adminLogoutAction}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface-strong hover:text-ink"
              >
                <LogOut className="size-4" /> Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <nav className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl gap-4 px-5 text-sm font-medium">
          <Link href="/admin" className="border-b-2 border-transparent py-3 text-ink-muted hover:border-border-strong hover:text-ink">
            Businesses
          </Link>
          <Link href="/admin/broadcasts" className="border-b-2 border-transparent py-3 text-ink-muted hover:border-border-strong hover:text-ink">
            Broadcasts
          </Link>
        </div>
      </nav>
      <main className="mx-auto max-w-6xl px-5 py-6">{children}</main>
    </div>
  );
}
