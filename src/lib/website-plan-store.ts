import {
  websitePlanQuote,
  type PlanId,
  type WebsiteBillingInterval,
} from "./website-pricing";
import { addBillingCycle } from "./billing";
export type Query = (
  text: string,
  params: unknown[],
) => Promise<Record<string, unknown>[]>;
export async function currentWebsitePlan(query: Query, org: string) {
  const rows = await query(
    `SELECT * FROM website_plan_subscriptions WHERE organization_id=$1`,
    [org],
  );
  return rows[0] || null;
}
export async function reserveWebsiteCheckout(
  query: Query,
  input: {
    org: string;
    planId: PlanId;
    interval: WebsiteBillingInterval;
    reference: string;
  },
) {
  const quote = websitePlanQuote(input.planId, input.interval);
  if (!quote.amountKobo) throw new Error("Free never needs a payment");
  const rows = await query(
    `INSERT INTO website_plan_checkouts(reference,organization_id,plan_id,interval,amount_kobo) SELECT $1,$2,$3,$4,$5 WHERE NOT EXISTS(SELECT 1 FROM website_plan_subscriptions WHERE organization_id=$2 AND (period_end>now() OR (cancel_at_period_end=false AND status IN ('active','past_due')))) ON CONFLICT DO NOTHING RETURNING *`,
    [
      input.reference,
      input.org,
      input.planId,
      input.interval,
      quote.amountKobo,
    ],
  );
  if (rows[0]) return { created: true, row: rows[0] };
  const existing = await query(
    `SELECT * FROM website_plan_checkouts WHERE organization_id=$1 AND status IN ('initializing','ready')`,
    [input.org],
  );
  if (existing[0]) return { created: false, row: existing[0] };
  throw new Error(
    "Your paid plan is still running. Schedule a plan change or manage it below.",
  );
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}
/** Only a server-to-server verified transaction or signed webhook may call this. */
export async function fulfilWebsitePayment(
  query: Query,
  data: Record<string, unknown>,
  expectedOrg?: string,
) {
  const metadata = record(data.metadata);
  const ref = String(data.reference || "");
  if (data.status !== "success" || !ref)
    throw new Error("Payment has not succeeded");
  const checkout = (
    await query(`SELECT * FROM website_plan_checkouts WHERE reference=$1`, [
      ref,
    ])
  )[0];
  const subscription = record(data.subscription);
  const plan = record(data.plan);
  const planCode =
    typeof data.plan === "string"
      ? data.plan
      : String(plan.plan_code || subscription.plan_code || "");
  let org: string,
    planId: string,
    interval: string,
    expectedAmount: number,
    initial = false;
  if (checkout) {
    org = String(checkout.organization_id);
    planId = String(checkout.plan_id);
    interval = String(checkout.interval);
    expectedAmount = Number(checkout.amount_kobo);
    initial = true;
    if (
      metadata.type !== "website_plan" ||
      metadata.organizationId !== org ||
      metadata.planId !== planId ||
      metadata.interval !== interval
    )
      throw new Error("Payment metadata mismatch");
    if (planCode && checkout.provider_plan_code !== planCode)
      throw new Error("Payment plan mismatch");
  } else {
    const subCode = String(
      subscription.subscription_code || data.subscription_code || "",
    );
    const candidates = await query(
      `SELECT * FROM website_plan_subscriptions WHERE (subscription_code=$1 OR ($1='' AND customer_code=$3)) AND provider_plan_code=$2`,
      [subCode, planCode, String(record(data.customer).customer_code || "")],
    );
    const row = candidates.length === 1 ? candidates[0] : null;
    if (!row) throw new Error("Unknown website renewal");
    org = String(row.organization_id);
    planId = String(row.plan_id);
    interval = String(row.interval);
    expectedAmount = websitePlanQuote(planId, interval).amountKobo;
  }
  if (expectedOrg && org !== expectedOrg)
    throw new Error("That payment belongs to another business");
  if (data.currency !== "NGN" || Number(data.amount) !== expectedAmount)
    throw new Error("Payment amount or currency mismatch");
  const paidAt = new Date(String(data.paid_at || ""));
  if (!Number.isFinite(paidAt.getTime()) || !data.id)
    throw new Error("Missing payment date or transaction identity");
  const nextDate = subscription.next_payment_date
    ? new Date(String(subscription.next_payment_date))
    : addBillingCycle(paidAt, interval as "monthly" | "yearly");
  if (!Number.isFinite(nextDate.getTime()) || nextDate <= paidAt)
    throw new Error("Invalid renewal date");
  const customer = record(data.customer);
  // Payment insertion and entitlement update are one atomic statement. Redelivery is a no-op.
  const rows = await query(
    `WITH payment AS (
 INSERT INTO website_plan_payments(reference,organization_id,plan_id,interval,amount_kobo,currency,paid_at,period_end,provider_transaction_id)
 VALUES($1,$2,$3,$4,$5,'NGN',$6,$7,$8) ON CONFLICT DO NOTHING RETURNING *
 ), activated AS (
 INSERT INTO website_plan_subscriptions(organization_id,plan_id,interval,status,period_end,first_paid_at,last_paid_at,provider_plan_code,customer_code)
 SELECT organization_id,plan_id,interval,'active',period_end,paid_at,paid_at,$9,$10 FROM payment
 ON CONFLICT(organization_id) DO UPDATE SET status='active',period_end=GREATEST(website_plan_subscriptions.period_end,EXCLUDED.period_end),last_paid_at=GREATEST(website_plan_subscriptions.last_paid_at,EXCLUDED.last_paid_at),
 cancel_at_period_end=CASE WHEN $11::boolean THEN false ELSE website_plan_subscriptions.cancel_at_period_end END,
 subscription_code=CASE WHEN $11::boolean AND EXCLUDED.last_paid_at>website_plan_subscriptions.last_paid_at THEN NULL ELSE website_plan_subscriptions.subscription_code END,
 email_token=CASE WHEN $11::boolean AND EXCLUDED.last_paid_at>website_plan_subscriptions.last_paid_at THEN NULL ELSE website_plan_subscriptions.email_token END,
 plan_id=CASE WHEN EXCLUDED.last_paid_at>=website_plan_subscriptions.last_paid_at THEN EXCLUDED.plan_id ELSE website_plan_subscriptions.plan_id END,
 interval=CASE WHEN EXCLUDED.last_paid_at>=website_plan_subscriptions.last_paid_at THEN EXCLUDED.interval ELSE website_plan_subscriptions.interval END,
 provider_plan_code=CASE WHEN EXCLUDED.last_paid_at>=website_plan_subscriptions.last_paid_at THEN EXCLUDED.provider_plan_code ELSE website_plan_subscriptions.provider_plan_code END
 RETURNING organization_id
 ), completed AS (UPDATE website_plan_checkouts SET status='paid' WHERE reference=$1 AND EXISTS(SELECT 1 FROM activated) RETURNING reference) SELECT reference FROM payment`,
    [
      ref,
      org,
      planId,
      interval,
      expectedAmount,
      paidAt.toISOString(),
      nextDate.toISOString(),
      String(data.id),
      String(checkout?.provider_plan_code || planCode),
      String(customer.customer_code || ""),
      initial,
    ],
  );
  return { organizationId: org, initial, applied: rows.length > 0 };
}
export async function requestWebsiteRefund(
  query: Query,
  org: string,
  reason: string,
) {
  if (
    typeof reason !== "string" ||
    reason.trim().length < 3 ||
    reason.length > 2000
  )
    throw new Error("Please explain your refund request (3–2,000 characters)");
  const rows = await query(
    `INSERT INTO website_plan_refund_requests(organization_id,payment_reference,reason)
 SELECT organization_id,reference,$2 FROM website_plan_payments WHERE organization_id=$1 AND paid_at=(SELECT MIN(paid_at) FROM website_plan_payments WHERE organization_id=$1)
 AND now()<=paid_at+interval '14 days' ORDER BY reference LIMIT 1
 ON CONFLICT(organization_id) DO UPDATE SET reason=website_plan_refund_requests.reason RETURNING *`,
    [org, reason.trim()],
  );
  if (!rows[0])
    throw new Error(
      "The 14-day website-plan refund window has ended. Contact support for help.",
    );
  return rows[0];
}
