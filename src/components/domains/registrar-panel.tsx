"use client";
import { ReconcileOperation } from "./fulfillment-tools";
import { useCallback, useEffect, useState } from "react";
import {
  registrarDashboardAction,
  recordWholesaleAction,
  configureMarkupAction,
  recordRegistrarWalletAction,
  checkGo54PricingTransportAction,
} from "@/lib/actions/registrar-actions";
import { money } from "@/lib/domains/model";
import styles from "./domains.module.css";
type Dashboard = Extract<
  Awaited<ReturnType<typeof registrarDashboardAction>>,
  { ok: true }
>["data"];
export function RegistrarPanel() {
  const [data, setData] = useState<Dashboard | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    const r = await registrarDashboardAction();
    if (r.ok) setData(r.data);
    else setMessage(r.error);
  }, []);
  useEffect(() => {
    let active = true;
    registrarDashboardAction()
      .then((r) => {
        if (!active) return;
        if (r.ok) setData(r.data);
        else setMessage(r.error);
      })
      .catch(() => {
        if (active)
          setMessage("Registrar operations are temporarily unavailable.");
      });
    return () => {
      active = false;
    };
  }, []);
  async function run(
    fn: () => Promise<{ ok: boolean; error?: string; message?: string }>,
  ) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fn();
      setMessage(
        r.ok
          ? r.message || "Private registrar record updated."
          : r.error || "Request failed.",
      );
      if (r.ok) await reload();
    } catch {
      setMessage("Registrar operations are temporarily unavailable.");
    } finally {
      setBusy(false);
    }
  }
  const state = data?.state;
  return (
    <section
      className={styles.section}
      aria-label="Private registrar operations"
    >
      <h2>Registrar integration</h2>
      <p>
        Automated registrar requests remain disabled. Authentication, pricing
        transport and documented operation requests are implemented. Response
        contracts, wallet API access and live validation remain pending.
      </p>
      <p className={styles.note}>
        This section is private to the domain operations team. Wholesale costs
        and the GO54 reseller balance are never customer wallet funds.
      </p>
      <p role="status">{message}</p>
      {!data ? (
        <p>
          Private registrar records are unavailable. Check access and the
          current database migration.
        </p>
      ) : (
        <>
          <div className={styles.actions}>
            <button
              disabled={busy}
              onClick={() => void run(checkGo54PricingTransportAction)}
            >
              Capture read-only pricing diagnostic
            </button>
            <button disabled={busy} onClick={() => void reload()}>
              Refresh private records
            </button>
          </div>
          <h3>GO54 reseller balance</h3>
          <p>
            {state?.wallet_kobo === null || state?.wallet_kobo === undefined
              ? "No verified balance recorded"
              : money(state.wallet_kobo)}{" "}
            ·{" "}
            {state?.wallet_source === "OPERATOR"
              ? "Operator-entered snapshot"
              : "No live wallet API connection"}
          </p>
          {state?.wallet_checked_at ? (
            <p className={styles.note}>
              Recorded:{" "}
              {new Date(String(state.wallet_checked_at)).toLocaleString()}. This
              snapshot does not replace a fresh registrar balance check before
              spending.
            </p>
          ) : null}
          {state?.low_balance_active === true ? (
            <p role="alert">
              The recorded reseller balance is below its alert threshold. Review
              funding before fulfilling domain orders.
            </p>
          ) : null}
          <details>
            <summary>Record a verified balance and alert threshold</summary>
            <form
              className={styles.form}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void run(() =>
                  recordRegistrarWalletAction({
                    balance: Number(f.get("balance")),
                    threshold: Number(f.get("threshold")),
                    revision: Number(state?.revision),
                    verified: f.get("verified") === "on",
                  }),
                );
              }}
            >
              <fieldset disabled={busy}>
                <label>
                  Verified GO54 balance (NGN kobo)
                  <input
                    name="balance"
                    type="number"
                    min="0"
                    step="1"
                    required
                  />
                </label>
                <label>
                  Low-balance threshold (NGN kobo)
                  <input
                    name="threshold"
                    type="number"
                    min="0"
                    step="1"
                    required
                    defaultValue={Number(state?.low_balance_kobo || 0)}
                  />
                </label>
                <label>
                  <input name="verified" type="checkbox" required />I verified
                  this NGN balance in the reseller account. This is an operator
                  record, not an API-synchronized balance.
                </label>
                <button>Save private balance snapshot</button>
              </fieldset>
            </form>
          </details>
          <details>
            <summary>Wholesale snapshots and selling-price markups</summary>
            <p className={styles.note}>
              Record verified annual costs in NGN kobo. Existing manual retail
              prices stay unchanged unless you explicitly apply markup pricing.
              Pending orders keep their accepted amounts.
            </p>
            {data.prices.map((p) => (
              <article
                className={styles.section}
                key={String(p.extension) + String(p.revision)}
              >
                <h3>{String(p.extension)}</h3>
                <p>
                  Wholesale registration {money(p.registration_cost)} · renewal{" "}
                  {money(p.renewal_cost)} · mode {String(p.pricing_mode)}
                </p>
                <form
                  className={styles.form}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void run(() =>
                      recordWholesaleAction({
                        extension: String(p.extension),
                        revision: Number(p.revision),
                        registration: Number(f.get("registration")),
                        renewal: Number(f.get("renewal")),
                        transfer: Number(f.get("transfer")),
                        verified: f.get("verified") === "on",
                      }),
                    );
                  }}
                >
                  <fieldset disabled={busy}>
                    <label>
                      Annual registration cost (kobo)
                      <input
                        type="number"
                        min="1"
                        step="1"
                        name="registration"
                        defaultValue={Number(p.registration_cost)}
                        required
                      />
                    </label>
                    <label>
                      Annual renewal cost (kobo)
                      <input
                        type="number"
                        min="1"
                        step="1"
                        name="renewal"
                        defaultValue={Number(p.renewal_cost)}
                        required
                      />
                    </label>
                    <label>
                      Transfer cost (kobo; 0 if not verified)
                      <input
                        type="number"
                        min="0"
                        step="1"
                        name="transfer"
                        defaultValue={Number(p.transfer_cost)}
                        required
                      />
                    </label>
                    <label>
                      <input name="verified" type="checkbox" required />I
                      verified these NGN costs with GO54.
                    </label>
                    <button>Record wholesale snapshot</button>
                  </fieldset>
                </form>
                <form
                  className={styles.form}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void run(() =>
                      configureMarkupAction({
                        extension: String(p.extension),
                        revision: Number(p.revision),
                        mode: f.get("mode") === "MARKUP" ? "MARKUP" : "MANUAL",
                        bps: Number(f.get("bps")),
                        fixed: Number(f.get("fixed")),
                      }),
                    );
                  }}
                >
                  <fieldset disabled={busy}>
                    <label>
                      Pricing mode
                      <select name="mode" defaultValue={String(p.pricing_mode)}>
                        <option value="MANUAL">
                          Keep manual selling prices
                        </option>
                        <option value="MARKUP">
                          Apply markup to verified wholesale costs
                        </option>
                      </select>
                    </label>
                    <label>
                      Markup in basis points (100 = 1%)
                      <input
                        name="bps"
                        type="number"
                        min="0"
                        max="100000"
                        step="1"
                        defaultValue={Number(p.markup_bps)}
                        required
                      />
                    </label>
                    <label>
                      Additional flat margin (kobo)
                      <input
                        name="fixed"
                        type="number"
                        min="0"
                        step="1"
                        defaultValue={Number(p.markup_fixed_kobo)}
                        required
                      />
                    </label>
                    <button>Save pricing policy</button>
                  </fieldset>
                </form>
              </article>
            ))}
          </details>
          <p className={styles.note}>
            Retrieval methods under review: nameservers{" "}
            {data.retrievalMethods.nameservers}, lock{" "}
            {data.retrievalMethods.lock}, EPP {data.retrievalMethods.epp}. No
            automatic GET/POST fallback is used.
          </p>
          {data.diagnostics.length > 0 ? (
            <details>
              <summary>Redacted provider diagnostics</summary>
              <p className={styles.note}>
                HTTP and JSON transport evidence only. These records do not
                prove registrar success or enable purchases.
              </p>
              {data.diagnostics.map((item) => (
                <article key={String(item.id)}>
                  <h3>
                    {String(item.operation)} · {String(item.method)} · HTTP{" "}
                    {String(item.http_status ?? "unknown")}
                  </h3>
                  <p>
                    {String(item.observed_at)} · JSON{" "}
                    {item.json_valid === true
                      ? "valid"
                      : "invalid or unavailable"}
                  </p>
                  <pre
                    style={{
                      overflow: "auto",
                      maxHeight: "20rem",
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {JSON.stringify(item.sanitized_payload, null, 2)}
                  </pre>
                </article>
              ))}
            </details>
          ) : null}
          {data.operations.length > 0 ? (
            <>
              <h3>Registrar transaction reconciliation</h3>
              {data.operations.map((op) => (
                <div key={String(op.id)}>
                  <p>
                    {String(op.domain)} · {String(op.kind)} · {String(op.state)}{" "}
                    ·{" "}
                    {String(
                      op.transaction_reference || "No confirmed transaction",
                    )}
                    . {String(op.reason || "")}
                  </p>
                  <ReconcileOperation operation={op} done={reload} />
                </div>
              ))}
            </>
          ) : null}
          {data.alerts.length > 0 ? (
            <>
              <h3>Private alerts</h3>
              {data.alerts.map((a) => (
                <p key={String(a.id)}>
                  {String(a.subject)} — {String(a.detail)}
                </p>
              ))}
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
