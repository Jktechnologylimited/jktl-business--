import "server-only";
import { getSql } from "./client";
import { kobo } from "./rows";
import type { BusinessProfile, Product, Service } from "@/lib/types";

/**
 * Reads for the public, unauthenticated business-website surface only.
 * Kept in its own module — deliberately separate from every other db/ file —
 * because these functions are the one place in the app that resolve a
 * tenant from something a random visitor typed (a subdomain), not from
 * `requireSession()`. Nothing here trusts a client-supplied organizationId;
 * callers only ever get one back from a subdomain lookup.
 */

function mapProfile(row: Record<string, unknown>): BusinessProfile {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    businessType: row.business_type as BusinessProfile["businessType"],
    displayName: row.display_name as string,
    phone: row.phone as string,
    email: row.email as string,
    address: row.address as string,
    city: row.city as string,
    state: row.state as string,
    logoUrl: (row.logo_url as string) ?? null,
    subdomain: row.subdomain as string,
    published: row.published as boolean,
    tagline: row.tagline as string,
    themeColor: row.theme_color as string,
  };
}

function mapService(row: Record<string, unknown>): Service {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    name: row.name as string,
    category: row.category as string,
    priceKobo: kobo(row.price_kobo as string),
    durationMin: Number(row.duration_min),
    description: row.description as string,
    active: row.active as boolean,
  };
}

function mapProduct(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    name: row.name as string,
    sku: row.sku as string,
    category: row.category as string,
    costKobo: kobo(row.cost_kobo as string),
    priceKobo: kobo(row.price_kobo as string),
    stockQty: Number(row.stock_qty),
    lowStockThreshold: Number(row.low_stock_threshold),
    supplier: row.supplier as string,
    active: row.active as boolean,
  };
}

export interface PublicSite {
  profile: BusinessProfile;
  services: Service[];
  products: Product[];
}

/** Returns the full public site for a subdomain — only when that business
 * has actually published it. Returns null for an unknown subdomain or one
 * that hasn't published yet, without distinguishing the two (a visitor
 * shouldn't be able to tell which). */
export async function getPublicSiteBySubdomain(subdomain: string): Promise<PublicSite | null> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM business_profiles WHERE subdomain = ${subdomain} AND published = true`;
  if (!rows[0]) return null;
  const profile = mapProfile(rows[0]);

  const [serviceRows, productRows] = await Promise.all([
    sql`SELECT * FROM services WHERE organization_id = ${profile.organizationId} AND active = true ORDER BY category, name`,
    sql`SELECT * FROM products WHERE organization_id = ${profile.organizationId} AND active = true ORDER BY category, name`,
  ]);

  return { profile, services: serviceRows.map(mapService), products: productRows.map(mapProduct) };
}

/**
 * Resolves a subdomain to an organization id regardless of published state.
 * Used only for accepting a booking — a business owner should be able to
 * test their own booking flow before flipping the site live, and `published`
 * is purely a visibility switch for the page, not a security boundary. A
 * booking still can't happen against a subdomain that doesn't exist at all.
 */
export async function getOrganizationIdBySubdomain(subdomain: string): Promise<string | null> {
  const sql = getSql();
  const rows = await sql`SELECT organization_id FROM business_profiles WHERE subdomain = ${subdomain}`;
  return rows[0] ? (rows[0].organization_id as string) : null;
}
