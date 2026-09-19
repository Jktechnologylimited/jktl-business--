import "server-only";
import { getSql } from "./client";
import { getStorageUsage } from "./storage";
import { chargeAuthorization } from "@/lib/paystack";
import { computeStorageOverageKobo } from "@/lib/billing";

/**
 * Charges (or attempts to charge) one billing cycle's storage overage —
 * see migration 013 and `src/lib/billing.ts`'s "Storage overage" section
 * for the rate and the reasoning behind metering it separately from the
 * flat plan. Called once per subscription renewal, from the same
 * `charge.success` webhook handler that renews the flat plan itself (see
 * the Paystack webhook route) — piggybacking on that event both gives this
 * a natural cadence and guarantees there's already a reusable card token
 * on file to charge, since the flat plan just charged it.
 *
 * `cycleKey` is the new renewal date (as an ISO date string) and doubles
 * as this attempt's idempotency key via the unique index in migration
 * 013 — a redelivered webhook for the same renewal can't double-charge.
 *
 * Deliberately best-effort in every sense: a failed or skipped overage
 * charge never touches the flat subscription's own status, and every
 * caller wraps this in a `.catch()` for the same reason `accrueCommissionForOrg`
 * is — bookkeeping for one revenue stream must never break another.
 */
export type StorageOverageStatus = "charged" | "failed" | "skipped";

export async function chargeStorageOverageForOrg(orgId: string, cycleKey: string): Promise<StorageOverageStatus> {
  const sql = getSql();
  const usage = await getStorageUsage(orgId);
  const overageBytes = Math.max(0, usage.usedBytes - usage.limitBytes);
  const amountKobo = computeStorageOverageKobo(usage.usedBytes, usage.limitBytes);

  if (amountKobo === 0) {
    await recordAttempt(orgId, cycleKey, overageBytes, 0, "skipped", "", "");
    return "skipped";
  }

  const rows = await sql`
    SELECT paystack_authorization_code FROM infrastructure_accounts WHERE organization_id = ${orgId}
  `;
  const authorizationCode = (rows[0]?.paystack_authorization_code as string) ?? "";
  if (!authorizationCode) {
    await recordAttempt(orgId, cycleKey, overageBytes, amountKobo, "skipped", "No saved card on file to charge for overage yet.", "");
    return "skipped";
  }

  const ownerRows = await sql`
    SELECT email FROM organization_members WHERE organization_id = ${orgId} AND role = 'owner' LIMIT 1
  `;
  const email = (ownerRows[0]?.email as string) ?? "";

  try {
    const charge = await chargeAuthorization({
      authorizationCode,
      email,
      amountKobo,
      metadata: { type: "storage_overage", organizationId: orgId },
    });
    await recordAttempt(orgId, cycleKey, overageBytes, amountKobo, "charged", "", charge.reference);
    return "charged";
  } catch (err) {
    await recordAttempt(orgId, cycleKey, overageBytes, amountKobo, "failed", err instanceof Error ? err.message : "Unknown error", "");
    return "failed";
  }
}

async function recordAttempt(
  orgId: string,
  cycleKey: string,
  overageBytes: number,
  amountKobo: number,
  status: StorageOverageStatus,
  failureReason: string,
  reference: string,
): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO storage_overage_charges (organization_id, overage_bytes, amount_kobo, paystack_reference, status, failure_reason, cycle_key)
    VALUES (${orgId}, ${overageBytes}, ${amountKobo}, ${reference}, ${status}, ${failureReason}, ${cycleKey})
    ON CONFLICT (organization_id, cycle_key) DO NOTHING
  `;
}

export interface StorageOverageCharge {
  id: string;
  overageBytes: number;
  amountKobo: number;
  status: StorageOverageStatus;
  failureReason: string;
  createdAt: string;
}

/** Recent overage-billing attempts for one business — surfaced in Settings
 * so a charge is never a silent surprise. */
export async function listStorageOverageCharges(orgId: string, limit = 12): Promise<StorageOverageCharge[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, overage_bytes, amount_kobo, status, failure_reason, created_at
    FROM storage_overage_charges
    WHERE organization_id = ${orgId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    id: r.id as string,
    overageBytes: Number(r.overage_bytes),
    amountKobo: Number(r.amount_kobo),
    status: r.status as StorageOverageStatus,
    failureReason: (r.failure_reason as string) ?? "",
    createdAt: new Date(r.created_at as string).toISOString(),
  }));
}
