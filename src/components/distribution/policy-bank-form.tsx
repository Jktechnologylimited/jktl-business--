"use client";
import { useState } from "react";
import { BankDetailsForm } from "@/components/affiliates/bank-details-form";
export function PolicyBankForm({
  bank,
}: {
  bank: {
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    verified: boolean;
  };
}) {
  const [saved, setSaved] = useState("");
  return (
    <details className="rounded-xl border border-border p-5">
      <summary>Manage verified payout bank details</summary>
      <p className="my-3">
        {bank.bankName || "No verified bank"} ·{" "}
        {bank.accountNumber
          ? "ending " + bank.accountNumber.slice(-4)
          : "Add an account"}
      </p>
      <BankDetailsForm
        {...bank}
        onSaved={() =>
          setSaved(
            "Verified payout account saved. Future requests use these details; existing requests retain their original beneficiary snapshot.",
          )
        }
      />
      {saved && <p role="status">{saved}</p>}
    </details>
  );
}
