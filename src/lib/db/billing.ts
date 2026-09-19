import "server-only";
import { getSql } from "./client";
import { createPlan, findPlanByName } from "@/lib/paystack";
import { getCycleDef, planNameFor, type BillingCycle } from "@/lib/billing";

/**
 * Returns the Paystack Plan code for a cycle, creating (and caching) the
 * Plan on Paystack the first time it's needed. This is what lets the app
 * provision its own billing plans on first use instead of requiring the
 * business owner to set them up by hand in the Paystack dashboard.
 */
export async function ensurePlanCode(cycleId: BillingCycle): Promise<string> {
  const sql = getSql();
  const cached = await sql`SELECT paystack_plan_code FROM billing_plans WHERE cycle = ${cycleId}`;
  if (cached[0]) return cached[0].paystack_plan_code as string;

  const cycle = getCycleDef(cycleId);
  if (!cycle) throw new Error(`Unknown billing cycle: ${cycleId}`);
  const name = planNameFor(cycleId);

  // In case the local cache table was ever wiped but the Plan still exists
  // on Paystack's side (e.g. a redeploy against a fresh database) — avoids
  // creating a duplicate Plan with the same name.
  const existing = await findPlanByName(name);
  const planCode = existing?.planCode ?? (await createPlan({ name, amountKobo: cycle.priceKobo, interval: cycle.paystackInterval })).planCode;

  await sql`
    INSERT INTO billing_plans (cycle, paystack_plan_code, price_kobo)
    VALUES (${cycleId}, ${planCode}, ${cycle.priceKobo})
    ON CONFLICT (cycle) DO UPDATE SET paystack_plan_code = EXCLUDED.paystack_plan_code, price_kobo = EXCLUDED.price_kobo
  `;
  return planCode;
}

/** True only when the "Website & Hosting" add-on is currently paid for.
 * Checked by whatever actually has a per-business cost — currently a 2nd+
 * team seat (`addMemberAction`); NOT website publishing, which is free
 * regardless (see `src/lib/billing.ts`'s module doc comment). */
export async function isSubscriptionActive(orgId: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    SELECT subscription_status, renewal_date FROM infrastructure_accounts WHERE organization_id = ${orgId}
  `;
  const row = rows[0];
  if (!row) return false;
  if (row.subscription_status !== "active") return false;
  return new Date(row.renewal_date as string) >= new Date(new Date().toDateString());
}

export async function getPaystackSubscriptionCode(orgId: string): Promise<string> {
  const sql = getSql();
  const rows = await sql`SELECT paystack_subscription_code FROM infrastructure_accounts WHERE organization_id = ${orgId}`;
  return (rows[0]?.paystack_subscription_code as string) ?? "";
}

/** Applied right after a successful checkout (via the callback-page verify
 * call) and again on every recurring `charge.success` webhook — both write
 * the same fields, so a slightly-stale optimistic update from the verify
 * call is safely overwritten once the authoritative webhook arrives. */
export async function applyPaymentSuccess(
  orgId: string,
  params: { cycle: BillingCycle; priceKobo: number; customerCode: string; renewalDate: Date },
): Promise<void> {
  const sql = getSql();
  const cycle = getCycleDef(params.cycle);
  const annualized = cycle ? Math.round((params.priceKobo / cycle.months) * 12) : params.priceKobo;
  await sql`
    UPDATE infrastructure_accounts
    SET subscription_status = 'active',
        billing_cycle = ${params.cycle},
        price_kobo_per_cycle = ${params.priceKobo},
        price_kobo_per_year = ${annualized},
        plan_name = ${planNameFor(params.cycle)},
        paystack_customer_code = ${params.customerCode},
        renewal_date = ${params.renewalDate.toISOString().slice(0, 10)}
    WHERE organization_id = ${orgId}
  `;
}

export async function saveSubscriptionCode(
  orgId: string,
  params: { subscriptionCode: string; emailToken: string; renewalDate?: Date },
): Promise<void> {
  const sql = getSql();
  if (params.renewalDate) {
    await sql`
      UPDATE infrastructure_accounts
      SET paystack_subscription_code = ${params.subscriptionCode},
          paystack_email_token = ${params.emailToken},
          renewal_date = ${params.renewalDate.toISOString().slice(0, 10)}
      WHERE organization_id = ${orgId}
    `;
  } else {
    await sql`
      UPDATE infrastructure_accounts
      SET paystack_subscription_code = ${params.subscriptionCode}, paystack_email_token = ${params.emailToken}
      WHERE organization_id = ${orgId}
    `;
  }
}

export async function setSubscriptionStatus(orgId: string, status: "active" | "past_due" | "canceled" | "inactive"): Promise<void> {
  const sql = getSql();
  await sql`UPDATE infrastructure_accounts SET subscription_status = ${status} WHERE organization_id = ${orgId}`;
}

/** Turns the public site off. Not currently called anywhere — publishing
 * on a *.jktl.com.ng subdomain is free and doesn't depend on subscription
 * status. Kept for whenever a real paid add-on (a custom domain, storage
 * past a free quota) needs an "enforce non-payment" action like this one. */
export async function unpublishSite(orgId: string): Promise<void> {
  const sql = getSql();
  await sql`UPDATE business_profiles SET published = false WHERE organization_id = ${orgId}`;
}

export async function findOrgIdByCustomerCode(customerCode: string | undefined | null): Promise<string | null> {
  if (!customerCode) return null;
  const sql = getSql();
  const rows = await sql`SELECT organization_id FROM infrastructure_accounts WHERE paystack_customer_code = ${customerCode}`;
  return (rows[0]?.organization_id as string) ?? null;
}

export async function findOrgIdBySubscriptionCode(subscriptionCode: string | undefined | null): Promise<string | null> {
  if (!subscriptionCode) return null;
  const sql = getSql();
  const rows = await sql`SELECT organization_id FROM infrastructure_accounts WHERE paystack_subscription_code = ${subscriptionCode}`;
  return (rows[0]?.organization_id as string) ?? null;
}

/** Fallback lookup for the rare race where a `subscription.create` webhook
 * arrives before the `charge.success` that would have saved the customer
 * code — matches on the owner's email instead. */
export async function findOrgIdByOwnerEmail(email: string | undefined | null): Promise<string | null> {
  if (!email) return null;
  const sql = getSql();
  const rows = await sql`SELECT organization_id FROM organization_members WHERE role = 'owner' AND email = ${email.toLowerCase()}`;
  return (rows[0]?.organization_id as string) ?? null;
}

/** Records that a webhook (event, subject) pair has been handled. Returns
 * true the first time it's seen (caller should process it) and false on a
 * redelivery (caller should skip it) — Paystack retries webhooks on
 * timeout, so this keeps a retry from double-applying a charge. */
export async function recordWebhookEventOnce(dedupeKey: string, event: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO paystack_webhook_events (dedupe_key, event) VALUES (${dedupeKey}, ${event})
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING dedupe_key
  `;
  return rows.length > 0;
}

/** Not currently called anywhere (see `unpublishSite` above — publishing is
 * free regardless of subscription status). Kept for the same future
 * reason: a sweep that catches a missed/delayed webhook once there's a
 * real paid add-on this should enforce against. */
export async function sweepLapsedWebsites(): Promise<number> {
  const sql = getSql();
  const rows = await sql`
    UPDATE business_profiles bp
    SET published = false
    FROM infrastructure_accounts ia
    WHERE bp.organization_id = ia.organization_id
      AND bp.published = true
      AND ia.subscription_status <> 'active'
      AND ia.renewal_date < CURRENT_DATE
    RETURNING bp.organization_id
  `;
  return rows.length;
}
