"use server";
import { query } from "@/lib/custom/service";
import { workspace, product } from "@/lib/partners/access";
import { checkAvailability } from "@/lib/domains/service";
import { emailPlans } from "@/lib/business-email/service";
import { rate } from "@/lib/support/service";
import { redact } from "@/lib/support/model";
import { after } from "next/server";
import { processPartnerNotices } from "@/lib/partners/notifications";
async function access(id: string, write = false) {
  const { p, w } = await workspace(id);
  if (!w.organization_id)
    throw Error(
      "The owner must accept this workspace before managing services",
    );
  const r = await query(
    `SELECT id FROM partner_client_access WHERE partner_id=$1 AND organization_id=$2 AND revoked_at IS NULL AND 'VIEW_ALLOWED_SERVICES'=ANY(scopes) AND(NOT $3 OR 'REQUEST_SERVICE_CHANGES'=ANY(scopes))`,
    [p.id, w.organization_id, write],
  );
  if (!r.length)
    throw Error(
      "Current owner permission to view services and request changes is required",
    );
  return { p, w };
}
export async function partnerProductStatusAction(id: string) {
  const { p, w } = await access(id);
  const grant = `EXISTS(SELECT 1 FROM partner_client_access a WHERE a.partner_id=$2 AND a.organization_id=$1 AND a.revoked_at IS NULL AND 'VIEW_ALLOWED_SERVICES'=ANY(a.scopes))`;
  const domainGrant =
      grant +
      " AND EXISTS(SELECT 1 FROM feature_registry f WHERE f.slug='domains' AND f.partner_mode<>'UNAVAILABLE' AND 'VIEW'=ANY(f.partner_actions))",
    emailGrant =
      grant +
      " AND EXISTS(SELECT 1 FROM feature_registry f WHERE f.slug='business-email' AND f.partner_mode<>'UNAVAILABLE' AND 'VIEW'=ANY(f.partner_actions))",
    siteGrant =
      grant +
      " AND EXISTS(SELECT 1 FROM feature_registry f WHERE f.slug='website-builder' AND f.partner_mode<>'UNAVAILABLE' AND 'VIEW'=ANY(f.partner_actions))";
  const [
    domains,
    email,
    domainOrders,
    emailOrders,
    domainTasks,
    emailRequests,
    subscriptions,
    prices,
    plans,
  ] = await Promise.all([
    query(
      `SELECT id,domain,extension,expires_at FROM domain_assets WHERE organization_id=$1 AND ${domainGrant}`,
      [w.organization_id, p.id],
    ),
    query(
      `SELECT id,domain,plan_name,status,renews_at,mailbox_limit FROM email_services WHERE organization_id=$1 AND ${emailGrant}`,
      [w.organization_id, p.id],
    ),
    query(
      `SELECT id,domain,kind,status,fulfillment_stage FROM domain_orders WHERE organization_id=$1 AND ${domainGrant} ORDER BY created_at DESC LIMIT 30`,
      [w.organization_id, p.id],
    ),
    query(
      `SELECT id,domain,plan_name,status FROM email_orders WHERE organization_id=$1 AND ${emailGrant} ORDER BY created_at DESC LIMIT 30`,
      [w.organization_id, p.id],
    ),
    query(
      `SELECT id,kind,status FROM domain_tasks WHERE organization_id=$1 AND ${domainGrant} ORDER BY created_at DESC LIMIT 30`,
      [w.organization_id, p.id],
    ),
    query(
      `SELECT id,kind,status FROM email_requests WHERE organization_id=$1 AND ${emailGrant} ORDER BY created_at DESC LIMIT 30`,
      [w.organization_id, p.id],
    ),
    query(
      `SELECT plan_id,status,period_end FROM website_plan_subscriptions WHERE organization_id=$1 AND ${siteGrant}`,
      [w.organization_id, p.id],
    ),
    query(
      "SELECT extension,registration_price,renewal_price,currency FROM domain_prices WHERE enabled=true AND registration_price>0 ORDER BY extension",
    ),
    emailPlans(),
  ]);
  return {
    domains,
    email,
    domainOrders,
    emailOrders,
    domainTasks,
    emailRequests,
    subscriptions,
    prices,
    plans,
  };
}
export async function partnerDomainAvailabilityAction(
  id: string,
  label: string,
  extension: string,
) {
  const { w } = await access(id, true);
  await product("domains", "REQUEST_SETUP");
  return checkAvailability(String(w.organization_id), label, extension);
}
export async function partnerNativeServiceRequestAction(input: {
  workspaceId: string;
  serviceId: string;
  product: "domains" | "business-email";
  kind: string;
  message: string;
}) {
  if (!["domains", "business-email"].includes(input.product))
    throw Error("Choose a supported product");
  const { p, w } = await access(input.workspaceId, true);
  await product(input.product, "REQUEST_SETUP");
  await rate("partner-native:" + p.id, 20);
  const message = redact(input.message.trim());
  if (message.length < 10 || message.length > 2000)
    throw Error("Describe the requested setup without secrets");
  const domain = input.product === "domains";
  if (
    domain
      ? !["DNS", "NAMESERVERS", "SUPPORT"].includes(input.kind)
      : ![
          "ADD_MAILBOX",
          "REMOVE_MAILBOX",
          "ALIAS",
          "UPGRADE",
          "MIGRATION",
          "SUPPORT",
        ].includes(input.kind)
  )
    throw Error("Choose a supported request type");
  const table = domain ? "domain_assets" : "email_services",
    requests = domain ? "domain_tasks" : "email_requests",
    column = domain ? "asset_id" : "service_id";
  const r = await query(
    `WITH authorized AS(SELECT a.id FROM partner_client_access a JOIN affiliates p ON p.id=a.partner_id JOIN feature_registry f ON f.slug=$7 WHERE a.partner_id=$2 AND a.organization_id=$1 AND a.revoked_at IS NULL AND 'VIEW_ALLOWED_SERVICES'=ANY(a.scopes) AND 'REQUEST_SERVICE_CHANGES'=ANY(a.scopes) AND p.status='active' AND p.programme='partner' AND p.partner_terms_confirmed=true AND f.partner_mode<>'UNAVAILABLE' AND 'REQUEST_SETUP'=ANY(f.partner_actions) FOR UPDATE OF a),native AS(INSERT INTO ${requests}(organization_id,${column},kind,message) SELECT organization_id,id,$4,$5 FROM ${table} WHERE id=$3 AND organization_id=$1 AND EXISTS(SELECT 1 FROM authorized) RETURNING id),ticket AS(INSERT INTO partner_tickets(partner_id,workspace_id,category,subject) SELECT $2,$6,CASE WHEN $7='domains' THEN 'DNS Configuration' ELSE 'Business Email' END,'Client service request — '||$4 FROM native RETURNING id),msg AS(INSERT INTO partner_ticket_messages(ticket_id,actor_id,kind,body) SELECT id,$2,'PARTNER',$5 FROM ticket RETURNING id) INSERT INTO distribution_audit(actor_id,event,affiliate_id,detail) SELECT $2,'NATIVE_SERVICE_REQUESTED',$2,jsonb_build_object('nativeRequest',id,'product',$7::text,'workspace',$6::uuid) FROM native RETURNING id`,
    [
      w.organization_id,
      p.id,
      input.serviceId,
      input.kind,
      message,
      w.id,
      input.product,
    ],
  );
  if (!r.length)
    throw Error("This service is not in the authorized client workspace");
  after(async () => {
    try {
      await processPartnerNotices();
    } catch {}
  });
  return { ok: true };
}
