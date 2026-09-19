"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill, type Tone } from "@/components/app/status-pill";
import { useBusinessStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import { formatKobo, formatShortDate } from "@/lib/format";
import { BILLING_CYCLES, annualizedKobo, type BillingCycle } from "@/lib/billing";
import { startCheckoutAction, confirmCheckoutAction, getManageSubscriptionLinkAction } from "@/lib/actions/billing-actions";
import type { Infrastructure } from "@/lib/types";

function statusMeta(status: Infrastructure["subscriptionStatus"]): { label: string; tone: Tone } {
  switch (status) {
    case "active":
      return { label: "Active", tone: "primary" };
    case "past_due":
      return { label: "Payment failed", tone: "danger" };
    case "canceled":
      return { label: "Canceled", tone: "danger" };
    default:
      return { label: "Not subscribed", tone: "neutral" };
  }
}

function cycleUnit(cycle: BillingCycle): string {
  return { monthly: "month", quarterly: "quarter", biannually: "6 months", yearly: "year" }[cycle];
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

/**
 * The real, Paystack-backed "Website & Hosting" subscription panel. Lives
 * in the Settings → Plan tab. Publishing a website on a *.jktl.com.ng
 * subdomain is always free and never needs this — subscribing here unlocks
 * the three things that have a genuine ongoing cost: more than one team
 * member, storage past the free 50MB image quota (see `StorageUsagePanel`
 * just below this in the tab), and a custom domain of your own (see
 * `CustomDomainField` on the Website page).
 */
export function BillingPanel({ infra, mode }: { infra: Infrastructure; mode: "demo" | "live" }) {
  const setInfrastructure = useBusinessStore((s) => s.setInfrastructure);
  const showToast = useToastStore((s) => s.show);

  // Whether we landed here via Paystack's post-checkout redirect
  // (?billing=callback&reference=...) — computed once via a lazy
  // initializer (the initial render) rather than set from inside an
  // effect, so the effect below only ever calls setState from within its
  // async completion callback, not synchronously in the effect body.
  const [confirming, setConfirming] = useState(() => {
    if (typeof window === "undefined" || mode !== "live") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("billing") === "callback" && Boolean(params.get("reference") || params.get("trxref"));
  });
  const [checkoutPending, setCheckoutPending] = useState<BillingCycle | null>(null);
  const [managePending, setManagePending] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const confirmedOnce = useRef(false);

  // Reacts to Paystack's redirect back to this page after checkout — reads
  // the URL directly (rather than next/navigation's useSearchParams) so
  // this component needs no Suspense boundary. Runs once on mount; the ref
  // guards against Strict Mode's double-invoke calling this twice.
  useEffect(() => {
    if (mode !== "live" || confirmedOnce.current) return;
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") || params.get("trxref");
    if (params.get("billing") !== "callback" || !reference) return;

    confirmedOnce.current = true;
    confirmCheckoutAction(reference).then((result) => {
      setConfirming(false);
      if (result.ok) {
        setInfrastructure(result.data);
        showToast(
          result.data.subscriptionStatus === "active" ? "Subscription active — you can publish your site now" : "Payment wasn't completed",
          result.data.subscriptionStatus === "active" ? "default" : "danger",
        );
      } else {
        showToast(result.error, "danger");
      }
      window.history.replaceState({}, "", window.location.pathname);
    });
  }, [mode, setInfrastructure, showToast]);

  // Deferred navigation: `subscribe()` below only sets `redirectUrl`, and
  // this effect performs the actual `window.location` mutation — keeps
  // the click handler itself from mutating an object defined outside the
  // component, per this codebase's stricter react-hooks/immutability rule.
  useEffect(() => {
    if (redirectUrl) window.location.href = redirectUrl;
  }, [redirectUrl]);

  const hasSubscription = infra.subscriptionStatus === "active" || infra.subscriptionStatus === "past_due";
  const meta = statusMeta(infra.subscriptionStatus);

  async function subscribe(cycle: BillingCycle) {
    if (mode !== "live") {
      showToast("Upgrading isn't available in demo mode — create a real account first.");
      return;
    }
    setCheckoutPending(cycle);
    const result = await startCheckoutAction(cycle);
    setCheckoutPending(null);
    if (!result.ok) {
      showToast(result.error, "danger");
      return;
    }
    setRedirectUrl(result.data.authorizationUrl);
  }

  async function manage() {
    setManagePending(true);
    const result = await getManageSubscriptionLinkAction();
    setManagePending(false);
    if (!result.ok) {
      showToast(result.error, "danger");
      return;
    }
    window.open(result.data.link, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold text-ink">Website &amp; hosting</h2>
        <StatusPill tone={meta.tone}>{confirming ? "Confirming…" : meta.label}</StatusPill>
      </div>
      <p className="text-xs text-ink-muted">
        JKTL Business is free — publishing your website on a jktl.com.ng address doesn&apos;t need this. Upgrade to
        add extra team members, more storage, or a custom domain of your own.
      </p>

      {hasSubscription ? (
        <>
          <dl className="divide-y divide-border">
            <Row label="Plan" value={infra.planName} />
            <Row label="Price" value={`${formatKobo(infra.priceKoboPerCycle)} / ${cycleUnit(infra.billingCycle)}`} />
            <Row label="Renews" value={formatShortDate(infra.renewalDate)} />
          </dl>
          {infra.subscriptionStatus === "past_due" ? (
            <p className="text-xs text-danger">Your last payment failed — update your card below to keep your site live.</p>
          ) : null}
          <Button variant="outline" onClick={manage} disabled={managePending}>
            {managePending ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-3.5" />}
            Manage subscription
          </Button>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {BILLING_CYCLES.map((cycle) => (
            <button
              key={cycle.id}
              type="button"
              onClick={() => subscribe(cycle.id)}
              disabled={checkoutPending !== null}
              className="flex flex-col items-start gap-0.5 rounded-xl border border-border-strong p-3 text-left transition-colors hover:border-primary disabled:opacity-60"
            >
              <span className="text-xs font-medium text-ink-muted">{cycle.label}</span>
              <span className="text-sm font-semibold text-ink">{formatKobo(cycle.priceKobo)}</span>
              <span className="text-[11px] text-ink-faint">{formatKobo(annualizedKobo(cycle))}/yr equivalent</span>
              {checkoutPending === cycle.id ? <Loader2 className="mt-1 size-3.5 animate-spin text-primary" /> : null}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
