import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, LogOut } from "lucide-react";
import { JktlMark } from "@/components/app/logo";
import { getAdminSession } from "@/lib/admin-session";
import { ROLE_LABEL, navFor } from "@/lib/admin-permissions";
import { isSchemaOutOfDateError, SCHEMA_OUT_OF_DATE_MESSAGE } from "@/lib/db/client";
import { adminLogoutAction } from "@/lib/actions/admin-actions";

/**
 * Guards everything under `/admin` except `/admin/login` (a sibling route
 * outside this `(command)` group, so it never passes through here). A
 * plain server-side redirect — no client store, no offline mode, no demo
 * mode: the command center only ever talks to the real database, so there
 * is nothing for it to do while signed out except send you to sign in.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // A missing column means the database is behind, not that the user is wrong.
  // Saying so once, in the UI, saves an hour of reading a terminal — and the
  // error is otherwise only visible in the server log.
  const session = await getAdminSession()
    .then((admin) => ({ admin, schemaStale: false }))
    .catch((err) => {
      if (isSchemaOutOfDateError(err)) return { admin: null, schemaStale: true };
      throw err;
    });
  const { schemaStale } = session;
  const admin = session.admin;
  if (!admin && !schemaStale) redirect("/admin/login");

  // The navigation is built from what this role may actually do, so an affiliate
  // manager never sees a link to a page that would redirect them back. The pages
  // themselves enforce it too — hiding a link is a courtesy, not a control.
  // Narrowed explicitly: the only way `admin` is null here is the stale-schema
  // branch, which returned above.
  if (!admin) redirect("/admin/login");
  const nav = navFor(admin.role);

  if (schemaStale) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
        <div className="rounded-2xl border border-danger/30 bg-danger-soft p-5">
          <h1 className="font-display text-base font-semibold text-ink">The database needs migrating</h1>
          <p className="mt-2 text-sm text-ink-muted">{SCHEMA_OUT_OF_DATE_MESSAGE}</p>
          <p className="mt-2 text-xs text-ink-faint">
            Recent deployments added migrations 026–028 (outreach sequences, admin roles, existing clients). Signing in
            will work once they have run.
          </p>
        </div>
      </div>
    );
  }

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
            <span className="hidden text-sm text-ink-muted sm:inline">
              {admin.name} · {ROLE_LABEL[admin.role]}
            </span>
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
        <div className="mx-auto flex max-w-6xl gap-4 overflow-x-auto px-5 text-sm font-medium">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap border-b-2 border-transparent py-3 text-ink-muted hover:border-border-strong hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
      <main className="mx-auto max-w-6xl px-5 py-6">{children}</main>
    </div>
  );
}
