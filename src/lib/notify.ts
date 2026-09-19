import "server-only";
import { getNotificationPrefs } from "@/lib/db/push";
import { sendPush } from "@/lib/push";
import { formatKobo, formatShortDate, formatTime } from "@/lib/format";

/**
 * The semantic layer between an action (a booking got created, a product's
 * stock dropped, an invoice got paid) and the raw push sender — checks the
 * business's own notification preferences first, and is always best-effort:
 * every function here swallows its own errors so a notification failure
 * can never affect the mutation that triggered it, same principle as the
 * email senders in src/lib/email.ts.
 */

export async function notifyNewBooking(
  orgId: string,
  opts: { customerName: string; serviceName: string; startsAt: string },
): Promise<void> {
  try {
    const prefs = await getNotificationPrefs(orgId);
    if (!prefs.pushEnabled || !prefs.bookingNotifications) return;
    await sendPush(orgId, {
      title: "New booking",
      body: `${opts.customerName || "A customer"} booked ${opts.serviceName} — ${formatShortDate(opts.startsAt)} ${formatTime(opts.startsAt)}`,
      url: "/business/bookings",
    });
  } catch {
    // Best-effort — never let this affect the booking itself.
  }
}

export async function notifyLowStock(orgId: string, product: { name: string; stockQty: number }): Promise<void> {
  try {
    const prefs = await getNotificationPrefs(orgId);
    if (!prefs.pushEnabled || !prefs.lowStockAlerts) return;
    await sendPush(orgId, {
      title: "Low stock",
      body: product.stockQty <= 0 ? `${product.name} is out of stock` : `${product.name} is down to ${product.stockQty} left`,
      url: "/business/inventory",
    });
  } catch {
    // Best-effort.
  }
}

export async function notifyInvoicePaid(orgId: string, invoice: { number: string; totalKobo: number }): Promise<void> {
  try {
    const prefs = await getNotificationPrefs(orgId);
    if (!prefs.pushEnabled || !prefs.invoicePaidAlerts) return;
    await sendPush(orgId, {
      title: "Invoice paid",
      body: `Invoice #${invoice.number} — ${formatKobo(invoice.totalKobo)} received`,
      url: "/business/invoices",
    });
  } catch {
    // Best-effort.
  }
}

/**
 * Fires only when stock crosses INTO the low-stock band (was above the
 * threshold, is now at or below it) — not on every sale/adjustment while
 * it stays there, so a slow-moving low-stock item doesn't spam a push on
 * every single unit sold.
 */
export function crossedIntoLowStock(previousQty: number, previousThreshold: number, nextQty: number, nextThreshold: number): boolean {
  return previousQty > previousThreshold && nextQty <= nextThreshold;
}
