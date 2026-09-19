"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/app/page-header";
import { FilterTabs } from "@/components/app/filter-tabs";
import { StatTile } from "@/components/app/stat-tile";
import { EmptyState } from "@/components/app/empty-state";
import { useBusinessStore } from "@/lib/store";
import { formatKobo } from "@/lib/format";
import {
  bookingCountsInRange,
  lowStockProducts,
  outstandingInvoices,
  outstandingTotalKobo,
  salesInRangeTotalKobo,
  salesTrendInRange,
  expensesInRangeTotalKobo,
  topProductsInRange,
  topServicesInRange,
  type ReportRange,
} from "@/lib/selectors";
import { bookingStatusMeta, StatusPill, type Tone } from "@/components/app/status-pill";

// Maps each semantic tone (already used for status pills app-wide) to the
// matching CSS color variable, so chart colors stay in lockstep with the
// rest of the UI — including automatically adapting under dark mode, since
// these variables are redefined there rather than the chart hardcoding hex.
const TONE_COLOR: Record<Tone, string> = {
  primary: "var(--color-primary)",
  info: "var(--color-info)",
  accent: "var(--color-accent)",
  danger: "var(--color-danger)",
  neutral: "var(--color-ink-faint)",
};

const axisTick = { fill: "var(--color-ink-muted)", fontSize: 11 };

const RANGE_LABEL: Record<ReportRange, string> = { today: "Today", week: "This week", month: "This month" };

export default function ReportsPage() {
  const data = useBusinessStore((s) => s.data);
  const [range, setRange] = useState<ReportRange>("week");
  const now = new Date();

  const salesTotal = salesInRangeTotalKobo(data.sales, range, now);
  const expensesTotal = expensesInRangeTotalKobo(data.expenses, range, now);
  const net = salesTotal - expensesTotal;
  const outstanding = outstandingTotalKobo(data.invoices);
  const outstandingCount = outstandingInvoices(data.invoices).length;
  const bookingStats = bookingCountsInRange(data.bookings, range, now);
  const trend = salesTrendInRange(data.sales, data.expenses, range, now);
  const bookingChartData = (Object.keys(bookingStats.counts) as Array<keyof typeof bookingStats.counts>)
    .filter((status) => bookingStats.counts[status] > 0)
    .map((status) => {
      const meta = bookingStatusMeta(status);
      return { status, label: meta.label, value: bookingStats.counts[status], color: TONE_COLOR[meta.tone] };
    });
  const topServices = topServicesInRange(data.bookings, data.services, range, now);
  const topProducts = topProductsInRange(data, range, now);
  const lowStock = lowStockProducts(data.products);

  const hasAnyData = data.sales.length > 0 || data.bookings.length > 0 || data.expenses.length > 0;

  if (!hasAnyData) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Reports" />
        <EmptyState
          icon={<BarChart3 className="size-6 text-primary-strong" />}
          title="Nothing to report yet"
          description="Once you record sales, bookings and expenses, your numbers will show up here."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Reports" />

      <FilterTabs<ReportRange>
        options={[
          { value: "today", label: "Today" },
          { value: "week", label: "This week" },
          { value: "month", label: "This month" },
        ]}
        value={range}
        onChange={setRange}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={`Sales · ${RANGE_LABEL[range]}`} value={formatKobo(salesTotal)} rule="primary" />
        <StatTile label={`Expenses · ${RANGE_LABEL[range]}`} value={formatKobo(expensesTotal)} rule="danger" />
        <StatTile label="Net" value={formatKobo(net)} rule={net >= 0 ? "primary" : "danger"} />
        <StatTile
          label="Outstanding"
          value={formatKobo(outstanding)}
          sub={outstandingCount ? `${outstandingCount} invoice${outstandingCount > 1 ? "s" : ""}` : undefined}
          rule="accent"
        />
      </div>

      <section>
        <h2 className="mb-3 font-display text-base font-semibold text-ink">Sales vs. expenses · {RANGE_LABEL[range]}</h2>
        {salesTotal === 0 && expensesTotal === 0 ? (
          <p className="text-sm text-ink-muted">No sales or expenses in this period.</p>
        ) : (
          <div className="h-56 w-full rounded-2xl border border-border p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} barGap={2} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--color-border)" }} interval="preserveStartEnd" />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} width={40} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <Tooltip
                  formatter={(value) => formatKobo(Number(value ?? 0))}
                  contentStyle={{ background: "var(--color-paper)", border: "1px solid var(--color-border)", borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: "var(--color-ink)" }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="salesKobo" name="Sales" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expensesKobo" name="Expenses" fill="var(--color-danger)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-base font-semibold text-ink">Booking performance · {RANGE_LABEL[range]}</h2>
        {bookingStats.total === 0 ? (
          <p className="text-sm text-ink-muted">No bookings in this period.</p>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="h-44 w-full shrink-0 sm:w-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={bookingChartData} dataKey="value" nameKey="label" innerRadius="60%" outerRadius="90%" paddingAngle={2} stroke="var(--color-paper)">
                    {bookingChartData.map((row) => (
                      <Cell key={row.status} fill={row.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--color-paper)", border: "1px solid var(--color-border)", borderRadius: 10, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-1 flex-wrap gap-2">
              {bookingChartData.map((row) => (
                <div key={row.status} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2">
                  <StatusPill tone={bookingStatusMeta(row.status).tone}>{row.label}</StatusPill>
                  <span className="text-sm font-semibold text-ink">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-display text-base font-semibold text-ink">Top services · {RANGE_LABEL[range]}</h2>
          {topServices.length === 0 ? (
            <p className="text-sm text-ink-muted">No completed bookings in this period yet.</p>
          ) : (
            <div className="divide-y divide-border rounded-2xl border border-border">
              {topServices.map(({ service, count }) => (
                <div key={service.id} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm font-medium text-ink">{service.name}</span>
                  <span className="text-xs font-medium text-ink-muted">{count} completed</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-display text-base font-semibold text-ink">Top products · {RANGE_LABEL[range]}</h2>
          {topProducts.length === 0 ? (
            <p className="text-sm text-ink-muted">No product sales in this period yet.</p>
          ) : (
            <div className="divide-y divide-border rounded-2xl border border-border">
              {topProducts.map(({ product, quantity }) => (
                <div key={product.id} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm font-medium text-ink">{product.name}</span>
                  <span className="text-xs font-medium text-ink-muted">{quantity} sold</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section>
        <h2 className="mb-3 font-display text-base font-semibold text-ink">Inventory</h2>
        {lowStock.length === 0 ? (
          <p className="text-sm text-ink-muted">No products are low on stock.</p>
        ) : (
          <div className="divide-y divide-border rounded-2xl border border-border">
            {lowStock.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-medium text-ink">{p.name}</span>
                <StatusPill tone="danger">{`${p.stockQty} left`}</StatusPill>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
