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
    subdomain: row.subdomain as string,
  };
}

function mapInfra(row: Record<string, unknown>): Infrastructure {
  return {
    organizationId: row.organization_id as string,
    planName: row.plan_name as string,
    priceKoboPerYear: Number(row.price_kobo_per_year),
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
