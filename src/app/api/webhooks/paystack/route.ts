import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/paystack";
import {
  applyPaymentSuccess,
  saveSubscriptionCode,
  setSubscriptionStatus,
  findOrgIdByCustomerCode,
  findOrgIdBySubscriptionCode,
  findOrgIdByOwnerEmail,
  recordWebhookEventOnce,
} from "@/lib/db/billing";
import { addBillingCycle, getCycleDef, type BillingCycle } from "@/lib/billing";

interface PaystackEvent {
  event: string;
  data: Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>;
}

/**
 * Receives Paystack's subscription lifecycle events. This is the
 * authoritative source of truth for ongoing billing state — the checkout
 * callback page (`confirmCheckoutAction`) only gives the person immediate
 * feedback right after paying; every renewal, failure, and cancellation
 * that happens later (when their browser isn't open) comes through here.
 *
 * None of this gates anything on the public website right now — publishing
 * on a *.jktl.com.ng subdomain is free, since it costs nothing extra per
 * business. This just keeps `infrastructure_accounts` accurate for
 * whenever a real paid add-on (a custom domain, storage past a free quota)
 * needs to check subscription status.
 *
 * Configure this URL (`https://<your-domain>/api/webhooks/paystack`) in
 * the Paystack dashboard under Settings → API Keys & Webhooks, subscribed
 * to at least: charge.success, subscription.create, subscription.disable,
 * subscription.not_renew, invoice.payment_failed.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: PaystackEvent;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { event, data } = payload;
  const dedupeKey = `${event}:${data?.id ?? data?.subscription_code ?? data?.reference ?? JSON.stringify(data).slice(0, 100)}`;

  const isNew = await recordWebhookEventOnce(dedupeKey, event).catch((err) => {
    console.error("paystack webhook: failed to record dedupe key", err);
    return true; // fail open — better to risk a rare double-apply than silently drop every event
  });
  if (!isNew) return NextResponse.json({ ok: true, deduped: true });

  try {
    switch (event) {
      case "charge.success":
        await handleChargeSuccess(data);
        break;
      case "subscription.create":
        await handleSubscriptionCreate(data);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(data);
        break;
      case "subscription.disable":
      case "subscription.not_renew":
        await handleSubscriptionCanceled(data);
        break;
      default:
        // Other events (invoice.create, subscription.expiring_cards, ...)
        // aren't acted on yet — ignoring them is fine, they're informational.
        break;
    }
  } catch (err) {
    console.error(`paystack webhook: handling "${event}" failed`, err);
    // Still ack with 200 — we've already recorded receipt above, and
    // Paystack retrying a handler bug won't fix itself, just resend traffic.
  }

  return NextResponse.json({ ok: true });
}

/** Fires for every successful charge — the very first one (initiated by us
 * via `initializeTransaction`, carrying our metadata) and every later
 * Paystack-initiated renewal charge (no metadata, matched by customer
 * code instead). Only charges tied to a plan are subscription charges. */
async function handleChargeSuccess(data: Record<string, unknown>) {
  if (!data.plan) return; // a one-off charge unrelated to a subscription plan

  const metadata = asRecord(data.metadata);
  const customer = asRecord(data.customer);
  const orgId = (metadata.organizationId as string) || (await findOrgIdByCustomerCode(customer.customer_code as string));
  if (!orgId) {
    console.error("paystack webhook: charge.success with no matching organization", data.reference);
    return;
  }

  const cycleId = ((metadata.billingCycle as BillingCycle) || "yearly") as BillingCycle;
  const cycle = getCycleDef(cycleId);
  const paidAt = data.paid_at ? new Date(data.paid_at as string) : new Date();
  const renewalDate = addBillingCycle(paidAt, cycleId);

  await applyPaymentSuccess(orgId, {
    cycle: cycleId,
    priceKobo: cycle?.priceKobo ?? Number(data.amount),
    customerCode: (customer.customer_code as string) ?? "",
    renewalDate,
  });
}

/** Fires once, right after the first successful charge on a plan creates
 * the actual recurring subscription — this is where the subscription code
 * (needed for the "manage subscription" link and for matching future
 * cancel/fail events) first becomes available. */
async function handleSubscriptionCreate(data: Record<string, unknown>) {
  const customer = asRecord(data.customer);
  const orgId =
    (await findOrgIdByCustomerCode(customer.customer_code as string)) || (await findOrgIdByOwnerEmail(customer.email as string));
  if (!orgId) {
    console.error("paystack webhook: subscription.create with no matching organization", data.subscription_code);
    return;
  }

  await saveSubscriptionCode(orgId, {
    subscriptionCode: (data.subscription_code as string) ?? "",
    emailToken: (data.email_token as string) ?? "",
    renewalDate: data.next_payment_date ? new Date(data.next_payment_date as string) : undefined,
  });
}

/** A recurring charge failed. Just records `past_due` — Paystack retries
 * the charge on its own schedule, and nothing on the public-facing site
 * depends on this status right now (see the module doc comment above). */
async function handleInvoicePaymentFailed(data: Record<string, unknown>) {
  const subscription = asRecord(data.subscription);
  const customer = asRecord(data.customer);
  const orgId =
    (await findOrgIdBySubscriptionCode(subscription.subscription_code as string)) ||
    (await findOrgIdByCustomerCode(customer.customer_code as string));
  if (!orgId) return;
  await setSubscriptionStatus(orgId, "past_due");
}

/** Subscription definitively ended (owner canceled, or Paystack disabled it
 * after repeated failures). Doesn't touch the public site — publishing on
 * a *.jktl.com.ng subdomain is free regardless of subscription status; this
 * just records that the plan lapsed, for whenever it starts gating a real
 * paid add-on (a custom domain, storage past a free quota). */
async function handleSubscriptionCanceled(data: Record<string, unknown>) {
  const customer = asRecord(data.customer);
  const orgId =
    (await findOrgIdBySubscriptionCode(data.subscription_code as string)) || (await findOrgIdByCustomerCode(customer.customer_code as string));
  if (!orgId) return;
  await setSubscriptionStatus(orgId, "canceled");
}
