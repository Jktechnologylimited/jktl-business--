"use server";
import { workspace, product } from "@/lib/partners/access";
import { query, initializeOrder, orderIdentity } from "@/lib/domains/service";
import { requireDomainPurchases } from "@/lib/domains/discovery";
import {
  DOMAIN_TERMS,
  parseRegistrant,
  normalizeOrderDomain,
} from "@/lib/domains/model";
import { encryptContact } from "@/lib/domains/contacts";
import { reserveOrder, rateLimit } from "@/lib/domains/store";
export async function partnerCreateDomainOrderAction(
  workspaceId: string,
  raw: {
    domain: string;
    extension: string;
    years: number;
    kind: "REGISTER" | "RENEW";
    assetId?: string;
    registrant: unknown;
    consent: boolean;
    termsVersion: string;
  },
) {
  const { p, w } = await workspace(workspaceId);
  await product("domains", "REQUEST_SETUP");
  if (
    !w.organization_id ||
    raw.consent !== true ||
    raw.termsVersion !== DOMAIN_TERMS ||
    !["REGISTER", "RENEW"].includes(raw.kind)
  )
    throw Error(
      "Client authorization and current registration terms are required.",
    );
  const org = String(w.organization_id);
  const grant = (
    await query(
      "SELECT id FROM partner_client_access WHERE partner_id=$1 AND organization_id=$2 AND revoked_at IS NULL AND ARRAY['VIEW_ALLOWED_SERVICES','REQUEST_SERVICE_CHANGES','PURCHASE_DOMAINS']::text[] <@ scopes",
      [p.id, org],
    )
  )[0];
  if (!grant)
    throw Error(
      "The client owner must explicitly grant domain purchasing permission.",
    );
  await rateLimit(query, p.id, "partner-domain-checkout", 5, 60);
  await requireDomainPurchases(query);
  const price = (
    await query(
      "SELECT * FROM domain_prices WHERE extension=$1 AND enabled=true",
      [raw.extension],
    )
  )[0];
  if (
    !price ||
    Number(
      raw.kind === "REGISTER" ? price.registration_cost : price.renewal_cost,
    ) < 1
  )
    throw Error("Current supplier cost is not verified.");
  const owner = (
    await query(
      "SELECT u.email FROM organization_members m JOIN users u ON u.id=m.user_id WHERE m.organization_id=$1 AND m.role='owner' AND m.active=true ORDER BY m.id LIMIT 1",
      [org],
    )
  )[0];
  if (!owner?.email) throw Error("The client owner billing email is required.");
  const domain = normalizeOrderDomain(raw.domain, raw.extension);
  const contact = encryptContact(parseRegistrant(raw.registrant));
  const order = await reserveOrder(query, {
    ...orderIdentity(),
    org,
    domain,
    extension: raw.extension,
    kind: raw.kind,
    assetId: raw.assetId,
    years: raw.years,
    priceRevision: Number(price.revision),
    contact,
    email: String(owner.email),
    partnerId: p.id,
  });
  // Same native order and customer billing identity, never a partner-owned asset
  // or a reseller-specific duplicate payment system. The owner retains control.
  const url = await initializeOrder(String(order.id), org);
  return { id: String(order.id), url };
}
