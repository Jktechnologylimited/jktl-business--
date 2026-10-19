"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useBusinessStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import { DashboardSkeleton } from "@/components/app/skeleton";
import { ReceptionistConsole, type ConsoleActions } from "@/components/receptionist/receptionist-console";
import { demoReceptionistOverview } from "@/lib/mock/receptionist";
import {
  cancelContractAction,
  getReceptionistOverviewAction,
  getTranscriptAction,
  markRecoveredAction,
  recordManualTopUpAction,
  retryMissedCallAction,
  saveReceptionistConfigAction,
  simulateMissedCallAction,
  setAutoChargeAction,
  startContractPaymentAction,
  startWalletTopUpAction,
  type SaveConfigInput,
} from "@/lib/actions/receptionist-actions";
import type { ReceptionistOverview } from "@/lib/ai/types";

/**
 * The AI receptionist console.
 *
 * Works in both of the app's modes. In demo mode it renders the sample dataset
 * from `src/lib/mock/receptionist.ts` so the whole funnel — calls, wallet,
 * returns, clinical packs — is explorable with no database and no accounts; in
 * live mode it loads the real thing through a server action that scopes every
 * read to the signed-in organization.
 *
 * Nothing is silently faked in demo mode: the banner says so and every action
 * that would spend money or message a patient is blocked with an explicit
 * message rather than a no-op.
 */
export default function ReceptionistPage() {
  const mode = useBusinessStore((s) => s.mode);
  const show = useToastStore((s) => s.show);
  const demo = mode === "demo";

  const [liveOverview, setLiveOverview] = useState<ReceptionistOverview | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState("");

  // Demo data is derived during render rather than fetched in an effect: it
  // is a pure function of the mode, and routing it through state would mean
  // a wasted render and a state update inside an effect for no benefit.
  const demoOverview = useMemo(() => (demo ? demoReceptionistOverview() : null), [demo]);
  const overview = demo ? demoOverview : liveOverview;

  const refresh = useCallback(async () => {
    if (demo) return; // nothing to fetch — the sample data is derived above
    const result = await getReceptionistOverviewAction(30);
    if (result.ok) setLiveOverview(result.data);
    else show(result.error, "danger");
  }, [demo, show]);

  // Loads once when the console opens in live mode. The awaited server call
  // means every state update happens after the effect body has returned.
  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    void (async () => {
      const result = await getReceptionistOverviewAction(30);
      if (cancelled) return;
      if (result.ok) setLiveOverview(result.data);
      else show(result.error, "danger");
    })();
    return () => {
      cancelled = true;
    };
  }, [demo, show]);

  const runBusy = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      try {
        await fn();
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const actions: ConsoleActions = {
    refresh: () => void refresh(),

    saveConfig: (input: SaveConfigInput) =>
      void runBusy(async () => {
        if (demo) {
          show("Demo mode — settings aren't saved");
          return;
        }
        const result = await saveReceptionistConfigAction(input);
        if (result.ok) {
          show("Settings saved");
          await refresh();
        } else show(result.error, "danger");
      }),

    topUpWithCard: (naira: number) =>
      void runBusy(async () => {
        if (demo) {
          show("Demo mode — no payment is taken");
          return;
        }
        const result = await startWalletTopUpAction(naira);
        if (result.ok) window.location.href = result.data.authorizationUrl;
        else show(result.error, "danger");
      }),

    recordTopUp: (naira: number, reference: string, note: string) =>
      void runBusy(async () => {
        if (demo) {
          show("Demo mode — nothing recorded");
          return;
        }
        const result = await recordManualTopUpAction(naira, reference, note);
        if (result.ok) {
          show("Top-up recorded");
          await refresh();
        } else show(result.error, "danger");
      }),

    payMonth: () =>
      void runBusy(async () => {
        if (demo) {
          show("Demo mode — no payment is taken");
          return;
        }
        const result = await startContractPaymentAction();
        if (result.ok) window.location.href = result.data.authorizationUrl;
        else show(result.error, "danger");
      }),

    setAutoCharge: (enabled: boolean) =>
      void runBusy(async () => {
        if (demo) {
          show("Demo mode — nothing changes");
          return;
        }
        const result = await setAutoChargeAction(enabled);
        if (result.ok) {
          show(enabled ? "Automatic payment is on." : "Automatic payment is off.");
          await refresh();
        } else show(result.error, "danger");
      }),

    cancelContract: (reason: string) =>
      void runBusy(async () => {
        if (demo) {
          show("Demo mode — nothing is cancelled");
          return;
        }
        const result = await cancelContractAction(reason);
        if (result.ok) {
          show(result.data.detail);
          await refresh();
        } else show(result.error, "danger");
      }),

    simulate: (phone: string) =>
      void runBusy(async () => {
        if (demo) {
          show("Demo mode — no test message is sent");
          return;
        }
        const result = await simulateMissedCallAction(phone);
        if (!result.ok) {
          show(result.error, "danger");
          return;
        }
        show(result.data.detail, result.data.success ? "default" : "danger");
        setBanner(result.data.sms ? `Test callback: “${result.data.sms}”` : result.data.detail);
        await refresh();
      }),

    retry: (missedCallId: string) =>
      void runBusy(async () => {
        if (demo) {
          show("Demo mode — nothing is retried");
          return;
        }
        const result = await retryMissedCallAction(missedCallId);
        if (!result.ok) show(result.error, "danger");
        else {
          show(result.data.detail, result.data.success ? "default" : "danger");
          await refresh();
        }
      }),

    markRecovered: (missedCallId: string, naira: number) =>
      void runBusy(async () => {
        if (demo) {
          show("Demo mode — nothing recorded");
          return;
        }
        const result = await markRecoveredAction(missedCallId, naira);
        if (result.ok) {
          show("Recovery recorded");
          await refresh();
        } else show(result.error, "danger");
      }),

    transcript: async (sessionId: string) => {
      if (demo) {
        // The demo sessions have no stored transcript; show a short, honest
        // sample instead of pretending to fetch one.
        return {
          ok: true,
          messages: [
            { id: "d1", sessionId, role: "assistant" as const, content: "Hi Chioma, thanks for getting back to us. How can I help?", toolName: "", createdAt: new Date().toISOString() },
            { id: "d2", sessionId, role: "user" as const, content: "Do you have anything on Saturday morning?", toolName: "", createdAt: new Date().toISOString() },
            { id: "d3", sessionId, role: "assistant" as const, content: "We do — 10:30 is free. Shall I book that for you?", toolName: "", createdAt: new Date().toISOString() },
          ],
        };
      }
      const result = await getTranscriptAction(sessionId);
      return result.ok ? { ok: true, messages: result.data } : { ok: false, error: result.error };
    },
  };

  if (!overview) return <DashboardSkeleton />;

  return (
    <ReceptionistConsole
      overview={overview}
      demo={demo}
      busy={busy}
      actions={actions}
      banner={banner || (demo ? "Demo mode — sample data. Nothing here sends a message or takes a payment." : "")}
    />
  );
}
