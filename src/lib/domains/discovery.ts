import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { getSql } from "@/lib/db/client";
import {
  normalizeOrderDomain,
  domainAvailabilityStatus,
  type Query,
} from "./model";
import { rateLimit } from "./store";
import { lookupDomain, type DomainLookup } from "./lookup";
export const domainQuery: Query = (text, params) =>
  getSql().query(text, params);
export async function purchaseControls(q: Query = domainQuery) {
  const r = (
    await q(
      "SELECT purchases_enabled,automation_enabled,readonly_verified_at,e2e_verified_at FROM domain_purchase_controls WHERE id=true",
      [],
    )
  )[0];
  return {
    purchasesEnabled:
      r?.purchases_enabled === true &&
      !!r.readonly_verified_at &&
      !!r.e2e_verified_at,
    automationEnabled:
      r?.automation_enabled === true &&
      r?.purchases_enabled === true &&
      !!r.readonly_verified_at &&
      !!r.e2e_verified_at,
  };
}
export async function requireDomainPurchases(q: Query = domainQuery) {
  if (!(await purchaseControls(q)).purchasesEnabled)
    throw Error(
      "Domain checkout is temporarily unavailable. Searches and existing domain management remain available.",
    );
}
export async function publicDomainSearch(
  input: unknown,
  ip: string,
  q: Query = domainQuery,
) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("Enter a domain name.");
  const raw = input as Record<string, unknown>;
  if (typeof raw.name !== "string" || raw.name.length > 253)
    throw Error("Enter a domain name.");
  const hash = createHash("sha256")
    .update("jktl-domain-search:" + ip)
    .digest("hex")
    .slice(0, 32);
  await rateLimit(q, "public:" + hash, "domain-search", 12, 60);
  const prices = await q(
    `SELECT * FROM domain_prices WHERE enabled=true AND currency='NGN' AND registration_price>0 AND renewal_price>0 ORDER BY length(extension) DESC,extension`,
    [],
  );
  if (!prices.length)
    return {
      results: [],
      purchasesEnabled: false,
      message:
        "Domain search is temporarily unavailable. Please try again shortly.",
    };
  const match = prices.find((p) =>
    raw.name!.toString().trim().toLowerCase().endsWith(String(p.extension)),
  );
  const extension = match
    ? String(match.extension)
    : typeof raw.extension === "string"
      ? raw.extension
      : ".com.ng";
  if (!prices.some((p) => p.extension === extension))
    return {
      results: [],
      purchasesEnabled: false,
      availabilityStatus: "UNSUPPORTED",
      message: "This extension is not currently supported.",
    };
  const domain = normalizeOrderDomain(raw.name, extension),
    label = domain.slice(0, -extension.length);
  if (!prices.some((p) => p.extension === extension))
    throw Error("Choose an enabled extension.");
  const selected = [
    prices.find((p) => p.extension === extension)!,
    ...prices.filter((p) => p.extension !== extension),
  ].slice(0, 3);
  const controls = await purchaseControls(q);
  const results = await Promise.all(
    selected.map(async (price) => {
      const candidate = normalizeOrderDomain(label, String(price.extension));
      const cached = (
        await q(
          "SELECT result FROM domain_public_searches WHERE domain=$1 AND price_revision=$2 AND valid_until>now()",
          [candidate, price.revision],
        )
      )[0];
      let result: DomainLookup = {
        status: "UNKNOWN",
        source: "none",
        costKobo: null,
      };
      if (cached) {
        const r = cached.result as DomainLookup;
        if (r && ["AVAILABLE", "UNAVAILABLE", "UNKNOWN"].includes(r.status))
          result = r;
      } else {
        const token = randomUUID();
        const claim = await q(
          `INSERT INTO domain_public_searches(domain,price_revision,lease_until,lease_token) VALUES($1,$2,now()+interval '15 seconds',$3) ON CONFLICT(domain) DO UPDATE SET price_revision=excluded.price_revision,lease_until=excluded.lease_until,lease_token=excluded.lease_token WHERE domain_public_searches.valid_until<=now() AND(domain_public_searches.lease_until IS NULL OR domain_public_searches.lease_until<now()) OR domain_public_searches.price_revision<>excluded.price_revision RETURNING domain`,
          [candidate, price.revision, token],
        );
        if (claim.length) {
          try {
            await rateLimit(q, "public-global", "domain-provider", 90, 60);
            if (
              (
                await q("SELECT 1 FROM domain_assets WHERE domain=$1", [
                  candidate,
                ])
              ).length
            )
              result = {
                status: "UNAVAILABLE",
                source: "none",
                costKobo: null,
              };
            else result = await lookupDomain(candidate, price);
            await q(
              `UPDATE domain_public_searches SET result=$3::jsonb,valid_until=now()+$4::int*interval '1 second',lease_until=NULL,lease_token=NULL,updated_at=now() WHERE domain=$1 AND lease_token=$2`,
              [
                candidate,
                token,
                JSON.stringify(result),
                result.status === "UNKNOWN" ? 5 : 60,
              ],
            );
          } catch {
            await q(
              "UPDATE domain_public_searches SET lease_until=NULL,lease_token=NULL WHERE domain=$1 AND lease_token=$2",
              [candidate, token],
            );
          }
        }
      }
      return {
        domain: candidate,
        extension: String(price.extension),
        status: result.status,
        availabilityStatus: domainAvailabilityStatus(result),
        ...(result.registryStatus
          ? { registryStatus: result.registryStatus }
          : {}),
        registrationKobo: Number(price.registration_price),
        renewalKobo: Number(price.renewal_price),
        periodYears: 1,
        currency: "NGN",
        priceRevision: Number(price.revision),
        purchaseAllowed:
          result.status === "AVAILABLE" && controls.purchasesEnabled,
      };
    }),
  );
  return {
    results,
    purchasesEnabled: controls.purchasesEnabled,
    message:
      "Availability is not a reservation. Current prices and eligibility are checked again before payment.",
  };
}
