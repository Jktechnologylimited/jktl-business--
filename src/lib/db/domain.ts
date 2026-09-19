import "server-only";
import { getSql } from "./client";
import { getBusinessProfile } from "./organizations";
import type { BusinessProfile } from "@/lib/types";

/** True when another organization already has this exact domain (verified
 * or still pending) — the unique index on `business_profiles.custom_domain`
 * would catch this too, but checking first gives a friendlier error than a
 * raw constraint violation. */
export async function isCustomDomainTaken(domain: string, excludingOrgId: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    SELECT 1 FROM business_profiles WHERE custom_domain = ${domain} AND organization_id <> ${excludingOrgId}
  `;
  return rows.length > 0;
}

/** Starts (or restarts) verification for a domain — always unverified
 * until `markCustomDomainVerified` runs, even if this org previously
 * verified a *different* domain and is now changing it. */
export async function startCustomDomain(orgId: string, domain: string, token: string): Promise<BusinessProfile | null> {
  const sql = getSql();
  await sql`
    UPDATE business_profiles
    SET custom_domain = ${domain}, custom_domain_token = ${token}, custom_domain_verified = false
    WHERE organization_id = ${orgId}
  `;
  return getBusinessProfile(orgId);
}

/** For the verify action to know what DNS record to look for — returns
 * null if no domain has been started yet. */
export async function getPendingCustomDomain(orgId: string): Promise<{ domain: string; token: string } | null> {
  const sql = getSql();
  const rows = await sql`SELECT custom_domain, custom_domain_token FROM business_profiles WHERE organization_id = ${orgId}`;
  const row = rows[0];
  if (!row || !row.custom_domain) return null;
  return { domain: row.custom_domain as string, token: row.custom_domain_token as string };
}

export async function markCustomDomainVerified(orgId: string): Promise<BusinessProfile | null> {
  const sql = getSql();
  await sql`UPDATE business_profiles SET custom_domain_verified = true WHERE organization_id = ${orgId}`;
  return getBusinessProfile(orgId);
}

export async function clearCustomDomain(orgId: string): Promise<BusinessProfile | null> {
  const sql = getSql();
  await sql`
    UPDATE business_profiles
    SET custom_domain = '', custom_domain_token = '', custom_domain_verified = false
    WHERE organization_id = ${orgId}
  `;
  return getBusinessProfile(orgId);
}
