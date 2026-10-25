"use client";
import { FeatureBadge } from "@/components/features/FeatureBadge";
import { T } from "@/components/i18n/LanguageProvider";

import Link from "next/link";
import { useCurrentIndustry } from "@/lib/store";

export default function MorePage() {
  const industry = useCurrentIndustry();

  // Group by `group`, preserving the order groups first appear in — the
  // industry config already lists items in group order (see industry.ts),
  // so this just clusters them into sections instead of one long list.
  const groups: { name: string; items: typeof industry.nav.more }[] = [];
  for (const item of industry.nav.more) {
    const existing = groups.find((g) => g.name === item.group);
    if (existing) existing.items.push(item);
    else groups.push({ name: item.group, items: [item] });
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
        <T>More</T>
      </h1>
      <Link
        href="/business/email"
        className="rounded-2xl border border-border bg-surface p-5"
      >
        <strong>
          Business Email <FeatureBadge slug="business-email" />
        </strong>
        <p className="mt-1 text-sm text-ink-muted">
          Manage professional mailboxes, domain setup and email support.
        </p>
      </Link>
      <Link
        href="/business/domains"
        className="rounded-2xl border border-border bg-surface p-5"
      >
        <strong>My Domains</strong>
        <p className="mt-1 text-sm text-ink-muted">
          Buy, renew and connect your domains with one-off payments.
        </p>
      </Link>
      <Link
        href="/play/tycoon"
        className="rounded-2xl border border-border bg-surface p-5"
      >
        <strong>
          🎮 JKTL Business Tycoon <FeatureBadge slug="tycoon" />
        </strong>
        <p className="mt-1 text-sm text-ink-muted">
          Build a Nigerian neighbourhood. Play with your existing JKTL account.
        </p>
      </Link>
      {groups.map((group) => (
        <div key={group.name} className="flex flex-col gap-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            {group.name}
          </h2>
          <div className="divide-y divide-border rounded-2xl border border-border">
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between px-4 py-3.5 hover:bg-surface"
              >
                <div>
                  <div className="text-sm font-medium text-ink">
                    <T>{item.label}</T>
                    <FeatureBadge route={item.href} />
                  </div>
                  <div className="text-xs text-ink-muted">
                    <T>{item.description}</T>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
