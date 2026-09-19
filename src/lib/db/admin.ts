import "server-only";
import { getSql } from "./client";
import { kobo, isoDate } from "./rows";

/**
 * Reads for the JKTL command center only — every other db/ module scopes
 * its queries to a single `organizationId` from a business's own session
 * (see `requireSession()`); this is deliberately the one place in the app
 * that reads *across* every organization at once, gated by
 * `requireAdminSession()` in `src/lib/admin-session.ts` instead.
 *
 * Account-level only, on purpose: this returns counts and aggregates
 * (how many customers, how much revenue, when they were last active) but
 * never an actual customer, booking or sale row. A business's operational
 * records stay inside that business's own dashboard.
 */

export interface AdminBusinessRow {
  organizationId: string;
  organizationName: string;
  displayName: string;
  businessType: string;
  subdomain: string;
  published: boolean;
  customDomain: string;
  customDomainVerified: boolean;
  planName: string;
  subscriptionStatus: "inactive" | "active" | "past_due" | "canceled";
  billingCycle: string;
  renewalDate: string | null;
  storageUsedBytes: number;
  storageLimitBytes: number;
  customersCount: number;
  servicesCount: number;
  productsCount: number;
  bookingsCount: number;
  salesCount: number;
  totalRevenueKobo: number;
  createdAt: string;
  /** Most recent booking or sale timestamp for this business — an activity
   * signal, not a peek at the record itself. Null if they've never
   * recorded either. */
  lastActiveAt: string | null;
}

function mapRow(row: Record<string, unknown>): AdminBusinessRow {
  return {
    organizationId: row.organization_id as string,
    organizationName: row.organization_name as string,
    displayName: row.display_name as string,
    businessType: row.business_type as string,
    subdomain: row.subdomain as string,
    published: Boolean(row.published),
    customDomain: (row.custom_domain as string) ?? "",
    customDomainVerified: Boolean(row.custom_domain_verified),
    planName: (row.plan_name as string) ?? "",
    subscriptionStatus: ((row.subscription_status as string) || "inactive") as AdminBusinessRow["subscriptionStatus"],
    billingCycle: (row.billing_cycle as string) || "yearly",
    renewalDate: row.renewal_date ? isoDate(row.renewal_date as string) : null,
    storageUsedBytes: Number(row.storage_used_bytes ?? 0),
    storageLimitBytes: Number(row.storage_limit_bytes ?? 0),
    customersCount: Number(row.customers_count ?? 0),
    servicesCount: Number(row.services_count ?? 0),
    productsCount: Number(row.products_count ?? 0),
    bookingsCount: Number(row.bookings_count ?? 0),
    salesCount: Number(row.sales_count ?? 0),
    totalRevenueKobo: kobo((row.total_revenue_kobo as string) ?? 0),
    createdAt: isoDate(row.org_created_at as string),
    lastActiveAt: row.last_active_at ? isoDate(row.last_active_at as string) : null,
  };
}

export async function listBusinessesForAdmin(): Promise<AdminBusinessRow[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      o.id AS organization_id,
      o.name AS organization_name,
      o.created_at AS org_created_at,
      bp.display_name,
      bp.business_type,
      bp.subdomain,
      bp.published,
      bp.custom_domain,
      bp.custom_domain_verified,
      ia.plan_name,
      ia.subscription_status,
      ia.billing_cycle,
      ia.renewal_date,
      ia.storage_used_bytes,
      ia.storage_limit_bytes,
      (SELECT COUNT(*) FROM customers c WHERE c.organization_id = o.id) AS customers_count,
      (SELECT COUNT(*) FROM services s WHERE s.organization_id = o.id) AS services_count,
      (SELECT COUNT(*) FROM products p WHERE p.organization_id = o.id) AS products_count,
      (SELECT COUNT(*) FROM bookings b WHERE b.organization_id = o.id) AS bookings_count,
      (SELECT COUNT(*) FROM sales sl WHERE sl.organization_id = o.id) AS sales_count,
      (SELECT COALESCE(SUM(sl2.total_kobo), 0) FROM sales sl2 WHERE sl2.organization_id = o.id) AS total_revenue_kobo,
      GREATEST(
        (SELECT MAX(b2.created_at) FROM bookings b2 WHERE b2.organization_id = o.id),
        (SELECT MAX(sl3.created_at) FROM sales sl3 WHERE sl3.organization_id = o.id)
      ) AS last_active_at
    FROM organizations o
    JOIN business_profiles bp ON bp.organization_id = o.id
    LEFT JOIN infrastructure_accounts ia ON ia.organization_id = o.id
    ORDER BY o.created_at DESC
  `;
  return rows.map(mapRow);
}

export interface AdminOverview {
  totalBusinesses: number;
  publishedCount: number;
  activeSubscriptions: number;
  totalStorageUsedBytes: number;
  totalRevenueKobo: number;
}

export function summarize(businesses: AdminBusinessRow[]): AdminOverview {
  return {
    totalBusinesses: businesses.length,
    publishedCount: businesses.filter((b) => b.published).length,
    activeSubscriptions: businesses.filter((b) => b.subscriptionStatus === "active").length,
    totalStorageUsedBytes: businesses.reduce((sum, b) => sum + b.storageUsedBytes, 0),
    totalRevenueKobo: businesses.reduce((sum, b) => sum + b.totalRevenueKobo, 0),
  };
}

/**
 * Downtime notices, promotions, and other platform-wide push
 * announcements sent from the command center — see
 * src/lib/actions/admin-actions.ts's sendBroadcastAction for where these
 * actually get sent, and src/lib/db/push.ts's listBroadcastSubscriptions
 * for who receives them. This table is just the admin's own send history;
 * no business account can see or query it.
 */
export interface AdminBroadcast {
  id: string;
  category: string;
  title: string;
  body: string;
  url: string;
  recipientCount: number;
  createdAt: string;
}

function mapBroadcast(row: Record<string, unknown>): AdminBroadcast {
  return {
    id: row.id as string,
    category: row.category as string,
    title: row.title as string,
    body: row.body as string,
    url: (row.url as string) ?? "",
    recipientCount: Number(row.recipient_count ?? 0),
    createdAt: isoDate(row.created_at as string),
  };
}

export async function recordBroadcast(
  adminUserId: string,
  input: { category: string; title: string; body: string; url: string; recipientCount: number },
): Promise<AdminBroadcast> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO admin_broadcasts (admin_user_id, category, title, body, url, recipient_count)
    VALUES (${adminUserId}, ${input.category}, ${input.title}, ${input.body}, ${input.url}, ${input.recipientCount})
    RETURNING *
  `;
  return mapBroadcast(rows[0]);
}

export async function listBroadcasts(): Promise<AdminBroadcast[]> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM admin_broadcasts ORDER BY created_at DESC LIMIT 50`;
  return rows.map(mapBroadcast);
}
