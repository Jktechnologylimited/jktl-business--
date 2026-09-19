"use client";

import { useState } from "react";
import { MapPin, MessageCircle, Phone, Mail, Clock, Package, CalendarCheck } from "lucide-react";
import { PublicBookingForm } from "./public-booking-form";
import { ChatWidget } from "./chat-widget";
import { formatKobo, initials } from "@/lib/format";
import { waLink, telLink, mailLink, textOnColor } from "@/lib/contact";
import type { Product, Service } from "@/lib/types";

export interface PublicSiteProfile {
  displayName: string;
  tagline: string;
  themeColor: string;
  logoUrl: string | null;
  coverPhotoUrl: string | null;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
}

/** Pure presentational — used both for the real page at /sites/[subdomain]
 * and for the live preview on the dashboard's website-settings page (fed
 * unsaved form state instead of the saved profile). Deliberately styled
 * differently from the internal dashboard: this is a storefront a visitor
 * lands on from a WhatsApp link or a social bio, not a tool a business
 * owner uses all day, so it reads as a marketing page — wider, more
 * editorial spacing, a real photographic hero — rather than another card
 * grid. */
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
  const hasPricing = activeServices.length > 0 || activeProducts.length > 0;
  // Set when a "Book" button (a service card, or the chat widget's quick
  // reply) jumps the visitor down to the booking form with that service
  // already chosen.
  const [prefillServiceId, setPrefillServiceId] = useState<string | undefined>();

  function bookService(id: string) {
    setPrefillServiceId(id);
    document.getElementById("book")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="jktl-light flex min-h-dvh flex-col bg-paper">
      {/* Nav bar */}
      <nav className="sticky top-0 z-30 border-b border-border bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/80">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
          <a href="#top" className="flex min-w-0 items-center gap-2">
            {profile.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- external/blob URL, not a static asset
              <img src={profile.logoUrl} alt="" className="size-8 shrink-0 rounded-lg object-cover" />
            ) : (
              <span
                style={{ backgroundColor: themeColor, color: textColor }}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
              >
                {initials(profile.displayName || "Business")}
              </span>
            )}
            <span className="truncate font-display text-sm font-semibold text-ink">{profile.displayName || "Your business"}</span>
          </a>
          <div className="hidden items-center gap-6 sm:flex">
            {activeServices.length > 0 ? (
              <a href="#services" className="text-sm font-medium text-ink-muted hover:text-ink">
                Services
              </a>
            ) : null}
            {activeProducts.length > 0 ? (
              <a href="#products" className="text-sm font-medium text-ink-muted hover:text-ink">
                Products
              </a>
            ) : null}
            {hasPricing ? (
              <a href="#pricing" className="text-sm font-medium text-ink-muted hover:text-ink">
                Pricing
              </a>
            ) : null}
          </div>
          <a
            href="#book"
            style={{ backgroundColor: themeColor, color: textColor }}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold shadow-sm"
          >
            <CalendarCheck className="size-3.5" /> Book now
          </a>
        </div>
      </nav>

      {/* Hero */}
      <header id="top" className="relative isolate flex min-h-[380px] items-end overflow-hidden sm:min-h-[460px]">
        {profile.coverPhotoUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- external/blob URL, not a static asset */}
            <img src={profile.coverPhotoUrl} alt="" className="absolute inset-0 -z-10 size-full object-cover" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/35 to-black/10" />
          </>
        ) : (
          <div
            className="absolute inset-0 -z-10"
            style={{ background: `linear-gradient(160deg, ${themeColor} 0%, color-mix(in srgb, ${themeColor} 55%, black) 100%)` }}
          />
        )}

        <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
          <div className="max-w-xl">
            {profile.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- external/blob URL, not a static asset
              <img src={profile.logoUrl} alt="" className="mb-4 size-14 rounded-2xl border-2 border-white/40 object-cover shadow-sm sm:size-16" />
            ) : null}
            <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-5xl">{profile.displayName || "Your business"}</h1>
            {profile.tagline ? <p className="mt-3 max-w-md text-base text-white/90 sm:text-lg">{profile.tagline}</p> : null}
            {locationLine ? (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-white/80">
                <MapPin className="size-4" /> {locationLine}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <a
                href="#book"
                style={{ backgroundColor: themeColor, color: textColor }}
                className="flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold shadow-lg"
              >
                <CalendarCheck className="size-4" /> Book an appointment
              </a>
              {wa ? (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-ink shadow-lg">
                  <MessageCircle className="size-4" /> WhatsApp
                </a>
              ) : null}
              {tel ? (
                <a href={tel} className="flex h-11 items-center gap-2 rounded-full bg-white/15 px-5 text-sm font-semibold text-white ring-1 ring-inset ring-white/30">
                  <Phone className="size-4" /> Call
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {activeServices.length > 0 ? (
          <section id="services" className="scroll-mt-14 border-b border-border px-5 py-14 sm:px-8 sm:py-20">
            <div className="mx-auto w-full max-w-6xl">
              <p className="text-xs font-semibold tracking-widest text-ink-faint uppercase" style={{ color: themeColor }}>
                Services
              </p>
              <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">What we offer</h2>
              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activeServices.map((s) => (
                  <div key={s.id} className="flex flex-col gap-3 rounded-2xl border border-border p-5 transition-shadow hover:shadow-md">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-ink">{s.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
                        {s.category ? <span>{s.category}</span> : null}
                        {s.durationMin > 0 ? (
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" /> {s.durationMin} min
                          </span>
                        ) : null}
                      </div>
                      {s.description ? <p className="mt-2 text-xs text-ink-muted">{s.description}</p> : null}
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-1">
                      <span className="font-display text-base font-bold text-ink">{formatKobo(s.priceKobo)}</span>
                      <button
                        type="button"
                        onClick={() => bookService(s.id)}
                        className="rounded-full px-3.5 py-1.5 text-xs font-semibold"
                        style={{ backgroundColor: `color-mix(in srgb, ${themeColor} 12%, transparent)`, color: themeColor }}
                      >
                        Book
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {activeProducts.length > 0 ? (
          <section id="products" className="scroll-mt-14 border-b border-border bg-surface px-5 py-14 sm:px-8 sm:py-20">
            <div className="mx-auto w-full max-w-6xl">
              <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: themeColor }}>
                Products
              </p>
              <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">Shop our products</h2>
              <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {activeProducts.map((p) => {
                  const soldOut = p.stockQty <= 0;
                  const order = wa && !soldOut ? waLink(profile.phone, `Hi, I'd like to order: ${p.name} (${formatKobo(p.priceKobo)})`) : null;
                  return (
                    <div key={p.id} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-paper">
                      <div className="relative aspect-square w-full bg-surface-strong">
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- data URL or hosted URL, not a static asset
                          <img src={p.imageUrl} alt={p.name} className="size-full object-cover" />
                        ) : (
                          <div className="flex size-full items-center justify-center text-ink-faint">
                            <Package className="size-8" />
                          </div>
                        )}
                        {soldOut ? (
                          <span className="absolute left-2 top-2 rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-semibold text-danger">Sold out</span>
                        ) : null}
                      </div>
                      <div className="flex flex-1 flex-col gap-2 p-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-ink">{p.name}</div>
                          {p.category ? <div className="truncate text-xs text-ink-muted">{p.category}</div> : null}
                        </div>
                        <div className="mt-auto flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-ink">{formatKobo(p.priceKobo)}</span>
                        </div>
                        {order ? (
                          <a
                            href={order}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 flex h-8 items-center justify-center gap-1.5 rounded-full text-xs font-semibold"
                            style={{ backgroundColor: themeColor, color: textColor }}
                          >
                            <MessageCircle className="size-3.5" /> Order
                          </a>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        {hasPricing ? (
          <section id="pricing" className="scroll-mt-14 border-b border-border px-5 py-14 sm:px-8 sm:py-20">
            <div className="mx-auto w-full max-w-3xl">
              <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: themeColor }}>
                Pricing
              </p>
              <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">Everything, priced</h2>
              <p className="mt-2 text-sm text-ink-muted">A full list of what you&apos;ll pay for — no surprises.</p>

              <div className="mt-8 flex flex-col gap-8">
                {activeServices.length > 0 ? (
                  <div>
                    <h3 className="mb-2 text-xs font-semibold tracking-wide text-ink-faint uppercase">Services</h3>
                    <div className="divide-y divide-border rounded-2xl border border-border">
                      {activeServices.map((s) => (
                        <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-ink">{s.name}</div>
                            {s.category ? <div className="truncate text-xs text-ink-muted">{s.category}</div> : null}
                          </div>
                          <span className="shrink-0 text-sm font-semibold text-ink">{formatKobo(s.priceKobo)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {activeProducts.length > 0 ? (
                  <div>
                    <h3 className="mb-2 text-xs font-semibold tracking-wide text-ink-faint uppercase">Products</h3>
                    <div className="divide-y divide-border rounded-2xl border border-border">
                      {activeProducts.map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-ink">{p.name}</div>
                            {p.category ? <div className="truncate text-xs text-ink-muted">{p.category}</div> : null}
                          </div>
                          <span className="shrink-0 text-sm font-semibold text-ink">
                            {formatKobo(p.priceKobo)}
                            {p.stockQty <= 0 ? <span className="ml-2 text-xs font-normal text-danger">Sold out</span> : null}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        <section id="book" className="scroll-mt-14 bg-surface px-5 py-14 sm:px-8 sm:py-20">
          <div className="mx-auto flex w-full max-w-lg flex-col gap-3">
            <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: themeColor }}>
              Book
            </p>
            <h2 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">Book an appointment</h2>
            <div className="mt-3">
              <PublicBookingForm
                subdomain={subdomain}
                services={activeServices}
                themeColor={themeColor}
                textColor={textColor}
                mode={mode}
                initialServiceId={prefillServiceId}
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-5 py-10 sm:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <div className="font-display text-sm font-semibold text-ink">{profile.displayName || "Your business"}</div>
            {locationLine ? <div className="mt-0.5 text-xs text-ink-muted">{locationLine}</div> : null}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-ink-muted">
            {tel ? (
              <a href={tel} className="flex items-center gap-1 hover:text-ink">
                <Phone className="size-3.5" /> {profile.phone}
              </a>
            ) : null}
            {mail ? (
              <a href={mail} className="flex items-center gap-1 hover:text-ink">
                <Mail className="size-3.5" /> {profile.email}
              </a>
            ) : null}
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-ink-faint">Powered by JKTL Business</p>
      </footer>

      {mode === "live" ? (
        // `fixed` positioning means this overlays the whole viewport, not
        // just this component's box — fine on the real public page, but it
        // would float over the entire dashboard if rendered inside the
        // settings page's embedded preview, so it's live-only.
        <ChatWidget
          businessName={profile.displayName}
          services={activeServices}
          products={activeProducts}
          phone={profile.phone}
          email={profile.email}
          address={profile.address}
          city={profile.city}
          state={profile.state}
          themeColor={themeColor}
          textColor={textColor}
          onSelectService={setPrefillServiceId}
        />
      ) : null}
    </div>
  );
}
