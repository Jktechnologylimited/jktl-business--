"use server";
import { randomUUID, randomBytes } from "node:crypto";
import { resolveTxt } from "node:dns/promises";
import { requireAdminCapability } from "@/lib/admin-session";
import {
  query,
  owner,
  emailPlans,
  emailAudit,
  initializeEmailOrder,
  verifyEmailReference,
  emailOwnerAddress,
} from "@/lib/business-email/service";
import {
  emailDomain,
  mailboxAddresses,
  EMAIL_TERMS,
  dnsRecords,
  addMonths,
  nigeriaDate,
} from "@/lib/business-email/model";
import { id, text, secureUrl, amount } from "@/lib/custom/model";
import { rateLimit } from "@/lib/domains/store";
function failure(e: unknown) {
  const message = e instanceof Error ? e.message : "";
  console.error("email service request failed");
  return {
    ok: false as const,
    error:
      /^(Enter |Only |Paid |Select |This |Confirm |Checkout |Payment |Email |Domain |Plan |Reload |No |Use |Account |A |The |Too many|Review |Existing )/.test(
        message,
      )
        ? message
        : "Could not complete the email request. Check access, configuration and current status before retrying.",
  };
}
export async function emailWorkspaceAction() {
  try {
    const s = await owner();
    const [plans, services, mailboxes, orders, requests, domains] =
      await Promise.all([
        emailPlans(s.organizationId),
        query(
          "SELECT id,domain,plan_name,plan_id,mailbox_limit,storage_gb,status,ownership_token,verified_at,dns_records,webmail_url,activation_url,starts_at,renews_at,period_price_kobo,period_months,license_type,management_fee_kobo,revision FROM email_services WHERE organization_id=$1 ORDER BY created_at DESC",
          [s.organizationId],
        ),
        query(
          "SELECT b.id,b.service_id,b.address,b.status FROM email_mailboxes b JOIN email_services s ON s.id=b.service_id WHERE s.organization_id=$1 ORDER BY b.address",
          [s.organizationId],
        ),
        query(
          "SELECT id,service_id,kind,domain,plan_name,amount_kobo,period_months,status,reference,mailboxes,pricing_note,paid_at,created_at FROM email_orders WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100",
          [s.organizationId],
        ),
        query(
          "SELECT * FROM email_requests WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100",
          [s.organizationId],
        ),
        query(
          "SELECT domain FROM domain_assets WHERE organization_id=$1 ORDER BY domain",
          [s.organizationId],
        ),
      ]);
    return {
      ok: true as const,
      data: { plans, services, mailboxes, orders, requests, domains },
    };
  } catch (e) {
    return failure(e);
  }
}
export async function orderBusinessEmailAction(input: {
  planId: string;
  planRevision: number;
  overrideRevision: number;
  domain: string;
  mailboxes: string;
  consent: boolean;
  termsVersion: string;
  serviceId?: string;
}) {
  try {
    const s = await emailOwnerAddress();
    await rateLimit(query, s.organizationId, "email-order", 6, 60);
    if (input.consent !== true || input.termsVersion !== EMAIL_TERMS)
      throw Error("Review and accept the current email service terms.");
    const domain = emailDomain(input.domain);
    const plan = (await emailPlans(s.organizationId)).find(
      (p) => p.id === input.planId,
    );
    if (!plan || !plan.checkout_available)
      throw Error(
        "This plan is not open for payment. Contact JKTL for setup enquiries.",
      );
    if (
      Number(plan.revision) !== input.planRevision ||
      Number(plan.override_revision) !== input.overrideRevision
    )
      throw Error("Reload the current email price before ordering.");
    if (
      (
        await query(
          "SELECT 1 FROM email_orders WHERE domain=$1 AND status IN('PENDING_PAYMENT','PAYMENT_CONFIRMED','AWAITING_DOMAIN_VERIFICATION','PENDING_SETUP','CONFIGURING')",
          [domain],
        )
      ).length
    )
      throw Error(
        "Email order already exists. Resolve its payment and setup before linking an existing service.",
      );
    const boxes = mailboxAddresses(
      input.mailboxes,
      domain,
      Number(plan.mailbox_limit),
    );
    const sid = input.serviceId ? id(input.serviceId) : null;
    let baseExpiry = null;
    if (sid) {
      const service = (
        await query(
          "SELECT * FROM email_services WHERE id=$1 AND organization_id=$2 AND domain=$3 AND status='ACTIVE' AND license_type='PAID' AND renews_at>now() AND renews_at<=now()+interval '45 days'",
          [sid, s.organizationId, domain],
        )
      )[0];
      if (!service)
        throw Error(
          "This service is not eligible for online renewal. Request billing assistance.",
        );
      const existing = (
        await query(
          "SELECT address FROM email_mailboxes WHERE service_id=$1 AND status='ALLOCATED' ORDER BY address",
          [service.id],
        )
      )
        .map((b) => String(b.address))
        .sort();
      if (JSON.stringify(existing) !== JSON.stringify([...boxes].sort()))
        throw Error(
          "Use the existing mailbox list for renewal. Request mailbox changes separately before renewing.",
        );
      baseExpiry = service.renews_at;
    } else if (
      (await query("SELECT 1 FROM email_services WHERE domain=$1", [domain]))
        .length
    )
      throw Error(
        "Existing email service found. Use its renewal or support options.",
      );
    const oid = randomUUID(),
      reference = "jktl_email_" + oid.replaceAll("-", "");
    const rows = await query(
      `WITH created AS(INSERT INTO email_orders(id,organization_id,service_id,kind,domain,plan_id,plan_revision,plan_name,mailbox_limit,storage_gb,period_months,features,amount_kobo,mailboxes,terms_version,reference,billing_email,base_expiry,pricing_note) SELECT $1,$2,$3,$4,$5,p.id,p.revision,p.name,p.mailbox_limit,p.storage_gb,p.period_months,p.features,COALESCE(o.price_kobo,p.price_kobo),$6::jsonb,$7,$8,$9,$10,COALESCE(o.note,'') FROM email_plans p LEFT JOIN email_price_overrides o ON o.plan_id=p.id AND o.organization_id=$2 WHERE p.id=$11 AND p.revision=$12 AND COALESCE(o.revision,0)=$13 AND p.enabled AND p.purchasable AND p.resale_confirmed AND p.paid_license_confirmed AND p.features_confirmed AND p.procurement_cost_kobo IS NOT NULL AND($3::uuid IS NOT NULL OR NOT EXISTS(SELECT 1 FROM email_services WHERE domain=$5)) RETURNING *) INSERT INTO email_audit(organization_id,actor_id,event,detail) SELECT organization_id,$14,'ORDER_CREATED',jsonb_build_object('order',id,'amountKobo',amount_kobo,'periodMonths',period_months) FROM created RETURNING id`,
      [
        oid,
        s.organizationId,
        sid,
        sid ? "RENEW" : "NEW",
        domain,
        JSON.stringify(boxes),
        EMAIL_TERMS,
        reference,
        s.email,
        baseExpiry,
        input.planId,
        input.planRevision,
        input.overrideRevision,
        s.userId,
      ],
    );
    if (!rows.length)
      throw Error("Reload the plan; its purchase settings changed.");
    return {
      ok: true as const,
      data: { url: await initializeEmailOrder(oid, s.organizationId) },
    };
  } catch (e) {
    if ((e as { code?: string })?.code === "23505")
      return {
        ok: false as const,
        error:
          "An email order already exists for this domain. Check payment history before starting another.",
      };
    return failure(e);
  }
}
export async function resumeEmailOrderAction(orderId: string) {
  try {
    const s = await owner();
    await rateLimit(query, s.organizationId, "email-resume", 6, 60);
    return {
      ok: true as const,
      data: { url: await initializeEmailOrder(id(orderId), s.organizationId) },
    };
  } catch (e) {
    return failure(e);
  }
}
export async function verifyBusinessEmailPaymentAction(reference: string) {
  try {
    const s = await owner();
    await rateLimit(query, s.organizationId, "email-verify", 10, 60);
    if (
      typeof reference !== "string" ||
      reference.length > 100 ||
      !(
        await query(
          "SELECT 1 FROM email_orders WHERE reference=$1 AND organization_id=$2",
          [reference, s.organizationId],
        )
      ).length
    )
      throw Error("Email order not found.");
    await verifyEmailReference(reference);
    return { ok: true as const };
  } catch (e) {
    return failure(e);
  }
}
export async function verifyEmailDomainAction(serviceId: string) {
  try {
    const s = await owner();
    await rateLimit(query, s.organizationId, "email-domain", 5, 60);
    const service = (
      await query(
        "SELECT * FROM email_services WHERE id=$1 AND organization_id=$2",
        [id(serviceId), s.organizationId],
      )
    )[0];
    if (!service) throw Error("Email service not found.");
    const values = (await resolveTxt("_jktl-email." + service.domain)).map(
      (parts) => parts.join(""),
    );
    if (!values.includes("jktl-email-verify=" + service.ownership_token))
      throw Error(
        "Domain verification is not complete yet. Check the TXT record and allow DNS to update.",
      );
    await query(
      `WITH changed AS(UPDATE email_services SET verified_at=now(),status=CASE WHEN status='AWAITING_DOMAIN_VERIFICATION' THEN 'PENDING_SETUP' ELSE status END,revision=revision+1 WHERE id=$1 AND organization_id=$2 RETURNING *) INSERT INTO email_audit(organization_id,actor_id,event,detail) SELECT organization_id,$3,'DOMAIN_VERIFIED',jsonb_build_object('service',id) FROM changed`,
      [service.id, s.organizationId, s.userId],
    );
    return { ok: true as const };
  } catch (e) {
    return failure(e);
  }
}
export async function requestEmailHelpAction(
  serviceId: string,
  kind: string,
  message: string,
) {
  try {
    const s = await owner();
    await rateLimit(query, s.organizationId, "email-help", 10, 3600);
    if (
      ![
        "ADD_MAILBOX",
        "REMOVE_MAILBOX",
        "ALIAS",
        "UPGRADE",
        "MIGRATION",
        "SUPPORT",
        "PASSWORD_RESET",
        "BILLING",
      ].includes(kind)
    )
      throw Error("Select a request type.");
    const rows = await query(
      "INSERT INTO email_requests(organization_id,service_id,kind,message) SELECT organization_id,id,$3,$4 FROM email_services WHERE id=$1 AND organization_id=$2 RETURNING id",
      [id(serviceId), s.organizationId, kind, text(message, 3000)],
    );
    if (!rows.length) throw Error("Email service not found.");
    await emailAudit(s.organizationId, s.userId, "SUPPORT_REQUESTED", {
      request: rows[0].id,
    });
    return { ok: true as const };
  } catch (e) {
    return failure(e);
  }
}
export async function adminEmailAction() {
  try {
    await requireAdminCapability("manage_email");
    const [
      plans,
      services,
      orders,
      mailboxes,
      requests,
      audit,
      overrides,
      organizations,
      paymentTotals,
    ] = await Promise.all([
      query("SELECT * FROM email_plans ORDER BY mailbox_limit"),
      query(
        "SELECT s.*,o.name AS organization_name FROM email_services s JOIN organizations o ON o.id=s.organization_id ORDER BY s.created_at DESC",
      ),
      query("SELECT * FROM email_orders ORDER BY created_at DESC LIMIT 200"),
      query("SELECT * FROM email_mailboxes ORDER BY address"),
      query(
        "SELECT r.*,s.domain FROM email_requests r JOIN email_services s ON s.id=r.service_id ORDER BY created_at DESC LIMIT 100",
      ),
      query("SELECT * FROM email_audit ORDER BY id DESC LIMIT 100"),
      query("SELECT * FROM email_price_overrides"),
      query("SELECT id,name FROM organizations ORDER BY name LIMIT 500"),
      query(
        "SELECT COALESCE(SUM(amount_kobo),0) AS gross FROM email_orders WHERE paid_at IS NOT NULL",
      ),
    ]);
    return {
      ok: true as const,
      data: {
        plans,
        services,
        orders,
        mailboxes,
        requests,
        audit,
        overrides,
        organizations,
        grossPaidKobo: Number(paymentTotals[0]?.gross || 0),
      },
    };
  } catch (e) {
    return failure(e);
  }
}
export async function saveEmailPlanAction(input: Record<string, unknown>) {
  try {
    const a = await requireAdminCapability("manage_email");
    const pid = text(input.id, 50);
    const price =
      input.price_kobo === null || input.price_kobo === ""
        ? null
        : amount(input.price_kobo);
    const months = Number(input.period_months),
      limit = Number(input.mailbox_limit),
      storage = Number(input.storage_gb),
      cost =
        input.procurement_cost_kobo === null ||
        input.procurement_cost_kobo === ""
          ? null
          : Number(input.procurement_cost_kobo);
    if (
      !Number.isInteger(months) ||
      months < 1 ||
      months > 36 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 1000 ||
      !Number.isInteger(storage) ||
      storage < 1 ||
      storage > 10000 ||
      (cost !== null && (!Number.isSafeInteger(cost) || cost < 0)) ||
      !Array.isArray(input.features) ||
      input.features.length > 30
    )
      throw Error("Enter valid plan limits, costs and features.");
    const features = input.features.map((f) => text(f, 200));
    const reminders = input.reminder_days ?? [30, 14, 7, 0];
    if (
      !Array.isArray(reminders) ||
      reminders.length > 12 ||
      new Set(reminders).size !== reminders.length ||
      reminders.some((v) => !Number.isInteger(v) || v < 0 || v > 365)
    )
      throw Error("Enter unique reminder days between 0 and 365.");
    for (const key of [
      "enabled",
      "publicly_available",
      "purchasable",
      "recommended",
      "resale_confirmed",
      "paid_license_confirmed",
      "features_confirmed",
    ])
      if (typeof input[key] !== "boolean")
        throw Error("Select valid plan settings.");
    if (
      input.purchasable &&
      (!input.resale_confirmed ||
        !input.paid_license_confirmed ||
        !input.features_confirmed ||
        cost === null)
    )
      throw Error(
        "Confirm paid licensing, resale rights, procurement costs and advertised features before opening checkout.",
      );
    const rows = await query(
      `WITH changed AS(UPDATE email_plans SET reminder_days=$19::jsonb,name=$3,description=$4,price_kobo=$5,period_months=$6,mailbox_limit=$7,storage_gb=$8,features=$9::jsonb,enabled=$10,publicly_available=$11,purchasable=$12,recommended=$13,procurement_cost_kobo=$14,resale_confirmed=$15,paid_license_confirmed=$16,features_confirmed=$17,revision=revision+1,updated_by=$18,updated_at=now() WHERE id=$1 AND revision=$2 RETURNING *) INSERT INTO email_audit(actor_id,event,detail) SELECT $18,'PLAN_UPDATED',jsonb_build_object('plan',id,'revision',revision,'purchasable',purchasable) FROM changed RETURNING id`,
      [
        pid,
        input.revision,
        text(input.name),
        text(input.description, 1000),
        price,
        months,
        limit,
        storage,
        JSON.stringify(features),
        input.enabled,
        input.publicly_available,
        input.purchasable,
        input.recommended,
        cost,
        input.resale_confirmed,
        input.paid_license_confirmed,
        input.features_confirmed,
        a.id,
        JSON.stringify(reminders),
      ],
    );
    if (!rows.length)
      throw Error("Reload this plan; another team member updated it.");
    return { ok: true as const };
  } catch (e) {
    return failure(e);
  }
}
export async function saveEmailOverrideAction(
  orgId: string,
  planId: string,
  price: number,
  note: string,
) {
  try {
    const a = await requireAdminCapability("manage_email");
    await query(
      "INSERT INTO email_price_overrides(organization_id,plan_id,price_kobo,note,updated_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(organization_id,plan_id) DO UPDATE SET price_kobo=EXCLUDED.price_kobo,note=EXCLUDED.note,updated_by=EXCLUDED.updated_by,revision=email_price_overrides.revision+1,updated_at=now()",
      [id(orgId), text(planId, 50), amount(price), text(note, 1000), a.id],
    );
    await emailAudit(orgId, a.id, "PRICE_OVERRIDE", { planId, price, note });
    return { ok: true as const };
  } catch (e) {
    return failure(e);
  }
}
export async function fulfillEmailServiceAction(input: {
  serviceId: string;
  orderId?: string;
  revision: number;
  status: string;
  providerPlan: string;
  providerReference: string;
  licenseType: string;
  dns: unknown;
  sendReceiveConfirmed: boolean;
  dnsConfirmed: boolean;
  webmailUrl: string;
  activationUrl: string;
  startsAt?: string;
  renewsAt?: string;
  note: string;
}) {
  try {
    const a = await requireAdminCapability("manage_email");
    const s = (
      await query("SELECT * FROM email_services WHERE id=$1", [
        id(input.serviceId),
      ])
    )[0];
    if (!s) throw Error("Email service not found.");
    if (
      ![
        "CONFIGURING",
        "ACTIVE",
        "SETUP_FAILED",
        "SUSPENDED",
        "CANCELLED",
      ].includes(input.status) ||
      typeof input.sendReceiveConfirmed !== "boolean" ||
      typeof input.dnsConfirmed !== "boolean" ||
      !["PAID", "LEGACY_FREE"].includes(input.licenseType)
    )
      throw Error("Select valid setup details.");
    const dns = dnsRecords(input.dns),
      note = text(input.note, 2000),
      ref = text(input.providerReference, 200),
      provider = text(input.providerPlan, 200),
      webmail = secureUrl(input.webmailUrl, true),
      activation = secureUrl(input.activationUrl, true);
    let order = null,
      start = null,
      renew = null;
    if (input.orderId) {
      order = (
        await query(
          "SELECT * FROM email_orders WHERE id=$1 AND service_id=$2 AND paid_at IS NOT NULL",
          [id(input.orderId), s.id],
        )
      )[0];
      if (!order || order.status === "ACTIVE")
        throw Error("Email order is not awaiting fulfillment.");
    }
    if ((s.plan_id || order) && input.licenseType !== "PAID")
      throw Error("Paid email packages require paid provider licensing.");
    if (input.status === "ACTIVE") {
      if (
        !s.verified_at ||
        !input.sendReceiveConfirmed ||
        !input.dnsConfirmed ||
        !webmail ||
        !["MX", "SPF", "DKIM", "DMARC"].every((t) =>
          dns.some((r) => r.type === t),
        )
      )
        throw Error(
          "Confirm ownership, DNS records, webmail and sending/receiving tests before activation.",
        );
      if (order) {
        if (input.licenseType !== "PAID")
          throw Error(
            "Paid orders require a properly licensed paid email service.",
          );
        start = nigeriaDate(String(input.startsAt));
        renew = nigeriaDate(String(input.renewsAt));
        const base =
          order.kind === "RENEW" ? new Date(String(order.base_expiry)) : start;
        if (
          (order.kind === "NEW" &&
            start.getTime() <
              new Date(String(order.paid_at)).getTime() - 86400000) ||
          !Number.isFinite(start.getTime()) ||
          !Number.isFinite(renew.getTime()) ||
          Math.abs(
            renew.getTime() -
              addMonths(base, Number(order.period_months)).getTime(),
          ) >
            7 * 86400000 ||
          renew.getTime() <= Date.now() ||
          start.getTime() > Date.now() + 86400000
        )
          throw Error(
            "Enter actual service dates matching the purchased billing period.",
          );
      } else if (s.license_type === "PAID" && s.plan_id && !s.starts_at)
        throw Error(
          "Select the verified paid order before activating a new paid service.",
        );
    }
    const rows = await query(
      `WITH changed AS(UPDATE email_services SET status=$3,provider_plan=$4,provider_reference=$5,license_type=$6,dns_records=$7::jsonb,send_receive_confirmed=$8,dns_confirmed=$9,webmail_url=$10,activation_url=$11,starts_at=COALESCE($12::timestamptz,starts_at),renews_at=COALESCE($13::timestamptz,renews_at),plan_id=COALESCE($15,plan_id),plan_name=COALESCE($16,plan_name),mailbox_limit=COALESCE($17::int,mailbox_limit),storage_gb=COALESCE($18::int,storage_gb),period_price_kobo=COALESCE($19::bigint,period_price_kobo),period_months=COALESCE($20::int,period_months),revision=revision+1,updated_at=now() WHERE id=$1 AND revision=$2 AND($21::timestamptz IS NULL OR renews_at=$21) RETURNING *),orders AS(UPDATE email_orders SET status=$3,revision=revision+1 WHERE id=$14 AND service_id=$1 AND EXISTS(SELECT 1 FROM changed) RETURNING id),audited AS(INSERT INTO email_audit(organization_id,actor_id,event,detail) SELECT organization_id,$22,'SERVICE_UPDATED',jsonb_build_object('service',id,'status',status,'note',$23::text) FROM changed) INSERT INTO email_outbox(event_key,organization_id,subject,detail) SELECT 'service:'||id::text||':'||revision,organization_id,'Business Email setup update',$23 FROM changed RETURNING id`,
      [
        s.id,
        input.revision,
        input.status,
        provider,
        ref,
        input.licenseType,
        JSON.stringify(dns),
        input.sendReceiveConfirmed,
        input.dnsConfirmed,
        webmail,
        activation,
        start?.toISOString() || null,
        renew?.toISOString() || null,
        order?.id || null,
        input.status === "ACTIVE" ? order?.plan_id || null : null,
        input.status === "ACTIVE" ? order?.plan_name || null : null,
        input.status === "ACTIVE" ? order?.mailbox_limit || null : null,
        input.status === "ACTIVE" ? order?.storage_gb || null : null,
        input.status === "ACTIVE" ? order?.amount_kobo || null : null,
        input.status === "ACTIVE" ? order?.period_months || null : null,
        order?.kind === "RENEW" ? order.base_expiry : null,
        a.id,
        note,
      ],
    );
    if (!rows.length)
      throw Error(
        "Reload this service; its revision or renewal period changed.",
      );
    return { ok: true as const };
  } catch (e) {
    return failure(e);
  }
}
export async function linkExistingEmailAction(input: {
  organizationId: string;
  domain: string;
  mailboxes: string;
  mailboxLimit: number;
  storageGb: number;
  providerPlan: string;
  providerReference: string;
  licenseType: string;
  status: string;
  renewsAt?: string;
  managementFeeKobo: number;
  ownershipConfirmed: boolean;
}) {
  try {
    const a = await requireAdminCapability("manage_email");
    const org = id(input.organizationId),
      domain = emailDomain(input.domain);
    if (
      !["PAID", "LEGACY_FREE"].includes(input.licenseType) ||
      !["ACTIVE", "SUSPENDED", "CONFIGURING"].includes(input.status) ||
      !Number.isInteger(input.mailboxLimit) ||
      input.mailboxLimit < 1 ||
      input.mailboxLimit > 1000 ||
      !Number.isInteger(input.storageGb) ||
      input.storageGb < 1 ||
      !Number.isSafeInteger(input.managementFeeKobo) ||
      input.managementFeeKobo < 0 ||
      input.ownershipConfirmed !== true
    )
      throw Error(
        "Confirm existing service ownership, licence and mailbox details.",
      );
    const boxes = mailboxAddresses(input.mailboxes, domain, input.mailboxLimit),
      token = randomBytes(24).toString("hex");
    const renewal = input.renewsAt ? nigeriaDate(input.renewsAt) : null;
    if (renewal && !Number.isFinite(renewal.getTime()))
      throw Error("Enter a valid renewal date.");
    await query(
      `WITH linked AS(INSERT INTO email_services(organization_id,domain,plan_name,mailbox_limit,storage_gb,status,ownership_token,verified_at,provider_plan,provider_reference,license_type,renews_at,management_fee_kobo) VALUES($1,$2,'Existing email service',$3,$4,$5,$6,now(),$7,$8,$9,$10,$11) RETURNING *),boxes AS(INSERT INTO email_mailboxes(service_id,address) SELECT id,jsonb_array_elements_text($12::jsonb) FROM linked) INSERT INTO email_audit(organization_id,actor_id,event,detail) SELECT organization_id,$13,'EXISTING_SERVICE_LINKED',jsonb_build_object('service',id,'licenseType',license_type,'feeRecordedNotCharged',management_fee_kobo) FROM linked`,
      [
        org,
        domain,
        input.mailboxLimit,
        input.storageGb,
        input.status,
        token,
        text(input.providerPlan),
        text(input.providerReference),
        input.licenseType,
        renewal?.toISOString() || null,
        input.managementFeeKobo,
        JSON.stringify(boxes),
        a.id,
      ],
    );
    return { ok: true as const };
  } catch (e) {
    if ((e as { code?: string })?.code === "23505")
      return {
        ok: false as const,
        error:
          "Existing domain or mailbox already linked. No duplicate record was created.",
      };
    return failure(e);
  }
}
export async function replyEmailRequestAction(
  requestId: string,
  status: string,
  reply: string,
) {
  try {
    const a = await requireAdminCapability("manage_email");
    if (!["PROCESSING", "COMPLETED", "DECLINED"].includes(status))
      throw Error("Select a request status.");
    const r = await query(
      "UPDATE email_requests SET status=$2,reply=$3 WHERE id=$1 RETURNING organization_id",
      [id(requestId), status, text(reply, 3000)],
    );
    if (!r.length) throw Error("No request found.");
    await emailAudit(String(r[0].organization_id), a.id, "REQUEST_UPDATED", {
      requestId,
      status,
    });
    return { ok: true as const };
  } catch (e) {
    return failure(e);
  }
}
export async function recordEmailMailboxesAction(
  serviceId: string,
  revision: number,
  addresses: string,
  note: string,
) {
  try {
    const a = await requireAdminCapability("manage_email");
    const s = (
      await query("SELECT * FROM email_services WHERE id=$1", [id(serviceId)])
    )[0];
    if (!s) throw Error("Email service not found.");
    const boxes =
      addresses.trim() === ""
        ? []
        : mailboxAddresses(
            addresses,
            String(s.domain),
            Number(s.mailbox_limit),
          );
    const rows = await query(
      `WITH changed AS(UPDATE email_services SET revision=revision+1,updated_at=now() WHERE id=$1 AND revision=$2 RETURNING *),removed AS(UPDATE email_mailboxes SET status='REMOVED' WHERE service_id IN(SELECT id FROM changed) AND address NOT IN(SELECT jsonb_array_elements_text($3::jsonb))),added AS(INSERT INTO email_mailboxes(service_id,address) SELECT id,jsonb_array_elements_text($3::jsonb) FROM changed ON CONFLICT(address) DO UPDATE SET status='ALLOCATED' WHERE email_mailboxes.service_id=EXCLUDED.service_id) INSERT INTO email_audit(organization_id,actor_id,event,detail) SELECT organization_id,$4,'MAILBOXES_RECORDED',jsonb_build_object('service',id,'note',$5::text,'addresses',$3::jsonb) FROM changed RETURNING id`,
      [s.id, revision, JSON.stringify(boxes), a.id, text(note, 2000)],
    );
    if (!rows.length)
      throw Error("Reload the current mailbox list before saving.");
    return { ok: true as const };
  } catch (e) {
    return failure(e);
  }
}
export async function cancelEmailOrderAction(orderId: string) {
  try {
    const s = await owner();
    await rateLimit(query, s.organizationId, "email-cancel", 5, 60);
    const o = (
      await query(
        "SELECT * FROM email_orders WHERE id=$1 AND organization_id=$2 AND status='PENDING_PAYMENT'",
        [id(orderId), s.organizationId],
      )
    )[0];
    if (!o) throw Error("Email order not found.");
    const { verifyTransaction } = await import("@/lib/paystack");
    const p = await verifyTransaction(String(o.reference));
    if (p.status === "success") {
      await verifyEmailReference(String(o.reference));
      throw Error("Payment has been received. This is not an unpaid order.");
    }
    if (
      p.reference !== o.reference ||
      !["failed", "abandoned"].includes(p.status)
    )
      throw Error(
        "Payment is not confirmed as failed or abandoned. Check its status before cancelling.",
      );
    const rows = await query(
      `WITH changed AS(UPDATE email_orders SET status='CANCELLED',revision=revision+1 WHERE id=$1 AND organization_id=$2 AND status='PENDING_PAYMENT' RETURNING *) INSERT INTO email_audit(organization_id,actor_id,event,detail) SELECT organization_id,$3,'UNPAID_ORDER_CANCELLED',jsonb_build_object('order',id) FROM changed RETURNING id`,
      [o.id, s.organizationId, s.userId],
    );
    if (!rows.length) throw Error("Reload the current order status.");
    return { ok: true as const };
  } catch (e) {
    return failure(e);
  }
}
