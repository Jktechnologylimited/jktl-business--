"use client";
import {RecordDetailsEditor} from "./record-details-editor";

import { useState } from "react";
import { Banknote, Check, Copy, Gift, Loader2, Pause, Play, UserPlus, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Field } from "@/components/app/field";
import { useToastStore } from "@/lib/toast";
import { formatKobo, nairaToKobo, formatRelativeDay } from "@/lib/format";
import {
  createAffiliateAction,
  setAffiliateStatusAction,
  approveAffiliateApplicationAction,
  rejectAffiliateApplicationAction,
  recordAffiliatePayoutAction,
  markPayoutRequestPaidAction,
  declinePayoutRequestAction,
} from "@/lib/actions/admin-actions";
import type { AffiliateStats, PendingPayoutRequest } from "@/lib/db/affiliates";

/**
 * Command center's affiliate management — create an affiliate account
 * (this sets their initial password directly; there's no public affiliate
 * signup, same reasoning as admin accounts), see each one's running
 * balance (earnings minus payouts, computed on the server — never a
 * stored counter that could drift), suspend/reactivate one, and log a
 * manual payout once you've actually paid them by bank transfer.
 */
export function AffiliateManager({
  initialAffiliates,
  initialPayoutRequests,
  origin,
}: {
  initialAffiliates: AffiliateStats[];
  initialPayoutRequests: PendingPayoutRequest[];
  origin: string;
}) {
  const showToast = useToastStore((s) => s.show);
  const [affiliates, setAffiliates] = useState(initialAffiliates);
  const [payoutRequests, setPayoutRequests] = useState(initialPayoutRequests);
  const [resolvingRequest, setResolvingRequest] = useState<string | null>(null);
  const [requestNote, setRequestNote] = useState<Record<string, string>>({});

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [commissionPercent, setCommissionPercent] = useState("20");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [payoutFor, setPayoutFor] = useState<string | null>(null);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutNote, setPayoutNote] = useState("");
  const [payoutPending, setPayoutPending] = useState(false);
  const [payoutError, setPayoutError] = useState("");

  const [reviewing, setReviewing] = useState<string | null>(null);

  const pendingApplications = affiliates.filter((a) => a.status === "pending");
  const otherAffiliates = affiliates.filter((a) => a.status !== "pending");

  async function approve(affiliateId: string) {
    setReviewing(affiliateId);
    const result = await approveAffiliateApplicationAction(affiliateId);
    setReviewing(null);
    if (!result.ok) {
      showToast(result.error, "danger");
      return;
    }
    setAffiliates((list) => list.map((a) => (a.id === affiliateId ? { ...a, status: "active" } : a)));
    showToast("Affiliate approved");
  }

  async function reject(affiliateId: string) {
    setReviewing(affiliateId);
    const result = await rejectAffiliateApplicationAction(affiliateId);
    setReviewing(null);
    if (!result.ok) {
      showToast(result.error, "danger");
      return;
    }
    setAffiliates((list) => list.filter((a) => a.id !== affiliateId));
    showToast("Application rejected");
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    const percent = Number(commissionPercent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      setCreateError("Commission must be a percentage between 0 and 100.");
      return;
    }
    setCreating(true);
    const result = await createAffiliateAction({ name, email, password, commissionBps: Math.round(percent * 100) });
    setCreating(false);
    if (!result.ok) {
      setCreateError(result.error);
      return;
    }
    setAffiliates((list) => [result.data, ...list]);
    setName("");
    setEmail("");
    setPassword("");
    setCommissionPercent("20");
    showToast(`Affiliate account created — referral code ${result.data.referralCode}`);
  }

  async function toggleStatus(affiliate: AffiliateStats) {
    const next = affiliate.status === "active" ? "suspended" : "active";
    const result = await setAffiliateStatusAction(affiliate.id, next);
    if (!result.ok) {
      showToast(result.error, "danger");
      return;
    }
    setAffiliates((list) => list.map((a) => (a.id === affiliate.id ? { ...a, status: next } : a)));
    showToast(next === "suspended" ? "Affiliate suspended" : "Affiliate reactivated");
  }

  function copyLink(referralCode: string) {
    const link = `${origin}/signup?ref=${referralCode}`;
    navigator.clipboard?.writeText(link).then(
      () => showToast("Referral link copied"),
      () => showToast("Couldn't copy — copy it manually", "danger"),
    );
  }

  async function submitPayout(affiliateId: string) {
    setPayoutError("");
    const naira = Number(payoutAmount.replace(/,/g, ""));
    if (!Number.isFinite(naira) || naira <= 0) {
      setPayoutError("Enter a valid amount.");
      return;
    }
    setPayoutPending(true);
    const result = await recordAffiliatePayoutAction(affiliateId, nairaToKobo(naira), payoutNote);
    setPayoutPending(false);
    if (!result.ok) {
      setPayoutError(result.error);
      return;
    }
    setAffiliates((list) =>
      list.map((a) =>
        a.id === affiliateId
          ? { ...a, totalPaidOutKobo: a.totalPaidOutKobo + result.data.amountKobo, balanceKobo: a.balanceKobo - result.data.amountKobo }
          : a,
      ),
    );
    setPayoutFor(null);
    setPayoutAmount("");
    setPayoutNote("");
    showToast("Payout recorded");
  }

  async function markPaid(request: PendingPayoutRequest) {
    setResolvingRequest(request.id);
    const result = await markPayoutRequestPaidAction(request.id, requestNote[request.id] ?? "");
    setResolvingRequest(null);
    if (!result.ok) {
      showToast(result.error, "danger");
      return;
    }
    setPayoutRequests((list) => list.filter((r) => r.id !== request.id));
    setAffiliates((list) =>
      list.map((a) =>
        a.id === request.affiliateId
          ? { ...a, totalPaidOutKobo: a.totalPaidOutKobo + result.data.amountKobo, balanceKobo: a.balanceKobo - result.data.amountKobo }
          : a,
      ),
    );
    showToast("Payout request marked paid");
  }

  async function declineRequest(request: PendingPayoutRequest) {
    setResolvingRequest(request.id);
    const result = await declinePayoutRequestAction(request.id);
    setResolvingRequest(null);
    if (!result.ok) {
      showToast(result.error, "danger");
      return;
    }
    setPayoutRequests((list) => list.filter((r) => r.id !== request.id));
    showToast("Payout request declined");
  }

  return (
    <div className="flex flex-col gap-6">
      {pendingApplications.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-sm font-semibold text-ink">
            Pending applications <span className="text-ink-muted">({pendingApplications.length})</span>
          </h2>
          {pendingApplications.map((a) => (
            <div key={a.id} className="rounded-2xl border border-border-strong bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-ink">{a.name}</div>
                  <div className="text-xs text-ink-muted">{a.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="outline" disabled={reviewing === a.id} onClick={() => reject(a.id)}>
                    {reviewing === a.id ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
                    Reject
                  </Button>
                  <Button type="button" size="sm" disabled={reviewing === a.id} onClick={() => approve(a.id)}>
                    {reviewing === a.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                    Approve
                  </Button>
                </div>
              </div>
              <RecordDetailsEditor kind="affiliate" id={a.id} />
              {a.applicationNote ? <p className="mt-2 text-xs text-ink-muted">&ldquo;{a.applicationNote}&rdquo;</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      {payoutRequests.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-sm font-semibold text-ink">
            Payout requests <span className="text-ink-muted">({payoutRequests.length})</span>
          </h2>
          {payoutRequests.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border-strong bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-ink">{r.affiliateName}</div>
                  <div className="text-xs text-ink-muted">{r.affiliateEmail}</div>
                  <div className="mt-1 text-xs text-ink-muted">Requested {formatRelativeDay(r.requestedAt)}</div>
                </div>
                <div className="text-right">
                  <div className="text-base font-semibold text-primary">{formatKobo(r.amountKobo)}</div>
                </div>
              </div>

              {r.accountNumber ? (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-muted">
                  <Banknote className="size-3.5 shrink-0" />
                  <strong className="text-ink">{r.accountName}</strong> · {r.bankName} · {r.accountNumber}
                </div>
              ) : (
                <p className="mt-2 text-xs text-danger">No verified bank details yet — ask them to add these in their dashboard.</p>
              )}

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Field label="Note (optional)" htmlFor={`request-note-${r.id}`}>
                    <Input
                      id={`request-note-${r.id}`}
                      value={requestNote[r.id] ?? ""}
                      onChange={(e) => setRequestNote((n) => ({ ...n, [r.id]: e.target.value }))}
                      placeholder="Bank transfer ref…"
                    />
                  </Field>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" disabled={resolvingRequest === r.id} onClick={() => declineRequest(r)}>
                    {resolvingRequest === r.id ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
                    Decline
                  </Button>
                  <Button type="button" size="sm" disabled={resolvingRequest === r.id} onClick={() => markPaid(r)}>
                    {resolvingRequest === r.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                    Mark paid
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <form onSubmit={submitCreate} className="flex flex-col gap-4 rounded-2xl border border-border p-4">
        <h2 className="font-display text-sm font-semibold text-ink">Add an affiliate</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="aff-name">
            <Input id="aff-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Briggs, or an agency name" required />
          </Field>
          <Field label="Email" htmlFor="aff-email">
            <Input id="aff-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Initial password" htmlFor="aff-password" hint="Share this with them directly — they can't reset it themselves yet.">
            <PasswordInput id="aff-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </Field>
          <Field label="Commission" htmlFor="aff-commission" hint="% of the Website & Hosting subscription revenue, for as long as the referred business stays subscribed.">
            <div className="relative">
              <Input
                id="aff-commission"
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={commissionPercent}
                onChange={(e) => setCommissionPercent(e.target.value)}
                className="pr-8"
                required
              />
              <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-ink-muted">%</span>
            </div>
          </Field>
        </div>
        {createError ? <p className="text-sm text-danger">{createError}</p> : null}
        <Button type="submit" disabled={creating} className="self-start">
          {creating ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
          Create affiliate
        </Button>
      </form>

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-sm font-semibold text-ink">All affiliates</h2>
        {otherAffiliates.length === 0 ? (
          <p className="text-sm text-ink-muted">No affiliates yet — add one above, or wait for an application.</p>
        ) : (
          otherAffiliates.map((a) => (
            <div key={a.id} className="rounded-2xl border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{a.name}</span>
                    {a.status === "suspended" ? (
                      <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger">Suspended</span>
                    ) : null}
                  </div>
                  <div className="text-xs text-ink-muted">{a.email}</div>
                  <button
                    type="button"
                    onClick={() => copyLink(a.referralCode)}
                    className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-primary"
                  >
                    <Copy className="size-3.5" /> {origin}/signup?ref={a.referralCode}
                  </button>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                    <span className="flex items-center gap-1">
                      <Gift className="size-3.5" /> {a.welcomeBonusClaimedAt ? "Bonus claimed" : "Bonus pending"}
                    </span>
                    {a.bankVerifiedAt ? (
                      <span className="flex items-center gap-1">
                        <Banknote className="size-3.5" /> {a.accountName} · {a.bankName} · {a.accountNumber}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Banknote className="size-3.5" /> No bank details yet
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => toggleStatus(a)}>
                    {a.status === "active" ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                    {a.status === "active" ? "Suspend" : "Reactivate"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setPayoutFor(payoutFor === a.id ? null : a.id)}>
                    <Wallet className="size-3.5" /> Record payout
                  </Button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Stat label="Commission" value={`${(a.commissionBps / 100).toString()}%`} />
                <Stat label="Referrals" value={a.referralCount.toLocaleString()} />
                <Stat label="Total earned" value={formatKobo(a.totalEarnedKobo)} />
                <Stat label="Paid out" value={formatKobo(a.totalPaidOutKobo)} />
                <Stat label="Balance owing" value={formatKobo(a.balanceKobo)} emphasize />
              </div>

              <RecordDetailsEditor kind="affiliate" id={a.id} />
              {payoutFor === a.id ? (
                <div className="mt-3 flex flex-col gap-3 rounded-xl bg-surface p-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <Field label="Amount paid (₦)" htmlFor={`payout-amount-${a.id}`}>
                      <Input
                        id={`payout-amount-${a.id}`}
                        inputMode="decimal"
                        value={payoutAmount}
                        onChange={(e) => setPayoutAmount(e.target.value)}
                        placeholder="10000"
                      />
                    </Field>
                  </div>
                  <div className="flex-1">
                    <Field label="Note (optional)" htmlFor={`payout-note-${a.id}`}>
                      <Input
                        id={`payout-note-${a.id}`}
                        value={payoutNote}
                        onChange={(e) => setPayoutNote(e.target.value)}
                        placeholder="Bank transfer ref…"
                      />
                    </Field>
                  </div>
                  <Button type="button" disabled={payoutPending} onClick={() => submitPayout(a.id)}>
                    {payoutPending ? <Loader2 className="size-4 animate-spin" /> : null}
                    Save
                  </Button>
                </div>
              ) : null}
              {payoutFor === a.id && payoutError ? <p className="mt-2 text-sm text-danger">{payoutError}</p> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-ink-muted">{label}</div>
      <div className={emphasize ? "text-sm font-semibold text-primary" : "text-sm font-medium text-ink"}>{value}</div>
    </div>
  );
}
