"use client";
import Link from "next/link";
import { Sheet } from "@/components/ui/sheet";
export function UpgradeSheet({
  open,
  onClose,
  reason,
  mode,
}: {
  open: boolean;
  onClose: () => void;
  reason: string;
  mode: "demo" | "live";
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Website plans">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">{reason}</p>
        <p className="text-sm text-ink-muted">
          Choose monthly or yearly billing, review your included capabilities
          and confirm the exact total before payment. Existing subscriptions
          stay unchanged.
        </p>
        {mode === "demo" && (
          <p className="text-sm">Demo mode does not start a real payment.</p>
        )}
        <Link
          href="/business/plans"
          onClick={onClose}
          className="rounded-xl bg-primary px-5 py-3 text-center text-sm font-semibold text-white"
        >
          Compare website plans
        </Link>
        <p className="text-xs text-ink-faint">
          14-day money-back guarantee on your first paid website plan. Terms
          apply.
        </p>
      </div>
    </Sheet>
  );
}
