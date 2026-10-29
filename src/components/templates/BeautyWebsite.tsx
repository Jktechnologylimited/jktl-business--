"use client";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  beautyServiceSlug,
  templateLoginPath,
  type WebsiteTemplate,
  type WebsiteDocument,
} from "@/lib/website-templates";
import styles from "./BeautyWebsite.module.css";
export type BeautyRequest = {
  kind: "appointment" | "contact";
  name: string;
  email: string;
  phone: string;
  service: string;
  date: string;
  time: string;
  message: string;
  website: string;
};
export function BeautyWebsite({
  document: doc,
  template,
  preview = false,
  pagePath = "",
  basePath = "",
  initialService = "",
  onNavigate,
  onRequest,
  contact = {},
  reviews = [],
  hideBranding = false,
  onInteraction,
}: {
  document: WebsiteDocument;
  template?: WebsiteTemplate;
  preview?: boolean;
  pagePath?: string;
  basePath?: string;
  initialService?: string;
  onNavigate?: (path: string) => void;
  onRequest?: (
    input: BeautyRequest,
  ) => Promise<{ ok: boolean; error?: string }>;
  contact?: {
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    instagramUrl?: string;
    facebookUrl?: string;
    tiktokUrl?: string;
  };
  reviews?: { name: string; quote: string; rating?: number | null }[];
  hideBranding?: boolean;
  onInteraction?: (kind: "cta" | "contact") => void;
}) {
  const b = doc.beauty!;
  const atelier = b.design === "atelier";
  const luxe = b.design === "luxe";
  const barber = b.design === "barber";
  const workGallery = useRef<HTMLDivElement>(null);
  const scrollWork = (direction: number) => {
    const track = workGallery.current;
    if (track)
      track.scrollBy({
        left: direction * track.clientWidth * 0.8,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
  };
  const [menu, setMenu] = useState(false),
    [category, setCategory] = useState("All"),
    [selected, setSelected] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const path = pagePath.split("?")[0];
  const serviceParam =
    initialService ||
    new URLSearchParams(pagePath.split("?")[1] || "").get("service") ||
    "";
  const serviceIndex = doc.offerings.findIndex(
    (s, i) => path === `services/${beautyServiceSlug(s, i)}`,
  );
  const service = doc.offerings[serviceIndex];
  const phone = b.contact.phone || contact.phone || "",
    email = b.contact.email || contact.email || "";
  const address =
    b.contact.address ||
    [contact.address, contact.city, contact.state].filter(Boolean).join(", ");
  const whatsappDigits = (b.contact.whatsapp || phone).replace(/[^\d]/g, "");
  const whatsapp = /^0\d{10}$/.test(whatsappDigits)
    ? "234" + whatsappDigits.slice(1)
    : /^\d{10}$/.test(whatsappDigits)
      ? "234" + whatsappDigits
      : whatsappDigits;
  const map =
    b.contact.mapUrl ||
    (address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
      : "");
  const route = (to: string) => {
    const base = basePath.replace(/\/$/, "");
    return to ? `${base}/${to}` : base || "/";
  };
  const link = (to: string, label: ReactNode, className?: string) => (
    <a
      className={className}
      href={route(to)}
      aria-current={path === to ? "page" : undefined}
      onClick={(e) => {
        if (to.startsWith("book")) onInteraction?.("cta");
        if (
          onNavigate &&
          !e.metaKey &&
          !e.ctrlKey &&
          !e.shiftKey &&
          !e.altKey
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
  const book = (slug = "") =>
    link(
      "book" + (slug ? `?service=${encodeURIComponent(slug)}` : ""),
      doc.ctaLabel || "Request an appointment",
      styles.button,
    );
  const photo = (src: string, alt: string, cls?: string, eager = false) => (
    <img
      src={src}
      srcSet={
        /^\/template-photos\/beauty\/(hero|interior|styling|colour|stylist)\.jpg$/.test(
          src,
        )
          ? `${src.replace(".jpg", "-small.jpg")} 640w, ${src} ${{ hero: 1400, interior: 1400, styling: 1000, colour: 1100, stylist: 1000 }[src.split("/").pop()!.replace(".jpg", "") as "hero"]}w`
          : undefined
      }
      sizes="(max-width: 767px) 100vw, 50vw"
      alt={alt}
      className={cls}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      decoding="async"
      width={1200}
      height={1500}
      onError={(e) => {
        if (!e.currentTarget.dataset.fallback) {
          e.currentTarget.dataset.fallback = "true";
          e.currentTarget.src = "/template-photos/beauty/interior.jpg";
        }
      }}
    />
  );
  const title = (kicker: string, heading: string, text?: string) => (
    <header className={styles.pageHeader}>
      <p className={styles.eyebrow}>{kicker}</p>
      <h1>{heading}</h1>
      {text && <p>{text}</p>}
    </header>
  );
  const services = (limit = doc.offerings.length) => (
    <div className={styles.serviceList}>
      {doc.offerings.slice(0, limit).map((s, i) => (
        <article key={beautyServiceSlug(s, i)}>
          <span className={styles.number}>0{i + 1}</span>
          <div>
            <p className={styles.eyebrow}>{s.category || "Salon service"}</p>
            <h3>{link(`services/${beautyServiceSlug(s, i)}`, s.title)}</h3>
            <p>{s.description}</p>
            <div className={styles.serviceMeta}>
              <span>{s.duration}</span>
              <span>{s.price}</span>
            </div>
          </div>
          {link(
            `services/${beautyServiceSlug(s, i)}`,
            <span>
              <span
                className={styles.visuallyHidden}
              >{`Explore ${s.title}`}</span>
              <svg
                aria-hidden="true"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M6 18 18 6M6 6h12v12" />
              </svg>
            </span>,
            styles.arrow,
          )}
        </article>
      ))}
    </div>
  );
  const hours = (
    <dl className={styles.hours}>
      {b.hours.map((h) => (
        <div key={h.day}>
          <dt>{h.day}</dt>
          <dd>{h.hours}</dd>
        </div>
      ))}
    </dl>
  );
  const stories = reviews.length ? reviews : doc.reviews || [];
  const pageTitle =
    path === ""
      ? "Home"
      : path === "services"
        ? "Services"
        : service?.title ||
          (
            {
              about: "About",
              gallery: "Gallery",
              book: "Book",
              contact: "Contact",
            } as Record<string, string>
          )[path] ||
          "Home";
  return (
    <div
      data-layout="portrait"
      data-beauty-version="2"
      className={`${styles.site} ${atelier ? styles.atelier : ""} ${luxe ? styles.luxe : ""} ${barber ? styles.barber : ""}`}
      style={
        {
          "--beauty-accent": doc.accent,
          "--beauty-paper": doc.paper,
          "--beauty-ink": doc.ink,
        } as CSSProperties
      }
    >
      <a href="#salon-content" className={styles.skip}>
        Skip to content
      </a>
      {barber && (
        <div className={styles.barberTicker} aria-label="Our approach">
          {doc.featureItems.join("　 ✦　 ")}
        </div>
      )}
      <header className={styles.navbar}>
        {link(
          "",
          <>
            {doc.logoUrl ? (
              photo(doc.logoUrl, `${doc.brandName} logo`, styles.logo)
            ) : (
              <span className={styles.monogram}>
                {doc.brandName
                  .split(/\s+/)
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join("")}
              </span>
            )}
            <span>{doc.brandName}</span>
          </>,
          styles.brand,
        )}
        <div className={styles.headerActions}>
          <a
            className={styles.signIn}
            href={
              preview
                ? `https://business.jktl.com.ng${templateLoginPath(template?.id || "")}`
                : "https://business.jktl.com.ng/login"
            }
            target={preview ? "_top" : undefined}
            aria-label="Sign in to JKTL Business"
            title="Sign in to JKTL Business"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
            </svg>
          </a>
          <button
            className={styles.menuButton}
            aria-expanded={menu}
            aria-controls="salon-navigation"
            onClick={() => setMenu(!menu)}
          >
            {menu ? "Close −" : "Menu +"}
          </button>
        </div>
        <nav
          id="salon-navigation"
          aria-label={barber ? "Barbershop navigation" : "Salon navigation"}
          className={menu ? styles.navigationOpen : styles.navigation}
        >
          {[
            ["", "Home"],
            ["about", "Our story"],
            ["services", "Services"],
            ["gallery", "Gallery"],
            ["contact", "Contact"],
          ].map(([to, label]) => (
            <span key={to}>{link(to, label)}</span>
          ))}
          {link("book", "Book a visit", styles.navBook)}
        </nav>
      </header>
      <main id="salon-content" tabIndex={-1}>
        {path === "" && barber && (
          <>
            <section className={styles.barberHero}>
              <div className={styles.barberHeroSide}>
                <p className={styles.eyebrow}>{doc.eyebrow}</p>
                <h1>{doc.headline}</h1>
                <p>{doc.intro}</p>
                {book()}
                <span className={styles.barberVertical} aria-hidden="true">
                  {doc.brandName}
                </span>
              </div>
              <div className={styles.barberHeroPhotos}>
                {photo(
                  doc.heroImage,
                  "A precision haircut in progress",
                  undefined,
                  true,
                )}
                {photo(
                  b.aboutImage,
                  "Traditional barbering and careful beard care",
                  undefined,
                  true,
                )}
              </div>
            </section>
            <section className={styles.barberServices}>
              <h2>{doc.offeringsTitle}</h2>
              <div>
                {doc.offerings.map((service, i) => (
                  <article key={i}>
                    <h3>
                      {link(
                        `services/${beautyServiceSlug(service, i)}`,
                        service.title,
                      )}
                    </h3>
                    <p>{service.duration}</p>
                    <p>{service.price}</p>
                    {book(beautyServiceSlug(service, i))}
                  </article>
                ))}
              </div>
              {b.demoContent && (
                <p className={styles.finePrint}>
                  Editable example prices · final services and prices are
                  confirmed by your barber.
                </p>
              )}
            </section>
            <section className={styles.barberWork}>
              <h2>{doc.galleryTitle}</h2>
              <p>{doc.featureText}</p>
              <div className={styles.barberWorkControls}>
                <button
                  type="button"
                  aria-label="Previous work images"
                  aria-controls="barber-work"
                  onClick={() => scrollWork(-1)}
                >
                  ←
                </button>
                {link("gallery", "Explore the full gallery →", styles.textLink)}
                <button
                  type="button"
                  aria-label="Next work images"
                  aria-controls="barber-work"
                  onClick={() => scrollWork(1)}
                >
                  →
                </button>
              </div>
              <div
                id="barber-work"
                ref={workGallery}
                className={styles.barberWorkTrack}
                tabIndex={0}
                role="region"
                aria-label="Barbershop work gallery"
              >
                {doc.gallery.map((image, i) => (
                  <figure key={i}>
                    {link("gallery", photo(image.src, image.alt))}
                    <figcaption>{image.alt}</figcaption>
                  </figure>
                ))}
              </div>
            </section>
            <section className={`${styles.section} ${styles.barberTeam}`}>
              <h2>{doc.featureTitle}</h2>
              <p>{doc.featureText}</p>
              <div className={styles.team}>
                {b.stylists.map((person, i) => (
                  <article key={i}>
                    {photo(person.image, `${person.name}, ${person.role}`)}
                    <div>
                      <h3>{person.name}</h3>
                      <p>{person.role}</p>
                      <p>{person.bio}</p>
                    </div>
                  </article>
                ))}
              </div>
              {link("about", "Our story →", styles.textLink)}
            </section>
            <section className={styles.barberReviews}>
              <p className={styles.eyebrow}>
                {b.demoContent && !reviews.length
                  ? "EDITABLE DEMO TESTIMONIALS"
                  : "CLIENT STORIES"}
              </p>
              <h2>What our clients say</h2>
              <div>
                {stories.slice(0, 3).map((story, i) => (
                  <blockquote key={i}>
                    <p>“{story.quote}”</p>
                    <cite>{story.name}</cite>
                  </blockquote>
                ))}
              </div>
              {!stories.length && <p>Your clients’ words belong here.</p>}
            </section>
          </>
        )}
        {path === "" && luxe && (
          <>
            <section className={styles.luxeHero}>
              {photo(
                doc.heroImage,
                `${doc.brandName} editorial hair portrait`,
                undefined,
                true,
              )}
              <div className={styles.luxeHeroContent}>
                <div>
                  <p className={styles.eyebrow}>{doc.eyebrow}</p>
                  <h1>{doc.headline}</h1>
                </div>
                <div>
                  <p>{doc.intro}</p>
                  {book()}
                </div>
              </div>
            </section>
            <section className={`${styles.section} ${styles.luxeServices}`}>
              <div>
                <p className={styles.eyebrow}>
                  CONSIDERED CUTS. EXPRESSIVE COLOUR.
                </p>
                <h2>{doc.offeringsTitle}</h2>
                <p>{doc.aboutText.split("\n\n")[0]}</p>
                {link("services", "Explore all services →", styles.textLink)}
              </div>
              <div className={styles.luxeServiceGrid}>
                {doc.offerings.slice(0, 4).map((service, i) => (
                  <article key={i}>
                    {link(
                      `services/${beautyServiceSlug(service, i)}`,
                      photo(service.image || doc.heroImage, service.title),
                    )}
                    <div>
                      <h3>
                        {link(
                          `services/${beautyServiceSlug(service, i)}`,
                          service.title,
                        )}
                      </h3>
                      <p>{service.description}</p>
                      <p>
                        {service.duration} · {service.price}
                      </p>
                      {book(beautyServiceSlug(service, i))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
            <section className={`${styles.section} ${styles.luxeTeam}`}>
              <h2>{doc.featureTitle}</h2>
              <p>{doc.featureText}</p>
              <div className={styles.team}>
                {b.stylists.map((person, i) => (
                  <article key={i}>
                    {photo(person.image, `${person.name}, ${person.role}`)}
                    <div>
                      <h3>{person.name}</h3>
                      <p>{person.role}</p>
                      <p>{person.bio}</p>
                    </div>
                  </article>
                ))}
              </div>
              {link("about", "Get to know the studio →", styles.textLink)}
            </section>
            <section className={styles.luxeReviews}>
              <div>
                <p className={styles.eyebrow}>
                  {b.demoContent && !reviews.length
                    ? "EDITABLE DEMO TESTIMONIALS"
                    : "CLIENT STORIES"}
                </p>
                <h2>Words from our clients</h2>
                {stories.slice(0, 3).map((story, i) => (
                  <blockquote key={i}>
                    <cite>{story.name}</cite>
                    <p>“{story.quote}”</p>
                  </blockquote>
                ))}
                {!stories.length && <p>Your clients’ words belong here.</p>}
              </div>
              {photo(doc.heroImage, "A portrait from the studio edit")}
            </section>
            <section className={styles.luxeVisit}>
              {photo(b.aboutImage, "A welcoming salon interior")}
              <div>
                <h2>{doc.contactTitle}</h2>
                <p>{doc.contactText}</p>
                {book()}
              </div>
            </section>
          </>
        )}
        {path === "" && atelier && (
          <>
            <section className={styles.atelierHero}>
              <div>
                <p className={styles.eyebrow}>{doc.eyebrow}</p>
                <h1>{doc.headline}</h1>
                <p>{doc.intro}</p>
                {book()}
                <p className={styles.atelierAside}>
                  A little care. A little colour. Entirely you.
                </p>
              </div>
              {photo(
                doc.heroImage,
                "An expressive beauty portrait",
                undefined,
                true,
              )}
            </section>
            <section className={`${styles.section} ${styles.atelierServices}`}>
              <h2>{doc.offeringsTitle}</h2>
              <p>A personal approach to every detail.</p>
              {services()}
            </section>
            <section
              className={styles.atelierStories}
              aria-label="Client stories"
            >
              {photo(b.aboutImage, "A personal skin care ritual")}
              <div>
                <p className={styles.eyebrow}>
                  {b.demoContent && !reviews.length
                    ? "EDITABLE DEMO TESTIMONIAL"
                    : "CLIENT STORIES"}
                </p>
                {stories.slice(0, 3).map((story, i) => (
                  <blockquote key={i}>
                    <p aria-label={`${story.rating || 5} out of 5 stars`}>
                      ★★★★★
                    </p>
                    <p>“{story.quote}”</p>
                    <cite>{story.name}</cite>
                  </blockquote>
                ))}
                {!stories.length && <p>Your clients’ words belong here.</p>}
              </div>
            </section>
            <section className={`${styles.section} ${styles.atelierTeam}`}>
              <p className={styles.eyebrow}>
                A CREATIVE SPIRIT. A PERSONAL TOUCH.
              </p>
              <h2>{doc.featureTitle}</h2>
              <p className={styles.atelierStatement}>{doc.featureText}</p>
              <div className={styles.team}>
                {b.stylists.map((person, i) => (
                  <article key={i}>
                    {photo(person.image, `${person.name}, ${person.role}`)}
                    <h3>{person.name}</h3>
                    <p>{person.role}</p>
                    <p>{person.bio}</p>
                  </article>
                ))}
              </div>
              {link("about", "Discover our story →", styles.textLink)}
            </section>
          </>
        )}
        {path === "" && !atelier && !luxe && !barber && (
          <>
            <section className={styles.hero}>
              <div className={styles.heroCopy}>
                <p className={styles.eyebrow}>{doc.eyebrow}</p>
                <h1>
                  {doc.headline
                    .split("\n")
                    .map((line, i) =>
                      i ? <em key={i}>{line}</em> : <span key={i}>{line}</span>,
                    )}
                </h1>
                <p>{doc.intro}</p>
                <div className={styles.actions}>
                  {book()}
                  {link("services", "Explore services", styles.textLink)}
                </div>
                <span className={styles.heroNote}>CUT · COLOUR · CARE</span>
              </div>
              <div className={styles.heroPhoto}>
                {photo(
                  doc.heroImage,
                  `${doc.brandName} editorial hair portrait`,
                  undefined,
                  true,
                )}
                <p>Individuality, beautifully considered.</p>
              </div>
            </section>
            <section className={`${styles.section} ${styles.introduction}`}>
              <p className={styles.eyebrow}>A PERSONAL APPROACH</p>
              <div>
                <h2>{doc.aboutTitle}</h2>
                <p>{doc.aboutText.split("\n\n")[0]}</p>
                {link("about", "Meet the studio →", styles.textLink)}
              </div>
              <span className={styles.smallMark}>
                A little time.
                <br />A little care.
                <br />
                <em>All for you.</em>
              </span>
            </section>
            <section className={`${styles.section} ${styles.servicesSection}`}>
              <div className={styles.sectionHeading}>
                <div>
                  <p className={styles.eyebrow}>THE SERVICE EDIT</p>
                  <h2>{doc.offeringsTitle}</h2>
                </div>
                {link("services", "All services →", styles.textLink)}
              </div>
              {services(3)}
            </section>
            <section className={`${styles.section} ${styles.gallerySection}`}>
              <div className={styles.sectionHeading}>
                <div>
                  <p className={styles.eyebrow}>TEXTURE. SHAPE. POSSIBILITY.</p>
                  <h2>{doc.galleryTitle}</h2>
                </div>
                {link("gallery", "Explore the gallery →", styles.textLink)}
              </div>
              <div className={styles.galleryPreview}>
                {doc.gallery.slice(0, 3).map((g, i) => (
                  <div key={g.src + i}>
                    {link("gallery", photo(g.src, g.alt))}
                    <p>{g.category || "The studio edit"}</p>
                  </div>
                ))}
              </div>
            </section>
            <section className={`${styles.section} ${styles.storySplit}`}>
              {photo(b.aboutImage, "Inside the salon studio")}
              <div>
                <p className={styles.eyebrow}>
                  THE PEOPLE BEHIND YOUR GOOD HAIR DAY
                </p>
                <h2>{doc.featureTitle}</h2>
                <p>{doc.featureText}</p>
                {link("about", "Get to know us →", styles.textLink)}
              </div>
            </section>
            {stories.length > 0 && (
              <section className={`${styles.section} ${styles.quote}`}>
                <p className={styles.eyebrow}>
                  {reviews.length
                    ? "WORDS FROM OUR CLIENTS"
                    : b.demoContent
                      ? "EDITABLE DEMO TESTIMONIAL"
                      : "CLIENT STORIES"}
                </p>
                <blockquote>“{stories[0].quote}”</blockquote>
                <p>— {stories[0].name}</p>
              </section>
            )}
          </>
        )}
        {path === "about" && (
          <>
            {title("OUR STORY", doc.aboutTitle, doc.intro)}
            <section className={`${styles.section} ${styles.storySplit}`}>
              {photo(
                b.aboutImage,
                barber
                  ? "A close look at thoughtful barbering"
                  : "A warm and welcoming salon interior",
                undefined,
                true,
              )}
              <div>
                <h2>
                  {barber
                    ? "Good craft. Good company."
                    : atelier
                      ? "Care, with a creative spirit."
                      : "A thoughtful kind of beauty."}
                </h2>
                {doc.aboutText.split("\n\n").map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
                <ul className={styles.philosophy}>
                  {b.philosophy.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            </section>
            <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <div>
                  <p className={styles.eyebrow}>
                    {b.demoContent ? "EDITABLE SAMPLE TEAM" : "THE TEAM"}
                  </p>
                  <h2>{doc.featureTitle}</h2>
                </div>
                <p>{doc.featureText}</p>
              </div>
              <div className={styles.team}>
                {b.stylists.map((s, i) => (
                  <article key={s.name + i}>
                    {photo(s.image, `${s.name}, ${s.role}`)}
                    <div>
                      <h3>{s.name}</h3>
                      <p className={styles.eyebrow}>{s.role}</p>
                      <p>{s.bio}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
        {path === "services" && (
          <>
            {title(
              "THE SERVICE EDIT",
              doc.offeringsTitle,
              atelier || barber
                ? doc.intro
                : "A considered approach to every cut, colour and texture. Explore what feels right for you.",
            )}
            <section className={`${styles.section} ${styles.servicesLayout}`}>
              <aside>
                {photo(
                  doc.heroImage,
                  "Editorial natural hair texture",
                  undefined,
                  true,
                )}
                <p>
                  A conversation first.
                  <br />A look that feels like you.
                </p>
              </aside>
              <div>
                {services()}
                <p className={styles.finePrint}>
                  {b.demoContent
                    ? "Demonstration prices and durations are editable examples. "
                    : ""}
                  Your team will confirm the treatment, duration and final price
                  before your visit.
                </p>
              </div>
            </section>
          </>
        )}
        {service && (
          <>
            {title(
              service.category || "SALON SERVICE",
              service.title,
              service.description,
            )}
            <section className={`${styles.section} ${styles.storySplit}`}>
              {photo(
                service.image || doc.heroImage,
                service.title,
                undefined,
                true,
              )}
              <div>
                <p className={styles.eyebrow}>A LITTLE TIME, WELL SPENT</p>
                <h2>Made personal.</h2>
                <div className={styles.detailMeta}>
                  <p>
                    <strong>Time</strong>
                    <br />
                    {service.duration || "Discuss with the studio"}
                  </p>
                  <p>
                    <strong>{b.demoContent ? "Example price" : "Price"}</strong>
                    <br />
                    {service.price || "By consultation"}
                  </p>
                </div>
                <ul className={styles.philosophy}>
                  {(service.benefits || []).map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                {service.preparation && (
                  <>
                    <h3>Before your visit</h3>
                    <p>{service.preparation}</p>
                  </>
                )}
                {book(beautyServiceSlug(service, serviceIndex))}
                <p className={styles.finePrint}>
                  This is a request. Availability and final pricing are
                  confirmed by the salon.
                </p>
              </div>
            </section>
            <section className={styles.section}>
              <p className={styles.eyebrow}>YOU MAY ALSO LIKE</p>
              <div className={styles.related}>
                {doc.offerings
                  .filter((s) => s !== service)
                  .slice(0, 3)
                  .map((s) => (
                    <article key={s.title}>
                      <h3>
                        {link(
                          `services/${beautyServiceSlug(s, doc.offerings.indexOf(s))}`,
                          s.title,
                        )}
                      </h3>
                      <p>{s.category}</p>
                    </article>
                  ))}
              </div>
            </section>
          </>
        )}
        {path === "gallery" && (
          <>
            {title(
              "THE STUDIO EDIT",
              doc.galleryTitle,
              barber
                ? "A closer look at our cuts, grooming rituals and the tools of the craft."
                : atelier
                  ? "A closer look at our approach to beauty, care and individual expression."
                  : "A closer look at texture, colour, shape and the space around them.",
            )}
            <section className={styles.section}>
              <div
                className={styles.filters}
                role="group"
                aria-label="Filter salon gallery"
              >
                {[
                  "All",
                  ...new Set(doc.gallery.map((g) => g.category || "Studio")),
                ].map((c) => (
                  <button
                    key={c}
                    aria-pressed={category === c}
                    onClick={() => setCategory(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className={styles.galleryGrid}>
                {doc.gallery.map(
                  (g, i) =>
                    (category === "All" ||
                      category === (g.category || "Studio")) && (
                      <figure key={g.src + i}>
                        <button
                          aria-label={`View image: ${g.alt}`}
                          onClick={() => {
                            setSelected(i);
                            dialog.current?.showModal();
                            requestAnimationFrame(() => {
                              // Native dialogs live in the iframe viewport. Bring
                              // that frame below the host toolbar without reading
                              // any parent content or crossing an origin boundary.
                              dialog.current?.ownerDocument.defaultView?.frameElement?.scrollIntoView(
                                { block: "start", inline: "nearest" },
                              );
                            });
                          }}
                        >
                          {photo(g.src, g.alt)}
                        </button>
                        <figcaption>{g.alt}</figcaption>
                      </figure>
                    ),
                )}
              </div>
              <dialog
                ref={dialog}
                className={styles.lightbox}
                aria-label="Salon gallery image"
              >
                <button
                  autoFocus
                  onClick={() => dialog.current?.close()}
                  aria-label="Close image"
                >
                  Close ×
                </button>
                {doc.gallery[selected] && (
                  <>
                    {photo(
                      doc.gallery[selected].src,
                      doc.gallery[selected].alt,
                    )}
                    <p>{doc.gallery[selected].alt}</p>
                  </>
                )}
              </dialog>
            </section>
          </>
        )}
        {path === "book" && (
          <>
            {title(
              "MAKE A LITTLE TIME FOR YOU",
              "Request an appointment.",
              "Tell us what you have in mind and when you would like to visit. We will be in touch to confirm availability and the right service for you.",
            )}
            <section className={`${styles.section} ${styles.formLayout}`}>
              <aside>
                {photo(b.aboutImage, "A calm space for your next salon visit")}
                <h3>A conversation, not a commitment.</h3>
                <p>
                  Your request is not a confirmed reservation. Your salon will
                  contact you to arrange your appointment.
                </p>
                {hours}
              </aside>
              <BeautyRequestForm
                key={serviceParam || "book"}
                kind="appointment"
                document={doc}
                initialService={serviceParam}
                onRequest={onRequest}
              />
            </section>
          </>
        )}
        {path === "contact" && (
          <>
            {title("COME AS YOU ARE", doc.contactTitle, doc.contactText)}
            <section className={`${styles.section} ${styles.formLayout}`}>
              <aside>
                <h2>
                  We would love
                  <br />
                  to hear from you.
                </h2>
                {address ? (
                  <p>{address}</p>
                ) : (
                  <p>
                    {b.demoContent
                      ? "Lagos · demonstration location"
                      : "Get in touch to arrange your visit."}
                  </p>
                )}
                <div className={styles.contactLinks}>
                  {phone && (
                    <a
                      href={`tel:${phone.replace(/[^+\d]/g, "")}`}
                      onClick={() => onInteraction?.("contact")}
                    >
                      {phone}
                    </a>
                  )}
                  {email && (
                    <a
                      href={`mailto:${email}`}
                      onClick={() => onInteraction?.("contact")}
                    >
                      {email}
                    </a>
                  )}
                  {whatsapp && (
                    <a
                      href={`https://wa.me/${whatsapp}`}
                      onClick={() => onInteraction?.("contact")}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Chat on WhatsApp
                    </a>
                  )}
                  {map && (
                    <a href={map} target="_blank" rel="noopener noreferrer">
                      Find us on the map
                    </a>
                  )}
                </div>
                {hours}
              </aside>
              <BeautyRequestForm
                kind="contact"
                document={doc}
                onRequest={onRequest}
              />
            </section>
          </>
        )}
        {!["book", "contact"].includes(path) && !(luxe && path === "") && (
          <section className={`${styles.section} ${styles.bookingStrip}`}>
            <p className={styles.eyebrow}>YOUR NEXT CHAPTER</p>
            <h2>{doc.contactTitle}</h2>
            {book()}
          </section>
        )}
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <div>
            <h2>{doc.brandName}</h2>
            <p>{doc.intro}</p>
          </div>
          <div>
            <p className={styles.eyebrow}>VISIT THE STUDIO</p>
            {address && <p>{address}</p>}
            {hours}
          </div>
          <div>
            <p className={styles.eyebrow}>STAY IN TOUCH</p>
            {phone && (
              <p>
                <a
                  href={`tel:${phone.replace(/[^+\d]/g, "")}`}
                  onClick={() => onInteraction?.("contact")}
                >
                  {phone}
                </a>
              </p>
            )}
            {email && (
              <p>
                <a
                  href={`mailto:${email}`}
                  onClick={() => onInteraction?.("contact")}
                >
                  {email}
                </a>
              </p>
            )}
            {(doc.socials?.length
              ? doc.socials
              : [
                  { platform: "instagram", url: contact.instagramUrl || "" },
                  { platform: "facebook", url: contact.facebookUrl || "" },
                ]
            )
              .filter((s) => s.url.startsWith("https://"))
              .map((s) => (
                <p key={s.platform}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.platform}
                  </a>
                </p>
              ))}
            {link("contact", "Get in touch →", styles.textLink)}
          </div>
        </div>
        {barber && <div className={styles.barberWordmark}>{doc.brandName}</div>}
        <div className={styles.footerBottom}>
          <span>
            {doc.brandName} · {pageTitle}
          </span>
          {b.demoContent && (
            <span>
              Editable demo content · stock photography · example prices and
              team.
            </span>
          )}
          {!hideBranding && (
            <a
              href="https://jktl.com.ng"
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
function BeautyRequestForm({
  kind,
  document: doc,
  initialService = "",
  onRequest,
}: {
  kind: "appointment" | "contact";
  document: WebsiteDocument;
  initialService?: string;
  onRequest?: (
    input: BeautyRequest,
  ) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  if (done)
    return (
      <div className={styles.success} role="status">
        <h2>
          Thank you.
          <br />
          We have your request.
        </h2>
        <p>
          Your message has been saved. The salon team will be in touch.
          Appointment availability is confirmed separately.
        </p>
      </div>
    );
  return (
    <form
      className={styles.form}
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        if (!onRequest) {
          setError(
            "This is a template preview. No request was sent. Publish your website to receive real enquiries.",
          );
          return;
        }
        const f = new FormData(e.currentTarget);
        setPending(true);
        try {
          const r = await onRequest({
            kind,
            name: String(f.get("name") || ""),
            email: String(f.get("email") || ""),
            phone: String(f.get("phone") || ""),
            service: String(f.get("service") || ""),
            date: String(f.get("date") || ""),
            time: String(f.get("time") || ""),
            message: String(f.get("message") || ""),
            website: String(f.get("website") || ""),
          });
          if (r.ok) setDone(true);
          else
            setError(
              r.error || "We could not send your request. Please try again.",
            );
        } catch {
          setError("We could not send your request. Please try again.");
        } finally {
          setPending(false);
        }
      }}
    >
      <p className={styles.eyebrow}>
        {kind === "appointment"
          ? "YOUR APPOINTMENT REQUEST"
          : "A NOTE TO THE STUDIO"}
      </p>
      {!onRequest && (
        <p className={styles.finePrint}>
          Preview form · no request will be submitted.
        </p>
      )}
      <label>
        Your name
        <input name="name" required maxLength={120} autoComplete="name" />
      </label>
      <div className={styles.formRow}>
        <label>
          Email address
          <input
            type="email"
            name="email"
            required
            maxLength={254}
            autoComplete="email"
          />
        </label>
        <label>
          Phone number
          <input
            type="tel"
            name="phone"
            required
            maxLength={40}
            autoComplete="tel"
          />
        </label>
      </div>
      {kind === "appointment" && (
        <>
          <label>
            Preferred service
            <select name="service" defaultValue={initialService} required>
              <option value="" disabled>
                Choose your service
              </option>
              {doc.offerings.map((s, i) => (
                <option
                  key={beautyServiceSlug(s, i)}
                  value={beautyServiceSlug(s, i)}
                >
                  {s.title}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.formRow}>
            <label>
              Preferred date
              <input type="date" name="date" required />
            </label>
            <label>
              Preferred time (WAT)
              <input type="time" name="time" required />
            </label>
          </div>
        </>
      )}
      <label>
        {kind === "contact"
          ? "Your message"
          : "Anything you would like us to know?"}
        <textarea
          name="message"
          required={kind === "contact"}
          maxLength={2000}
          rows={4}
        />
      </label>
      <label className={styles.honeypot} aria-hidden="true">
        Leave this blank
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <p className={styles.finePrint}>
        Your details are used to respond to this request. Sending a request does
        not subscribe you to marketing.
      </p>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className={styles.button}>
        {pending
          ? "Sending your request…"
          : kind === "appointment"
            ? "Send appointment request"
            : "Send your message"}{" "}
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M6 18 18 6M6 6h12v12" />
        </svg>
      </button>
    </form>
  );
}
