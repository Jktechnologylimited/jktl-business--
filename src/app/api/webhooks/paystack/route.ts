import { handleCustomEvent } from "@/lib/custom/service";
import { handleDomainEvent } from "@/lib/domains/service";
import { handleWebsiteBillingEvent } from "@/lib/website-billing-webhooks";
import { getInfrastructure } from "@/lib/db/organizations";
import { NextRequest, NextResponse } from "next/server";
import {
  verifyWebhookSignature,
  INVOICE_PLATFORM_FEE_KOBO,
} from "@/lib/paystack";
import {
  applyPaymentSuccess,
  saveSubscriptionCode,
  saveAuthorizationCode,
  setSubscriptionStatus,
  findOrgIdByCustomerCode,
  findOrgIdBySubscriptionCode,
  findOrgIdByOwnerEmail,
  recordWebhookEventOnce,
} from "@/lib/db/billing";
import { markInvoicePaidOnline } from "@/lib/db/invoices";
import {
  activateReceptionistContract,
  applyContractPayment,
  applyWalletTopUp,
  saveContractCard,
} from "@/lib/ai/billing-fulfilment";
import { finalizeInvoicePaid } from "@/lib/invoice-finalize";
import { accrueCommissionForOrg } from "@/lib/db/affiliates";
import { chargeStorageOverageForOrg } from "@/lib/db/storage-overage";
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
  if (Number(request.headers.get("content-length") || 0) > 256000)
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const rawBody = await request.text();
  if (rawBody.length > 256000)
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const signature = request.headers.get("x-paystack-signature");

  let validSignature = false;
  try {
    validSignature = verifyWebhookSignature(rawBody, signature);
  } catch {
    return NextResponse.json(
      { error: "Payment verification unavailable" },
      { status: 503 },
    );
  }
  if (!validSignature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: PaystackEvent;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!payload || typeof payload !== "object")
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const { event, data } = payload;
  if (
    !event ||
    typeof event !== "string" ||
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  )
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  // Domain handlers commit their own unique payment ledger before acknowledgement.
  // Do not acknowledge an in-flight/failed domain payment using the legacy receipt gate.
  try {
    if (await handleDomainEvent(event, data)) {
      const { after } = await import("next/server");
      after(async () => {
        try {
          const { flushDomainNotifications } =
            await import("@/lib/domains/notifications");
          await flushDomainNotifications(5);
        } catch {}
      });
      return NextResponse.json({ ok: true });
    }
  } catch {
    console.error("domain-payment-webhook: retry-required");
    return NextResponse.json(
      { error: "Domain payment processing will retry" },
      { status: 503 },
    );
  }
  try {
    if (await handleCustomEvent(event, data))
      return NextResponse.json({ ok: true });
  } catch {
    console.error("custom-invoice-webhook: retry-required");
    return NextResponse.json(
      { error: "Custom payment processing will retry" },
      { status: 503 },
    );
  }
  const dedupeKey = `${event}:${data?.id ?? data?.subscription_code ?? data?.reference ?? JSON.stringify(data).slice(0, 100)}`;

  const isNew = await recordWebhookEventOnce(dedupeKey, event).catch((err) => {
    console.error("paystack webhook: failed to record dedupe key", err);
    return null; // Fail closed: ask Paystack to retry; never process without receipt tracking.
  });
  if (isNew === null) return NextResponse.json({error:"Webhook temporarily unavailable"},{status:503});
  if (!isNew) return NextResponse.json({ ok: true, deduped: true });

  try {
    if(await handleWebsiteBillingEvent(event,data))return NextResponse.json({ok:true});
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
    // Failed fulfilment must be retryable. Each money-moving handler has its
    // own ledger idempotency; website activation and its ledger are atomic.
    const {getSql}=await import("@/lib/db/client");
    await getSql()`DELETE FROM paystack_webhook_events WHERE dedupe_key=${dedupeKey}`;
    return NextResponse.json({error:"Payment processing will retry"},{status:503});
  }

  return NextResponse.json({ ok: true });
}

/** Fires for every successful charge — the very first one (initiated by us
 * via `initializeTransaction`, carrying our metadata) and every later
 * Paystack-initiated renewal charge (no metadata, matched by customer
 * code instead). Only charges tied to a plan are subscription charges;
 * an invoice payment (checked first, below) is a one-off charge that
 * never has a plan either, so it has to be told apart by its metadata
 * before the "no plan" early-return would otherwise swallow it. */
async function handleChargeSuccess(data: Record<string, unknown>) {
  const metadata = asRecord(data.metadata);

  if (metadata.type === "invoice_payment") {
    await handleInvoicePaymentSuccess(data, metadata);
    return;
  }

  // A clinic topped up its AI receptionist communication wallet. Checked
  // before the "no plan" early-return below for the same reason as invoice
  // payments: a one-off charge for a subscription-less feature would
  // otherwise be silently swallowed.
  if (metadata.type === "wallet_topup") {
    await handleWalletTopUp(data, metadata);
    return;
  }

  // One month of the AI receptionist contract (₦108,333.33 for the first six,
  // ₦59,000 after). Checked before the "no plan" early-return below for the
  // same reason as invoice payments: a one-off charge for a subscription-less
  // feature would otherwise be silently swallowed.
  if (metadata.type === "receptionist_month") {
    await handleContractMonth(data, metadata);
    return;
  }

  // A contract started with an earlier build that charged the whole package
  // as a single setup fee. Treated as month 1 so a checkout in flight when
  // this shipped still lands correctly.
  if (metadata.type === "receptionist_setup") {
    await handleContractMonth(
      { ...data, metadata: { ...metadata, monthIndex: 1 } },
      metadata,
    );
    return;
  }

  if (!data.plan) return; // a one-off charge unrelated to a subscription plan

  const customer = asRecord(data.customer);
  const orgId =
    (metadata.organizationId as string) ||
    (await findOrgIdByCustomerCode(customer.customer_code as string));
  if (!orgId) {
    console.error(
      "paystack webhook: charge.success with no matching organization",
      data.reference,
    );
    return;
  }

  const infra = await getInfrastructure(orgId);
  const cycleId = (metadata.billingCycle ||
    infra?.billingCycle) as BillingCycle;
  const cycle = getCycleDef(cycleId);
  if (
    !cycle ||
    data.currency !== "NGN" ||
    Number(data.amount) !== cycle.priceKobo
  ) {
    throw new Error(
      "Website subscription renewal amount, interval or currency mismatch",
    );
  }
  const paidAt = data.paid_at ? new Date(data.paid_at as string) : new Date();
  const renewalDate = addBillingCycle(paidAt, cycleId);
  const priceKobo = cycle?.priceKobo ?? Number(data.amount);

  await applyPaymentSuccess(orgId, {
    cycle: cycleId,
    priceKobo,
    customerCode: (customer.customer_code as string) ?? "",
    renewalDate,
  });

  // Cache the reusable card token from this charge — see
  // `chargeAuthorization` in src/lib/paystack.ts. Only ever a *reusable*
  // one; a non-reusable authorization can't charge again later, so saving
  // it would just mean a future overage attempt fails against a dead
  // token instead of skipping cleanly with "no card on file".
  const authorization = asRecord(data.authorization);
  if (authorization.reusable === true && authorization.authorization_code) {
    await saveAuthorizationCode(
      orgId,
      authorization.authorization_code as string,
    ).catch((err) =>
      console.error("paystack webhook: saveAuthorizationCode failed", err),
    );
  }

  // Affiliate commission, if this business signed up through a referral
  // link — deliberately here (the authoritative webhook), never from the
  // optimistic checkout-callback path in billing-actions.ts, so a single
  // real payment is never double-counted. Best-effort: a commission
  // bookkeeping failure must never break subscription billing itself.
  await accrueCommissionForOrg(
    orgId,
    priceKobo,
    (data.reference as string) ?? "",
  ).catch((err) =>
    console.error("paystack webhook: accrueCommissionForOrg failed", err),
  );

  // Storage overage for the cycle that just ended — metered separately
  // from the flat price above (see src/lib/billing.ts). `renewalDate` (the
  // *new* one, just computed) is this attempt's idempotency key, so a
  // redelivered webhook for the same renewal can't double-charge. Also
  // best-effort, for the same reason as the commission call just above.
  await chargeStorageOverageForOrg(
    orgId,
    renewalDate.toISOString().slice(0, 10),
  ).catch((err) =>
    console.error("paystack webhook: chargeStorageOverageForOrg failed", err),
  );
}

/** A clinic funded its AI receptionist communication wallet. The ledger's
 * own `provider_ref` uniqueness is the real idempotency guard here (see
 * `creditWallet`), so this is safe even if the webhook dedupe above fails
 * open or the buyer's browser also confirms the payment on the callback
 * page — the money is credited exactly once.
 *
 * The amount comes from `data.amount` (what Paystack actually collected),
 * never from the metadata we sent, so a tampered initiate call cannot buy
 * more credit than it paid for. */
async function handleWalletTopUp(
  data: Record<string, unknown>,
  metadata: Record<string, unknown>,
) {
  const organizationId = metadata.organizationId as string;
  const reference = (data.reference as string) ?? "";
  if (!organizationId || !reference) {
    console.error(
      "paystack webhook: wallet_topup charge with missing metadata",
      reference,
    );
    return;
  }

  await applyWalletTopUp({
    organizationId,
    amountKobo: Number(data.amount ?? 0),
    reference,
  });
}

/**
 * One month of the AI receptionist contract was paid.
 *
 * The amount comes from `data.amount` (what Paystack actually collected),
 * never from the metadata we sent, and `applyContractPayment` refuses to
 * advance the schedule unless it covers the month being paid for — so a
 * tampered initiate call cannot buy a month for ₦1.
 *
 * `monthIndex` in the metadata is a hint, not the authority: if it disagrees
 * with the month the contract is expecting, the contract's own counter wins,
 * which is what makes the money path safe against a redelivered webhook.
 */
async function handleContractMonth(
  data: Record<string, unknown>,
  metadata: Record<string, unknown>,
) {
  const organizationId = metadata.organizationId as string;
  const reference = (data.reference as string) ?? "";
  if (!organizationId || !reference) {
    console.error(
      "paystack webhook: receptionist_month charge with missing metadata",
      reference,
    );
    return;
  }

  // Capture the reusable card first, so even a payment made by hand leaves the
  // subscription able to renew itself next month.
  const authorization = asRecord(data.authorization);
  await saveContractCard(organizationId, {
    authorizationCode: (authorization.authorization_code as string) ?? "",
    reusable: authorization.reusable === true,
    brand: (authorization.brand as string) ?? "",
    last4: (authorization.last4 as string) ?? "",
    expMonth: (authorization.exp_month as string) ?? "",
    expYear: (authorization.exp_year as string) ?? "",
  }).catch((err) =>
    console.error("paystack webhook: saveContractCard failed", err),
  );

  const monthIndex = Number(metadata.monthIndex ?? 0);
  const result = await applyContractPayment({
    organizationId,
    amountKobo: Number(data.amount ?? 0),
    reference,
    paidAt: data.paid_at ? new Date(data.paid_at as string) : new Date(),
    monthIndex: monthIndex > 0 ? monthIndex : undefined,
  });

  if (result.applied) {
    // The contract may have been created by this very charge (the checkout is
    // often the first thing a clinic does), so make sure it exists and is
    // activated — `activateReceptionistContract` is idempotent and also grants
    // the bundled launch credit exactly once.
    await activateReceptionistContract({
      organizationId,
      startedAt: data.paid_at ? new Date(data.paid_at as string) : undefined,
      reference,
    });
    return;
  }

  if (result.reason === "not_started") {
    // Nothing to attach the payment to yet: start the contract from this
    // charge, then apply it against month 1.
    await activateReceptionistContract({
      organizationId,
      startedAt: data.paid_at ? new Date(data.paid_at as string) : undefined,
      reference,
    });
    await applyContractPayment({
      organizationId,
      amountKobo: Number(data.amount ?? 0),
      reference,
      paidAt: data.paid_at ? new Date(data.paid_at as string) : new Date(),
      monthIndex: monthIndex > 0 ? monthIndex : 1,
    });
    return;
  }

  console.error(
    `paystack webhook: receptionist_month for ${organizationId} not applied (${result.reason}${
      result.reason === "underpaid"
        ? `, expected ${result.expectedKobo} kobo`
        : ""
    })`,
  );
}

/** A customer paid an invoice through the public `/pay/[id]` link. The
 * charge itself already split automatically at Paystack's end (see
 * initializeInvoicePayment) — all that's left here is recording it and
 * telling the business. `markInvoicePaidOnline` is itself idempotent
 * (`WHERE status <> 'paid'`), on top of the dedupe already done above by
 * reference, so a retried webhook delivery can never double-apply this. */
async function handleInvoicePaymentSuccess(
  data: Record<string, unknown>,
  metadata: Record<string, unknown>,
) {
  const organizationId = metadata.organizationId as string;
  const invoiceId = metadata.invoiceId as string;
  if (!organizationId || !invoiceId) {
    console.error(
      "paystack webhook: invoice_payment charge with missing metadata",
      data.reference,
    );
    return;
  }

  const invoice = await markInvoicePaidOnline(organizationId, invoiceId, {
    reference: (data.reference as string) ?? "",
    platformFeeKobo: INVOICE_PLATFORM_FEE_KOBO,
  });
  if (!invoice) return; // already paid, or the ids didn't match a real invoice

  // The reference goes on the customer's receipt, because that is what they
  // quote if they ever have to query the payment.
  await finalizeInvoicePaid(organizationId, invoice, {
    method: "card",
    reference: (data.reference as string) ?? "",
  });
}

/** Fires once, right after the first successful charge on a plan creates
 * the actual recurring subscription — this is where the subscription code
 * (needed for the "manage subscription" link and for matching future
 * cancel/fail events) first becomes available. */
async function handleSubscriptionCreate(data: Record<string, unknown>) {
  const customer = asRecord(data.customer);
  const orgId =
    (await findOrgIdByCustomerCode(customer.customer_code as string)) ||
    (await findOrgIdByOwnerEmail(customer.email as string));
  if (!orgId) {
    console.error(
      "paystack webhook: subscription.create with no matching organization",
      data.subscription_code,
    );
    return;
  }

  await saveSubscriptionCode(orgId, {
    subscriptionCode: (data.subscription_code as string) ?? "",
    emailToken: (data.email_token as string) ?? "",
    renewalDate: data.next_payment_date
      ? new Date(data.next_payment_date as string)
      : undefined,
  });
}

/** A recurring charge failed. Just records `past_due` — Paystack retries
 * the charge on its own schedule, and nothing on the public-facing site
 * depends on this status right now (see the module doc comment above). */
async function handleInvoicePaymentFailed(data: Record<string, unknown>) {
  const subscription = asRecord(data.subscription);
  const customer = asRecord(data.customer);
  const orgId =
    (await findOrgIdBySubscriptionCode(
      subscription.subscription_code as string,
    )) || (await findOrgIdByCustomerCode(customer.customer_code as string));
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
    (await findOrgIdBySubscriptionCode(data.subscription_code as string)) ||
    (await findOrgIdByCustomerCode(customer.customer_code as string));
  if (!orgId) return;
  await setSubscriptionStatus(orgId, "canceled");
}
