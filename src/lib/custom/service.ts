import "server-only";
import { getSql } from "@/lib/db/client";
import { requireSession } from "@/lib/session";
import { verifyTransaction, initializeDomainPayment } from "@/lib/paystack";
import { getUser } from "@/lib/db/organizations";
import { digest, token } from "./model";
export const query = (text: string, params: unknown[] = []) =>
  getSql().query(text, params);
export async function owner() {
  const s = await requireSession();
  if (
    !(
      await query(
        "SELECT 1 FROM organization_members WHERE user_id=$1 AND organization_id=$2 AND active=true AND role='owner'",
        [s.userId, s.organizationId],
      )
    ).length
  )
    throw Error("Only the business owner can manage Custom projects.");
  return s;
}
export async function audit(
  org: string,
  actor: string,
  event: string,
  detail: Record<string, unknown> = {},
  project?: string,
) {
  await query(
    "INSERT INTO custom_audit(organization_id,project_id,actor_id,event,detail) VALUES($1,$2,$3,$4,$5::jsonb)",
    [org, project || null, actor, event, JSON.stringify(detail)],
  );
}
// Generate one outstanding period at a time: no unbounded backdated debt or silent auto-debits.
export async function generateInvoices() {
  return query(`WITH inserted AS(INSERT INTO custom_invoices(service_id,organization_id,project_id,due_on,description,amount_kobo)
 SELECT s.id,s.organization_id,s.project_id,s.next_due_on,s.name||' — '||s.description,s.amount_kobo-s.discount_kobo FROM custom_services s
 WHERE s.status='ACTIVE' AND s.accepted_at IS NOT NULL AND s.next_due_on<= (now() AT TIME ZONE 'Africa/Lagos')::date+14
 AND NOT EXISTS(SELECT 1 FROM custom_invoices i WHERE i.service_id=s.id AND i.status='OPEN')
 ON CONFLICT(service_id,due_on) DO NOTHING RETURNING *)
 INSERT INTO custom_audit(organization_id,project_id,actor_id,event,detail) SELECT organization_id,project_id,'system','INVOICE_CREATED',jsonb_build_object('invoice',id,'amountKobo',amount_kobo) FROM inserted RETURNING id`);
}
export async function initializeInvoice(
  invoiceId: string,
  org: string,
  userId: string,
) {
  const email = (await getUser(userId))?.email;
  if (!email) throw Error("Account email required.");
  const ref = "jktl_custom_" + token();
  const rows = await query(
    "UPDATE custom_invoices SET checkout_state='initializing',reference=$3,billing_email=$4 WHERE id=$1 AND organization_id=$2 AND status='OPEN' AND checkout_state='reserved' RETURNING *",
    [invoiceId, org, ref, email],
  );
  const i = rows[0];
  if (!i) {
    const current = (
      await query(
        "SELECT * FROM custom_invoices WHERE id=$1 AND organization_id=$2",
        [invoiceId, org],
      )
    )[0];
    if (current?.status === "OPEN" && current.authorization_url)
      return String(current.authorization_url);
    throw Error(
      "Checkout is pending verification. Check payment status before trying again.",
    );
  }
  try {
    const origin =
      process.env.NEXT_PUBLIC_APP_URL || "https://business.jktl.com.ng";
    const p = await initializeDomainPayment({
      email,
      amountKobo: Number(i.amount_kobo),
      reference: ref,
      callbackUrl: `${origin}/business/custom?reference=${ref}`,
      metadata: {
        type: "custom_invoice",
        invoiceId: i.id,
        organizationId: org,
      },
    });
    const u = new URL(p.authorizationUrl);
    if (
      p.reference !== ref ||
      u.protocol !== "https:" ||
      u.hostname !== "checkout.paystack.com"
    )
      throw Error("Payment provider response mismatch.");
    await query(
      "UPDATE custom_invoices SET checkout_state='ready',authorization_url=$2 WHERE id=$1",
      [i.id, u.toString()],
    );
    return u.toString();
  } catch {
    await query(
      "UPDATE custom_invoices SET checkout_state='unknown' WHERE id=$1",
      [i.id],
    );
    throw Error(
      "Checkout setup needs a payment status check. Do not create another payment.",
    );
  }
}
export async function verifyInvoice(reference: string) {
  const i = (
    await query("SELECT * FROM custom_invoices WHERE reference=$1", [reference])
  )[0];
  if (!i) return false;
  if (i.status === "PAID") return true;
  const p = await verifyTransaction(reference);
  if (p.status !== "success") throw Error("Payment is not confirmed yet.");
  const m = p.metadata as Record<string, unknown> | null;
  const paid = new Date(String(p.paid_at));
  if (
    p.reference !== reference ||
    p.currency !== "NGN" ||
    Number(p.amount) !== Number(i.amount_kobo) ||
    !/^\d{1,20}$/.test(String(p.id)) ||
    String(p.customer?.email || "").toLowerCase() !==
      String(i.billing_email).toLowerCase() ||
    m?.type !== "custom_invoice" ||
    m?.invoiceId !== i.id ||
    m?.organizationId !== i.organization_id ||
    !Number.isFinite(paid.getTime()) ||
    paid.getTime() > Date.now() + 300000
  )
    throw Error("Payment details do not match this invoice.");
  const rows = await query(
    `WITH locked AS(SELECT * FROM custom_invoices WHERE id=$1 FOR UPDATE),changed AS(UPDATE custom_invoices i SET status='PAID',provider_transaction=$2,paid_at=$3 FROM locked WHERE i.id=locked.id AND locked.status='OPEN' RETURNING i.*),advanced AS(UPDATE custom_services s SET next_due_on=CASE s.interval WHEN 'MONTHLY' THEN (c.due_on+interval '1 month')::date WHEN 'ANNUAL' THEN (c.due_on+interval '1 year')::date ELSE c.due_on END,status=CASE WHEN s.interval='ONCE' THEN 'CANCELLED' ELSE s.status END FROM changed c WHERE s.id=c.service_id RETURNING s.id)
 INSERT INTO custom_audit(organization_id,project_id,actor_id,event,detail) SELECT organization_id,project_id,'system','INVOICE_PAID',jsonb_build_object('invoice',id,'reference',reference) FROM changed RETURNING id`,
    [i.id, String(p.id), paid.toISOString()],
  );
  if (!rows.length) {
    const latest = (
      await query("SELECT status FROM custom_invoices WHERE id=$1", [i.id])
    )[0];
    if (latest?.status !== "PAID")
      throw Error("Payment requires manual review.");
  }
  return true;
}
export async function handleCustomEvent(
  event: string,
  data: Record<string, unknown>,
) {
  if (event !== "charge.success") return false;
  const reference = typeof data.reference === "string" ? data.reference : "";
  const m = data.metadata as Record<string, unknown> | null;
  const known =
    reference.startsWith("jktl_custom_") || m?.type === "custom_invoice";
  if (!known) return false;
  const present = (
    await query("SELECT to_regclass('public.custom_invoices') AS present")
  )[0];
  if (!present?.present) throw Error("Custom invoice schema unavailable");
  if (!(await verifyInvoice(reference)))
    throw Error("Custom invoice not found");
  return true;
}
export async function redeemGrant(raw: string, project: string, key: string) {
  const result = await query(
    `WITH used AS(UPDATE custom_cms_grants g SET used_at=now() FROM custom_projects p,custom_clients c WHERE g.token_hash=$1 AND g.project_id=$2 AND p.id=g.project_id AND p.organization_id=g.organization_id AND c.organization_id=g.organization_id AND c.pilot_ready=true AND c.activated_at IS NOT NULL AND p.status='LIVE' AND p.cms_tested_at IS NOT NULL AND p.cms_key_hash=$3 AND g.used_at IS NULL AND g.expires_at>now() RETURNING g.*) SELECT u.id AS user_id,u.email,u.name,used.project_id,used.organization_id FROM used JOIN users u ON u.id=used.user_id JOIN organization_members om ON om.user_id=u.id AND om.organization_id=used.organization_id AND om.active=true AND om.role='owner'`,
    [digest(raw), project, digest(key)],
  );
  return result[0] || null;
}
