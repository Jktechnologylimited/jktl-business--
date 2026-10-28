import "server-only";
import { randomUUID } from "node:crypto";
import { parseNameservers, validateFulfilmentDates, type Query } from "./model";
import { changeOrder } from "./store";

/** Registrar-neutral INTERNAL ledger. These functions are not HTTP endpoints
 * and do not implement/guess a Go54 request or response schema. No live write
 * caller is installed until Go54's remaining contracts are verified. */
export async function claimPaidRegistrarAttempt(q: Query, orderId: string) {
  const id = randomUUID();
  const rows = await q(
    `WITH locked AS(SELECT o.* FROM domain_orders o JOIN domain_payments p ON p.reference=o.reference
      WHERE o.id=$1 AND o.status IN('PAID','PROCESSING') AND o.paid_at IS NOT NULL
      AND p.amount_kobo=o.amount_kobo AND p.provider_transaction<>'' FOR UPDATE OF o),
    added AS(INSERT INTO domain_registrar_operations(id,order_id,kind,domain,attempt)
      SELECT $2,id,kind,domain,1+COALESCE((SELECT max(attempt) FROM domain_registrar_operations WHERE order_id=$1),0)
      FROM locked WHERE NOT EXISTS(SELECT 1 FROM domain_registrar_operations WHERE order_id=$1 AND state<>'NOT_APPLIED')
      ON CONFLICT DO NOTHING RETURNING *),
    processing AS(UPDATE domain_orders SET status='PROCESSING',revision=revision+1,updated_at=now()
      WHERE id IN(SELECT order_id FROM added)),
    audited AS(INSERT INTO domain_audit(order_id,actor_type,event,detail)
      SELECT order_id,'system','REGISTRAR_ATTEMPT_CLAIMED',jsonb_build_object('operation',id,'attempt',attempt) FROM added)
    SELECT * FROM added`,
    [orderId, id],
  );
  if (rows[0]) return { claimed: true, operation: rows[0] };
  const existing = (
    await q(
      "SELECT * FROM domain_registrar_operations WHERE order_id=$1 AND state<>'NOT_APPLIED' ORDER BY attempt DESC LIMIT 1",
      [orderId],
    )
  )[0];
  if (existing) return { claimed: false, operation: existing };
  throw Error(
    "Only a verified paid domain order can be submitted to the registrar.",
  );
}

/** Persist SUBMITTED BEFORE network I/O. A crash/timeout from here requires
 * authoritative reconciliation, never another automatic submit. */
export type RegistrarPreflight = {
  domain: string;
  kind: "REGISTER" | "RENEW";
  years: number;
  eligibilityVerified: boolean;
  availability: "AVAILABLE" | "REGISTERED_TO_RESELLER";
  checkedAt: Date;
  wallet: {
    source: "API";
    currency: "NGN";
    balanceKobo: number;
    checkedAt: Date;
  };
};
export async function markRegistrarSubmitted(
  q: Query,
  operationId: string,
  costKobo: number,
  proof: RegistrarPreflight,
) {
  if (!Number.isSafeInteger(costKobo) || costKobo <= 0)
    throw Error("Current wholesale cost is not verified.");
  if (
    !proof?.eligibilityVerified ||
    !Number.isFinite(+proof.checkedAt) ||
    Math.abs(Date.now() - +proof.checkedAt) > 60000 ||
    !proof.wallet ||
    proof.wallet.source !== "API" ||
    proof.wallet.currency !== "NGN" ||
    !Number.isSafeInteger(proof.wallet.balanceKobo) ||
    proof.wallet.balanceKobo < costKobo ||
    !Number.isFinite(+proof.wallet.checkedAt) ||
    Math.abs(Date.now() - +proof.wallet.checkedAt) > 60000 ||
    (proof.kind === "REGISTER"
      ? proof.availability !== "AVAILABLE"
      : proof.kind !== "RENEW" ||
        proof.availability !== "REGISTERED_TO_RESELLER")
  )
    throw Error(
      "Fresh eligibility, availability and an authenticated sufficient reseller balance are required.",
    );
  const rows = await q(
    `WITH gate AS(UPDATE domain_registrar_state SET inflight_operation_id=$1 WHERE id=true AND inflight_operation_id IS NULL
      AND EXISTS(SELECT 1 FROM domain_registrar_operations r JOIN domain_orders o ON o.id=r.order_id JOIN domain_payments p ON p.reference=o.reference
        WHERE r.id=$1 AND r.state='PRECHECK' AND r.domain=$3 AND r.kind=$4 AND o.years=$5 AND o.status='PROCESSING' AND p.amount_kobo=o.amount_kobo AND o.amount_kobo>=$2) RETURNING id),
    changed AS(UPDATE domain_registrar_operations SET state='SUBMITTED',reserved_cost_kobo=$2,submitted_at=now(),updated_at=now()
      WHERE id=$1 AND state='PRECHECK' AND EXISTS(SELECT 1 FROM gate) RETURNING *)
    INSERT INTO domain_audit(order_id,actor_type,event,detail)
      SELECT order_id,'system','REGISTRAR_SUBMISSION_STARTED',jsonb_build_object('operation',id) FROM changed RETURNING id`,
    [operationId, costKobo, proof.domain, proof.kind, proof.years],
  );
  if (!rows.length)
    throw Error(
      "The registrar request was already submitted or requires reconciliation.",
    );
}

export async function markRegistrarUnknown(q: Query, operationId: string) {
  await q(
    `WITH changed AS(UPDATE domain_registrar_operations SET state='UNKNOWN',reason='Registrar outcome requires reconciliation',updated_at=now()
    WHERE id=$1 AND state='SUBMITTED' RETURNING *)
    INSERT INTO domain_audit(order_id,actor_type,event,detail)
    SELECT order_id,'system','REGISTRAR_OUTCOME_UNKNOWN',jsonb_build_object('operation',id) FROM changed`,
    [operationId],
  );
}

/** NOT_FOUND from RDAP/WHOIS is NOT accepted here. Only a documented registrar
 * account/transaction reconciliation can establish that a paid operation did
 * not happen and is no longer pending. Callers must verify this evidence from
 * the authoritative registrar, not a browser argument or elapsed timeout. */
export async function confirmRegistrarNotApplied(
  q: Query,
  operationId: string,
  evidence: {
    domain: string;
    checkedAt: Date;
    accountVerified: boolean;
    definitelyNotApplied: boolean;
    pending: boolean;
  },
) {
  if (
    !evidence.accountVerified ||
    !evidence.definitelyNotApplied ||
    evidence.pending ||
    !Number.isFinite(+evidence.checkedAt) ||
    Math.abs(Date.now() - +evidence.checkedAt) > 60000
  )
    throw Error(
      "A fresh authoritative registrar reconciliation is required before retrying.",
    );
  const rows = await q(
    `WITH changed AS(UPDATE domain_registrar_operations SET state='NOT_APPLIED',reason='Registrar confirmed no operation applied or pending',
    reconciled_at=$3::timestamptz,updated_at=now() WHERE id=$1 AND domain=$2 AND state IN('SUBMITTED','UNKNOWN') RETURNING *),
    released AS(UPDATE domain_registrar_state SET inflight_operation_id=NULL WHERE inflight_operation_id IN(SELECT id FROM changed))
    INSERT INTO domain_audit(order_id,actor_type,event,detail) SELECT order_id,'system','REGISTRAR_RETRY_CLEARED',jsonb_build_object('operation',id) FROM changed RETURNING id`,
    [operationId, evidence.domain, evidence.checkedAt.toISOString()],
  );
  if (!rows.length)
    throw Error("The registrar attempt changed or does not match this domain.");
}

export type RegistrarConfirmation = {
  domain: string;
  transactionReference: string;
  registeredAt: string;
  expiresAt: string;
  nameservers: string[];
  accountVerified: boolean;
};
export async function recordRegistrarConfirmation(
  q: Query,
  operationId: string,
  result: RegistrarConfirmation,
) {
  const op = (
    await q(
      `SELECT r.*,o.years,o.base_expiry,o.paid_at FROM domain_registrar_operations r JOIN domain_orders o ON o.id=r.order_id WHERE r.id=$1`,
      [operationId],
    )
  )[0];
  if (
    !op ||
    !result.accountVerified ||
    result.domain !== op.domain ||
    !/^[^\x00-\x1f\x7f]{3,200}$/.test(result.transactionReference)
  )
    throw Error("The registrar confirmation does not match the paid order.");
  const dates = validateFulfilmentDates(
    result.registeredAt,
    result.expiresAt,
    Number(op.years),
    op.kind === "RENEW" ? String(op.base_expiry) : undefined,
  );
  if (
    op.kind === "REGISTER" &&
    +new Date(dates.start) < +new Date(String(op.paid_at)) - 86400000
  )
    throw Error("Registration confirmation predates the verified payment.");
  const ns = parseNameservers(result.nameservers.join(" "));
  const rows = await q(
    `WITH changed AS(UPDATE domain_registrar_operations SET state='CONFIRMED',transaction_reference=$2,
    registered_at=$3::timestamptz,expires_at=$4::timestamptz,nameservers=$5::jsonb,reconciled_at=now(),updated_at=now()
    WHERE id=$1 AND state IN('SUBMITTED','UNKNOWN') RETURNING *),
    released AS(UPDATE domain_registrar_state SET inflight_operation_id=NULL WHERE inflight_operation_id IN(SELECT id FROM changed))
    INSERT INTO domain_audit(order_id,actor_type,event,detail) SELECT order_id,'system','REGISTRAR_CONFIRMED',jsonb_build_object('operation',id,'transactionReference',transaction_reference) FROM changed RETURNING id`,
    [
      operationId,
      result.transactionReference,
      dates.start,
      dates.end,
      JSON.stringify(ns),
    ],
  );
  if (!rows.length)
    throw Error(
      "This registrar attempt already changed. Reload its confirmed state.",
    );
}

/** Recoverable database finalization: a confirmed registrar operation is never
 * resubmitted just because creating/extending the local asset failed. */
export async function finalizeRegistrarConfirmation(
  q: Query,
  operationId: string,
  adminId: string,
) {
  const op = (
    await q(
      `SELECT * FROM domain_registrar_operations WHERE id=$1 AND state='CONFIRMED'`,
      [operationId],
    )
  )[0];
  if (!op) throw Error("Record an authoritative registrar confirmation first.");
  const order = (
    await q("SELECT * FROM domain_orders WHERE id=$1", [op.order_id])
  )[0];
  if (!order) throw Error("Domain order not found.");
  if (order.status === "ACTIVE") {
    if (order.supplier_reference !== op.transaction_reference)
      throw Error(
        "The domain order has a different registrar confirmation. Escalate for review.",
      );
  } else {
    await changeOrder(q, {
      id: String(order.id),
      admin: adminId,
      revision: Number(order.revision),
      status: "ACTIVE",
      supplierReference: String(op.transaction_reference),
      registeredAt: new Date(String(op.registered_at)).toISOString(),
      expiresAt: new Date(String(op.expires_at)).toISOString(),
      nameservers: (op.nameservers as string[]).join(" "),
    });
  }
  await q(
    "UPDATE domain_registrar_operations SET confirmation_recorded_at=now() WHERE id=$1 AND confirmation_recorded_at IS NULL",
    [operationId],
  );
}
