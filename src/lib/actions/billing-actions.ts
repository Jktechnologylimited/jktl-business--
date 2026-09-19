"use server";

import { requireSession } from "@/lib/session";
import { getBusinessProfile, getInfrastructure, getUser } from "@/lib/db/organizations";
import {
  ensurePlanCode,
  applyPaymentSuccess,
  getPaystackSubscriptionCode,
} from "@/lib/db/billing";
import { initializeTransaction, verifyTransaction, getSubscriptionManageLink } from "@/lib/paystack";
import { addBillingCycle, getCycleDef, type BillingCycle } from "@/lib/billing";
import type { ActionResult } from "./types";
import type { Infrastructure } from "@/lib/types";

function appOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "jktl.com.ng";
  return `https://business.${root}`;
}

/** Starts a hosted Paystack checkout for the given cycle and returns the
 * URL to redirect the browser to. The actual subscription is only created
 * once Paystack confirms the charge — nothing here touches the database. */
export async function startCheckoutAction(cycleId: BillingCycle): Promise<ActionResult<{ authorizationUrl: string }>> {
  try {
    const { organizationId, userId } = await requireSession();
    const cycle = getCycleDef(cycleId);
    if (!cycle) return { ok: false, error: "Unknown billing cycle." };

    const [user, profile] = await Promise.all([getUser(userId), getBusinessProfile(organizationId)]);
    if (!user?.email) return { ok: false, error: "Add an email to your account before subscribing." };
    if (!profile) return { ok: false, error: "Business profile not found." };

    const planCode = await ensurePlanCode(cycleId);
    const { authorizationUrl } = await initializeTransaction({
      email: user.email,
      amountKobo: cycle.priceKobo,
      planCode,
      callbackUrl: `${appOrigin()}/business/settings?billing=callback`,
      metadata: { organizationId, billingCycle: cycleId },
    });

    return { ok: true, data: { authorizationUrl } };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't start checkout — please try again." };
  }
}

/** Called by the Settings page when Paystack redirects back with a
 * `reference` — verifies the charge and, if it succeeded, activates the
 * subscription immediately so the UI doesn't have to wait for the
 * `subscription.create` webhook. The webhook (see the Paystack webhook
 * route) still runs and reconciles the subscription code + authoritative
 * renewal date shortly after, whether or not this ran. */
export async function confirmCheckoutAction(reference: string): Promise<ActionResult<Infrastructure>> {
  try {
    const { organizationId } = await requireSession();
    const data = await verifyTransaction(reference);

    if (data.status !== "success") {
      const infra = await getInfrastructure(organizationId);
      return infra ? { ok: true, data: infra } : { ok: false, error: "Payment wasn't successful." };
    }

    // Only trust this reference if it's for the organization making the
    // request — metadata is set by us at initialize-time, so this also
    // guards against someone pasting another org's reference into the URL.
    if (data.metadata?.organizationId !== organizationId) {
      return { ok: false, error: "That checkout reference doesn't belong to this business." };
    }

    const cycleId = (data.metadata?.billingCycle as BillingCycle) || "yearly";
    const cycle = getCycleDef(cycleId);
    const paidAt = data.paid_at ? new Date(data.paid_at) : new Date();
    const renewalDate = addBillingCycle(paidAt, cycleId);

    await applyPaymentSuccess(organizationId, {
      cycle: cycleId,
      priceKobo: cycle?.priceKobo ?? data.amount,
      customerCode: data.customer?.customer_code ?? "",
      renewalDate,
    });

    const infra = await getInfrastructure(organizationId);
    if (!infra) return { ok: false, error: "Payment succeeded but your account record is missing — contact support." };
    return { ok: true, data: infra };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't confirm your payment — please contact support if you were charged." };
  }
}

export async function getManageSubscriptionLinkAction(): Promise<ActionResult<{ link: string }>> {
  try {
    const { organizationId } = await requireSession();
    const subscriptionCode = await getPaystackSubscriptionCode(organizationId);
    if (!subscriptionCode) return { ok: false, error: "No active subscription to manage yet." };
    const link = await getSubscriptionManageLink(subscriptionCode);
    return { ok: true, data: { link } };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't open the subscription manager." };
  }
}
