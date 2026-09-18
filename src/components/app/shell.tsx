"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Banknote, CalendarClock, House, LayoutGrid, LogOut, RefreshCw, Settings, Users, WifiOff } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { JktlMark } from "./logo";
import { Avatar } from "./avatar";
import { useBusinessStore, useCurrentIndustry } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { NavIcon } from "@/lib/industry";

const NAV_ICONS: Record<NavIcon, LucideIcon> = {
  home: House,
  bookings: CalendarClock,
  customers: Users,
  sales: Banknote,
  more: LayoutGrid,
};

function isActive(pathname: string, href: string, moreHrefs: string[]) {
  if (href === "/business") return pathname === "/business";
  if (href === "/business/more") return moreHrefs.some((h) => pathname === h || pathname.startsWith(`${h}/`));
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const industry = useCurrentIndustry();
  const profile = useBusinessStore((s) => s.data.profile);
  const user = useBusinessStore((s) => s.data.user);
  const online = useBusinessStore((s) => s.online);
  const mode = useBusinessStore((s) => s.mode);
  const pendingSyncCount = useBusinessStore((s) => s.pendingSyncCount);
  const logout = useBusinessStore((s) => s.logout);

  const moreHrefs = industry.nav.more.map((m) => m.href);

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <div className="min-h-dvh bg-paper lg:pl-60">
      {!online ? (
        <div className="flex items-center justify-center gap-2 bg-ink px-4 py-2 text-center text-xs font-medium text-white">
          <WifiOff className="size-3.5" />
          {mode === "live" && pendingSyncCount > 0
            ? `You're offline — ${pendingSyncCount} change${pendingSyncCount > 1 ? "s" : ""} waiting to sync.`
            : "You're offline — you can still browse. Changes will wait until you're back."}
        </div>
      ) : mode === "live" && pendingSyncCount > 0 ? (
        <div className="flex items-center justify-center gap-2 bg-accent px-4 py-2 text-center text-xs font-medium text-white">
          <RefreshCw className="size-3.5 animate-spin" />
          {`Syncing ${pendingSyncCount} change${pendingSyncCount > 1 ? "s" : ""}…`}
        </div>
      ) : null}

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-paper lg:flex print:hidden">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <JktlMark className="size-9" />
          <div className="min-w-0">
            <div className="truncate font-display text-[15px] font-semibold tracking-tight text-ink">
              {profile.displayName}
            </div>
            <div className="text-[11px] font-medium text-ink-muted">{industry.productName}</div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-4">
          {industry.nav.primary
            .filter((item) => item.icon !== "more")
            .map((item) => {
              const Icon = NAV_ICONS[item.icon];
              const active = isActive(pathname, item.href, moreHrefs);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-medium",
                    active ? "bg-primary-soft text-primary-strong" : "text-ink-muted hover:bg-surface hover:text-ink",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          <div className="mx-2 my-3 h-px bg-border" />
          {industry.nav.more.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-medium",
                  active ? "bg-primary-soft text-primary-strong" : "text-ink-muted hover:bg-surface hover:text-ink",
                )}
              >
                <span className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-lg p-2 hover:bg-surface">
              <Avatar name={user.name} src={user.avatarUrl} className="size-8 text-xs" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{user.name}</span>
            </summary>
            <div className="absolute bottom-full left-0 mb-1 w-full min-w-[180px] rounded-xl border border-border bg-paper p-1 shadow-lg">
              <Link href="/business/settings" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:bg-surface">
                <Settings className="size-4" /> Settings
              </Link>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-danger-soft"
              >
                <LogOut className="size-4" /> Sign out
              </button>
            </div>
          </details>
        </div>
      </aside>

      {/* Mobile top header */}
      <header className="flex items-center justify-between border-b border-border bg-paper px-4 py-3 lg:hidden print:hidden">
        <div className="flex items-center gap-2.5">
          <JktlMark className="size-8" />
          <div className="min-w-0">
            <div className="truncate font-display text-sm font-semibold tracking-tight text-ink">
              {profile.displayName}
            </div>
            <div className="text-[10px] font-medium text-ink-muted">{industry.productName}</div>
          </div>
        </div>
        <details className="group relative">
          <summary className="cursor-pointer list-none">
            <Avatar name={user.name} src={user.avatarUrl} className="size-9 text-xs" />
          </summary>
          <div className="absolute right-0 z-40 mt-1 w-48 rounded-xl border border-border bg-paper p-1 shadow-lg">
            <Link href="/business/settings" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:bg-surface">
              <Settings className="size-4" /> Settings
            </Link>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-danger-soft"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
        </details>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-4 lg:px-8 lg:pb-10 lg:pt-8">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-paper/95 backdrop-blur lg:hidden print:hidden">
        {industry.nav.primary.map((item) => {
          const Icon = NAV_ICONS[item.icon];
          const active = isActive(pathname, item.href, moreHrefs);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium",
                active ? "text-primary" : "text-ink-faint",
              )}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
