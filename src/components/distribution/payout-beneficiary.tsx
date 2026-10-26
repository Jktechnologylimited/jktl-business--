"use client";
import { useState } from "react";
import { distributionBeneficiaryAction } from "@/lib/actions/distribution-finance-actions";
export function PayoutBeneficiary({ id }: { id: string }) {
  const [bank, setBank] = useState<Awaited<
      ReturnType<typeof distributionBeneficiaryAction>
    > | null>(null),
    [error, setError] = useState("");
  return (
    <div>
      {bank ? (
        <div className="rounded-lg border border-border p-3">
          <p>
            {bank.bankName} · bank code {bank.bankCode}
          </p>
          <p>
            {bank.accountNumber} · {bank.accountName}
          </p>
          <button
            type="button"
            className="mt-2 underline"
            onClick={() => setBank(null)}
          >
            Hide beneficiary
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="underline"
          onClick={async () => {
            try {
              setBank(await distributionBeneficiaryAction(id));
            } catch {
              setError(
                "You need current payout permission to view the saved beneficiary.",
              );
            }
          }}
        >
          View saved beneficiary for manual transfer (audited)
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
