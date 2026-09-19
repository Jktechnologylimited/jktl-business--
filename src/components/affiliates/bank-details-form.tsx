"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import { useToastStore } from "@/lib/toast";
import {
  listBanksForAffiliateAction,
  verifyAffiliateAccountAction,
  saveAffiliateBankDetailsAction,
} from "@/lib/actions/affiliate-actions";
import type { PaystackBank } from "@/lib/paystack";

interface Props {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  verified: boolean;
  onSaved: (details: { bankName: string; accountNumber: string; accountName: string }) => void;
}

/**
 * Verified via Paystack's free account-resolve endpoint — same one
 * Settings → Payments uses for a business's own payout account — so the
 * command center always has a *confirmed* account to pay the affiliate
 * into, not just whatever they typed. No Paystack Subaccount here (that's
 * for automated split payments); payouts stay a manual bank transfer the
 * admin makes and records, this just removes the "did I copy the account
 * number right" risk from that step.
 */
export function BankDetailsForm({ bankCode: initialBankCode, bankName, accountNumber: initialAccountNumber, accountName, verified, onSaved }: Props) {
  const showToast = useToastStore((s) => s.show);
  const [banks, setBanks] = useState<PaystackBank[]>([]);
  const [banksLoading, setBanksLoading] = useState(true);
  const [bankCode, setBankCode] = useState(initialBankCode);
  const [accountNumber, setAccountNumber] = useState(initialAccountNumber);
  const [resolvedName, setResolvedName] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listBanksForAffiliateAction().then((result) => {
      if (result.ok) setBanks(result.data);
      setBanksLoading(false);
    });
  }, []);

  async function verify() {
    setError("");
    setResolvedName("");
    if (!bankCode || accountNumber.trim().length < 10) {
      setError("Choose a bank and enter a 10-digit account number.");
      return;
    }
    setVerifying(true);
    const result = await verifyAffiliateAccountAction(bankCode, accountNumber.trim());
    setVerifying(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setResolvedName(result.data.accountName);
  }

  async function save() {
    setError("");
    const bank = banks.find((b) => b.code === bankCode);
    if (!bank) {
      setError("Choose a bank first.");
      return;
    }
    setSaving(true);
    const result = await saveAffiliateBankDetailsAction({ bankCode, bankName: bank.name, accountNumber: accountNumber.trim() });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved({ bankName: bank.name, accountNumber: accountNumber.trim(), accountName: resolvedName });
    setResolvedName("");
    showToast("Bank details saved and verified");
  }

  return (
    <section className="rounded-2xl border border-border p-4">
      <h2 className="font-display text-sm font-semibold text-ink">Bank details for payouts</h2>
      <p className="mt-1 text-xs text-ink-muted">
        Verified through Paystack so there&apos;s no risk of a mistyped account number — this is exactly where your payout will be sent.
      </p>

      <div className="mt-3 flex flex-col gap-3">
        {verified ? (
          <div className="flex items-center gap-2 rounded-xl bg-primary-soft px-3 py-2.5 text-sm text-primary-strong">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>
              Payouts go to <strong>{accountName}</strong> · {bankName} · {initialAccountNumber}
            </span>
          </div>
        ) : null}

        <Field label="Bank" htmlFor="aff-bank">
          <Select
            id="aff-bank"
            value={bankCode}
            disabled={banksLoading}
            onChange={(e) => { setBankCode(e.target.value); setResolvedName(""); }}
          >
            <option value="">{banksLoading ? "Loading banks…" : "Select your bank"}</option>
            {banks.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Account number" htmlFor="aff-account">
          <Input
            id="aff-account"
            inputMode="numeric"
            maxLength={10}
            value={accountNumber}
            onChange={(e) => { setAccountNumber(e.target.value.replace(/\D/g, "")); setResolvedName(""); }}
            placeholder="0123456789"
          />
        </Field>

        {resolvedName ? (
          <div className="flex items-center gap-2 rounded-xl bg-primary-soft px-3 py-2.5 text-sm text-primary-strong">
            <CheckCircle2 className="size-4 shrink-0" /> {resolvedName}
          </div>
        ) : null}

        {error ? <p className="text-xs text-danger">{error}</p> : null}

        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={verify} disabled={verifying || saving}>
            {verifying ? <Loader2 className="size-4 animate-spin" /> : null}
            Verify account
          </Button>
          <Button type="button" className="flex-1" onClick={save} disabled={!resolvedName || saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
        <p className="text-xs text-ink-muted">Verify the account name matches you before saving.</p>
      </div>
    </section>
  );
}
