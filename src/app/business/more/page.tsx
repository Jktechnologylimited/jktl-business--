"use client";

import Link from "next/link";
import { useCurrentIndustry } from "@/lib/store";

export default function MorePage() {
  const industry = useCurrentIndustry();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink">More</h1>
      <div className="divide-y divide-border rounded-2xl border border-border">
        {industry.nav.more.map((item) => (
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
  );
}
