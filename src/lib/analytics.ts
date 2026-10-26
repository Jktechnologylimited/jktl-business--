/**
 * Analytics for the business dashboard: the questions an SME owner actually
 * asks, answered as plain arithmetic.
 *
 * Deliberately **dependency-free at runtime** — the only import below is
 * type-only, which Node erases when it strips types, so `node --test` can
 * import this file directly (see `tests/analytics.test.mjs`). Anything this
 * file needs (date bucketing, date-fns-style `subDays`/`startOfWeek`) is
 * written here rather than pulled in, because a single runtime import would
 * make the whole module untestable under the test runner.
 *
 * Two rules hold everywhere in here:
 *   1. `now: Date` is always a parameter, never `Date.now()` — the results are
 *      deterministic and a test can pin a fixed "today".
 *   2. Every division is guarded and every function tolerates empty input,
 *      returning zeros/empty arrays rather than `NaN`. A brand-new business
 *      with no sales must render the same page a busy one does, minus data.
 *
 * Money stays in integer kobo throughout, as everywhere else in this app —
 * see the `Kobo` type in `types.ts`. Percentages are rounded to one decimal
 * place here and formatted for display by the components.
 */

import type { Booking, Customer, Expense, Invoice, PaymentMethod, Product, Sale, SaleItem, Service } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Small internals — kept private so the public surface stays a list    */
/* of business questions rather than helpers.                          */
/* ------------------------------------------------------------------ */

const MS_PER_DAY = 86_400_000;

/**
 * The business's local calendar date as YYYY-MM-DD.
 *
 * Local, not UTC, on purpose. An owner in Lagos reading "yesterday" at 12:30am
 * means the calendar day that just ended on their wall clock, not the UTC one —
 * which is still the previous day at that hour. Everything that buckets by day
 * (revenue trend, ageing, profit-and-loss months) goes through here so they all
 * agree on what a "day" is.
 */
function dayKey(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Midnight local, as an instant. */
function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

/**
 * Whole days between two instants, calendar-wise, rounded rather than
 * floored so a late-evening timestamp compared against a midnight "now"
 * doesn't read as two days old instead of one.
 */
function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

/** True when `value` falls within the last `days` days ending on `now`. */
function withinDays(value: string | Date, now: Date, days: number): boolean {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const diff = daysBetween(d, now);
  return diff >= 0 && diff < days;
}

/** `value` with `n` whole days subtracted, in local time. */
function subDays(value: Date, n: number): Date {
  const d = new Date(value.getTime());
  d.setDate(d.getDate() - n);
  return d;
}

/** Monday at midnight for the week containing `value` (Nigeria weeks start Monday). */
function startOfWeek(value: Date): Date {
  const d = startOfDay(value);
  // getDay(): 0 = Sunday. Shift Sunday to -1 so Monday is always day 1.
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return d;
}

/** First of the month at midnight. */
function startOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function sum(list: number[]): number {
  let total = 0;
  for (const n of list) total += n;
  return total;
}

/** Percentage of `part` in `whole`, guarded, rounded to one decimal. */
function pct(part: number, whole: number): number {
  if (!Number.isFinite(whole) || whole <= 0 || !Number.isFinite(part)) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

/** Clamp to 0–100 and round — for every health-score component. */
function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-NG", { month: "short", year: "numeric" });
}

function shortWeekLabel(d: Date): string {
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

/**
 * Distinguishes "no data to judge" from "genuinely bad". A component with no
 * denominator (no invoices, no revenue, no bookings) sits at 50 — neutral —
 * so a brand-new business isn't told it has a failed collection rate on day
 * one, but also isn't handed a perfect score.
 */
const NO_SIGNAL_SCORE = 50;

const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  transfer: "Transfer",
  pos: "POS",
  other: "Other",
};

/** Fixed order, so the mix chart/table doesn't reshuffle between renders. */
const PAYMENT_METHODS: PaymentMethod[] = ["cash", "transfer", "pos", "other"];

const BOOKING_STATUSES: Booking["status"][] = ["pending", "confirmed", "completed", "cancelled", "no_show"];

const EXPENSE_CATEGORY_LABEL: Record<Expense["category"], string> = {
  rent: "Rent",
  electricity: "Electricity",
  staff: "Team",
  supplies: "Supplies",
  transportation: "Transportation",
  marketing: "Marketing",
  other: "Other",
};

type Direction = "up" | "down" | "flat";

/** A customer counts as a visit when they bought *or* actually showed up. */
function isVisit(booking: Booking): boolean {
  return booking.status === "completed";
}

/* ------------------------------------------------------------------ */
/* Revenue                                                             */
/* ------------------------------------------------------------------ */

export interface RevenuePoint {
  /** YYYY-MM-DD — the bucket this day represents (UTC, matches ISO timestamps). */
  date: string;
  /** Short, human label for a chart axis, e.g. "5 Sep". */
  label: string;
  revenueKobo: number;
  /** How many sales landed in this day. Useful for "₦0 from 0 sales" copy. */
  salesCount: number;
}

/**
 * Revenue per calendar day for the last `days` days, oldest first, including
 * today as the final point. Days with no sales are present with zeros rather
 * than dropped — a chart with gaps lies about a quiet Tuesday.
 */
export function revenueTrend(sales: Sale[], now: Date, days: number): RevenuePoint[] {
  const span = Math.max(0, Math.floor(days));
  const buckets: RevenuePoint[] = [];
  const byDay = new Map<string, RevenuePoint>();

  for (let i = span - 1; i >= 0; i -= 1) {
    const d = subDays(startOfDay(now), i);
    const point: RevenuePoint = { date: dayKey(d), label: d.toLocaleDateString("en-NG", { day: "numeric", month: "short" }), revenueKobo: 0, salesCount: 0 };
    buckets.push(point);
    byDay.set(point.date, point);
  }

  for (const sale of sales) {
    const point = byDay.get(dayKey(sale.createdAt));
    if (!point) continue;
    point.revenueKobo += sale.totalKobo;
    point.salesCount += 1;
  }

  return buckets;
}

export interface WeeklyRevenuePoint {
  weekStart: string;
  label: string;
  revenueKobo: number;
  salesCount: number;
}

/**
 * Revenue by Monday-starting week, oldest first, for the `weeks` weeks up to
 * and including the week `now` falls in. Weeks are the right grain for a
 * salon: rent and wages are monthly, but takings are read weekly.
 */
export function revenueByWeek(sales: Sale[], now: Date, weeks: number): WeeklyRevenuePoint[] {
  const span = Math.max(0, Math.floor(weeks));
  const buckets: WeeklyRevenuePoint[] = [];
  const byWeek = new Map<string, WeeklyRevenuePoint>();
  const thisWeek = startOfWeek(now);

  for (let i = span - 1; i >= 0; i -= 1) {
    const start = subDays(thisWeek, i * 7);
    const point: WeeklyRevenuePoint = { weekStart: dayKey(start), label: shortWeekLabel(start), revenueKobo: 0, salesCount: 0 };
    buckets.push(point);
    byWeek.set(point.weekStart, point);
  }

  for (const sale of sales) {
    const createdAt = new Date(sale.createdAt);
    if (Number.isNaN(createdAt.getTime())) continue;
    const point = byWeek.get(dayKey(startOfWeek(createdAt)));
    if (!point) continue;
    point.revenueKobo += sale.totalKobo;
    point.salesCount += 1;
  }

  return buckets;
}

export interface ChangeSummary {
  priorKobo: number;
  currentKobo: number;
  changeKobo: number;
  /** Signed percentage, one decimal. 0 when there is no prior period to compare. */
  changePct: number;
  direction: Direction;
}

/**
 * Period-over-period change, e.g. this month against last. When the prior
 * period was zero, a percentage is mathematically undefined (and "∞%" is
 * useless on a dashboard), so `changePct` is 0 and `direction` still reports
 * the honest answer — grew from nothing, or nothing at all.
 */
export function monthOverMonth(now: Date, prior: number, current: number): ChangeSummary {
  void now; // accepted for a stable signature; the math needs no clock
  const changeKobo = current - prior;
  const changePct = prior > 0 ? round2((changeKobo / prior) * 100) : 0;
  const direction: Direction = changeKobo > 0 ? "up" : changeKobo < 0 ? "down" : "flat";
  return { priorKobo: prior, currentKobo: current, changeKobo, changePct, direction };
}

/* ------------------------------------------------------------------ */
/* Payments                                                            */
/* ------------------------------------------------------------------ */

export interface PaymentMixSlice {
  method: PaymentMethod;
  label: string;
  totalKobo: number;
  count: number;
  /** Share of the period's revenue, one decimal. */
  sharePct: number;
}

/**
 * How the money actually arrived, split by payment method. Only methods with
 * at least one sale are returned, so a salon that never takes POS doesn't
 * carry an empty "POS 0%" row forever.
 */
export function paymentMethodMix(sales: Sale[]): PaymentMixSlice[] {
  const totals = new Map<PaymentMethod, { totalKobo: number; count: number }>();
  for (const method of PAYMENT_METHODS) totals.set(method, { totalKobo: 0, count: 0 });

  for (const sale of sales) {
    const bucket = totals.get(sale.paymentMethod);
    if (!bucket) continue;
    bucket.totalKobo += sale.totalKobo;
    bucket.count += 1;
  }

  const grandTotal = sum([...totals.values()].map((b) => b.totalKobo));

  return PAYMENT_METHODS.map((method) => {
    const bucket = totals.get(method) as { totalKobo: number; count: number };
    return { method, label: PAYMENT_METHOD_LABEL[method], totalKobo: bucket.totalKobo, count: bucket.count, sharePct: pct(bucket.totalKobo, grandTotal) };
  }).filter((slice) => slice.count > 0);
}

/** The four ageing buckets, in the order an owner chases them. */
export type AgeingBucketKey = "current" | "days1to30" | "days31to60" | "days61plus";

export interface AgeingBucket {
  key: AgeingBucketKey;
  label: string;
  amountKobo: number;
  count: number;
}

export interface OutstandingSummary {
  totalKobo: number;
  count: number;
  /** The single largest debt, for "who do I call first". */
  largestKobo: number;
  /** Share of unpaid invoices that are already past their due date. */
  overduePct: number;
  ageing: AgeingBucket[];
}

/**
 * What customers still owe, aged by how long it's been since each invoice was
 * due. This is the number owners chase, so the buckets are the point: ₦40k
 * three days late is a phone call, ₦40k at 70 days is a decision.
 *
 * Only `pending` and `overdue` invoices count as owed — `draft` hasn't been
 * sent to anyone and `paid` is settled. A due date in the future (or today)
 * is "Current"; nothing is overdue before its due date, however long it sat
 * as `pending`.
 */
export function outstandingSummary(invoices: Invoice[], now: Date): OutstandingSummary {
  const buckets: Record<AgeingBucketKey, AgeingBucket> = {
    current: { key: "current", label: "Current", amountKobo: 0, count: 0 },
    days1to30: { key: "days1to30", label: "1–30 days", amountKobo: 0, count: 0 },
    days31to60: { key: "days31to60", label: "31–60 days", amountKobo: 0, count: 0 },
    days61plus: { key: "days61plus", label: "60+ days", amountKobo: 0, count: 0 },
  };
  const ordered: AgeingBucket[] = [buckets.current, buckets.days1to30, buckets.days31to60, buckets.days61plus];

  let totalKobo = 0;
  let count = 0;
  let largestKobo = 0;
  let overdueCount = 0;

  for (const invoice of invoices) {
    if (invoice.status !== "pending" && invoice.status !== "overdue") continue;
    const amount = Math.max(0, invoice.totalKobo);
    const overdueDays = daysBetween(new Date(invoice.dueDate), now);

    // Bounds are half-open so an invoice is only ever counted once: a 31-day
    // invoice is in 31–60, not both. Invalid/missing due dates age as current
    // (nothing has proven them late).
    let bucket: AgeingBucket;
    if (!Number.isFinite(overdueDays) || overdueDays <= 0) bucket = buckets.current;
    else if (overdueDays <= 30) bucket = buckets.days1to30;
    else if (overdueDays <= 60) bucket = buckets.days31to60;
    else bucket = buckets.days61plus;

    bucket.amountKobo += amount;
    bucket.count += 1;
    totalKobo += amount;
    count += 1;
    if (amount > largestKobo) largestKobo = amount;
    if (overdueDays > 0) overdueCount += 1;
  }

  return { totalKobo, count, largestKobo, overduePct: pct(overdueCount, count), ageing: ordered };
}

/* ------------------------------------------------------------------ */
/* Bookings                                                            */
/* ------------------------------------------------------------------ */

export interface BookingStatusSlice {
  status: Booking["status"];
  label: string;
  count: number;
  sharePct: number;
}

const BOOKING_STATUS_LABEL: Record<Booking["status"], string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

/** Booking counts by status, with each status's share of the total. */
export function bookingStatusMix(bookings: Booking[]): BookingStatusSlice[] {
  const counts = new Map<Booking["status"], number>();
  for (const status of BOOKING_STATUSES) counts.set(status, 0);
  for (const booking of bookings) counts.set(booking.status, (counts.get(booking.status) ?? 0) + 1);

  const total = bookings.length;
  return BOOKING_STATUSES.map((status) => ({ status, label: BOOKING_STATUS_LABEL[status], count: counts.get(status) ?? 0, sharePct: pct(counts.get(status) ?? 0, total) })).filter((slice) => slice.count > 0);
}

export interface NoShowRate {
  /** no-shows ÷ (completed + no-shows), as a percentage. */
  ratePct: number;
  noShowCount: number;
  completedCount: number;
  /** The denominator the rate is built on. */
  resolvedCount: number;
}

/**
 * No-show rate.
 *
 * Deliberately measured over *resolved* bookings only — completed plus
 * no-show. `cancelled` bookings are excluded because a customer who called
 * ahead to cancel did the business a favour and must not be scored as a
 * no-show; counting them would inflate the rate and punish the exact
 * behaviour the reminder SMS is trying to encourage. `pending` and
 * `confirmed` are excluded because their outcome isn't known yet, and a
 * booking that hasn't happened cannot be a no-show.
 */
export function noShowRate(bookings: Booking[]): NoShowRate {
  let noShowCount = 0;
  let completedCount = 0;
  for (const booking of bookings) {
    if (booking.status === "no_show") noShowCount += 1;
    else if (booking.status === "completed") completedCount += 1;
  }
  const resolvedCount = noShowCount + completedCount;
  return { ratePct: pct(noShowCount, resolvedCount), noShowCount, completedCount, resolvedCount };
}

export interface HourBucket {
  /** 0–23, local time. */
  hour: number;
  label: string;
  count: number;
}

function hourLabel(hour: number): string {
  const suffix = hour < 12 ? "am" : "pm";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}${suffix}`;
}

/**
 * Bookings by hour of day, busiest first. Hours with no bookings are dropped
 * (an all-zero 24-row list is noise); the caller shows an empty state when
 * the result is empty.
 */
export function peakHours(bookings: Booking[]): HourBucket[] {
  const counts = new Array<number>(24).fill(0);
  for (const booking of bookings) {
    const d = new Date(booking.startsAt);
    if (Number.isNaN(d.getTime())) continue;
    const hour = d.getHours();
    if (hour < 0 || hour > 23) continue;
    counts[hour] += 1;
  }

  const buckets: HourBucket[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    if (counts[hour] === 0) continue;
    buckets.push({ hour, label: hourLabel(hour), count: counts[hour] });
  }
  // Busiest first, then earliest — a stable order so equal hours don't jitter.
  return buckets.sort((a, b) => b.count - a.count || a.hour - b.hour);
}

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface DayBucket {
  /** 0 = Sunday … 6 = Saturday, local time. */
  weekday: number;
  label: string;
  count: number;
}

/** Bookings by day of week, busiest first. */
export function busiestDays(bookings: Booking[]): DayBucket[] {
  const counts = new Array<number>(7).fill(0);
  for (const booking of bookings) {
    const d = new Date(booking.startsAt);
    if (Number.isNaN(d.getTime())) continue;
    counts[d.getDay()] += 1;
  }

  const buckets: DayBucket[] = [];
  for (let weekday = 0; weekday < 7; weekday += 1) {
    if (counts[weekday] === 0) continue;
    buckets.push({ weekday, label: WEEKDAY_LABELS[weekday], count: counts[weekday] });
  }
  return buckets.sort((a, b) => b.count - a.count || a.weekday - b.weekday);
}

/* ------------------------------------------------------------------ */
/* Customers                                                           */
/* ------------------------------------------------------------------ */

export interface NewVsReturning {
  newCount: number;
  returningCount: number;
  /** Share of the period's active customers who had been seen before. */
  returningPct: number;
}

/**
 * For customers active in the window: "new" if their first-ever appearance
 * (account created *or* first purchase/booking) falls inside the window,
 * "returning" if they were already coming before it. A customer with no
 * activity in the window isn't counted at all — this measures the mix of
 * this week's footfall, not the whole customer book.
 */
export function newVsReturning(customers: Customer[], sales: Sale[], bookings: Booking[], now: Date, days: number): NewVsReturning {
  const firstSeen = new Map<string, number>();

  const note = (customerId: string | null | undefined, at: string) => {
    if (!customerId) return; // walk-ins have no identity to return with
    const time = new Date(at).getTime();
    if (Number.isNaN(time)) return;
    const existing = firstSeen.get(customerId);
    if (existing === undefined || time < existing) firstSeen.set(customerId, time);
  };

  for (const customer of customers) note(customer.id, customer.createdAt);
  for (const sale of sales) note(sale.customerId, sale.createdAt);
  for (const booking of bookings) note(booking.customerId, booking.startsAt);

  const active = new Set<string>();
  for (const sale of sales) if (sale.customerId && withinDays(sale.createdAt, now, days)) active.add(sale.customerId);
  // Only resolved bookings count as a visit; a pending booking is an intention.
  for (const booking of bookings) if (withinDays(booking.startsAt, now, days) && isVisit(booking)) active.add(booking.customerId);

  const windowStart = subDays(startOfDay(now), Math.max(0, days) - 1).getTime();
  let newCount = 0;
  let returningCount = 0;
  for (const customerId of active) {
    const first = firstSeen.get(customerId);
    if (first === undefined) {
      // Active but unknown (e.g. a booking whose customer row was deleted) —
      // treat as new rather than dropping them from the mix entirely.
      newCount += 1;
    } else if (first >= windowStart) {
      newCount += 1;
    } else {
      returningCount += 1;
    }
  }

  return { newCount, returningCount, returningPct: pct(returningCount, newCount + returningCount) };
}

export interface TopCustomer {
  customerId: string;
  name: string;
  totalKobo: number;
  purchaseCount: number;
  /** Average per purchase, for spotting the big-ticket regular. */
  averageKobo: number;
}

/**
 * Best customers by total spend, largest first. Walk-in sales (no customer id)
 * are excluded — there is no one to name — and customers whose row has since
 * been deleted are labelled "Unknown customer" rather than dropped, so the
 * revenue total still adds up.
 */
export function topCustomers(sales: Sale[], customers: Customer[], limit = 5): TopCustomer[] {
  const byCustomer = new Map<string, { totalKobo: number; purchaseCount: number }>();

  for (const sale of sales) {
    if (!sale.customerId) continue;
    const bucket = byCustomer.get(sale.customerId) ?? { totalKobo: 0, purchaseCount: 0 };
    bucket.totalKobo += sale.totalKobo;
    bucket.purchaseCount += 1;
    byCustomer.set(sale.customerId, bucket);
  }

  const rows: TopCustomer[] = [...byCustomer.entries()].map(([customerId, bucket]) => ({
    customerId,
    name: customers.find((c) => c.id === customerId)?.name ?? "Unknown customer",
    totalKobo: bucket.totalKobo,
    purchaseCount: bucket.purchaseCount,
    averageKobo: bucket.purchaseCount > 0 ? Math.round(bucket.totalKobo / bucket.purchaseCount) : 0,
  }));

  return rows.sort((a, b) => b.totalKobo - a.totalKobo || b.purchaseCount - a.purchaseCount).slice(0, Math.max(0, limit));
}

export interface LifetimeValue {
  /** Total revenue attributed to customer-identified sales. */
  totalKobo: number;
  /** Customers with at least one purchase — the denominator. */
  customerCount: number;
  averageKobo: number;
  /** Average number of purchases per buying customer. */
  averagePurchases: number;
  topCustomerKobo: number;
}

/**
 * Average lifetime spend per buying customer. Only customers who have
 * actually bought are in the denominator: including the whole customer book
 * would drag the average down with people who never converted, which is a
 * different (also interesting) number.
 */
export function customerLifetimeValue(sales: Sale[], customers: Customer[]): LifetimeValue {
  const byCustomer = new Map<string, { totalKobo: number; purchaseCount: number }>();
  for (const sale of sales) {
    if (!sale.customerId) continue;
    const bucket = byCustomer.get(sale.customerId) ?? { totalKobo: 0, purchaseCount: 0 };
    bucket.totalKobo += sale.totalKobo;
    bucket.purchaseCount += 1;
    byCustomer.set(sale.customerId, bucket);
  }

  const values = [...byCustomer.values()];
  const totalKobo = sum(values.map((v) => v.totalKobo));
  const customerCount = values.length;
  const purchases = sum(values.map((v) => v.purchaseCount));

  void customers; // accepted for symmetry with topCustomers; not needed to average

  return {
    totalKobo,
    customerCount,
    averageKobo: customerCount > 0 ? Math.round(totalKobo / customerCount) : 0,
    averagePurchases: customerCount > 0 ? round2(purchases / customerCount) : 0,
    topCustomerKobo: values.reduce((max, v) => Math.max(max, v.totalKobo), 0),
  };
}

export interface RetentionRate {
  /** Share of *in-window* customers who came back on another day, as a %. */
  ratePct: number;
  retainedCount: number;
  /** Customers whose visits fell inside the window (all customers when days = 0). */
  totalCustomers: number;
  /** Unique customers with at least one purchase or resolved booking ever. */
  activeCount: number;
}

/**
 * Retention: the share of customers who came back more than once.
 *
 * Visits are counted from completed bookings *and* sales, because in a salon
 * the same trip often produces both — a customer who booked a wash and also
 * bought shampoo must not read as "returning". They are therefore deduped to
 * one visit per customer per calendar day; coming back means another *day*,
 * which is the only version of this that means anything to a salon.
 *
 * Walk-in sales with no customer id can't be attributed and are ignored.
 *
 * When `days` > 0, only customers whose visits all fall inside the window are
 * judged (both their first and last visit) — the useful question for a 30-day
 * view is "who is still coming?". Pass `days = 0` for all-time retention.
 */
export function retentionRate(customers: Customer[], sales: Sale[], bookings: Booking[], now: Date, days: number): RetentionRate {
  const firstVisit = new Map<string, number>();
  const lastVisit = new Map<string, number>();
  /** customerId → set of local calendar days they were seen on. */
  const visitsByDay = new Map<string, Set<string>>();

  const note = (customerId: string, at: string) => {
    const d = new Date(at);
    if (Number.isNaN(d.getTime())) return;
    const time = d.getTime();
    const seenFirst = firstVisit.get(customerId);
    if (seenFirst === undefined || time < seenFirst) firstVisit.set(customerId, time);
    const seenLast = lastVisit.get(customerId);
    if (seenLast === undefined || time > seenLast) lastVisit.set(customerId, time);
    const days = visitsByDay.get(customerId) ?? new Set<string>();
    days.add(dayKey(d));
    visitsByDay.set(customerId, days);
  };

  for (const sale of sales) if (sale.customerId) note(sale.customerId, sale.createdAt);
  for (const booking of bookings) if (isVisit(booking)) note(booking.customerId, booking.startsAt);

  const scoped = [...visitsByDay.keys()].filter((customerId) => {
    if (days <= 0) return true;
    const first = firstVisit.get(customerId);
    const last = lastVisit.get(customerId);
    return first !== undefined && last !== undefined && withinDays(new Date(first), now, days) && withinDays(new Date(last), now, days);
  });

  let retainedCount = 0;
  for (const customerId of scoped) if ((visitsByDay.get(customerId)?.size ?? 0) > 1) retainedCount += 1;

  return { ratePct: pct(retainedCount, scoped.length), retainedCount, totalCustomers: scoped.length, activeCount: visitsByDay.size };
}

/* ------------------------------------------------------------------ */
/* Catalogue                                                           */
/* ------------------------------------------------------------------ */

export interface TopService {
  serviceId: string;
  name: string;
  revenueKobo: number;
  unitsSold: number;
}

/**
 * Best services by revenue, from sale line items of kind "service". Sold
 * amounts come from the recorded line total, not the service's current price
 * list, so a price change doesn't rewrite history. A line item whose service
 * has since been deleted still appears, by the name recorded on the sale.
 */
export function topServicesByRevenue(saleItems: SaleItem[], services: Service[], limit = 5): TopService[] {
  const byService = new Map<string, { name: string; revenueKobo: number; unitsSold: number }>();

  for (const item of saleItems) {
    if (item.kind !== "service") continue;
    const bucket = byService.get(item.refId) ?? { name: services.find((s) => s.id === item.refId)?.name ?? item.name ?? "Unknown service", revenueKobo: 0, unitsSold: 0 };
    bucket.revenueKobo += item.totalKobo;
    bucket.unitsSold += item.quantity;
    bucket.name = services.find((s) => s.id === item.refId)?.name ?? bucket.name;
    byService.set(item.refId, bucket);
  }

  return [...byService.entries()]
    .map(([serviceId, bucket]) => ({ serviceId, name: bucket.name, revenueKobo: bucket.revenueKobo, unitsSold: bucket.unitsSold }))
    .sort((a, b) => b.revenueKobo - a.revenueKobo || b.unitsSold - a.unitsSold)
    .slice(0, Math.max(0, limit));
}

export interface TopProduct {
  productId: string;
  name: string;
  quantity: number;
  revenueKobo: number;
}

/** Best retail products by units sold. */
export function topProductsByUnits(saleItems: SaleItem[], products: Product[], limit = 5): TopProduct[] {
  const byProduct = new Map<string, { name: string; quantity: number; revenueKobo: number }>();

  for (const item of saleItems) {
    if (item.kind !== "product") continue;
    const bucket = byProduct.get(item.refId) ?? { name: products.find((p) => p.id === item.refId)?.name ?? item.name ?? "Unknown product", quantity: 0, revenueKobo: 0 };
    bucket.quantity += item.quantity;
    bucket.revenueKobo += item.totalKobo;
    bucket.name = products.find((p) => p.id === item.refId)?.name ?? bucket.name;
    byProduct.set(item.refId, bucket);
  }

  return [...byProduct.entries()]
    .map(([productId, bucket]) => ({ productId, name: bucket.name, quantity: bucket.quantity, revenueKobo: bucket.revenueKobo }))
    .sort((a, b) => b.quantity - a.quantity || b.revenueKobo - a.revenueKobo)
    .slice(0, Math.max(0, limit));
}

export interface DeadStockRow {
  productId: string;
  name: string;
  category: string;
  stockQty: number;
  /** Cost of the units on the shelf — what's actually tied up. */
  valueAtCostKobo: number;
  /** What they'd bring in at the listed price, if they ever sell. */
  retailValueKobo: number;
  /** Days since the last sale of this product, or null if it has never sold. */
  daysSinceLastSale: number | null;
}

export interface DeadStockSummary {
  rows: DeadStockRow[];
  /** Total cost of stock with no recent sales — "money on the shelf". */
  totalValueAtCostKobo: number;
  totalRetailValueKobo: number;
}

/**
 * Stock on hand that hasn't sold in `days` days: cash sitting on a shelf.
 *
 * Valued at **cost**, not retail — the money already spent is the fact; the
 * retail figure is a hope. A product with no sales at all in the window is
 * included with `daysSinceLastSale: null`, which is exactly the worst case
 * (bought, never moved) and must not be quietly excluded.
 *
 * Only active products with stock on hand count; an inactive product isn't on
 * the shelf, and zero stock has no money tied up.
 *
 * `sales` is needed alongside `saleItems` because a line item has no date of
 * its own — the receipt does. Passing them together is what makes "no sales
 * in 60 days" answerable at all.
 */
export function deadStock(products: Product[], saleItems: SaleItem[], sales: Sale[], now: Date, days: number): DeadStockSummary {
  const saleDate = new Map<string, number>();
  for (const sale of sales) {
    const time = new Date(sale.createdAt).getTime();
    if (!Number.isNaN(time)) saleDate.set(sale.id, time);
  }

  const lastSaleByProduct = new Map<string, number>();
  for (const item of saleItems) {
    if (item.kind !== "product") continue;
    const time = saleDate.get(item.saleId);
    if (time === undefined) continue;
    const existing = lastSaleByProduct.get(item.refId);
    if (existing === undefined || time > existing) lastSaleByProduct.set(item.refId, time);
  }

  const rows: DeadStockRow[] = [];
  for (const product of products) {
    if (!product.active) continue;
    if (product.stockQty <= 0) continue;

    const lastSale = lastSaleByProduct.get(product.id);
    const daysSinceLastSale = lastSale === undefined ? null : daysBetween(new Date(lastSale), now);
    const isDead = daysSinceLastSale === null || daysSinceLastSale >= Math.max(0, days);
    if (!isDead) continue;

    rows.push({
      productId: product.id,
      name: product.name,
      category: product.category,
      stockQty: product.stockQty,
      valueAtCostKobo: product.stockQty * product.costKobo,
      retailValueKobo: product.stockQty * product.priceKobo,
      daysSinceLastSale,
    });
  }

  rows.sort((a, b) => b.valueAtCostKobo - a.valueAtCostKobo);

  return {
    rows,
    totalValueAtCostKobo: sum(rows.map((r) => r.valueAtCostKobo)),
    totalRetailValueKobo: sum(rows.map((r) => r.retailValueKobo)),
  };
}

/* ------------------------------------------------------------------ */
/* Costs & profit                                                      */
/* ------------------------------------------------------------------ */

export interface ProfitLossMonth {
  /** YYYY-MM of this bucket. */
  month: string;
  /** e.g. "Sep 2025". */
  label: string;
  revenueKobo: number;
  expensesKobo: number;
  /** revenue − expenses. Negative is a loss, and is returned as such. */
  grossProfitKobo: number;
  /** Profit as a share of revenue, one decimal; 0 with no revenue. */
  marginPct: number;
}

/**
 * Revenue, expenses and gross profit per month, oldest first, for the
 * `monthCount` months up to and including the month `now` falls in. This is
 * the "am I actually making money?" view — a week can look great while the
 * month is behind on rent.
 *
 * Called "gross" profit because it is revenue minus recorded expenses only;
 * it does not attempt cost-of-goods or tax treatment, which this app doesn't
 * track per item.
 */
export function profitAndLoss(sales: Sale[], expenses: Expense[], now: Date, monthCount: number): ProfitLossMonth[] {
  const span = Math.max(0, Math.floor(monthCount));
  const buckets: ProfitLossMonth[] = [];
  const byMonth = new Map<string, ProfitLossMonth>();
  const thisMonth = startOfMonth(now);

  for (let i = span - 1; i >= 0; i -= 1) {
    const d = new Date(thisMonth.getFullYear(), thisMonth.getMonth() - i, 1);
    const point: ProfitLossMonth = { month: dayKey(d).slice(0, 7), label: monthLabel(d), revenueKobo: 0, expensesKobo: 0, grossProfitKobo: 0, marginPct: 0 };
    buckets.push(point);
    byMonth.set(point.month, point);
  }

  for (const sale of sales) {
    const key = dayKey(sale.createdAt).slice(0, 7);
    const point = byMonth.get(key);
    if (point) point.revenueKobo += sale.totalKobo;
  }
  for (const expense of expenses) {
    const key = dayKey(expense.date).slice(0, 7);
    const point = byMonth.get(key);
    if (point) point.expensesKobo += expense.amountKobo;
  }

  for (const point of buckets) {
    point.grossProfitKobo = point.revenueKobo - point.expensesKobo;
    point.marginPct = pct(point.grossProfitKobo, point.revenueKobo);
  }

  return buckets;
}

export interface ExpenseBreakdownRow {
  category: Expense["category"];
  label: string;
  amountKobo: number;
  count: number;
  sharePct: number;
}

export interface ExpenseBreakdown {
  totalKobo: number;
  rows: ExpenseBreakdownRow[];
  /** The category eating the most money, or null with no expenses. */
  topCategory: Expense["category"] | null;
}

/**
 * Expenses by category. With `days` > 0 it covers the last N days; pass 0 for
 * all time. Rows come back largest first, because the first row is the one an
 * owner should act on.
 */
export function expenseBreakdown(expenses: Expense[], now: Date, days = 0): ExpenseBreakdown {
  const scoped = days > 0 ? expenses.filter((e) => withinDays(e.date, now, days)) : expenses;
  const byCategory = new Map<Expense["category"], { amountKobo: number; count: number }>();

  for (const expense of scoped) {
    const bucket = byCategory.get(expense.category) ?? { amountKobo: 0, count: 0 };
    bucket.amountKobo += expense.amountKobo;
    bucket.count += 1;
    byCategory.set(expense.category, bucket);
  }

  const totalKobo = sum([...byCategory.values()].map((b) => b.amountKobo));
  const rows: ExpenseBreakdownRow[] = [...byCategory.entries()]
    .map(([category, bucket]) => ({ category, label: EXPENSE_CATEGORY_LABEL[category] ?? category, amountKobo: bucket.amountKobo, count: bucket.count, sharePct: pct(bucket.amountKobo, totalKobo) }))
    .sort((a, b) => b.amountKobo - a.amountKobo);

  return { totalKobo, rows, topCategory: rows[0]?.category ?? null };
}

/** Average value of a sale, rounded to the nearest kobo. 0 with no sales. */
export function averageSaleValue(sales: Sale[]): number {
  if (sales.length === 0) return 0;
  return Math.round(sum(sales.map((s) => s.totalKobo)) / sales.length);
}

/* ------------------------------------------------------------------ */
/* Business health                                                     */
/* ------------------------------------------------------------------ */

export interface HealthComponent {
  key: "collection" | "repeat" | "revenue_trend" | "expense_ratio" | "no_show";
  label: string;
  /** 0–100 for this signal alone. */
  score: number;
  /** How much this signal counts toward the total, 0–1. Sums to 1. */
  weight: number;
  /** The actual figure behind the score, already rounded, for display. */
  valuePct: number;
  /** One plain sentence explaining what moved this component. */
  detail: string;
}

export interface BusinessHealthScore {
  /** 0–100 weighted composite. */
  score: number;
  band: "excellent" | "good" | "fair" | "at_risk";
  /** Short human label for the band, e.g. "Good". */
  bandLabel: string;
  /** One-line summary of the score, ready to render. */
  headline: string;
  /** Always all five components, in weight order, so the UI can explain it. */
  components: HealthComponent[];
}

export interface BusinessHealthInput {
  sales: Sale[];
  expenses: Expense[];
  invoices: Invoice[];
  customers: Customer[];
  bookings: Booking[];
  now: Date;
}

/**
 * A single 0–100 health number built from five weighted signals, each of
 * which is also returned.
 *
 * The score exists to be *explained*: a bare "72" changes no behaviour, but
 * "72 — collection rate 40% (25 invoices, ₦1.2m unpaid)" prompts a phone
 * call. So every component carries its own score, weight, underlying
 * percentage and a sentence. The five:
 *
 *   - collection   25%  share of issued invoices that are paid
 *   - repeat       20%  share of customers with more than one visit
 *   - revenue trend 20% last 30 days against the 30 before it
 *   - expense ratio 20% expenses as a share of revenue
 *   - no-show      15% 100 minus the no-show rate
 *
 * Anything with no denominator scores 50 (neutral), never 0 — see
 * `NO_SIGNAL_SCORE`. A business with no data at all therefore lands at 50
 * with five honest "not enough data yet" explanations rather than a scary
 * red zero.
 *
 * `now` drives the two windowed signals (trend, and the window used to find
 * repeat customers) and is required so this is deterministic under test.
 */
export function businessHealthScore(input: BusinessHealthInput): BusinessHealthScore {
  const { sales, expenses, invoices, customers, bookings, now } = input;

  /* 1. Collection rate — paid invoices over issued (paid + pending + overdue). */
  const issued = invoices.filter((i) => i.status === "paid" || i.status === "pending" || i.status === "overdue");
  const paid = issued.filter((i) => i.status === "paid");
  const collectionPct = pct(paid.length, issued.length);
  const unpaidKobo = sum(issued.filter((i) => i.status !== "paid").map((i) => Math.max(0, i.totalKobo)));
  const collection: HealthComponent = {
    key: "collection",
    label: "Collection rate",
    weight: 0.25,
    score: issued.length === 0 ? NO_SIGNAL_SCORE : clampScore(collectionPct),
    valuePct: collectionPct,
    detail:
      issued.length === 0
        ? "No invoices issued yet — nothing to collect."
        : `${paid.length} of ${issued.length} invoices paid${unpaidKobo > 0 ? `, with money still outstanding` : ", nothing outstanding"}.`,
  };

  /* 2. Repeat-customer rate — customers with more than one visit, all time. */
  const retention = retentionRate(customers, sales, bookings, now, 0);
  const repeat: HealthComponent = {
    key: "repeat",
    label: "Repeat customers",
    weight: 0.2,
    score: retention.totalCustomers === 0 ? NO_SIGNAL_SCORE : clampScore(retention.ratePct),
    valuePct: retention.ratePct,
    detail:
      retention.totalCustomers === 0
        ? "No customer-linked visits recorded yet."
        : `${retention.retainedCount} of ${retention.totalCustomers} customers have come back more than once.`,
  };

  /* 3. Revenue trend — the last 30 days against the 30 before that. */
  const currentKobo = sum(sales.filter((s) => withinDays(s.createdAt, now, 30)).map((s) => s.totalKobo));
  const priorKobo = sum(sales.filter((s) => withinDays(s.createdAt, subDays(now, 30), 30)).map((s) => s.totalKobo));
  let trendScore: number;
  let trendDetail: string;
  if (priorKobo === 0 && currentKobo === 0) {
    trendScore = NO_SIGNAL_SCORE;
    trendDetail = "No sales in the last 30 days or the 30 before them.";
  } else if (priorKobo === 0) {
    // Revenue from nothing is the best possible direction, but it's a young
    // signal — score it high, not perfect, and say so.
    trendScore = 80;
    trendDetail = "Revenue started in the last 30 days — no previous period to compare.";
  } else {
    const changePct = ((currentKobo - priorKobo) / priorKobo) * 100;
    trendScore = clampScore(50 + changePct);
    trendDetail = `Revenue is ${changePct >= 0 ? "up" : "down"} ${Math.abs(round2(changePct))}% on the previous 30 days.`;
  }
  const revenueTrendComponent: HealthComponent = {
    key: "revenue_trend",
    label: "Revenue trend",
    weight: 0.2,
    score: trendScore,
    valuePct: priorKobo > 0 ? round2(((currentKobo - priorKobo) / priorKobo) * 100) : 0,
    detail: trendDetail,
  };

  /* 4. Expense ratio — expenses as a share of revenue (lower is better). */
  const recentSalesKobo = currentKobo;
  const recentExpensesKobo = sum(expenses.filter((e) => withinDays(e.date, now, 30)).map((e) => e.amountKobo));
  const expenseRatioPct = recentSalesKobo > 0 ? round2((recentExpensesKobo / recentSalesKobo) * 100) : 0;
  let expenseScore: number;
  let expenseDetail: string;
  if (recentSalesKobo === 0 && recentExpensesKobo === 0) {
    expenseScore = NO_SIGNAL_SCORE;
    expenseDetail = "No sales or expenses in the last 30 days.";
  } else if (recentSalesKobo === 0) {
    expenseScore = 0;
    expenseDetail = "Money is going out with no sales coming in over the last 30 days.";
  } else {
    expenseScore = clampScore(100 - Math.max(0, expenseRatioPct - 50) * 2);
    expenseDetail = `Expenses are ${expenseRatioPct}% of the last 30 days' revenue.`;
  }
  const expenseRatio: HealthComponent = {
    key: "expense_ratio",
    label: "Expense ratio",
    weight: 0.2,
    score: expenseScore,
    valuePct: expenseRatioPct,
    detail: expenseDetail,
  };

  /* 5. No-show rate — resolved bookings only; see `noShowRate`. */
  const shows = noShowRate(bookings);
  const noShow: HealthComponent = {
    key: "no_show",
    label: "No-show rate",
    weight: 0.15,
    score: shows.resolvedCount === 0 ? NO_SIGNAL_SCORE : clampScore(100 - shows.ratePct),
    valuePct: shows.ratePct,
    detail: shows.resolvedCount === 0 ? "No completed or no-show bookings to judge yet." : `${shows.noShowCount} no-shows out of ${shows.resolvedCount} resolved bookings.`,
  };

  const components = [collection, repeat, revenueTrendComponent, expenseRatio, noShow];
  const weighted = sum(components.map((c) => c.score * c.weight));
  const totalWeight = sum(components.map((c) => c.weight));
  const score = totalWeight > 0 ? clampScore(weighted / totalWeight) : 0;

  const band: BusinessHealthScore["band"] = score >= 80 ? "excellent" : score >= 65 ? "good" : score >= 45 ? "fair" : "at_risk";
  const bandLabel = band === "excellent" ? "Excellent" : band === "good" ? "Good" : band === "fair" ? "Needs attention" : "At risk";

  // Name the weakest signal — that's the one thing worth doing next.
  const weakest = [...components].sort((a, b) => a.score * a.weight - b.score * b.weight)[0];
  const headline = `${bandLabel} — your weakest signal is ${weakest.label.toLowerCase()} (${weakest.valuePct}%).`;

  return { score, band, bandLabel, headline, components };
}
