import "server-only";
import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db/client";
import { requireSession } from "@/lib/session";
import { getUser } from "@/lib/db/organizations";
import { initializeDomainPayment, verifyTransaction } from "@/lib/paystack";
import { normalizeOrderDomain, type Query } from "./model";
import { rateLimit, recordPayment, recordRefund } from "./store";
export const query: Query = (text, params) => getSql().query(text, params);
export async function domainOwner() {
  const s = await requireSession();
  const member = (
    await query(
      `SELECT 1 FROM organization_members WHERE organization_id=$1 AND user_id=$2 AND active=true AND role='owner'`,
      [s.organizationId, s.userId],
    )
  )[0];
  if (!member)
    throw Error("Only the business owner can purchase or manage domains.");
  return s;
}
export async function publicPrices() {
  return query(
    `SELECT extension,registration_price,renewal_price,transfer_price,currency,max_years,requirements,revision,updated_at FROM domain_prices WHERE enabled=true AND registration_price>0 AND renewal_price>0 ORDER BY extension`,
    [],
  );
}
export async function checkAvailability(
  org: string,
  label: unknown,
  extension: string,
) {
  await rateLimit(query, org, "search", 15, 60);
  const price = (
    await query(
      "SELECT * FROM domain_prices WHERE extension=$1 AND enabled=true AND registration_price>0 AND renewal_price>0",
      [extension],
    )
  )[0];
  if (!price) throw Error("This extension is not currently offered.");
  const domain = normalizeOrderDomain(label, extension);
  let status = "UNKNOWN",
    source = "manual";
  const existing = (
    await query(
      `SELECT * FROM domain_checks WHERE organization_id=$1 AND domain=$2 AND valid_until>now() AND price_revision=$3`,
      [org, domain, price.revision],
    )
  )[0];
  if (existing)
    return {
      check: existing,
      price: {
        extension,
        registration_price: price.registration_price,
        renewal_price: price.renewal_price,
        revision: price.revision,
        max_years: price.max_years,
        requirements: price.requirements,
      },
    };
  if (
    (await query("SELECT 1 FROM domain_assets WHERE domain=$1", [domain]))
      .length
  )
    status = "UNAVAILABLE";
  else if (
    process.env.DOMAIN_AVAILABILITY_URL &&
    process.env.DOMAIN_AVAILABILITY_API_KEY
  ) {
    try {
      const url = new URL(process.env.DOMAIN_AVAILABILITY_URL);
      if (url.protocol !== "https:" || url.username || url.password)
        throw Error("Invalid provider");
      url.searchParams.set("domain", domain);
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${process.env.DOMAIN_AVAILABILITY_API_KEY}`,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
        redirect: "error",
      });
      if (!res.ok) throw Error("Lookup failed");
      const data = await res.json();
      if (data.domain !== domain || typeof data.available !== "boolean")
        throw Error("Invalid lookup");
      if (data.available === false) status = "UNAVAILABLE";
      else if (
        data.premium === false &&
        (data.registrationPriceKobo === undefined ||
          (Number.isSafeInteger(data.registrationPriceKobo) &&
            data.registrationPriceKobo > 0 &&
            data.registrationPriceKobo <= Number(price.registration_price))) &&
        (!data.currency || data.currency === "NGN")
      )
        status = "AVAILABLE";
      source = "provider";
    } catch {
      status = "UNKNOWN";
      source = "manual";
    }
  }
  const rows = await query(
    `INSERT INTO domain_checks(organization_id,domain,extension,status,source,price_revision,checked_at,valid_until) VALUES($1,$2,$3,$4,$5,$6,CASE WHEN $4<>'UNKNOWN' THEN now() ELSE NULL END,CASE WHEN $4<>'UNKNOWN' THEN now()+interval '10 minutes' ELSE NULL END) ON CONFLICT(organization_id,domain) DO UPDATE SET status=EXCLUDED.status,source=EXCLUDED.source,checked_at=EXCLUDED.checked_at,valid_until=EXCLUDED.valid_until,price_revision=EXCLUDED.price_revision RETURNING *`,
    [org, domain, extension, status, source, price.revision],
  );
  return {
    check: rows[0],
    price: {
      extension,
      registration_price: price.registration_price,
      renewal_price: price.renewal_price,
      revision: price.revision,
      max_years: price.max_years,
      requirements: price.requirements,
    },
  };
}
export async function initializeOrder(id: string, org: string) {
  const row = (
    await query(
      `UPDATE domain_orders SET checkout_state='initializing',updated_at=now() WHERE id=$1 AND organization_id=$2 AND status='PENDING_PAYMENT' AND checkout_state='reserved' RETURNING *`,
      [id, org],
    )
  )[0];
  if (!row) {
    const current = (
      await query(
        "SELECT authorization_url,status FROM domain_orders WHERE id=$1 AND organization_id=$2",
        [id, org],
      )
    )[0];
    if (current?.authorization_url && current.status === "PENDING_PAYMENT")
      return String(current.authorization_url);
    throw Error(
      "Checkout is being prepared or needs a payment status check. Do not start a second order.",
    );
  }
  try {
    const origin =
      process.env.NEXT_PUBLIC_APP_URL || "https://business.jktl.com.ng";
    const checkout = await initializeDomainPayment({
      email: String(row.billing_email),
      amountKobo: Number(row.amount_kobo),
      reference: String(row.reference),
      callbackUrl: `${origin.replace(/\/$/, "")}/business/domains?reference=${encodeURIComponent(String(row.reference))}`,
      metadata: {
        type: "domain_order",
        orderId: row.id,
        organizationId: org,
        domain: row.domain,
        years: row.years,
      },
    });
    if (checkout.reference !== row.reference)
      throw Error("Provider reference mismatch");
    const url = new URL(checkout.authorizationUrl);
    if (url.protocol !== "https:" || url.hostname !== "checkout.paystack.com")
      throw Error("Unexpected payment page");
    await query(
      `UPDATE domain_orders SET checkout_state='ready',authorization_url=$2,updated_at=now() WHERE id=$1`,
      [id, url.toString()],
    );
    return url.toString();
  } catch {
    await query(
      `UPDATE domain_orders SET checkout_state='unknown',updated_at=now() WHERE id=$1`,
      [id],
    );
    throw Error(
      "Payment setup could not be confirmed. Your order is retained. Check its payment status or contact support before trying again.",
    );
  }
}
export async function verifyDomainReference(ref: string) {
  const row = (
    await query("SELECT id FROM domain_orders WHERE reference=$1", [ref])
  )[0];
  if (!row) throw Error("Domain order not found.");
  if (
    (await query("SELECT 1 FROM domain_payments WHERE reference=$1", [ref]))
      .length
  )
    return { paid: true, status: "verified" };
  const verified = await verifyTransaction(ref);
  if (verified.status !== "success")
    return { paid: false, status: verified.status };
  await recordPayment(query, verified as unknown as Record<string, unknown>);
  return { paid: true, status: "verified" };
}
export async function handleDomainEvent(
  event: string,
  data: Record<string, unknown>,
) {
  const exists = (
    await query("SELECT to_regclass('public.domain_orders') AS present", [])
  )[0]?.present;
  if (!exists) {
    const meta = data.metadata as Record<string, unknown> | undefined;
    if (
      meta?.type === "domain_order" ||
      String(data.reference || "").startsWith("jktl_domain_")
    )
      throw Error("Domain payment schema unavailable");
    return false;
  }
  if (event === "charge.success") {
    const ref = String(data.reference || "");
    if (
      !(await query("SELECT 1 FROM domain_orders WHERE reference=$1", [ref]))
        .length
    ) {
      const meta = data.metadata as Record<string, unknown> | undefined;
      if (meta?.type === "domain_order" || ref.startsWith("jktl_domain_"))
        throw Error("Unknown domain payment");
      return false;
    }
    const result = await verifyDomainReference(ref);
    if (!result.paid) throw Error("Domain payment is not confirmed yet");
    return true;
  }
  if (event === "refund.processed") return recordRefund(query, data);
  return false;
}
export async function ownerEmail(userId: string) {
  const user = await getUser(userId);
  if (!user?.email) throw Error("Your account email is missing.");
  return user.email;
}
export function orderIdentity() {
  const id = randomUUID();
  return { id, reference: `jktl_domain_${id.replace(/-/g, "")}` };
}
