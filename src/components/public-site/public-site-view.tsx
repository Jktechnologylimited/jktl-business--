"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, MessageCircle, Phone, Mail, Clock, Package, CalendarCheck, Menu, X, Star, Quote } from "lucide-react";
import { PublicBookingForm } from "./public-booking-form";
import { ChatWidget } from "./chat-widget";
import { InstagramIcon, TikTokIcon, FacebookIcon, SnapchatIcon } from "./social-icons";
import { formatKobo, initials } from "@/lib/format";
import { waLink, telLink, mailLink, textOnColor } from "@/lib/contact";
import { getSiteFontPair } from "@/lib/fonts";
import type { Product, Service, Testimonial } from "@/lib/types";

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
  aboutText: string;
  instagramUrl: string;
  tiktokUrl: string;
  facebookUrl: string;
  snapchatUrl: string;
  fontPairId: string;
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
} as const;

/** Pure presentational — used both for the real page at /sites/[subdomain]
 * and for the live preview on the dashboard's website-settings page (fed
 * unsaved form state instead of the saved profile). Deliberately styled
 * differently from the internal dashboard: this is a storefront a visitor
 * lands on from a WhatsApp link or a social bio, not a tool a business
 * owner uses all day, so it reads as a marketing page — wider, more
 * editorial spacing, a real photographic hero — rather than another card
 * grid. Always renders in the business's own chosen accent color and font
 * pairing, regardless of the visitor's OS dark-mode setting or the
 * dashboard's own navy brand (see `.jktl-light` in globals.css). */
export function PublicSiteView({
  profile,
  services,
  products,
  testimonials,
  subdomain,
  mode,
}: {
  profile: PublicSiteProfile;
  services: Service[];
  products: Product[];
  testimonials: Testimonial[];
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
  const fontPair = getSiteFontPair(profile.fontPairId);
  const socials = [
    { url: profile.instagramUrl, label: "Instagram", Icon: InstagramIcon },
    { url: profile.tiktokUrl, label: "TikTok", Icon: TikTokIcon },
    { url: profile.facebookUrl, label: "Facebook", Icon: FacebookIcon },
    { url: profile.snapchatUrl, label: "Snapchat", Icon: SnapchatIcon },
  ].filter((s) => s.url);

  // Set when a "Book" button (a service card, or the chat widget's quick
  // reply) jumps the visitor down to the booking form with that service
  // already chosen.
  const [prefillServiceId, setPrefillServiceId] = useState<string | undefined>();
  const [menuOpen, setMenuOpen] = useState(false);

  function bookService(id: string) {
    setPrefillServiceId(id);
    setMenuOpen(false);
    document.getElementById("book")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const navLinks = [
    activeServices.length > 0 ? { href: "#services", label: "Services" } : null,
    activeProducts.length > 0 ? { href: "#products", label: "Products" } : null,
    hasPricing ? { href: "#pricing", label: "Pricing" } : null,
    profile.aboutText ? { href: "#about", label: "About" } : null,
    testimonials.length > 0 ? { href: "#reviews", label: "Reviews" } : null,
    { href: "#contact", label: "Contact" },
  ].filter((l): l is { href: string; label: string } => l !== null);

  return (
    <div
      className="jktl-light flex min-h-dvh flex-col bg-paper"
      style={{ "--font-display": fontPair.displayVar, "--font-body": fontPair.bodyVar } as React.CSSProperties}
    >
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
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="text-sm font-medium text-ink-muted hover:text-ink">
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <motion.a
              href="#book"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              style={{ backgroundColor: themeColor, color: textColor }}
              className="hidden h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold shadow-sm sm:flex"
            >
              <CalendarCheck className="size-3.5" /> Book now
            </motion.a>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-ink sm:hidden"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {menuOpen ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden border-t border-border sm:hidden"
            >
              <div className="flex flex-col gap-1 px-5 py-3">
                {navLinks.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={() => setMenuOpen(false)}
                    className="rounded-lg px-2 py-2.5 text-sm font-medium text-ink hover:bg-surface"
                  >
                    {l.label}
                  </a>
                ))}
                <a
                  href="#book"
                  onClick={() => setMenuOpen(false)}
                  style={{ backgroundColor: themeColor, color: textColor }}
                  className="mt-1 flex h-10 items-center justify-center gap-1.5 rounded-full text-sm font-semibold"
                >
                  <CalendarCheck className="size-3.5" /> Book now
                </a>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
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

        <motion.div initial="hidden" animate="show" variants={fadeUp} className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
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
              <motion.a
                href="#book"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                style={{ backgroundColor: themeColor, color: textColor }}
                className="flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold shadow-lg"
              >
                <CalendarCheck className="size-4" /> Book an appointment
              </motion.a>
              {wa ? (
                <motion.a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  className="flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-ink shadow-lg"
                >
                  <MessageCircle className="size-4" /> WhatsApp
                </motion.a>
              ) : null}
              {tel ? (
                <a href={tel} className="flex h-11 items-center gap-2 rounded-full bg-white/15 px-5 text-sm font-semibold text-white ring-1 ring-inset ring-white/30">
                  <Phone className="size-4" /> Call
                </a>
              ) : null}
            </div>
          </div>
        </motion.div>
      </header>

      <main className="flex flex-1 flex-col">
        {activeServices.length > 0 ? (
          <section id="services" className="scroll-mt-14 border-b border-border px-5 py-14 sm:px-8 sm:py-20">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              variants={fadeUp}
              className="mx-auto w-full max-w-6xl"
            >
              <p className="text-xs font-semibold tracking-widest text-ink-faint uppercase" style={{ color: themeColor }}>
                Services
              </p>
              <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">What we offer</h2>
              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activeServices.map((s) => (
                  <motion.div
                    key={s.id}
                    whileHover={{ y: -4 }}
                    className="flex flex-col gap-3 rounded-2xl border border-border p-5 transition-shadow hover:shadow-md"
                  >
                    {s.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- data URL or hosted URL, not a static asset
                      <img src={s.imageUrl} alt="" className="-mx-5 -mt-5 mb-1 aspect-video w-[calc(100%+2.5rem)] rounded-t-2xl object-cover" />
                    ) : null}
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
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </section>
        ) : null}

        {activeProducts.length > 0 ? (
          <section id="products" className="scroll-mt-14 border-b border-border bg-surface px-5 py-14 sm:px-8 sm:py-20">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              variants={fadeUp}
              className="mx-auto w-full max-w-6xl"
            >
              <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: themeColor }}>
                Products
              </p>
              <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">Shop our products</h2>
              <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {activeProducts.map((p) => {
                  const soldOut = p.stockQty <= 0;
                  const order = wa && !soldOut ? waLink(profile.phone, `Hi, I'd like to order: ${p.name} (${formatKobo(p.priceKobo)})`) : null;
                  return (
                    <motion.div key={p.id} whileHover={{ y: -4 }} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-paper">
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
                          <motion.a
                            href={order}
                            target="_blank"
                            rel="noopener noreferrer"
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            className="mt-1 flex h-8 items-center justify-center gap-1.5 rounded-full text-xs font-semibold"
                            style={{ backgroundColor: themeColor, color: textColor }}
                          >
                            <MessageCircle className="size-3.5" /> Order
                          </motion.a>
                        ) : null}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </section>
        ) : null}

        {hasPricing ? (
          <section id="pricing" className="scroll-mt-14 border-b border-border px-5 py-14 sm:px-8 sm:py-20">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              variants={fadeUp}
              className="mx-auto w-full max-w-3xl"
            >
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
            </motion.div>
          </section>
        ) : null}

        {profile.aboutText ? (
          <section id="about" className="scroll-mt-14 border-b border-border bg-surface px-5 py-14 sm:px-8 sm:py-20">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              variants={fadeUp}
              className="mx-auto w-full max-w-2xl text-center"
            >
              <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: themeColor }}>
                About us
              </p>
              <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">{profile.displayName || "Our story"}</h2>
              <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink-muted sm:text-base">{profile.aboutText}</p>
            </motion.div>
          </section>
        ) : null}

        {testimonials.length > 0 ? (
          <section id="reviews" className="scroll-mt-14 border-b border-border px-5 py-14 sm:px-8 sm:py-20">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              variants={fadeUp}
              className="mx-auto w-full max-w-6xl"
            >
              <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: themeColor }}>
                Reviews
              </p>
              <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">What customers say</h2>
              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {testimonials.map((t) => (
                  <motion.div key={t.id} whileHover={{ y: -4 }} className="flex flex-col gap-3 rounded-2xl border border-border p-5">
                    <Quote className="size-5" style={{ color: themeColor }} />
                    <p className="flex-1 text-sm text-ink">{t.quote}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-ink">{t.customerName}</span>
                      {t.rating ? (
                        <span className="flex items-center gap-0.5">
                          {Array.from({ length: t.rating }).map((_, i) => (
                            <Star key={i} className="size-3.5 fill-accent text-accent" />
                          ))}
                        </span>
                      ) : null}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
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

      <footer id="contact" className="scroll-mt-14 border-t border-border px-5 py-10 sm:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
          <div>
            <div className="font-display text-sm font-semibold text-ink">{profile.displayName || "Your business"}</div>
            {locationLine ? (
              <div className="mt-1 flex items-center justify-center gap-1 text-xs text-ink-muted sm:justify-start">
                <MapPin className="size-3.5 shrink-0" /> {locationLine}
              </div>
            ) : null}
          </div>
          <div className="flex flex-col items-center gap-3 sm:items-end">
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-ink-muted sm:justify-end">
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
            {socials.length > 0 ? (
              <div className="flex items-center gap-3">
                {socials.map(({ url, label, Icon }) => (
                  <a
                    key={label}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="flex size-8 items-center justify-center rounded-full border border-border text-ink-muted hover:border-primary hover:text-primary"
                  >
                    <Icon className="size-4" />
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-ink-faint">
          Powered by{" "}
          <a href="https://business.jktl.com.ng" target="_blank" rel="noopener noreferrer" className="font-medium hover:text-ink-muted">
            {profile.displayName || "JKTL Business"}
          </a>
        </p>
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
