"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import { STAFF } from "@/lib/mock";
import type { NewBookingInput } from "@/lib/store";
import { koboToNaira, nairaToKobo } from "@/lib/format";
import type { Booking, BookingStatus, Customer, Service } from "@/lib/types";

function toDateInput(iso: string) {
  return iso.slice(0, 10);
}
function toTimeInput(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function BookingForm({
  initial,
  customers,
  services,
  onSubmit,
  onCancel,
}: {
  initial?: Booking;
  customers: Customer[];
  services: Service[];
  onSubmit: (input: NewBookingInput) => void;
  onCancel: () => void;
}) {
  const now = new Date();
  const [customerId, setCustomerId] = useState(initial?.customerId ?? customers[0]?.id ?? "");
  const [serviceId, setServiceId] = useState(initial?.serviceId ?? services[0]?.id ?? "");
  const [staffId, setStaffId] = useState(initial?.staffId ?? STAFF[0]?.id ?? "");
  const [date, setDate] = useState(initial ? toDateInput(initial.startsAt) : toDateInput(now.toISOString()));
  const [time, setTime] = useState(initial ? toTimeInput(initial.startsAt) : "09:00");
  const [status, setStatus] = useState<BookingStatus>(initial?.status ?? "pending");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [priceOverride, setPriceOverride] = useState(
    initial ? String(koboToNaira(initial.priceKobo)) : services[0] ? String(koboToNaira(services[0].priceKobo)) : "",
  );

  function selectService(id: string) {
    setServiceId(id);
    const svc = services.find((s) => s.id === id);
    if (svc) setPriceOverride(String(koboToNaira(svc.priceKobo)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const startsAt = new Date(`${date}T${time}:00`).toISOString();
    onSubmit({
      customerId,
      serviceId,
      staffId,
      startsAt,
      status,
      notes,
      priceKobo: nairaToKobo(Number(priceOverride) || 0),
    });
  }

  if (customers.length === 0 || services.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        Add at least one customer and one service first — bookings need both.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Customer" htmlFor="bk-customer">
        <Select id="bk-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Service" htmlFor="bk-service">
        <Select id="bk-service" value={serviceId} onChange={(e) => selectService(e.target.value)} required>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Stylist" htmlFor="bk-staff">
        <Select id="bk-staff" value={staffId} onChange={(e) => setStaffId(e.target.value)} required>
          {STAFF.map((st) => (
            <option key={st.id} value={st.id}>
              {st.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" htmlFor="bk-date">
          <Input id="bk-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Time" htmlFor="bk-time">
          <Input id="bk-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Price (₦)" htmlFor="bk-price">
          <Input id="bk-price" type="number" min="0" value={priceOverride} onChange={(e) => setPriceOverride(e.target.value)} required />
        </Field>
        <Field label="Status" htmlFor="bk-status">
          <Select id="bk-status" value={status} onChange={(e) => setStatus(e.target.value as BookingStatus)}>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No-show</option>
          </Select>
        </Field>
      </div>
      <Field label="Notes (optional)" htmlFor="bk-notes">
        <Textarea id="bk-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <div className="mt-1 flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1">
          Save booking
        </Button>
      </div>
    </form>
  );
}
