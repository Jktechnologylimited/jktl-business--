import {
  DOMAIN_TERMS,
  validateFulfilmentDates,
  parseNameservers,
  type Query,
} from "./model";
export async function rateLimit(
  q: Query,
  org: string,
  action: string,
  limit: number,
  seconds: number,
) {
  const bucket = `${org}:${action}:${Math.floor(Date.now() / (seconds * 1000))}`;
  const rows = await q(
    `INSERT INTO domain_rate_limits(bucket,hits,expires_at) VALUES($1,1,now()+$2::int*interval '1 second') ON CONFLICT(bucket) DO UPDATE SET hits=domain_rate_limits.hits+1 WHERE domain_rate_limits.hits<$3 RETURNING hits`,
    [bucket, seconds * 2, limit],
  );
  if (!rows.length) throw Error("Too many requests. Please try again shortly.");
}
export async function reserveOrder(
  q: Query,
  p: {
    id: string;
    org: string;
    domain: string;
    extension: string;
    kind: "REGISTER" | "RENEW";
    assetId?: string;
    years: number;
    priceRevision: number;
    contact: string;
    email: string;
    reference: string;
  },
) {
  const rows = await q(
    `WITH held AS (INSERT INTO domain_orders(id,organization_id,domain,extension,kind,asset_id,years,amount_kobo,renewal_kobo,price_revision,contact_ciphertext,billing_email,reference,terms_version,base_expiry)
SELECT $1,$2,$3,p.extension,$4,$5::uuid,$6::int,(CASE WHEN $4='REGISTER' THEN p.registration_price ELSE p.renewal_price END)*$6::int,p.renewal_price,p.revision,$7,$8,$9,$10,(SELECT expires_at FROM domain_assets WHERE id=$5::uuid AND organization_id=$2)
FROM domain_prices p WHERE p.extension=$11 AND p.enabled=true AND p.currency='NGN' AND p.registration_price>0 AND p.renewal_price>0 AND p.revision=$12 AND $6::int BETWEEN 1 AND p.max_years
AND (($4='REGISTER' AND EXISTS(SELECT 1 FROM domain_checks WHERE organization_id=$2 AND domain=$3 AND extension=p.extension AND status='AVAILABLE' AND price_revision=p.revision AND valid_until>now()) AND NOT EXISTS(SELECT 1 FROM domain_assets WHERE domain=$3)) OR ($4='RENEW' AND EXISTS(SELECT 1 FROM domain_assets WHERE id=$5::uuid AND organization_id=$2 AND domain=$3 AND extension=p.extension AND expires_at>now())))
RETURNING *), audited AS (INSERT INTO domain_audit(organization_id,order_id,actor_type,event) SELECT organization_id,id,'customer','ORDER_RECEIVED' FROM held), notified AS(INSERT INTO domain_outbox(event_key,organization_id,domain,event,detail) SELECT id::text||':received',organization_id,domain,'Order received','Awaiting your one-off payment. Registration is not reserved or guaranteed.' FROM held ON CONFLICT DO NOTHING) SELECT * FROM held`,
    [
      p.id,
      p.org,
      p.domain,
      p.kind,
      p.assetId || null,
      p.years,
      p.contact,
      p.email,
      p.reference,
      DOMAIN_TERMS,
      p.extension,
      p.priceRevision,
    ],
  );
  if (!rows[0])
    throw Error(
      "Availability, eligibility or pricing changed. Please search again and review the current quote.",
    );
  return rows[0];
}
export async function recordPayment(q: Query, data: Record<string, unknown>) {
  const ref = String(data.reference || "");
  const row = (
    await q("SELECT * FROM domain_orders WHERE reference=$1", [ref])
  )[0];
  if (!row) throw Error("Unknown domain payment.");
  const meta = (
    data.metadata && typeof data.metadata === "object" ? data.metadata : {}
  ) as Record<string, unknown>;
  const customer = (
    data.customer && typeof data.customer === "object" ? data.customer : {}
  ) as Record<string, unknown>;
  const paid = new Date(String(data.paid_at || ""));
  if (
    data.status !== "success" ||
    data.currency !== "NGN" ||
    !Number.isSafeInteger(Number(data.amount)) ||
    Number(data.amount) !== Number(row.amount_kobo) ||
    !/^\d{1,20}$/.test(String(data.id || "")) ||
    meta.type !== "domain_order" ||
    meta.orderId !== row.id ||
    meta.organizationId !== row.organization_id ||
    meta.domain !== row.domain ||
    Number(meta.years) !== Number(row.years) ||
    String(customer.email || "").toLowerCase() !==
      String(row.billing_email).toLowerCase() ||
    !Number.isFinite(+paid) ||
    +paid > Date.now() + 600000
  )
    throw Error("Domain payment verification mismatch.");
  const rows = await q(
    `WITH locked AS(SELECT * FROM domain_orders WHERE reference=$1 FOR UPDATE), receipt AS(INSERT INTO domain_payments(reference,provider_transaction,amount_kobo,paid_at) SELECT reference,$2,$3,$4::timestamptz FROM locked ON CONFLICT(reference) DO NOTHING RETURNING reference), changed AS(UPDATE domain_orders SET status=CASE WHEN status='PENDING_PAYMENT' THEN 'PAID' WHEN status IN('CANCELLED','FAILED') THEN 'REFUND_PENDING' ELSE status END,paid_at=$4::timestamptz,updated_at=now(),revision=revision+1 WHERE reference IN(SELECT reference FROM receipt) RETURNING *), audited AS(INSERT INTO domain_audit(organization_id,order_id,actor_type,event) SELECT organization_id,id,'system','PAYMENT_VERIFIED' FROM changed), notified AS(INSERT INTO domain_outbox(event_key,organization_id,domain,event,detail) SELECT id::text||':payment',organization_id,domain,'Payment confirmed',CASE WHEN status='REFUND_PENDING' THEN 'Your payment arrived after cancellation. A full-refund review is pending.' ELSE 'Your payment is verified. JKTL will fulfill this order manually. No domain has been purchased automatically.' END FROM changed ON CONFLICT DO NOTHING) SELECT id,status FROM changed`,
    [ref, String(data.id), Number(data.amount), paid.toISOString()],
  );
  return { duplicate: rows.length === 0, ...rows[0] };
}
export async function changeOrder(
  q: Query,
  p: {
    id: string;
    admin: string;
    revision: number;
    status: string;
    reason?: string;
    supplierReference?: string;
    registeredAt?: string;
    expiresAt?: string;
    nameservers?: string;
  },
) {
  const row = (await q("SELECT * FROM domain_orders WHERE id=$1", [p.id]))[0];
  if (!row) throw Error("Order not found.");
  if (Number(row.revision) !== p.revision)
    throw Error("This order changed. Reload before updating it.");
  const allowed: Record<string, string[]> = {
    PAID: ["PROCESSING", "FAILED"],
    PROCESSING: ["ACTIVE", "FAILED"],
    FAILED: row.paid_at ? ["REFUND_PENDING"] : [],
    PENDING_PAYMENT: [],
    ACTIVE: [],
    REFUND_PENDING: [],
    REFUNDED: [],
    CANCELLED: [],
  };
  if (!allowed[String(row.status)]?.includes(p.status))
    throw Error("This fulfillment transition is not allowed.");
  if (
    ["FAILED", "REFUND_PENDING"].includes(p.status) &&
    (!p.reason || p.reason.trim().length < 5 || p.reason.length > 1000)
  )
    throw Error("Explain the failure or full-refund reason.");
  if (p.status === "ACTIVE") {
    if (
      !p.supplierReference ||
      p.supplierReference.trim().length < 3 ||
      p.supplierReference.length > 200
    )
      throw Error("Record the actual supplier transaction reference.");
    const dates = validateFulfilmentDates(
      p.registeredAt || "",
      p.expiresAt || "",
      Number(row.years),
      row.kind === "RENEW" ? String(row.base_expiry) : undefined,
    );
    if (
      row.kind === "REGISTER" &&
      +new Date(dates.start) < +new Date(String(row.paid_at)) - 86400000
    )
      throw Error("Registration cannot precede the verified payment.");
    const ns = parseNameservers(p.nameservers || "");
    const rows = await q(
      `WITH locked AS(SELECT * FROM domain_orders WHERE id=$1 AND revision=$2 AND status='PROCESSING' FOR UPDATE), asset AS(INSERT INTO domain_assets(organization_id,domain,extension,registered_at,expires_at,nameservers,supplier_reference)
SELECT organization_id,domain,extension,$3::timestamptz,$4::timestamptz,$5::jsonb,$6 FROM locked WHERE kind='REGISTER' ON CONFLICT(domain) DO NOTHING RETURNING id,organization_id), renewed AS(UPDATE domain_assets a SET expires_at=$4::timestamptz,nameservers=$5::jsonb,supplier_reference=$6,updated_at=now() FROM locked o WHERE o.kind='RENEW' AND a.id=o.asset_id AND a.organization_id=o.organization_id AND a.expires_at=o.base_expiry AND a.expires_at<$4::timestamptz RETURNING a.id,a.organization_id), changed AS(UPDATE domain_orders o SET status='ACTIVE',asset_id=COALESCE((SELECT id FROM asset),(SELECT id FROM renewed)),supplier_reference=$6,registered_at=$3::timestamptz,expires_at=$4::timestamptz,nameservers=$5::jsonb,revision=revision+1,updated_at=now() WHERE o.id IN(SELECT id FROM locked) AND EXISTS(SELECT 1 FROM asset UNION ALL SELECT 1 FROM renewed) RETURNING o.*), audited AS(INSERT INTO domain_audit(organization_id,order_id,actor_id,actor_type,event,detail) SELECT organization_id,id,$7,'admin','FULFILLED',jsonb_build_object('supplierReference',$6,'expiresAt',$4::text) FROM changed), notified AS(INSERT INTO domain_outbox(event_key,organization_id,domain,event,detail) SELECT id::text||':active',organization_id,domain,CASE WHEN kind='RENEW' THEN 'Renewal successful' ELSE 'Registration successful' END,'The registrar has confirmed your domain. Expiry: '||$4::text FROM changed ON CONFLICT DO NOTHING) SELECT id FROM changed`,
      [
        p.id,
        p.revision,
        dates.start,
        dates.end,
        JSON.stringify(ns),
        p.supplierReference.trim(),
        p.admin,
      ],
    );
    if (!rows.length)
      throw Error("The order or domain changed. Reload before fulfilling.");
    return;
  }
  const rows = await q(
    `WITH changed AS(UPDATE domain_orders SET status=$3,failure_reason=CASE WHEN $3 IN('FAILED','REFUND_PENDING') THEN $4 ELSE failure_reason END,revision=revision+1,updated_at=now() WHERE id=$1 AND revision=$2 AND status=$5 RETURNING *), audited AS(INSERT INTO domain_audit(organization_id,order_id,actor_id,actor_type,event,detail) SELECT organization_id,id,$6,'admin',$3,jsonb_build_object('reason',$4) FROM changed), notified AS(INSERT INTO domain_outbox(event_key,organization_id,domain,event,detail) SELECT id::text||':'||revision,organization_id,domain,CASE WHEN status='PROCESSING' THEN 'Registration processing' WHEN status='FAILED' THEN 'Domain order failed' ELSE 'Full refund requested' END,CASE WHEN status='PROCESSING' THEN 'Your verified order is being fulfilled manually.' WHEN status='FAILED' THEN 'Your domain could not be fulfilled. Contact JKTL about the full-refund process.' ELSE 'Your full refund is queued for processing. It is not yet confirmed by the payment provider.' END FROM changed ON CONFLICT DO NOTHING) SELECT id FROM changed`,
    [
      p.id,
      p.revision,
      p.status,
      p.reason?.trim() || "",
      String(row.status),
      p.admin,
    ],
  );
  if (!rows.length) throw Error("This order changed. Reload before updating.");
}
export async function recordRefund(q: Query, data: Record<string, unknown>) {
  const tx = (
    data.transaction && typeof data.transaction === "object"
      ? data.transaction
      : {}
  ) as Record<string, unknown>;
  const ref = String(tx.reference || data.reference || "");
  const txid = String(
    tx.id ||
      (typeof data.transaction === "number" ? data.transaction : "") ||
      "",
  );
  const row = (
    await q(
      `SELECT o.*,p.provider_transaction FROM domain_orders o JOIN domain_payments p ON p.reference=o.reference WHERE (o.reference=$1 AND $1<>'') OR (p.provider_transaction=$2 AND $2<>'')`,
      [ref, txid],
    )
  )[0];
  if (!row) return false;
  const amount = Number(data.amount);
  const refundId = String(data.id || "");
  if (
    data.currency !== "NGN" ||
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    amount > Number(row.amount_kobo) ||
    !/^\d{1,20}$/.test(refundId) ||
    (ref && ref !== row.reference) ||
    (txid && txid !== row.provider_transaction)
  )
    throw Error("Domain refund verification mismatch.");
  const previous = (
    await q(
      "SELECT reference,amount_kobo FROM domain_refunds WHERE provider_id=$1",
      [refundId],
    )
  )[0];
  if (previous) {
    if (
      previous.reference !== row.reference ||
      Number(previous.amount_kobo) !== amount
    )
      throw Error("Domain refund receipt mismatch.");
    return true;
  }
  const changed = await q(
    `WITH locked AS(SELECT * FROM domain_orders WHERE id=$1 FOR UPDATE), receipt AS(INSERT INTO domain_refunds(provider_id,reference,amount_kobo) SELECT $2,reference,$3 FROM locked WHERE refunded_kobo+$3<=amount_kobo ON CONFLICT DO NOTHING RETURNING amount_kobo), changed AS(UPDATE domain_orders o SET refunded_kobo=o.refunded_kobo+$3,status=CASE WHEN o.refunded_kobo+$3=o.amount_kobo THEN 'REFUNDED' ELSE 'REFUND_PENDING' END,refund_reference=$2,revision=o.revision+1,updated_at=now() WHERE o.id=$1 AND EXISTS(SELECT 1 FROM receipt) RETURNING o.*), audited AS(INSERT INTO domain_audit(organization_id,order_id,actor_type,event,detail) SELECT organization_id,id,'system','REFUND_CONFIRMED',jsonb_build_object('providerRefundId',$2::text,'amountKobo',$3::bigint) FROM changed), notified AS(INSERT INTO domain_outbox(event_key,organization_id,domain,event,detail) SELECT id::text||':refund:'||$2::text,organization_id,domain,CASE WHEN status='REFUNDED' THEN 'Refund confirmed' ELSE 'Partial refund confirmed' END,CASE WHEN status='REFUNDED' THEN 'Your payment provider has confirmed the full domain-order refund.' ELSE 'A partial refund has been confirmed. The outstanding refund remains pending.' END FROM changed ON CONFLICT DO NOTHING) SELECT id FROM changed`,
    [row.id, refundId, amount],
  );
  if (!changed.length) {
    const duplicate = (
      await q(
        "SELECT reference,amount_kobo FROM domain_refunds WHERE provider_id=$1",
        [refundId],
      )
    )[0];
    if (
      !duplicate ||
      duplicate.reference !== row.reference ||
      Number(duplicate.amount_kobo) !== amount
    )
      throw Error(
        "Domain refund exceeds the remaining refundable amount or receipt does not match.",
      );
  }
  return true;
}
