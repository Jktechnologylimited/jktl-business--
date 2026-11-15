"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Landmark,
  ShieldCheck,
  Eye,
  EyeOff,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import * as actions from "@/lib/actions/team-payment-actions";
import type {
  PaymentDetails,
  PaymentReviewRow,
} from "@/lib/team-payments/model";
const labels = {
  PENDING: "Awaiting Owner approval",
  APPROVED: "Approved for manual team payments",
  REJECTED: "Needs an update",
  REMOVED: "No payment details saved",
};
const panel = "rounded-2xl border border-border bg-paper p-5 sm:p-6";
export function AccountSummary({ details }: { details: PaymentDetails }) {
  return (
    <div className="space-y-2 text-sm">
      <p className="font-semibold text-ink">{labels[details.status]}</p>
      {details.status !== "REMOVED" && (
        <>
          <p className="text-ink">{details.accountName}</p>
          <p className="text-ink-muted">
            {details.bankName} · Account ending {details.last4}
          </p>
          <p className="text-xs text-ink-faint">
            Bank verified{" "}
            {details.verifiedAt
              ? new Date(details.verifiedAt).toLocaleDateString("en-NG")
              : ""}
          </p>
        </>
      )}
      {details.reviewNote && (
        <p className="text-ink-muted">Owner note: {details.reviewNote}</p>
      )}
    </div>
  );
}
export function RevealAccount({
  details,
  own = false,
  disabled = false,
}: {
  details: PaymentDetails;
  own?: boolean;
  disabled?: boolean;
}) {
  const [revealed, setRevealed] = useState<{
    accountNumber: string;
    accountName: string;
    bankName: string;
  } | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!revealed) return;
    const clear = () => setRevealed(null);
    const timer = setTimeout(clear, 30000);
    const hide = () => {
      if (document.hidden) clear();
    };
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", hide);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [revealed]);
  async function reveal() {
    setBusy(true);
    setError("");
    try {
      const r = await actions.revealTeamBankAction({
        adminId: details.adminId,
        revision: details.revision,
        reason: own ? "SELF_REVIEW" : "PAYMENT_PREPARATION",
      });
      if (r.ok) {
        if (!document.hidden && document.hasFocus()) setRevealed(r.data);
      } else setError(r.error);
    } catch {
      setError("Could not open payment details. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || busy}
        onClick={() => (revealed ? setRevealed(null) : void reveal())}
      >
        {revealed ? (
          <EyeOff size={16} aria-hidden="true" />
        ) : (
          <Eye size={16} aria-hidden="true" />
        )}
        {revealed
          ? "Hide account number"
          : busy
            ? "Opening…"
            : "Show account number"}
      </Button>
      {revealed && (
        <div
          role="status"
          className="rounded-xl border border-border bg-surface p-3 text-sm text-ink"
        >
          <p>
            {revealed.bankName} · {revealed.accountName}
          </p>
          <p className="mt-2 select-all font-mono text-lg tracking-wider">
            {revealed.accountNumber}
          </p>
          <p className="mt-2 text-xs text-ink-muted">
            Hidden after 30 seconds or when you leave this window.
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
export function MyPaymentDetails() {
  const [details, setDetails] = useState<PaymentDetails | null>(null),
    [configured, setConfigured] = useState(false),
    [loading, setLoading] = useState(true);
  const [banks, setBanks] = useState<{ code: string; name: string }[]>([]),
    [bankCode, setBankCode] = useState(""),
    [accountNumber, setAccountNumber] = useState("");
  const [verifiedName, setVerifiedName] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const home = await actions.teamPaymentHomeAction();
      if (!home.ok) {
        setError(home.error);
        return;
      }
      setDetails(home.data.details);
      setConfigured(home.data.configured);
      if (home.data.configured) {
        const r = await actions.teamPaymentBanksAction();
        if (r.ok) setBanks(r.data);
        else setError(r.error);
      }
    } catch {
      setError("Could not load payment details. Please retry.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  function resetVerification() {
    setVerifiedName("");
    setConfirmed(false);
    setNotice("");
  }
  async function verify() {
    setBusy(true);
    setError("");
    setNotice("");
    setVerifiedName("");
    setConfirmed(false);
    try {
      const r = await actions.verifyTeamBankAction({ bankCode, accountNumber });
      if (r.ok) setVerifiedName(r.data.accountName);
      else setError(r.error);
    } catch {
      setError("Verification is unavailable. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await actions.submitTeamBankAction({
        bankCode,
        accountNumber,
        revision: details?.revision || 0,
        confirmed,
      });
      if (r.ok) {
        setDetails(r.data);
        setAccountNumber("");
        setBankCode("");
        resetVerification();
        setNotice(
          "Verified details submitted. Your Owner must approve them before use.",
        );
      } else setError(r.error);
    } catch {
      setError(
        "Could not save payment details. Please refresh before retrying.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (
      !details ||
      !window.confirm(
        "Remove your saved payment details? Your Owner will need new approved details before paying you.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const r = await actions.removeTeamBankAction(details.revision);
      if (r.ok) {
        setDetails(r.data);
        resetVerification();
        setNotice("Payment details removed.");
      } else setError(r.error);
    } catch {
      setError(
        "Could not remove payment details. Please refresh before retrying.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={panel} aria-labelledby="my-payment-title">
      <Landmark className="mb-3 size-6 text-primary" aria-hidden="true" />
      <h2
        id="my-payment-title"
        className="font-display text-xl font-semibold text-ink"
      >
        My payment details
      </h2>
      <p className="mt-2 text-sm leading-6 text-ink-muted">
        Add an account for your JKTL salary, allowance or contract payments.
        This is optional for platform access and required before receiving a
        team payment.
      </p>
      {loading ? (
        <p role="status" className="mt-5 text-sm">
          Loading your payment details…
        </p>
      ) : (
        <>
          <div className="mt-5 space-y-4 rounded-xl bg-surface p-4">
            {details ? (
              <AccountSummary details={details} />
            ) : (
              <p className="text-sm text-ink-muted">
                No payment details saved.
              </p>
            )}
            {details && details.status !== "REMOVED" && (
              <div className="flex flex-wrap items-start gap-3">
                <RevealAccount
                  key={details.revision}
                  details={details}
                  own
                  disabled={busy}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => void remove()}
                >
                  <Trash2 size={16} aria-hidden="true" /> Remove details
                </Button>
              </div>
            )}
          </div>
          {!configured ? (
            <p className="mt-5 text-sm text-ink-muted">
              Team payment verification is not available yet. Contact your
              Owner.
            </p>
          ) : (
            <form
              className="mt-6 max-w-xl space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <p className="text-sm text-ink-muted">
                A change replaces the saved details and requires a fresh
                verification and Owner approval.
              </p>
              <label className="block text-sm font-medium text-ink">
                Bank
                <Select
                  aria-label="Bank"
                  className="mt-2"
                  value={bankCode}
                  disabled={busy}
                  onChange={(e) => {
                    setBankCode(e.target.value);
                    resetVerification();
                  }}
                  required
                >
                  <option value="">Select your bank</option>
                  {banks.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block text-sm font-medium text-ink">
                Account number
                <Input
                  className="mt-2"
                  name="accountNumber"
                  autoComplete="off"
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  maxLength={10}
                  value={accountNumber}
                  disabled={busy}
                  onChange={(e) => {
                    setAccountNumber(e.target.value.replace(/\D/g, ""));
                    resetVerification();
                  }}
                  required
                />
              </label>
              <Button
                type="button"
                variant="outline"
                disabled={busy || !bankCode || accountNumber.length !== 10}
                onClick={() => void verify()}
              >
                <ShieldCheck size={16} aria-hidden="true" />
                {busy ? "Please wait…" : "Verify account"}
              </Button>
              {verifiedName && (
                <div className="space-y-3 rounded-xl bg-surface p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <CheckCircle2 size={16} aria-hidden="true" />
                    {verifiedName}
                  </p>
                  <label className="flex items-start gap-2 text-sm text-ink-muted">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      disabled={busy}
                      onChange={(e) => setConfirmed(e.target.checked)}
                      className="mt-1"
                    />
                    I confirm this account can receive my team payments.
                  </label>
                  <Button type="submit" disabled={busy || !confirmed}>
                    Submit for Owner approval
                  </Button>
                </div>
              )}
            </form>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 text-sm text-primary">
          {notice}
        </p>
      )}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="mt-4"
        disabled={busy || loading}
        onClick={() => void load()}
      >
        Refresh details
      </Button>
      <p className="mt-5 border-t border-border pt-4 text-xs leading-6 text-ink-faint">
        Your details are private to you and your Owner. Saving details does not
        initiate a transfer or authorise automatic payments.
      </p>
    </section>
  );
}
export function TeamPaymentReview() {
  const [rows, setRows] = useState<PaymentReviewRow[]>([]),
    [page, setPage] = useState(0),
    [more, setMore] = useState(false),
    [status, setStatus] = useState("PENDING");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const r = await actions.teamPaymentQueueAction(page, status);
      if (r.ok) {
        setRows(r.data.rows);
        setMore(r.data.more);
      } else {
        setError(r.error);
        setRows([]);
      }
    } catch {
      setError("Could not load the review queue. Please retry.");
    } finally {
      setBusy(false);
    }
  }, [page, status]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  async function review(
    row: PaymentReviewRow,
    decision: "APPROVED" | "REJECTED",
    note: string,
  ) {
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const r = await actions.reviewTeamBankAction({
        adminId: row.adminId,
        revision: row.revision,
        decision,
        note,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      await load();
      setNotice(
        decision === "APPROVED"
          ? "Account approved. Any bank transfer still requires your separate approval."
          : "Account rejected; the team member can update it.",
      );
    } catch {
      setError(
        "Could not complete the review. Refresh the queue before retrying.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={panel}>
      <h2 className="font-display text-xl font-semibold text-ink">
        Review team payment details
      </h2>
      <p className="mt-2 text-sm leading-6 text-ink-muted">
        Compare the team member with the bank-verified account holder. Approve
        the current version before preparing a manual payment.
      </p>
      <div className="my-5 flex flex-wrap items-end gap-3">
        <label className="text-sm text-ink">
          Status
          <Select
            aria-label="Review status"
            className="mt-2"
            value={status}
            disabled={busy}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            {["PENDING", "ALL", "APPROVED", "REJECTED", "REMOVED"].map((s) => (
              <option key={s} value={s}>
                {s === "ALL"
                  ? "All submissions"
                  : labels[s as keyof typeof labels]}
              </option>
            ))}
          </Select>
        </label>
        <Button variant="outline" disabled={busy} onClick={() => void load()}>
          Refresh queue
        </Button>
      </div>
      {error && (
        <p role="alert" className="mb-4 text-sm text-danger">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mb-4 text-sm text-primary">
          {notice}
        </p>
      )}
      {busy && (
        <p role="status" className="mb-3 text-sm text-ink-muted">
          Loading…
        </p>
      )}
      {!busy && !rows.length && (
        <p className="text-sm text-ink-muted">
          No matching submissions. Team members add their own details under My
          payment details.
        </p>
      )}
      <ul className="space-y-4">
        {rows.map((row) => (
          <li
            key={row.adminId + ":" + row.revision}
            className="rounded-xl border border-border bg-surface p-4"
          >
            <h3 className="font-semibold text-ink">{row.name}</h3>
            <p className="mb-3 text-xs text-ink-faint">
              {row.role.replaceAll("_", " ")}
            </p>
            <AccountSummary details={row} />
            {row.status === "PENDING" && (
              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void review(
                    row,
                    (e.nativeEvent as SubmitEvent).submitter?.getAttribute(
                      "value",
                    ) === "REJECTED"
                      ? "REJECTED"
                      : "APPROVED",
                    String(f.get("note") || ""),
                  );
                }}
              >
                <label className="block text-sm text-ink">
                  Review note (required for rejection)
                  <Input
                    className="mt-2"
                    name="note"
                    maxLength={500}
                    disabled={busy}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="submit"
                    name="decision"
                    value="APPROVED"
                    disabled={busy}
                  >
                    Approve verified details
                  </Button>
                  <Button
                    type="submit"
                    name="decision"
                    value="REJECTED"
                    variant="outline"
                    disabled={busy}
                  >
                    Reject
                  </Button>
                </div>
              </form>
            )}
            {row.status === "APPROVED" && (
              <div className="mt-4">
                <RevealAccount details={row} disabled={busy} />
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-5 flex items-center gap-3">
        <Button
          variant="outline"
          disabled={busy || page === 0}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </Button>
        <span className="text-sm text-ink-muted">Page {page + 1}</span>
        <Button
          variant="outline"
          disabled={busy || !more}
          onClick={() => setPage(page + 1)}
        >
          Next
        </Button>
      </div>
      <p className="mt-5 text-xs leading-6 text-ink-faint">
        Account-number access and changes are recorded. These records are
        separate from affiliate commissions and customer settlement accounts. No
        bank transfer is sent from this page.
      </p>
    </section>
  );
}
