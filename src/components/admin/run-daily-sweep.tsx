"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Play, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToastStore } from "@/lib/toast";
import { runDailySweepNowAction } from "@/lib/actions/admin-actions";

/**
 * Runs the scheduled job on demand.
 *
 * The Hobby plan runs the cron once a day and cannot promise when inside the hour,
 * so waiting to find out whether site generation works is not practical. This
 * presses the same button the cron presses and shows each step's outcome — which
 * matters because Vercel does not retry a failed cron or alert anyone, so nothing
 * else would tell you a step had failed.
 */
export function RunDailySweep() {
  const show = useToastStore((s) => s.show);
  const [pending, setPending] = useState(false);
  const [steps, setSteps] = useState<Array<{ name: string; ok: boolean; detail: string; ms: number }>>([]);
  const [truncated, setTruncated] = useState(false);

  async function run() {
    setPending(true);
    setSteps([]);
    try {
      const result = await runDailySweepNowAction();
      if (!result.ok) {
        show(result.error, "danger");
        return;
      }
      setSteps(result.data.steps);
      setTruncated(result.data.truncated);
      const failed = result.data.steps.filter((s) => !s.ok).length;
      show(failed === 0 ? "Daily job ran clean." : `Daily job finished with ${failed} problem(s).`, failed === 0 ? "default" : "danger");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-paper p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-sm font-semibold text-ink">Scheduled job</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Collection, line rentals, commissions, reminders, nudges and site generation — once a day on Vercel&apos;s Hobby
            plan, or now if you press this.
          </p>
        </div>
        <Button size="sm" onClick={run} disabled={pending}>
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
          {pending ? "Running…" : "Run now"}
        </Button>
      </div>

      {steps.length > 0 ? (
        <ul className="mt-3 divide-y divide-border">
          {steps.map((step) => (
            <li key={step.name} className="flex items-start gap-2 py-2">
              {step.ok ? (
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
              ) : (
                <XCircle className="mt-0.5 size-3.5 shrink-0 text-danger" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-ink">{step.name.replace(/-/g, " ")}</p>
                <p className={step.ok ? "text-[11px] text-ink-muted" : "text-[11px] text-danger"}>{step.detail}</p>
              </div>
              <span className="shrink-0 text-[11px] tabular-nums text-ink-faint">{step.ms}ms</span>
            </li>
          ))}
        </ul>
      ) : null}

      {truncated ? (
        <p className="mt-2 rounded-xl bg-accent-soft px-3 py-2 text-[11px] text-ink">
          The run hit its time budget before finishing every step. Money steps run first, so what was skipped is site
          generation — run it again to continue, or wait for tomorrow.
        </p>
      ) : null}
    </section>
  );
}
