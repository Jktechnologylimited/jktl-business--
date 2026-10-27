import { ActionForm } from "@/components/distribution/action-form";
import { PolicyBankForm } from "@/components/distribution/policy-bank-form";
import { CopyReferralLink } from "@/components/affiliates/copy-referral-link";
import Link from "next/link";
import { requireAffiliateSession } from "@/lib/affiliate-session";
import { query } from "@/lib/custom/service";
import {
  acceptDistributionContractAction,
  requestDistributionPayoutAction,
} from "@/lib/actions/distribution-finance-actions";
export async function CommercialDashboard() {
  const a = await requireAffiliateSession();
  const [contracts, ledger, payouts, adjustments, settings] = await Promise.all(
    [
      query(
        "SELECT c.id,c.terms,c.model,c.status,c.accepted_at,c.activated_at,COALESCE((c.terms->>'payoutMinimumKobo')::bigint,t.minimum_kobo) payout_minimum,COALESCE((c.terms->>'payoutRequestDay')::int,t.request_day) request_day,COALESCE((c.terms->>'payoutPaymentDay')::int,t.payment_day) payment_day FROM distribution_contracts c LEFT JOIN distribution_contract_payout_terms t ON t.contract_id=c.id WHERE c.affiliate_id=$1 ORDER BY c.created_at DESC",
        [a.id],
      ),
      query(
        "SELECT l.reference,l.product,l.currency,l.net_kobo,l.rate_bps,l.amount_kobo,l.status,COALESCE((SELECT r->>'kind' FROM distribution_contracts c CROSS JOIN jsonb_array_elements(COALESCE(c.terms->'productRules','[]')) r WHERE c.id=l.contract_id AND r->>'product'=l.product LIMIT 1),'PERCENTAGE') commission_kind,eligible_months,l.available_at,l.created_at FROM distribution_ledger l WHERE l.affiliate_id=$1 ORDER BY l.created_at DESC LIMIT 100",
        [a.id],
      ),
      query(
        "SELECT id,amount_kobo,status,bank_reference,created_at FROM distribution_payouts WHERE affiliate_id=$1 ORDER BY created_at DESC LIMIT 100",
        [a.id],
      ),
      query(
        "SELECT amount_kobo,reason,created_at FROM distribution_adjustments WHERE affiliate_id=$1 ORDER BY created_at DESC LIMIT 100",
        [a.id],
      ),
      query(
        "SELECT minimum_payout_kobo,payout_day FROM distribution_finance_settings WHERE id=true",
      ),
    ],
  );
  const bank = (
    await query(
      "SELECT bank_code,bank_name,account_number,account_name,bank_verified_at,referral_code,commission_model FROM affiliates WHERE id=$1",
      [a.id],
    )
  )[0];
  const quotes =
    a.programme === "partner"
      ? await query(
          "SELECT q.id,q.scope,q.status,q.amount_kobo,q.billing_party FROM partner_commercial_quotes q JOIN partner_service_requests r ON r.id=q.request_id JOIN partner_client_access x ON x.id=r.relationship_id WHERE x.partner_id=$1 AND x.revoked_at IS NULL ORDER BY q.created_at DESC LIMIT 100",
          [a.id],
        )
      : [];
  const applicable = contracts.find(
    (c) => c.status === "ACTIVE" || c.status === "SUSPENDED",
  );
  const day = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Lagos",
      day: "numeric",
    }).format(new Date()),
  );
  const opening = Number(
    applicable?.request_day || settings[0]?.payout_day || 21,
  );
  const lagosParts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "numeric",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  const nextWindow = new Date(
    Date.UTC(Number(lagosParts.year), Number(lagosParts.month) - 1, opening),
  ).toLocaleDateString("en-NG", { timeZone: "Africa/Lagos" });
  const referrals = await query(
    "SELECT r.organization_id,r.created_at FROM affiliate_referrals r WHERE r.affiliate_id=$1 ORDER BY r.created_at DESC LIMIT 100",
    [a.id],
  );
  return (
    <div className="space-y-6 text-ink">
      <h1 className="text-3xl font-semibold">Agreements & verified earnings</h1>
      <nav className="flex flex-wrap gap-4" aria-label="Earnings sections">
        <a className="underline" href="#referrals">
          Referrals
        </a>
        <a className="underline" href="#commissions">
          Commissions & agreements
        </a>
        <a className="underline" href="#payouts">
          Payouts
        </a>
      </nav>
      <section id="referrals" className="space-y-2">
        <h2 className="text-xl font-semibold">Referred customers</h2>
        {!referrals.length && <p>No referred customers yet.</p>}
        {referrals.map((r) => (
          <p key={String(r.organization_id)}>
            Business {String(r.organization_id).slice(0, 8)} ·{" "}
            {new Date(String(r.created_at)).toLocaleDateString("en-NG")}
          </p>
        ))}
      </section>
      <div id="commissions" />
      <CopyReferralLink
        link={
          "https://jktl.com.ng/?ref=" +
          encodeURIComponent(String(bank?.referral_code || ""))
        }
      />
      <div id="payouts" />
      <PolicyBankForm
        bank={{
          bankCode: String(bank?.bank_code || ""),
          bankName: String(bank?.bank_name || ""),
          accountNumber: String(bank?.account_number || ""),
          accountName: String(bank?.account_name || ""),
          verified: Boolean(bank?.bank_verified_at),
        }}
      />
      <p>
        Individual agreements apply only after acceptance and formal activation.{" "}
        {bank?.commission_model !== "policy" && (
          <>
            Existing earned commissions and payouts remain in your{" "}
            <Link
              className="underline"
              href={
                a.programme === "partner" ? "/partners/earnings" : "/affiliates"
              }
            >
              legacy earnings dashboard
            </Link>
            .
          </>
        )}
      </p>
      {!contracts.length && (
        <p>
          No new-policy agreement has been offered. Your existing programme
          terms remain applicable.
        </p>
      )}
      {contracts.map((c) => (
        <article
          key={String(c.id)}
          className="space-y-3 rounded-xl border border-border p-5"
        >
          <h2 className="font-semibold">
            {String(c.model)} · {String(c.status)}
          </h2>
          {c.payout_minimum != null && (
            <p className="text-sm">
              Payout minimum: ₦
              {(Number(c.payout_minimum) / 100).toLocaleString("en-NG")} ·
              Requests open from day {String(c.request_day)} · Expected payment
              day {String(c.payment_day)}.
            </p>
          )}
          <AgreementTerms
            terms={c.terms as Record<string, unknown>}
            reseller={c.model === "RESELLER"}
          />
          {Array.isArray((c.terms as Record<string, unknown>).productRules) &&
            (
              (c.terms as Record<string, unknown>).productRules as Record<
                string,
                unknown
              >[]
            ).map((r) => (
              <p className="text-sm" key={String(r.product)}>
                {String(r.product).replaceAll("_", " ")}:{" "}
                {r.kind === "FIXED"
                  ? "₦" + (Number(r.fixedKobo) / 100).toLocaleString("en-NG")
                  : Number(r.rateBps) / 100 + "% of eligible net revenue"}{" "}
                ·{" "}
                {r.recurring
                  ? "First " + r.paidMonths + " paid months"
                  : "One reward per eligible payment"}{" "}
                · Maximum ₦{(Number(r.capKobo) / 100).toLocaleString("en-NG")}{" "}
                per payment · Retained margin ₦
                {(Number(r.marginReserveKobo) / 100).toLocaleString("en-NG")} ·
                Included tax {Number(r.taxBps) / 100}%. Actual supplier costs
                and processing fees are excluded.
              </p>
            ))}
          <p className="text-sm">
            Referral rewards apply to actual eligible captured payments for the
            agreed number of paid service months per referred organization (up
            to 12). Annual payments earn once. Refunds, disputes and
            pass-through costs affect eligibility. Recurring rewards, including
            fixed rewards, are prorated when only part of a payment’s service
            months remains eligible. Reseller pricing does not also earn a
            referral commission.
          </p>
          {c.status === "OFFERED" && (
            <ActionForm
              action={acceptDistributionContractAction}
              className="space-y-3"
            >
              <input type="hidden" name="id" value={String(c.id)} />
              <label className="flex gap-3">
                <input type="checkbox" name="consent" required />I have read and
                accept these exact commercial terms. They do not take effect
                until JKTL formally activates the agreement.
              </label>
              <button className="rounded-lg bg-primary p-3 text-on-primary">
                Accept agreement
              </button>
            </ActionForm>
          )}
        </article>
      ))}
      {quotes.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Client service quotes</h2>
          <p>
            The named billing owner approves and pays through JKTL Business.
            Acceptance does not confirm payment or setup.
          </p>
          {quotes.map((q) => (
            <article
              className="rounded border border-border p-4"
              key={String(q.id)}
            >
              <p>
                ₦{(Number(q.amount_kobo) / 100).toLocaleString("en-NG")} ·{" "}
                {String(q.status)} · Billing: {String(q.billing_party)}
              </p>
              <p className="whitespace-pre-wrap">{String(q.scope)}</p>
            </article>
          ))}
        </section>
      )}
      <section>
        <h2 className="text-xl font-semibold">Commission ledger</h2>
        <a className="underline" href="/api/distribution/statement">
          Download private earnings statement (CSV)
        </a>
        {ledger.map((l) => (
          <article
            key={String(l.reference)}
            className="my-3 rounded border border-border p-4"
          >
            <p>
              {String(l.product)} · {String(l.status)} · ₦
              {(Number(l.amount_kobo) / 100).toLocaleString("en-NG")}
            </p>
            <p className="text-sm">
              Eligible net ₦{(Number(l.net_kobo) / 100).toLocaleString("en-NG")}{" "}
              ·{" "}
              {l.commission_kind === "FIXED"
                ? "Fixed reward"
                : Number(l.rate_bps) / 100 + "%"}{" "}
              · {String(l.eligible_months)} service months
            </p>
          </article>
        ))}
      </section>
      <section>
        <h2 className="text-xl font-semibold">Payouts</h2>
        <p className="my-3 text-sm">
          Requests open from day{" "}
          {String(applicable?.request_day || settings[0]?.payout_day || 21)} of
          each month (Nigeria time). Minimum ₦
          {(
            Number(
              applicable?.payout_minimum ||
                settings[0]?.minimum_payout_kobo ||
                5000000,
            ) / 100
          ).toLocaleString("en-NG")}
          . Verified bank details and reviewed available earnings are required.
          Transfer confirmation follows team review.
        </p>
        <p className="text-sm">
          {day >= opening
            ? "The request window is open today."
            : "Next request window: " + nextWindow + "."}{" "}
          Expected monthly payment day: {String(applicable?.payment_day || 28)}.
          Actual transfers require separate confirmation.
        </p>
        <ActionForm action={requestDistributionPayoutAction}>
          <button className="rounded-lg border border-border p-3">
            Request available new-policy earnings
          </button>
        </ActionForm>
        {payouts.map((p) => (
          <p key={String(p.id)} className="my-3">
            ₦{(Number(p.amount_kobo) / 100).toLocaleString("en-NG")} ·{" "}
            {String(p.status)}
            {p.bank_reference ? " · " + String(p.bank_reference) : ""}
          </p>
        ))}
      </section>
      <section>
        <h2 className="text-xl font-semibold">
          Refund and dispute adjustments
        </h2>
        {adjustments.map((d, i) => (
          <p className="my-2" key={i}>
            ₦{(Number(d.amount_kobo) / 100).toLocaleString("en-NG")} ·{" "}
            {String(d.reason)}
          </p>
        ))}
      </section>
    </div>
  );
}

function AgreementTerms({
  terms: t,
  reseller,
}: {
  terms: Record<string, unknown>;
  reseller: boolean;
}) {
  const money = (v: unknown) =>
    "₦" + (Number(v || 0) / 100).toLocaleString("en-NG");
  return (
    <div className="space-y-3 text-sm">
      {reseller ? (
        <p>
          {String(
            t.wholesaleNote ||
              "Each service requires a separately accepted wholesale quote.",
          )}
        </p>
      ) : (
        <>
          <p className="text-xl font-semibold">
            {Number(t.rateBps || 0) / 100}% of eligible net revenue
          </p>
          <p>
            First {Number(t.paidMonths || 12)} paid service months per customer.
            Earnings are held for at least {Number(t.holdDays || 14)} days, then
            reviewed before becoming available.
          </p>
          <p>
            Eligible website plans:{" "}
            {Array.isArray(t.plans) ? t.plans.join(", ") : "None"}.
          </p>
          <p>
            {String(
              t.netDefinition ||
                "Net revenue excludes processing fees, taxes and agreed pass-through costs.",
            )}
          </p>
          <p>
            Included tax: {Number(t.taxBps || 0) / 100}%. Agreed pass-through
            cost per payment: {money(t.thirdPartyCostKobo)}. Margin reserve:{" "}
            {money(t.marginReserveKobo)}. Maximum commission per payment:{" "}
            {money(t.capKobo)}.
          </p>
        </>
      )}
      <p>
        {String(
          t.refundTermPolicy ||
            "Refunds and payment disputes require reconciliation.",
        )}
      </p>
      <p>
        Currency: {String(t.currency || "NGN")}. No referral reward is added to
        a reseller discount.
      </p>
    </div>
  );
}
