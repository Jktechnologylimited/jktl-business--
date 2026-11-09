"use client";
import { percent, type InvestorReport } from "@/lib/investor/model";
const money = (n: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(
    n / 100,
  );
export function ActivationIntelligence({ report }: { report: InvestorReport }) {
  const f = report.extendedFunnel?.available
      ? report.extendedFunnel.data
      : null,
    s = report.subscriptionLifecycle?.available
      ? report.subscriptionLifecycle.data
      : null,
    c = report.campaigns?.available ? report.campaigns.data : null,
    r = report.retention?.available ? report.retention.data : null,
    channels = report.channelFinancials?.available
      ? report.channelFinancials.data
      : null;
  const names: Record<string, string> = {
    gallery_visit: "Gallery visit",
    template_preview: "Template preview",
    template_selected: "Template selection",
    registration_started: "Registration started",
    registration_completed: "Registration completed",
    website_creation_started: "Website creation started",
    website_content_added: "Website content saved",
    website_published: "First publication",
    paid_plan_viewed: "Paid plans viewed",
    checkout_started: "Subscription checkout started",
    subscription_paid: "First verified subscription payment",
  };
  return (
    <section className="space-y-6 rounded-2xl border border-border bg-paper p-5">
      <h2 className="text-xl font-semibold">
        Activation, subscription lifecycle &amp; acquisition
      </h2>
      {f ? (
        <>
          <p className="text-sm leading-6">
            {f.activeBusinesses} businesses performed recorded qualifying
            website/plan actions in the selected period. Coverage is limited to
            instrumented actions; this is not platform-wide MAU. Tracking
            installation:{" "}
            {new Date(f.trackingSince).toLocaleDateString("en-NG", {
              timeZone: "Africa/Lagos",
            })}
            .
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="mb-3 text-left text-xs leading-6 text-ink-muted">
                Independent first-observed stages in the selected period.
                Browser intents require consent; authenticated database
                milestones are verified state changes. Counts across stages are
                not one conversion cohort.
              </caption>
              <thead>
                <tr>
                  <th className="p-2" scope="col">
                    Stage
                  </th>
                  <th className="p-2" scope="col">
                    Observed accounts/browser identifiers
                  </th>
                </tr>
              </thead>
              <tbody>
                {f.stages.map((row) => (
                  <tr key={row.stage}>
                    <th
                      className="border-t border-border p-2 font-medium"
                      scope="row"
                    >
                      {names[row.stage] || row.stage}
                    </th>
                    <td className="border-t border-border p-2">{row.people}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="my-3 text-left text-xs leading-6 text-ink-muted">
                Consenting gallery cohort: {f.cohortBrowsers} retained browser
                identifiers first seen in the selected period. Reached requires
                all preceding stage signals by report time. A missing signal or
                skipped step is a coverage gap, not proof the customer abandoned
                JKTL. Browser identifiers expire after 30 days.
              </caption>
              <thead>
                <tr>
                  {[
                    "Stage",
                    "Reached",
                    "From preceding stage",
                    "No next stage recorded",
                  ].map((t) => (
                    <th scope="col" key={t} className="p-2">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {f.cohort.map((row, i) => (
                  <tr key={row.stage}>
                    <th
                      className="border-t border-border p-2 font-medium"
                      scope="row"
                    >
                      {names[row.stage]}
                    </th>
                    <td className="p-2">{row.reached}</td>
                    <td className="p-2">
                      {i === 0
                        ? "—"
                        : percent(row.reached, f.cohort[i - 1].reached) === null
                          ? "Unavailable"
                          : percent(row.reached, f.cohort[i - 1].reached) + "%"}
                    </td>
                    <td className="p-2">
                      {i < f.cohort.length - 1
                        ? Math.max(0, row.reached - f.cohort[i + 1].reached)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="text-sm text-ink-muted">
          Expanded stage tracking begins after migration 076. Earlier events are
          not fabricated.
        </p>
      )}
      {s && (
        <div>
          <h3 className="font-semibold">Website subscription lifecycle</h3>
          <p className="mt-2 text-sm leading-7">
            Period paid records: {s.new} first payments, {s.renewed} renewals,{" "}
            {s.upgraded} higher-rate plan changes and {s.downgraded} lower-rate
            plan changes. Future-observed failures: {s.failedRenewals};
            cancellations: {s.observedCancellations}. Current cancelled records:{" "}
            {s.currentCancelled}; currently expired records: {s.currentExpired}.
            Current status totals are not historical cancellation events.
          </p>
          <ul className="mt-3 text-sm">
            {s.plans.map((p) => (
              <li key={p.plan_id}>
                {p.plan_id}: {money(p.receipts)} retained verified receipts ·{" "}
                {p.payments} payments
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <h3 className="font-semibold">
          Observed retention of paid recurring services
        </h3>
        {r?.sufficient && r.startingMrr > 0 ? (
          <p className="mt-2 text-sm leading-7">
            Snapshot baseline {r.baselineDay} → {r.endDay}. Net revenue
            retention: {percent(r.retainedMrr, r.startingMrr)}%. Customer churn:{" "}
            {r.churnedCustomers}/{r.startingCustomers} (
            {percent(r.churnedCustomers, r.startingCustomers)}%). Contracted
            run-rate lost or contracted: {money(r.lostMrr)} (
            {percent(r.lostMrr, r.startingMrr)}% of baseline). Covers paid
            evidenced services and excludes new customers from NRR.
          </p>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">
            Unavailable until comparable boundary snapshots and a positive
            starting paid run-rate exist. No historical retention is inferred.
          </p>
        )}
      </div>
      {channels && (
        <div>
          <h3 className="font-semibold">
            Referral channel financial contribution
          </h3>
          <p className="my-2 text-xs text-ink-muted">
            Current covered MRR from snapshot{" "}
            {channels.recurringSnapshot || "unavailable"}; transaction fees use
            the selected period. Existing first-touch referrals and commercial
            agreements are unchanged.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  {[
                    "Source",
                    "Programme",
                    "Covered MRR",
                    "JKTL transaction fees",
                  ].map((t) => (
                    <th scope="col" key={t} className="p-2">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {channels.sources.map((x, i) => (
                  <tr key={i}>
                    <th scope="row" className="p-2 font-medium">
                      {x.name}
                    </th>
                    <td className="p-2">{x.programme}</td>
                    <td className="p-2">
                      {channels.recurringSnapshot
                        ? money(x.mrr)
                        : "Unavailable"}
                    </td>
                    <td className="p-2">{money(x.fees)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {c && (
        <div>
          <h3 className="font-semibold">Approved UTM campaigns</h3>
          <p className="my-2 text-xs text-ink-muted">
            Only explicitly approved labels from consenting retained browser
            journeys are attributed. Unknown source remains unknown; older
            journeys expire after 30 days.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  {[
                    "Campaign",
                    "Browsers",
                    "Registered",
                    "Published",
                    "Paying",
                    "Company receipts",
                    "JKTL fees",
                  ].map((t) => (
                    <th scope="col" key={t} className="p-2">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {c.campaigns.map((x) => (
                  <tr key={x.id}>
                    <th className="p-2 font-medium" scope="row">
                      {x.name}
                    </th>
                    <td className="p-2">{x.browsers}</td>
                    <td className="p-2">{x.registered}</td>
                    <td className="p-2">{x.published}</td>
                    <td className="p-2">{x.paying}</td>
                    <td className="p-2">{money(x.receipts)}</td>
                    <td className="p-2">{money(x.transactionFees)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
