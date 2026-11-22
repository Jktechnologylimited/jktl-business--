"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeWorkspaceLink, type WorkspaceLink } from "@/lib/admin-navigation";

/** Ordinary navigation links, with one active page and no background requests. */
export function SectionNav({ label, items }: { label: string; items: WorkspaceLink[] }) {
  const path = usePathname();
  const current = activeWorkspaceLink(items.filter(item => !item.href.includes("#")), path);
  return <nav aria-label={label} className="flex flex-wrap gap-1 border-b border-border pb-2">
    {items.map(item => <Link key={item.href} href={item.href} prefetch={false}
      aria-current={current?.href === item.href ? "page" : undefined}
      className="rounded-lg px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink aria-[current=page]:bg-primary-soft aria-[current=page]:font-semibold aria-[current=page]:text-primary-strong focus-visible:outline-2 focus-visible:outline-accent">
      {item.label}
    </Link>)}
  </nav>;
}
