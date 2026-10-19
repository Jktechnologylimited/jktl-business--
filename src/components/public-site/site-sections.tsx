"use client";

import { motion } from "framer-motion";
import { Clock, ImageIcon, MapPin, Phone, Star } from "lucide-react";

/**
 * The sections that make a generated site read as a real business rather than a
 * template.
 *
 * Everything here is fed by the business's own Google listing — its photographs,
 * its reviews, its opening hours, its neighbourhood. That is the whole argument
 * for generating a site from scraped data instead of handing over a blank theme:
 * a visitor landing here should be able to tell they are looking at *this*
 * clinic, in *this* place, not at a stock layout with the name swapped.
 *
 * The rule everywhere below is the same as in the generator: show what the
 * listing says and nothing more. A section with no data renders nothing at all,
 * because an invented testimonial or a fabricated "10 years of experience" is a
 * liability in the owner's name, and it is the first thing they would have to
 * apologise for.
 */

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
} as const;

const reveal = {
  initial: "hidden" as const,
  whileInView: "show" as const,
  viewport: { once: true, margin: "-80px" },
  variants: fadeUp,
};

/* -------------------------------------------------------------------------- */
/* Trust bar                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The rating, immediately under the hero.
 *
 * Placed high on purpose: for a clinic, "4.8 from 212 reviews" is the single most
 * persuasive fact on the page, and it is the one thing a competitor's template
 * cannot fake. Renders nothing when the listing has no reviews — a trust bar
 * showing "0 reviews" destroys more trust than it builds.
 */
export function TrustBar({
  rating,
  reviewCount,
  serviceAreas,
  themeColor,
}: {
  rating: number;
  reviewCount: number;
  serviceAreas: string[];
  themeColor: string;
}) {
  if (reviewCount <= 0 || rating <= 0) return null;

  return (
    <section className="border-b border-border bg-surface px-5 py-5 sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-0.5" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className="size-4"
                style={{ color: themeColor }}
                fill={star <= Math.round(rating) ? themeColor : "none"}
                strokeWidth={star <= Math.round(rating) ? 0 : 1.5}
              />
            ))}
          </span>
          <span className="font-semibold text-ink">{rating.toFixed(1)}</span>
          <span className="text-ink-muted">
            from {reviewCount} Google review{reviewCount === 1 ? "" : "s"}
          </span>
        </div>

        {serviceAreas.length > 0 ? (
          <div className="flex items-center gap-1.5 text-ink-muted">
            <MapPin className="size-4" />
            <span>
              Serving {serviceAreas.slice(0, 3).join(", ")}
              {serviceAreas.length > 3 ? ` and nearby` : ""}
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Gallery                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Photographs of the actual premises.
 *
 * The first image spans two columns so the grid opens with a proper shot rather
 * than a row of thumbnails. Images are lazy-loaded and sized, because a gallery
 * of full-resolution Google Photos URLs on a Nigerian mobile connection is how a
 * beautiful page becomes an unusable one.
 */
export function GallerySection({ photos, businessName }: { photos: Array<{ url: string; category: string }>; businessName: string }) {
  if (photos.length === 0) return null;

  return (
    <section id="gallery" className="scroll-mt-14 border-b border-border px-5 py-14 sm:px-8 sm:py-20">
      <motion.div {...reveal} className="mx-auto w-full max-w-6xl">
        <div className="flex items-center gap-2">
          <ImageIcon className="size-4 text-ink-muted" />
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">Inside {businessName}</h2>
        </div>
        <p className="mt-2 max-w-2xl text-ink-muted">Photographs from our premises and our work.</p>

        <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {photos.slice(0, 8).map((photo, index) => (
            <motion.figure
              key={photo.url}
              initial={{ opacity: 0, scale: 0.97 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.3) }}
              className={
                index === 0
                  ? "relative col-span-2 row-span-2 aspect-square overflow-hidden rounded-2xl bg-surface sm:aspect-auto sm:min-h-[320px]"
                  : "relative aspect-square overflow-hidden rounded-2xl bg-surface"
              }
            >
              {/* External Google-hosted URL, not a static asset. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.category ? `${businessName} — ${photo.category}` : businessName}
                loading="lazy"
                decoding="async"
                className="size-full object-cover transition duration-500 hover:scale-[1.04]"
              />
            </motion.figure>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Hours and location                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Opening hours and where to find the business.
 *
 * Both are things a visitor needs and most small-business sites omit. Today is
 * highlighted, and the map is a plain link rather than an embedded iframe — an
 * embedded Google Map costs several hundred kilobytes and a cookie banner on a
 * page whose main job is to get someone to book.
 */
export function HoursLocationSection({
  openingHours,
  address,
  city,
  state,
  phone,
  serviceAreas,
}: {
  openingHours: Array<{ day: string; hours: string }>;
  address: string;
  city: string;
  state: string;
  phone: string;
  serviceAreas: string[];
}) {
  if (openingHours.length === 0 && !address && !phone) return null;

  const today = new Date().toLocaleDateString("en-GB", { weekday: "long" });
  const fullAddress = [address, city, state].filter(Boolean).join(", ");
  const mapsUrl = fullAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}` : "";

  return (
    <section id="visit" className="scroll-mt-14 border-b border-border bg-surface px-5 py-14 sm:px-8 sm:py-20">
      <motion.div {...reveal} className="mx-auto grid w-full max-w-6xl gap-8 sm:grid-cols-2">
        {openingHours.length > 0 ? (
          <div>
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-ink-muted" />
              <h2 className="font-display text-xl font-bold tracking-tight text-ink">Opening hours</h2>
            </div>
            <dl className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-paper">
              {openingHours.map((entry) => {
                const isToday = entry.day.toLowerCase() === today.toLowerCase();
                return (
                  <div key={entry.day} className={`flex items-center justify-between px-4 py-2.5 text-sm ${isToday ? "bg-paper font-semibold" : ""}`}>
                    <dt className={isToday ? "text-ink" : "text-ink-muted"}>
                      {entry.day}
                      {isToday ? <span className="ml-2 rounded-full bg-surface px-2 py-0.5 text-[11px] text-ink-muted">Today</span> : null}
                    </dt>
                    <dd className="text-ink">{entry.hours}</dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ) : null}

        {fullAddress || phone ? (
          <div>
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-ink-muted" />
              <h2 className="font-display text-xl font-bold tracking-tight text-ink">Find us</h2>
            </div>
            <div className="mt-4 rounded-2xl border border-border bg-paper p-4 text-sm">
              {fullAddress ? <p className="text-ink">{fullAddress}</p> : null}
              {phone ? (
                <p className="mt-2 flex items-center gap-1.5 text-ink-muted">
                  <Phone className="size-3.5" />
                  <a href={`tel:${phone.replace(/\s+/g, "")}`} className="hover:text-ink">
                    {phone}
                  </a>
                </p>
              ) : null}
              {mapsUrl ? (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-medium text-ink hover:bg-surface"
                >
                  <MapPin className="size-3.5" /> Open in Google Maps
                </a>
              ) : null}
              {serviceAreas.length > 0 ? (
                <p className="mt-3 text-xs text-ink-muted">
                  Also serving {serviceAreas.slice(0, 5).join(", ")}
                  {serviceAreas.length > 5 ? " and nearby areas" : ""}.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </motion.div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* FAQ                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Native `<details>` rather than a JavaScript accordion: it works before
 * hydration, it is keyboard accessible for free, and search engines read the
 * answers — which is most of the point of having them on a local business page.
 */
export function FaqSection({ faqs }: { faqs: Array<{ question: string; answer: string }> }) {
  if (faqs.length === 0) return null;

  return (
    <section id="faq" className="scroll-mt-14 border-b border-border px-5 py-14 sm:px-8 sm:py-20">
      <motion.div {...reveal} className="mx-auto w-full max-w-3xl">
        <h2 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">Questions people ask</h2>
        <div className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-paper">
          {faqs.map((faq) => (
            <details key={faq.question} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 text-sm font-medium text-ink hover:bg-surface">
                {faq.question}
                <span className="shrink-0 text-ink-muted transition group-open:rotate-45">+</span>
              </summary>
              <div className="px-4 pb-4 text-sm leading-relaxed text-ink-muted">{faq.answer}</div>
            </details>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
