import { query } from "@/lib/custom/service";
import { activationGate } from "@/lib/merchant-fees/service";
import { BuyerFeeEditor } from "./BuyerFeeEditor";
import { ActionForm } from "@/components/distribution/action-form";
import {
  activateBuyerFeePolicyAction,
  rollbackBuyerFeePolicyAction,
} from "@/lib/actions/merchant-fee-actions";
export async function BuyerFeePolicyControls() {
  if (
    !(
      await query("SELECT to_regclass('public.merchant_fee_policies') present")
    )[0]?.present
  )
    return (
      <p className="text-sm text-ink-muted">
        Buyer-paid fee configuration is available after migration 077. The
        existing invoice arrangement is preserved.
      </p>
    );
  const [policies, config, businesses, history] = await Promise.all([
    query(
      "SELECT id,version,label,enabled,bands,sources,exempt_organizations,created_at FROM merchant_fee_policies WHERE id=(SELECT active_policy_id FROM merchant_fee_configuration WHERE id=true) OR id IN(SELECT id FROM merchant_fee_policies ORDER BY version DESC LIMIT 30) ORDER BY version DESC",
    ),
    query("SELECT * FROM merchant_fee_configuration WHERE id=true"),
    query(
      "SELECT o.id,COALESCE(NULLIF(b.display_name,''),o.name,o.slug) name FROM organizations o LEFT JOIN business_profiles b ON b.organization_id=o.id WHERE o.slug<>'demo' ORDER BY name LIMIT 500",
    ),
    query(
      "SELECT event,detail,created_at FROM company_finance_audit WHERE event LIKE 'BUYER_FEE_POLICY_%' ORDER BY created_at DESC LIMIT 20",
    ),
  ]);
  const c = config[0],
    gate = activationGate(),
    active = policies.find((p) => p.id === c?.active_policy_id),
    effective = Boolean(
      active &&
      gate &&
      c?.approved_at &&
      String(c?.provider_evidence || "").length >= 10 &&
      String(c?.requirements_evidence || "").length >= 10,
    ),
    input = "mt-2 block w-full rounded-lg border border-border bg-paper p-3";
  return (
    <details className="rounded-xl border border-border p-4">
      <summary className="cursor-pointer font-semibold">
        Buyer-paid transaction fees ·{" "}
        {effective ? "approved policy selected" : "proposed schedule inactive"}
      </summary>
      <div className="mt-5 space-y-6">
        <p className="text-sm leading-6 text-ink-muted">
          Existing invoice checkouts use the legacy fixed arrangement until the
          deployment approval gate and a reviewed policy are both active. New
          policy versions never change issued quotes or completed payments.
          Buyers pay the platform fee; processor costs remain allocated to JKTL
          through the existing Paystack bearer setting. Native store checkout is
          not currently implemented.
        </p>
        <p className="text-sm">
          Activation gate:{" "}
          {gate || "locked — test evidence and explicit approval required"}.
          Active configuration:{" "}
          {active
            ? `version ${active.version} · ${active.label}`
            : "legacy invoice policy"}
          . A disabled approved policy applies zero platform fee to new merchant
          payments; rollback returns to the legacy fixed fee.
        </p>
        <BuyerFeeEditor
          initial={
            policies[0]
              ? {
                  label: String(policies[0].label),
                  enabled: Boolean(policies[0].enabled),
                  bands: policies[0].bands as {
                    minKobo: number;
                    feeKobo: number;
                  }[],
                  sources: policies[0].sources as string[],
                  exemptions: policies[0].exempt_organizations as string[],
                }
              : undefined
          }
          businesses={businesses.map((b) => ({
            id: String(b.id),
            name: String(b.name),
          }))}
        />
        <ActionForm action={activateBuyerFeePolicyAction}>
          <h3 className="font-semibold">
            Approve a version for future checkouts
          </h3>
          <input type="hidden" name="rev" value={Number(c?.rev || 0)} />
          <label>
            Policy version
            <select name="policy_id" className={input}>
              {policies.map((p) => (
                <option key={String(p.id)} value={String(p.id)}>
                  v{String(p.version)} · {String(p.label)} ·{" "}
                  {p.enabled ? "fee enabled" : "zero fees"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Provider split/fee-bearing test evidence
            <textarea
              name="provider_evidence"
              minLength={10}
              maxLength={1000}
              required
              className={input}
            />
          </label>
          <label>
            Permitted surcharge review and JKTL activation approval
            <textarea
              name="requirements_evidence"
              minLength={10}
              maxLength={1000}
              required
              className={input}
            />
          </label>
          <label className="mt-3 flex gap-2 text-sm">
            <input type="checkbox" name="confirmed" required />I verified split
            allocations, processing costs, buyer disclosures and the required
            activation approval.
          </label>
          <button
            disabled={!gate}
            className="mt-3 rounded-lg bg-primary p-3 text-on-primary disabled:opacity-50"
          >
            Approve activation
          </button>
        </ActionForm>
        <ActionForm action={rollbackBuyerFeePolicyAction}>
          <h3 className="font-semibold">
            Return future checkouts to the legacy arrangement
          </h3>
          <input type="hidden" name="rev" value={Number(c?.rev || 0)} />
          <label>
            Rollback evidence
            <input
              name="reason"
              minLength={10}
              maxLength={1000}
              required
              className={input}
            />
          </label>
          <label className="mt-3 flex gap-2 text-sm">
            <input name="confirmed" type="checkbox" required />I understand that
            this restores the existing fixed invoice surcharge for new quotes,
            rather than zero fees.
          </label>
          <button className="mt-3 text-primary underline">
            Restore legacy policy
          </button>
        </ActionForm>
        <details>
          <summary className="cursor-pointer font-semibold">
            Review immutable policy versions
          </summary>
          <ul className="mt-4 space-y-4 text-sm">
            {policies.map((p) => (
              <li
                key={String(p.id)}
                className="rounded-lg border border-border p-4"
              >
                <h3 className="font-semibold">
                  v{String(p.version)} · {String(p.label)}{" "}
                  {p.id === c?.active_policy_id
                    ? "· selected configuration"
                    : ""}
                </h3>
                <p className="mt-2">
                  {p.enabled
                    ? "Fees enabled if separately activated"
                    : "Zero platform fees"}{" "}
                  ·{" "}
                  {(p.sources as string[]).join(", ") || "No eligible sources"}{" "}
                  · {(p.exempt_organizations as string[]).length} exempt
                  businesses
                </p>
                <ul className="mt-2 text-xs leading-6">
                  {(p.bands as { minKobo: number; feeKobo: number }[]).map(
                    (b) => (
                      <li key={b.minKobo}>
                        From NGN {(b.minKobo / 100).toLocaleString("en-NG")}:
                        NGN {(b.feeKobo / 100).toLocaleString("en-NG")} per
                        payment
                      </li>
                    ),
                  )}
                </ul>
              </li>
            ))}
          </ul>
        </details>
        <div className="space-y-2 text-xs text-ink-muted">
          <h3 className="font-semibold text-ink">Policy audit history</h3>
          {history.length ? (
            history.map((h, i) => (
              <p key={i}>
                {new Date(String(h.created_at)).toLocaleString("en-NG", {
                  timeZone: "Africa/Lagos",
                })}{" "}
                WAT · {String(h.event)} ·{" "}
                {String(
                  (h.detail as Record<string, unknown>).policy || "legacy",
                )}
              </p>
            ))
          ) : (
            <p>No activation or changes have been recorded.</p>
          )}
        </div>
      </div>
    </details>
  );
}
