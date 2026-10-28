"use client";
import { useState } from "react";
import {
  saveDomainFulfillmentSettingsAction,
  assignDomainOrderAction,
  routeDomainManualAction,
  reconcileDomainOperationAction,
} from "@/lib/actions/domain-fulfillment-actions";
type Row = Record<string, unknown>;
type Run = (
  fn: () => Promise<{ ok: boolean; error?: string }>,
  message: string,
) => Promise<unknown>;
export function FulfillmentSettings({
  mode,
  prices,
  busy,
  run,
}: {
  mode: string;
  prices: Row[];
  busy: boolean;
  run: Run;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-border p-5">
      <h2>Fulfillment settings</h2>
      <p>
        Automatic is a preference for future orders. Verified response
        contracts, wallet checks and live-test approval are still required.
        Existing manual orders stay in the team queue.
      </p>
      <label>
        Default method{" "}
        <select
          disabled={busy}
          value={mode}
          onChange={(e) =>
            void run(
              () =>
                saveDomainFulfillmentSettingsAction({ mode: e.target.value }),
              "Default method saved. Purchase safeguards remain in force.",
            )
          }
        >
          <option value="MANUAL">Manual</option>
          <option value="AUTOMATIC">Automatic when verified</option>
        </select>
      </label>
      <details>
        <summary>Extensions requiring manual handling</summary>
        {prices.map((p) => (
          <label key={String(p.extension)} className="my-2 flex gap-3">
            <input
              type="checkbox"
              disabled={busy}
              checked={p.manual_only !== false}
              onChange={(e) =>
                void run(
                  () =>
                    saveDomainFulfillmentSettingsAction({
                      mode,
                      extension: String(p.extension),
                      manualOnly: e.target.checked,
                    }),
                  "Extension handling saved.",
                )
              }
            />
            {String(p.extension)}
          </label>
        ))}
      </details>
    </section>
  );
}
export function ManualOrderTools({
  order,
  team,
  busy,
  run,
}: {
  order: Row;
  team: Row[];
  busy: boolean;
  run: Run;
}) {
  return (
    <div className="my-4 space-y-3">
      <p>
        Method: {String(order.fulfillment_mode || "MANUAL")} · Stage:{" "}
        {String(order.fulfillment_stage || order.status)} ·{" "}
        {String(order.fallback_reason || "")}
      </p>
      <label>
        Assigned team member{" "}
        <select
          disabled={busy}
          value={String(order.assigned_to || "")}
          onChange={(e) =>
            void run(
              () =>
                assignDomainOrderAction({
                  id: String(order.id),
                  assignee: e.target.value,
                  revision: Number(order.fulfillment_revision),
                }),
              "Order assignment saved.",
            )
          }
        >
          <option value="" disabled>
            Choose a team member
          </option>
          {team.map((t) => (
            <option key={String(t.id)} value={String(t.id)}>
              {String(t.name || t.email)}
            </option>
          ))}
        </select>
      </label>
      <button
        disabled={busy}
        onClick={() =>
          void run(
            () => routeDomainManualAction(String(order.id)),
            "Order routed safely. Unknown registrar outcomes still require reconciliation.",
          )
        }
      >
        Route to manual review
      </button>
      {order.fulfillment_stage === "RECONCILIATION_REQUIRED" && (
        <p role="alert">
          Check the actual registrar account before doing anything else. Do not
          purchase again. A confirmed operation needs only local finalization.
        </p>
      )}
    </div>
  );
}
export function ReconcileOperation({
  operation,
  done,
}: {
  operation: Row;
  done: () => Promise<void>;
}) {
  const [outcome, setOutcome] = useState<"NOT_APPLIED" | "CONFIRMED">(
    "CONFIRMED",
  );
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  if (!["SUBMITTED", "UNKNOWN", "CONFIRMED"].includes(String(operation.state)))
    return null;
  return (
    <details className="my-4 rounded-lg border border-border p-4">
      <summary>
        Review {String(operation.domain)} — {String(operation.state)}
      </summary>
      <p>
        Review the actual registrar account and transaction history. RDAP
        absence, an HTTP code or a timeout is insufficient evidence. This action
        records an operator attestation and makes no registrar purchase.
      </p>
      <form
        className="my-4 grid gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          try {
            const r = await reconcileDomainOperationAction({
              operationId: String(operation.id),
              outcome,
              reference: String(f.get("reference")),
              checkedRegistrarAccount: f.get("verified") === "on",
              noPendingOperation: f.get("noPending") === "on",
              registeredAt: String(f.get("registeredAt") || ""),
              expiresAt: String(f.get("expiresAt") || ""),
              nameservers: String(f.get("nameservers") || ""),
            });
            setMessage(
              r.ok ? "Reconciliation saved." : r.error || "Could not save.",
            );
            if (r.ok) await done();
          } catch {
            setMessage("Could not save. Reload the recorded state.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Registrar result{" "}
          <select
            value={outcome}
            disabled={busy || operation.state === "CONFIRMED"}
            onChange={(e) => setOutcome(e.target.value as typeof outcome)}
          >
            <option value="CONFIRMED">Confirmed registration / renewal</option>
            <option value="NOT_APPLIED">
              Definitely not applied or pending
            </option>
          </select>
        </label>
        <label>
          Actual transaction or registrar support reference{" "}
          <input
            name="reference"
            required
            minLength={3}
            maxLength={200}
            defaultValue={String(operation.transaction_reference || "")}
          />
        </label>
        {outcome === "CONFIRMED" && operation.state !== "CONFIRMED" && (
          <>
            <label>
              Confirmed registration date{" "}
              <input name="registeredAt" type="date" required />
            </label>
            <label>
              Confirmed expiry date{" "}
              <input name="expiresAt" type="date" required />
            </label>
            <label>
              Confirmed nameservers <textarea name="nameservers" required />
            </label>
          </>
        )}
        <label>
          <input name="verified" type="checkbox" required /> I checked this
          domain and transaction in the registrar account.
        </label>
        {outcome === "NOT_APPLIED" && (
          <label>
            <input name="noPending" type="checkbox" required /> The registrar
            confirms no completed or pending operation. It is safe for the team
            to review fulfillment.
          </label>
        )}
        <button disabled={busy}>Record reconciliation</button>
        <p role="status">{message}</p>
      </form>
    </details>
  );
}
