import { query } from "@/lib/custom/service";
import { ActionForm } from "@/components/distribution/action-form";
import {
  addAcquisitionCostAction,
  voidAcquisitionCostAction,
  captureRevenueSnapshotAction,
  reconcileLegacyRevenueAction,
  recordOperationalCheckAction,
} from "@/lib/actions/growth-reporting-actions";
export async function GrowthControls({
  operational = false,
}: {
  operational?: boolean;
}) {
  const present = (
    await query(
      "SELECT to_regclass('public.growth_acquisition_costs') costs,to_regclass('public.growth_operational_checks') checks",
    )
  )[0];
  if (!present?.costs || !present?.checks)
    return (
      <p className="text-sm text-ink-muted">
        Install migration 075 to enable growth evidence controls.
      </p>
    );
  const [sources, costs, checks] = await Promise.all([
    query("SELECT id,name FROM affiliates ORDER BY name LIMIT 500"),
    query(
      "SELECT c.*,a.name source FROM growth_acquisition_costs c LEFT JOIN affiliates a ON a.id=c.affiliate_id ORDER BY created_at DESC LIMIT 20",
    ),
    query(
      "SELECT kind,evidence,verified_at FROM growth_operational_checks ORDER BY kind",
    ),
  ]);
  const input =
    "block mt-2 w-full rounded-lg border border-border bg-paper p-3";
  return (
    <details className="rounded-2xl border border-border bg-paper p-5">
      <summary className="cursor-pointer font-semibold">
        Revenue evidence &amp; operational verification controls
      </summary>
      <div className="mt-5 space-y-6">
        <ActionForm action={addAcquisitionCostAction}>
          <h3 className="font-semibold">Record acquisition spend</h3>
          <p className="my-2 text-xs text-ink-muted">
            Use real supplier, campaign or invoice evidence. Amounts are NGN
            kobo (100 kobo = ₦1). This does not make a payment.
          </p>
          <label>
            Referral account
            <select className={input} name="affiliate_id">
              <option value="">Unallocated</option>
              {sources.map((s) => (
                <option key={String(s.id)} value={String(s.id)}>
                  {String(s.name)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Spend date
            <input className={input} name="spent_on" type="date" required />
          </label>
          <label>
            Amount (NGN)
            <input
              className={input}
              name="amount_ngn"
              type="number"
              min="0.01"
              max="20000000"
              step="0.01"
              required
            />
          </label>
          <label>
            Evidence reference
            <input
              className={input}
              name="evidence"
              minLength={5}
              maxLength={500}
              required
              placeholder="Supplier invoice or approved campaign reference; no secrets"
            />
          </label>
          <button className="mt-3 rounded-lg bg-primary p-3 text-on-primary">
            Record spend
          </button>
        </ActionForm>
        <div>
          <h3 className="font-semibold">Recent recorded costs</h3>
          <ul className="mt-3 space-y-3">
            {costs.map((c) => (
              <li
                className="rounded-lg border border-border p-3 text-sm"
                key={String(c.id)}
              >
                {String(c.source || "Unallocated")} · NGN{" "}
                {(Number(c.amount_kobo) / 100).toLocaleString("en-NG")} ·{" "}
                {String(c.spent_on).slice(0, 10)}
                <p className="break-words text-xs text-ink-muted">
                  {String(c.evidence)}
                </p>
                {c.voided_at ? (
                  <p>Voided</p>
                ) : (
                  <ActionForm action={voidAcquisitionCostAction}>
                    <input type="hidden" name="id" value={String(c.id)} />
                    <label className="mt-2 block text-xs">
                      <input type="checkbox" required /> Confirm this cost
                      record is incorrect
                    </label>
                    <button className="mt-2 text-danger underline">
                      Void incorrect cost
                    </button>
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        </div>
        <ActionForm action={captureRevenueSnapshotAction}>
          <h3 className="font-semibold">Daily recurring-revenue evidence</h3>
          <p className="my-2 text-sm text-ink-muted">
            The existing daily sweep captures one immutable snapshot per WAT
            day. Capture today if none exists; existing days are not
            overwritten.
          </p>
          <button className="rounded-lg bg-primary p-3 text-on-primary">
            Capture today’s evidence
          </button>
        </ActionForm>
        <ActionForm action={reconcileLegacyRevenueAction}>
          <h3 className="font-semibold">Reconcile a legacy hosting payment</h3>
          <p className="my-2 text-sm text-ink-muted">
            Read-only verification against Paystack. The successful live NGN
            payment must match the organization and current legacy contract
            amount/cycle. This does not charge the customer or change access.
          </p>
          <label>
            Provider payment reference
            <input
              className={input}
              name="reference"
              minLength={8}
              maxLength={160}
              required
            />
          </label>
          <button className="mt-3 rounded-lg bg-primary p-3 text-on-primary">
            Verify payment evidence
          </button>
        </ActionForm>
        <div>
          <h3 className="font-semibold">Operational verification records</h3>
          <p className="my-2 text-xs text-ink-muted">
            Team attestations with evidence, not automatic proof of provider
            health. Re-verify after deployment/configuration changes. Never
            paste connection strings or tokens.
          </p>
          <ul className="space-y-2">
            {["BACKUP_RESTORE", "MONITORING", "WEBHOOK", "SCHEDULER"].map(
              (kind) => {
                const c = checks.find((c) => c.kind === kind);
                return (
                  <li className="text-sm" key={kind}>
                    <strong>{kind.replaceAll("_", " ")}</strong>:{" "}
                    {c
                      ? `Recorded ${new Date(String(c.verified_at)).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })} WAT — ${String(c.evidence)}`
                      : "Not verified"}
                  </li>
                );
              },
            )}
          </ul>
          {operational && (
            <ActionForm action={recordOperationalCheckAction}>
              <label>
                Check
                <select name="kind" className={input}>
                  {["BACKUP_RESTORE", "MONITORING", "WEBHOOK", "SCHEDULER"].map(
                    (k) => (
                      <option key={k}>{k}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Verification evidence
                <textarea
                  className={input}
                  name="evidence"
                  minLength={10}
                  maxLength={1000}
                  required
                />
              </label>
              <button className="mt-3 rounded-lg bg-primary p-3 text-on-primary">
                Record completed check
              </button>
            </ActionForm>
          )}
        </div>
      </div>
    </details>
  );
}
