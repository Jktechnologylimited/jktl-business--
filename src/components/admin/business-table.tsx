"use client";

import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { SearchInput } from "@/components/app/search-input";
import { FilterTabs } from "@/components/app/filter-tabs";
import { StatusPill, type Tone } from "@/components/app/status-pill";
import { EmptyState } from "@/components/app/empty-state";
import { formatKobo, formatMb, formatRelativeDay } from "@/lib/format";
import { getIndustry } from "@/lib/industry";
import type { AdminBusinessRow } from "@/lib/db/admin";
import type { BusinessType } from "@/lib/types";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "jktl.com.ng";
const ALL = "all";

const SUBSCRIPTION_META: Record<AdminBusinessRow["subscriptionStatus"], { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "primary" },
  past_due: { label: "Past due", tone: "danger" },
  canceled: { label: "Canceled", tone: "neutral" },
  inactive: { label: "Inactive", tone: "neutral" },
};

export function AdminBusinessTable({ businesses }: { businesses: AdminBusinessRow[] }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<string>(ALL);

  const typeOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const b of businesses) seen.add(b.businessType);
    return [{ value: ALL, label: "All types" }, ...Array.from(seen).map((t) => ({ value: t, label: getIndustry(t as BusinessType).label }))];
  }, [businesses]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return businesses.filter((b) => {
      if (type !== ALL && b.businessType !== type) return false;
      if (!q) return true;
      return [b.displayName, b.organizationName, b.subdomain].join(" ").toLowerCase().includes(q);
    });
  }, [businesses, query, type]);

  if (businesses.length === 0) {
    return <EmptyState title="No businesses yet" description="Every business that signs up for JKTL Business will show up here." />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={query} onChange={setQuery} placeholder="Search by business name or address" />
      </div>
      <FilterTabs options={typeOptions} value={type} onChange={setType} />

      {filtered.length === 0 ? (
        <EmptyState title="No matches" description={`No business matches "${query}".`} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-surface text-xs font-semibold uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Subscription</th>
                <th className="px-4 py-3">Storage</th>
                <th className="px-4 py-3">Customers</th>
                <th className="px-4 py-3">Bookings</th>
                <th className="px-4 py-3">Sales</th>
                <th className="px-4 py-3">Revenue</th>
                <th className="px-4 py-3">Last active</th>
                <th className="px-4 py-3">Signed up</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((b) => {
                const sub = SUBSCRIPTION_META[b.subscriptionStatus];
                const siteUrl = `https://${b.subdomain}.${ROOT_DOMAIN}`;
                return (
                  <tr key={b.organizationId} className="hover:bg-surface/60">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{b.displayName || b.organizationName}</div>
                      <div className="text-xs text-ink-muted">{b.subdomain}.{ROOT_DOMAIN}</div>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{getIndustry(b.businessType as BusinessType).label}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <StatusPill tone={sub.tone}>{sub.label}</StatusPill>
                        {b.published ? <span className="text-[11px] text-ink-faint">Published</span> : <span className="text-[11px] text-ink-faint">Not published</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {formatMb(b.storageUsedBytes)} / {formatMb(b.storageLimitBytes)}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{b.customersCount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-ink-muted">{b.bookingsCount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-ink-muted">{b.salesCount.toLocaleString()}</td>
                    <td className="px-4 py-3 font-medium text-ink">{formatKobo(b.totalRevenueKobo)}</td>
                    <td className="px-4 py-3 text-ink-muted">{b.lastActiveAt ? formatRelativeDay(b.lastActiveAt) : "Never"}</td>
                    <td className="px-4 py-3 text-ink-muted">{formatRelativeDay(b.createdAt)}</td>
                    <td className="px-4 py-3">
                      {b.published ? (
                        <a
                          href={siteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          View site <ExternalLink className="size-3" />
                        </a>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
