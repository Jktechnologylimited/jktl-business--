"use client";
import { ThemeControl } from "@/components/settings/theme-control";
import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LifeBuoy,
  Star,
  LayoutDashboard,
  Users,
  Mail,
  Globe,
  Layers,
  ChartNoAxesCombined,
  Handshake,
  FileText,
  Settings,
  Menu,
  X,
  LogOut,
  ArrowUpRight,
} from "lucide-react";
import styles from "./operations-frame.module.css";
type Nav = { href: string; label: string };
export function OperationsFrame({
  kind = "admin",
  name,
  role,
  nav,
  logout,
  children,
}: {
  kind?: "admin" | "affiliate" | "partner";
  name: string;
  role: string;
  nav: Nav[];
  logout: () => Promise<void>;
  children: ReactNode;
}) {
  const path = usePathname(),
    [open, setOpen] = useState(false),
    current = nav.find((n) => n.href === path);
  useEffect(() => {
    if (!open) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [open]);
  const icons: Record<string, typeof Users> = {
    "/admin/distribution": Handshake,
    "/admin/support": LifeBuoy,
    "/admin/reviews": Star,
    "/admin": Users,
    "/admin/insights": ChartNoAxesCombined,
    "/admin/affiliates": Handshake,
    "/admin/partners": Handshake,
    "/admin/domains": Globe,
    "/admin/business-email": Mail,
    "/admin/custom-projects": Layers,
    "/admin/content": FileText,
    "/admin/features": Settings,
  };
  return (
    <div className={styles.frame}>
      {open && (
        <button
          className={styles.overlay}
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={styles.sidebar} data-open={open}>
        <button
          className={styles.menu}
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        >
          <X size={18} />
        </button>
        <Link
          className={styles.brand}
          href={
            kind === "admin"
              ? "/admin/insights"
              : kind === "partner"
                ? "/partners"
                : "/affiliates"
          }
        >
          JKTL
          <span>
            {kind === "admin"
              ? "COMMAND CENTRE"
              : kind === "partner"
                ? "PARTNER WORKSPACE"
                : "AFFILIATE WORKSPACE"}
          </span>
        </Link>
        <div>
          <p className={styles.sectionLabel}>
            {kind === "admin" ? "Workspace" : "Your programme"}
          </p>
          <nav
            className={styles.nav}
            aria-label={
              kind === "admin" ? "Admin navigation" : "Programme navigation"
            }
          >
            {nav.map((n) => {
              const Icon = icons[n.href] || LayoutDashboard;
              return (
                <Link
                  href={n.href}
                  key={n.href}
                  aria-current={path === n.href ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  <Icon size={16} />
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className={styles.sideFoot}>
          <p>JK TECHNOLOGY LIMITED</p>
          <p>Build better. Grow together.</p>
          <Link href="https://jktl.com.ng">
            Visit main site <ArrowUpRight size={12} className="inline" />
          </Link>
        </div>
      </aside>
      <div className={styles.content}>
        <header className={styles.top}>
          <div className="flex items-center gap-3">
            <button
              className={styles.menu}
              aria-label="Open navigation"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <Menu size={18} />
            </button>
            <div>
              <div className={styles.pageTitle}>
                {current?.label || "Workspace"}
              </div>
              <p>
                {kind === "admin"
                  ? "Your team, services and customers. One clear view."
                  : "Your referrals, qualifying earnings and programme activity."}
              </p>
            </div>
          </div>
          <div className={styles.identity}>
            <ThemeControl />
            <div className={styles.avatar} aria-hidden="true">
              {name
                .split(/\s+/)
                .slice(0, 2)
                .map((s) => s[0])
                .join("")
                .toUpperCase()}
            </div>
            <div>
              <strong>{name}</strong>
              <small>{role}</small>
            </div>
            <form action={logout}>
              <button aria-label="Sign out">
                <LogOut size={13} className="inline" /> Sign out
              </button>
            </form>
          </div>
        </header>
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
