"use client";

import { useState } from "react";
import { AlertTriangle, Banknote, CreditCard, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatKobo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useToastStore } from "@/lib/toast";
import type { WalletSnapshot, WalletTransaction } from "@/lib/ai/types";

/**
 * The pay-as-you-go communication wallet.
 *
 * This screen exists because of one commercial decision: the clinic funds its
 * own messaging, so JKTL's margin cannot be eaten by a runaway call volume.
 * The numbers are therefore presented the way a clinic manager thinks about
 * them — "how many more messages does this buy me" — not just a raw balance,
 * and the low-balance state is loud, because a blocked callback is a patient
 * the clinic silently failed to call back.
 */

const QUICK_TOP_UPS = [2_000, 5_000, 10_000, 20_000];

const KIND_LABEL: Record<WalletTransaction["kind"], string> = {
  topup: "Top-up",
  grant: "Free credit",
  sms: "SMS",
  whatsapp: "WhatsApp",
  voice: "Voice",
  refund: "Refund",
  adjustment: "Adjustment",
};

export function WalletPanel({
  wallet,
  transactions,
  demo,
  busy,
  onTopUpWithCard,
  onRecordTopUp,
}: {
  wallet: WalletSnapshot;
  transactions: WalletTransaction[];
  demo: boolean;
  busy: boolean;
  onTopUpWithCard: (naira: number) => void;
  onRecordTopUp: (naira: number, reference: string, note: string) => void;
}) {
  const show = useToastStore((s) => s.show);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferNote, setTransferNote] = useState("");
  // Generated once per mount, so double-tapping "Record" credits the wallet
  // once — the ledger rejects the duplicate reference.
  const [reference] = useState(() => (typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now())));
  const [showTransfer, setShowTransfer] = useState(false);

  function topUp(naira: number) {
    if (demo) {
      show("Demo mode — connect a live account to top up", "danger");
      return;
    }
    onTopUpWithCard(naira);
  }

  function recordTransfer() {
    if (demo) {
      show("Demo mode — connect a live account to record a top-up", "danger");
      return;
    }
    const naira = Number(transferAmount);
    if (!Number.isFinite(naira) || naira <= 0) {
      show("Enter the amount you received", "danger");
      return;
    }
    onRecordTopUp(naira, reference, transferNote);
    setTransferAmount("");
    setTransferNote("");
  }

  return (
    <section className="rounded-2xl border border-border bg-paper p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 font-display text-base font-semibold text-ink">
            <Wallet className="size-4 text-primary" /> Communication wallet
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">Messages are paid for from this balance. Inference is included in your subscription.</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <div className="text-xs font-medium text-ink-muted">Balance</div>
          <div className={cn("font-display text-2xl font-bold tracking-tight", wallet.isLow ? "text-danger" : "text-ink")}>
            {formatKobo(wallet.balanceKobo)}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-ink-muted">Callback messages left</div>
          <div className="font-display text-lg font-semibold text-ink">{wallet.smsRemaining.toLocaleString("en-NG")}</div>
        </div>
        <div>
          <div className="text-xs font-medium text-ink-muted">Cost per message</div>
          <div className="font-display text-lg font-semibold text-ink">{formatKobo(wallet.smsUnitCostKobo, { showKobo: true })}</div>
        </div>
      </div>

      {/* The free allocation, stated plainly. A clinic should be able to see
          exactly how much of the credit we gave it is left, and know that the
          ask for money only starts once it is gone — which is why this switches
          tone exactly once (`freeExhausted`) rather than nagging throughout. */}
      <div
        className={cn(
          "mt-4 rounded-xl border px-3 py-2.5 text-[13px]",
          wallet.freeExhausted ? "border-accent/40 bg-accent-soft text-ink" : "border-primary/30 bg-primary-soft text-ink",
        )}
      >
        {wallet.freeExhausted ? (
          <span>
            <strong className="font-semibold">Your free credit is used up.</strong> The assistant has stopped sending callbacks until
            the wallet is topped up — those missed calls are being recorded, not answered.
          </span>
        ) : (
          <span>
            <strong className="font-semibold">{formatKobo(wallet.freeKobo)} of free credit left</strong> — about{" "}
            {wallet.freeSmsRemaining.toLocaleString("en-NG")} more callback messages. Nothing to pay until it runs out; we&apos;ll
            ask you to top up then.
            {wallet.hasToppedUp ? ` Paid balance: ${formatKobo(wallet.paidKobo)}.` : ""}
          </span>
        )}
      </div>

      {wallet.isLow ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-[13px] text-ink">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <div>
            <strong className="font-semibold text-danger">Wallet running low.</strong> Below {formatKobo(wallet.lowBalanceThresholdKobo)}, the
            assistant stops sending callbacks and records the calls it could not answer.
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {QUICK_TOP_UPS.map((naira) => (
          <Button key={naira} size="sm" variant="outline" disabled={busy} onClick={() => topUp(naira)}>
            <CreditCard className="size-3.5" /> {formatKobo(naira * 100)}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => setShowTransfer((v) => !v)}>
          <Banknote className="size-3.5" /> Bank transfer
        </Button>
      </div>

      {showTransfer ? (
        <div className="mt-3 rounded-xl border border-border bg-surface p-3">
          <p className="text-xs text-ink-muted">
            Received a transfer into the JKTL account for this business? Record it here so the wallet reflects it immediately.
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Input
              inputMode="decimal"
              placeholder="Amount in ₦"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              className="h-10 sm:max-w-[160px]"
              aria-label="Transfer amount in naira"
            />
            <Input
              placeholder="Note (bank, teller reference)"
              value={transferNote}
              onChange={(e) => setTransferNote(e.target.value)}
              className="h-10"
              aria-label="Transfer note"
            />
            <Button size="sm" className="h-10" disabled={busy} onClick={recordTransfer}>
              Record
            </Button>
          </div>
        </div>
      ) : null}

      {transactions.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-surface text-[11px] uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">Detail</th>
                <th className="px-3 py-2 text-right font-semibold">Amount</th>
                <th className="hidden px-3 py-2 text-right font-semibold sm:table-cell">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {transactions.slice(0, 10).map((tx) => (
                <tr key={tx.id}>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                        tx.amountKobo >= 0 ? "bg-primary-soft text-primary-strong" : "bg-surface-strong text-ink-muted",
                      )}
                    >
                      {KIND_LABEL[tx.kind]}
                    </span>
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-2 text-ink-muted" title={tx.description}>
                    {tx.description || "—"}
                  </td>
                  <td className={cn("whitespace-nowrap px-3 py-2 text-right font-medium", tx.amountKobo >= 0 ? "text-primary-strong" : "text-ink")}>
                    {tx.amountKobo >= 0 ? "+" : "−"}
                    {formatKobo(Math.abs(tx.amountKobo), { showKobo: true })}
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-2 text-right text-ink-muted sm:table-cell">
                    {formatKobo(tx.balanceAfterKobo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-sm text-ink-muted">No wallet activity yet.</p>
      )}
    </section>
  );
}
