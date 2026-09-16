"use client";

import Link from "next/link";
import { Banknote, CalendarPlus, Package, Sparkles, UserPlus } from "lucide-react";
import { StatTile } from "@/components/app/stat-tile";
import { StatusPill, bookingStatusMeta } from "@/components/app/status-pill";
import { useBusinessStore } from "@/lib/store";
import { formatKobo, formatLongDate, formatTime, firstName } from "@/lib/format";
import {
  customerName,
  outstandingInvoices,
  outstandingTotalKobo,
  popularServicesToday,
  recentActivity,
  serviceName,
  staffName,
  todaysBookings,
  todaysCustomerCount,
  todaysSalesTotalKobo,
  upcomingBookings,
} from "@/lib/selectors";

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const data = useBusinessStore((s) => s.data);
  const now = new Date();

  const today = todaysBookings(data.bookings, now);
  const upcoming = upcomingBookings(data.bookings, now, 3);
  const salesTotal = todaysSalesTotalKobo(data.sales, now);
  const customerCount = todaysCustomerCount(data.bookings, data.sales, now);
  const outstandingTotal = outstandingTotalKobo(data.invoices);
  const outstandingCount = outstandingInvoices(data.invoices).length;
  const popular = popularServicesToday(data.bookings, data.services, now).slice(0, 4);
  const activity = recentActivity(data, 6);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
          {greeting(now.getHours())}, {firstName(data.user.name)}
        </h1>
        <p className="mt-0.5 text-sm text-ink-muted">{formatLongDate(now)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Today's sales" value={formatKobo(salesTotal)} rule="primary" />
        <StatTile label="Bookings today" value={String(today.length)} rule="info" />
        <StatTile label="Customers today" value={String(customerCount)} rule="accent" />
        <StatTile
          label="Outstanding"
          value={formatKobo(outstandingTotal)}
          sub={outstandingCount ? `${outstandingCount} invoice${outstandingCount > 1 ? "s" : ""}` : undefined}
          rule="danger"
        />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-ink">Today&apos;s bookings</h2>
          <Link href="/business/bookings" className="text-sm font-medium text-primary">
            See all
          </Link>
        </div>
        {today.length === 0 ? (
          <p className="text-sm text-ink-muted">No bookings today yet.</p>
        ) : (
          <div className="divide-y divide-border rounded-2xl border border-border">
            {today.slice(0, 6).map((b) => {
              const meta = bookingStatusMeta(b.status);
              return (
                <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-14 shrink-0 text-sm font-semibold tabular-nums text-ink">
                    {formatTime(b.startsAt)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">
                      {customerName(data.customers, b.customerId)}
                    </div>
                    <div className="truncate text-xs text-ink-muted">
                      {serviceName(data.services, b.serviceId)} · {staffName(b.staffId)}
                    </div>
                  </div>
                  <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-display text-base font-semibold text-ink">Upcoming bookings</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-ink-muted">Nothing booked beyond today yet.</p>
          ) : (
            <div className="divide-y divide-border rounded-2xl border border-border">
              {upcoming.map((b) => (
                <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">
                      {customerName(data.customers, b.customerId)}
                    </div>
                    <div className="truncate text-xs text-ink-muted">{serviceName(data.services, b.serviceId)}</div>
                  </div>
                  <div className="shrink-0 text-xs font-medium text-ink-muted">
                    {formatLongDate(b.startsAt).split(",")[0]}, {formatTime(b.startsAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-display text-base font-semibold text-ink">Popular today</h2>
          {popular.length === 0 ? (
            <p className="text-sm text-ink-muted">No bookings yet to rank.</p>
          ) : (
            <div className="divide-y divide-border rounded-2xl border border-border">
              {popular.map(({ service, count }) => (
                <div key={service.id} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm font-medium text-ink">{service.name}</span>
                  <span className="text-xs font-medium text-ink-muted">
                    {count} booking{count > 1 ? "s" : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section>
        <h2 className="mb-3 font-display text-base font-semibold text-ink">Recent activity</h2>
        <div className="divide-y divide-border rounded-2xl border border-border">
          {activity.map((item) => (
            <div key={`${item.kind}-${item.id}`} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-ink">{item.label}</span>
              {"amountKobo" in item ? (
                <span className="text-sm font-semibold tabular-nums text-ink">{formatKobo(item.amountKobo)}</span>
              ) : (
                <StatusPill tone={bookingStatusMeta(item.status).tone}>{bookingStatusMeta(item.status).label}</StatusPill>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-base font-semibold text-ink">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <QuickAction href="/business/sales" icon={Banknote} label="New sale" />
          <QuickAction href="/business/bookings" icon={CalendarPlus} label="New booking" />
          <QuickAction href="/business/customers" icon={UserPlus} label="Add customer" />
          <QuickAction href="/business/products" icon={Package} label="Add product" />
        </div>
      </section>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Sparkles;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 rounded-2xl border border-border-strong bg-paper p-4 text-center hover:bg-surface"
    >
      <span className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
        <Icon className="size-4.5" />
      </span>
      <span className="text-xs font-medium text-ink">{label}</span>
    </Link>
  );
}
