import { redirect } from "next/navigation";
import { Handshake, LogOut } from "lucide-react";
import { JktlMark } from "@/components/app/logo";
import { AffiliateNav } from "@/components/affiliates/affiliate-nav";
import { getAffiliateSession } from "@/lib/affiliate-session";
import { affiliateLogoutAction } from "@/lib/actions/affiliate-actions";

/**
 * Guards everything under `/affiliates` except `/affiliates/login` (a
 * sibling route outside this `(dashboard)` group). Same shape as the admin
 * layout — a plain server-side redirect, no client store, no offline or
 * demo mode: this only ever talks to the real database.
 */
export default async function AffiliateLayout({ children }: { children: React.ReactNode }) {
  const affiliate = await getAffiliateSession();
  if (!affiliate) redirect("/affiliates/login");

  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-5">
          <div className="flex items-center gap-2.5">
            <JktlMark className="size-7" />
            <div className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink">
              <Handshake className="size-4 text-primary" /> Affiliate portal
            </div>
          </div>
          <div className="flex items-center gap-3">
            <AffiliateNav />
            <span className="hidden text-sm text-ink-muted sm:inline">{affiliate.name}</span>
            <form action={affiliateLogoutAction}>
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
      <main className="mx-auto max-w-3xl px-5 py-6">{children}</main>
    </div>
  );
}
