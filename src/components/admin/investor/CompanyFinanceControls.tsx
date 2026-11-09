import { BuyerFeePolicyControls } from "./BuyerFeePolicyControls";
import { randomUUID } from "node:crypto";
import { query } from "@/lib/custom/service";
import type { Period } from "@/lib/investor/model";
import { ActionForm } from "@/components/distribution/action-form";
import {
  saveGrowthCampaignAction,
  recordCompanyCostsAction,
  reverseCompanyCostAction,
  saveCostCategoryAction,
  attestFinancePeriodAction,
  reconcileMerchantPaymentAction,
  reconcileMerchantFeeAction,
} from "@/lib/actions/company-finance-actions";
export async function CompanyFinanceControls({ period }: { period: Period }) {
  if (
    !(
      await query("SELECT to_regclass('public.company_cost_entries') present")
    )[0]?.present
  )
    return (
      <p className="text-sm text-ink-muted">
        Company cost and payment evidence controls become available after
        migration 076.
      </p>
    );
  const [categories, costs, attempts, payments, coverage] = await Promise.all([
    query("SELECT * FROM company_cost_categories ORDER BY name"),
    query(
      "SELECT c.*,EXISTS(SELECT 1 FROM company_cost_entries r WHERE r.reverses_id=c.id) reversed FROM company_cost_entries c ORDER BY created_at DESC LIMIT 30",
    ),
    query(
      "SELECT reference,state,created_at FROM merchant_payment_attempts WHERE state IN('UNKNOWN','INITIALIZING','REVIEW') UNION ALL SELECT reference,'RECONCILIATION_REQUIRED' state,created_at FROM merchant_reconciliation_issues WHERE resolved_at IS NULL ORDER BY created_at LIMIT 30",
    ),
    query(
      "SELECT reference,gross_fee_kobo,split_evidenced,applied_to_invoice FROM merchant_payments ORDER BY verified_at DESC LIMIT 30",
    ),
    query(
      "SELECT * FROM company_finance_periods WHERE from_day=$1 AND to_day=$2",
      [period.from, period.to],
    ),
  ]);
  const feeControls = await BuyerFeePolicyControls();
  const input =
    "mt-2 block w-full rounded-lg border border-border bg-paper p-3";
  return (
    <details className="rounded-2xl border border-border bg-paper p-5">
      <summary className="cursor-pointer font-semibold">
        Company costs, payment reconciliation &amp; period coverage
      </summary>
      <div className="mt-5 space-y-8">
        {feeControls}
        <ActionForm action={saveGrowthCampaignAction}>
          <h3 className="font-semibold">Approve a UTM campaign</h3>
          <p className="my-2 text-xs text-ink-muted">
            Only these exact approved labels can be stored from consenting
            visitors. Use campaign labels, never names, email addresses or other
            personal information. Create a new identifier when changing
            attribution labels.
          </p>
          {[
            ["id", "Identifier"],
            ["name", "Campaign name"],
            ["utm_source", "UTM source"],
            ["utm_medium", "UTM medium"],
            ["utm_campaign", "UTM campaign"],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <input className={input} name={key} maxLength={80} required />
            </label>
          ))}
          <label>
            <input name="enabled" type="checkbox" defaultChecked />
            Enabled
          </label>
          <button className="mt-3 rounded-lg bg-primary p-3 text-on-primary">
            Save approved campaign
          </button>
        </ActionForm>
        <ActionForm action={recordCompanyCostsAction}>
          <h3 className="font-semibold">Record a company expense</h3>
          <p className="my-2 text-xs text-ink-muted">
            Company costs only. Merchant expenses are excluded. Existing
            acquisition spend, verified processing costs, wholesale evidence and
            policy payouts are reused separately; do not enter them twice. For
            other processing costs, use the actual provider transaction
            reference.
          </p>
          <label>
            Category
            <select name="category_id" className={input}>
              {categories
                .filter((c) => c.enabled)
                .map((c) => (
                  <option key={String(c.id)} value={String(c.id)}>
                    {String(c.name)} · {String(c.classification)}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Date
            <input name="incurred_on" type="date" className={input} required />
          </label>
          <label>
            Original amount
            <input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              className={input}
              required
            />
          </label>
          <label>
            Currency
            <select name="currency" className={input}>
              {["NGN", "USD", "GBP", "EUR"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            NGN per original currency unit (required for foreign costs)
            <input
              name="fx_rate"
              type="number"
              min="0.00000001"
              step="0.00000001"
              className={input}
            />
          </label>
          <label>
            Unique supplier/payment reference
            <input
              name="economic_key"
              minLength={5}
              maxLength={200}
              className={input}
              required
            />
          </label>
          <label>
            Evidence or invoice reference
            <textarea
              name="evidence"
              minLength={5}
              maxLength={1000}
              className={input}
              required
            />
          </label>
          <button className="mt-3 rounded-lg bg-primary p-3 text-on-primary">
            Record company expense
          </button>
        </ActionForm>
        <details>
          <summary className="cursor-pointer font-semibold">
            Import evidenced expenses (JSON or CSV)
          </summary>
          <p className="my-3 text-sm text-ink-muted">
            Import up to 200 rows. Required columns: category_id, incurred_on
            (YYYY-MM-DD), amount, currency, economic_key, evidence; fx_rate is
            required for foreign costs. Stable supplier references prevent
            duplicates. Existing records are never overwritten.
          </p>
          <CompanyCostImport categories={categories.map((c) => String(c.id))} />
        </details>
        <div>
          <h3 className="font-semibold">Recent company costs</h3>
          <ul className="mt-3 space-y-3">
            {costs.map((c) => (
              <li
                className="rounded-lg border border-border p-3 text-sm"
                key={String(c.id)}
              >
                <p>
                  {String(c.category_id)} · {String(c.currency)}{" "}
                  {(Number(c.amount_minor) / 100).toLocaleString("en-NG")} · NGN{" "}
                  {(Number(c.ngn_kobo) / 100).toLocaleString("en-NG")}
                </p>
                <p className="break-words text-xs text-ink-muted">
                  {String(c.economic_key)} · {String(c.evidence)}
                </p>
                {c.reversed || c.reverses_id ? (
                  <p className="text-xs">Compensating entry recorded</p>
                ) : (
                  <ActionForm action={reverseCompanyCostAction}>
                    <input type="hidden" name="id" value={String(c.id)} />
                    <label>
                      Reason for reversal
                      <input
                        name="reason"
                        minLength={10}
                        maxLength={1000}
                        className={input}
                        required
                      />
                    </label>
                    <label className="mt-2 block">
                      <input type="checkbox" required />
                      Confirm this cost needs a compensating reversal
                    </label>
                    <button className="mt-2 text-danger underline">
                      Reverse incorrect cost
                    </button>
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        </div>
        <ActionForm action={saveCostCategoryAction}>
          <h3 className="font-semibold">Create or update a cost category</h3>
          <label>
            Identifier
            <input
              className={input}
              name="id"
              pattern="[a-z][a-z0-9_-]{1,49}"
              required
            />
          </label>
          <label>
            Name
            <input
              className={input}
              name="name"
              minLength={2}
              maxLength={100}
              required
            />
          </label>
          <label>
            Classification
            <select name="classification" className={input}>
              {["DIRECT", "OPEX", "TAX"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            <input type="checkbox" name="enabled" defaultChecked />
            Enabled
          </label>
          <p className="my-2 text-xs text-ink-muted">
            Used categories retain their classification; create a new category
            for a different treatment.
          </p>
          <button className="rounded-lg bg-primary p-3 text-on-primary">
            Save category
          </button>
        </ActionForm>
        <ActionForm action={attestFinancePeriodAction}>
          <h3 className="font-semibold">
            Verify completeness for {period.from}–{period.to}
          </h3>
          <input type="hidden" name="from" value={period.from} />
          <input type="hidden" name="to" value={period.to} />
          <input
            type="hidden"
            name="rev"
            value={Number(coverage[0]?.rev || 0)}
          />
          <p className="my-3 text-xs leading-6 text-ink-muted">
            Confirm only after reconciling the whole period to provider
            statements, supplier costs and company records. Cash/receipt-basis
            management results are not audited accounting profit. New financial
            entries invalidate affected period confirmations.
          </p>
          {[
            ["revenue_complete", "Company receipts and fee evidence complete"],
            ["direct_complete", "Direct costs and processing charges complete"],
            [
              "opex_complete",
              "Operating expenses, acquisition spend and commissions complete",
            ],
            ["tax_complete", "Applicable taxes recorded and reconciled"],
          ].map(([name, label]) => (
            <label className="my-2 flex gap-2 text-sm" key={name}>
              <input
                type="checkbox"
                name={name}
                defaultChecked={Boolean(coverage[0]?.[name])}
              />
              {label}
            </label>
          ))}
          <label>
            Reconciliation evidence
            <textarea
              className={input}
              name="evidence"
              minLength={10}
              maxLength={1000}
              required
            />
          </label>
          <button className="mt-3 rounded-lg bg-primary p-3 text-on-primary">
            Save period coverage
          </button>
        </ActionForm>
        <ActionForm action={reconcileMerchantPaymentAction}>
          <h3 className="font-semibold">
            Recheck an uncertain merchant payment
          </h3>
          <p className="my-2 text-xs text-ink-muted">
            Read-only Paystack verification. No new charge is started. Timeouts
            remain uncertain, not failed.
          </p>
          <label>
            Recorded provider reference
            <input className={input} name="reference" required />
          </label>
          <button className="mt-3 rounded-lg bg-primary p-3 text-on-primary">
            Verify recorded payment
          </button>
        </ActionForm>
        <ul className="space-y-2 text-xs">
          {attempts.map((a) => (
            <li key={String(a.reference)} className="break-all">
              {String(a.reference)} · {String(a.state)}
            </li>
          ))}
        </ul>
        <ActionForm action={reconcileMerchantFeeAction}>
          <h3 className="font-semibold">
            Record confirmed refund/dispute fee allocation
          </h3>
          <p className="my-2 text-xs leading-6 text-ink-muted">
            Use actual provider evidence. Zero reversal means the original
            platform fee was retained, not that the dispute was ignored. This
            records an accounting adjustment only; it does not refund, transfer
            or charge money. Legacy payments without original split evidence
            remain excluded until that split is explicitly confirmed below.
          </p>
          <label>
            Payment reference
            <select name="reference" className={input}>
              {payments.map((p) => (
                <option key={String(p.reference)} value={String(p.reference)}>
                  {String(p.reference)}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="request_id" value={randomUUID()} />
          <label>
            Additional confirmed fee reversal (NGN)
            <input
              className={input}
              name="reversal"
              type="number"
              min="0"
              step="0.01"
              required
            />
          </label>
          <label>
            Evidence
            <textarea
              className={input}
              name="evidence"
              minLength={10}
              maxLength={1000}
              required
            />
          </label>
          <label className="my-3 flex gap-2 text-sm">
            <input type="checkbox" name="split_confirmed" />I have verified the
            original provider split to the correct merchant subaccount and JKTL
            fee
          </label>
          <button className="mt-3 rounded-lg bg-primary p-3 text-on-primary">
            Record confirmed allocation
          </button>
        </ActionForm>
      </div>
    </details>
  );
}
import { CompanyCostImport } from "./CompanyCostImport";
