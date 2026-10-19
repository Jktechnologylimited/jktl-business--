import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { getIntegrationHealth, missingIntegrationCount } from "@/lib/integration-health";

/**
 * Which platform credentials are in place.
 *
 * Server component: it reads `process.env` and never sends a value to the client,
 * only a boolean. The list exists because a missing key is invisible until a
 * customer notices the symptom — a clinic wondering why no text went out, a
 * partner wondering why their approval email never arrived. This turns that into
 * something visible before it becomes a support ticket.
 */
export function IntegrationHealth() {
  const statuses = getIntegrationHealth();
  const missing = missingIntegrationCount(statuses);

  return (
    <section className="rounded-2xl border border-border bg-paper p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold text-ink">Platform integrations</h2>
        <span
          className={
            missing === 0
              ? "inline-flex items-center gap-1 text-xs font-medium text-primary"
              : "inline-flex items-center gap-1 text-xs font-medium text-danger"
          }
        >
          {missing === 0 ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
          {missing === 0 ? "All connected" : `${missing} not connected`}
        </span>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        Deployment credentials. Customers never see this — a business cannot fix a missing key, so telling them about
        one only makes them think the product is broken.
      </p>

      <ul className="mt-3 divide-y divide-border">
        {statuses.map((status) => (
          <li key={status.name} className="flex items-start gap-3 py-2.5">
            <span className={status.configured ? "mt-1 size-2 shrink-0 rounded-full bg-primary" : "mt-1 size-2 shrink-0 rounded-full bg-danger"} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{status.name}</p>
              {status.configured ? (
                <p className="text-xs text-ink-muted">Connected.</p>
              ) : (
                <>
                  <p className="text-xs text-danger">{status.consequence}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    Set <code className="rounded bg-surface px-1 py-0.5 text-[11px]">{status.envVars.join(", ")}</code>{" "}
                    — from {status.source}.
                  </p>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
