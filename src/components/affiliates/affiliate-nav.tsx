"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/affiliates", label: "Dashboard" },
  { href: "/affiliates/playbook", label: "Playbook" },
] as const;

/** The affiliate portal's only two screens — kept as plain tabs rather than
 * pulling in the business app's FilterTabs component, since that one reads
 * from a controlled `value`/`onChange` pair for a single page, not routes. */
export function AffiliateNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              active ? "bg-primary-soft text-primary" : "text-ink-muted hover:bg-surface-strong hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
