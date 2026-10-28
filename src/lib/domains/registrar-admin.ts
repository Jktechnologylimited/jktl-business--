import "server-only";
import { priceKobo, type Query } from "./model";

export function markedUpPrice(
  cost: number,
  bps: number,
  fixed: number,
): number {
  priceKobo(cost);
  priceKobo(fixed, true);
  if (!Number.isInteger(bps) || bps < 0 || bps > 100000)
    throw Error("Check the markup percentage.");
  // Integer arithmetic, rounded up to the next kobo; no FX or guessed fees.
  return priceKobo(
    Number(
      (BigInt(cost) * BigInt(10000 + bps) + BigInt(9999)) / BigInt(10000),
    ) + fixed,
  );
}

/** INTERNAL normalized data, not an assumed GO54 response schema. An operator
 * may record verified NGN prices until the documented API mapping is supplied. */
export async function saveVerifiedWholesale(
  q: Query,
  actor: string,
  input: {
    extension: string;
    registration: number;
    renewal: number;
    transfer: number;
    revision: number;
  },
) {
  if (
    !/^\.[a-z]{2,63}(\.[a-z]{2,63})?$/.test(input.extension) ||
    !Number.isInteger(input.revision) ||
    input.revision < 1
  )
    throw Error("Check the extension and current price revision.");
  const registration = priceKobo(input.registration),
    renewal = priceKobo(input.renewal),
    transfer = priceKobo(input.transfer, true);
  const row = (
    await q("SELECT * FROM domain_prices WHERE extension=$1 AND revision=$2", [
      input.extension,
      input.revision,
    ])
  )[0];
  if (!row) throw Error("Current prices changed. Reload before saving.");
  const calculate = (cost: number, current: unknown) =>
    row.pricing_mode === "MARKUP" && cost > 0
      ? markedUpPrice(
          cost,
          Number(row.markup_bps),
          Number(row.markup_fixed_kobo),
        )
      : current;
  const rows = await q(
    `WITH changed AS(UPDATE domain_prices SET registration_cost=$3,renewal_cost=$4,transfer_cost=$5,
    registration_price=$6,renewal_price=$7,transfer_price=$8,wholesale_synced_at=now(),revision=revision+1,updated_at=now()
    WHERE extension=$1 AND revision=$2 RETURNING extension)
    INSERT INTO domain_audit(actor_id,actor_type,event,detail) SELECT $9,'admin','WHOLESALE_OPERATOR_VERIFIED',jsonb_build_object('extension',extension) FROM changed RETURNING id`,
    [
      input.extension,
      input.revision,
      registration,
      renewal,
      transfer,
      calculate(registration, row.registration_price),
      calculate(renewal, row.renewal_price),
      calculate(transfer, row.transfer_price),
      actor,
    ],
  );
  if (!rows.length)
    throw Error("Current prices changed. Reload before saving.");
}

export async function saveMarkupPolicy(
  q: Query,
  actor: string,
  input: {
    extension: string;
    revision: number;
    mode: "MANUAL" | "MARKUP";
    bps: number;
    fixed: number;
  },
) {
  if (
    !/^\.[a-z]{2,63}(\.[a-z]{2,63})?$/.test(input.extension) ||
    !Number.isInteger(input.revision) ||
    input.revision < 1
  )
    throw Error("Check the extension and current price revision.");
  if (!["MANUAL", "MARKUP"].includes(input.mode))
    throw Error("Choose a valid pricing mode.");
  const row = (
    await q("SELECT * FROM domain_prices WHERE extension=$1 AND revision=$2", [
      input.extension,
      input.revision,
    ])
  )[0];
  if (!row) throw Error("Current prices changed. Reload before saving.");
  markedUpPrice(1, input.bps, input.fixed);
  if (input.mode === "MARKUP" && !row.wholesale_synced_at)
    throw Error("Record verified wholesale prices before applying a markup.");
  const calc = (cost: unknown, current: unknown) =>
    input.mode === "MARKUP" && Number(cost) > 0
      ? markedUpPrice(Number(cost), input.bps, input.fixed)
      : current;
  const rows = await q(
    `WITH changed AS(UPDATE domain_prices SET pricing_mode=$3,markup_bps=$4,markup_fixed_kobo=$5,
    registration_price=$6,renewal_price=$7,transfer_price=$8,revision=revision+1,updated_at=now() WHERE extension=$1 AND revision=$2 RETURNING extension)
    INSERT INTO domain_audit(actor_id,actor_type,event,detail) SELECT $9,'admin','MARKUP_POLICY_CHANGED',jsonb_build_object('extension',extension,'mode',$3::text) FROM changed RETURNING id`,
    [
      input.extension,
      input.revision,
      input.mode,
      input.bps,
      input.fixed,
      calc(row.registration_cost, row.registration_price),
      calc(row.renewal_cost, row.renewal_price),
      calc(row.transfer_cost, row.transfer_price),
      actor,
    ],
  );
  if (!rows.length)
    throw Error("Current prices changed. Reload before saving.");
}

export async function saveOperatorWallet(
  q: Query,
  actor: string,
  input: { balance: number; threshold: number; revision: number },
) {
  if (!Number.isInteger(input.revision) || input.revision < 1)
    throw Error("Check the current reseller balance revision.");
  const balance = input.balance,
    threshold = input.threshold;
  if (
    !Number.isSafeInteger(balance) ||
    balance < 0 ||
    !Number.isSafeInteger(threshold) ||
    threshold < 0
  )
    throw Error("Check the reseller balance and alert threshold in NGN kobo.");
  const rows = await q(
    `WITH previous AS MATERIALIZED(SELECT * FROM domain_registrar_state WHERE id=true AND revision=$3 FOR UPDATE),
    changed AS(UPDATE domain_registrar_state s SET wallet_kobo=$1::bigint,low_balance_kobo=$2::bigint,wallet_source='OPERATOR',wallet_checked_at=now(),
      low_balance_active=($2::bigint>0 AND $1::bigint<$2::bigint),revision=s.revision+1,updated_by=$4,updated_at=now() FROM previous WHERE s.id=previous.id RETURNING s.*),
    alerted AS(INSERT INTO domain_registrar_alerts(event_key,subject,detail)
      SELECT 'low-wallet:'||c.revision,'GO54 reseller wallet is below its alert threshold','Review the private domain operations dashboard and fund the reseller account before registrar purchases.'
      FROM changed c CROSS JOIN previous p WHERE c.low_balance_active AND (NOT p.low_balance_active OR p.low_balance_kobo<>c.low_balance_kobo) ON CONFLICT DO NOTHING),
    audited AS(INSERT INTO domain_audit(actor_id,actor_type,event) SELECT $4,'admin','RESELLER_WALLET_OPERATOR_VERIFIED' FROM changed)
    SELECT revision FROM changed`,
    [balance, threshold, input.revision, actor],
  );
  if (!rows.length)
    throw Error("The reseller balance changed. Reload before saving.");
}

/** Durable private alerts: only current owner-role team addresses receive them. */
export async function flushRegistrarAlerts(
  q: Query,
  send: (input: {
    to: string;
    subject: string;
    detail: string;
    path: string;
    category: "internal";
    key: string;
  }) => Promise<{ ok: boolean }>,
) {
  const rows = await q(
    `UPDATE domain_registrar_alerts SET lease_until=now()+interval '5 minutes',attempts=attempts+1
    WHERE id IN(SELECT id FROM domain_registrar_alerts WHERE delivered_at IS NULL AND attempts<10 AND(lease_until IS NULL OR lease_until<now())
    ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 5) RETURNING *`,
    [],
  );
  let failed = 0;
  for (const row of rows) {
    const recipients = await q(
      "SELECT email FROM admin_users WHERE role='owner' AND disabled_at IS NULL",
      [],
    );
    let ok = recipients.length > 0;
    for (const recipient of recipients) {
      try {
        if (
          !(
            await send({
              to: String(recipient.email),
              subject: String(row.subject),
              detail: String(row.detail),
              path: "/admin/domains",
              category: "internal",
              key: `registrar-alert-${row.id}-${recipient.email}`,
            })
          ).ok
        )
          ok = false;
      } catch {
        ok = false;
      }
    }
    if (ok)
      await q(
        "UPDATE domain_registrar_alerts SET delivered_at=now(),lease_until=NULL WHERE id=$1",
        [row.id],
      );
    else failed++;
  }
  return { sent: rows.length - failed, failed };
}
