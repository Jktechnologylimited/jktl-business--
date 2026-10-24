import { getSql } from "@/lib/db/client";
import { fulfilWebsitePayment, type Query } from "@/lib/website-plan-store";
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}
export async function handleWebsiteBillingEvent(
  event: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  const sql = getSql();
  const query: Query = (text, params) => sql.query(text, params);
  if (record(data.metadata).type !== "website_plan") {
    const exists = await query(
      `SELECT to_regclass('public.website_plan_subscriptions') AS table_name`,
      [],
    );
    if (!exists[0]?.table_name) return false;
  }
  const metadata = record(data.metadata),
    plan = record(data.plan),
    customer = record(data.customer),
    subscription = record(data.subscription);
  const code = String(
    data.subscription_code || subscription.subscription_code || "",
  );
  const planCode =
    typeof data.plan === "string"
      ? data.plan
      : String(plan.plan_code || record(subscription.plan).plan_code || "");
  if (event === "charge.success" && metadata.type === "website_plan") {
    await fulfilWebsitePayment(query, data);
    return true;
  }
  // Only a known versioned website plan is routed away from legacy products.
  const known = planCode
    ? (
        await query(
          `SELECT plan_code FROM website_plan_provider_plans WHERE plan_code=$1`,
          [planCode],
        )
      )[0]
    : null;
  const own = code
    ? (
        await query(
          `SELECT organization_id FROM website_plan_subscriptions WHERE subscription_code=$1`,
          [code],
        )
      )[0]
    : null;
  if (event === "charge.success" && known) {
    await fulfilWebsitePayment(query, data);
    return true;
  }
  if (event === "subscription.create" && known) {
    const rows = await query(
      `UPDATE website_plan_subscriptions SET subscription_code=$1,email_token=$2,period_end=COALESCE($5::timestamptz,period_end)
 WHERE customer_code=$3 AND provider_plan_code=$4 AND ($5::timestamptz IS NULL OR $5::timestamptz>last_paid_at) RETURNING organization_id`,
      [
        code,
        String(data.email_token || ""),
        String(customer.customer_code || ""),
        planCode,
        data.next_payment_date || null,
      ],
    );
    if (!rows.length)
      throw new Error(
        "Website payment has not arrived yet; retry subscription attachment",
      );
    return true;
  }
  if (own || known) {
    if (event === "invoice.payment_failed")
      await query(
        `UPDATE website_plan_subscriptions SET status='past_due' WHERE subscription_code=$1`,
        [code],
      );
    if (event === "subscription.disable" || event === "subscription.not_renew")
      await query(
        `UPDATE website_plan_subscriptions SET cancel_at_period_end=true,status='cancelled' WHERE subscription_code=$1`,
        [code],
      );
    return true;
  }
  if (event === "refund.processed") {
    const transaction = record(data.transaction);
    const reference = String(transaction.reference || "");
    if (reference) {
      const rows = await query(
        `WITH refunded AS (UPDATE website_plan_refund_requests r SET status='refunded',updated_at=now() FROM website_plan_payments p WHERE r.payment_reference=p.reference AND p.reference=$1 AND $2::bigint>=p.amount_kobo AND $3='NGN' RETURNING r.organization_id) UPDATE website_plan_subscriptions SET status='cancelled',period_end=LEAST(period_end,now()),cancel_at_period_end=true WHERE organization_id IN(SELECT organization_id FROM refunded) AND last_paid_at<=(SELECT paid_at FROM website_plan_payments WHERE reference=$1) RETURNING organization_id`,
        [reference, Number(data.amount || 0), String(data.currency || "")],
      );
      if (rows.length) return true;
    }
  }
  return false;
}
