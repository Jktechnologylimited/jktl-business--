import "server-only";
import type { Query } from "./model";
import { GO54_WRITES_IMPLEMENTED } from "./go54";
import {
  claimPaidRegistrarAttempt,
  markRegistrarSubmitted,
  markRegistrarUnknown,
  recordRegistrarConfirmation,
  finalizeRegistrarConfirmation,
  confirmRegistrarNotApplied,
  type RegistrarPreflight,
  type RegistrarConfirmation,
} from "./registrar-operations";

export type ManualReason =
  | "ADMIN_SELECTED"
  | "AUTOMATION_DISABLED"
  | "EXTENSION_MANUAL"
  | "CONTACT_REQUIRED"
  | "INSUFFICIENT_WALLET"
  | "AVAILABILITY_UNCONFIRMED"
  | "PROVIDER_RECOVERABLE"
  | "CONTRACT_UNVERIFIED";
/** Trusted server adapter boundary. No browser payload can supply proofs or a
 * success mapper. GO54's real response/wallet schemas must be verified first. */
export type VerifiedRegistrarAdapter = {
  preflight(
    order: Record<string, unknown>,
  ): Promise<
    | { manual: ManualReason }
    | { proof: RegistrarPreflight; costKobo: number; request: unknown }
  >;
  register(
    request: unknown,
  ): Promise<
    | { kind: "CONFIRMED"; confirmation: RegistrarConfirmation }
    | {
        kind: "NOT_APPLIED";
        evidence: Parameters<typeof confirmRegistrarNotApplied>[2];
      }
    | { kind: "UNKNOWN" }
  >;
};

export async function routeManual(
  q: Query,
  id: string,
  reason: ManualReason,
  actor?: string,
) {
  const rows = await q(
    `WITH changed AS(UPDATE domain_orders o SET fulfillment_mode='MANUAL',
    fulfillment_stage=CASE WHEN EXISTS(SELECT 1 FROM domain_registrar_operations r WHERE r.order_id=o.id AND r.state IN('SUBMITTED','UNKNOWN','CONFIRMED')) THEN 'RECONCILIATION_REQUIRED' ELSE 'MANUAL_REVIEW' END,
    fallback_reason=$2,fulfillment_revision=fulfillment_revision+1,updated_at=now()
    WHERE id=$1 AND status IN('PAID','PROCESSING') AND paid_at IS NOT NULL
    AND EXISTS(SELECT 1 FROM domain_payments p WHERE p.reference=o.reference AND p.amount_kobo=o.amount_kobo)
    AND (fulfillment_stage NOT IN('MANUAL_REVIEW','RECONCILIATION_REQUIRED') OR fallback_reason<>$2) RETURNING *),
    audited AS(INSERT INTO domain_audit(organization_id,order_id,actor_id,actor_type,event,detail)
      SELECT organization_id,id,$3,CASE WHEN $3::uuid IS NULL THEN 'system' ELSE 'admin' END,'FULFILLMENT_ROUTED',jsonb_build_object('mode',fulfillment_mode,'stage',fulfillment_stage,'reason',$2) FROM changed),
    notice AS(INSERT INTO domain_outbox(event_key,organization_id,domain,event,detail)
      SELECT id::text||':fulfillment-review',organization_id,domain,'Your domain order is being reviewed','Your payment is confirmed. JKTL is checking the registration. No second payment is needed.' FROM changed ON CONFLICT DO NOTHING)
    SELECT fulfillment_stage FROM changed`,
    [id, reason, actor || null],
  );
  return rows[0]?.fulfillment_stage;
}

async function dispatch(
  q: Query,
  id: string,
  adapter?: VerifiedRegistrarAdapter,
) {
  const order = (
    await q(
      `SELECT o.*,p.manual_only,c.default_fulfillment_mode,c.automation_enabled,c.purchases_enabled,c.readonly_verified_at,c.e2e_verified_at
    FROM domain_orders o JOIN domain_prices p ON p.extension=o.extension CROSS JOIN domain_purchase_controls c
    WHERE o.id=$1 AND c.id=true AND o.status IN('PAID','PROCESSING') AND o.paid_at IS NOT NULL
    AND EXISTS(SELECT 1 FROM domain_payments r WHERE r.reference=o.reference AND r.amount_kobo=o.amount_kobo)`,
      [id],
    )
  )[0];
  if (!order) return;
  const outstanding = (
    await q(
      "SELECT * FROM domain_registrar_operations WHERE order_id=$1 AND state<>'NOT_APPLIED' ORDER BY attempt DESC LIMIT 1",
      [id],
    )
  )[0];
  if (outstanding?.state === "CONFIRMED") {
    await finalizeRegistrarConfirmation(q, String(outstanding.id), null);
    return;
  }
  if (outstanding && outstanding.state !== "PRECHECK") {
    await routeManual(q, id, "CONTRACT_UNVERIFIED");
    return; // confirmed: local finalization only; submitted/unknown: reconcile
  }
  // Manual queues are sticky: settings changes never buy an order a person is
  // already handling. An administrator must explicitly route a later retry.
  if (
    order.fulfillment_stage === "MANUAL_REVIEW" ||
    order.fulfillment_stage === "RECONCILIATION_REQUIRED"
  )
    return;
  if (
    !order.automation_enabled ||
    !order.purchases_enabled ||
    !order.readonly_verified_at ||
    !order.e2e_verified_at
  )
    return routeManual(q, id, "AUTOMATION_DISABLED");
  if (order.default_fulfillment_mode !== "AUTOMATIC")
    return routeManual(q, id, "ADMIN_SELECTED");
  if (order.manual_only) return routeManual(q, id, "EXTENSION_MANUAL");
  if (!adapter) return routeManual(q, id, "CONTRACT_UNVERIFIED");
  const claimed = await claimPaidRegistrarAttempt(q, id);
  if (!claimed.claimed) return; // concurrent or crashed PRECHECK: no second worker
  const operation = String(claimed.operation.id);
  await q(
    "UPDATE domain_orders SET fulfillment_mode='AUTOMATIC',fulfillment_stage='VERIFYING_AVAILABILITY',fulfillment_revision=fulfillment_revision+1 WHERE id=$1 AND status='PROCESSING'",
    [id],
  );
  let preflight: Awaited<ReturnType<VerifiedRegistrarAdapter["preflight"]>>;
  try {
    preflight = await adapter.preflight(order);
  } catch {
    await routeManual(q, id, "AVAILABILITY_UNCONFIRMED");
    return;
  }
  if ("manual" in preflight) {
    await routeManual(q, id, preflight.manual);
    return;
  }
  await q(
    "UPDATE domain_orders SET fulfillment_stage='PENDING_REGISTRATION',fulfillment_revision=fulfillment_revision+1 WHERE id=$1 AND status='PROCESSING'",
    [id],
  );
  try {
    await markRegistrarSubmitted(
      q,
      operation,
      preflight.costKobo,
      preflight.proof,
    );
  } catch {
    await routeManual(q, id, "AVAILABILITY_UNCONFIRMED");
    return;
  }
  // The durable SUBMITTED boundary has been crossed. All exceptions and
  // unverified JSON now require reconciliation; never attempt manual purchase.
  try {
    const result = await adapter.register(preflight.request);
    if (result.kind === "CONFIRMED") {
      await recordRegistrarConfirmation(q, operation, result.confirmation);
      await finalizeRegistrarConfirmation(q, operation, null);
    } else if (result.kind === "NOT_APPLIED") {
      await confirmRegistrarNotApplied(q, operation, result.evidence);
      await routeManual(q, id, "PROVIDER_RECOVERABLE");
    } else {
      // Even a claimed failure needs authoritative account reconciliation before
      // retry. A generic NOT_APPLIED result alone cannot clear the ledger gate.
      await markRegistrarUnknown(q, operation);
    }
  } catch {
    await markRegistrarUnknown(q, operation);
  }
}

export async function dispatchDomainOrder(q: Query, id: string) {
  // A runtime flag must never create a production response mapper. The real
  // adapter remains absent until official response and wallet contracts exist.
  void GO54_WRITES_IMPLEMENTED;
  return dispatch(q, id);
}
export async function dispatchDomainOrderMock(
  q: Query,
  id: string,
  adapter: VerifiedRegistrarAdapter,
) {
  if (process.env.NODE_ENV !== "test")
    throw Error("Registrar mocks require an explicit test runtime.");
  return dispatch(q, id, adapter);
}
export async function dispatchPaidDomainOrders(q: Query, limit = 10) {
  const rows = await q(
    "SELECT id FROM domain_orders WHERE status IN('PAID','PROCESSING') AND fulfillment_stage IN('PAID','REGISTERING','PENDING_REGISTRATION','VERIFYING_AVAILABILITY') ORDER BY created_at LIMIT $1",
    [Math.min(20, Math.max(1, limit))],
  );
  for (const order of rows) await dispatchDomainOrder(q, String(order.id));
  return rows.length;
}
