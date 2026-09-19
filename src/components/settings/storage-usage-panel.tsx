"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { UpgradeSheet } from "@/components/settings/upgrade-sheet";
import { formatMb } from "@/lib/format";
import { getStorageUsageAction } from "@/lib/actions/storage-actions";
import type { StorageUsage } from "@/lib/db/storage";

// Demo mode has no real database usage to read — a fixed, plausible-looking
// value so the bar isn't just empty while trying the app out.
const DEMO_USAGE: StorageUsage = { usedBytes: 8_400_000, limitBytes: 52_428_800 };

/**
 * Shows how much of the free storage quota this business has used — photos
 * (logos, avatars, receipt images) only, per `src/lib/db/storage.ts`'s
 * design. Purely informational; the actual gate lives server-side in
 * `hasStorageQuota`, checked at upload time. Fetches once on mount rather
 * than living in the store, since this number changes rarely and isn't
 * needed anywhere else in the app.
 */
export function StorageUsagePanel({ mode }: { mode: "demo" | "live" }) {
  const [usage, setUsage] = useState<StorageUsage | null>(mode !== "live" ? DEMO_USAGE : null);
  const [error, setError] = useState("");
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    if (mode !== "live") return;
    getStorageUsageAction().then((result) => {
      if (result.ok) setUsage(result.data);
      else setError(result.error);
    });
  }, [mode]);

  if (error) {
    return (
      <section className="rounded-2xl border border-border p-4">
        <h2 className="font-display text-sm font-semibold text-ink">Storage</h2>
        <p className="mt-1 text-xs text-danger">{error}</p>
      </section>
    );
  }

  if (!usage) {
    return (
      <section className="rounded-2xl border border-border p-4">
        <h2 className="font-display text-sm font-semibold text-ink">Storage</h2>
        <p className="mt-1 text-xs text-ink-muted">Loading…</p>
      </section>
    );
  }

  const pct = Math.min(100, Math.round((usage.usedBytes / usage.limitBytes) * 100));
  const atLimit = usage.usedBytes >= usage.limitBytes;

  return (
    <section className="rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold text-ink">Storage</h2>
        <span className="text-sm font-medium text-ink">
          {formatMb(usage.usedBytes)} / {formatMb(usage.limitBytes)}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface">
        <div
          className={`h-full rounded-full ${atLimit ? "bg-danger" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        {atLimit
          ? "You've reached the free storage limit."
          : "Covers your logo, staff avatars, receipt and product photos. Everything else on your plan is unlimited."}
      </p>
      {atLimit ? (
        <Button size="sm" variant="outline" className="mt-3" onClick={() => setUpgrading(true)}>
          Upgrade for more storage
        </Button>
      ) : null}
      <UpgradeSheet
        open={upgrading}
        onClose={() => setUpgrading(false)}
        reason="Get more storage for photos — logos, staff avatars, receipts and product photos — past the free 50MB."
        mode={mode}
      />
    </section>
  );
}
