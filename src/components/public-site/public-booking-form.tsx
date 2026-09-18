"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import { formatKobo } from "@/lib/format";
import { createPublicBookingAction } from "@/lib/actions/public-actions";
import type { Service } from "@/lib/types";

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * The public guest-booking form — deliberately has no staff picker (the
 * business assigns that internally after the request comes in). Works in
 * two modes:
 *   - "live": actually submits to `createPublicBookingAction`.
 *   - "preview": used inline on the dashboard's own website-settings page so
 *     an owner can see the form without it doing anything real.
 */
export function PublicBookingForm({
  subdomain,
  services,
  themeColor,
  textColor,
  mode,
}: {
  subdomain: string;
  services: Service[];
  themeColor: string;
  textColor: string;
  mode: "live" | "preview";
}) {
  const now = new Date();
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [date, setDate] = useState(toDateInput(now));
  const [time, setTime] = useState("10:00");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (services.length === 0) {
    return <p className="text-sm text-ink-muted">Booking isn&apos;t available right now — no services are listed yet.</p>;
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-border-strong bg-surface p-5 text-center">
        <p className="font-display text-base font-semibold text-ink">Request sent!</p>
        <p className="mt-1 text-sm text-ink-muted">We&apos;ll confirm your booking shortly.</p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (mode === "preview") {
      setError("This is a preview — publish your site to accept real bookings.");
      return;
    }

    const startsAt = new Date(`${date}T${time}:00`);
    if (Number.isNaN(startsAt.getTime())) {
      setError("Please choose a valid date and time.");
      return;
    }

    setPending(true);
    const result = await createPublicBookingAction(subdomain, {
      serviceId,
      startsAt: startsAt.toISOString(),
      notes,
      guestName: name,
      guestPhone: phone,
      guestEmail: email,
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Service" htmlFor="pb-service">
        <Select id="pb-service" value={serviceId} onChange={(e) => setServiceId(e.target.value)} required>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {formatKobo(s.priceKobo)}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" htmlFor="pb-date">
          <Input id="pb-date" type="date" value={date} min={toDateInput(now)} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Time" htmlFor="pb-time">
          <Input id="pb-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </Field>
      </div>
      <Field label="Your name" htmlFor="pb-name">
        <Input id="pb-name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone" htmlFor="pb-phone">
          <Input id="pb-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
        </Field>
        <Field label="Email (optional)" htmlFor="pb-email">
          <Input id="pb-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </Field>
      </div>
      <Field label="Notes (optional)" htmlFor="pb-notes">
        <Textarea id="pb-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything we should know?" />
      </Field>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        style={{ backgroundColor: themeColor, color: textColor }}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold transition-opacity disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        {pending ? "Sending…" : "Request booking"}
      </button>
    </form>
  );
}
