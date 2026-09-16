"use client";

import { useMemo, useState } from "react";
import { isSameDay } from "date-fns";
import { Check, Pencil, Plus, CalendarClock, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { SearchInput } from "@/components/app/search-input";
import { FilterTabs } from "@/components/app/filter-tabs";
import { EmptyState } from "@/components/app/empty-state";
import { StatusPill, bookingStatusMeta } from "@/components/app/status-pill";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { BookingForm } from "@/components/bookings/booking-form";
import { useBusinessStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import { customerName, serviceName, staffName } from "@/lib/selectors";
import { formatShortDate, formatTime } from "@/lib/format";
import type { Booking } from "@/lib/types";

type Tab = "today" | "upcoming" | "past" | "all";

export default function BookingsPage() {
  const data = useBusinessStore((s) => s.data);
  const addBooking = useBusinessStore((s) => s.addBooking);
  const updateBooking = useBusinessStore((s) => s.updateBooking);
  const deleteBooking = useBusinessStore((s) => s.deleteBooking);
  const showToast = useToastStore((s) => s.show);

  const [tab, setTab] = useState<Tab>("today");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [deleting, setDeleting] = useState<Booking | null>(null);

  const filtered = useMemo(() => {
    const now = new Date();
    const byTab = data.bookings.filter((b) => {
      const t = new Date(b.startsAt);
      if (tab === "today") return isSameDay(t, now);
      if (tab === "upcoming") return t.getTime() > now.getTime() && !isSameDay(t, now);
      if (tab === "past") return t.getTime() < now.getTime() && !isSameDay(t, now);
      return true;
    });
    const q = query.trim().toLowerCase();
    const byQuery = q ? byTab.filter((b) => customerName(data.customers, b.customerId).toLowerCase().includes(q)) : byTab;
    return byQuery.sort((a, b) =>
      tab === "past" ? new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime() : new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
  }, [data.bookings, data.customers, tab, query]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Bookings"
        action={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> New
          </Button>
        }
      />

      {data.bookings.length > 0 ? (
        <>
          <FilterTabs<Tab>
            options={[
              { value: "today", label: "Today" },
              { value: "upcoming", label: "Upcoming" },
              { value: "past", label: "Past" },
              { value: "all", label: "All" },
            ]}
            value={tab}
            onChange={setTab}
          />
          <SearchInput value={query} onChange={setQuery} placeholder="Search by customer" />
        </>
      ) : null}

      {data.bookings.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="size-6 text-primary-strong" />}
          title="No bookings yet"
          description="Create your first booking to start filling up the calendar."
          action={<Button onClick={() => setAdding(true)}>New booking</Button>}
        />
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">Nothing here.</p>
      ) : (
        <div className="divide-y divide-border rounded-2xl border border-border">
          {filtered.map((b) => {
            const meta = bookingStatusMeta(b.status);
            const canComplete = b.status === "pending" || b.status === "confirmed";
            return (
              <div key={b.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-20 shrink-0 text-xs font-medium text-ink-muted">
                  {tab === "all" || tab === "upcoming" || tab === "past" ? formatShortDate(b.startsAt) : null}
                  <div className="text-sm font-semibold tabular-nums text-ink">{formatTime(b.startsAt)}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{customerName(data.customers, b.customerId)}</div>
                  <div className="truncate text-xs text-ink-muted">
                    {serviceName(data.services, b.serviceId)} · {staffName(b.staffId)}
                  </div>
                </div>
                <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                <div className="flex shrink-0 gap-1">
                  {canComplete ? (
                    <button
                      onClick={() => {
                        updateBooking(b.id, { status: "completed" });
                        showToast("Marked as completed");
                      }}
                      className="flex size-8 items-center justify-center rounded-lg text-primary hover:bg-primary-soft"
                      aria-label="Mark completed"
                    >
                      <Check className="size-4" />
                    </button>
                  ) : null}
                  <button onClick={() => setEditing(b)} className="flex size-8 items-center justify-center rounded-lg text-ink-muted hover:bg-surface" aria-label="Edit">
                    <Pencil className="size-4" />
                  </button>
                  <button onClick={() => setDeleting(b)} className="flex size-8 items-center justify-center rounded-lg text-danger hover:bg-danger-soft" aria-label="Delete">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title="New booking">
        <BookingForm
          customers={data.customers}
          services={data.services}
          onCancel={() => setAdding(false)}
          onSubmit={(input) => {
            addBooking(input);
            setAdding(false);
            showToast("Booking created");
          }}
        />
      </Sheet>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Edit booking">
        {editing ? (
          <BookingForm
            initial={editing}
            customers={data.customers}
            services={data.services}
            onCancel={() => setEditing(null)}
            onSubmit={(input) => {
              updateBooking(editing.id, input);
              setEditing(null);
              showToast("Booking updated");
            }}
          />
        ) : null}
      </Sheet>

      <ConfirmDialog
        open={!!deleting}
        title="Delete this booking?"
        description="This can't be undone."
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) {
            deleteBooking(deleting.id);
            showToast("Booking deleted");
          }
          setDeleting(null);
        }}
      />
    </div>
  );
}
