"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { useToastStore } from "@/lib/toast";
import { formatKobo } from "@/lib/format";
import { BILLING_CYCLES, annualizedKobo, type BillingCycle } from "@/lib/billing";
import { startCheckoutAction } from "@/lib/actions/billing-actions";

/**
 * The single "you hit a gate" upsell surface — opened from wherever a
 * gated action is attempted (a 2nd team member, a custom domain, storage
 * past the free quota) rather than sending the person off to Settings →
 * Plan and hoping they find their way back. `reason` is the one line that
 * changes per call site; everything else (the cycle picker, the checkout
 * call) is shared so there's exactly one place that knows how to start a
 * Paystack checkout from a gate.
 */
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
  const [pending, setPending] = useState<BillingCycle | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const showToast = useToastStore((s) => s.show);

  // Deferred navigation, same pattern as `BillingPanel` — the click
  // handler only sets state, and this effect performs the actual
  // `window.location` mutation, per this codebase's react-hooks rules.
  useEffect(() => {
    if (redirectUrl) window.location.href = redirectUrl;
  }, [redirectUrl]);

  async function choose(cycle: BillingCycle) {
    if (mode !== "live") {
      showToast("Upgrading isn't available in demo mode — create a real account first.");
      return;
    }
    setPending(cycle);
    const result = await startCheckoutAction(cycle);
    setPending(null);
    if (!result.ok) {
      showToast(result.error, "danger");
      return;
    }
    setRedirectUrl(result.data.authorizationUrl);
  }

  return (
    <Sheet open={open} onClose={onClose} title="Upgrade">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">{reason}</p>
        <div className="grid grid-cols-2 gap-2">
          {BILLING_CYCLES.map((cycle) => (
            <button
              key={cycle.id}
              type="button"
              onClick={() => choose(cycle.id)}
              disabled={pending !== null}
              className="flex flex-col items-start gap-0.5 rounded-xl border border-border-strong p-3 text-left transition-colors hover:border-primary disabled:opacity-60"
            >
              <span className="text-xs font-medium text-ink-muted">{cycle.label}</span>
              <span className="text-sm font-semibold text-ink">{formatKobo(cycle.priceKobo)}</span>
              <span className="text-[11px] text-ink-faint">{formatKobo(annualizedKobo(cycle))}/yr equivalent</span>
              {pending === cycle.id ? <Loader2 className="mt-1 size-3.5 animate-spin text-primary" /> : null}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-faint">Cancel anytime from Settings → Plan.</p>
      </div>
    </Sheet>
  );
}
