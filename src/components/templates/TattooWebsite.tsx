/* eslint-disable @next/next/no-img-element -- Bundled and editable photographs avoid runtime image optimization. */
"use client";
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, LogIn, Menu, X } from "lucide-react";
import {
  beautyGuestSlug,
  beautyServiceSlug,
  templateLoginPath,
  websitePageHref,
  websitePagePaths,
} from "@/lib/website-templates";
import { BeautyRequestForm } from "./BeautyWebsite";
import type { OccasionWebsite } from "./OccasionWebsite";
import styles from "./TattooWebsite.module.css";

const subscribeSearch = (listener: () => void) => {
  window.addEventListener("popstate", listener);
  return () => window.removeEventListener("popstate", listener);
};
const readSearch = () => window.location.search;
const serverSearch = () => "";

export function TattooWebsite({
  template,
  document: doc,
  contact = {},
  preview = false,
  hideBranding = false,
  pagePath = "",
  basePath = "",
  initialService = "",
  onNavigate,
  onRequest,
  onInteraction,
  reviews: verifiedReviews = [],
  businessSection,
}: ComponentProps<typeof OccasionWebsite>) {
  const b = doc.beauty!;
  const [menu, setMenu] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    reduced = useReducedMotion();
  const browserSearch = useSyncExternalStore(
    subscribeSearch,
    readSearch,
    serverSearch,
  );
  const path = pagePath.split(/[?#]/)[0],
    paths = websitePagePaths(template, doc);
  const query = new URLSearchParams(pagePath.split("?")[1] || browserSearch);
  const service = doc.offerings.find(
    (o, i) => path === "services/" + beautyServiceSlug(o, i),
  );
  const guests = b.guestSpots || [];
  const guest = guests.find(
    (g, i) => path === "guest-spots/" + beautyGuestSlug(g, i),
  );
  const selectedGuest = guests.find(
    (g, i) => query.get("guest") === beautyGuestSlug(g, i),
  );
  const queryService = initialService || query.get("service") || "";
  const reviews = verifiedReviews.length
    ? verifiedReviews
    : b.demoContent
      ? []
      : doc.reviews || [];
  const address =
    b.contact.address ||
    [contact.address, contact.city, contact.state].filter(Boolean).join(", ");
  const phone = (b.contact.phone || contact.phone || "").replace(/[^+\d]/g, "");
  const rawEmail = b.contact.email || contact.email || "",
    email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : "";
  const safeUrl = (value: string) => {
    try {
      const u = new URL(value);
      return u.protocol === "https:" && !u.username && !u.password ? value : "";
    } catch {
      return "";
    }
  };
  const socials = (doc.socials || []).filter((s) => safeUrl(s.url));
  const whatsapp = (b.contact.whatsapp || phone)
    .replace(/\D/g, "")
    .replace(/^0(?=\d{10}$)/, "234");
  useEffect(() => {
    if (onNavigate)
      root.current?.ownerDocument.defaultView?.scrollTo({ top: 0 });
  }, [pagePath, onNavigate]);
  const photo = (src: string, alt: string, eager = false) => (
    <img
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={(e) => {
        if (!e.currentTarget.dataset.fallback) {
          e.currentTarget.dataset.fallback = "true";
          e.currentTarget.src = `/template-art/${template.sourceId || template.id}.svg`;
        }
      }}
    />
  );
  const link = (
    to: string,
    label: ReactNode,
    className?: string,
    ariaLabel?: string,
  ) => (
    <a
      href={websitePageHref(basePath, to)}
      className={className}
      aria-label={ariaLabel}
      aria-current={path === to ? "page" : undefined}
      onClick={(e) => {
        if (to.startsWith("book")) onInteraction?.("cta");
        if (to.startsWith("contact")) onInteraction?.("contact");
        if (
          onNavigate &&
          e.button === 0 &&
          !e.metaKey &&
          !e.ctrlKey &&
          !e.shiftKey &&
          !e.altKey &&
          paths.includes(to.split("?")[0])
        ) {
          e.preventDefault();
          onNavigate(to);
        }
        setMenu(false);
      }}
    >
      {label}
    </a>
  );
  const button = (to: string, label: string) =>
    link(
      to,
      <>
        {label}
        <ArrowUpRight size={16} aria-hidden="true" />
      </>,
      styles.button,
    );
  const heading =
    service?.title ||
    guest?.studio ||
    (
      {
        about: doc.aboutTitle,
        services: doc.offeringsTitle,
        gallery: doc.galleryTitle,
        book: doc.contactTitle,
        contact: doc.contactTitle,
        aftercare: doc.faqTitle,
        "guest-spots": "A change of scene. A familiar approach.",
      } as Record<string, string>
    )[path] ||
    doc.headline;
  const about = (full = false) => (
    <section className={styles.about}>
      <div>
        {photo(
          b.aboutImage,
          `${doc.brandName} — personal art and self-expression`,
        )}
      </div>
      <div>
        <p className={styles.eyebrow}>A little about the artist</p>
        <h2>{doc.aboutTitle}</h2>
        <p>{doc.aboutText}</p>
        {full ? (
          <ul>
            {b.philosophy.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : (
          button("about", "Get to know the studio")
        )}
      </div>
    </section>
  );
  const services = (full = false) => (
    <section className={styles.services}>
      <div className={styles.serviceBackdrop}>
        {photo(
          doc.gallery[2]?.src || doc.heroImage,
          "A tattoo consultation in a Lagos studio",
        )}
      </div>
      <div className={styles.servicePanel}>
        <p className={styles.eyebrow}>Every piece begins with a conversation</p>
        <h2>{doc.offeringsTitle}</h2>
        {doc.offerings.map((o, i) => (
          <article key={i}>
            {link(
              "services/" + beautyServiceSlug(o, i),
              <>
                <span>0{i + 1}</span>
                <h3>{o.title}</h3>
                <ArrowUpRight size={18} />
              </>,
              undefined,
              `Explore ${o.title}`,
            )}
            {full && <p>{o.description}</p>}
          </article>
        ))}
        {button("services", "Explore all services")}
      </div>
    </section>
  );
  const guestCards = (full = false) => (
    <section className={styles.guests}>
      <div className={styles.sectionIntro}>
        <p className={styles.eyebrow}>Guest visits & new conversations</p>
        <h2>Good art travels.</h2>
        <p>Check directly with the artist for confirmed locations and dates.</p>
      </div>
      <div className={styles.guestGrid}>
        {guests.map((g, i) => (
          <motion.article
            key={i}
            initial={false}
            whileHover={reduced ? undefined : { y: -6 }}
          >
            <div>{photo(g.image, `${g.studio} — tattoo inspiration`)}</div>
            <p className={styles.eyebrow}>{g.city}</p>
            <h3>{g.studio}</h3>
            <p>{g.dates}</p>
            {full && <p>{g.description}</p>}
            {button("guest-spots/" + beautyGuestSlug(g, i), "Visit details")}
          </motion.article>
        ))}
      </div>
      {!full && button("guest-spots", "Explore guest visits")}
    </section>
  );
  const gallery = (
    <section className={styles.gallery}>
      <div className={styles.sectionIntro}>
        <p className={styles.eyebrow}>A closer look</p>
        <h2>{doc.galleryTitle}</h2>
      </div>
      <div className={styles.mosaic}>
        {doc.gallery.map((g, i) => (
          <motion.figure
            key={i}
            initial={false}
            whileHover={reduced ? undefined : { y: -4 }}
          >
            {photo(g.src, g.alt)}
            <figcaption>{g.category || g.alt}</figcaption>
          </motion.figure>
        ))}
      </div>
      {path !== "gallery" && button("gallery", "Explore the gallery")}
    </section>
  );
  const aftercare = (
    <section className={styles.aftercare}>
      <p className={styles.eyebrow}>Keep the conversation open</p>
      <h2>{doc.faqTitle}</h2>
      {doc.faqs.map((f, i) => (
        <details key={i}>
          <summary>{f.question}</summary>
          <p>{f.answer}</p>
        </details>
      ))}
      {button("contact", "Ask a follow-up question")}
    </section>
  );
  const reviewSection = (
    <section className={styles.reviews}>
      <p className={styles.eyebrow}>From one story to the next</p>
      <h2>Words that stay.</h2>
      {reviews.length ? (
        reviews.slice(0, 6).map((r, i) => (
          <figure key={i}>
            <blockquote>{r.quote}</blockquote>
            <figcaption>{r.name}</figcaption>
          </figure>
        ))
      ) : (
        <p>
          {b.demoContent
            ? "A place for genuine client stories. Add your own reviews when you make this website yours."
            : "We look forward to sharing our clients’ stories here."}
        </p>
      )}
    </section>
  );
  const details = (
    <div className={styles.contactDetails}>
      <h2>A conversation first.</h2>
      <p>
        {address ||
          (preview || b.demoContent
            ? "Add your studio address in JKTL Business."
            : "Ask the artist about visit arrangements.")}
      </p>
      {email && <a href={`mailto:${email}`}>{email}</a>}
      {phone && <a href={`tel:${phone}`}>{phone}</a>}
      {/^\d{7,15}$/.test(whatsapp) && (
        <a
          href={`https://wa.me/${whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Chat on WhatsApp <ArrowUpRight size={14} />
        </a>
      )}
      {safeUrl(b.contact.mapUrl) && (
        <a href={b.contact.mapUrl} target="_blank" rel="noopener noreferrer">
          Open map
        </a>
      )}
      {b.hours.map((h, i) => (
        <p key={i}>
          <strong>{h.day}</strong>
          <br />
          {h.hours}
        </p>
      ))}
      {!!doc.serviceAreas?.length && (
        <>
          <h3>Service areas</h3>
          <ul>
            {doc.serviceAreas.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
  return (
    <div
      ref={root}
      className={styles.site}
      data-layout={template.layout}
      data-tattoo-template="ellie"
      style={
        {
          "--ink-paper": doc.paper,
          "--ink-colour": doc.ink,
          "--ink-accent": doc.accent,
        } as CSSProperties
      }
    >
      <a className={styles.skip} href="#tattoo-content">
        Skip to content
      </a>
      <header className={styles.header}>
        {link(
          "",
          doc.logoUrl ? photo(doc.logoUrl, doc.brandName) : doc.brandName,
          styles.brand,
        )}
        <nav aria-label="Studio navigation" className={styles.desktopNav}>
          {link("", "Home")}
          {link("about", "About")}
          {link("services", "Services")}
          {link("aftercare", "Aftercare")}
          {link("contact", "Contact")}
        </nav>
        <div className={styles.headerActions}>
          <a
            href={`https://business.jktl.com.ng${templateLoginPath(template.id)}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Sign in to JKTL Business"
          >
            <LogIn size={18} />
            <span>Sign in</span>
          </a>
          <button
            className={styles.menuButton}
            type="button"
            aria-label={menu ? "Close menu" : "Open menu"}
            aria-controls="tattoo-menu"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {menu && (
          <nav
            id="tattoo-menu"
            className={styles.mobileNav}
            aria-label="Mobile studio navigation"
          >
            {[
              "",
              "about",
              "services",
              "gallery",
              "guest-spots",
              "aftercare",
              "book",
              "contact",
            ].map((to) => (
              <Fragment key={to}>
                {link(
                  to,
                  (
                    {
                      "": "Home",
                      about: "About",
                      services: "Services",
                      gallery: "Gallery",
                      "guest-spots": "Guest visits",
                      aftercare: "Aftercare",
                      book: "Book a visit",
                      contact: "Contact",
                    } as Record<string, string>
                  )[to],
                )}
              </Fragment>
            ))}
          </nav>
        )}
      </header>
      <main id="tattoo-content">
        {!path ? (
          <>
            <section className={styles.hero}>
              <p className={styles.eyebrow}>{doc.eyebrow}</p>
              <div className={styles.heroPortrait}>
                {photo(
                  doc.heroImage,
                  "African woman with braids and tattoos — personal expression inspiration",
                  true,
                )}
              </div>
              <h1>{doc.brandName}</h1>
              <div className={styles.heroBottom}>
                <p>{doc.headline}</p>
                <div>
                  <p>{doc.intro}</p>
                  {button("services", doc.ctaLabel)}
                </div>
              </div>
            </section>
            {services()}
            {guestCards()}
            {about()}
            {gallery}
            {reviewSection}
          </>
        ) : (
          <>
            <section className={styles.pageIntro}>
              <p className={styles.eyebrow}>{doc.brandName}</p>
              <h1>{heading}</h1>
              <p>
                {service?.description ||
                  guest?.description ||
                  (path === "about"
                    ? doc.intro
                    : path === "book" || path === "contact"
                      ? doc.contactText
                      : doc.featureText)}
              </p>
            </section>
            {path === "about" && (
              <>
                {about(true)}
                {!!b.stylists.length && (
                  <section className={styles.team}>
                    {b.stylists.map((s, i) => (
                      <article key={i}>
                        {photo(s.image, s.name)}
                        <h2>{s.name}</h2>
                        <p>{s.role}</p>
                        <p>{s.bio}</p>
                      </article>
                    ))}
                  </section>
                )}
                {reviewSection}
              </>
            )}
            {path === "services" && services(true)}
            {service && (
              <section className={styles.serviceDetail}>
                <div>
                  {photo(service.image || doc.heroImage, service.title, true)}
                </div>
                <div>
                  <p className={styles.eyebrow}>Made personal</p>
                  <h2>A piece of your own story.</h2>
                  <p>{service.description}</p>
                  <p>{service.duration}</p>
                  <p>{service.price}</p>
                  <ul>
                    {service.benefits?.map((v) => (
                      <li key={v}>{v}</li>
                    ))}
                  </ul>
                  <p>{service.preparation}</p>
                  {button(
                    "book?service=" +
                      beautyServiceSlug(
                        service,
                        doc.offerings.indexOf(service),
                      ),
                    "Request this service",
                  )}
                  <p className={styles.small}>
                    Your artist confirms suitability, pricing and availability.
                    No payment is taken here.
                  </p>
                </div>
              </section>
            )}
            {path === "gallery" && gallery}
            {path === "aftercare" && aftercare}
            {path === "guest-spots" && guestCards(true)}
            {guest && (
              <section className={styles.serviceDetail}>
                <div>{photo(guest.image, guest.studio, true)}</div>
                <div>
                  <p className={styles.eyebrow}>{guest.city}</p>
                  <h2>{guest.dates}</h2>
                  <p>{guest.description}</p>
                  {button(
                    "contact?guest=" +
                      beautyGuestSlug(guest, guests.indexOf(guest)),
                    "Enquire about this visit",
                  )}
                  <p className={styles.small}>
                    Confirm arrangements directly with the artist before making
                    travel plans.
                  </p>
                </div>
              </section>
            )}
            {(path === "book" || path === "contact") && (
              <section className={styles.contactLayout}>
                {details}
                <div className={styles.request}>
                  <BeautyRequestForm
                    key={path + queryService + (selectedGuest?.studio || "")}
                    document={doc}
                    kind={path === "book" ? "appointment" : "contact"}
                    initialService={queryService}
                    initialMessage={
                      selectedGuest
                        ? `I’m interested in ${selectedGuest.studio} in ${selectedGuest.city}. Please tell me about the available arrangements.`
                        : undefined
                    }
                    onRequest={preview ? undefined : onRequest}
                  />
                </div>
              </section>
            )}
          </>
        )}
        {path !== "book" && path !== "contact" && (
          <section className={styles.callout}>
            <p className={styles.eyebrow}>
              One little idea. A new conversation.
            </p>
            <h2>{doc.contactTitle}</h2>
            <p>{doc.contactText}</p>
            {button("book", "Talk about your idea")}
            {link("contact", "Ask a question", styles.textLink)}
          </section>
        )}
        {businessSection}
      </main>
      <footer className={styles.footer}>
        <div>
          <div>
            <h2>Explore</h2>
            {link("about", "About the artist")}
            {link("services", "Services")}
            {link("gallery", "Gallery")}
            {link("guest-spots", "Guest visits")}
            {link("aftercare", "Aftercare")}
            {link("contact", "Contact")}
          </div>
          <div>
            <h2>Visit & connect</h2>
            {address && <p>{address}</p>}
            {email && <a href={`mailto:${email}`}>{email}</a>}
            {phone && <a href={`tel:${phone}`}>{phone}</a>}
            {socials.map((s) => (
              <a
                key={s.platform}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {s.platform === "instagram" ? (
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    aria-hidden="true"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle
                      cx="17.5"
                      cy="6.5"
                      r=".8"
                      fill="currentColor"
                      stroke="none"
                    />
                  </svg>
                ) : s.platform === "facebook" ? (
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <path d="M14 21v-8h3l.5-4H14V7c0-1 .5-2 2-2h2V2h-3c-3 0-5 2-5 5v2H7v4h3v8" />
                  </svg>
                ) : (
                  <ArrowUpRight size={15} />
                )}{" "}
                {s.platform}
              </a>
            ))}
            {!address && !email && !phone && (
              <p>
                By arrangement.
                <br />
                Start with a conversation.
              </p>
            )}
          </div>
        </div>
        <p className={styles.wordmark}>{doc.brandName}</p>
        <div className={styles.footerBottom}>
          <p>
            © {new Date().getFullYear()} {doc.brandName}
          </p>
          {b.demoContent && (
            <p>
              Sample website · photos are inspiration, not this studio’s work.
              Guest visits are unconfirmed examples.
            </p>
          )}
          {!hideBranding && (
            <a
              href="https://jktl.com.ng/templates"
              target="_blank"
              rel="noopener noreferrer"
            >
              Made with JKTL
            </a>
          )}
        </div>
      </footer>
    </div>
  );
}
