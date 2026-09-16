"use client";

import { useBusinessStore } from "@/lib/store";
import { formatKobo, formatShortDate } from "@/lib/format";

export default function SettingsPage() {
  const profile = useBusinessStore((s) => s.data.profile);
  const infra = useBusinessStore((s) => s.data.infrastructure);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Settings</h1>

      <section className="rounded-2xl border border-border p-4">
        <h2 className="font-display text-sm font-semibold text-ink">Business</h2>
        <dl className="mt-3 flex flex-col gap-2 text-sm">
          <Row label="Name" value={profile.displayName} />
          <Row label="Phone" value={profile.phone} />
          <Row label="Email" value={profile.email} />
          <Row label="Address" value={`${profile.address}, ${profile.city}, ${profile.state}`} />
        </dl>
      </section>

      <section className="rounded-2xl border border-border p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-ink">Your plan</h2>
          <span className="text-xs font-medium text-primary">{infra.planName}</span>
        </div>
        <dl className="mt-3 flex flex-col gap-2 text-sm">
          <Row label="Price" value={`${formatKobo(infra.priceKoboPerYear)}/year`} />
          <Row label="Renewal" value={formatShortDate(infra.renewalDate)} />
          <Row label="Storage" value={`${infra.storageUsedGb} GB / ${infra.storageLimitGb} GB`} />
          <Row label="Database" value="Active" />
          <Row label="Hosting" value="Active" />
          <Row label="SSL" value="Active" />
          <Row label="Business address" value={infra.domain} />
        </dl>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}
