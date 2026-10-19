"use client";

import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { FilterTabs } from "@/components/app/filter-tabs";
import { StatTile } from "@/components/app/stat-tile";
import { EmptyState } from "@/components/app/empty-state";
import { Card } from "@/components/analytics/card";
import { useBusinessStore } from "@/lib/store";
import { formatKobo } from "@/lib/format";
import {
  averageSaleValue,
  bookingStatusMix,
  busiestDays,
  businessHealthScore,
  customerLifetimeValue,
  deadStock,
  expenseBreakdown,
  monthOverMonth,
  newVsReturning,
  noShowRate,
  outstandingSummary,
  paymentMethodMix,
  peakHours,
  profitAndLoss,
  retentionRate,
  revenueTrend,
  topCustomers,
  topProductsByUnits,
  topServicesByRevenue,
} from "@/lib/analytics";
import {
  AgeingSection,
  BookingMixSection,
  DeadStockSection,
  ExpenseBreakdownSection,
  HealthSection,
  PaymentMixSection,
  PeakHoursSection,
  ProfitLossSection,
  RevenueTrendSection,
  TopCustomersSection,
  TopProductsSection,
  TopServicesSection,
} from "@/components/analytics/sections";

type Period = "7" | "30" | "90";

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

/** How many months the P&L should cover for each period selection. */
const PNL_MONTHS: Record<Period, number> = { "7": 3, "30": 6, "90": 12 };

/** The days of a period, as a number. */
function daysOf(period: Period): number {
  return Number(period);
}

export default function AnalyticsPage() {
  const data = useBusinessStore((s) => s.data);
  const [period, setPeriod] = useState<Period>("30");

  /**
   * `now` is read during render, exactly as the Reports page does it. Every
   * analytics function takes it as an argument rather than calling
   * `Date.now()` itself — that is what keeps them deterministic under test —
   * so the page is the one place a real clock is allowed in.
   */
  // Frozen for the mount. A clock read during render would change identity on
  // every render and invalidate every memo that depends on it, which would make
  // the whole analytics computation run on each keystroke. The date only needs
  // to be right to the day.
  const now = useMemo(() => new Date(), []);

  const days = daysOf(period);
  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? "30 days";

  const metrics = useMemo(() => {
    const revenue = revenueTrend(data.sales, now, days);
    const currentKobo = revenue.reduce((sum, p) => sum + p.revenueKobo, 0);
    const priorKobo = revenueTrend(data.sales, now, days * 2)
      .slice(0, days)
      .reduce((sum, p) => sum + p.revenueKobo, 0);

    return {
      revenue,
      currentKobo,
      priorKobo,
      /** Same-length period immediately before this one — the fair comparison. */
      revenueChange: monthOverMonth(now, priorKobo, currentKobo),
      outstanding: outstandingSummary(data.invoices, now),
      paymentMix: paymentMethodMix(data.sales),
      bookingMix: bookingStatusMix(data.bookings),
      noShow: noShowRate(data.bookings),
      hours: peakHours(data.bookings),
      busiest: busiestDays(data.bookings),
      topServices: topServicesByRevenue(data.saleItems, data.services, 5),
      topProducts: topProductsByUnits(data.saleItems, data.products, 5),
      topCustomers: topCustomers(data.sales, data.customers, 5),
      ltv: customerLifetimeValue(data.sales, data.customers),
      newReturning: newVsReturning(data.customers, data.sales, data.bookings, now, days),
      retention: retentionRate(data.customers, data.sales, data.bookings, now, 0),
      dead: deadStock(data.products, data.saleItems, data.sales, now, days),
      pnl: profitAndLoss(data.sales, data.expenses, now, PNL_MONTHS[period]),
      expenses: expenseBreakdown(data.expenses, now, days),
      averageSale: averageSaleValue(data.sales),
      health: businessHealthScore({
        sales: data.sales,
        expenses: data.expenses,
        invoices: data.invoices,
        customers: data.customers,
        bookings: data.bookings,
        now,
      }),
    };
    // `now` is deliberately not a dependency: it's a fresh Date every render,
    // so listing it would rebuild every derived number on every render while
    // changing nothing within a session. The period and the data are what
    // actually move these numbers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, period]);

  const hasAnyData = data.sales.length > 0 || data.bookings.length > 0 || data.expenses.length > 0 || data.invoices.length > 0;

  // Zero-state: a business that has just signed up. One honest, calm message
  // beats twelve empty cards with no explanation.
  if (!hasAnyData) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Analytics" />
        <EmptyState
          icon={<BarChart3 className="size-6 text-primary-strong" />}
          title="No numbers to analyse yet"
          description="Record a few sales, bookings and expenses and this page will fill in with trends, ageing, profit and a health score."
        />
      </div>
    );
  }

  const { revenueChange } = metrics;
  const repeatPct = metrics.retention.totalCustomers > 0 ? metrics.retention.ratePct : metrics.health.components.find((c) => c.key === "repeat")?.valuePct ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Analytics" />

      <FilterTabs<Period> options={PERIODS} value={period} onChange={setPeriod} />

      {/* The four numbers an owner checks first. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={`Revenue · ${periodLabel}`}
          value={formatKobo(metrics.currentKobo)}
          sub={
            revenueChange.priorKobo > 0
              ? `${revenueChange.changePct >= 0 ? "▲" : "▼"} ${Math.abs(revenueChange.changePct)}% vs previous ${periodLabel}`
              : `${formatKobo(metrics.averageSale)} average sale`
          }
          rule="primary"
        />
        <StatTile
          label="Money owed"
          value={formatKobo(metrics.outstanding.totalKobo)}
          sub={
            metrics.outstanding.count > 0
              ? `${metrics.outstanding.count} invoice${metrics.outstanding.count > 1 ? "s" : ""} · ${metrics.outstanding.overduePct}% overdue`
              : "Nothing outstanding"
          }
          rule={metrics.outstanding.totalKobo > 0 ? "accent" : "primary"}
        />
        <StatTile
          label="Repeat customers"
          value={`${Math.round(repeatPct * 10) / 10}%`}
          sub={
            metrics.retention.totalCustomers > 0
              ? `${metrics.retention.retainedCount} of ${metrics.retention.totalCustomers} came back`
              : "No customer history yet"
          }
          rule="info"
        />
        <StatTile
          label="Health score"
          value={`${metrics.health.score}/100`}
          sub={metrics.health.bandLabel}
          rule={metrics.health.band === "at_risk" ? "danger" : metrics.health.band === "fair" ? "accent" : "primary"}
        />
      </div>

      <RevenueTrendSection points={metrics.revenue} periodLabel={periodLabel} />

      <AgeingSection summary={metrics.outstanding} />

      <div className="grid gap-4 lg:grid-cols-2">
        <PaymentMixSection mix={metrics.paymentMix} />
        <BookingMixSection mix={metrics.bookingMix} noShow={metrics.noShow} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TopServicesSection rows={metrics.topServices} />
        <TopProductsSection rows={metrics.topProducts} />
      </div>

      <PeakHoursSection hours={metrics.hours} days={metrics.busiest} />

      <ProfitLossSection months={metrics.pnl} />

      <ExpenseBreakdownSection breakdown={metrics.expenses} />

      {/* Only shown when there actually is dead stock: an empty "no dead
          stock" card every day trains people to ignore the section. */}
      {metrics.dead.rows.length > 0 ? <DeadStockSection summary={metrics.dead} days={days} /> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <TopCustomersSection rows={metrics.topCustomers} />
        <Card title="Customer value" hint="What a customer is worth on average">
          <div className="grid grid-cols-2 gap-3">
            <ValueStat label="Average lifetime spend" value={formatKobo(metrics.ltv.averageKobo)} />
            <ValueStat label="Average purchases" value={String(metrics.ltv.averagePurchases)} />
            <ValueStat label="Buying customers" value={String(metrics.ltv.customerCount)} />
            <ValueStat label="New this period" value={String(metrics.newReturning.newCount)} />
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            {metrics.ltv.customerCount > 0
              ? `${metrics.newReturning.returningCount} returning customers this period, ${metrics.newReturning.newCount} new.`
              : "Sales tied to a customer build this picture over time."}
          </p>
        </Card>
      </div>

      <HealthSection health={metrics.health} />
    </div>
  );
}

/** A compact number inside the customer-value card. */
function ValueStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface px-3 py-2.5">
      <div className="text-[11px] font-medium text-ink-muted">{label}</div>
      <div className="mt-0.5 font-display text-lg font-bold tracking-tight text-ink">{value}</div>
    </div>
  );
}
