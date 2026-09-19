"use client";

import { useState } from "react";
import { BankDetailsForm } from "./bank-details-form";
import { PayoutRequestCard } from "./payout-request-card";
import type { PayoutRequest } from "@/lib/db/affiliates";

interface Props {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  bankVerifiedAt: string | null;
  balanceKobo: number;
  payoutWindowOpen: boolean;
  currentPayoutRequest: PayoutRequest | null;
}

/** Thin client wrapper so saving bank details can flip on the payout-request
 * card's "bank verified" state immediately, without a full page reload —
 * the dashboard page itself is a server component and can't hold that kind
 * of local state on its own. */
export function AffiliatePayoutSection(props: Props) {
  const [bank, setBank] = useState({
    bankName: props.bankName,
    accountNumber: props.accountNumber,
    accountName: props.accountName,
    verified: Boolean(props.bankVerifiedAt),
  });

  return (
    <>
      <BankDetailsForm
        bankCode={props.bankCode}
        bankName={bank.bankName}
        accountNumber={bank.accountNumber}
        accountName={bank.accountName}
        verified={bank.verified}
        onSaved={(details) => setBank({ ...details, verified: true })}
      />
      <PayoutRequestCard
        balanceKobo={props.balanceKobo}
        bankVerified={bank.verified}
        payoutWindowOpen={props.payoutWindowOpen}
        initialRequest={props.currentPayoutRequest}
      />
    </>
  );
}
