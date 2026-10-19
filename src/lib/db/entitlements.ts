import "server-only";
import { getSql } from "./client";
import { isSubscriptionActive } from "./billing";

/**
 * What a business is entitled to, now that there is one product.
 *
 * The app used to sell three things separately: a Website & Hosting plan
 * (₦5,000–₦50,000 depending on cycle), extra team seats, and a custom domain —
 * the last two gated behind the first. That is three conversations with a clinic
 * that has just agreed to pay ₦650,000, and it produced the worst kind of sales
 * moment: "the thing you bought does not include your second receptionist."
 *
 * Everything is now billed with the AI receptionist. One subscription covers the
 * assistant, the line, the website and hosting, team members, and a custom domain.
 * This module is the single place that decides whether a business has that, so
 * the gates on seats, domains and storage cannot drift from the billing screen.
 *
 * **Legacy subscribers keep their access.** A business on the old ₦5,000 plan is
 * still entitled, so cancelling the plan in the *UI* does not take anything away
 * from somebody already paying for it. That is not generosity — silently
 * revoking paid features from existing customers is the kind of thing that ends
 * up in a chargeback.
 */

export type EntitlementSource = "receptionist" | "legacy_plan" | "none";

export interface Entitlement {
  /** Whether the business has full access to seats, domains and storage. */
  entitled: boolean;
  /** Why, so the UI can say the right thing rather than a generic message. */
  source: EntitlementSource;
  /** The receptionist contract's status, for the "your subscription is past due"
   * case — a clinic whose card failed keeps access while it is recoverable, but
   * must be told. */
  contractStatus: "pending" | "active" | "past_due" | "cancelled" | "none";
}

/**
 * The one check everything else uses.
 *
 * `past_due` counts as entitled on purpose. A failed card is usually a card that
 * expired, not a customer who left; locking a clinic out of its own phone line and
 * website the day a payment fails would turn a recoverable billing issue into a
 * lost customer and a support incident. The outstanding amount is chased by the
 * daily cron, and the console says so.
 */
export async function getEntitlement(organizationId: string): Promise<Entitlement> {
  const sql = getSql();
  const rows = await sql`
    SELECT status FROM ai_receptionist_contracts WHERE organization_id = ${organizationId}
  `;
  const contractStatus = (rows[0]?.status as Entitlement["contractStatus"]) ?? "none";

  if (contractStatus === "active" || contractStatus === "past_due") {
    return { entitled: true, source: "receptionist", contractStatus };
  }

  // Existing customers on the retired plan keep everything they are paying for.
  if (await isSubscriptionActive(organizationId)) {
    return { entitled: true, source: "legacy_plan", contractStatus };
  }

  return { entitled: false, source: "none", contractStatus };
}

/** Convenience for a gate that only needs a yes/no. */
export async function hasFullAccess(organizationId: string): Promise<boolean> {
  return (await getEntitlement(organizationId)).entitled;
}

/**
 * What to tell somebody who has hit a gate.
 *
 * Says what is included and where to pay, rather than naming a plan that is no
 * longer sold. The previous message — "Upgrade to Website & Hosting under
 * Settings → Plan" — pointed at a product that has been removed from that screen,
 * which is worse than saying nothing.
 */
export const ENTITLEMENT_REQUIRED_MESSAGE =
  "Team members, a custom domain and extra storage are included with your AI receptionist subscription. Start it under AI receptionist to unlock them.";

/** The message for a business that is paying but whose payment failed — a
 * different problem from not having subscribed, and the fix is different too. */
export const ENTITLEMENT_PAST_DUE_MESSAGE =
  "Your last receptionist payment didn't go through. Update your card under AI receptionist to keep full access.";
