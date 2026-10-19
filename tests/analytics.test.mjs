/**
 * Tests for `src/lib/analytics.ts` — the dashboard's analytics arithmetic.
 *
 * Run with `node --test "tests/analytics.test.mjs"` (the runner Node ships
 * with; no framework, no install). Node strips the TypeScript types on import,
 * which is only possible because `analytics.ts` imports nothing at runtime.
 *
 * These are not smoke tests. Each one pins a number an owner will read on the
 * Analytics page and act on — the ageing bucket a 31-day-old invoice lands in,
 * the no-show rate a salon is judged by, the health score's component maths.
 * Every function is checked against empty input too, because a brand-new
 * business with no records must render the page without a single `NaN`.
 *
 * All timestamps are built with local-time constructors, never UTC strings:
 * peak hours and busiest days read the *local* clock, and a test that passes
 * in Lagos must pass on a CI box in UTC. `NOW` is a fixed Monday noon so
 * "last 7 days" always means the same seven days.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  revenueTrend,
  revenueByWeek,
  monthOverMonth,
  paymentMethodMix,
  outstandingSummary,
  bookingStatusMix,
  noShowRate,
  peakHours,
  busiestDays,
  newVsReturning,
  topCustomers,
  customerLifetimeValue,
  retentionRate,
  topServicesByRevenue,
  topProductsByUnits,
  deadStock,
  profitAndLoss,
  expenseBreakdown,
  averageSaleValue,
  businessHealthScore,
} from "../src/lib/analytics.ts";

/* ------------------------------------------------------------------ */
/* Fixtures — minimal builders that mirror the real row shapes.        */
/* ------------------------------------------------------------------ */

const ORG = "org_test";

/**
 * `NOW` is Monday 15 September 2025, **12:00 local**.
 *
 * Local, not UTC, because this is a wall-clock domain: a booking has a time,
 * a sale happens at a time, and "the busiest hour" means the hour on the
 * salon's own clock. `peakHours` and `busiestDays` read local time from an
 * ISO string, so fixtures are built with local constructors too — a test that
 * only passed at one offset would be testing the CI box, not the code.
 *
 * Noon is deliberate: it is the hour furthest from midnight, so a sale dated
 * "today at noon" stays on the same local calendar day at every offset.
 */
const NOW = new Date(2025, 8, 15, 12, 0, 0);

/** `daysAgo` days before NOW at the given local hour — an ISO string. */
function at(daysAgo, hour = 12, minute = 0) {
  return new Date(2025, 8, 15 - daysAgo, hour, minute, 0).toISOString();
}

/** `daysAgo` days before NOW as a local-midnight Date (for windowed args). */

/** Local calendar date of a Date, as YYYY-MM-DD. */
function localDayKey(d) {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * The key the analytics functions actually produce for `daysAgo` days before
 * NOW: the business's local calendar day, as YYYY-MM-DD.
 *
 * Deliberately the same construction as the implementation, so a date-string
 * fixture ("2025-09-13") and a bucketed key assertion mean the same day
 * locally at UTC+1, UTC+8 or UTC-5.
 */
function dayKey(daysAgo) {
  return localDayKey(new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - daysAgo));
}

/** The YYYY-MM key the functions produce for the month `monthsAgo` back. */

/** The Monday date key for the week start `weeksAgo` weeks before NOW's week. */

function sale(over = {}) {
  return {
    id: "sl_x",
    organizationId: ORG,
    customerId: null,
    subtotalKobo: 100_000,
    discountKobo: 0,
    totalKobo: 100_000,
    paymentMethod: "cash",
    paymentStatus: "paid",
    amountPaidKobo: 100_000,
    receiptPhotoUrl: null,
    notes: "",
    createdAt: at(0),
    ...over,
  };
}

function booking(over = {}) {
  return {
    id: "bk_x",
    organizationId: ORG,
    customerId: "cus_a",
    serviceId: "svc_a",
    staffId: "usr_a",
    startsAt: at(0, 10),
    status: "completed",
    notes: "",
    priceKobo: 100_000,
    ...over,
  };
}

function invoice(over = {}) {
  return {
    id: "inv_x",
    organizationId: ORG,
    number: "INV-0001",
    customerId: "cus_a",
    status: "pending",
    issueDate: dayKey(10),
    dueDate: dayKey(0),
    subtotalKobo: 100_000,
    discountKobo: 0,
    totalKobo: 100_000,
    notes: "",
    paidAt: null,
    paidVia: "manual",
    platformFeeKobo: 0,
    paymentReference: "",
    ...over,
  };
}

function product(over = {}) {
  return {
    id: "prd_x",
    organizationId: ORG,
    name: "Product",
    sku: "SKU-1",
    category: "Care",
    costKobo: 50_000,
    priceKobo: 100_000,
    stockQty: 10,
    lowStockThreshold: 2,
    supplier: "Supplier",
    active: true,
    imageUrl: null,
    ...over,
  };
}

function service(over = {}) {
  return {
    id: "svc_x",
    organizationId: ORG,
    name: "Service",
    category: "Hair",
    priceKobo: 100_000,
    durationMin: 60,
    description: "",
    active: true,
    imageUrl: null,
    ...over,
  };
}

function saleItem(over = {}) {
  return {
    id: "si_x",
    organizationId: ORG,
    saleId: "sl_x",
    kind: "service",
    refId: "svc_x",
    name: "Service",
    quantity: 1,
    unitPriceKobo: 100_000,
    totalKobo: 100_000,
    ...over,
  };
}

function expense(over = {}) {
  return {
    id: "ex_x",
    organizationId: ORG,
    description: "Expense",
    category: "other",
    amountKobo: 100_000,
    paymentMethod: "cash",
    date: at(0),
    notes: "",
    ...over,
  };
}

function customer(over = {}) {
  return {
    id: "cus_a",
    organizationId: ORG,
    name: "Ada Obi",
    phone: "0805 000 0000",
    email: "",
    gender: "female",
    notes: "",
    createdAt: at(100),
    ...over,
  };
}

/** No monetary field anywhere in an output should ever be NaN. */
function assertNoNaN(value, path = "result") {
  if (typeof value === "number") {
    assert.ok(Number.isFinite(value), `${path} should be a finite number, got ${value}`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoNaN(v, `${path}[${i}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) assertNoNaN(v, `${path}.${k}`);
  }
}

/* ------------------------------------------------------------------ */
/* Revenue                                                             */
/* ------------------------------------------------------------------ */

test("revenueTrend: empty input returns a full run of zero buckets", () => {
  const points = revenueTrend([], NOW, 7);
  assert.equal(points.length, 7);
  assert.deepEqual(
    points.map((p) => p.revenueKobo),
    [0, 0, 0, 0, 0, 0, 0],
  );
  assert.ok(points.every((p) => p.salesCount === 0));
  assertNoNaN(points);
});

test("revenueTrend: buckets run oldest-first and end on today", () => {
  const points = revenueTrend([], NOW, 3);
  assert.equal(points[0].date, dayKey(2));
  assert.equal(points[2].date, dayKey(0));
  assert.ok(points[0].label.length > 0);
});

test("revenueTrend: sales land on the right day, summed", () => {
  const points = revenueTrend(
    [
      sale({ id: "s1", totalKobo: 250_000, createdAt: at(0, 9) }),
      sale({ id: "s2", totalKobo: 500_000, createdAt: at(0, 17) }),
      sale({ id: "s3", totalKobo: 100_000, createdAt: at(2, 11) }),
    ],
    NOW,
    3,
  );
  assert.equal(points[0].revenueKobo, 100_000);
  assert.equal(points[1].revenueKobo, 0);
  assert.equal(points[1].salesCount, 0);
  assert.equal(points[2].revenueKobo, 750_000);
  assert.equal(points[2].salesCount, 2);
});

test("revenueTrend: sales older than the window are excluded", () => {
  const points = revenueTrend([sale({ totalKobo: 900_000, createdAt: at(30) })], NOW, 7);
  assert.equal(
    points.reduce((sum, p) => sum + p.revenueKobo, 0),
    0,
  );
});

test("revenueTrend: an inclusive boundary sale (day 89 of 90) is counted", () => {
  const points = revenueTrend([sale({ totalKobo: 42_000, createdAt: at(89, 8) })], NOW, 90);
  assert.equal(points[0].revenueKobo, 42_000);
});

test("revenueTrend: days === 0 yields no buckets rather than throwing", () => {
  assert.deepEqual(revenueTrend([sale()], NOW, 0), []);
  assert.deepEqual(revenueTrend([sale()], NOW, -5), []);
});

test("revenueTrend: a malformed createdAt is ignored, not thrown on", () => {
  const points = revenueTrend([sale({ createdAt: "not-a-date" }), sale({ totalKobo: 5000, createdAt: at(0) })], NOW, 2);
  assert.equal(points[1].revenueKobo, 5000);
});

test("revenueByWeek: empty input returns zero-filled weeks ending with this week", () => {
  const weeks = revenueByWeek([], NOW, 4);
  assert.equal(weeks.length, 4);
  assert.ok(weeks.every((w) => w.revenueKobo === 0 && w.salesCount === 0));
  // NOW is a Monday, so this week starts on NOW's date.
  assert.equal(weeks[3].weekStart, dayKey(0));
  assert.equal(weeks[0].weekStart, dayKey(21));
});

test("revenueByWeek: sales bucket into Monday-starting weeks, and nothing is lost", () => {
  const weeks = revenueByWeek(
    [
      sale({ id: "s1", totalKobo: 100_000, createdAt: at(0, 9) }), // this week (Monday)
      sale({ id: "s2", totalKobo: 200_000, createdAt: at(6, 15) }), // Tuesday of the previous week
      sale({ id: "s3", totalKobo: 400_000, createdAt: at(7, 9) }), // Monday of the previous week
    ],
    NOW,
    2,
  );
  // The last bucket is always the week NOW falls in; the one before it holds
  // everything from the previous Monday onwards. A sale can never leak
  // between buckets: the two weeks add up to every sale given.
  assert.equal(weeks[0].revenueKobo, 600_000);
  assert.equal(weeks[0].salesCount, 2);
  assert.equal(weeks[1].revenueKobo, 100_000);
  assert.equal(weeks[1].salesCount, 1);
  assert.equal(
    weeks.reduce((sum, w) => sum + w.revenueKobo, 0),
    700_000,
  );
  // And the week keys really are seven days apart, in order.
  assert.equal(new Date(`${weeks[1].weekStart}T00:00:00`).getDate() - new Date(`${weeks[0].weekStart}T00:00:00`).getDate(), 7);
});

test("revenueByWeek: a Sunday belongs to the week that started six days earlier", () => {
  // Sunday 14 Sep 2025 is the last day of the week beginning Mon 8 Sep.
  const weeks = revenueByWeek([sale({ totalKobo: 77_000, createdAt: at(1, 18) })], NOW, 2);
  assert.equal(weeks[0].revenueKobo, 77_000);
  assert.equal(weeks[1].revenueKobo, 0);
});

test("monthOverMonth: reports an increase with direction and signed percentage", () => {
  const change = monthOverMonth(NOW, 100_000, 150_000);
  assert.equal(change.priorKobo, 100_000);
  assert.equal(change.currentKobo, 150_000);
  assert.equal(change.changeKobo, 50_000);
  assert.equal(change.changePct, 50);
  assert.equal(change.direction, "up");
});

test("monthOverMonth: reports a decrease as negative with direction down", () => {
  const change = monthOverMonth(NOW, 200_000, 150_000);
  assert.equal(change.changeKobo, -50_000);
  assert.equal(change.changePct, -25);
  assert.equal(change.direction, "down");
});

test("monthOverMonth: identical periods are flat at 0%", () => {
  const change = monthOverMonth(NOW, 100_000, 100_000);
  assert.equal(change.changePct, 0);
  assert.equal(change.direction, "flat");
});

test("monthOverMonth: a zero prior period gives 0% (not Infinity) but the right direction", () => {
  const change = monthOverMonth(NOW, 0, 80_000);
  assert.equal(change.changePct, 0);
  assert.equal(change.direction, "up");
  assert.equal(change.changeKobo, 80_000);
  assertNoNaN(change);
});

test("monthOverMonth: both periods empty is flat and NaN-free", () => {
  const change = monthOverMonth(NOW, 0, 0);
  assert.equal(change.changePct, 0);
  assert.equal(change.direction, "flat");
  assertNoNaN(change);
});

/* ------------------------------------------------------------------ */
/* Payments                                                            */
/* ------------------------------------------------------------------ */

test("paymentMethodMix: empty input returns no slices", () => {
  assert.deepEqual(paymentMethodMix([]), []);
});

test("paymentMethodMix: splits totals and shares by method", () => {
  const mix = paymentMethodMix([
    sale({ id: "s1", paymentMethod: "cash", totalKobo: 100_000 }),
    sale({ id: "s2", paymentMethod: "cash", totalKobo: 100_000 }),
    sale({ id: "s3", paymentMethod: "transfer", totalKobo: 200_000 }),
  ]);
  assert.equal(mix.length, 2);

  const cash = mix.find((m) => m.method === "cash");
  const transfer = mix.find((m) => m.method === "transfer");
  assert.equal(cash.totalKobo, 200_000);
  assert.equal(cash.count, 2);
  assert.equal(cash.sharePct, 50);
  assert.equal(cash.label, "Cash");
  assert.equal(transfer.totalKobo, 200_000);
  assert.equal(transfer.sharePct, 50);
  assertNoNaN(mix);
});

test("paymentMethodMix: omits methods with no sales and keeps a fixed order", () => {
  const mix = paymentMethodMix([sale({ paymentMethod: "pos", totalKobo: 500_000 })]);
  assert.deepEqual(
    mix.map((m) => m.method),
    ["pos"],
  );
  assert.equal(mix[0].sharePct, 100);
});

test("outstandingSummary: empty input returns zeroed buckets, not NaN", () => {
  const summary = outstandingSummary([], NOW);
  assert.equal(summary.totalKobo, 0);
  assert.equal(summary.count, 0);
  assert.equal(summary.largestKobo, 0);
  assert.equal(summary.overduePct, 0);
  assert.equal(summary.ageing.length, 4);
  assert.ok(summary.ageing.every((b) => b.amountKobo === 0 && b.count === 0));
  assertNoNaN(summary);
});

test("outstandingSummary: counts only pending and overdue invoices", () => {
  const summary = outstandingSummary(
    [
      invoice({ id: "i1", status: "pending", totalKobo: 100_000, dueDate: dayKey(0) }),
      invoice({ id: "i2", status: "overdue", totalKobo: 200_000, dueDate: dayKey(10) }),
      invoice({ id: "i3", status: "paid", totalKobo: 900_000, paidAt: at(3) }),
      invoice({ id: "i4", status: "draft", totalKobo: 900_000 }),
    ],
    NOW,
  );
  assert.equal(summary.count, 2);
  assert.equal(summary.totalKobo, 300_000);
  assert.equal(summary.largestKobo, 200_000);
  assert.equal(summary.overduePct, 50);
});

test("outstandingSummary: ageing buckets are exclusive at their boundaries", () => {
  const summary = outstandingSummary(
    [
      invoice({ id: "due_today", totalKobo: 10_000, dueDate: dayKey(0) }),
      invoice({ id: "due_tomorrow", totalKobo: 20_000, dueDate: dayKey(-5) }),
      invoice({ id: "one_day", totalKobo: 30_000, dueDate: dayKey(1) }),
      invoice({ id: "thirty", totalKobo: 40_000, dueDate: dayKey(30) }),
      invoice({ id: "thirty_one", totalKobo: 50_000, dueDate: dayKey(31) }),
      invoice({ id: "sixty", totalKobo: 60_000, dueDate: dayKey(60) }),
      invoice({ id: "sixty_one", totalKobo: 70_000, dueDate: dayKey(61) }),
    ],
    NOW,
  );

  const [current, d1to30, d31to60, d61plus] = summary.ageing;
  assert.equal(current.key, "current");
  assert.equal(current.amountKobo, 30_000); // due today + due tomorrow
  assert.equal(current.count, 2);
  assert.equal(d1to30.amountKobo, 70_000); // 1 day + 30 days
  assert.equal(d1to30.count, 2);
  assert.equal(d31to60.amountKobo, 110_000); // 31 days + 60 days — 31 must NOT also count
  assert.equal(d31to60.count, 2);
  assert.equal(d61plus.amountKobo, 70_000);
  assert.equal(d61plus.count, 1);

  // Nothing is double-counted: the buckets add up to the total, exactly.
  const bucketed = summary.ageing.reduce((sum, b) => sum + b.amountKobo, 0);
  assert.equal(bucketed, summary.totalKobo);
  assert.equal(bucketed, 280_000);
});

test("outstandingSummary: an invalid due date ages as current rather than landing nowhere", () => {
  const summary = outstandingSummary([invoice({ totalKobo: 55_000, dueDate: "" })], NOW);
  assert.equal(summary.ageing[0].amountKobo, 55_000);
  assert.equal(summary.totalKobo, 55_000);
  assertNoNaN(summary);
});

/* ------------------------------------------------------------------ */
/* Bookings                                                            */
/* ------------------------------------------------------------------ */

test("bookingStatusMix: empty input returns no slices", () => {
  assert.deepEqual(bookingStatusMix([]), []);
});

test("bookingStatusMix: counts each status with its share", () => {
  const mix = bookingStatusMix([
    booking({ id: "b1", status: "completed" }),
    booking({ id: "b2", status: "completed" }),
    booking({ id: "b3", status: "no_show" }),
    booking({ id: "b4", status: "cancelled" }),
  ]);
  assert.equal(mix.length, 3);
  const completed = mix.find((m) => m.status === "completed");
  assert.equal(completed.count, 2);
  assert.equal(completed.label, "Completed");
  assert.equal(completed.sharePct, 50);
  assert.ok(!mix.some((m) => m.status === "pending")); // zero-count statuses dropped
});

test("noShowRate: no bookings is 0%, not NaN", () => {
  const rate = noShowRate([]);
  assert.equal(rate.ratePct, 0);
  assert.equal(rate.resolvedCount, 0);
  assertNoNaN(rate);
});

test("noShowRate: divides by completed + no-show only", () => {
  const rate = noShowRate([
    booking({ id: "b1", status: "completed" }),
    booking({ id: "b2", status: "completed" }),
    booking({ id: "b3", status: "no_show" }),
    booking({ id: "b4", status: "cancelled" }),
    booking({ id: "b5", status: "pending" }),
    booking({ id: "b6", status: "confirmed" }),
  ]);
  assert.equal(rate.completedCount, 2);
  assert.equal(rate.noShowCount, 1);
  assert.equal(rate.resolvedCount, 3);
  assert.equal(rate.ratePct, 33.3);
});

test("noShowRate: a cancelled booking is never scored as a no-show", () => {
  const rate = noShowRate([booking({ status: "cancelled" })]);
  assert.equal(rate.ratePct, 0);
  assert.equal(rate.resolvedCount, 0);
});

test("noShowRate: an all-no-show diary is 100%", () => {
  const rate = noShowRate([booking({ id: "b1", status: "no_show" }), booking({ id: "b2", status: "no_show" })]);
  assert.equal(rate.ratePct, 100);
});

test("peakHours: empty input returns an empty list", () => {
  assert.deepEqual(peakHours([]), []);
});

test("peakHours: busiest hour first, labels in 12-hour form", () => {
  const hours = peakHours([
    booking({ id: "b1", startsAt: at(0, 14) }),
    booking({ id: "b2", startsAt: at(0, 14, 30) }),
    booking({ id: "b3", startsAt: at(0, 9) }),
    booking({ id: "b4", startsAt: at(0, 0) }),
    booking({ id: "b5", startsAt: at(0, 12) }),
  ]);
  assert.equal(hours[0].count, 2);
  assert.equal(hours[0].label, "2pm");
  // Zero-count hours are omitted entirely: only 14, 12, 9 and 0 have bookings.
  assert.equal(hours.length, 4);
  // Midnight and noon label correctly (the classic 12am/12pm off-by-one).
  assert.equal(hours.find((h) => h.hour === 0).label, "12am");
  assert.equal(hours.find((h) => h.hour === 12).label, "12pm");
  assert.equal(hours.find((h) => h.count === 1 && h.hour === 9).label, "9am");
  assert.equal(hours.find((h) => h.hour === 14).label, "2pm");
});

test("peakHours: an hour is read on the local clock, not shifted across a day boundary", () => {
  // 23:30 and 00:15 the next morning are 45 minutes apart but sit at opposite
  // ends of the hour scale. Fixtures are built with local constructors, so
  // this asserts the real wall-clock hour at any timezone offset.
  const hours = peakHours([booking({ id: "b1", startsAt: at(1, 23, 30) }), booking({ id: "b2", startsAt: at(0, 0, 15) })]);
  assert.deepEqual(
    hours.map((h) => h.hour).sort((a, b) => a - b),
    [0, 23],
  );
  assert.equal(hours.find((h) => h.hour === 23).label, "11pm");
  assert.equal(hours.find((h) => h.hour === 0).label, "12am");
});

test("peakHours: an unparseable startsAt is skipped", () => {
  const hours = peakHours([booking({ startsAt: "nope" }), booking({ startsAt: at(0, 10) })]);
  assert.equal(hours.length, 1);
  assert.equal(hours[0].hour, 10);
});

test("busiestDays: empty input returns an empty list", () => {
  assert.deepEqual(busiestDays([]), []);
});

test("busiestDays: Saturday ahead of Sunday, weekday order stable on ties", () => {
  // 13 Sep 2025 is a Saturday, 14 Sep a Sunday, 15 Sep (NOW) a Monday.
  const days = busiestDays([
    booking({ id: "b1", startsAt: at(2, 10) }), // Saturday
    booking({ id: "b2", startsAt: at(2, 12) }), // Saturday
    booking({ id: "b3", startsAt: at(1, 10) }), // Sunday
    booking({ id: "b4", startsAt: at(0, 10) }), // Monday
  ]);
  assert.equal(days[0].label, "Saturday");
  assert.equal(days[0].count, 2);
  assert.equal(days[1].label, "Sunday");
  assert.equal(days[2].label, "Monday");
  assert.equal(days.length, 3);
});

/* ------------------------------------------------------------------ */
/* Customers                                                           */
/* ------------------------------------------------------------------ */

test("newVsReturning: empty input is all zeros", () => {
  const mix = newVsReturning([], [], [], NOW, 30);
  assert.deepEqual(mix, { newCount: 0, returningCount: 0, returningPct: 0 });
  assertNoNaN(mix);
});

test("newVsReturning: splits this window's footfall into new and returning", () => {
  const customers = [
    customer({ id: "cus_old", createdAt: at(200) }),
    customer({ id: "cus_new", createdAt: at(3) }),
  ];
  const sales = [
    sale({ id: "s1", customerId: "cus_old", createdAt: at(2), totalKobo: 100_000 }),
    sale({ id: "s2", customerId: "cus_new", createdAt: at(3), totalKobo: 100_000 }),
  ];
  const mix = newVsReturning(customers, sales, [], NOW, 30);
  assert.equal(mix.returningCount, 1);
  assert.equal(mix.newCount, 1);
  assert.equal(mix.returningPct, 50);
});

test("newVsReturning: a customer who first appears before the window counts as returning", () => {
  const customers = [customer({ id: "cus_old", createdAt: at(200) })];
  const sales = [
    sale({ id: "s1", customerId: "cus_old", createdAt: at(60), totalKobo: 100_000 }),
    sale({ id: "s2", customerId: "cus_old", createdAt: at(2), totalKobo: 100_000 }),
  ];
  const mix = newVsReturning(customers, sales, [], NOW, 30);
  assert.equal(mix.returningCount, 1);
  assert.equal(mix.newCount, 0);
  assert.equal(mix.returningPct, 100);
});

test("newVsReturning: walk-in sales with no customerId are excluded", () => {
  const mix = newVsReturning([], [sale({ customerId: null, createdAt: at(1) })], [], NOW, 30);
  assert.equal(mix.newCount, 0);
  assert.equal(mix.returningCount, 0);
});

test("newVsReturning: a pending booking is an intention, not yet a visit", () => {
  const customers = [customer({ id: "cus_pending", createdAt: at(300) })];
  const bookings = [booking({ customerId: "cus_pending", startsAt: at(1), status: "pending" })];
  const mix = newVsReturning(customers, [], bookings, NOW, 30);
  assert.equal(mix.newCount + mix.returningCount, 0);
});

test("newVsReturning: activity outside the window doesn't count", () => {
  const customers = [customer({ id: "cus_old", createdAt: at(400) })];
  const sales = [sale({ customerId: "cus_old", createdAt: at(40), totalKobo: 100_000 })];
  const mix = newVsReturning(customers, sales, [], NOW, 30);
  assert.deepEqual(mix, { newCount: 0, returningCount: 0, returningPct: 0 });
});

test("topCustomers: empty input returns an empty list", () => {
  assert.deepEqual(topCustomers([], [], 5), []);
});

test("topCustomers: ranked by spend with an average per purchase", () => {
  const customers = [customer({ id: "cus_a", name: "Ada" }), customer({ id: "cus_b", name: "Bola" })];
  const sales = [
    sale({ id: "s1", customerId: "cus_a", totalKobo: 100_000 }),
    sale({ id: "s2", customerId: "cus_a", totalKobo: 300_000 }),
    sale({ id: "s3", customerId: "cus_b", totalKobo: 250_000 }),
  ];
  const top = topCustomers(sales, customers, 5);
  assert.equal(top.length, 2);
  assert.equal(top[0].customerId, "cus_a");
  assert.equal(top[0].name, "Ada");
  assert.equal(top[0].totalKobo, 400_000);
  assert.equal(top[0].purchaseCount, 2);
  assert.equal(top[0].averageKobo, 200_000);
  assert.equal(top[1].totalKobo, 250_000);
});

test("topCustomers: honours the limit and drops walk-ins", () => {
  const customers = [customer({ id: "cus_a" }), customer({ id: "cus_b" }), customer({ id: "cus_c" })];
  const sales = [
    sale({ id: "s1", customerId: "cus_a", totalKobo: 300_000 }),
    sale({ id: "s2", customerId: "cus_b", totalKobo: 200_000 }),
    sale({ id: "s3", customerId: "cus_c", totalKobo: 100_000 }),
    sale({ id: "s4", customerId: null, totalKobo: 900_000 }),
  ];
  const top = topCustomers(sales, customers, 2);
  assert.equal(top.length, 2);
  assert.deepEqual(
    top.map((t) => t.customerId),
    ["cus_a", "cus_b"],
  );
});

test("topCustomers: a deleted customer row still appears with a placeholder name", () => {
  const top = topCustomers([sale({ customerId: "cus_gone", totalKobo: 100_000 })], [], 5);
  assert.equal(top.length, 1);
  assert.equal(top[0].name, "Unknown customer");
});

test("customerLifetimeValue: no sales is all zeros", () => {
  const ltv = customerLifetimeValue([], [customer()]);
  assert.equal(ltv.totalKobo, 0);
  assert.equal(ltv.customerCount, 0);
  assert.equal(ltv.averageKobo, 0);
  assert.equal(ltv.averagePurchases, 0);
  assertNoNaN(ltv);
});

test("customerLifetimeValue: averages spend across buying customers only", () => {
  const customers = [customer({ id: "cus_a" }), customer({ id: "cus_b" }), customer({ id: "cus_never_bought" })];
  const sales = [
    sale({ id: "s1", customerId: "cus_a", totalKobo: 100_000 }),
    sale({ id: "s2", customerId: "cus_a", totalKobo: 300_000 }),
    sale({ id: "s3", customerId: "cus_b", totalKobo: 200_000 }),
    sale({ id: "s4", customerId: null, totalKobo: 999_000 }),
  ];
  const ltv = customerLifetimeValue(sales, customers);
  assert.equal(ltv.customerCount, 2); // the non-buyer is not in the denominator
  assert.equal(ltv.totalKobo, 600_000);
  assert.equal(ltv.averageKobo, 300_000);
  assert.equal(ltv.averagePurchases, 1.5);
  assert.equal(ltv.topCustomerKobo, 400_000);
});

test("retentionRate: no customers at all is 0%, not NaN", () => {
  const rate = retentionRate([], [], [], NOW, 30);
  assert.equal(rate.ratePct, 0);
  assert.equal(rate.totalCustomers, 0);
  assertNoNaN(rate);
});

test("retentionRate: a second visit inside the window makes a customer retained", () => {
  const customers = [customer({ id: "cus_loyal" }), customer({ id: "cus_once" })];
  const sales = [
    sale({ id: "s1", customerId: "cus_loyal", createdAt: at(20) }),
    sale({ id: "s2", customerId: "cus_loyal", createdAt: at(3) }),
    sale({ id: "s3", customerId: "cus_once", createdAt: at(5) }),
  ];
  const rate = retentionRate(customers, sales, [], NOW, 30);
  assert.equal(rate.totalCustomers, 2);
  assert.equal(rate.retainedCount, 1);
  assert.equal(rate.ratePct, 50);
});

test("retentionRate: all-time mode (days = 0) sees visits outside any window", () => {
  const customers = [customer({ id: "cus_loyal" })];
  const sales = [
    sale({ id: "s1", customerId: "cus_loyal", createdAt: at(400) }),
    sale({ id: "s2", customerId: "cus_loyal", createdAt: at(300) }),
  ];
  const rate = retentionRate(customers, sales, [], NOW, 0);
  assert.equal(rate.retainedCount, 1);
  assert.equal(rate.ratePct, 100);
  assert.equal(rate.activeCount, 1);
});

test("retentionRate: a booking and a sale on the same day are one visit, not two", () => {
  const customers = [customer({ id: "cus_a" })];
  const sales = [sale({ id: "s1", customerId: "cus_a", createdAt: at(4, 11) })];
  const bookings = [booking({ customerId: "cus_a", startsAt: at(4, 10), status: "completed" })];
  const rate = retentionRate(customers, sales, bookings, NOW, 30);
  // One trip that produced two rows (the service and the product) is one
  // visit — this customer has not "come back".
  assert.equal(rate.activeCount, 1);
  assert.equal(rate.totalCustomers, 1);
  assert.equal(rate.retainedCount, 0);
  assert.equal(rate.ratePct, 0);
});

test("retentionRate: the same customer on two different days counts as a return", () => {
  const customers = [customer({ id: "cus_a" })];
  const sales = [sale({ id: "s1", customerId: "cus_a", createdAt: at(10, 11) })];
  const bookings = [booking({ customerId: "cus_a", startsAt: at(3, 10), status: "completed" })];
  const rate = retentionRate(customers, sales, bookings, NOW, 30);
  assert.equal(rate.totalCustomers, 1);
  assert.equal(rate.retainedCount, 1);
  assert.equal(rate.ratePct, 100);
});

test("retentionRate: a first visit before the window keeps the customer out of it", () => {
  const customers = [customer({ id: "cus_a" })];
  const sales = [
    sale({ id: "s1", customerId: "cus_a", createdAt: at(90) }),
    sale({ id: "s2", customerId: "cus_a", createdAt: at(2) }),
  ];
  const rate = retentionRate(customers, sales, [], NOW, 30);
  assert.equal(rate.totalCustomers, 0);
  assert.equal(rate.ratePct, 0);
});

/* ------------------------------------------------------------------ */
/* Catalogue                                                           */
/* ------------------------------------------------------------------ */

test("topServicesByRevenue: empty input returns an empty list", () => {
  assert.deepEqual(topServicesByRevenue([], [], 5), []);
});

test("topServicesByRevenue: ranks by revenue, uses the service's name, ignores products", () => {
  const services = [service({ id: "svc_a", name: "Braiding" }), service({ id: "svc_b", name: "Haircut" })];
  const items = [
    saleItem({ id: "i1", kind: "service", refId: "svc_a", totalKobo: 800_000 }),
    saleItem({ id: "i2", kind: "service", refId: "svc_a", quantity: 2, totalKobo: 400_000 }),
    saleItem({ id: "i3", kind: "service", refId: "svc_b", totalKobo: 500_000 }),
    saleItem({ id: "i4", kind: "product", refId: "prd_a", totalKobo: 9_000_000 }),
  ];
  const top = topServicesByRevenue(items, services, 5);
  assert.equal(top.length, 2);
  assert.equal(top[0].serviceId, "svc_a");
  assert.equal(top[0].name, "Braiding");
  assert.equal(top[0].revenueKobo, 1_200_000);
  assert.equal(top[0].unitsSold, 3);
  assert.equal(top[1].revenueKobo, 500_000);
});

test("topServicesByRevenue: honours the limit", () => {
  const services = [service({ id: "svc_a" }), service({ id: "svc_b" })];
  const items = [saleItem({ refId: "svc_a", totalKobo: 200_000 }), saleItem({ refId: "svc_b", totalKobo: 100_000 })];
  assert.equal(topServicesByRevenue(items, services, 1).length, 1);
});

test("topProductsByUnits: ranks by units sold, not by revenue", () => {
  const products = [product({ id: "prd_a", name: "Wig Cap" }), product({ id: "prd_b", name: "Hair Bundle" })];
  const items = [
    saleItem({ id: "i1", kind: "product", refId: "prd_a", quantity: 20, totalKobo: 1_000_000 }),
    saleItem({ id: "i2", kind: "product", refId: "prd_b", quantity: 3, totalKobo: 7_500_000 }),
    saleItem({ id: "i3", kind: "service", refId: "svc_a", quantity: 9, totalKobo: 9_000_000 }),
  ];
  const top = topProductsByUnits(items, products, 5);
  assert.equal(top.length, 2);
  assert.equal(top[0].productId, "prd_a");
  assert.equal(top[0].quantity, 20);
  assert.equal(top[0].revenueKobo, 1_000_000);
  assert.equal(top[1].quantity, 3);
});

test("topProductsByUnits: empty input returns an empty list", () => {
  assert.deepEqual(topProductsByUnits([], [], 5), []);
});

test("deadStock: empty input is an empty, NaN-free summary", () => {
  const dead = deadStock([], [], [], NOW, 60);
  assert.deepEqual(dead.rows, []);
  assert.equal(dead.totalValueAtCostKobo, 0);
  assert.equal(dead.totalRetailValueKobo, 0);
  assertNoNaN(dead);
});

test("deadStock: stock with no sale in the window is money on the shelf, valued at cost", () => {
  const products = [product({ id: "prd_slow", name: "Nail Art Set", stockQty: 5, costKobo: 250_000, priceKobo: 450_000 })];
  const sales = [sale({ id: "sl_old", createdAt: at(90) })];
  const items = [saleItem({ kind: "product", refId: "prd_slow", saleId: "sl_old", quantity: 1, totalKobo: 450_000 })];

  const dead = deadStock(products, items, sales, NOW, 60);
  assert.equal(dead.rows.length, 1);
  assert.equal(dead.rows[0].name, "Nail Art Set");
  assert.equal(dead.rows[0].valueAtCostKobo, 1_250_000); // 5 × ₦2,500, what was actually spent
  assert.equal(dead.rows[0].retailValueKobo, 2_250_000); // the hope, not the fact
  assert.equal(dead.rows[0].daysSinceLastSale, 90);
  assert.equal(dead.totalValueAtCostKobo, 1_250_000);
});

test("deadStock: a product that has never sold is dead stock (null days, worst case)", () => {
  const products = [product({ id: "prd_never", stockQty: 3, costKobo: 100_000, priceKobo: 200_000 })];
  const dead = deadStock(products, [], [], NOW, 60);
  assert.equal(dead.rows.length, 1);
  assert.equal(dead.rows[0].daysSinceLastSale, null);
  assert.equal(dead.totalValueAtCostKobo, 300_000);
});

test("deadStock: a product sold inside the window is not dead stock", () => {
  const products = [product({ id: "prd_fast", stockQty: 4, costKobo: 100_000 })];
  const sales = [sale({ id: "sl_new", createdAt: at(5) })];
  const items = [saleItem({ kind: "product", refId: "prd_fast", saleId: "sl_new", quantity: 1, totalKobo: 100_000 })];
  assert.equal(deadStock(products, items, sales, NOW, 60).rows.length, 0);
});

test("deadStock: the boundary is inclusive — a sale exactly 60 days ago is dead stock at days = 60", () => {
  const products = [product({ id: "prd_edge", stockQty: 1, costKobo: 100_000 })];
  const sales = [sale({ id: "sl_edge", createdAt: at(60) })];
  const items = [saleItem({ kind: "product", refId: "prd_edge", saleId: "sl_edge" })];
  const dead = deadStock(products, items, sales, NOW, 60);
  assert.equal(dead.rows.length, 1);
  assert.equal(dead.rows[0].daysSinceLastSale, 60);
});

test("deadStock: inactive products and zero stock are excluded", () => {
  const products = [
    product({ id: "prd_inactive", active: false, stockQty: 10, costKobo: 100_000 }),
    product({ id: "prd_empty", active: true, stockQty: 0, costKobo: 100_000 }),
    product({ id: "prd_real", active: true, stockQty: 2, costKobo: 100_000 }),
  ];
  const dead = deadStock(products, [], [], NOW, 30);
  assert.deepEqual(
    dead.rows.map((r) => r.productId),
    ["prd_real"],
  );
});

test("deadStock: only the most recent sale matters, and rows rank by value tied up", () => {
  const products = [
    product({ id: "prd_small", stockQty: 1, costKobo: 10_000 }),
    product({ id: "prd_big", stockQty: 10, costKobo: 500_000 }),
  ];
  const sales = [sale({ id: "sl_1", createdAt: at(80) }), sale({ id: "sl_2", createdAt: at(200) })];
  const items = [saleItem({ kind: "product", refId: "prd_big", saleId: "sl_1" }), saleItem({ kind: "product", refId: "prd_big", saleId: "sl_2" })];
  const dead = deadStock(products, items, sales, NOW, 60);
  // prd_big's most recent sale is 80 days ago (not 200), so it is still dead.
  assert.equal(dead.rows[0].productId, "prd_big");
  assert.equal(dead.rows[0].daysSinceLastSale, 80);
  assert.equal(dead.rows[1].productId, "prd_small");
});

/* ------------------------------------------------------------------ */
/* Costs & profit                                                      */
/* ------------------------------------------------------------------ */

test("profitAndLoss: empty input returns zeroed months ending with this one", () => {
  const months = profitAndLoss([], [], NOW, 3);
  assert.equal(months.length, 3);
  assert.ok(months.every((m) => m.revenueKobo === 0 && m.expensesKobo === 0 && m.grossProfitKobo === 0 && m.marginPct === 0));
  assert.equal(months[2].month, "2025-09");
  assert.equal(months[0].month, "2025-07");
  assertNoNaN(months);
});

test("profitAndLoss: buckets by month across the year boundary", () => {
  const january = new Date(2026, 0, 15, 12);
  const months = profitAndLoss([], [], january, 3);
  assert.deepEqual(
    months.map((m) => m.month),
    ["2025-11", "2025-12", "2026-01"],
  );
});

test("profitAndLoss: revenue, expenses and gross profit per month", () => {
  const months = profitAndLoss(
    [
      sale({ id: "s1", totalKobo: 1_000_000, createdAt: at(45) }), // August
      sale({ id: "s2", totalKobo: 2_000_000, createdAt: at(2) }), // September
    ],
    [
      expense({ id: "e1", amountKobo: 500_000, date: at(40) }), // August
      expense({ id: "e2", amountKobo: 900_000, date: at(1) }), // September
    ],
    NOW,
    2,
  );
  assert.equal(months[0].label.length > 0, true);
  assert.equal(months[0].revenueKobo, 1_000_000);
  assert.equal(months[0].expensesKobo, 500_000);
  assert.equal(months[0].grossProfitKobo, 500_000);
  assert.equal(months[0].marginPct, 50);
  assert.equal(months[1].revenueKobo, 2_000_000);
  assert.equal(months[1].expensesKobo, 900_000);
  assert.equal(months[1].grossProfitKobo, 1_100_000);
  assert.equal(months[1].marginPct, 55);
});

test("profitAndLoss: a losing month reports a negative profit and margin", () => {
  const months = profitAndLoss([sale({ totalKobo: 100_000, createdAt: at(1) })], [expense({ amountKobo: 400_000, date: at(1) })], NOW, 1);
  assert.equal(months[0].grossProfitKobo, -300_000);
  assert.equal(months[0].marginPct, -300);
});

test("profitAndLoss: monthCount 0 returns nothing rather than throwing", () => {
  assert.deepEqual(profitAndLoss([sale()], [expense()], NOW, 0), []);
  assert.deepEqual(profitAndLoss([sale()], [expense()], NOW, -2), []);
});

test("expenseBreakdown: no expenses is a zeroed, NaN-free summary", () => {
  const breakdown = expenseBreakdown([], NOW, 30);
  assert.equal(breakdown.totalKobo, 0);
  assert.deepEqual(breakdown.rows, []);
  assert.equal(breakdown.topCategory, null);
  assertNoNaN(breakdown);
});

test("expenseBreakdown: groups by category, largest first, with shares", () => {
  const breakdown = expenseBreakdown(
    [
      expense({ id: "e1", category: "rent", amountKobo: 1_500_000, date: at(4) }),
      expense({ id: "e2", category: "staff", amountKobo: 600_000, date: at(6) }),
      expense({ id: "e3", category: "staff", amountKobo: 600_000, date: at(6) }),
      expense({ id: "e4", category: "electricity", amountKobo: 300_000, date: at(2) }),
    ],
    NOW,
    30,
  );
  assert.equal(breakdown.totalKobo, 3_000_000);
  assert.equal(breakdown.rows.length, 3);
  assert.equal(breakdown.rows[0].category, "rent");
  assert.equal(breakdown.rows[0].sharePct, 50);
  assert.equal(breakdown.rows[0].label, "Rent");
  assert.equal(breakdown.rows[1].category, "staff");
  assert.equal(breakdown.rows[1].amountKobo, 1_200_000);
  assert.equal(breakdown.rows[1].count, 2);
  assert.equal(breakdown.rows[1].sharePct, 40);
  assert.equal(breakdown.topCategory, "rent");
});

test("expenseBreakdown: the day window excludes older expenses", () => {
  const breakdown = expenseBreakdown(
    [expense({ id: "e1", category: "rent", amountKobo: 100_000, date: at(40) }), expense({ id: "e2", category: "marketing", amountKobo: 50_000, date: at(5) })],
    NOW,
    30,
  );
  assert.equal(breakdown.totalKobo, 50_000);
  assert.deepEqual(
    breakdown.rows.map((r) => r.category),
    ["marketing"],
  );
});

test("expenseBreakdown: days = 0 means all time", () => {
  const breakdown = expenseBreakdown([expense({ amountKobo: 100_000, date: at(400) })], NOW, 0);
  assert.equal(breakdown.totalKobo, 100_000);
});

test("averageSaleValue: no sales is 0, not NaN", () => {
  assert.equal(averageSaleValue([]), 0);
});

test("averageSaleValue: means the sale totals and rounds to the kobo", () => {
  assert.equal(averageSaleValue([sale({ totalKobo: 100_000 }), sale({ totalKobo: 200_001 })]), 150_001);
  assert.equal(averageSaleValue([sale({ totalKobo: 100 })]), 100);
});

/* ------------------------------------------------------------------ */
/* Business health                                                     */
/* ------------------------------------------------------------------ */

const EMPTY_INPUT = { sales: [], expenses: [], invoices: [], customers: [], bookings: [], now: NOW };

test("businessHealthScore: no data scores a neutral 50 with all five components explained", () => {
  const health = businessHealthScore(EMPTY_INPUT);
  assert.equal(health.components.length, 5);
  assert.equal(health.score, 50);
  assert.equal(health.band, "fair");
  assert.equal(health.bandLabel, "Needs attention");
  assert.ok(health.components.every((c) => c.score === 50));
  assert.ok(health.components.every((c) => c.detail.length > 0));
  assert.equal(
    Math.round(health.components.reduce((sum, c) => sum + c.weight, 0) * 100) / 100,
    1,
  );
  assertNoNaN(health);
});

test("businessHealthScore: components are weighted exactly as documented", () => {
  const weights = Object.fromEntries(businessHealthScore(EMPTY_INPUT).components.map((c) => [c.key, c.weight]));
  assert.deepEqual(weights, {
    collection: 0.25,
    repeat: 0.2,
    revenue_trend: 0.2,
    expense_ratio: 0.2,
    no_show: 0.15,
  });
});

test("businessHealthScore: a perfect business scores 100", () => {
  const health = businessHealthScore({
    now: NOW,
    // Collection: 1 of 1 paid.
    invoices: [invoice({ id: "i1", status: "paid", paidAt: at(1) })],
    // Repeat: the only customer has two visits.
    customers: [customer({ id: "cus_a", createdAt: at(200) })],
    sales: [
      sale({ id: "s1", customerId: "cus_a", totalKobo: 300_000, createdAt: at(40) }),
      sale({ id: "s2", customerId: "cus_a", totalKobo: 600_000, createdAt: at(10) }),
    ],
    expenses: [expense({ amountKobo: 100_000, date: at(5) })],
    // No-show: all completed.
    bookings: [
      booking({ id: "b1", startsAt: at(5), status: "completed" }),
      booking({ id: "b2", startsAt: at(3), status: "completed" }),
    ],
  });
  assert.equal(health.score, 100);
  assert.equal(health.band, "excellent");
  assert.equal(health.bandLabel, "Excellent");
});

test("businessHealthScore: component maths — collection, trend and expense ratio", () => {
  const health = businessHealthScore({
    now: NOW,
    invoices: [
      invoice({ id: "i1", status: "paid", paidAt: at(2) }),
      invoice({ id: "i2", status: "pending", dueDate: dayKey(3) }),
      invoice({ id: "i3", status: "pending", dueDate: dayKey(5) }),
    ],
    customers: [customer({ id: "cus_a", createdAt: at(200) })],
    sales: [
      sale({ id: "s1", customerId: "cus_a", totalKobo: 1_000_000, createdAt: at(40) }),
      sale({ id: "s2", customerId: "cus_a", totalKobo: 1_500_000, createdAt: at(10) }),
    ],
    expenses: [expense({ amountKobo: 300_000, date: at(5) })],
    bookings: [booking({ id: "b1", startsAt: at(5), status: "completed" })],
  });

  const byKey = Object.fromEntries(health.components.map((c) => [c.key, c]));

  // 1 of 3 invoices paid.
  assert.equal(byKey.collection.score, 33);
  assert.equal(byKey.collection.valuePct, 33.3);

  // +50% on the prior 30 days → 50 + 50.
  assert.equal(byKey.revenue_trend.score, 100);
  assert.equal(byKey.revenue_trend.valuePct, 50);

  // Expenses are 20% of revenue — under the 50% cliff, so full marks.
  assert.equal(byKey.expense_ratio.score, 100);

  // One customer, two all-time visits → retained.
  assert.equal(byKey.repeat.score, 100);
  assert.equal(byKey.repeat.valuePct, 100);

  // The maths must be the documented weighted average, not a guess.
  const expected = Math.round(33 * 0.25 + 100 * 0.2 + 100 * 0.2 + 100 * 0.2 + 100 * 0.15);
  assert.equal(health.score, expected);
  assert.equal(health.score, 83);
});

test("businessHealthScore: no-show rate drives its component down", () => {
  const health = businessHealthScore({
    ...EMPTY_INPUT,
    bookings: [
      booking({ id: "b1", status: "completed" }),
      booking({ id: "b2", status: "completed" }),
      booking({ id: "b3", status: "no_show" }),
      booking({ id: "b4", status: "no_show" }),
    ],
  });
  const noShow = health.components.find((c) => c.key === "no_show");
  assert.equal(noShow.valuePct, 50);
  assert.equal(noShow.score, 50);
});

test("businessHealthScore: a falling revenue trend scores below neutral", () => {
  const health = businessHealthScore({
    ...EMPTY_INPUT,
    sales: [
      sale({ id: "s1", totalKobo: 1_000_000, createdAt: at(40) }),
      sale({ id: "s2", totalKobo: 500_000, createdAt: at(10) }),
    ],
  });
  const trend = health.components.find((c) => c.key === "revenue_trend");
  assert.equal(trend.valuePct, -50);
  assert.equal(trend.score, 0); // 50 - 50
  // Both sales are walk-ins, so repeat is neutral (50). No expenses are
  // recorded at all, so the expense ratio is a perfect 100 (nothing going
  // out against ₦1.5m coming in) — a real limitation of that signal worth
  // knowing: an owner who doesn't log expenses is flattered by it.
  assert.equal(health.components.find((c) => c.key === "repeat").score, 50);
  assert.equal(health.components.find((c) => c.key === "expense_ratio").score, 100);
  // 50×0.25 + 50×0.2 + 0×0.2 + 100×0.2 + 50×0.15 = 50.
  assert.equal(health.score, 50);
});

test("businessHealthScore: spending with no revenue is the worst expense ratio", () => {
  const health = businessHealthScore({ ...EMPTY_INPUT, expenses: [expense({ amountKobo: 500_000, date: at(3) })] });
  const ratio = health.components.find((c) => c.key === "expense_ratio");
  assert.equal(ratio.score, 0);
  assert.equal(ratio.valuePct, 0); // no revenue to divide by — reported as 0, not NaN
});

test("businessHealthScore: expenses above 50% of revenue are penalised proportionally", () => {
  const health = businessHealthScore({
    ...EMPTY_INPUT,
    sales: [sale({ totalKobo: 1_000_000, createdAt: at(5) })],
    expenses: [expense({ amountKobo: 750_000, date: at(5) })],
  });
  const ratio = health.components.find((c) => c.key === "expense_ratio");
  assert.equal(ratio.valuePct, 75);
  assert.equal(ratio.score, 50); // 100 - (75 - 50) × 2
});

test("businessHealthScore: a cluster of over-60-day debts drags the score into at-risk", () => {
  const health = businessHealthScore({
    now: NOW,
    invoices: [
      invoice({ id: "i1", status: "overdue", totalKobo: 500_000, dueDate: dayKey(90) }),
      invoice({ id: "i2", status: "overdue", totalKobo: 500_000, dueDate: dayKey(70) }),
      invoice({ id: "i3", status: "overdue", totalKobo: 500_000, dueDate: dayKey(65) }),
    ],
    customers: [customer({ id: "cus_a" })],
    sales: [sale({ customerId: "cus_a", totalKobo: 500_000, createdAt: at(40) }), sale({ customerId: "cus_a", totalKobo: 200_000, createdAt: at(5) })],
    expenses: [],
    bookings: [booking({ status: "no_show" })],
  });
  assert.equal(health.components.find((c) => c.key === "collection").valuePct, 0);
  assert.equal(health.band, "at_risk");
  assert.ok(health.score < 45);
});

test("businessHealthScore: headline names the weakest signal and never NaN", () => {
  const health = businessHealthScore({
    ...EMPTY_INPUT,
    invoices: [invoice({ id: "i1", status: "overdue", totalKobo: 100_000, dueDate: dayKey(120) })],
  });
  assert.match(health.headline, /collection rate/i);
  assert.ok(!/NaN/.test(health.headline));
  assertNoNaN(health);
});
