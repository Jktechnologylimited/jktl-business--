"use client";

import { useState } from "react";
import { Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToastStore } from "@/lib/toast";
import { requestAffiliatePayoutAction } from "@/lib/actions/affiliate-actions";
import { formatKobo } from "@/lib/format";
import type { PayoutRequest } from "@/lib/db/affiliates";

interface Props {
  balanceKobo: number;
  bankVerified: boolean;
  payoutWindowOpen: boolean;
  initialRequest: PayoutRequest | null;
}

const STATUS_COPY: Record<PayoutRequest["status"], string> = {
  pending: "Requested — awaiting processing.",
  paid: "Paid this month.",
  declined: "Declined this month — you can request again from the 21st next month.",
};

/**
 * Requests are always for the *entire* current balance, once a month, from
 * the 21st onward (Africa/Lagos time) — see `requestPayout` in
 * src/lib/db/affiliates.ts for why. This never sends money automatically;
 * it just tells the command center an affiliate wants paying, so the admin
 * isn't the one who has to remember to check in.
 */
export function PayoutRequestCard({ balanceKobo, bankVerified, payoutWindowOpen, initialRequest }: Props) {
  const showToast = useToastStore((s) => s.show);
  const [request, setRequest] = useState(initialRequest);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    setRequesting(true);
    const result = await requestAffiliatePayoutAction();
    setRequesting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRequest(result.data);
    showToast("Payout requested");
  }

  const canRequest = !request && bankVerified && payoutWindowOpen && balanceKobo > 0;

  return (
    <section className="rounded-2xl border border-border p-4">
      <h2 className="font-display text-sm font-semibold text-ink">Get paid</h2>

      {request ? (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-surface p-3">
          <div>
            <div className="text-sm font-semibold text-ink">{formatKobo(request.amountKobo)}</div>
            <div className="text-xs text-ink-muted">{STATUS_COPY[request.status]}</div>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-1 text-xs text-ink-muted">
            {!bankVerified
              ? "Add and verify your bank details above, then come back here to request your payout."
              : !payoutWindowOpen
                ? "Payout requests open on the 21st of each month, for your full balance at that point."
                : balanceKobo <= 0
                  ? "You don't have a balance to request yet — refer a business that upgrades to start earning."
                  : "Requesting sends your full current balance to the command center for processing — you'll still be paid by bank transfer."}
          </p>
          {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
          <Button type="button" className="mt-3" disabled={!canRequest || requesting} onClick={submit}>
            {requesting ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />}
            Request payout {balanceKobo > 0 ? `(${formatKobo(balanceKobo)})` : ""}
          </Button>
        </>
      )}
    </section>
  );
}
