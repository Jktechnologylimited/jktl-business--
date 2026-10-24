"use client";
import { T } from "@/components/i18n/LanguageProvider";
import { useCallback, useEffect, useState } from "react";
import {
  getWebsiteTemplate,
  templateEditorPath,
} from "@/lib/website-templates";
import { pendingTemplate } from "@/lib/template-selection";
import Link from "next/link";
import { useBusinessStore } from "@/lib/store";
import { WebsitePricing } from "@/components/pricing/WebsitePricing";
import {
  WEBSITE_PLANS,
  websitePlanQuote,
  priceNGN,
  type PlanId,
  type WebsiteBillingInterval,
} from "@/lib/website-pricing";
import {
  getWebsiteBillingAction,
  startWebsitePlanCheckoutAction,
  confirmWebsitePlanPaymentAction,
  manageWebsitePlanAction,
  scheduleWebsitePlanChangeAction,
  requestWebsitePlanRefundAction,
} from "@/lib/actions/website-billing-actions";
type Data = Extract<
  Awaited<ReturnType<typeof getWebsiteBillingAction>>,
  { ok: true }
>["data"];
export function WebsitePlanBilling() {
  const mode = useBusinessStore((s) => s.mode);
  const selectedTemplateId = useBusinessStore(
    (s) => s.data.profile.websiteTemplateId,
  );
  const existing =
    getWebsiteTemplate(pendingTemplate()) ||
    getWebsiteTemplate(selectedTemplateId);
  const continuePath = existing
    ? templateEditorPath(existing.id)
    : "/business/website";
  const hydrated = useBusinessStore((s) => s.hydrated);
  const setInfrastructure = useBusinessStore((s) => s.setInfrastructure);
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<{
    planId: PlanId;
    interval: WebsiteBillingInterval;
  }>({ planId: "growth", interval: "yearly" });
  const [consent, setConsent] = useState(false),
    [reason, setReason] = useState("");
  const load = useCallback(async () => {
    const result = await getWebsiteBillingAction();
    if (result.ok) {
      setData(result.data);
      if (result.data.infrastructure)
        setInfrastructure(result.data.infrastructure);
    } else setError(result.error);
  }, [setInfrastructure]);
  useEffect(() => {
    if (!hydrated || mode !== "live") return;
    let cancelled = false;
    void (async () => {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("reference") || params.get("trxref");
      if (params.get("billing") === "website" && ref) {
        const result = await confirmWebsitePlanPaymentAction(ref);
        if (cancelled) return;
        if (!result.ok) setError(result.error);
        else {
          setMessage("Payment confirmed. Your website plan is active.");
          window.history.replaceState({}, "", window.location.pathname);
        }
      }
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, mode, load]);
  const quote = websitePlanQuote(selected.planId, selected.interval),
    plan = WEBSITE_PLANS.find((p) => p.id === selected.planId)!;
  const sub = data?.subscription;
  const running = sub && new Date(String(sub.period_end)) > new Date();
  async function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await action();
      if (!result.ok) setError(result.error || "Please retry.");
      else {
        setMessage(success);
        await load();
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <WebsitePricing
        insideBusiness
        startHref={continuePath}
        startLabel={
          existing ? "Continue editing your website" : "Back to your website"
        }
        selectedPlanId={selected.planId}
        onSelectPlan={(planId, interval) => {
          setSelected({ planId, interval });
          setConsent(false);
        }}
      />
      <section
        id="website-checkout"
        className="mx-auto mb-10 max-w-4xl rounded-2xl border border-border bg-paper p-6"
      >
        {existing && (
          <div className="mb-5 rounded-xl border border-border p-4">
            <p className="text-sm">
              <T>Your selected design stays with you: </T>
              <strong>{existing.name}</strong>
              <T>. Upgrading changes your plan, not your website.</T>
            </p>
            <Link
              href={continuePath}
              className="mt-2 inline-block text-sm text-primary underline"
            >
              <T>Continue editing your website →</T>
            </Link>
          </div>
        )}
        <h2 className="font-display text-2xl font-semibold">
          <T>Your website subscription</T>
        </h2>
        {mode !== "live" ? (
          <p className="mt-3 text-sm">
            <T>
              Demo mode — explore plans here. Payments, renewals and refund
              requests require a real owner account.
            </T>
          </p>
        ) : (
          <>
            {error && (
              <p
                role="alert"
                className="my-3 rounded-lg bg-danger-soft p-3 text-sm text-danger"
              >
                {error}
              </p>
            )}
            {message && (
              <p role="status" className="my-3 text-sm text-primary">
                {message}
              </p>
            )}
            {!data && !error && (
              <p className="mt-3">
                <T>Loading your billing details…</T>
              </p>
            )}
            {data?.pending && (
              <div className="my-4 rounded-xl border border-border p-4">
                <p className="text-sm">
                  <T>
                    An existing checkout is waiting for confirmation. No second
                    payment will be started.
                  </T>
                </p>
                <p className="mt-2 break-all text-xs">
                  <T>Reference: </T>
                  {String(data.pending.reference)}
                </p>
                <div className="mt-3 flex gap-4">
                  {Boolean(data.pending.authorization_url) && (
                    <a
                      className="text-sm underline"
                      href={String(data.pending.authorization_url)}
                    >
                      <T>Resume secure checkout</T>
                    </a>
                  )}
                  <button
                    disabled={busy}
                    className="text-sm underline"
                    onClick={() =>
                      run(
                        () =>
                          confirmWebsitePlanPaymentAction(
                            String(data.pending!.reference),
                          ),
                        "Payment verified. Your plan is active.",
                      )
                    }
                  >
                    <T>Check payment status</T>
                  </button>
                </div>
              </div>
            )}
            {sub && (
              <div className="my-5 rounded-xl border border-border p-4">
                <p className="font-semibold">
                  {WEBSITE_PLANS.find((p) => p.id === sub.plan_id)?.name ||
                    String(sub.plan_id)}{" "}
                  · {String(sub.interval)}
                </p>
                <p className="text-sm">
                  {sub.cancel_at_period_end
                    ? "Paid access ends"
                    : "Next renewal"}
                  :{" "}
                  {new Date(String(sub.period_end)).toLocaleDateString(
                    "en-NG",
                    { dateStyle: "long" },
                  )}
                </p>
                {sub.status === "past_due" && (
                  <p className="text-sm text-danger">
                    <T>
                      Your payment failed. Update your card using Manage payment
                      method. No second subscription will be created.
                    </T>
                  </p>
                )}
                {Boolean(sub.cancel_at_period_end) && (
                  <p className="text-sm">
                    <T>Automatic renewal is off.</T>{" "}
                    {sub.next_plan_id
                      ? `Next choice: ${sub.next_plan_id}. Return after the paid period ends to confirm any new paid plan.`
                      : "Your site continues on Free after the paid period."}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-4">
                  <button
                    className="text-sm underline"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const result = await manageWebsitePlanAction();
                        if (result.ok) window.location.assign(result.data.url);
                        return result;
                      }, "Opening Paystack…")
                    }
                  >
                    <T>Manage payment method</T>
                  </button>
                  {!sub.cancel_at_period_end && (
                    <button
                      className="text-sm underline"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Stop automatic renewal? Paid access remains until the date shown.",
                          )
                        )
                          void run(
                            () =>
                              scheduleWebsitePlanChangeAction("free", "yearly"),
                            "Automatic renewal stopped. Your paid access continues until the end of the current period.",
                          );
                      }}
                    >
                      <T>Cancel renewal</T>
                    </button>
                  )}
                </div>
              </div>
            )}
            {selected.planId !== "free" && (
              <div className="my-5">
                <h3 className="text-lg font-semibold">
                  {running ? "Your next plan" : "Review your payment"}:{" "}
                  {plan.name}
                </h3>
                <p className="my-2 text-sm">
                  <strong>{priceNGN(quote.amountKobo)}</strong>{" "}
                  {selected.interval === "yearly"
                    ? "for one year"
                    : "for one month"}{" "}
                  <T>· NGN</T>
                </p>
                <p className="text-sm">
                  {selected.interval === "yearly"
                    ? `${priceNGN(quote.monthlyEquivalentKobo)}/month equivalent, billed as one annual payment. Save ${priceNGN(quote.savingsKobo)} compared with 12 monthly payments.`
                    : "Monthly billing at the amount above."}
                </p>
                <p className="mt-3 text-sm">
                  <T>
                    Current paid capabilities: custom domain connection,
                    branding removal, website SEO and analytics, finite included
                    image storage and
                  </T>{" "}
                  {selected.planId === "starter"
                    ? 2
                    : selected.planId === "growth"
                      ? 5
                      : selected.planId === "business"
                        ? 10
                        : 25}{" "}
                  <T>
                    collaborators including the owner. Existing business tools
                    remain available. Features marked ¹ in the comparison are
                    not yet available and are not activated by payment.
                  </T>
                </p>
                <p className="mt-3 text-sm">
                  <T>
                    14-day money-back guarantee on your first website-plan
                    payment. Domain registration, email, usage charges and
                    separate custom projects are excluded.
                  </T>{" "}
                  <a
                    href="https://jktl.com.ng/terms#website-guarantee"
                    className="underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <T>Read refund terms</T>
                  </a>
                  .
                </p>
                {running ? (
                  <>
                    <p className="mt-3 text-sm">
                      <T>
                        Your current paid period remains unchanged. Scheduling
                        stops its automatic renewal. After
                      </T>{" "}
                      {new Date(String(sub.period_end)).toLocaleDateString(
                        "en-NG",
                      )}
                      <T>
                        , return here to confirm and pay for the new plan. No
                        charge or prorated credit is made now.
                      </T>
                    </p>
                    <button
                      className="mt-4 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Stop the current plan’s automatic renewal and save this choice for the end of the paid period?",
                          )
                        )
                          void run(
                            () =>
                              scheduleWebsitePlanChangeAction(
                                selected.planId,
                                selected.interval,
                              ),
                            "Plan choice saved. Current paid access is unchanged.",
                          );
                      }}
                    >
                      <T>Schedule plan change</T>
                    </button>
                  </>
                ) : (
                  <>
                    <label className="mt-4 flex items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                        className="mt-1"
                      />
                      <span>
                        <T>I authorise </T>
                        {priceNGN(quote.amountKobo)}
                        <T>now and automatic </T>
                        {selected.interval}
                        <T>
                          renewal at the same price until cancelled. I have
                          reviewed the current capabilities, included image
                          storage limit (Starter 1 GB, Growth 5 GB, Business 15
                          GB, Elite 30 GB; uploads stop at the limit), and
                        </T>{" "}
                        <a
                          href="https://jktl.com.ng/terms"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          <T>terms</T>
                        </a>
                        .
                      </span>
                    </label>
                    <button
                      disabled={busy || !consent || !data}
                      className="mt-4 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                      onClick={() =>
                        run(async () => {
                          const result = await startWebsitePlanCheckoutAction(
                            selected.planId,
                            selected.interval,
                            consent,
                          );
                          if (result.ok)
                            window.location.assign(
                              result.data.authorizationUrl,
                            );
                          return result;
                        }, "Opening secure payment…")
                      }
                    >
                      {busy
                        ? "Please wait…"
                        : `Continue to secure payment · ${priceNGN(quote.amountKobo)}`}
                    </button>
                  </>
                )}
              </div>
            )}
            {selected.planId === "free" && (
              <p className="mt-4 text-sm">
                <T>
                  Free needs no payment. If you have a paid plan, cancel its
                  renewal above; your site and core tools remain available.
                </T>
              </p>
            )}
            {Boolean(data?.payments.length) && (
              <div className="mt-6 overflow-auto">
                <h3 className="mb-3 font-semibold">
                  <T>Website payment history</T>
                </h3>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="p-2">
                        <T>Paid</T>
                      </th>
                      <th>
                        <T>Plan</T>
                      </th>
                      <th>
                        <T>Amount</T>
                      </th>
                      <th>
                        <T>Reference</T>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.payments.map((p) => (
                      <tr
                        key={String(p.reference)}
                        className="border-t border-border"
                      >
                        <td className="p-2">
                          {new Date(String(p.paid_at)).toLocaleDateString(
                            "en-NG",
                          )}
                        </td>
                        <td>
                          {String(p.plan_id)} · {String(p.interval)}
                        </td>
                        <td>{priceNGN(Number(p.amount_kobo))}</td>
                        <td className="break-all p-2 text-xs">
                          {String(p.reference)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-6 border-t border-border pt-5">
              <h3 className="font-semibold">
                <T>14-day money-back guarantee</T>
              </h3>
              {data?.refund ? (
                <p className="mt-2 text-sm">
                  <T>Refund request: </T>
                  <strong>{String(data.refund.status)}</strong>
                  <T>
                    . Your request is saved for the JKTL billing team. Contact
                    info@jktl.com.ng with your payment reference for updates.
                  </T>
                </p>
              ) : (
                <>
                  <p className="mt-2 text-sm">
                    <T>
                      Request a full refund of your first website-plan payment
                      within 14 days of payment. The billing team processes
                      eligible refunds to your original payment method. Provider
                      processing times apply.
                    </T>
                  </p>
                  <label className="mt-3 block text-sm">
                    <T>Reason for refund</T>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={2000}
                      rows={3}
                      className="mt-2 w-full rounded-lg border border-border bg-paper p-3"
                    />
                  </label>
                  <button
                    disabled={
                      busy || reason.trim().length < 3 || !data?.payments.length
                    }
                    className="mt-3 text-sm underline disabled:opacity-50"
                    onClick={() =>
                      run(
                        () => requestWebsitePlanRefundAction(reason),
                        "Refund request recorded. The billing team will review and process it.",
                      )
                    }
                  >
                    <T>Request guarantee refund</T>
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
