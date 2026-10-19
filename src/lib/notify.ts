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

/* -------------------------------------------------------------------------- */
/* Money moving                                                               */
/* -------------------------------------------------------------------------- */

/**
 * A subscription month was collected automatically.
 *
 * Sent *after* the charge succeeded, and it says what was taken, for which
 * month, and when the next one is — a receipt, not a surprise. Silence after
 * an automatic debit is how a business ends up disputing a payment it did
 * authorise.
 */
export async function notifyChargeSucceeded(
  orgId: string,
  opts: { amountKobo: number; monthIndex: number; nextChargeAt: string },
): Promise<void> {
  try {
    const prefs = await getNotificationPrefs(orgId);
    if (!prefs.pushEnabled) return;
    await sendPush(orgId, {
      title: `${formatKobo(opts.amountKobo)} paid — month ${opts.monthIndex}`,
      body: `Your AI receptionist month ${opts.monthIndex} is settled. Next payment ${formatShortDate(opts.nextChargeAt)}. Receipt in Billing.`,
      url: "/business/receptionist",
    });
  } catch {
    // Best-effort.
  }
}

/**
 * Automatic collection failed.
 *
 * Deliberately loud and specific: the consequence of an unpaid month is that
 * the assistant stops answering calls, so this says what to do rather than
 * just reporting a status code.
 */
export async function notifyChargeFailed(
  orgId: string,
  opts: { amountKobo: number; monthIndex: number; error: string },
): Promise<void> {
  try {
    const prefs = await getNotificationPrefs(orgId);
    if (!prefs.pushEnabled) return;
    await sendPush(orgId, {
      title: "Payment didn't go through",
      body: `We couldn't collect ${formatKobo(opts.amountKobo)} for month ${opts.monthIndex}. Update your card in Billing to keep the assistant answering.`,
      url: "/business/receptionist",
    });
  } catch {
    // Best-effort.
  }
}

/**
 * The dedicated line could not be paid for from the communication wallet.
 *
 * Says what the line is and what happens if it stays unpaid, because "we
 * couldn't collect" on its own tells a clinic nothing about the consequence.
 */
export async function notifyLineRentalUnpaid(
  orgId: string,
  opts: { amountKobo: number; periodKey: string },
): Promise<void> {
  try {
    const prefs = await getNotificationPrefs(orgId);
    if (!prefs.pushEnabled) return;
    await sendPush(orgId, {
      title: "Top up to keep your business line",
      body: `Your dedicated number costs ${formatKobo(opts.amountKobo)} a month and the wallet couldn't cover it. Top up so calls keep reaching the assistant.`,
      url: "/business/receptionist",
    });
  } catch {
    // Best-effort.
  }
}

/** An invoice was emailed to a customer. Told to the business so they know the
 * request for money is actually out, and when. */
export async function notifyInvoiceSent(
  orgId: string,
  invoice: { number: string; totalKobo: number; customerName: string; dueDate: string },
): Promise<void> {
  try {
    const prefs = await getNotificationPrefs(orgId);
    if (!prefs.pushEnabled || !prefs.invoiceSentAlerts) return;
    await sendPush(orgId, {
      title: `Invoice #${invoice.number} sent`,
      body: `${formatKobo(invoice.totalKobo)} requested from ${invoice.customerName}. Due ${formatShortDate(invoice.dueDate)}.`,
      url: "/business/invoices",
    });
  } catch {
    // Best-effort.
  }
}

/**
 * A customer paid an invoice — the single notification a business most wants,
 * because it is money arriving without them doing anything. The body leads
 * with the amount and names the customer.
 */
export async function notifyPaymentReceived(
  orgId: string,
  payment: { amountKobo: number; customerName: string; invoiceNumber: string; method: string },
): Promise<void> {
  try {
    const prefs = await getNotificationPrefs(orgId);
    if (!prefs.pushEnabled || !prefs.invoicePaidAlerts) return;
    await sendPush(orgId, {
      title: `${formatKobo(payment.amountKobo)} received`,
      body: `${payment.customerName} paid invoice #${payment.invoiceNumber} by ${payment.method}.`,
      url: "/business/invoices",
    });
  } catch {
    // Best-effort.
  }
}

/**
 * A nudge: an automated prompt to finish setting something up.
 *
 * Uses its own preference switch (`payoutAlerts` doubles as the general
 * "setup tips" switch) so a business that doesn't want advice can turn it off
 * without losing the notifications about real events.
 */
export async function sendNudgePush(orgId: string, nudge: { title: string; body: string; url: string }): Promise<boolean> {
  try {
    const prefs = await getNotificationPrefs(orgId);
    // Only app users: the whole point of the nudge series is that it reaches a
    // phone, and someone who has not installed the app has no subscription to
    // send to anyway.
    if (!prefs.pushEnabled || !prefs.payoutAlerts) return false;
    await sendPush(orgId, { title: nudge.title, body: nudge.body, url: nudge.url });
    return true;
  } catch {
    return false;
  }
}
