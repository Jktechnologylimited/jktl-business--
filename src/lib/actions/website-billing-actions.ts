"use server";
import { createHash, randomUUID } from "node:crypto";
import { requireSession } from "@/lib/session";
import { getSql, isSchemaOutOfDateError } from "@/lib/db/client";
import { getInfrastructure, getUser } from "@/lib/db/organizations";
import {
  createPlan,
  findWebsiteProviderPlan,
  initializeWebsitePlanCheckout,
  verifyTransaction,
  getSubscriptionManageLink,
  stopWebsiteProviderSubscription,
} from "@/lib/paystack";
import {
  currentWebsitePlan,
  reserveWebsiteCheckout,
  fulfilWebsitePayment,
  requestWebsiteRefund,
  type Query,
} from "@/lib/website-plan-store";
import {
  websitePlanQuote,
  type PlanId,
  type WebsiteBillingInterval,
} from "@/lib/website-pricing";
import type { ActionResult } from "./types";
async function owner() {
  const session = await requireSession();
  const sql = getSql();
  const rows =
    await sql`SELECT user_id FROM organization_members WHERE organization_id=${session.organizationId} AND user_id=${session.userId} AND active=true AND role='owner' LIMIT 1`;
  if (!rows[0])
    throw new Error("Only the business owner can manage website billing");
  return {
    ...session,
    sql,
    query: ((text, params) => sql.query(text, params)) as Query,
  };
}
function failure(error: unknown): { ok: false; error: string } {
  console.error(
    "website billing:",
    error instanceof Error ? error.message : "request failed",
  );
  return {
    ok: false,
    error: isSchemaOutOfDateError(error)
      ? "Website billing is being prepared. Please try again shortly."
      : error instanceof Error
        ? error.message
        : "Could not complete billing request. Please try again.",
  };
}
async function providerPlan(
  query: Query,
  organizationId: string,
  planId: string,
  interval: string,
  amount: number,
) {
  const lease = randomUUID();
  await query(
    `INSERT INTO website_plan_provider_plans(plan_id,interval,amount_kobo,lease_token,organization_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
    [planId, interval, amount, lease, organizationId],
  );
  let row = (
    await query(
      `SELECT * FROM website_plan_provider_plans WHERE plan_id=$1 AND interval=$2 AND organization_id=$3`,
      [planId, interval, organizationId],
    )
  )[0];
  if (row.plan_code) {
    if (Number(row.amount_kobo) !== amount)
      throw new Error("Pricing version mismatch. Contact support.");
    return String(row.plan_code);
  }
  // Acquire a crashed worker's lease; provider lookup always precedes creation.
  if (row.lease_token !== lease) {
    const claimed = await query(
      `UPDATE website_plan_provider_plans SET lease_token=$3,created_at=now() WHERE plan_id=$1 AND interval=$2 AND plan_code IS NULL AND created_at<now()-interval '5 minutes' AND organization_id=$4 RETURNING *`,
      [planId, interval, lease, organizationId],
    );
    if (!claimed[0])
      throw new Error(
        "This payment option is being prepared. Retry in a moment.",
      );
    row = claimed[0];
  }
  const tenantKey = createHash("sha256")
    .update(organizationId)
    .digest("hex")
    .slice(0, 16);
  const name = `JKTL Website v1 ${planId} ${interval} NGN ${amount} ${tenantKey}`;
  const providerInterval = interval === "yearly" ? "annually" : "monthly";
  const existing = await findWebsiteProviderPlan(name);
  if (
    existing &&
    (existing.amount !== amount ||
      existing.currency !== "NGN" ||
      existing.interval !== providerInterval)
  )
    throw new Error("Provider plan configuration mismatch");
  const code =
    existing?.plan_code ||
    (await createPlan({ name, amountKobo: amount, interval: providerInterval }))
      .planCode;
  await query(
    `UPDATE website_plan_provider_plans SET plan_code=$3 WHERE plan_id=$1 AND interval=$2 AND lease_token=$4 AND organization_id=$5`,
    [planId, interval, code, lease, organizationId],
  );
  return code;
}
export async function getWebsiteBillingAction() {
  try {
    const { query, organizationId } = await owner();
    const subscription = await currentWebsitePlan(query, organizationId);
    const payments = await query(
      `SELECT reference,plan_id,interval,amount_kobo,currency,paid_at,period_end FROM website_plan_payments WHERE organization_id=$1 ORDER BY paid_at DESC LIMIT 50`,
      [organizationId],
    );
    const pending = await query(
      `SELECT reference,status,authorization_url FROM website_plan_checkouts WHERE organization_id=$1 AND status IN ('initializing','ready') LIMIT 1`,
      [organizationId],
    );
    const refunds = await query(
      `SELECT payment_reference,status,requested_at FROM website_plan_refund_requests WHERE organization_id=$1`,
      [organizationId],
    );
    const {
      email_token: _token,
      customer_code: _customer,
      ...safe
    } = subscription || {};
    void _token;
    void _customer;
    return {
      ok: true as const,
      data: {
        subscription: subscription ? safe : null,
        payments,
        refund: refunds[0] || null,
        pending: pending[0] || null,
        infrastructure: await getInfrastructure(organizationId),
      },
    };
  } catch (e) {
    return failure(e);
  }
}
export async function startWebsitePlanCheckoutAction(
  planId: PlanId,
  interval: WebsiteBillingInterval,
  acceptRecurringTerms: boolean,
): Promise<ActionResult<{ authorizationUrl: string }>> {
  try {
    if (acceptRecurringTerms !== true)
      throw new Error(
        "Please review and accept the recurring billing terms before continuing.",
      );
    const quote = websitePlanQuote(planId, interval);
    if (!quote.amountKobo)
      throw new Error("The Free plan does not require checkout");
    const { query, organizationId, userId } = await owner();
    const infra = await getInfrastructure(organizationId);
    if (
      infra &&
      (infra.subscriptionStatus === "active" ||
        infra.subscriptionStatus === "past_due")
    )
      throw new Error(
        "You already have a paid legacy website plan. Contact support to migrate it without duplicate billing.",
      );
    const current = await currentWebsitePlan(query, organizationId);
    if (infra?.entitled && !current)
      throw new Error(
        "Your existing subscription already includes website benefits. Contact support before adding another paid plan.",
      );
    const user = await getUser(userId);
    if (!user?.email) throw new Error("Add an email address before paying");
    // Provider-plan errors happen before reserving a customer checkout.
    const planCode = await providerPlan(
      query,
      organizationId,
      planId,
      interval,
      quote.amountKobo,
    );
    const reserved = await reserveWebsiteCheckout(query, {
      org: organizationId,
      planId,
      interval,
      reference: `jktl_web_${randomUUID().replaceAll("-", "")}`,
    });
    const row = reserved.row;
    if (row.plan_id !== planId || row.interval !== interval)
      throw new Error(
        "Another checkout is already open. Complete that payment before selecting another plan.",
      );
    if (row.authorization_url)
      return {
        ok: true,
        data: { authorizationUrl: String(row.authorization_url) },
      };
    if (!reserved.created)
      throw new Error(
        "Your payment is still being prepared. Please contact support if this message persists. No second checkout has been created.",
      );
    await query(
      `UPDATE website_plan_checkouts SET provider_plan_code=$2 WHERE reference=$1`,
      [row.reference, planCode],
    );
    const origin = (
      process.env.NEXT_PUBLIC_APP_URL ||
      `https://business.${process.env.NEXT_PUBLIC_ROOT_DOMAIN || "jktl.com.ng"}`
    ).replace(/\/$/, "");
    // A lost provider response is kept pending, never blindly recharged.
    const result = await initializeWebsitePlanCheckout({
      email: user.email,
      amountKobo: quote.amountKobo,
      planCode,
      reference: String(row.reference),
      callbackUrl: `${origin}/business/plans?billing=website`,
      metadata: { type: "website_plan", organizationId, planId, interval },
    });
    if (
      result.reference !== row.reference ||
      !/^https:\/\/checkout\.paystack\.com\//.test(result.authorizationUrl)
    )
      throw new Error("Unexpected payment provider response. Contact support.");
    await query(
      `UPDATE website_plan_checkouts SET authorization_url=$2,status='ready' WHERE reference=$1`,
      [row.reference, result.authorizationUrl],
    );
    return { ok: true, data: { authorizationUrl: result.authorizationUrl } };
  } catch (e) {
    return failure(e);
  }
}
export async function confirmWebsitePlanPaymentAction(reference: string) {
  try {
    const { query, organizationId } = await owner();
    if (!/^jktl_web_[a-f0-9]{32}$/.test(reference))
      throw new Error("Unknown website payment reference");
    const data = await verifyTransaction(reference);
    if (data.status !== "success")
      throw new Error(
        "Payment is not confirmed yet. No plan has been activated.",
      );
    await fulfilWebsitePayment(
      query,
      data as unknown as Record<string, unknown>,
      organizationId,
    );
    try {
      const { flushMailAfterResponse } = await import("@/lib/mail/schedule");
      flushMailAfterResponse();
    } catch {
      /* Durable queue remains available to scheduled maintenance. */
    }
    return { ok: true as const };
  } catch (e) {
    return failure(e);
  }
}
export async function manageWebsitePlanAction() {
  try {
    const { query, organizationId } = await owner();
    const row = await currentWebsitePlan(query, organizationId);
    if (!row?.subscription_code)
      throw new Error(
        "Your payment is confirmed; subscription controls are still being connected. Retry shortly.",
      );
    return {
      ok: true as const,
      data: {
        url: await getSubscriptionManageLink(String(row.subscription_code)),
      },
    };
  } catch (e) {
    return failure(e);
  }
}
export async function scheduleWebsitePlanChangeAction(
  planId: PlanId,
  interval: WebsiteBillingInterval,
) {
  try {
    websitePlanQuote(planId, interval);
    const { query, organizationId } = await owner();
    const row = await currentWebsitePlan(query, organizationId);
    if (!row) throw new Error("No website subscription to change");
    if (!row.subscription_code || !row.email_token)
      throw new Error(
        "Subscription controls are still being connected. Retry shortly.",
      );
    if (!row.cancel_at_period_end)
      await stopWebsiteProviderSubscription(
        String(row.subscription_code),
        String(row.email_token),
      );
    await query(
      `UPDATE website_plan_subscriptions SET cancel_at_period_end=true,next_plan_id=$2,next_interval=$3 WHERE organization_id=$1`,
      [organizationId, planId, interval],
    );
    return { ok: true as const };
  } catch (e) {
    return failure(e);
  }
}
export async function requestWebsitePlanRefundAction(reason: string) {
  try {
    const { query, organizationId } = await owner();
    const row = await requestWebsiteRefund(query, organizationId, reason);
    return { ok: true as const, data: { status: String(row.status) } };
  } catch (e) {
    return failure(e);
  }
}
