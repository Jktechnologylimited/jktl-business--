"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill, type Tone } from "@/components/app/status-pill";
import { useBusinessStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import { formatKobo, formatShortDate } from "@/lib/format";
import { confirmCheckoutAction, getManageSubscriptionLinkAction } from "@/lib/actions/billing-actions";
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
  const [managePending, setManagePending] = useState(false);
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


  const hasSubscription = infra.subscriptionStatus === "active" || infra.subscriptionStatus === "past_due";
  const meta = statusMeta(infra.subscriptionStatus);


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
      {/*
        This used to open with "JKTL Business is free", which stopped being true
        the moment the product became the AI receptionist at ₦650,000 + ₦59,000 a
        month. A customer who bought on that pricing and then read this screen
        would reasonably ask what they had paid for. The copy now says what this
        section actually is — the add-on for a team, storage and a custom domain
        — and points at where the main product lives.
      */}
      <p className="text-xs text-ink-muted">
        Extra team seats, more photo storage and a custom domain for your website. Your{" "}
        <Link href="/business/receptionist" className="font-medium text-primary">
          AI receptionist and business line
        </Link>{" "}
        are billed separately, on their own screen.
      </p>

      {hasSubscription ? (
        <>
          <dl className="divide-y divide-border">
            <Row label="Plan" value={infra.planName} />
            <Row label="Price" value={formatKobo(infra.priceKoboPerCycle)} />
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
        /*
         * No plans to buy here any more.
         *
         * Website & Hosting was sold in four cycles (₦5,000 monthly through
         * ₦50,000 yearly) and gated team seats, a custom domain and extra
         * storage. All of it is now included in the AI receptionist subscription,
         * so this panel reports what is included and points at the one place to
         * pay. Existing subscribers on the old plan keep it — the block above
         * still shows their renewal and a manage link.
         */
        <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
          <p className="text-xs text-ink-muted">
            Your website, hosting, team members and a custom domain are included in your AI receptionist subscription
            — there is nothing extra to buy here.
          </p>
          <Link href="/business/receptionist" className="mt-2 inline-block text-xs font-medium text-primary">
            Go to your AI receptionist subscription
          </Link>
        </div>
      )}
    </section>
  );
}
