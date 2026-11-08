"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BriefcaseBusiness,
  CreditCard,
  ChartNoAxesCombined,
  LifeBuoy,
  Menu,
  X,
  ArrowUpRight,
  LogOut,
} from "lucide-react";
import { JktlMark } from "@/components/app/logo";
import { ThemeControl } from "@/components/settings/theme-control";
const nav = [
  ["/partners", "Overview", LayoutDashboard],
  ["/partners/workspace", "Clients & websites", BriefcaseBusiness],
  ["/partners/billing", "Services & payments", CreditCard],
  ["/partners/earnings", "Referrals & earnings", ChartNoAxesCombined],
  ["/partners/support", "Support", LifeBuoy],
] as const;
export function PartnerShell({
  name,
  logout,
  children,
}: {
  name: string;
  logout: () => Promise<void>;
  children: React.ReactNode;
}) {
  const path = usePathname(),
    [open, setOpen] = useState(false);
  const links = (
    <>
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
        Your workspace
      </p>
      <nav aria-label="Partner workspace" className="space-y-1">
        {nav.map(([href, label, Icon]) => {
          const active =
            href === "/partners" ? path === href : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${active ? "bg-primary text-on-primary" : "text-ink-muted hover:bg-surface hover:text-ink"}`}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>
      <p className="mb-3 mt-8 text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
        Tools & guidance
      </p>
      <nav aria-label="Partner resources" className="space-y-1">
        {[
          ["/partners/clients", "Client permissions"],
          ["/partners/commercial", "Commercial agreement"],
          ["/partners/resources", "Marketing resources"],
          ["/partners/chatbot", "Client AI Chatbots"],
          ["/help?topic=partners", "Knowledge base"],
          ["/business/distribution", "Linked Business account"],
        ].map(([href, label]) => (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className="block rounded-lg px-3 py-2.5 text-sm text-ink-muted hover:bg-surface"
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-8 border-t border-border pt-5">
        <a
          href="https://jktl.com.ng/partners"
          className="flex items-center gap-2 px-3 text-sm text-ink-muted"
        >
          Programme website
          <ArrowUpRight size={15} />
        </a>
        <form action={logout}>
          <button className="mt-5 flex items-center gap-2 px-3 text-sm text-ink-muted">
            <LogOut size={16} />
            Sign out
          </button>
        </form>
      </div>
    </>
  );
  return (
    <div className="min-h-dvh bg-surface text-ink">
      <header className="sticky top-0 z-40 border-b border-border bg-paper">
        <div className="flex min-h-20 items-center justify-between gap-3 px-4 sm:px-7">
          <Link href="/partners" className="flex items-center gap-3">
            <JktlMark className="size-10" />
            <span className="text-lg font-semibold">
              JKTL <span className="text-ink-muted">Partners</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeControl />
            <span className="hidden max-w-44 truncate text-sm text-ink-muted sm:block">
              {name}
            </span>
            <button
              type="button"
              aria-label={open ? "Close navigation" : "Open navigation"}
              aria-expanded={open}
              aria-controls="partner-mobile-nav"
              onClick={() => setOpen(!open)}
              className="rounded-xl border border-border p-2.5 lg:hidden"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-[1600px]">
        <aside className="sticky top-20 hidden h-[calc(100dvh-5rem)] w-64 shrink-0 overflow-y-auto border-r border-border bg-paper px-4 py-7 lg:block">
          {links}
        </aside>
        {open && (
          <nav
            id="partner-mobile-nav"
            aria-label="Mobile partner navigation"
            className="fixed inset-x-0 bottom-0 top-20 z-30 overflow-y-auto border-b border-border bg-paper p-5 lg:hidden"
          >
            {links}
          </nav>
        )}
        <main className="min-w-0 flex-1 px-4 py-7 sm:px-7 lg:p-9">
          {children}
        </main>
      </div>
    </div>
  );
}
