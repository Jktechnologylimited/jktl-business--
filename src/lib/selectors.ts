import { endOfDay, isSameDay, isToday, isWithinInterval, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { STAFF } from "@/lib/mock";
import type { Booking, Customer, Invoice, Product, Sale, Service, TenantData } from "@/lib/types";

export type ReportRange = "today" | "week" | "month";

export function rangeInterval(range: ReportRange, now = new Date()): { start: Date; end: Date } {
  const end = endOfDay(now);
  if (range === "today") return { start: startOfDay(now), end };
  if (range === "week") return { start: startOfWeek(now, { weekStartsOn: 1 }), end };
  return { start: startOfMonth(now), end };
}

function within(dateIso: string, interval: { start: Date; end: Date }) {
  return isWithinInterval(new Date(dateIso), interval);
}

export function salesInRangeTotalKobo(sales: Sale[], range: ReportRange, now = new Date()): number {
  const interval = rangeInterval(range, now);
  return sales.filter((s) => within(s.createdAt, interval)).reduce((sum, s) => sum + s.totalKobo, 0);
}

export function expensesInRangeTotalKobo(expenses: TenantData["expenses"], range: ReportRange, now = new Date()): number {
  const interval = rangeInterval(range, now);
  return expenses.filter((e) => within(e.date, interval)).reduce((sum, e) => sum + e.amountKobo, 0);
}

export function bookingCountsInRange(bookings: Booking[], range: ReportRange, now = new Date()) {
  const interval = rangeInterval(range, now);
  const inRange = bookings.filter((b) => within(b.startsAt, interval));
  const counts: Record<Booking["status"], number> = { pending: 0, confirmed: 0, completed: 0, cancelled: 0, no_show: 0 };
  for (const b of inRange) counts[b.status] += 1;
  return { total: inRange.length, counts };
}

/** Top services in range, by number of completed bookings. */
export function topServicesInRange(
  bookings: Booking[],
  services: Service[],
  range: ReportRange,
  now = new Date(),
  limit = 5,
): Array<{ service: Service; count: number }> {
  const interval = rangeInterval(range, now);
  const counts = new Map<string, number>();
  for (const b of bookings) {
    if (b.status !== "completed" || !within(b.startsAt, interval)) continue;
    counts.set(b.serviceId, (counts.get(b.serviceId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([serviceId, count]) => ({ service: services.find((s) => s.id === serviceId)!, count }))
    .filter((row) => row.service)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Top products in range, by quantity sold (from sale line items). */
export function topProductsInRange(
  data: TenantData,
  range: ReportRange,
  now = new Date(),
  limit = 5,
): Array<{ product: Product; quantity: number }> {
  const interval = rangeInterval(range, now);
  const saleIdsInRange = new Set(data.sales.filter((s) => within(s.createdAt, interval)).map((s) => s.id));
  const qty = new Map<string, number>();
  for (const item of data.saleItems) {
    if (item.kind !== "product" || !saleIdsInRange.has(item.saleId)) continue;
    qty.set(item.refId, (qty.get(item.refId) ?? 0) + item.quantity);
  }
  return [...qty.entries()]
    .map(([productId, quantity]) => ({ product: data.products.find((p) => p.id === productId)!, quantity }))
    .filter((row) => row.product)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit);
}

export function customerName(customers: Customer[], id: string | null): string {
  if (!id) return "Walk-in";
  return customers.find((c) => c.id === id)?.name ?? "Unknown customer";
}

export function serviceName(services: Service[], id: string): string {
  return services.find((s) => s.id === id)?.name ?? "Unknown service";
}

export function staffName(id: string): string {
  return STAFF.find((s) => s.id === id)?.name ?? "Unassigned";
}

export function todaysBookings(bookings: Booking[], now = new Date()): Booking[] {
  return bookings
    .filter((b) => isSameDay(new Date(b.startsAt), now))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

export function upcomingBookings(bookings: Booking[], now = new Date(), limit = 5): Booking[] {
  return bookings
    .filter((b) => new Date(b.startsAt).getTime() > now.getTime() && !isSameDay(new Date(b.startsAt), now))
    .filter((b) => b.status === "confirmed" || b.status === "pending")
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .slice(0, limit);
}

export function todaysSales(sales: Sale[], now = new Date()): Sale[] {
  return sales.filter((s) => isToday(new Date(s.createdAt)) || isSameDay(new Date(s.createdAt), now));
}

export function todaysSalesTotalKobo(sales: Sale[], now = new Date()): number {
  return todaysSales(sales, now).reduce((sum, s) => sum + s.totalKobo, 0);
}

/** Unique customers with either a booking or a sale today. */
export function todaysCustomerCount(bookings: Booking[], sales: Sale[], now = new Date()): number {
  const ids = new Set<string>();
  for (const b of todaysBookings(bookings, now)) ids.add(b.customerId);
  for (const s of todaysSales(sales, now)) if (s.customerId) ids.add(s.customerId);
  return ids.size;
}

export function outstandingInvoices(invoices: Invoice[]): Invoice[] {
  return invoices.filter((i) => i.status === "pending" || i.status === "overdue");
}

export function outstandingTotalKobo(invoices: Invoice[]): number {
  return outstandingInvoices(invoices).reduce((sum, i) => sum + i.totalKobo, 0);
}

export function lowStockProducts(products: Product[]): Product[] {
  return products.filter((p) => p.stockQty <= p.lowStockThreshold);
}

/** Most-booked services today, most-booked first. */
export function popularServicesToday(
  bookings: Booking[],
  services: Service[],
  now = new Date(),
): Array<{ service: Service; count: number }> {
  const counts = new Map<string, number>();
  for (const b of todaysBookings(bookings, now)) {
    counts.set(b.serviceId, (counts.get(b.serviceId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([serviceId, count]) => ({ service: services.find((s) => s.id === serviceId)!, count }))
    .filter((row) => row.service)
    .sort((a, b) => b.count - a.count);
}

export type CustomerHistoryItem =
  | { kind: "booking"; id: string; at: string; label: string; status: Booking["status"]; priceKobo: number }
  | { kind: "sale"; id: string; at: string; label: string; totalKobo: number };

/** A customer's bookings + sales, most recent first — for their detail page. */
export function customerHistory(data: TenantData, customerId: string): CustomerHistoryItem[] {
  const items: CustomerHistoryItem[] = [
    ...data.bookings
      .filter((b) => b.customerId === customerId)
      .map((b): CustomerHistoryItem => ({
        kind: "booking",
        id: b.id,
        at: b.startsAt,
        label: serviceName(data.services, b.serviceId),
        status: b.status,
        priceKobo: b.priceKobo,
      })),
    ...data.sales
      .filter((s) => s.customerId === customerId)
      .map((s): CustomerHistoryItem => ({
        kind: "sale",
        id: s.id,
        at: s.createdAt,
        label: "Sale",
        totalKobo: s.totalKobo,
      })),
  ];
  return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export type ActivityItem =
  | { kind: "sale"; id: string; at: string; label: string; amountKobo: number }
  | { kind: "booking"; id: string; at: string; label: string; status: Booking["status"] }
  | { kind: "invoice"; id: string; at: string; label: string; amountKobo: number };

/** A merged, most-recent-first feed for the dashboard's "Recent activity". */
export function recentActivity(data: TenantData, limit = 6): ActivityItem[] {
  const items: ActivityItem[] = [
    ...data.sales.map((s): ActivityItem => ({
      kind: "sale",
      id: s.id,
      at: s.createdAt,
      label: `Sale to ${customerName(data.customers, s.customerId)}`,
      amountKobo: s.totalKobo,
    })),
    ...data.bookings
      .filter((b) => b.status === "completed" || b.status === "cancelled" || b.status === "no_show")
      .map((b): ActivityItem => ({
        kind: "booking",
        id: b.id,
        at: b.startsAt,
        label: `${serviceName(data.services, b.serviceId)} — ${customerName(data.customers, b.customerId)}`,
        status: b.status,
      })),
    ...data.invoices
      .filter((i) => i.paidAt)
      .map((i): ActivityItem => ({
        kind: "invoice",
        id: i.id,
        at: i.paidAt as string,
        label: `Invoice ${i.number} paid`,
        amountKobo: i.totalKobo,
      })),
  ];
  return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, limit);
}
