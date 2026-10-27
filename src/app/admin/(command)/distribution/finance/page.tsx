import { ActionForm } from "@/components/distribution/action-form";
import { PayoutBeneficiary } from "@/components/distribution/payout-beneficiary";
import { guardAdminPage } from "@/lib/admin-page-guard";
import { requireAdminCapability } from "@/lib/admin-session";
import { query } from "@/lib/custom/service";
import { WEBSITE_PLANS } from "@/lib/website-pricing";
import {
  requestDistributionPayoutForAffiliateAction,
  recordProductCostAction,
  offerDistributionContractAction,
  activateDistributionContractAction,
  reviewDistributionCommissionAction,
  manageDistributionPayoutAction,
  reconcileDistributionAction,
  resolveDistributionRiskAction,
  setDistributionPayoutSettingsAction,
} from "@/lib/actions/distribution-finance-actions";
export const dynamic = "force-dynamic";
const input = "block w-full rounded border border-border bg-paper p-2";
export default async function Page() {
  await guardAdminPage("record_payouts");
  const a = await requireAdminCapability("record_payouts");
  const [people, policies, contracts, ledger, payouts] = await Promise.all([
    query(
      "SELECT id,name,programme FROM affiliates WHERE NOT EXISTS(SELECT 1 FROM distribution_contracts c WHERE c.affiliate_id=affiliates.id AND c.status IN('OFFERED','ACCEPTED','ACTIVE')) AND NOT EXISTS(SELECT 1 FROM affiliate_referrals r WHERE r.affiliate_id=affiliates.id) AND NOT EXISTS(SELECT 1 FROM affiliate_earnings e WHERE e.affiliate_id=affiliates.id) ORDER BY name",
    ),
    query(
      "SELECT id,name,program FROM distribution_policies WHERE state='DRAFT'",
    ),
    query(
      "SELECT c.*,a.name FROM distribution_contracts c JOIN affiliates a ON a.id=c.affiliate_id ORDER BY c.created_at DESC LIMIT 100",
    ),
    query(
      "SELECT l.*,a.name FROM distribution_ledger l JOIN affiliates a ON a.id=l.affiliate_id ORDER BY l.created_at DESC LIMIT 100",
    ),
    query(
      "SELECT p.id,p.amount_kobo,p.currency,p.status,p.bank_reference,p.created_at,a.name,p.bank_snapshot->>'bankName' AS bank_name,right(p.bank_snapshot->>'accountNumber',4) AS last4,p.bank_snapshot->>'accountName' AS account_name FROM distribution_payouts p JOIN affiliates a ON a.id=p.affiliate_id ORDER BY p.created_at DESC LIMIT 100",
    ),
  ]);
  const risks = await query(
    "SELECT s.reference,s.state,s.evidence FROM distribution_risk_state s WHERE s.state='OPEN' ORDER BY s.updated_at DESC LIMIT 100",
  );
  const flags = await query(
    "SELECT reference,reason,created_at FROM distribution_fraud_flags ORDER BY created_at DESC LIMIT 100",
  );
  const totals = (
    await query(
      "SELECT ((SELECT COALESCE(sum(amount_kobo),0) FROM distribution_ledger WHERE status NOT IN('REVERSED','REJECTED'))+(SELECT COALESCE(sum(amount_kobo),0) FROM distribution_adjustments)) acquisition_cost,(SELECT COALESCE(sum(amount_kobo),0) FROM distribution_verified_payments) revenue,(SELECT COALESCE(sum(amount_kobo),0) FROM distribution_ledger WHERE status IN('PENDING','UNDER_REVIEW')) pending,(SELECT COALESCE(sum(amount_kobo),0) FROM distribution_ledger WHERE status IN('AVAILABLE','RESERVED')) owed,(SELECT COALESCE(sum(amount_kobo),0) FROM distribution_payouts WHERE status IN('REQUESTED','APPROVED')) requests,(SELECT COALESCE(sum(amount_kobo),0) FROM distribution_payouts WHERE status='PAID') paid,(SELECT COALESCE(sum(amount_kobo),0) FROM distribution_ledger WHERE status='REVERSED') reversed,(SELECT COALESCE(sum(commission_kobo),0) FROM affiliate_earnings WHERE status='pending') legacy_held,(SELECT COALESCE(sum(amount_kobo),0) FROM distribution_adjustments WHERE payout_id IS NULL) outstanding_adjustments",
    )
  )[0];
  const schedule = (
    await query("SELECT * FROM distribution_finance_settings WHERE id=true")
  )[0];
  return (
    <div className="space-y-7 text-ink">
      <h1 className="text-3xl font-semibold">Distribution finance</h1>
      <p>
        New, explicitly accepted agreements only. Legacy balances, earned
        commissions and payout records remain in their existing ledgers. No
        transfers are executed automatically.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [
            "Commission acquisition cost (net adjustments)",
            totals.acquisition_cost,
          ],
          ["Verified attributed revenue", totals.revenue],
          ["Held commissions", totals.pending],
          ["Available / reserved obligations", totals.owed],
          ["Open payout requests", totals.requests],
          ["Confirmed payouts", totals.paid],
          ["Reversed commissions", totals.reversed],
          ["Legacy held bonus obligations", totals.legacy_held],
          ["Unsettled refund adjustments", totals.outstanding_adjustments],
        ].map(([label, value]) => (
          <article
            key={String(label)}
            className="rounded border border-border bg-paper p-4"
          >
            <p className="text-sm text-ink-muted">{String(label)}</p>
            <strong>
              ₦{(Number(value || 0) / 100).toLocaleString("en-NG")}
            </strong>
          </article>
        ))}
      </div>
      <ActionForm
        action={async () => {
          "use server";
          await reconcileDistributionAction();
        }}
      >
        <button className="rounded-lg border border-border p-3">
          Reconcile verified product payments & refunds
        </button>
      </ActionForm>
      <details className="rounded-xl border border-border p-5">
        <summary>Request an earned payout on a participant’s behalf</summary>
        <p className="my-3 text-sm">
          Use this to honor valid earned obligations, including after Affiliate
          privileges are suspended. Verified bank details, the accepted payout
          schedule, financial review and separate transfer confirmation remain
          required.
        </p>
        <ActionForm
          action={requestDistributionPayoutForAffiliateAction}
          className="grid gap-3"
        >
          <label>
            Participant ID
            <input className={input} name="affiliate" required />
          </label>
          <label>
            Reviewed reason
            <textarea
              className={input}
              name="reason"
              minLength={20}
              maxLength={2000}
              required
            />
          </label>
          <label>
            <input type="checkbox" name="reviewed" required />I reviewed the
            earned obligation and saved beneficiary
          </label>
          <button className={input}>Request payout for review</button>
        </ActionForm>
      </details>
      {a.role === "owner" && (
        <details className="rounded-xl border border-border p-5">
          <summary>Record actual product cost evidence</summary>
          <ActionForm
            action={recordProductCostAction}
            className="mt-4 grid gap-3"
          >
            <label>
              Verified JKTL payment reference
              <input
                className={input}
                name="reference"
                required
                maxLength={200}
              />
            </label>
            <label>
              Product
              <select className={input} name="product">
                {[
                  "business_email",
                  "domain_registration",
                  "custom_project",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Actual supplier / fulfillment cost (kobo)
              <input
                className={input}
                name="cost"
                type="number"
                min={0}
                max={2000000000}
                required
              />
            </label>
            <label>
              Supplier receipt or cost reference
              <input
                className={input}
                name="supplier"
                required
                minLength={3}
                maxLength={200}
              />
            </label>
            <label>
              Verification evidence
              <textarea
                className={input}
                name="evidence"
                required
                minLength={20}
                maxLength={3000}
              />
            </label>
            <label>
              <input name="actual" type="checkbox" required />I verified this
              actual cost against the supplier or fulfillment evidence. It is
              not a guessed price-list cost.
            </label>
            <button className={input}>Save verified cost evidence</button>
          </ActionForm>
        </details>
      )}
      {a.role === "owner" && (
        <details className="rounded-xl border border-border p-5">
          <summary>Offer a new-cohort commercial agreement</summary>
          <p className="my-3 text-sm">
            Only participants with no existing referrals or earnings qualify.
            The recipient must accept the exact immutable terms before a
            separate Owner activation. Proposed policy versions do not become
            the public default.
          </p>
          <ActionForm
            action={offerDistributionContractAction}
            className="grid gap-3 md:grid-cols-2"
          >
            <label>
              Participant
              <select required name="affiliate" className={input}>
                {people.map((p) => (
                  <option key={String(p.id)} value={String(p.id)}>
                    {String(p.name)} · {String(p.programme)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Proposed policy
              <select required name="policy" className={input}>
                {policies.map((p) => (
                  <option key={String(p.id)} value={String(p.id)}>
                    {String(p.name)} · {String(p.program)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Model
              <select name="model" className={input}>
                <option>REFERRAL</option>
                <option>RESELLER</option>
              </select>
            </label>
            {[
              ["rateBps", "Commission basis points", 1500],
              ["duration", "Eligible paid service months (maximum 12)", 12],
              ["holdDays", "Refund/fraud review days", 30],
              ["taxBps", "Included sales tax basis points", 0],
              ["thirdPartyCostKobo", "Pass-through cost per payment (kobo)", 0],
              ["marginReserveKobo", "Minimum retained margin (kobo)", 0],
              ["capKobo", "Maximum commission per payment (kobo)", 100000000],
            ].map(([key, label, value]) => (
              <label key={String(key)}>
                {String(label)}
                <input
                  name={String(key)}
                  type="number"
                  required
                  min={0}
                  defaultValue={Number(value)}
                  className={input}
                />
              </label>
            ))}
            <fieldset className="space-y-4 md:col-span-2">
              <legend>Additional eligible products</legend>
              <p className="text-sm">
                All choices start disabled. Rewards require actual successful
                payments and verified supplier cost evidence. Each rate and cap
                becomes part of the agreement accepted by the participant.
              </p>
              {[
                ["business_email", "Business Email"],
                ["domain_registration", "Domains"],
                ["custom_project", "Custom projects"],
              ].map(([product, label]) => (
                <details
                  key={product}
                  className="rounded border border-border p-4"
                >
                  <summary>{label}</summary>
                  <label className="my-3 block">
                    <input type="checkbox" name={"rule-" + product} />
                    Include {label} in this offer
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      Reward type
                      <select
                        name={"rule-" + product + "-kind"}
                        className={input}
                      >
                        <option value="PERCENTAGE">
                          Percentage of eligible net revenue
                        </option>
                        <option value="FIXED">
                          Fixed amount per eligible payment
                        </option>
                      </select>
                    </label>
                    {[
                      [
                        "rate",
                        "Percentage (%)",
                        product === "custom_project" ? 5 : 15,
                      ],
                      ["fixed", "Fixed reward (₦)", 0],
                      ["months", "Eligible paid months (maximum 12)", 12],
                      ["tax", "Included tax (%)", 0],
                      ["reserve", "Minimum retained margin (₦)", 0],
                      ["cap", "Maximum reward per payment (₦)", 1000000],
                    ].map(([key, title, value]) => (
                      <label key={String(key)}>
                        {String(title)}
                        <input
                          name={"rule-" + product + "-" + key}
                          type="number"
                          min={0}
                          step={key === "months" ? 1 : 0.01}
                          defaultValue={Number(value)}
                          className={input}
                        />
                      </label>
                    ))}
                    {product !== "domain_registration" && (
                      <label>
                        <input
                          type="checkbox"
                          name={"rule-" + product + "-recurring"}
                          defaultChecked={product === "business_email"}
                        />
                        Recurring rewards within the agreed paid-month limit
                      </label>
                    )}
                  </div>
                </details>
              ))}
            </fieldset>
            <fieldset className="space-y-2">
              <legend>Eligible website plans</legend>
              {WEBSITE_PLANS.filter((p) => p.id !== "free").map((p) => (
                <label key={p.id} className="block">
                  <input type="checkbox" name="plans" value={p.id} /> {p.name}
                </label>
              ))}
            </fieldset>
            <label>
              Reseller scope, negotiated prices and billing responsibilities
              <textarea
                name="wholesaleNote"
                maxLength={3000}
                className={input}
              />
            </label>
            <p className="text-sm">
              Reseller arrangements use written quotes and approved fulfillment.
              No referral commission is generated for reseller contracts. These
              terms do not create a customer charge.
            </p>
            <button className="rounded-lg bg-primary p-3 text-on-primary">
              Issue terms for acceptance
            </button>
          </ActionForm>
        </details>
      )}
      {a.role === "owner" && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">New-policy payout settings</h2>
          <p>
            These settings do not change legacy payout windows or earned
            balances.
          </p>
          <ActionForm
            action={setDistributionPayoutSettingsAction}
            className="flex flex-wrap gap-3"
          >
            <label>
              Minimum payout (kobo)
              <input
                type="number"
                required
                min={1}
                max={2000000000}
                name="minimum"
                defaultValue={Number(schedule?.minimum_payout_kobo || 1000000)}
                className={input}
              />
            </label>
            <label>
              Opening day of month (Lagos time)
              <input
                type="number"
                required
                min={1}
                max={28}
                name="day"
                defaultValue={Number(schedule?.payout_day || 21)}
                className={input}
              />
            </label>
            <label>
              Expected monthly payment day
              <input
                type="number"
                min={1}
                max={28}
                name="paymentDay"
                defaultValue={Number(schedule?.payment_day || 28)}
                className={input}
              />
            </label>
            <button className="rounded border border-border p-3">
              Save future payout settings
            </button>
          </ActionForm>
        </section>
      )}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Payment risk reconciliation</h2>
        <p>
          Open disputes freeze affected rewards and new payout requests.
          Confirmed refunds remain in history; they cannot be cleared through
          this control.
        </p>
        {risks.map((r) => (
          <article
            key={String(r.reference)}
            className="rounded border border-border p-4"
          >
            <p className="break-all">
              {String(r.reference)} · {String(r.state)}
            </p>
            {a.role === "owner" && (
              <ActionForm
                action={resolveDistributionRiskAction}
                className="mt-3 grid gap-3"
              >
                <input
                  type="hidden"
                  name="reference"
                  value={String(r.reference)}
                />
                <select name="state" className={input}>
                  <option value="CLEARED">
                    Provider confirmed no loss / dispute won
                  </option>
                  <option value="LOST">Provider confirmed loss</option>
                </select>
                <label>
                  Actual provider resolution evidence
                  <input
                    name="evidence"
                    required
                    minLength={10}
                    maxLength={2000}
                    className={input}
                  />
                </label>
                <label>
                  <input name="confirmed" type="checkbox" required />I verified
                  the provider outcome. Clearing a dispute returns unpaid
                  rewards to review, not automatic payment.
                </label>
                <button className="rounded border border-border p-3">
                  Reconcile outcome
                </button>
              </ActionForm>
            )}
          </article>
        ))}
        {flags.map((r, i) => (
          <p key={i} className="break-all rounded border border-border p-3">
            {String(r.reference)} · {String(r.reason)}
          </p>
        ))}
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Individual agreements</h2>
        {contracts.map((c) => (
          <article
            key={String(c.id)}
            className="rounded-xl border border-border p-5"
          >
            <strong>
              {String(c.name)} · {String(c.model)} · {String(c.status)}
            </strong>
            <pre className="my-3 whitespace-pre-wrap break-words text-xs">
              {JSON.stringify(c.terms, null, 2)}
            </pre>
            {a.role === "owner" && c.status === "ACCEPTED" && (
              <ActionForm
                action={activateDistributionContractAction}
                className="space-y-3"
              >
                <input type="hidden" name="id" value={String(c.id)} />
                <label className="flex gap-3">
                  <input type="checkbox" name="approved" required />I approve
                  the accepted agreement, product economics and coordinated
                  terms. This new participant has no legacy referrals or
                  earnings.
                </label>
                <button className="rounded border border-border p-3">
                  Activate accepted agreement
                </button>
              </ActionForm>
            )}
          </article>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Verified commission ledger</h2>
        {ledger.map((l) => (
          <article
            key={String(l.reference)}
            className="rounded-xl border border-border p-4"
          >
            <strong>
              {String(l.name)} · {String(l.status)}
            </strong>
            <p>
              Net ₦{(Number(l.net_kobo) / 100).toLocaleString("en-NG")} ·
              Commission ₦
              {(Number(l.amount_kobo) / 100).toLocaleString("en-NG")} ·{" "}
              {String(l.eligible_months)} paid service months
            </p>
            <p className="break-all text-xs">{String(l.reference)}</p>
            {["PENDING", "UNDER_REVIEW"].includes(String(l.status)) && (
              <ActionForm
                action={reviewDistributionCommissionAction}
                className="mt-3 space-y-2"
              >
                <input
                  type="hidden"
                  name="reference"
                  value={String(l.reference)}
                />
                <label>
                  Reconciliation reason
                  <input
                    name="reason"
                    required
                    minLength={10}
                    maxLength={2000}
                    className={input}
                  />
                </label>
                <label>
                  <input type="checkbox" name="reject" /> Reject this commission
                </label>
                <button className="block rounded border border-border p-2">
                  Record review (approval requires completed hold)
                </button>
              </ActionForm>
            )}
          </article>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Controlled bank payout queue</h2>
        {payouts.map((p) => (
          <article
            key={String(p.id)}
            className="rounded-xl border border-border p-4"
          >
            <strong>
              {String(p.name)} · ₦
              {(Number(p.amount_kobo) / 100).toLocaleString("en-NG")} ·{" "}
              {String(p.status)}
            </strong>
            <p>
              {String(p.bank_name)} · ending {String(p.last4)} ·{" "}
              {String(p.account_name)}
            </p>
            {["REQUESTED", "APPROVED"].includes(String(p.status)) && (
              <PayoutBeneficiary id={String(p.id)} />
            )}
            {["REQUESTED", "APPROVED"].includes(String(p.status)) && (
              <ActionForm
                action={manageDistributionPayoutAction}
                className="mt-3 grid gap-3"
              >
                <input type="hidden" name="id" value={String(p.id)} />
                <select name="status" className={input}>
                  {(p.status === "REQUESTED"
                    ? ["APPROVED", "DECLINED"]
                    : ["PAID", "DECLINED"]
                  ).map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
                <label>
                  Actual bank transfer reference
                  <input
                    name="bankReference"
                    maxLength={200}
                    className={input}
                  />
                </label>
                <label>
                  <input type="checkbox" name="confirmed" />I have confirmed the
                  actual bank transfer. A payment request or approval is not
                  proof of transfer.
                </label>
                <button className="rounded border border-border p-2">
                  Record payout decision
                </button>
              </ActionForm>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
