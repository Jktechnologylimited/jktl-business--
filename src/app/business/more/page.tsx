"use client";

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
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink">More</h1>
      {groups.map((group) => (
        <div key={group.name} className="flex flex-col gap-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{group.name}</h2>
          <div className="divide-y divide-border rounded-2xl border border-border">
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between px-4 py-3.5 hover:bg-surface"
              >
                <div>
                  <div className="text-sm font-medium text-ink">{item.label}</div>
                  <div className="text-xs text-ink-muted">{item.description}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
