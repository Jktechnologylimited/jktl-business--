import { getSql } from "./client";
import { isoDate } from "./rows";
import type { AppUser, BusinessProfile, BusinessType, Infrastructure, Organization } from "@/lib/types";

function mapOrg(row: Record<string, unknown>): Organization {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    createdAt: isoDate(row.created_at as string),
  };
}

function mapProfile(row: Record<string, unknown>): BusinessProfile {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    businessType: row.business_type as BusinessType,
    displayName: row.display_name as string,
    phone: row.phone as string,
    email: row.email as string,
    address: row.address as string,
    city: row.city as string,
    state: row.state as string,
    logoUrl: (row.logo_url as string) ?? null,
    coverPhotoUrl: (row.cover_photo_url as string) ?? null,
    subdomain: row.subdomain as string,
    // Defensive fallbacks: if migration 003 hasn't been run yet, these three
    // columns simply won't be in the row (not an error, just missing keys),
    // and every reader of BusinessProfile should still get sane values
    // instead of undefined leaking into the UI (e.g. a color picker doing
    // `value.toLowerCase()`).
    published: Boolean(row.published),
    tagline: (row.tagline as string) ?? "",
    themeColor: (row.theme_color as string) || "#0f6e5c",
    customDomain: (row.custom_domain as string) ?? "",
    customDomainVerified: Boolean(row.custom_domain_verified),
  };
}

function mapInfra(row: Record<string, unknown>): Infrastructure {
  return {
    organizationId: row.organization_id as string,
    planName: row.plan_name as string,
    priceKoboPerYear: Number(row.price_kobo_per_year),
    // Defensive fallbacks: rows created before migration 004 (or before it's
    // been run) won't have these columns yet — same pattern as mapProfile's
    // fallbacks after migration 003's crash.
    priceKoboPerCycle: Number(row.price_kobo_per_cycle ?? row.price_kobo_per_year ?? 0),
    billingCycle: ((row.billing_cycle as string) || "yearly") as Infrastructure["billingCycle"],
    subscriptionStatus: ((row.subscription_status as string) || "inactive") as Infrastructure["subscriptionStatus"],
    renewalDate: String(row.renewal_date).slice(0, 10),
    storageUsedGb: Number(row.storage_used_gb),
    storageLimitGb: Number(row.storage_limit_gb),
    databaseStatus: row.database_status as Infrastructure["databaseStatus"],
    hostingStatus: row.hosting_status as Infrastructure["hostingStatus"],
    sslStatus: row.ssl_status as Infrastructure["sslStatus"],
    domain: row.domain as string,
  };
}

function mapUser(row: Record<string, unknown>): AppUser {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    phone: row.phone as string,
    avatarUrl: (row.avatar_url as string) ?? null,
  };
}

export async function getOrganization(orgId: string): Promise<Organization | null> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM organizations WHERE id = ${orgId}`;
  return rows[0] ? mapOrg(rows[0]) : null;
}

export async function getBusinessProfile(orgId: string): Promise<BusinessProfile | null> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM business_profiles WHERE organization_id = ${orgId}`;
  return rows[0] ? mapProfile(rows[0]) : null;
}

export async function updateBusinessProfile(
  orgId: string,
  patch: Pick<BusinessProfile, "displayName" | "phone" | "email" | "address" | "city" | "state">,
): Promise<BusinessProfile | null> {
  const sql = getSql();
  const rows = await sql`
    UPDATE business_profiles
    SET display_name = ${patch.displayName}, phone = ${patch.phone}, email = ${patch.email},
        address = ${patch.address}, city = ${patch.city}, state = ${patch.state}
    WHERE organization_id = ${orgId}
    RETURNING *
  `;
  return rows[0] ? mapProfile(rows[0]) : null;
}

/** True if `subdomain` isn't already taken by a different organization —
 * used for both the live-as-you-type check and the authoritative one right
 * before saving. */
export async function isSubdomainAvailable(subdomain: string, excludingOrgId: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    SELECT 1 FROM business_profiles WHERE subdomain = ${subdomain} AND organization_id <> ${excludingOrgId}
  `;
  return rows.length === 0;
}

export interface WebsiteSettingsPatch {
  subdomain: string;
  tagline: string;
  themeColor: string;
  logoUrl: string | null;
  coverPhotoUrl: string | null;
  published: boolean;
}

export async function updateWebsiteSettings(orgId: string, patch: WebsiteSettingsPatch): Promise<BusinessProfile | null> {
  const sql = getSql();
  const rows = await sql`
    UPDATE business_profiles
    SET subdomain = ${patch.subdomain}, tagline = ${patch.tagline}, theme_color = ${patch.themeColor},
        logo_url = ${patch.logoUrl}, cover_photo_url = ${patch.coverPhotoUrl}, published = ${patch.published}
    WHERE organization_id = ${orgId}
    RETURNING *
  `;
  return rows[0] ? mapProfile(rows[0]) : null;
}

/** The owner's email, for best-effort notifications (e.g. a new public
 * booking request) — returns '' rather than null when there's no email on
 * file, so callers can just check truthiness before sending. */
export async function getOwnerEmail(orgId: string): Promise<string> {
  const sql = getSql();
  const rows = await sql`
    SELECT email FROM organization_members WHERE organization_id = ${orgId} AND role = 'owner' LIMIT 1
  `;
  return (rows[0]?.email as string) ?? "";
}

export async function getInfrastructure(orgId: string): Promise<Infrastructure | null> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM infrastructure_accounts WHERE organization_id = ${orgId}`;
  return rows[0] ? mapInfra(rows[0]) : null;
}

export async function getUser(userId: string): Promise<AppUser | null> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM users WHERE id = ${userId}`;
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function updateAccount(userId: string, patch: { name: string; email: string; phone: string }): Promise<AppUser | null> {
  const sql = getSql();
  const rows = await sql`
    UPDATE users SET name = ${patch.name}, email = ${patch.email}, phone = ${patch.phone}
    WHERE id = ${userId}
    RETURNING *
  `;
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function setAvatar(userId: string, dataUrl: string | null): Promise<AppUser | null> {
  const sql = getSql();
  const rows = await sql`UPDATE users SET avatar_url = ${dataUrl} WHERE id = ${userId} RETURNING *`;
  return rows[0] ? mapUser(rows[0]) : null;
}

export interface UpcomingRenewal {
  organizationId: string;
  businessName: string;
  ownerEmail: string;
  renewalDate: string;
  priceKoboPerYear: number;
}

/**
 * Organizations with an *active, paid* Website & Hosting subscription that
 * renews in exactly `daysAhead` days — used by the renewal-reminder cron so
 * each one gets exactly one email per cycle rather than daily nagging every
 * day inside a "within N days" window. The trade-off: if the cron doesn't
 * run on that exact day, that org's reminder for this cycle is simply
 * missed rather than caught up later.
 *
 * Filtered to `subscription_status = 'active'` — every organization has an
 * `infrastructure_accounts` row from signup (whether or not they ever
 * subscribed to anything), so without this filter every business would get
 * a "your plan renews for ₦50,000" email regardless of whether they
 * actually have a subscription. Publishing on a *.jktl.com.ng subdomain is
 * free and unrelated to this — see `updateWebsiteSettingsAction`.
 */
export async function listUpcomingRenewals(daysAhead: number): Promise<UpcomingRenewal[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT bp.display_name, om.email AS owner_email, ia.organization_id, ia.renewal_date, ia.price_kobo_per_year
    FROM infrastructure_accounts ia
    JOIN business_profiles bp ON bp.organization_id = ia.organization_id
    JOIN organization_members om ON om.organization_id = ia.organization_id AND om.role = 'owner'
    WHERE ia.renewal_date = (CURRENT_DATE + (${daysAhead}::int * INTERVAL '1 day'))
      AND ia.subscription_status = 'active'
      AND om.email <> ''
  `;
  return rows.map((row) => ({
    organizationId: row.organization_id as string,
    businessName: row.display_name as string,
    ownerEmail: row.owner_email as string,
    renewalDate: String(row.renewal_date).slice(0, 10),
    priceKoboPerYear: Number(row.price_kobo_per_year),
  }));
}
