"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import { useToastStore } from "@/lib/toast";
import {
  listBanksAction,
  getPaymentSettingsAction,
  verifyAccountAction,
  savePaymentSettingsAction,
} from "@/lib/actions/payment-settings-actions";
import type { PaystackBank } from "@/lib/paystack";
import type { PaymentSettings } from "@/lib/db/payments";

const DEMO_SETTINGS: PaymentSettings = {
  organizationId: "",
  bankCode: "",
  bankName: "",
  accountNumber: "",
  accountName: "",
  subaccountCode: "",
};

/**
 * Where a business connects the bank account their invoice payment links
 * (Settings → Payments) pay straight into. Live mode only — this needs a
 * real Paystack Subaccount, which demo mode has no backend for, so it
 * just explains what the feature does instead of pretending to save
 * anything.
 */
export function PaymentSettingsPanel({ mode }: { mode: "demo" | "live" }) {
  const showToast = useToastStore((s) => s.show);
  const [banks, setBanks] = useState<PaystackBank[]>([]);
  const [settings, setSettings] = useState<PaymentSettings>(DEMO_SETTINGS);
  const [loading, setLoading] = useState(mode === "live");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [resolvedName, setResolvedName] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (mode !== "live") return;
    Promise.all([listBanksAction(), getPaymentSettingsAction()]).then(([banksResult, settingsResult]) => {
      if (banksResult.ok) setBanks(banksResult.data);
      if (settingsResult.ok) {
        setSettings(settingsResult.data);
        setBankCode(settingsResult.data.bankCode);
        setAccountNumber(settingsResult.data.accountNumber);
      }
      setLoading(false);
    });
  }, [mode]);

  async function verify() {
    setError("");
    setResolvedName("");
    if (!bankCode || accountNumber.trim().length < 10) {
      setError("Choose a bank and enter a 10-digit account number.");
      return;
    }
    setVerifying(true);
    const result = await verifyAccountAction(bankCode, accountNumber.trim());
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
    const result = await savePaymentSettingsAction({ bankCode, bankName: bank.name, accountNumber: accountNumber.trim() });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSettings(result.data);
    setResolvedName("");
    showToast("Payment details saved — your invoice links are ready");
  }

  if (mode !== "live") {
    return (
      <section className="rounded-2xl border border-border p-4">
        <h2 className="font-display text-sm font-semibold text-ink">Payments</h2>
        <p className="mt-1 text-xs text-ink-muted">
          Enter your bank account here to turn on invoice payment links — a customer taps the link, pays online, and it lands straight in
          your account. Available on a real account (not this demo).
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border p-4">
      <h2 className="font-display text-sm font-semibold text-ink">Payments</h2>
      <p className="mt-1 text-xs text-ink-muted">
        The account your invoice payment links pay into. A ₦50 processing fee is added to what the customer pays — you always receive the
        full invoice amount.
      </p>

      {loading ? (
        <p className="mt-3 text-sm text-ink-muted">Loading…</p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {settings.subaccountCode ? (
            <div className="flex items-center gap-2 rounded-xl bg-primary-soft px-3 py-2.5 text-sm text-primary-strong">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>
                Payments go to <strong>{settings.accountName}</strong> · {settings.bankName} · {settings.accountNumber}
              </span>
            </div>
          ) : null}

          <Field label="Bank" htmlFor="pay-bank">
            <Select id="pay-bank" value={bankCode} onChange={(e) => { setBankCode(e.target.value); setResolvedName(""); }}>
              <option value="">Select your bank</option>
              {banks.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Account number" htmlFor="pay-account">
            <Input
              id="pay-account"
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
          <p className="text-xs text-ink-muted">Verify the account name matches before saving — this is exactly where your customers&apos; payments will go.</p>
        </div>
      )}
    </section>
  );
}
