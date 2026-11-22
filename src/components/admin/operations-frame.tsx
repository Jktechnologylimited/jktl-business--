"use client";
import { JktlMark } from "@/components/app/logo";
import { ThemeControl } from "@/components/settings/theme-control";
import { openTeamBusinessAction } from "@/lib/actions/team-business-actions";
import { ActionForm } from "@/components/distribution/action-form";
import { activeWorkspaceLink, groupAdminNavigation, type WorkspaceLink } from "@/lib/admin-navigation";
import { useState, useLayoutEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LifeBuoy, Star, LayoutDashboard, Users, Mail, Globe, Layers,
  ChartNoAxesCombined, Handshake, FileText, Settings, Menu, X,
  LogOut, ArrowUpRight, Search, ChevronDown, BookOpen, CreditCard, Bot,
} from "lucide-react";
import styles from "./operations-frame.module.css";

const icons: Record<string, typeof Users> = {
  "/admin/distribution": Handshake, "/admin/support": LifeBuoy,
  "/admin/partner-support": LifeBuoy, "/admin/reviews": Star,
  "/admin/support/follow-ups": LifeBuoy, "/admin/emails/renewals": CreditCard,
  "/admin": LayoutDashboard, "/admin/insights": ChartNoAxesCombined,
  "/admin/affiliates": Handshake, "/admin/partners": Handshake,
  "/admin/domains": Globe, "/admin/business-email": Mail,
  "/admin/custom-projects": Layers, "/admin/content": FileText,
  "/admin/features": Settings, "/admin/emails": Mail,
  "/admin/broadcasts": Mail, "/admin/knowledge": BookOpen,
  "/admin/team": Users, "/admin/team/structure": Users,
  "/admin/team/payment-details": CreditCard, "/admin/team/payments": CreditCard,
  "/admin/website-refunds": CreditCard, "/admin/chatbot": Bot,
  "/admin/prospects": Users,
};
export function OperationsFrame({
  kind = "admin", name, role, nav, homeHref, logout, children,
}: {
  kind?: "admin" | "affiliate" | "partner";
  name: string; role: string; nav: WorkspaceLink[]; homeHref?: string;
  logout: () => Promise<void>; children: ReactNode;
}) {
  const path = usePathname(), [open, setOpen] = useState(false), [search, setSearch] = useState("");
  const sidebar = useRef<HTMLElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const current = activeWorkspaceLink(nav, path);
  const groups = kind === "admin" ? groupAdminNavigation(nav, search) : [{ id: "programme", label: "Your programme", items: nav }];
  const home = kind === "admin" ? homeHref || nav[0]?.href || "/admin/knowledge" : kind === "partner" ? "/partners" : "/affiliates";
  useLayoutEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const menuTrigger = trigger.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () => Array.from(sidebar.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input, summary',
    ) || []).filter(node => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== "hidden");
    // Focus after the triggering button has become inert. A one-off timer also
    // works when animation frames are throttled; this is not a retry loop.
    const focusTimer = window.setTimeout(() => focusables()[0]?.focus({ preventScroll: true }), 0);
    const keydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
      if (e.key !== "Tab") return;
      const items = focusables(), index = items.indexOf(document.activeElement as HTMLElement);
      e.preventDefault();
      const next = index < 0 ? (e.shiftKey ? items.length - 1 : 0)
        : (index + (e.shiftKey ? -1 : 1) + items.length) % items.length;
      items[next]?.focus();
    };
    const resize = () => { if (innerWidth > 760) setOpen(false); };
    document.addEventListener("keydown", keydown, true);
    window.addEventListener("resize", resize);
    return () => {
      document.body.style.overflow = overflow;
      clearTimeout(focusTimer);
      document.removeEventListener("keydown", keydown, true);
      window.removeEventListener("resize", resize);
      if (previous?.isConnected && previous !== document.body) previous.focus();
      else menuTrigger?.focus();
    };
  }, [open]);
  const navLink = (item: WorkspaceLink) => {
    const Icon = icons[item.href] || LayoutDashboard;
    return <Link href={item.href} prefetch={false} key={item.href}
      aria-current={current?.href === item.href ? "page" : undefined}
      onClick={() => setOpen(false)}><Icon size={16} aria-hidden="true" /><span>{item.label}</span></Link>;
  };
  return (
    <div className={styles.frame}>
      <a className={styles.skip} href="#workspace-content">Skip to content</a>
      {open && <button className={styles.overlay} aria-label="Close navigation overlay" tabIndex={-1} onClick={() => setOpen(false)} />}
      <aside ref={sidebar} id="workspace-navigation" className={styles.sidebar} data-open={open}
        aria-label={kind === "admin" ? "Team workspace" : "Programme workspace"}>
        <div className={styles.brandRow}>
          <Link className={styles.brand} href={home} prefetch={false}>
            <JktlMark className="size-8" /><span>JKTL<small>{kind === "admin" ? "Team workspace" : kind === "partner" ? "Partner workspace" : "Affiliate workspace"}</small></span>
          </Link>
          <button className={styles.menu} aria-label="Close navigation" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        {kind === "admin" && <div className={styles.search}>
          <Search size={15} aria-hidden="true" />
          <input aria-label="Find a workspace page" placeholder="Find a page…" value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button aria-label="Clear navigation search" onClick={() => setSearch("")}><X size={14} /></button>}
        </div>}
        <nav className={styles.navigation} aria-label={kind === "admin" ? "Team navigation" : "Programme navigation"}>
          {groups.map(group => <details key={`${group.id}:${current?.href}:${Boolean(search)}`} className={styles.group}
            open={Boolean(search) || group.items.some(item => item.href === current?.href) || ["customers", "help", "programme"].includes(group.id)}>
            <summary className={styles.sectionLabel}>{group.label}<ChevronDown size={13} aria-hidden="true" /></summary>
            <div className={styles.nav}>{group.items.map(navLink)}</div>
          </details>)}
          {!groups.length && <div className={styles.noResults} role="status">No pages match “{search}”.<button onClick={() => setSearch("")}>Clear search</button></div>}
        </nav>
        <div className={styles.sideFoot}>
          {kind === "admin" && <ActionForm action={openTeamBusinessAction}>
            <button className={styles.businessLink}><ArrowUpRight size={15} aria-hidden="true" />Open JKTL Business</button>
          </ActionForm>}
          <a href="https://jktl.com.ng" target="_blank" rel="noreferrer">Visit main site <ArrowUpRight size={12} aria-hidden="true" /></a>
        </div>
      </aside>
      <div className={styles.content} inert={open || undefined}>
        <header className={styles.top}>
          <div className={styles.titleRow}>
            <button ref={trigger} className={styles.menu} aria-label="Open navigation" aria-expanded={open}
              aria-controls="workspace-navigation" onClick={() => setOpen(true)}><Menu size={18} /></button>
            <div><p>{kind === "admin" ? "Team workspace" : "Your programme"}</p><div className={styles.pageTitle}>{current?.label || "Workspace"}</div></div>
          </div>
          <div className={styles.identity}>
            <ThemeControl />
            <div className={styles.avatar} aria-hidden="true">{name.split(/\s+/).slice(0, 2).map(s => s[0]).join("").toUpperCase()}</div>
            <div className={styles.person}><strong>{name}</strong><small>{role}</small></div>
            <form action={logout}><button aria-label="Sign out"><LogOut size={15} aria-hidden="true" /><span className={styles.signOutText}>Sign out</span></button></form>
          </div>
        </header>
        <main id="workspace-content" tabIndex={-1} className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
