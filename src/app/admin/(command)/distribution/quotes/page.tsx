import { guardAdminPage } from "@/lib/admin-page-guard";
import { query } from "@/lib/custom/service";
import {
  createPartnerQuoteAction,
  completePartnerQuoteAction,
} from "@/lib/actions/distribution-program-actions";
import { ActionForm } from "@/components/distribution/action-form";
export const dynamic = "force-dynamic";
export default async function Page() {
  await guardAdminPage("manage_team");
  const requests = await query(
    "SELECT r.id,r.product,r.message,a.name FROM partner_service_requests r JOIN partner_client_access x ON x.id=r.relationship_id JOIN affiliates a ON a.id=x.partner_id JOIN distribution_contracts c ON c.affiliate_id=a.id WHERE c.status='ACTIVE' AND c.model='RESELLER' AND x.revoked_at IS NULL ORDER BY r.created_at DESC LIMIT 100",
  );
  const quotes = await query(
    "SELECT q.*,a.name FROM partner_commercial_quotes q JOIN distribution_contracts c ON c.id=q.contract_id JOIN affiliates a ON a.id=c.affiliate_id ORDER BY q.created_at DESC LIMIT 100",
  );
  return (
    <div className="space-y-6 text-ink">
      <h1 className="text-3xl font-semibold">Reseller service quotes</h1>
      <p>
        Quotes require a current accepted reseller agreement and client
        authorization. The named billing business owner must accept before JKTL
        arranges payment and fulfillment. This page never charges an account or
        marks an order paid.
      </p>
      <ActionForm
        action={createPartnerQuoteAction}
        className="grid gap-3 rounded-xl border border-border p-5"
      >
        <label>
          Authorized service request
          <select
            name="request"
            required
            className="block w-full rounded border border-border bg-paper p-3"
          >
            {requests.map((r) => (
              <option key={String(r.id)} value={String(r.id)}>
                {String(r.name)} · {String(r.product)} ·{" "}
                {String(r.message).slice(0, 100)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Agreed JKTL amount (kobo)
          <input
            name="amount"
            required
            type="number"
            min={1}
            max={2000000000}
            className="block w-full rounded border border-border bg-paper p-3"
          />
        </label>
        <label>
          Contractual billing party
          <select
            name="billingParty"
            className="ml-2 rounded border border-border bg-paper p-2"
          >
            <option value="CUSTOMER">Client business</option>
            <option value="PARTNER">Partner business</option>
          </select>
        </label>
        <label>
          Scope, taxes, refunds, provider approval and payment/fulfillment
          responsibilities
          <textarea
            name="scope"
            minLength={20}
            maxLength={5000}
            required
            className="block w-full rounded border border-border bg-paper p-3"
          />
        </label>
        <label>
          <input type="checkbox" required name="reviewed" />I verified
          licensing, resale rights, economics and scope. Supplier/provider
          provisioning is not implied by this quote.
        </label>
        <button className="rounded-lg bg-primary p-3 text-on-primary">
          Issue 14-day quote
        </button>
      </ActionForm>
      {quotes.map((q) => (
        <article
          key={String(q.id)}
          className="space-y-3 rounded-xl border border-border p-5"
        >
          <strong>
            {String(q.name)} · {String(q.status)} · ₦
            {(Number(q.amount_kobo) / 100).toLocaleString("en-NG")}
          </strong>
          <p>Billing: {String(q.billing_party)}</p>
          {q.actual_supplier_cost_kobo != null && (
            <p>
              Verified JKTL margin: ₦
              {(
                (Number(q.amount_kobo) - Number(q.actual_supplier_cost_kobo)) /
                100
              ).toLocaleString("en-NG")}
            </p>
          )}
          <p className="whitespace-pre-wrap">{String(q.scope)}</p>
          {q.status === "ACCEPTED" && (
            <ActionForm
              action={completePartnerQuoteAction}
              className="space-y-3"
            >
              <input type="hidden" name="id" value={String(q.id)} />
              <label>
                Verified JKTL order/invoice payment reference
                <input
                  name="paymentReference"
                  required
                  minLength={5}
                  maxLength={200}
                  className="block w-full rounded border border-border bg-paper p-3"
                />
              </label>
              <label>
                Actual supplier/provider fulfillment reference
                <input
                  name="supplierReference"
                  required
                  minLength={3}
                  maxLength={200}
                  className="block w-full rounded border border-border bg-paper p-3"
                />
              </label>
              <label>
                Actual supplier cost (kobo)
                <input
                  name="supplierCost"
                  type="number"
                  required
                  min={0}
                  max={Number(q.amount_kobo)}
                  className="block w-full rounded border border-border bg-paper p-3"
                />
              </label>
              <label>
                Actual order/payment reconciliation and provider work evidence
                <textarea
                  name="proof"
                  required
                  minLength={10}
                  maxLength={1000}
                  className="block w-full rounded border border-border bg-paper p-3"
                />
              </label>
              <label>
                <input name="confirmed" type="checkbox" required />I verified
                the accepted scope, actual payment/order records and completed
                work. This does not change domain, email or payment records.
              </label>
              <button className="rounded border border-border p-3">
                Record manual fulfillment
              </button>
            </ActionForm>
          )}
        </article>
      ))}
    </div>
  );
}
