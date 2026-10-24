import "server-only";
import { getSql } from "./client";
import { isSubscriptionActive } from "./billing";

/** Additive access: grandfathered AI and legacy website contracts keep their
 * existing access. New website subscriptions grant finite seats/storage until
 * the paid period ends; cancellation never removes an already-paid period. */

export type EntitlementSource =
  "receptionist" | "legacy_plan" | "website_plan" | "none";

export interface Entitlement {
  /** Whether the business has full access to seats, domains and storage. */
  entitled: boolean;
  teamSeats?: number;
  storageBytes?: number;
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
export async function getEntitlement(
  organizationId: string,
): Promise<Entitlement> {
  const sql = getSql();
  const rows = await sql`
    SELECT status FROM ai_receptionist_contracts WHERE organization_id = ${organizationId}
  `;
  const contractStatus =
    (rows[0]?.status as Entitlement["contractStatus"]) ?? "none";

  if (contractStatus === "active" || contractStatus === "past_due") {
    return { entitled: true, source: "receptionist", contractStatus };
  }

  // Existing customers on the retired plan keep everything they are paying for.
  if (await isSubscriptionActive(organizationId)) {
    return { entitled: true, source: "legacy_plan", contractStatus };
  }

  try {
    const plans =
      await sql`SELECT plan_id FROM website_plan_subscriptions WHERE organization_id=${organizationId} AND period_end>now() `;
    if (plans[0]) {
      const seats: Record<string, number> = {
        starter: 2,
        growth: 5,
        business: 10,
        elite: 25,
      };
      return {
        entitled: true,
        source: "website_plan",
        contractStatus,
        teamSeats: seats[String(plans[0].plan_id)] || 1,
        storageBytes:
          (
            { starter: 1, growth: 5, business: 15, elite: 30 } as Record<
              string,
              number
            >
          )[String(plans[0].plan_id)] *
          1024 ** 3,
      };
    }
  } catch (error) {
    if (!["42P01", "42703"].includes(String((error as { code?: string }).code)))
      throw error;
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
  "Choose a website plan under Settings → Billing to add team members, a custom domain and extra storage. Existing AI receptionist subscriptions retain their included access.";

/** The message for a business that is paying but whose payment failed — a
 * different problem from not having subscribed, and the fix is different too. */
export const ENTITLEMENT_PAST_DUE_MESSAGE =
  "Your last receptionist payment didn't go through. Update your card under AI receptionist to keep full access.";
