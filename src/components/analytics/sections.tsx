"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/app/empty-state";
import { Card, RankedBar } from "@/components/analytics/card";
import { bookingStatusMeta, type Tone } from "@/components/app/status-pill";
import { formatKobo } from "@/lib/format";
import type {
  BookingStatusSlice,
  BusinessHealthScore,
  DayBucket,
  DeadStockSummary,
  ExpenseBreakdown,
  HourBucket,
  NoShowRate,
  OutstandingSummary,
  PaymentMixSlice,
  ProfitLossMonth,
  RevenuePoint,
  TopCustomer,
  TopProduct,
  TopService,
} from "@/lib/analytics";

/* ------------------------------------------------------------------ */
/* Shared chart styling                                                */
/* ------------------------------------------------------------------ */

const axisTick = { fill: "var(--color-ink-muted)", fontSize: 11 };

const tooltipStyle = {
  background: "var(--color-paper)",
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  fontSize: 12,
};

/** Recharts hands values back as `ValueType`; this narrows without lying. */
function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Compact Naira for chart axes only ("₦1.2m", "₦450k"). Full `formatKobo`
 * is used everywhere a person reads an exact figure — an axis tick doesn't
 * need to spell out every naira, and at ₦2,500,000 it would eat the chart.
 */
export function compactKobo(kobo: number): string {
  const naira = kobo / 100;
  const abs = Math.abs(naira);
  if (abs >= 1_000_000) return `₦${(naira / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}m`;
  if (abs >= 1_000) return `₦${Math.round(naira / 1_000)}k`;
  return `₦${Math.round(naira)}`;
}

function pctLabel(value: number): string {
  return `${Math.round(value * 10) / 10}%`;
}

/* ------------------------------------------------------------------ */
/* Revenue trend                                                       */
/* ------------------------------------------------------------------ */

export function RevenueTrendSection({ points, periodLabel }: { points: RevenuePoint[]; periodLabel: string }) {
  const hasRevenue = points.some((p) => p.revenueKobo > 0);

  return (
    <Card title="Revenue trend" hint={`Takings per day over the last ${periodLabel.toLowerCase()}`}>
      {!hasRevenue ? (
        <EmptyState title="No sales in this period" description="Record a sale and the daily trend will draw itself here." />
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                {/* A soft fill rather than a flat block so the line reads as
                    the trend and the area as its weight. */}
                <linearGradient id="analyticsRevenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--color-border)" }} interval="preserveStartEnd" minTickGap={24} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => compactKobo(v)} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: "var(--color-ink)" }}
                formatter={(value) => [formatKobo(toNumber(value)), "Revenue"]}
              />
              <Area type="monotone" dataKey="revenueKobo" stroke="var(--color-primary)" strokeWidth={2} fill="url(#analyticsRevenueFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Outstanding & ageing                                                */
/* ------------------------------------------------------------------ */

const AGEING_TONE: Record<string, Tone> = {
  current: "info",
  days1to30: "accent",
  days31to60: "danger",
  days61plus: "danger",
};

export function AgeingSection({ summary }: { summary: OutstandingSummary }) {
  if (summary.count === 0) {
    return (
      <Card title="Outstanding & ageing" hint="Money customers still owe you">
        <EmptyState title="Nothing outstanding" description="Every invoice has been paid. Nothing to chase." />
      </Card>
    );
  }

  const max = Math.max(...summary.ageing.map((b) => b.amountKobo), 1);

  return (
    <Card title="Outstanding & ageing" hint={`${summary.count} unpaid invoice${summary.count > 1 ? "s" : ""}, by how long they're past due`}>
      <div className="flex items-end justify-between gap-3 rounded-xl bg-primary-soft px-3 py-2.5">
        <div>
          <div className="text-xs font-medium text-primary-strong">Total owed</div>
          <div className="font-display text-2xl font-bold tracking-tight text-primary-strong">{formatKobo(summary.totalKobo)}</div>
        </div>
        <div className="text-right text-xs text-primary-strong">
          <div>{summary.overduePct}% already overdue</div>
          {summary.largestKobo > 0 ? <div className="mt-0.5">Largest: {formatKobo(summary.largestKobo)}</div> : null}
        </div>
      </div>

      <div className="mt-2">
        {summary.ageing.map((bucket) => (
          <RankedBar
            key={bucket.key}
            label={bucket.label}
            value={(bucket.amountKobo / max) * 100}
            valueLabel={formatKobo(bucket.amountKobo)}
            tone={AGEING_TONE[bucket.key] === "danger" ? "danger" : AGEING_TONE[bucket.key] === "accent" ? "accent" : "info"}
            badge={
              bucket.count > 0 ? (
                <span className="shrink-0 rounded-full bg-surface-strong px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                  {bucket.count}
                </span>
              ) : null
            }
          />
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Payment mix                                                         */
/* ------------------------------------------------------------------ */

export function PaymentMixSection({ mix }: { mix: PaymentMixSlice[] }) {
  if (mix.length === 0) {
    return (
      <Card title="How customers paid">
        <EmptyState title="No payments yet" description="Once you take a payment, the cash / transfer / POS split appears here." />
      </Card>
    );
  }

  const max = Math.max(...mix.map((m) => m.totalKobo), 1);
  const tones: Record<string, "primary" | "info" | "accent" | "danger"> = { cash: "primary", transfer: "info", pos: "accent", other: "danger" };

  return (
    <Card title="How customers paid" hint="By payment method">
      <div>
        {mix.map((slice) => (
          <RankedBar
            key={slice.method}
            label={slice.label}
            value={(slice.totalKobo / max) * 100}
            valueLabel={formatKobo(slice.totalKobo)}
            sharePct={slice.sharePct}
            tone={tones[slice.method]}
            badge={<span className="shrink-0 text-[11px] text-ink-muted">{slice.count} sale{slice.count > 1 ? "s" : ""}</span>}
          />
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Booking status mix                                                  */
/* ------------------------------------------------------------------ */

/** Status-pill tones mapped onto the four bar colours. */
const TONE_TO_RANKED: Record<Tone, "primary" | "accent" | "info" | "danger"> = {
  primary: "primary",
  accent: "accent",
  info: "info",
  danger: "danger",
  neutral: "info",
};

export function BookingMixSection({ mix, noShow }: { mix: BookingStatusSlice[]; noShow: NoShowRate }) {
  if (mix.length === 0) {
    return (
      <Card title="Bookings">
        <EmptyState title="No bookings yet" description="Your booking statuses and no-show rate will show up here." />
      </Card>
    );
  }

  const max = Math.max(...mix.map((m) => m.count), 1);

  return (
    <Card
      title="Bookings"
      hint={
        // The denominator is spelled out because "20% no-show" off three
        // resolved bookings and off three hundred are different problems.
        noShow.resolvedCount > 0 ? `Status mix · no-show rate from ${noShow.resolvedCount} resolved bookings` : "Status mix"
      }
      action={<span className="shrink-0 rounded-full bg-danger-soft px-2.5 py-1 text-xs font-medium text-danger">{pctLabel(noShow.ratePct)} no-show</span>}
    >
      <div>
        {mix.map((slice) => (
          <RankedBar
            key={slice.status}
            label={slice.label}
            value={(slice.count / max) * 100}
            valueLabel={String(slice.count)}
            sharePct={slice.sharePct}
            tone={TONE_TO_RANKED[bookingStatusMeta(slice.status).tone]}
          />
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Catalogue                                                           */
/* ------------------------------------------------------------------ */

export function TopServicesSection({ rows }: { rows: TopService[] }) {
  return (
    <Card title="Top services" hint="By revenue, from what was actually sold">
      {rows.length === 0 ? (
        <EmptyState title="No service sales yet" description="Services you sell will be ranked here by revenue." />
      ) : (
        <div className="divide-y divide-border">
          {rows.map((row, index) => (
            <div key={row.serviceId} className="flex items-center justify-between gap-3 py-2.5">
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary-strong">{index + 1}</span>
                <span className="truncate text-sm font-medium text-ink">{row.name}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-semibold text-ink">{formatKobo(row.revenueKobo)}</span>
                <span className="block text-[11px] text-ink-muted">
                  {row.unitsSold} sold
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function TopProductsSection({ rows }: { rows: TopProduct[] }) {
  return (
    <Card title="Top products" hint="By units sold">
      {rows.length === 0 ? (
        <EmptyState title="No product sales yet" description="Retail items you sell will be ranked here by units." />
      ) : (
        <div className="divide-y divide-border">
          {rows.map((row, index) => (
            <div key={row.productId} className="flex items-center justify-between gap-3 py-2.5">
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-strong">{index + 1}</span>
                <span className="truncate text-sm font-medium text-ink">{row.name}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-semibold text-ink">{row.quantity} sold</span>
                <span className="block text-[11px] text-ink-muted">{formatKobo(row.revenueKobo)}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/** Best customers by spend — the "who keeps this place open" list. */
export function TopCustomersSection({ rows }: { rows: TopCustomer[] }) {
  return (
    <Card title="Best customers" hint="By total spend, all time">
      {rows.length === 0 ? (
        <EmptyState title="No customer sales yet" description="Sales tied to a customer will rank your best ones here." />
      ) : (
        <div className="divide-y divide-border">
          {rows.map((row, index) => (
            <div key={row.customerId} className="flex items-center justify-between gap-3 py-2.5">
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary-strong">{index + 1}</span>
                <span className="truncate text-sm font-medium text-ink">{row.name}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-semibold text-ink">{formatKobo(row.totalKobo)}</span>
                <span className="block text-[11px] text-ink-muted">
                  {row.purchaseCount} visit{row.purchaseCount > 1 ? "s" : ""} · {formatKobo(row.averageKobo)} avg
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Peak hours / busiest days                                           */
/* ------------------------------------------------------------------ */

export function PeakHoursSection({ hours, days }: { hours: HourBucket[]; days: DayBucket[] }) {
  // Hours are re-sorted into clock order for the chart: "busiest first" is
  // right for a list, but a bar chart that jumps 2pm → 9am → 5pm is unreadable.
  const byClock = [...hours].sort((a, b) => a.hour - b.hour);
  const dayOrder = [...days].sort((a, b) => a.weekday - b.weekday);

  return (
    <Card title="When you're busiest" hint="Bookings by hour of day, then by weekday">
      {hours.length === 0 && days.length === 0 ? (
        <EmptyState title="No bookings to plot" description="Once bookings come in, your peak hours and busiest days appear here." />
      ) : (
        <div className="flex flex-col gap-4">
          {byClock.length > 0 ? (
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byClock} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--color-border)" }} interval={0} />
                  <YAxis tick={axisTick} tickLine={false} axisLine={false} width={24} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${toNumber(value)} bookings`, ""]} />
                  <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}

          {dayOrder.length > 0 ? (
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dayOrder} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--color-border)" }} interval={0} tickFormatter={(v: string) => v.slice(0, 3)} />
                  <YAxis tick={axisTick} tickLine={false} axisLine={false} width={24} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${toNumber(value)} bookings`, ""]} />
                  <Bar dataKey="count" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Profit & loss                                                       */
/* ------------------------------------------------------------------ */

export function ProfitLossSection({ months }: { months: ProfitLossMonth[] }) {
  const hasAnything = months.some((m) => m.revenueKobo > 0 || m.expensesKobo > 0);

  return (
    <Card title="Profit & loss" hint="Revenue against expenses, month by month">
      {!hasAnything ? (
        <EmptyState title="No money recorded yet" description="Add sales and expenses and this monthly profit view fills in." />
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={months} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={2}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--color-border)" }} interval={0} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => compactKobo(v)} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: "var(--color-ink)" }}
                formatter={(value, name) => [formatKobo(toNumber(value)), name === "revenueKobo" ? "Revenue" : name === "expensesKobo" ? "Expenses" : "Profit"]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={(value: string) => (value === "revenueKobo" ? "Revenue" : value === "expensesKobo" ? "Expenses" : "Profit")} />
              <Bar dataKey="revenueKobo" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expensesKobo" fill="var(--color-danger)" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="grossProfitKobo" stroke="var(--color-accent)" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Expense breakdown                                                   */
/* ------------------------------------------------------------------ */

export function ExpenseBreakdownSection({ breakdown }: { breakdown: ExpenseBreakdown }) {
  if (breakdown.rows.length === 0) {
    return (
      <Card title="Where the money goes" hint="Expenses by category">
        <EmptyState title="No expenses in this period" description="Log rent, staff and supplies and the biggest cost shows up here." />
      </Card>
    );
  }

  const max = Math.max(...breakdown.rows.map((r) => r.amountKobo), 1);

  return (
    <Card title="Where the money goes" hint={`${formatKobo(breakdown.totalKobo)} of expenses in this period`}>
      <div>
        {breakdown.rows.map((row, index) => (
          <RankedBar
            key={row.category}
            label={row.label}
            value={(row.amountKobo / max) * 100}
            valueLabel={formatKobo(row.amountKobo)}
            sharePct={row.sharePct}
            tone={index === 0 ? "danger" : "accent"}
            badge={<span className="shrink-0 text-[11px] text-ink-muted">{row.count} item{row.count > 1 ? "s" : ""}</span>}
          />
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Dead stock                                                          */
/* ------------------------------------------------------------------ */

export function DeadStockSection({ summary, days }: { summary: DeadStockSummary; days: number }) {
  return (
    <Card
      title="Dead stock"
      hint={`Stock with no sales in ${days} days — money sitting on a shelf`}
      action={<span className="shrink-0 rounded-full bg-danger-soft px-2.5 py-1 text-xs font-medium text-danger">{formatKobo(summary.totalValueAtCostKobo)} tied up</span>}
    >
      <div className="divide-y divide-border">
        {summary.rows.map((row) => (
          <div key={row.productId} className="flex items-center justify-between gap-3 py-2.5">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink">{row.name}</span>
              <span className="block text-[11px] text-ink-muted">
                {row.stockQty} in stock · {row.category} ·{" "}
                {row.daysSinceLastSale === null ? "never sold" : `last sold ${row.daysSinceLastSale} days ago`}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-sm font-semibold text-danger">{formatKobo(row.valueAtCostKobo)}</span>
              <span className="block text-[11px] text-ink-muted">at cost</span>
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Business health                                                     */
/* ------------------------------------------------------------------ */

/**
 * The score and, more importantly, the five signals behind it. A number with
 * no explanation changes nobody's behaviour; "collection rate 33%" is a
 * phone call. Each row therefore carries its own weight, bar and sentence.
 */
export function HealthSection({ health }: { health: BusinessHealthScore }) {
  const tone = health.band === "excellent" || health.band === "good" ? "primary" : health.band === "fair" ? "accent" : "danger";
  const scoreColor = tone === "primary" ? "text-primary-strong" : tone === "accent" ? "text-accent-strong" : "text-danger";
  const barColor = tone === "primary" ? "bg-primary" : tone === "accent" ? "bg-accent" : "bg-danger";

  return (
    <Card title="Business health" hint="A weighted 0–100 score, with what moved it">
      <div className="flex items-center gap-4 rounded-xl bg-surface px-4 py-3">
        <div className={`font-display text-4xl font-bold tracking-tight ${scoreColor}`}>{health.score}</div>
        <div className="min-w-0">
          <div className={`font-display text-sm font-semibold ${scoreColor}`}>{health.bandLabel}</div>
          <p className="mt-0.5 text-xs text-ink-muted">{health.headline}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {health.components.map((component) => (
          <div key={component.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-ink">
                {component.label}
                <span className="ml-1.5 text-[11px] font-normal text-ink-faint">weight {Math.round(component.weight * 100)}%</span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-ink">
                {component.score}
                <span className="ml-1 text-[11px] font-normal text-ink-muted">/100</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-strong">
              {/* The component bar is its own 0–100 score, so a low bar is the
                  thing to act on — not a share of the composite. */}
              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.max(0, Math.min(100, component.score))}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-ink-muted">{component.detail}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
