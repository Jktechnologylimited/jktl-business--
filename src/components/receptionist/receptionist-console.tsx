"use client";

import { useState } from "react";
import {
  BadgeCheck,
  Repeat,
  Calculator,
  MessageSquare,
  PhoneMissed,
  RefreshCw,
  RotateCcw,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatTile } from "@/components/app/stat-tile";
import { StatusPill, type Tone } from "@/components/app/status-pill";
import { EmptyState } from "@/components/app/empty-state";
import { WalletPanel } from "./wallet-panel";
import { ReceptionistSettingsForm } from "./receptionist-settings-form";
import {
  amountForMonth,
  averageMonthlyKobo,
  breakEvenBookings,
  CANCEL_ANY_TIME,
  cancellationSummary,
  clinicRoi,
  currentMonthIndex,
  DEFAULT_CONTRACT_TERMS,
  isPlatformPhase,
  MONTHLY_FEE_KOBO,
  monthsUntilPlatformPhase,
  setupAmortization,
  SETUP_FEE_KOBO,
  totalContractValue,
} from "@/lib/ai/pricing";
import { formatKobo, formatRelativeDay, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MissedCall, MissedCallStatus, ReceptionistMessage, ReceptionistOverview } from "@/lib/ai/types";
import type { SaveConfigInput } from "@/lib/actions/receptionist-actions";

/**
 * The clinic's view of the intercept pipeline: what came in, what was
 * recovered, what it cost, and whether the assistant is allowed to talk about
 * a given symptom.
 *
 * The ROI tab uses the *same* `clinicRoi` function as the proposal document
 * and the test suite. That is deliberate — the single worst outcome for this
 * product is a medical director finding a different payback number in the app
 * than the one they were sold, so there is one implementation and no
 * hand-maintained copy of the arithmetic.
 */

export interface ConsoleActions {
  refresh: () => void;
  saveConfig: (input: SaveConfigInput) => void;
  topUpWithCard: (naira: number) => void;
  recordTopUp: (naira: number, reference: string, note: string) => void;
  /** Pays whichever month of the contract is due. The amount is decided
   * server-side from the schedule, never by the client. */
  payMonth: () => void;
  setAutoCharge: (enabled: boolean) => void;
  cancelContract: (reason: string) => void;
  simulate: (phone: string) => void;
  retry: (missedCallId: string) => void;
  markRecovered: (missedCallId: string, naira: number) => void;
  transcript: (sessionId: string) => Promise<{ ok: boolean; messages?: ReceptionistMessage[]; error?: string }>;
}

type Tab = "calls" | "wallet" | "roi" | "settings";

const STATUS_META: Record<MissedCallStatus, { label: string; tone: Tone }> = {
  received: { label: "Recorded", tone: "neutral" },
  sms_sent: { label: "Message sent", tone: "info" },
  sms_failed: { label: "Send failed", tone: "danger" },
  sms_blocked: { label: "Wallet too low", tone: "danger" },
  chat_opened: { label: "Chat opened", tone: "accent" },
  booked: { label: "Booked", tone: "primary" },
  recovered: { label: "Recovered", tone: "primary" },
  lost: { label: "No response", tone: "neutral" },
};

export function ReceptionistConsole({
  overview,
  demo,
  busy,
  actions,
  banner,
}: {
  overview: ReceptionistOverview;
  demo: boolean;
  busy: boolean;
  actions: ConsoleActions;
  banner?: string;
}) {
  const [tab, setTab] = useState<Tab>("calls");
  const { config, wallet, contract, stats, missedCalls, sessions, transactions } = overview;

  const startedAt = contract?.startedAt ? new Date(contract.startedAt) : null;
  const cancelled = contract?.status === "cancelled";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">AI receptionist</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            Every missed call gets a text back with a link that books itself. Last {stats.windowDays} days:
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
              config.enabled ? "bg-primary-soft text-primary-strong" : "bg-surface-strong text-ink-muted",
            )}
          >
            <span className={cn("size-1.5 rounded-full", config.enabled ? "bg-primary" : "bg-ink-faint")} />
            {config.enabled ? "Answering missed calls" : "Switched off"}
          </span>
          <Button size="sm" variant="outline" disabled={busy} onClick={actions.refresh}>
            <RefreshCw className={cn("size-3.5", busy && "animate-spin")} /> Refresh
          </Button>
        </div>
      </div>

      {banner ? (
        <div className="rounded-xl border border-accent/30 bg-accent-soft px-3.5 py-2.5 text-[13px] text-ink">{banner}</div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Missed calls" value={String(stats.missedCalls)} sub={`${stats.smsSent} answered by text`} rule="info" />
        <StatTile label="Chats opened" value={String(stats.chatsOpened)} sub={`${Math.round(stats.recoveryRate * 100)}% became bookings`} rule="accent" />
        <StatTile label="Booked by the agent" value={String(stats.bookings)} rule="primary" />
        <StatTile label="Revenue recovered" value={formatKobo(stats.recoveredValueKobo)} sub="Attributed to a missed call" rule="primary" />
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {(
          [
            ["calls", "Calls"],
            ["wallet", "Wallet"],
            ["roi", "Return on investment"],
            ["settings", "Settings"],
          ] as Array<[Tab, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
              tab === id ? "border-primary text-primary" : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "calls" ? <CallsTab calls={missedCalls} sessions={sessions} demo={demo} busy={busy} actions={actions} /> : null}

      {tab === "wallet" ? (
        <div className="flex flex-col gap-5">
          <WalletPanel
            wallet={wallet}
            transactions={transactions}
            demo={demo}
            busy={busy}
            onTopUpWithCard={actions.topUpWithCard}
            onRecordTopUp={actions.recordTopUp}
          />
          <ContractCard
            contract={contract}
            startedAt={startedAt}
            cancelled={cancelled}
            demo={demo}
            busy={busy}
            onPayMonth={actions.payMonth}
            onToggleAutoCharge={actions.setAutoCharge}
            onCancel={actions.cancelContract}
          />
        </div>
      ) : null}

      {tab === "roi" ? (
        <RoiTab
          stats={stats}
          averageConsultValueKobo={config.averageConsultValueKobo}
          monthlyCostKobo={amountForMonth(Math.max(1, (contract?.chargesPaid ?? 0) + 1), DEFAULT_CONTRACT_TERMS)}
          phaseLabel={startedAt && !isPlatformPhase(startedAt, new Date(), DEFAULT_CONTRACT_TERMS) ? "the instalment phase" : "the platform tier"}
        />
      ) : null}

      {tab === "settings" ? (
        <ReceptionistSettingsForm config={config} demo={demo} busy={busy} onSave={actions.saveConfig} onSimulate={actions.simulate} />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Calls                                                                      */
/* -------------------------------------------------------------------------- */

function CallsTab({
  calls,
  sessions,
  demo,
  busy,
  actions,
}: {
  calls: MissedCall[];
  sessions: ReceptionistOverview["sessions"];
  demo: boolean;
  busy: boolean;
  actions: ConsoleActions;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<ReceptionistMessage[] | null>(null);
  const [transcriptError, setTranscriptError] = useState("");
  const [recoveryValue, setRecoveryValue] = useState("");

  async function loadTranscript(sessionId: string) {
    if (openId === sessionId) {
      setOpenId(null);
      return;
    }
    setOpenId(sessionId);
    setTranscript(null);
    setTranscriptError("");
    const result = await actions.transcript(sessionId);
    if (result.ok) setTranscript(result.messages ?? []);
    else setTranscriptError(result.error ?? "Couldn't load that conversation.");
  }

  if (calls.length === 0) {
    return (
      <EmptyState
        icon={<PhoneMissed className="size-5" />}
        title="No missed calls yet"
        description="When a patient calls and the line is busy, the call appears here with what the assistant did about it."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-muted">
        {demo ? "Sample data — demo mode." : "Live calls from your clinic line."} Every row is one patient who tried to reach you.
      </p>
      <div className="flex flex-col gap-2.5">
        {calls.map((call) => {
          const meta = STATUS_META[call.status];
          const canRetry = call.status === "sms_failed" || call.status === "sms_blocked";
          const canRecover = call.status !== "recovered" && call.status !== "booked";
          const session = sessions.find((s) => s.id === call.chatSessionId);

          return (
            <div key={call.id} className="rounded-2xl border border-border bg-paper p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">{call.callerPhone}</span>
                    <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                    {session?.escalated ? <StatusPill tone="danger">Handed to a person</StatusPill> : null}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-muted">
                    {formatRelativeDay(call.receivedAt)} at {formatTime(call.receivedAt)}
                    {call.smsUnits > 0 && call.smsCostKobo > 0 ? ` · ${call.smsUnits} segment${call.smsUnits > 1 ? "s" : ""} · ${formatKobo(call.smsCostKobo, { showKobo: true })}` : ""}
                    {call.recoveredValueKobo > 0 ? ` · recovered ${formatKobo(call.recoveredValueKobo)}` : ""}
                  </div>
                  {call.smsError ? <div className="mt-1 text-xs text-danger">{call.smsError}</div> : null}
                  {call.notes ? <div className="mt-1 text-xs text-ink-muted">{call.notes}</div> : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {call.chatSessionId ? (
                    <Button size="sm" variant="ghost" onClick={() => void loadTranscript(call.chatSessionId as string)}>
                      <MessageSquare className="size-3.5" /> {openId === call.chatSessionId ? "Hide chat" : "View chat"}
                    </Button>
                  ) : null}
                  {canRetry ? (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => actions.retry(call.id)}>
                      <RotateCcw className="size-3.5" /> Retry
                    </Button>
                  ) : null}
                  {canRecover ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => actions.markRecovered(call.id, Number(recoveryValue) || 0)}
                      title="Record that this call turned into a booking"
                    >
                      <BadgeCheck className="size-3.5" /> Mark recovered
                    </Button>
                  ) : null}
                </div>
              </div>

              {openId === call.chatSessionId ? (
                <div className="mt-3 rounded-xl border border-border bg-surface p-3">
                  {transcriptError ? (
                    <p className="text-xs text-danger">{transcriptError}</p>
                  ) : transcript === null ? (
                    <p className="text-xs text-ink-muted">Loading conversation…</p>
                  ) : transcript.length === 0 ? (
                    <p className="text-xs text-ink-muted">Nothing said yet — the patient opened the link but hasn&apos;t replied.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {transcript
                        .filter((m) => m.role === "user" || m.role === "assistant")
                        .map((m) => (
                          <div
                            key={m.id}
                            className={cn(
                              "max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-[13px]",
                              m.role === "user" ? "self-start bg-paper text-ink" : "self-end bg-primary-soft text-ink",
                            )}
                          >
                            {m.content}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border-strong px-3 py-2.5">
        <span className="text-xs text-ink-muted">Booked this patient by phone instead?</span>
        <Input
          inputMode="numeric"
          placeholder="Value in ₦ (optional)"
          value={recoveryValue}
          onChange={(e) => setRecoveryValue(e.target.value)}
          className="h-9 max-w-[180px]"
          aria-label="Recovery value"
        />
        <span className="text-xs text-ink-muted">then use “Mark recovered” on their row.</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* ROI                                                                        */
/* -------------------------------------------------------------------------- */

function RoiTab({
  stats,
  averageConsultValueKobo,
  monthlyCostKobo,
  phaseLabel,
}: {
  stats: ReceptionistOverview["stats"];
  averageConsultValueKobo: number;
  /** What the clinic is actually paying this month — N108,333.33 during the
   * instalment phase, N59,000 after. Quoting the month-7 figure while they are
   * still paying off the package would be the most misleading number in the
   * product. */
  monthlyCostKobo: number;
  phaseLabel: string;
}) {
  const [missedPerDay, setMissedPerDay] = useState("3");
  const [recoveryRate, setRecoveryRate] = useState("20");
  const [consultValue, setConsultValue] = useState(String(Math.round(averageConsultValueKobo / 100)));

  const consultKobo = Math.round((Number(consultValue) || 0) * 100);
  const roi = clinicRoi({
    missedCallsPerDay: Number(missedPerDay) || 0,
    recoveryRate: (Number(recoveryRate) || 0) / 100,
    averageConsultValueKobo: consultKobo,
    monthlyFeeKobo: monthlyCostKobo,
  });
  const breakEvenNow = breakEvenBookings(monthlyCostKobo, consultKobo);
  const breakEvenLater = breakEvenBookings(MONTHLY_FEE_KOBO, consultKobo);

  // Observed numbers from this clinic's own calls, for comparison with the
  // projection above — the honest "what actually happened" column.
  const observedRecoveredPerMonth = stats.bookings;
  const observedValueKobo = stats.recoveredValueKobo;

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-border bg-paper p-4">
        <h2 className="flex items-center gap-1.5 font-display text-base font-semibold text-ink">
          <Calculator className="size-4 text-primary" /> What missed calls cost you
        </h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          The same arithmetic we quote in your proposal — change the assumptions to match your clinic. Compared against what you pay now
          ({phaseLabel}): <strong className="font-semibold text-ink">{formatKobo(monthlyCostKobo)}</strong>.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Missed calls per day</span>
            <Input inputMode="numeric" value={missedPerDay} onChange={(e) => setMissedPerDay(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Average consultation value (₦)</span>
            <Input inputMode="numeric" value={consultValue} onChange={(e) => setConsultValue(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Recovery rate we plan for (%)</span>
            <Input inputMode="numeric" value={recoveryRate} onChange={(e) => setRecoveryRate(e.target.value)} />
          </label>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Lost every day" value={formatKobo(roi.dailyLossKobo)} sub={`${formatKobo(roi.monthlyLossKobo)} a month`} rule="danger" />
          <StatTile label="Recovered a month" value={`${roi.recoveredPerMonth}`} sub="Patients back in your diary" rule="primary" />
          <StatTile label="Worth" value={formatKobo(roi.recoveredValueKobo)} sub={`${roi.returnMultiple}× what you pay`} rule="primary" />
          <StatTile
            label="Net gain a month"
            value={formatKobo(roi.netGainKobo)}
            sub={`${breakEvenNow} booking${breakEvenNow === 1 ? "" : "s"} covers this month`}
            rule="info"
          />
        </div>

        <p className="mt-3 text-xs text-ink-muted">
          {breakEvenNow === breakEvenLater
            ? `${breakEvenNow} recovered patients cover the subscription each month.`
            : `You need ${breakEvenNow} recovered patients a month while the ${formatKobo(monthlyCostKobo)} instalments run, dropping to ${breakEvenLater} a month once the platform tier starts at ${formatKobo(MONTHLY_FEE_KOBO)}.`}
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-paper p-4">
        <h2 className="flex items-center gap-1.5 font-display text-base font-semibold text-ink">
          <Users className="size-4 text-primary" /> What actually happened
        </h2>
        <p className="mt-0.5 text-xs text-ink-muted">From your own calls in the last {stats.windowDays} days.</p>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Missed calls" value={String(stats.missedCalls)} rule="info" />
          <StatTile label="Bookings recovered" value={String(observedRecoveredPerMonth)} rule="primary" />
          <StatTile label="Recovered revenue" value={formatKobo(observedValueKobo)} rule="primary" />
          <StatTile label="Round-trip cost" value={formatKobo(stats.smsCostKobo + stats.aiCostKobo)} sub="Messages + inference" rule="accent" />
        </div>
        <p className="mt-3 text-xs text-ink-muted">
          {stats.missedCalls === 0
            ? "No calls recorded yet — the projection above is what your first month should look like."
            : observedValueKobo >= MONTHLY_FEE_KOBO
              ? `Recovered revenue already covers the ${formatKobo(MONTHLY_FEE_KOBO)} subscription.`
              : `${formatKobo(Math.max(0, MONTHLY_FEE_KOBO - observedValueKobo))} more recovered revenue would cover the subscription this month.`}
        </p>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Contract                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The contract, as a schedule rather than a single price.
 *
 * The shape being presented to the clinic: ₦650,000 of turnkey work billed as
 * six monthly instalments of ₦108,333.33, then ₦59,000 a month, cancellable at
 * any point from month one. Two things this card refuses to hide:
 *
 *   - which month they are in and what the next payment is, taken from the
 *     same schedule the invoice is generated from;
 *   - what cancelling now would write off, because "cancel anytime" is a real
 *     concession and somebody should be looking at its cost.
 */
function ContractCard({
  contract,
  startedAt,
  cancelled,
  demo,
  busy,
  onPayMonth,
  onToggleAutoCharge,
  onCancel,
}: {
  contract: ReceptionistOverview["contract"];
  startedAt: Date | null;
  cancelled: boolean;
  demo: boolean;
  busy: boolean;
  onPayMonth: () => void;
  onToggleAutoCharge: (enabled: boolean) => void;
  onCancel: (reason: string) => void;
}) {
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const terms = DEFAULT_CONTRACT_TERMS;
  const instalments = setupAmortization(terms);
  const monthIndex = startedAt ? currentMonthIndex(startedAt, new Date()) : 0;
  const platformPhase = startedAt ? isPlatformPhase(startedAt, new Date(), terms) : false;
  const monthsLeftInSetup = startedAt ? monthsUntilPlatformPhase(startedAt, new Date(), terms) : terms.setupMonths;
  const nextMonth = Math.max(1, (contract?.chargesPaid ?? 0) + 1);
  const nextAmountKobo = amountForMonth(nextMonth, terms);
  const chargesPaid = contract?.chargesPaid ?? 0;
  const behind = startedAt && !cancelled ? Math.max(0, monthIndex - chargesPaid) : 0;

  const summary = startedAt ? cancellationSummary(startedAt, new Date(), terms) : null;

  return (
    <section className="rounded-2xl border border-border bg-paper p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-semibold text-ink">Turnkey launch package</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            {formatKobo(contract?.setupFeeKobo ?? SETUP_FEE_KOBO)} billed over {terms.setupMonths} months, then{" "}
            {formatKobo(contract?.monthlyFeeKobo ?? MONTHLY_FEE_KOBO)} a month. {CANCEL_ANY_TIME ? "Cancel anytime — no minimum term." : ""}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium",
            cancelled ? "bg-surface-strong text-ink-muted" : platformPhase ? "bg-info-soft text-info" : "bg-accent-soft text-accent-strong",
          )}
        >
          {cancelled
            ? "Cancelled"
            : !startedAt
              ? "Not started"
              : platformPhase
                ? `Month ${monthIndex} · platform tier`
                : `Month ${monthIndex} of ${terms.setupMonths} · instalment`}
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <div className="text-xs font-medium text-ink-muted">Each month, first {terms.setupMonths}</div>
          <div className="font-display text-lg font-semibold text-ink">
            {formatKobo(instalments[0], { showKobo: true })}
          </div>
          <div className="mt-0.5 text-xs text-ink-muted">
            {instalments.length} instalments · {formatKobo(instalments.reduce((a, b) => a + b, 0))} total
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-ink-muted">From month {terms.setupMonths + 1}</div>
          <div className="font-display text-lg font-semibold text-ink">{formatKobo(contract?.monthlyFeeKobo ?? MONTHLY_FEE_KOBO)}</div>
          <div className="mt-0.5 text-xs text-ink-muted">
            {startedAt && !platformPhase
              ? `${monthsLeftInSetup} more instalment${monthsLeftInSetup === 1 ? "" : "s"} first`
              : "Platform tier"}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-ink-muted">Included communication credit</div>
          <div className="font-display text-lg font-semibold text-ink">{formatKobo(contract?.includedTokenCreditKobo ?? 0)}</div>
          <div className="mt-0.5 text-xs text-ink-muted">Lands in the wallet when the contract starts</div>
        </div>
      </div>

      {startedAt ? (
        <div className="mt-4 rounded-xl border border-border bg-surface px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <span className="text-ink">
              <strong className="font-semibold">{chargesPaid}</strong> payment{chargesPaid === 1 ? "" : "s"} recorded
              {cancelled ? "" : ` · next: month ${nextMonth} at ${formatKobo(nextAmountKobo, { showKobo: true })}`}
              {contract?.hasCard ? ` · card •••• ${contract.cardLast4}${contract.autoChargeEnabled ? " (automatic)" : " (manual)"}` : " · no card on file"}
            </span>
            {behind > 0 ? (
              <span className="text-danger">
                {behind} month{behind === 1 ? "" : "s"} outstanding
              </span>
            ) : cancelled ? (
              <span className="text-ink-muted">No further payments will be taken</span>
            ) : (
              <span className="text-primary-strong">Up to date</span>
            )}
          </div>
        </div>
      ) : null}

      {/* What the no-lock-in promise actually costs, in the window where it
          costs anything. */}
      {summary?.insideSetupWindow && !cancelled ? (
        <p className="mt-3 text-xs text-ink-muted">
          Cancelling today would collect {formatKobo(summary.collectedKobo)} of the {formatKobo(contract?.setupFeeKobo ?? SETUP_FEE_KOBO)}{" "}
          package, and the remaining {formatKobo(summary.unbilledSetupKobo)} would never be billed. That is the trade for having no minimum term.
        </p>
      ) : null}

      {!startedAt ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="sm" disabled={busy} onClick={onPayMonth}>
            Start & pay month 1 · {formatKobo(instalments[0], { showKobo: true })}
          </Button>
          <span className="text-xs text-ink-muted">
            {demo ? "Demo mode — no payment is taken." : "Secure card payment via Paystack. The launch credit lands in your wallet immediately."}
          </span>
        </div>
      ) : null}

      {contract?.lastChargeError && !cancelled ? (
        <p className="mt-3 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-[13px] text-ink">
          <strong className="font-semibold text-danger">Last automatic payment failed.</strong> {contract.lastChargeError} We&apos;ll try
          again tomorrow — update the card in Billing, or pay this month by hand.
        </p>
      ) : null}

      {startedAt && !cancelled ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="sm" disabled={busy} onClick={onPayMonth}>
            {contract?.hasCard ? `Pay month ${nextMonth}` : `Add a card & pay`} · {formatKobo(nextAmountKobo, { showKobo: true })}
          </Button>
          {contract?.hasCard ? (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onToggleAutoCharge(!contract.autoChargeEnabled)}>
              <Repeat className="size-3.5" /> {contract.autoChargeEnabled ? "Stop paying automatically" : "Pay automatically"}
            </Button>
          ) : null}
          {confirmingCancel ? (
            <>
              <Button size="sm" variant="danger" disabled={busy} onClick={() => onCancel("Cancelled by the business from the console")}>
                Yes, cancel
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmingCancel(false)}>
                Keep it running
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirmingCancel(true)}>
              Cancel contract
            </Button>
          )}
          <span className="text-xs text-ink-muted">
            {formatKobo(totalContractValue(12))} over the first 12 months · {formatKobo(averageMonthlyKobo(12))}/month average
          </span>
        </div>
      ) : null}

      {cancelled && contract?.cancelReason ? (
        <p className="mt-3 text-xs text-ink-muted">Reason recorded: {contract.cancelReason}</p>
      ) : null}
    </section>
  );
}
