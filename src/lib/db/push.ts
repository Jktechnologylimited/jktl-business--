import "server-only";
import { getSql } from "./client";
import { kobo } from "./rows";

export interface NotificationPrefs {
  /** The master switch — off means nothing here ever sends, regardless of
   * the per-category toggles below. Turning it on is what the client pairs
   * with actually asking the browser for permission and subscribing. */
  pushEnabled: boolean;
  bookingNotifications: boolean;
  lowStockAlerts: boolean;
  invoicePaidAlerts: boolean;
  dailySummary: boolean;
  /** Downtime notices and promotions broadcast from the JKTL command
   * center — a separate opt-out from the operational categories above, on
   * by default (see migration 011). */
  platformAnnouncements: boolean;
}

// Matches what the old client-only toggles defaulted to (booking + low
// stock on, daily summary off) — nothing changes for an existing business
// until they actually turn push on for the first time.
const DEFAULT_PREFS: NotificationPrefs = {
  pushEnabled: false,
  bookingNotifications: true,
  lowStockAlerts: true,
  invoicePaidAlerts: true,
  dailySummary: false,
  platformAnnouncements: true,
};

function mapPrefs(row: Record<string, unknown> | undefined): NotificationPrefs {
  if (!row) return DEFAULT_PREFS;
  return {
    pushEnabled: Boolean(row.push_enabled),
    bookingNotifications: Boolean(row.booking_notifications),
    lowStockAlerts: Boolean(row.low_stock_alerts),
    invoicePaidAlerts: Boolean(row.invoice_paid_alerts),
    dailySummary: Boolean(row.daily_summary),
    // Defensive fallback: rows created before migration 011 won't have this
    // column yet — default true, same as a brand-new row (see DEFAULT_PREFS).
    platformAnnouncements: row.platform_announcements === undefined ? true : Boolean(row.platform_announcements),
  };
}

export async function getNotificationPrefs(orgId: string): Promise<NotificationPrefs> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM notification_preferences WHERE organization_id = ${orgId}`;
  return mapPrefs(rows[0]);
}

export async function updateNotificationPrefs(orgId: string, patch: Partial<NotificationPrefs>): Promise<NotificationPrefs> {
  const sql = getSql();
  const current = await getNotificationPrefs(orgId);
  const next = { ...current, ...patch };
  const rows = await sql`
    INSERT INTO notification_preferences (organization_id, push_enabled, booking_notifications, low_stock_alerts, invoice_paid_alerts, daily_summary, platform_announcements)
    VALUES (${orgId}, ${next.pushEnabled}, ${next.bookingNotifications}, ${next.lowStockAlerts}, ${next.invoicePaidAlerts}, ${next.dailySummary}, ${next.platformAnnouncements})
    ON CONFLICT (organization_id) DO UPDATE SET
      push_enabled = excluded.push_enabled,
      booking_notifications = excluded.booking_notifications,
      low_stock_alerts = excluded.low_stock_alerts,
      invoice_paid_alerts = excluded.invoice_paid_alerts,
      daily_summary = excluded.daily_summary,
      platform_announcements = excluded.platform_announcements
    RETURNING *
  `;
  return mapPrefs(rows[0]);
}

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Upsert by endpoint — a device re-subscribing (e.g. after clearing site
 * data) just replaces its own row rather than accumulating duplicates. */
export async function saveSubscription(orgId: string, sub: PushSubscriptionKeys): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO push_subscriptions (organization_id, endpoint, p256dh, auth)
    VALUES (${orgId}, ${sub.endpoint}, ${sub.p256dh}, ${sub.auth})
    ON CONFLICT (endpoint) DO UPDATE SET organization_id = excluded.organization_id, p256dh = excluded.p256dh, auth = excluded.auth
  `;
}

export async function removeSubscriptionByEndpoint(orgId: string, endpoint: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM push_subscriptions WHERE organization_id = ${orgId} AND endpoint = ${endpoint}`;
}

/** Used only by the push-sending layer when a push service reports a
 * subscription is gone (404/410) — no organization scoping needed since
 * `endpoint` is already globally unique. */
export async function removeSubscription(endpoint: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
}

export async function listSubscriptions(orgId: string): Promise<PushSubscriptionKeys[]> {
  const sql = getSql();
  const rows = await sql`SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE organization_id = ${orgId}`;
  return rows.map((r) => ({ endpoint: r.endpoint as string, p256dh: r.p256dh as string, auth: r.auth as string }));
}

export interface DailySummary {
  organizationId: string;
  bookingsCount: number;
  salesCount: number;
  revenueKobo: number;
  newCustomersCount: number;
}

/**
 * One row per business that has push + the daily summary both turned on,
 * with yesterday's counts already aggregated — used only by the
 * `/api/cron/daily-summary` route, which has no business session (it runs
 * unattended), so this is the one place besides the command center that
 * reads across every organization at once.
 */
export async function listDailySummaries(startIso: string, endIso: string): Promise<DailySummary[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      np.organization_id,
      (SELECT COUNT(*) FROM bookings b WHERE b.organization_id = np.organization_id AND b.created_at >= ${startIso} AND b.created_at < ${endIso}) AS bookings_count,
      (SELECT COUNT(*) FROM sales s WHERE s.organization_id = np.organization_id AND s.created_at >= ${startIso} AND s.created_at < ${endIso}) AS sales_count,
      (SELECT COALESCE(SUM(s2.total_kobo), 0) FROM sales s2 WHERE s2.organization_id = np.organization_id AND s2.created_at >= ${startIso} AND s2.created_at < ${endIso}) AS revenue_kobo,
      (SELECT COUNT(*) FROM customers c WHERE c.organization_id = np.organization_id AND c.created_at >= ${startIso} AND c.created_at < ${endIso}) AS new_customers_count
    FROM notification_preferences np
    WHERE np.push_enabled = true AND np.daily_summary = true
  `;
  return rows.map((r) => ({
    organizationId: r.organization_id as string,
    bookingsCount: Number(r.bookings_count ?? 0),
    salesCount: Number(r.sales_count ?? 0),
    revenueKobo: kobo((r.revenue_kobo as string) ?? 0),
    newCustomersCount: Number(r.new_customers_count ?? 0),
  }));
}

/**
 * Every subscribed device across every business that has push on and
 * hasn't opted out of platform announcements — used only by the command
 * center's broadcast feature (downtime notices, promotions), the one
 * other place besides the daily-summary cron that reads across every
 * organization's push subscriptions at once instead of a single business's.
 */
export async function listBroadcastSubscriptions(): Promise<PushSubscriptionKeys[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT ps.endpoint, ps.p256dh, ps.auth
    FROM push_subscriptions ps
    JOIN notification_preferences np ON np.organization_id = ps.organization_id
    WHERE np.push_enabled = true AND np.platform_announcements = true
  `;
  return rows.map((r) => ({ endpoint: r.endpoint as string, p256dh: r.p256dh as string, auth: r.auth as string }));
}
