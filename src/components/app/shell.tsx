"use client";
import { Gamepad2, Sparkles } from "lucide-react";

import { SupportDock } from "@/components/support/support-dock";
import { HelpMenu } from "@/components/support/help-menu";
import { ThemeControl } from "@/components/settings/theme-control";
import {FeatureBadge} from "@/components/features/FeatureBadge";
import { LanguageSwitcher, T } from "@/components/i18n/LanguageProvider";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Banknote,
  CalendarClock,
  Boxes, ChartNoAxesCombined, ChevronDown, CreditCard, FileText, Globe, Layers, Mail, Receipt, Search, ShoppingBag, Upload,
  House,
  LayoutGrid,
  LifeBuoy,
  LogOut,
  Loader2,
  Settings,
  Users,
  WifiOff,
} from "lucide-react";
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

const TOOL_ICONS: Record<string, LucideIcon> = {
  "/business/website": Globe, "/business/domains": Globe, "/business/email": Mail,
  "/business/custom": Layers, "/business/renewals": CalendarClock,
  "/business/services": Layers, "/business/products": ShoppingBag, "/business/inventory": Boxes,
  "/business/expenses": Receipt, "/business/invoices": FileText, "/business/payments": CreditCard,
  "/business/reports": ChartNoAxesCombined, "/business/analytics": ChartNoAxesCombined,
  "/business/import": Upload, "/business/settings": Settings, "/business/help": LifeBuoy,
  "https://jktl.com.ng/tools/seo-checker": Search, "/play/tycoon": Gamepad2,
};
const SERVICE_BADGES: Record<string, string> = { "/business/email": "business-email", "/business/custom": "custom", "/business/domains": "domains" };

function isActive(pathname: string, href: string, moreHrefs: string[]) {
  if (href === "/business") return pathname === "/business";
  if (href === "/business/more")
    return moreHrefs.some(
      (h) => pathname === h || pathname.startsWith(`${h}/`),
    );
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
  const syncing = useBusinessStore((s) => s.syncing);
  const logout = useBusinessStore((s) => s.logout);

  const moreHrefs = [...industry.nav.more.map((m) => m.href), "/business/domains", "/business/email", "/business/renewals", "/business/custom", "/business/chatbot", "/business/distribution", "/business/plans"];
  const groups = [{ label: "Website & services", items: [
    { href: "/business/website", label: "Your websites" },
    { href: "/business/domains", label: "Domains" },
    { href: "/business/email", label: "Business email" },
    { href: "/business/renewals", label: "Renewals" },
    { href: "/business/custom", label: "JKTL Custom" },
  ] }];
  for (const item of industry.nav.more.filter(item => item.href !== "/business/website" && item.href !== "/business/help")) {
    let group = groups.find(group => group.label === item.group);
    if (!group) { group = { label: item.group, items: [] }; groups.push(group); }
    group.items.push(item);
  }
  groups.push({ label: "Explore", items: [{ href: "/play/tycoon", label: "Business Tycoon" }] });


  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <div className="min-h-dvh bg-paper lg:pl-60">
      <SupportDock key={`${mode}:${profile.organizationId}:${user.id}`} />
      {/*
        Sync runs behind the scenes: while the outbox is draining the user sees a
        small spinner, not a running commentary on how many changes are queued.
        The two things that stay visible are the two that change what the user
        should do next — go back online, or re-enter something that was rejected.
      */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 top-3 z-40 flex flex-col items-end gap-2 print:hidden"
      >
        {mode === "live" && syncing ? (
          <span className="flex items-center gap-2 rounded-full border border-border bg-paper px-3 py-1.5 text-[11px] font-medium text-ink-muted shadow-sm">
            <Loader2 className="size-3.5 animate-spin text-primary" />
            <T>Saving…</T>
          </span>
        ) : null}

        {!online ? (
          <span className="flex items-center gap-2 rounded-full border border-border bg-toast px-3 py-1.5 text-[11px] font-medium text-white shadow-sm">
            <WifiOff className="size-3.5" />
            <T>Offline — we&apos;ll save this when you&apos;re back</T>
          </span>
        ) : null}
      </div>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-paper lg:flex print:hidden">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <JktlMark className="size-9" />
          <div className="min-w-0">
            <div className="truncate font-display text-[15px] font-semibold tracking-tight text-ink">
              {profile.displayName}
            </div>
            <div className="text-[11px] font-medium text-ink-muted">
              {industry.productName}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-5 pb-4">
          <ThemeControl align="start" /><LanguageSwitcher />
        </div>
        <Link href="/business/plans" className="mx-4 mb-4 rounded-full bg-[#c9a84c] px-5 py-3 text-center text-sm font-semibold text-[#060e2a] shadow-md">Upgrade <Sparkles size={18} aria-hidden="true" style={{display:"inline-block",verticalAlign:"middle"}} /></Link>
        <nav aria-label="Business navigation" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-4">
          {industry.nav.primary
            .filter((item) => item.icon !== "more")
            .map((item) => {
              const Icon = NAV_ICONS[item.icon];
              const active = isActive(pathname, item.href, moreHrefs);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-medium",
                    active
                      ? "bg-primary-soft text-primary-strong"
                      : "text-ink-muted hover:bg-surface hover:text-ink",
                  )}
                >
                  <Icon className="size-4" />
                  <T>{item.label}</T><FeatureBadge route={item.href}/>
                </Link>
              );
            })}
          <div className="mx-2 my-3 h-px bg-border" />
          {groups.map(group => <details key={group.label + pathname} className="group mb-2" open={group.label === "Website & services" || group.label === "Money" || group.items.some(item => isActive(pathname, item.href, moreHrefs))}>
            <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-ink-muted"><T>{group.label}</T><ChevronDown size={13} className="shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" /></summary>
            <div className="space-y-0.5">{group.items.map(item => {
              const Icon = TOOL_ICONS[item.href] || LayoutGrid;
              const active = isActive(pathname, item.href, moreHrefs);
              return <Link key={item.href} prefetch={false} href={item.href} aria-current={active ? "page" : undefined} className={cn("flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium", active ? "bg-primary-soft text-primary-strong" : "text-ink-muted hover:bg-surface hover:text-ink")}><Icon className="size-4 shrink-0" aria-hidden="true" /><T>{item.label}</T>{SERVICE_BADGES[item.href] ? <FeatureBadge slug={SERVICE_BADGES[item.href]} /> : <FeatureBadge route={item.href} />}</Link>;
            })}</div>
          </details>)}
        </nav>
        <div className="border-t border-border p-3">
          <div className="mb-3 grid"><HelpMenu /></div>
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-lg p-2 hover:bg-surface">
              <Avatar
                name={user.name}
                src={user.avatarUrl}
                className="size-8 text-xs"
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                {user.name}
              </span>
            </summary>
            <div className="absolute bottom-full left-0 mb-1 w-full min-w-[180px] rounded-xl border border-border bg-paper p-1 shadow-lg">
              <Link
                href="/business/settings"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:bg-surface"
              >
                <Settings className="size-4" />
                <T>Settings</T>
              </Link>
              <Link
                href="/business/help"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:bg-surface"
              >
                <LifeBuoy className="size-4" />
                <T>Help & guides</T>
              </Link>
              {mode === "live" && user.teamWorkspacePath && <Link href={user.teamWorkspacePath} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:bg-surface"><Users className="size-4" aria-hidden="true" />Team workspace</Link>}
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-danger-soft"
              >
                <LogOut className="size-4" />
                <T>Sign out</T>
              </button>
            </div>
          </details>
        </div>
      </aside>

      {/* Mobile top header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-paper px-4 py-3 lg:hidden print:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <JktlMark className="size-8 shrink-0" />
          <div className="min-w-0">
            <div className="truncate font-display text-sm font-semibold tracking-tight text-ink">
              {profile.displayName}
            </div>
            <div className="text-[10px] font-medium text-ink-muted">
              {industry.productName}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <HelpMenu compact />
          <details className="group relative">
            <summary className="cursor-pointer list-none">
              <Avatar
                name={user.name}
                src={user.avatarUrl}
                className="size-9 text-xs"
              />
            </summary>
            <div className="absolute right-0 z-40 mt-1 w-48 rounded-xl border border-border bg-paper p-1 shadow-lg">
              <div className="border-b border-border px-3 py-3"><p className="mb-2 text-xs font-medium text-ink-muted">Preferences</p><div className="flex items-center justify-between gap-2"><ThemeControl /><LanguageSwitcher /></div></div>
              <Link
                href="/business/settings"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:bg-surface"
              >
                <Settings className="size-4" />
                <T>Settings</T>
              </Link>
              <Link
                href="/business/help"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:bg-surface"
              >
                <LifeBuoy className="size-4" />
                <T>Help & guides</T>
              </Link>
              {mode === "live" && user.teamWorkspacePath && <Link href={user.teamWorkspacePath} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:bg-surface"><Users className="size-4" aria-hidden="true" />Team workspace</Link>}
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-danger-soft"
              >
                <LogOut className="size-4" />
                <T>Sign out</T>
              </button>
            </div>
          </details>
        </div>
      </header>

      <div className="flex items-center justify-between gap-3 border-b border-border bg-paper px-4 py-3 lg:hidden print:hidden"><Link href="/business/website" className="text-sm font-semibold text-blue-600 underline">Your websites →</Link><Link href="/business/plans" className="rounded-full bg-[#c9a84c] px-5 py-2.5 text-sm font-semibold text-[#060e2a] shadow-md">Upgrade <Sparkles size={18} aria-hidden="true" style={{display:"inline-block",verticalAlign:"middle"}} /></Link></div>
      <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-4 lg:px-8 lg:pb-10 lg:pt-8">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav aria-label="Business mobile navigation" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-paper/95 backdrop-blur lg:hidden print:hidden">
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
              <T>{item.label}</T><FeatureBadge route={item.href}/>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
