import "server-only";
import { randomUUID, randomBytes } from "node:crypto";
import { query, owner } from "@/lib/custom/service";
import { getUser } from "@/lib/db/organizations";
import { initializeDomainPayment, verifyTransaction } from "@/lib/paystack";
import { launchReady } from "./model";
export { query, owner };
export async function emailPlans(org?: string) {
  const rows = org
    ? await query(
        "SELECT p.*,COALESCE(o.price_kobo,p.price_kobo) AS quoted_price,COALESCE(o.revision,0) AS override_revision,COALESCE(o.note,'') AS pricing_note FROM email_plans p LEFT JOIN email_price_overrides o ON o.plan_id=p.id AND o.organization_id=$1 WHERE p.enabled=true AND(p.publicly_available=true OR o.plan_id IS NOT NULL) ORDER BY p.mailbox_limit",
        [org],
      )
    : await query(
        "SELECT *,price_kobo AS quoted_price,0 AS override_revision FROM email_plans WHERE enabled=true AND publicly_available=true ORDER BY mailbox_limit",
      );
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price_kobo: p.quoted_price,
    period_months: p.period_months,
    mailbox_limit: p.mailbox_limit,
    storage_gb: p.storage_gb,
    features: p.features,
    recommended: p.recommended,
    revision: p.revision,
    override_revision: p.override_revision,
    pricing_note: String(p.pricing_note || ""),
    checkout_available: launchReady({ ...p, price_kobo: p.quoted_price }),
  }));
}
export async function emailAudit(
  org: string | null,
  actor: string,
  event: string,
  detail: Record<string, unknown>,
) {
  await query(
    "INSERT INTO email_audit(organization_id,actor_id,event,detail) VALUES($1,$2,$3,$4::jsonb)",
    [org, actor, event, JSON.stringify(detail)],
  );
}
export async function initializeEmailOrder(orderId: string, org: string) {
  const rows = await query(
    "UPDATE email_orders SET checkout_state='initializing' WHERE id=$1 AND organization_id=$2 AND status='PENDING_PAYMENT' AND checkout_state='reserved' RETURNING *",
    [orderId, org],
  );
  const o = rows[0];
  if (!o) {
    const current = (
      await query(
        "SELECT status,authorization_url FROM email_orders WHERE id=$1 AND organization_id=$2",
        [orderId, org],
      )
    )[0];
    if (current?.status === "PENDING_PAYMENT" && current.authorization_url)
      return String(current.authorization_url);
    throw Error(
      "Checkout is pending verification. Check its status before retrying.",
    );
  }
  try {
    const origin =
      process.env.NEXT_PUBLIC_APP_URL || "https://business.jktl.com.ng";
    const p = await initializeDomainPayment({
      email: String(o.billing_email),
      amountKobo: Number(o.amount_kobo),
      reference: String(o.reference),
      callbackUrl: `${origin}/business/email?reference=${o.reference}`,
      metadata: {
        type: "business_email",
        orderId: o.id,
        organizationId: org,
        domain: o.domain,
      },
    });
    const u = new URL(p.authorizationUrl);
    if (
      p.reference !== o.reference ||
      u.protocol !== "https:" ||
      u.hostname !== "checkout.paystack.com"
    )
      throw Error("Provider mismatch");
    await query(
      "UPDATE email_orders SET authorization_url=$2,checkout_state='ready' WHERE id=$1",
      [o.id, u.toString()],
    );
    return u.toString();
  } catch {
    await query(
      "UPDATE email_orders SET checkout_state='unknown' WHERE id=$1",
      [o.id],
    );
    throw Error(
      "Checkout setup needs verification. Check payment status before retrying.",
    );
  }
}
export async function verifyEmailReference(reference: string) {
  const o = (
    await query("SELECT * FROM email_orders WHERE reference=$1", [reference])
  )[0];
  if (!o) throw Error("Email order not found.");
  if (o.provider_transaction) return true;
  const p = await verifyTransaction(reference);
  if (p.status !== "success") throw Error("Payment is not confirmed yet.");
  const m = p.metadata as Record<string, unknown> | null;
  const paid = new Date(String(p.paid_at));
  if (
    p.reference !== reference ||
    p.currency !== "NGN" ||
    Number(p.amount) !== Number(o.amount_kobo) ||
    !/^\d{1,20}$/.test(String(p.id)) ||
    String(p.customer?.email || "").toLowerCase() !==
      String(o.billing_email).toLowerCase() ||
    m?.type !== "business_email" ||
    m?.orderId !== o.id ||
    m?.organizationId !== o.organization_id ||
    m?.domain !== o.domain ||
    !Number.isFinite(paid.getTime()) ||
    paid.getTime() > Date.now() + 300000
  )
    throw Error("Payment verification details do not match.");
  const sid = randomUUID(),
    token = randomBytes(24).toString("hex");
  try {
    await query(
      `WITH locked AS(SELECT * FROM email_orders WHERE id=$1 FOR UPDATE),changed AS(UPDATE email_orders e SET service_id=CASE WHEN e.kind='NEW' AND locked.status='PENDING_PAYMENT' THEN $4::uuid ELSE e.service_id END,paid_at=$3,provider_transaction=$2,status=CASE WHEN locked.status='PENDING_PAYMENT' THEN 'PAYMENT_CONFIRMED' ELSE 'PAYMENT_REVIEW' END,revision=e.revision+1 FROM locked WHERE e.id=locked.id AND locked.provider_transaction IS NULL AND locked.status IN('PENDING_PAYMENT','CANCELLED') RETURNING e.*),service AS(INSERT INTO email_services(id,organization_id,domain,plan_id,plan_name,mailbox_limit,storage_gb,status,ownership_token,license_type,period_price_kobo,period_months) SELECT $4,organization_id,domain,plan_id,plan_name,mailbox_limit,storage_gb,'AWAITING_DOMAIN_VERIFICATION',$5,'PAID',amount_kobo,period_months FROM changed WHERE kind='NEW' AND status='PAYMENT_CONFIRMED' RETURNING *),boxes AS(INSERT INTO email_mailboxes(service_id,address) SELECT s.id,jsonb_array_elements_text(c.mailboxes) FROM service s,changed c RETURNING id),audited AS(INSERT INTO email_audit(organization_id,actor_id,event,detail) SELECT organization_id,'system','PAYMENT_VERIFIED',jsonb_build_object('order',id,'reference',reference,'status',status) FROM changed) INSERT INTO email_outbox(event_key,organization_id,subject,detail) SELECT 'paid:'||id::text,organization_id,'Business Email payment confirmed',CASE WHEN status='PAYMENT_REVIEW' THEN 'A payment on a cancelled email order needs review. Contact JKTL with your payment reference; no email service was activated.' ELSE 'Your payment is verified. Review domain verification and email setup progress in Business Email.' END FROM changed ON CONFLICT DO NOTHING`,
      [o.id, String(p.id), paid.toISOString(), sid, token],
    );
  } catch (error) {
    if (
      (error as { constraint?: string }).constraint !==
      "email_services_domain_key"
    )
      throw error;
    await query(
      `WITH reviewed AS(UPDATE email_orders SET paid_at=$3,provider_transaction=$2,status='PAYMENT_REVIEW',revision=revision+1 WHERE id=$1 AND provider_transaction IS NULL AND status IN('PENDING_PAYMENT','CANCELLED') RETURNING *),audited AS(INSERT INTO email_audit(organization_id,actor_id,event,detail) SELECT organization_id,'system','PAYMENT_REQUIRES_REVIEW',jsonb_build_object('order',id,'reason','Domain already has an email service; existing service was preserved.') FROM reviewed) INSERT INTO email_outbox(event_key,organization_id,subject,detail) SELECT 'review:'||id::text,organization_id,'Business Email payment needs review','An email service already exists for this domain. Your existing mailboxes were preserved. Contact JKTL with your payment reference for billing review.' FROM reviewed ON CONFLICT DO NOTHING`,
      [o.id, String(p.id), paid.toISOString()],
    );
  }
  const current = (
    await query("SELECT provider_transaction FROM email_orders WHERE id=$1", [
      o.id,
    ])
  )[0];
  if (!current?.provider_transaction)
    throw Error("Payment requires administrator review.");
  return true;
}
export async function handleEmailEvent(
  event: string,
  data: Record<string, unknown>,
) {
  if (event !== "charge.success") return false;
  const reference = typeof data.reference === "string" ? data.reference : "";
  const m = data.metadata as Record<string, unknown> | null;
  if (!reference.startsWith("jktl_email_") && m?.type !== "business_email")
    return false;
  await verifyEmailReference(reference);
  return true;
}
export async function emailOwnerAddress() {
  const s = await owner();
  const email = (await getUser(s.userId))?.email;
  if (!email) throw Error("Account email required.");
  return { ...s, email };
}
