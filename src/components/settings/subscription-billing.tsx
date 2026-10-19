"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, CreditCard, Loader2, RefreshCw, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/app/status-pill";
import { formatKobo, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useToastStore } from "@/lib/toast";
import {
  getSubscriptionBillingAction,
  retryChargeNowAction,
  setAutoChargeAction,
  startContractPaymentAction,
} from "@/lib/actions/receptionist-actions";

/**
 * The AI receptionist subscription, on the Billing screen.
 *
 * It belongs here rather than only inside the receptionist console because this
 * is the page a business owner opens when they are thinking about money, and a
 * subscription that debits a card every month is exactly the thing they should
 * be able to see, understand and stop from one place.
 *
 * The screen answers four questions in order: what am I paying, when is the
 * next one, which card will it come off, and did the last attempt work. The
 * last one matters most — an invisible failed charge is how a clinic discovers
 * its phone line stopped answering without knowing why.
 */

/** Derived from the action rather than redeclared, so the screen cannot drift
 * from what the server actually sends. */
type BillingData = Extract<Awaited<ReturnType<typeof getSubscriptionBillingAction>>, { ok: true }>["data"];

export function SubscriptionBilling({ demo }: { demo: boolean }) {
  const show = useToastStore((s) => s.show);
  const [data, setData] = useState<BillingData | null>(null);
  const [busy, setBusy] = useState("");
  const [failed, setFailed] = useState(false);

  async function load() {
    if (demo) return; // demo mode has no server data; the console's sample contract covers it
    const result = await getSubscriptionBillingAction();
    if (result.ok) setData(result.data);
    else setFailed(true);
  }

  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    void (async () => {
      // Awaited before any state update, so the effect body itself never
      // triggers a synchronous re-render.
      const result = await getSubscriptionBillingAction();
      if (cancelled) return;
      if (result.ok) setData(result.data);
      else setFailed(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [demo]);

  async function run(label: string, fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setBusy(label);
    try {
      const result = await fn();
      if (result.ok) {
        show(success);
        await load();
      } else {
        show(result.error ?? "Something went wrong.", "danger");
      }
    } finally {
      setBusy("");
    }
  }

  if (demo) {
    return (
      <section className="rounded-2xl border border-border bg-paper p-5">
        <h2 className="font-display text-base font-semibold text-ink">AI receptionist subscription</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Demo mode — subscription billing isn&apos;t active here. Open the AI receptionist console to see a sample contract with its
          instalment schedule.
        </p>
        <Link href="/business/receptionist" className="mt-3 inline-block text-sm font-medium text-primary">
          Open the AI receptionist console
        </Link>
      </section>
    );
  }

  if (failed) {
    return (
      <section className="rounded-2xl border border-border bg-paper p-5">
        <h2 className="font-display text-base font-semibold text-ink">AI receptionist subscription</h2>
        <p className="mt-1 text-sm text-ink-muted">We couldn&apos;t load your subscription just now.</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="flex items-center gap-2 rounded-2xl border border-border bg-paper p-5 text-sm text-ink-muted">
        <Loader2 className="size-4 animate-spin" /> Loading your subscription…
      </section>
    );
  }

  if (!data.contract) {
    return null; // no receptionist on this account — nothing to bill for
  }

  const { contract, due, history, monthsPaid } = data;
  const cancelled = contract.status === "cancelled";
  const inInstalments = monthsPaid < contract.setupMonths;
  const lastFailed = history.find((h) => h.status === "failed" && h.monthIndex === monthsPaid + 1);
  const payableKobo = due?.amountKobo ?? (inInstalments ? contract.setupMonthlyKobo : contract.monthlyFeeKobo);

  return (
    <section className="rounded-2xl border border-border bg-paper p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 font-display text-base font-semibold text-ink">
            <Repeat className="size-4 text-primary" /> AI receptionist subscription
          </h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            {inInstalments
              ? `${formatKobo(contract.setupMonthlyKobo, { showKobo: true })} a month until the ${formatKobo(contract.setupFeeKobo)} launch package is paid off, then ${formatKobo(contract.monthlyFeeKobo)} a month.`
              : `${formatKobo(contract.monthlyFeeKobo)} a month. Cancel anytime.`}
          </p>
        </div>
        <StatusPill tone={cancelled ? "neutral" : lastFailed ? "danger" : "primary"}>
          {cancelled ? "Cancelled" : lastFailed ? "Payment issue" : "Active"}
        </StatusPill>
      </div>

      {/* What went wrong, if anything — the single most useful line here. */}
      {!cancelled && (lastFailed || contract.lastChargeError) ? (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-[13px] text-ink">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <div>
            <strong className="font-semibold text-danger">Your last payment didn&apos;t go through.</strong>{" "}
            {contract.lastChargeError || lastFailed?.error}
            <span className="mt-0.5 block text-xs text-ink-muted">
              We&apos;ll try again tomorrow. Update the card below, or pay this month by hand.
            </span>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <div className="text-xs font-medium text-ink-muted">Next payment</div>
          <div className="font-display text-lg font-semibold text-ink">
            {cancelled ? "—" : formatKobo(payableKobo, { showKobo: true })}
          </div>
          <div className="text-xs text-ink-muted">
            {cancelled
              ? "No further payments will be taken"
              : due?.due
                ? `Due now (month ${due.monthIndex})`
                : contract.nextChargeAt
                  ? `Around ${formatShortDate(contract.nextChargeAt)}`
                  : "Scheduled by your card"}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-ink-muted">Payments made</div>
          <div className="font-display text-lg font-semibold text-ink">{monthsPaid}</div>
          <div className="text-xs text-ink-muted">
            {inInstalments ? `${contract.setupMonths - monthsPaid} instalment(s) left` : "On the monthly tier"}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-ink-muted">Card on file</div>
          <div className="font-display text-lg font-semibold text-ink">
            {contract.hasCard ? `•••• ${contract.cardLast4}` : "None"}
          </div>
          <div className="text-xs text-ink-muted">
            {contract.hasCard
              ? `${contract.cardBrand || "Card"} · expires ${contract.cardExpMonth}/${contract.cardExpYear}`
              : "Make one payment and we'll reuse that card"}
          </div>
        </div>
      </div>

      {/* Automatic collection. */}
      {!cancelled ? (
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
          <input
            type="checkbox"
            checked={contract.autoChargeEnabled}
            disabled={Boolean(busy) || !contract.hasCard}
            onChange={(e) =>
              void run(
                "auto",
                () => setAutoChargeAction(e.target.checked),
                e.target.checked ? "Automatic payment is on." : "Automatic payment is off.",
              )
            }
            className="mt-0.5 size-4 accent-primary"
          />
          <span>
            <span className="block text-sm font-medium text-ink">
              Pay automatically each month {!contract.hasCard ? <span className="text-ink-muted">(add a card first)</span> : null}
            </span>
            <span className="block text-xs text-ink-muted">
              Your subscription renews itself and the assistant keeps answering. Turn this off if you would rather pay by hand — we&apos;ll
              remind you instead.
            </span>
          </span>
        </label>
      ) : null}

      {!cancelled ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={Boolean(busy)}
            onClick={() =>
              void run(
                "pay",
                async () => {
                  const result = await startContractPaymentAction();
                  if (result.ok) {
                    window.location.href = result.data.authorizationUrl;
                    return { ok: true };
                  }
                  return { ok: false, error: result.error };
                },
                "Opening secure payment…",
              )
            }
          >
            <CreditCard className="size-3.5" />
            {contract.hasCard ? `Pay month ${monthsPaid + 1}` : `Add a card & pay ${formatKobo(payableKobo, { showKobo: true })}`}
          </Button>
          {contract.hasCard && !contract.autoChargeEnabled ? (
            <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void run("retry", retryChargeNowAction, "Payment attempt finished.")}>
              {busy === "retry" ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Charge now
            </Button>
          ) : null}
          <Link href="/business/receptionist" className="inline-flex h-8 items-center px-3 text-sm font-medium text-primary">
            Manage the assistant
          </Link>
        </div>
      ) : null}

      {/* History: every attempt, successful or not. */}
      {history.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-surface text-[11px] uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-3 py-2 font-semibold">Month</th>
                <th className="px-3 py-2 font-semibold">Amount</th>
                <th className="px-3 py-2 font-semibold">Result</th>
                <th className="px-3 py-2 text-right font-semibold">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.map((entry) => (
                <tr key={entry.monthIndex}>
                  <td className="px-3 py-2 text-ink">{entry.monthIndex}</td>
                  <td className="px-3 py-2 text-ink-muted">{formatKobo(entry.amountKobo, { showKobo: true })}</td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1",
                        entry.status === "charged" ? "text-primary-strong" : entry.status === "failed" ? "text-danger" : "text-ink-muted",
                      )}
                    >
                      {entry.status === "charged" ? <CheckCircle2 className="size-3.5" /> : null}
                      {entry.status === "charged" ? "Paid" : entry.status === "failed" ? `Declined${entry.attempts > 1 ? ` (${entry.attempts} tries)` : ""}` : "Pending"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-ink-muted">{formatShortDate(entry.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="mt-3 text-xs text-ink-faint">
        Cancel any time from the AI receptionist console — there is no minimum term, and unbilled instalments are never charged.
      </p>
    </section>
  );
}
