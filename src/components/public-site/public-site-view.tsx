"use client";

import { MapPin, MessageCircle, Phone, Mail, Clock } from "lucide-react";
import { PublicBookingForm } from "./public-booking-form";
import { formatKobo, initials } from "@/lib/format";
import { waLink, telLink, mailLink, textOnColor } from "@/lib/contact";
import type { Product, Service } from "@/lib/types";

export interface PublicSiteProfile {
  displayName: string;
  tagline: string;
  themeColor: string;
  logoUrl: string | null;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
}

/** Pure presentational — used both for the real page at /sites/[subdomain]
 * and for the live preview on the dashboard's website-settings page (fed
 * unsaved form state instead of the saved profile). */
export function PublicSiteView({
  profile,
  services,
  products,
  subdomain,
  mode,
}: {
  profile: PublicSiteProfile;
  services: Service[];
  products: Product[];
  subdomain: string;
  mode: "live" | "preview";
}) {
  const themeColor = /^#[0-9a-fA-F]{6}$/.test(profile.themeColor) ? profile.themeColor : "#0f6e5c";
  const textColor = textOnColor(themeColor);
  const wa = waLink(profile.phone);
  const tel = telLink(profile.phone);
  const mail = mailLink(profile.email);
  const locationLine = [profile.address, profile.city, profile.state].filter(Boolean).join(", ");
  const activeServices = services.filter((s) => s.active);
  const activeProducts = products.filter((p) => p.active);

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      {/* Hero */}
      <header style={{ backgroundColor: themeColor, color: textColor }} className="px-5 pb-8 pt-10 text-center">
        {profile.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external/blob URL, not a static asset
          <img src={profile.logoUrl} alt={profile.displayName} className="mx-auto size-20 rounded-2xl border-2 border-white/30 object-cover shadow-sm" />
        ) : (
          <span
            style={{ color: themeColor }}
            className="mx-auto flex size-20 items-center justify-center rounded-2xl bg-white text-2xl font-bold shadow-sm"
          >
            {initials(profile.displayName || "Business")}
          </span>
        )}
        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">{profile.displayName || "Your business"}</h1>
        {profile.tagline ? <p className="mx-auto mt-1.5 max-w-sm text-sm opacity-90">{profile.tagline}</p> : null}
        {locationLine ? (
          <p className="mt-3 flex items-center justify-center gap-1 text-xs opacity-80">
            <MapPin className="size-3.5" /> {locationLine}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold shadow-sm"
              style={{ color: themeColor }}
            >
              <MessageCircle className="size-4" /> Chat on WhatsApp
            </a>
          ) : null}
          {tel ? (
            <a href={tel} className="flex h-10 items-center gap-2 rounded-full bg-black/10 px-4 text-sm font-semibold" style={{ color: textColor }}>
              <Phone className="size-4" /> Call
            </a>
          ) : null}
          {mail ? (
            <a href={mail} className="flex h-10 items-center gap-2 rounded-full bg-black/10 px-4 text-sm font-semibold" style={{ color: textColor }}>
              <Mail className="size-4" /> Email
            </a>
          ) : null}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 px-5 py-8">
        {activeServices.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className="font-display text-lg font-semibold text-ink">Services</h2>
            <div className="divide-y divide-border rounded-2xl border border-border">
              {activeServices.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">{s.name}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-muted">
                      {s.category ? <span>{s.category}</span> : null}
                      {s.durationMin > 0 ? (
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" /> {s.durationMin} min
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="shrink-0 text-sm font-semibold text-ink">{formatKobo(s.priceKobo)}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {activeProducts.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className="font-display text-lg font-semibold text-ink">Products</h2>
            <div className="grid grid-cols-2 gap-3">
              {activeProducts.map((p) => (
                <div key={p.id} className="rounded-2xl border border-border p-3.5">
                  <div className="truncate text-sm font-medium text-ink">{p.name}</div>
                  {p.category ? <div className="mt-0.5 truncate text-xs text-ink-muted">{p.category}</div> : null}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">{formatKobo(p.priceKobo)}</span>
                    {p.stockQty <= 0 ? (
                      <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger">Sold out</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-semibold text-ink">Book an appointment</h2>
          <PublicBookingForm subdomain={subdomain} services={activeServices} themeColor={themeColor} textColor={textColor} mode={mode} />
        </section>
      </main>

      <footer className="border-t border-border px-5 py-5 text-center text-xs text-ink-faint">Powered by JKTL Business</footer>
    </div>
  );
}
