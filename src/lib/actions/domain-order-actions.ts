"use server";
import { after } from "next/server";
import { resolveTxt, resolveCname, resolve4 } from "node:dns/promises";
import { requireAdminCapability } from "@/lib/admin-session";
import {
  domainOwner,
  query,
  publicPrices,
  checkAvailability,
  initializeOrder,
  verifyDomainReference,
  ownerEmail,
  orderIdentity,
} from "@/lib/domains/service";
import { encryptContact, decryptContact } from "@/lib/domains/contacts";
import {
  parseRegistrant,
  normalizeOrderDomain,
  priceKobo,
  orderTotal,
  DOMAIN_TERMS,
  parseNameservers,
} from "@/lib/domains/model";
import {
  reserveOrder,
  rateLimit,
  changeOrder,
  recordRefund,
} from "@/lib/domains/store";
import { verifyTransaction, getDomainRefund } from "@/lib/paystack";
import { startCustomDomainVerificationAction } from "@/lib/actions/domain-actions";
import { flushDomainNotifications } from "@/lib/domains/notifications";
const uuid = (v: unknown) => {
  if (
    typeof v !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  )
    throw Error("Invalid domain record.");
  return v;
};
function failure(e: unknown) {
  const message = e instanceof Error ? e.message : "";
  console.error(
    "domain action failed",
    e instanceof Error && "code" in e ? String(e.code) : "request",
  );
  const safe =
    /^(Enter |Use |Check |Choose |Only |Your |This |The order|The domain|The registrar|Too many|Upgrade |Payment is |Availability|Domain order not found|Order not found|Record |Explain |Registration |Secure domain|Payment setup|Checkout |Sign in|Not signed|Could not|Invalid domain|That domain|No |A |Reload |Expired|Current |Website |Hosting |Transfer |Complete |You must)/.test(
      message,
    );
  return {
    ok: false as const,
    error: safe
      ? message
      : "Could not complete the domain request. Check its current status before retrying or contact support.",
  };
}
function flush() {
  after(async () => {
    try {
      await flushDomainNotifications(3);
    } catch {
      /* durable outbox retries through cron */
    }
  });
}
export async function searchDomainsAction(label: unknown, extension: string) {
  try {
    const s = await domainOwner();
    const data = await checkAvailability(s.organizationId, label, extension);
    return { ok: true as const, data };
  } catch (e) {
    return failure(e);
  }
}
export async function customerDomainsAction() {
  try {
    const s = await domainOwner();
    const [prices, orders, assets, checks, tasks] = await Promise.all([
      publicPrices(),
      query(
        `SELECT id,domain,extension,kind,asset_id,years,status,amount_kobo,renewal_kobo,currency,reference,authorization_url,checkout_state,registered_at,expires_at,nameservers,failure_reason,refunded_kobo,revision,paid_at,created_at FROM domain_orders WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100`,
        [s.organizationId],
      ),
      query(
        `SELECT a.id,a.domain,a.extension,a.registered_at,a.expires_at,a.nameservers,a.connection_status,a.website_org_id,p.renewal_price,p.enabled,p.revision AS price_revision,p.max_years,b.display_name,b.subdomain,b.published FROM domain_assets a LEFT JOIN domain_prices p ON p.extension=a.extension LEFT JOIN business_profiles b ON b.organization_id=a.website_org_id WHERE a.organization_id=$1 ORDER BY a.expires_at`,
        [s.organizationId],
      ),
      query(
        "SELECT * FROM domain_checks WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 30",
        [s.organizationId],
      ),
      query(
        "SELECT id,asset_id,kind,message,status,admin_note,created_at FROM domain_tasks WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 50",
        [s.organizationId],
      ),
    ]);
    return {
      ok: true as const,
      data: { prices, orders, assets, checks, tasks },
    };
  } catch (e) {
    return failure(e);
  }
}
export async function createDomainOrderAction(raw: {
  domain: string;
  extension: string;
  kind: "REGISTER" | "RENEW";
  assetId?: string;
  years: number;
  priceRevision: number;
  registrant: unknown;
  consent: boolean;
  termsVersion: string;
}) {
  try {
    const s = await domainOwner();
    await rateLimit(query, s.organizationId, "checkout", 6, 60);
    if (raw.consent !== true || raw.termsVersion !== DOMAIN_TERMS)
      throw Error("You must accept the current domain registration terms.");
    if (raw.kind !== "REGISTER" && raw.kind !== "RENEW")
      throw Error("Choose registration or renewal.");
    if (raw.kind === "RENEW") uuid(raw.assetId);
    const domain = normalizeOrderDomain(raw.domain, raw.extension);
    const price = (
      await query(
        "SELECT * FROM domain_prices WHERE extension=$1 AND enabled=true",
        [raw.extension],
      )
    )[0];
    if (!price || Number(price.revision) !== raw.priceRevision)
      throw Error("Current prices changed. Review the latest quote.");
    orderTotal(
      raw.kind === "REGISTER" ? price.registration_price : price.renewal_price,
      raw.years,
      price.max_years,
    );
    const encrypted = encryptContact(parseRegistrant(raw.registrant));
    const id = orderIdentity();
    const email = await ownerEmail(s.userId);
    let order;
    try {
      order = await reserveOrder(query, {
        ...id,
        org: s.organizationId,
        domain,
        extension: raw.extension,
        kind: raw.kind,
        assetId: raw.assetId,
        years: raw.years,
        priceRevision: raw.priceRevision,
        contact: encrypted,
        email,
      });
    } catch (e) {
      if (e && typeof e === "object" && "code" in e && e.code === "23505")
        throw Error(
          "A domain order already exists. Check My Domains before paying again.",
        );
      throw e;
    }
    await flush();
    const url = await initializeOrder(String(order.id), s.organizationId);
    return { ok: true as const, data: { id: order.id, url } };
  } catch (e) {
    return failure(e);
  }
}
export async function resumeDomainOrderAction(id: string) {
  try {
    const s = await domainOwner();
    await rateLimit(query, s.organizationId, "checkout", 6, 60);
    const url = await initializeOrder(uuid(id), s.organizationId);
    return { ok: true as const, data: { url } };
  } catch (e) {
    return failure(e);
  }
}
export async function verifyDomainPaymentAction(reference: string) {
  try {
    const s = await domainOwner();
    await rateLimit(query, s.organizationId, "verify", 15, 60);
    if (typeof reference !== "string" || reference.length > 100)
      throw Error("Invalid domain reference.");
    if (
      !(
        await query(
          "SELECT 1 FROM domain_orders WHERE organization_id=$1 AND reference=$2",
          [s.organizationId, reference],
        )
      ).length
    )
      throw Error("Domain order not found.");
    const data = await verifyDomainReference(reference);
    await flush();
    return { ok: true as const, data };
  } catch (e) {
    return failure(e);
  }
}
export async function cancelDomainOrderAction(id: string) {
  try {
    const s = await domainOwner();
    const row = (
      await query(
        `SELECT * FROM domain_orders WHERE id=$1 AND organization_id=$2 AND status='PENDING_PAYMENT'`,
        [uuid(id), s.organizationId],
      )
    )[0];
    if (!row) throw Error("Order not found.");
    const data = await verifyTransaction(String(row.reference));
    if (data.status === "success") {
      await verifyDomainReference(String(row.reference));
      throw Error(
        "Your payment succeeded. This paid order cannot be cancelled as unpaid.",
      );
    }
    if (!["failed", "abandoned"].includes(data.status))
      throw Error(
        "Payment is not definitively failed or abandoned. Check its status later.",
      );
    const cancelled = await query(
      `WITH changed AS(UPDATE domain_orders SET status='CANCELLED',revision=revision+1,updated_at=now() WHERE id=$1 AND organization_id=$2 AND status='PENDING_PAYMENT' RETURNING *) INSERT INTO domain_audit(organization_id,order_id,actor_id,actor_type,event) SELECT organization_id,id,$3,'customer','UNPAID_CANCELLED' FROM changed RETURNING id`,
      [id, s.organizationId, s.userId],
    );
    if (!cancelled.length)
      throw Error("Reload the order; its payment status changed.");
    return { ok: true as const };
  } catch (e) {
    return failure(e);
  }
}
export async function adminDomainsAction() {
  try {
    await requireAdminCapability("manage_domains");
    const [prices, orders, checks, tasks, audit] = await Promise.all([
      query("SELECT * FROM domain_prices ORDER BY extension", []),
      query(
        `SELECT o.*,p.provider_transaction,b.display_name FROM domain_orders o LEFT JOIN domain_payments p ON p.reference=o.reference LEFT JOIN business_profiles b ON b.organization_id=o.organization_id ORDER BY o.created_at DESC LIMIT 150`,
        [],
      ),
      query(
        `SELECT c.*,b.display_name FROM domain_checks c LEFT JOIN business_profiles b ON b.organization_id=c.organization_id WHERE c.status='UNKNOWN' ORDER BY c.created_at LIMIT 100`,
        [],
      ),
      query(
        `SELECT t.*,COALESCE(a.domain,o.domain) AS domain,a.connection_status,a.connection_token,a.hosting_reference FROM domain_tasks t LEFT JOIN domain_assets a ON a.id=t.asset_id LEFT JOIN domain_orders o ON o.id=t.order_id WHERE t.status IN('OPEN','PROCESSING') ORDER BY t.created_at LIMIT 100`,
        [],
      ),
      query("SELECT * FROM domain_audit ORDER BY id DESC LIMIT 100", []),
    ]);
    const safe = orders.map((row) => {
      let contact = null;
      if (row.paid_at)
        try {
          contact = decryptContact(String(row.contact_ciphertext));
        } catch {
          /* key configuration issue shown without leaking data */
        }
      const { contact_ciphertext: _, ...rest } = row;
      void _;
      return { ...rest, registrant: contact };
    });
    return {
      ok: true as const,
      data: { prices, orders: safe, checks, tasks, audit },
    };
  } catch (e) {
    return failure(e);
  }
}
export async function saveDomainPriceAction(raw: {
  extension: string;
  supplier: string;
  registrationCost: number;
  registrationPrice: number;
  renewalCost: number;
  renewalPrice: number;
  transferPrice: number | null;
  enabled: boolean;
  maxYears: number;
  requirements: string;
  revision: number;
}) {
  try {
    const admin = await requireAdminCapability("manage_domains");
    if (
      !/^\.[a-z]{2,}(\.[a-z]{2,})?$/.test(raw.extension) ||
      raw.supplier.length > 120 ||
      !raw.supplier.trim() ||
      raw.requirements.length > 1000 ||
      !Number.isInteger(raw.maxYears) ||
      raw.maxYears < 1 ||
      raw.maxYears > 10 ||
      typeof raw.enabled !== "boolean" ||
      !Number.isInteger(raw.revision) ||
      raw.revision < 0
    )
      throw Error("Check the extension, supplier and registration limits.");
    const prices = [
      priceKobo(raw.registrationCost, true),
      priceKobo(raw.registrationPrice),
      priceKobo(raw.renewalCost, true),
      priceKobo(raw.renewalPrice),
      raw.transferPrice === null ? null : priceKobo(raw.transferPrice),
    ];
    const rows = await query(
      `WITH changed AS(INSERT INTO domain_prices(extension,supplier,registration_cost,registration_price,renewal_cost,renewal_price,transfer_price,enabled,max_years,requirements) SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10 WHERE $11=0 ON CONFLICT(extension) DO NOTHING RETURNING extension), updated AS(UPDATE domain_prices SET supplier=$2,registration_cost=$3,registration_price=$4,renewal_cost=$5,renewal_price=$6,transfer_price=$7,enabled=$8,max_years=$9,requirements=$10,revision=revision+1,updated_at=now() WHERE extension=$1 AND revision=$11 RETURNING extension), audited AS(INSERT INTO domain_audit(actor_id,actor_type,event,detail) SELECT $12,'admin','PRICE_UPDATED',jsonb_build_object('extension',extension) FROM(SELECT extension FROM changed UNION ALL SELECT extension FROM updated)x) SELECT extension FROM changed UNION ALL SELECT extension FROM updated`,
      [
        raw.extension,
        raw.supplier.trim(),
        ...prices,
        raw.enabled,
        raw.maxYears,
        raw.requirements.trim(),
        raw.revision,
        admin.id,
      ],
    );
    if (!rows.length)
      throw Error("Current prices changed. Reload before saving.");
    return { ok: true as const };
  } catch (e) {
    return failure(e);
  }
}
export async function confirmDomainAvailabilityAction(
  id: string,
  available: boolean,
) {
  try {
    const a = await requireAdminCapability("manage_domains");
    if (typeof available !== "boolean")
      throw Error("Choose an availability result.");
    const changed = await query(
      `WITH changed AS(UPDATE domain_checks SET status=$2,source='manual',price_revision=(SELECT revision FROM domain_prices WHERE extension=domain_checks.extension),checked_at=now(),valid_until=now()+interval '30 minutes' WHERE id=$1 RETURNING *) INSERT INTO domain_audit(organization_id,actor_id,actor_type,event,detail) SELECT organization_id,$3,'admin','AVAILABILITY_CONFIRMED',jsonb_build_object('domain',domain,'status',status) FROM changed RETURNING id`,
      [uuid(id), available ? "AVAILABLE" : "UNAVAILABLE", a.id],
    );
    if (!changed.length)
      throw Error("Reload the availability request; it no longer exists.");
    return { ok: true as const };
  } catch (e) {
    return failure(e);
  }
}
export async function fulfillDomainOrderAction(input: {
  id: string;
  revision: number;
  status: string;
  reason?: string;
  supplierReference?: string;
  registeredAt?: string;
  expiresAt?: string;
  nameservers?: string;
}) {
  try {
    const a = await requireAdminCapability("manage_domains");
    uuid(input.id);
    if (!Number.isSafeInteger(input.revision) || input.revision < 1)
      throw Error("Reload this order.");
    await changeOrder(query, { ...input, admin: a.id });
    await flush();
    return { ok: true as const };
  } catch (e) {
    return failure(e);
  }
}
export async function requestDomainTaskAction(
  assetId: string,
  kind: string,
  message: string,
) {
  try {
    const s = await domainOwner();
    await rateLimit(query, s.organizationId, "tasks", 10, 3600);
    if (
      !["DNS", "NAMESERVERS", "TRANSFER", "SUPPORT"].includes(kind) ||
      typeof message !== "string" ||
      message.trim().length < 5 ||
      message.length > 2000
    )
      throw Error(
        "Enter the requested change, without passwords or transfer codes.",
      );
    const rows = await query(
      `WITH request AS(INSERT INTO domain_tasks(asset_id,organization_id,kind,message) SELECT id,organization_id,$3,$4 FROM domain_assets WHERE id=$1 AND organization_id=$2 RETURNING *) INSERT INTO domain_audit(organization_id,actor_id,actor_type,event,detail) SELECT organization_id,$5,'customer','DOMAIN_TASK_REQUESTED',jsonb_build_object('taskId',id,'kind',kind) FROM request RETURNING id`,
      [uuid(assetId), s.organizationId, kind, message.trim(), s.userId],
    );
    if (!rows.length) throw Error("The domain is not in your account.");
    return { ok: true as const };
  } catch (e) {
    return failure(e);
  }
}
export async function requestDomainConnectionAction(assetId: string) {
  try {
    const s = await domainOwner();
    await rateLimit(query, s.organizationId, "connection", 5, 60);
    const asset = (
      await query(
        "SELECT * FROM domain_assets WHERE id=$1 AND organization_id=$2",
        [uuid(assetId), s.organizationId],
      )
    )[0];
    if (!asset) throw Error("The domain is not in your account.");
    const current = (
      await query(
        `SELECT custom_domain,custom_domain_token FROM business_profiles WHERE organization_id=$1`,
        [s.organizationId],
      )
    )[0];
    if (current?.custom_domain && current.custom_domain !== asset.domain)
      throw Error(
        "Your website already has another custom domain. Manage or remove that connection in Website settings first.",
      );
    if (
      asset.connection_token &&
      current?.custom_domain === asset.domain &&
      current?.custom_domain_token === asset.connection_token
    )
      return {
        ok: true as const,
        data: {
          recordName: "_jktl-verify." + asset.domain,
          recordValue: "jktl-domain-verify=" + asset.connection_token,
          cname: process.env.DOMAIN_WEBSITE_CNAME || "",
          ipv4: process.env.DOMAIN_WEBSITE_IPV4 || "",
        },
      };
    const result = await startCustomDomainVerificationAction(
      String(asset.domain),
    );
    if (!result.ok) throw Error(result.error);
    const pending = (
      await query(
        "SELECT custom_domain_token FROM business_profiles WHERE organization_id=$1",
        [s.organizationId],
      )
    )[0];
    await query(
      `WITH changed AS(UPDATE domain_assets SET website_org_id=organization_id,connection_status='PENDING',connection_token=$3,hosting_reference='',updated_at=now() WHERE id=$1 AND organization_id=$2 RETURNING *) INSERT INTO domain_tasks(asset_id,organization_id,kind,message) SELECT id,organization_id,'CONNECT','Connect to the existing JKTL website. Verify ownership, DNS target and hosting setup before completion.' FROM changed`,
      [assetId, s.organizationId, pending.custom_domain_token],
    );
    return {
      ok: true as const,
      data: {
        recordName: result.data.recordName,
        recordValue: result.data.recordValue,
        cname: process.env.DOMAIN_WEBSITE_CNAME || "",
        ipv4: process.env.DOMAIN_WEBSITE_IPV4 || "",
      },
    };
  } catch (e) {
    return failure(e);
  }
}
export async function verifyPurchasedDomainConnectionAction(assetId: string) {
  try {
    const s = await domainOwner();
    await rateLimit(query, s.organizationId, "dns-verify", 10, 60);
    const asset = (
      await query(
        `SELECT a.*,b.custom_domain,b.custom_domain_token,b.published FROM domain_assets a JOIN business_profiles b ON b.organization_id=a.organization_id WHERE a.id=$1 AND a.organization_id=$2`,
        [uuid(assetId), s.organizationId],
      )
    )[0];
    if (
      !asset ||
      asset.domain !== asset.custom_domain ||
      !asset.connection_token ||
      asset.connection_token !== asset.custom_domain_token
    )
      throw Error("Start the connection request first.");
    let txt: string[][] = [];
    try {
      txt = await resolveTxt("_jktl-verify." + asset.domain);
    } catch {}
    if (
      !txt.some(
        (v) => v.join("") === "jktl-domain-verify=" + asset.connection_token,
      )
    )
      throw Error("Your ownership TXT record is not visible yet.");
    let routed = false;
    const target = (process.env.DOMAIN_WEBSITE_CNAME || "")
      .toLowerCase()
      .replace(/\.$/, "");
    const ips = (process.env.DOMAIN_WEBSITE_IPV4 || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (target)
      try {
        routed = (await resolveCname(String(asset.domain))).some(
          (v) => v.toLowerCase().replace(/\.$/, "") === target,
        );
      } catch {}
    if (!routed && ips.length)
      try {
        routed = (await resolve4(String(asset.domain))).some((v) =>
          ips.includes(v),
        );
      } catch {}
    if (!routed)
      throw Error(
        "Your DNS records do not yet point to the configured JKTL hosting target.",
      );
    const status = asset.hosting_reference ? "CONNECTED" : "DNS_VERIFIED";
    await query(
      `WITH changed AS(UPDATE domain_assets SET connection_status=$3,updated_at=now() WHERE id=$1 AND organization_id=$2 AND connection_token=$4 RETURNING *), verified AS(UPDATE business_profiles SET custom_domain_verified=true WHERE organization_id=$2 AND custom_domain=(SELECT domain FROM changed) AND custom_domain_token=$4 AND $3='CONNECTED' RETURNING organization_id), notified AS(INSERT INTO domain_outbox(event_key,organization_id,domain,event,detail) SELECT id::text||':connected:'||connection_token,organization_id,domain,'Domain connection completed','Ownership, DNS and hosting setup have been verified.' FROM changed WHERE connection_status='CONNECTED' ON CONFLICT DO NOTHING) INSERT INTO domain_audit(organization_id,actor_id,actor_type,event,detail) SELECT organization_id,$5,'customer',$3,jsonb_build_object('domain',domain) FROM changed`,
      [assetId, s.organizationId, status, asset.connection_token, s.userId],
    );
    await flush();
    return { ok: true as const, data: { status } };
  } catch (e) {
    return failure(e);
  }
}
export async function completeDomainTaskAction(
  id: string,
  status: string,
  note: string,
  hostingReference?: string,
  confirmedNameservers?: string,
) {
  try {
    const a = await requireAdminCapability("manage_domains");
    if (
      !["PROCESSING", "COMPLETED", "REJECTED"].includes(status) ||
      typeof note !== "string" ||
      note.trim().length < 5 ||
      note.length > 2000 ||
      (hostingReference && hostingReference.length > 200)
    )
      throw Error("Enter a clear fulfillment note.");
    const task = (
      await query(
        `SELECT * FROM domain_tasks WHERE id=$1 AND status IN('OPEN','PROCESSING')`,
        [uuid(id)],
      )
    )[0];
    if (!task) throw Error("The domain task changed. Reload.");
    const confirmed =
      task.kind === "NAMESERVERS" && status === "COMPLETED"
        ? parseNameservers(confirmedNameservers || "")
        : null;
    if (
      task.kind === "CONNECT" &&
      status === "COMPLETED" &&
      (!hostingReference || hostingReference.length < 3)
    )
      throw Error(
        "Record the hosting project/domain verification reference. The customer must still verify DNS.",
      );
    const updated = await query(
      `WITH changed AS(UPDATE domain_tasks SET status=$2,admin_note=$3,updated_at=now() WHERE id=$1 AND status IN('OPEN','PROCESSING') RETURNING *), hosting AS(UPDATE domain_assets SET hosting_reference=CASE WHEN id IN(SELECT asset_id FROM changed WHERE kind='CONNECT') THEN $4 ELSE hosting_reference END,nameservers=CASE WHEN $6::jsonb IS NOT NULL AND id IN(SELECT asset_id FROM changed WHERE kind='NAMESERVERS' AND status='COMPLETED') THEN $6::jsonb ELSE nameservers END,updated_at=now() WHERE id IN(SELECT asset_id FROM changed WHERE status='COMPLETED') RETURNING id) INSERT INTO domain_audit(organization_id,actor_id,actor_type,event,detail) SELECT organization_id,$5,'admin','TASK_UPDATED',jsonb_build_object('taskId',id,'status',status,'note',$3) FROM changed RETURNING id`,
      [
        id,
        status,
        note.trim(),
        hostingReference || "",
        a.id,
        confirmed ? JSON.stringify(confirmed) : null,
      ],
    );
    if (!updated.length)
      throw Error("Reload the task; another administrator updated it.");
    return { ok: true as const };
  } catch (e) {
    return failure(e);
  }
}
export async function requestDomainRefundAction(id: string, reason: string) {
  try {
    const s = await domainOwner();
    await rateLimit(query, s.organizationId, "refund-request", 5, 3600);
    if (
      typeof reason !== "string" ||
      reason.trim().length < 5 ||
      reason.length > 1000
    )
      throw Error("Explain the refund request.");
    const rows = await query(
      `WITH changed AS(UPDATE domain_orders SET status='REFUND_PENDING',failure_reason=$3,revision=revision+1,updated_at=now() WHERE id=$1 AND organization_id=$2 AND status='FAILED' AND paid_at IS NOT NULL RETURNING *), audited AS(INSERT INTO domain_audit(organization_id,order_id,actor_id,actor_type,event) SELECT organization_id,id,$4,'customer','REFUND_REQUESTED' FROM changed) SELECT id FROM changed`,
      [uuid(id), s.organizationId, reason.trim(), s.userId],
    );
    if (!rows.length)
      throw Error("Only a paid, failed domain order can request this refund.");
    return { ok: true as const };
  } catch (e) {
    return failure(e);
  }
}
export async function requestOrderSupportAction(id: string, message: string) {
  try {
    const s = await domainOwner();
    await rateLimit(query, s.organizationId, "tasks", 10, 3600);
    if (
      typeof message !== "string" ||
      message.trim().length < 5 ||
      message.length > 2000
    )
      throw Error(
        "Enter your support request without passwords or transfer codes.",
      );
    const rows = await query(
      `WITH requested AS(INSERT INTO domain_tasks(order_id,organization_id,kind,message) SELECT id,organization_id,'SUPPORT',$3 FROM domain_orders WHERE id=$1 AND organization_id=$2 RETURNING *),audited AS(INSERT INTO domain_audit(organization_id,order_id,actor_id,actor_type,event,detail) SELECT organization_id,order_id,$4,'customer','SUPPORT_REQUESTED',jsonb_build_object('taskId',id) FROM requested) SELECT id FROM requested`,
      [uuid(id), s.organizationId, message.trim(), s.userId],
    );
    if (!rows.length) throw Error("Order not found.");
    return { ok: true as const };
  } catch (e) {
    return failure(e);
  }
}
export async function verifyDomainRefundAction(id: string, refundId: string) {
  try {
    await requireAdminCapability("manage_domains");
    const order = (
      await query(
        `SELECT o.reference,p.provider_transaction FROM domain_orders o JOIN domain_payments p ON p.reference=o.reference WHERE o.id=$1`,
        [uuid(id)],
      )
    )[0];
    if (!order) throw Error("Order not found.");
    const data = await getDomainRefund(refundId);
    if (data.status !== "processed")
      throw Error(
        "The refund is not processed yet. Check again after the provider completes it.",
      );
    const tx = (
      data.transaction && typeof data.transaction === "object"
        ? data.transaction
        : {}
    ) as Record<string, unknown>;
    if (
      String(tx.reference || "") !== order.reference &&
      String(tx.id || data.transaction || "") !== order.provider_transaction
    )
      throw Error("The refund does not belong to this order.");
    await recordRefund(query, data);
    await flush();
    return { ok: true as const };
  } catch (e) {
    return failure(e);
  }
}
