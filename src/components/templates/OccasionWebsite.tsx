/* eslint-disable @next/next/no-img-element -- Bundled and customer-editable template photographs avoid runtime image-optimizer requests. */
"use client";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, LogIn, Menu, X } from "lucide-react";
import {
  beautyServiceSlug,
  templateLoginPath,
  websitePageHref,
  websitePagePaths,
  type WebsiteDocument,
  type WebsiteTemplate,
} from "@/lib/website-templates";
import { BeautyRequestForm, type BeautyRequest } from "./BeautyWebsite";
import type { TemplateContact } from "./TemplateWebsite";
import styles from "./OccasionWebsite.module.css";

export function OccasionWebsite({
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
}: {
  template: WebsiteTemplate;
  document: WebsiteDocument;
  contact?: TemplateContact;
  preview?: boolean;
  hideBranding?: boolean;
  pagePath?: string;
  basePath?: string;
  initialService?: string;
  onNavigate?: (path: string) => void;
  onRequest?: (
    input: BeautyRequest,
  ) => Promise<{ ok: boolean; error?: string }>;
  onInteraction?: (kind: "cta" | "contact") => void;
  reviews?: { name: string; quote: string; rating?: number | null }[];
  businessSection?: ReactNode;
}) {
  const beauty = doc.beauty!;
  const nail = beauty.design === "nail";
  const extensions = beauty.design === "extensions";
  const [menu, setMenu] = useState(false),
    [selected, setSelected] = useState(0);
  const root = useRef<HTMLDivElement>(null),
    reduced = useReducedMotion();
  const path = pagePath.split(/[?#]/)[0];
  const service = doc.offerings.find(
    (o, i) => path === "services/" + beautyServiceSlug(o, i),
  );
  const queryService =
    initialService ||
    new URLSearchParams(pagePath.split("?")[1] || "").get("service") ||
    "";
  const paths = websitePagePaths(template, doc);
  const photo =
    doc.gallery[Math.min(selected, Math.max(0, doc.gallery.length - 1))];
  const reviews = verifiedReviews.length
    ? verifiedReviews
    : beauty.demoContent
      ? []
      : doc.reviews || [];
  const phone = (beauty.contact.phone || contact.phone || "").replace(
    /[^+\d]/g,
    "",
  );
  const rawEmail = beauty.contact.email || contact.email || "";
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : "";
  const address =
    beauty.contact.address ||
    [contact.address, contact.city, contact.state].filter(Boolean).join(", ");
  const safeUrl = (url: string) => {
    try {
      const u = new URL(url);
      return u.protocol === "https:" && !u.username && !u.password ? url : "";
    } catch {
      return "";
    }
  };
  const socials = (doc.socials || []).filter((s) => safeUrl(s.url));
  const whatsapp = (beauty.contact.whatsapp || phone)
    .replace(/\D/g, "")
    .replace(/^0(?=\d{10}$)/, "234");
  const heading =
    service?.title ||
    (
      {
        about: doc.aboutTitle,
        services: doc.offeringsTitle,
        gallery: doc.galleryTitle,
        book: doc.contactTitle,
        contact: doc.contactTitle,
      } as Record<string, string>
    )[path] ||
    doc.headline;
  useEffect(() => {
    if (onNavigate)
      root.current?.ownerDocument.defaultView?.scrollTo({ top: 0 });
  }, [pagePath, onNavigate]);
  const image = (src: string, alt: string, eager = false) => (
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
        if (to === "contact") onInteraction?.("contact");
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
  const about = (full = false) => (
    <section className={styles.about}>
      <div className={styles.aboutPhoto}>
        {image(
          beauty.aboutImage,
          `${doc.brandName} — a personal approach to ${extensions ? "hair extensions" : nail ? "nail care" : "bridal beauty"}`,
        )}
      </div>
      <div className={styles.aboutCopy}>
        <p className={styles.eyebrow}>
          {extensions
            ? "Your own hair story"
            : nail
              ? "The studio"
              : "Your own kind of beautiful"}
        </p>
        <h2>{doc.aboutTitle}</h2>
        <p className={styles.paragraph}>{doc.aboutText}</p>
        {full ? (
          <ul className={styles.philosophy}>
            {beauty.philosophy.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : (
          button("about", "Get to know us")
        )}
      </div>
    </section>
  );
  const offerings = (full = false) => (
    <section className={styles.offerings}>
      <div className={styles.sectionIntro}>
        <div>
          <p className={styles.eyebrow}>
            {nail
              ? "Made personal. Never ordinary."
              : "Considered from the first conversation"}
          </p>
          <h2>{doc.offeringsTitle}</h2>
        </div>
        <p>{doc.featureText}</p>
      </div>
      {extensions ? (
        <div className={styles.extensionServices}>
          <div>
            {doc.offerings.map((o, i) => (
              <motion.article
                key={beautyServiceSlug(o, i)}
                initial={false}
                whileHover={reduced ? undefined : { x: 4 }}
              >
                <div>
                  {link(
                    "services/" + beautyServiceSlug(o, i),
                    <h3>{o.title}</h3>,
                    undefined,
                    `Explore ${o.title}`,
                  )}
                  <p>{o.description}</p>
                  {full && <p className={styles.small}>{o.price}</p>}
                </div>
                {link(
                  "book?service=" + beautyServiceSlug(o, i),
                  "Enquire",
                  styles.headerBook,
                  `Enquire about ${o.title}`,
                )}
              </motion.article>
            ))}
          </div>
          <div className={styles.extensionServicePhoto}>
            {image(beauty.aboutImage, "Personal hair-extension inspiration")}
          </div>
        </div>
      ) : (
        <div className={styles.serviceGrid}>
          {doc.offerings.map((o, i) => (
            <motion.article
              key={beautyServiceSlug(o, i)}
              initial={false}
              whileHover={reduced ? undefined : { y: -4 }}
              className={styles.serviceCard}
            >
              {link(
                "services/" + beautyServiceSlug(o, i),
                <>
                  <div className={styles.servicePhoto}>
                    {image(o.image || doc.heroImage, o.title)}
                  </div>
                  <div className={styles.serviceName}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <h3>{o.title}</h3>
                    <ArrowUpRight size={18} aria-hidden="true" />
                  </div>
                </>,
                undefined,
                `Explore ${o.title}`,
              )}
              <p>{o.description}</p>
              {full && <p className={styles.small}>{o.price}</p>}
            </motion.article>
          ))}
        </div>
      )}
      {!full && button("services", "Explore all services")}
    </section>
  );
  const gallery = (full = false) => (
    <section className={styles.gallery}>
      <div className={styles.sectionIntro}>
        <div>
          <p className={styles.eyebrow}>
            {nail ? "A little everyday art" : "A moment, remembered"}
          </p>
          <h2>{doc.galleryTitle}</h2>
        </div>
        {!full &&
          link(
            "gallery",
            <>
              Explore the gallery <ArrowUpRight size={16} />
            </>,
            styles.textLink,
          )}
      </div>
      {nail || extensions ? (
        <div className={styles.galleryGrid}>
          {(full ? doc.gallery : doc.gallery.slice(0, 3)).map((p, i) => (
            <motion.figure
              key={i}
              initial={false}
              whileHover={reduced ? undefined : { y: -4 }}
            >
              {image(p.src, p.alt)}
              <figcaption>
                <span>{String(i + 1).padStart(2, "0")}</span>
                {p.category || p.alt}
              </figcaption>
            </motion.figure>
          ))}
        </div>
      ) : (
        photo && (
          <div className={styles.galleryFeature}>
            <div
              className={styles.galleryChoices}
              role="group"
              aria-label="Choose a bridal photograph"
            >
              {doc.gallery.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  aria-pressed={selected === i}
                  aria-label={`Show bridal photograph ${i + 1}: ${p.category || p.alt}`}
                  onClick={() => setSelected(i)}
                >
                  {String(i + 1).padStart(2, "0")}{" "}
                  <span>{p.category || p.alt}</span>
                </button>
              ))}
            </div>
            <figure aria-live="polite">
              <div key={photo.src} className={styles.galleryImage}>
                {image(photo.src, photo.alt)}
              </div>
              <figcaption>{photo.category || photo.alt}</figcaption>
            </figure>
          </div>
        )
      )}
    </section>
  );
  const reviewSection = (
    <section className={styles.reviews}>
      <h2>
        {extensions
          ? "Your hair. Your story."
          : nail
            ? "Word on the street"
            : "Words of love"}
      </h2>
      <div>
        {reviews.length ? (
          reviews.slice(0, 6).map((r, i) => (
            <figure key={i}>
              <span className={styles.reviewNumber}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <blockquote>{r.quote}</blockquote>
              <figcaption>{r.name}</figcaption>
            </figure>
          ))
        ) : (
          <div className={styles.reviewEmpty}>
            <span className={styles.eyebrow}>Your experience belongs here</span>
            <p>
              {beauty.demoContent
                ? "A space for genuine client stories. Add your own reviews when you make this website yours."
                : "We look forward to sharing our clients’ stories here."}
            </p>
            {link("contact", "Start a conversation", styles.textLink)}
          </div>
        )}
      </div>
    </section>
  );
  const process = (
    <section className={styles.process}>
      <p className={styles.eyebrow}>{doc.featureTitle}</p>
      <div>
        {doc.featureItems.map((p, i) => (
          <div key={i}>
            <span>{String(i + 1).padStart(2, "0")}</span>
            <p>{p}</p>
          </div>
        ))}
      </div>
    </section>
  );
  const questions = (
    <section className={styles.faq}>
      <h2>{doc.faqTitle}</h2>
      <div>
        {doc.faqs.map((f, i) => (
          <details key={i}>
            <summary>{f.question}</summary>
            <p>{f.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
  const details = (
    <div className={styles.contactDetails}>
      <h2>Find your way to us.</h2>
      {address ? (
        <p>{address}</p>
      ) : (
        <p>
          {preview || beauty.demoContent
            ? "Add your studio address and contact details in JKTL Business."
            : "Ask the studio for visit arrangements."}
        </p>
      )}
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
      {safeUrl(beauty.contact.mapUrl) && (
        <a
          href={beauty.contact.mapUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open map <ArrowUpRight size={14} />
        </a>
      )}
      <h3>Opening arrangements</h3>
      {beauty.hours.map((h, i) => (
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
      className={`${styles.site} ${extensions ? styles.extensions : nail ? styles.nail : styles.bridal}`}
      data-layout={template.layout}
      data-occasion-template={
        extensions ? "extensions" : nail ? "nail" : "bridal"
      }
      style={
        {
          "--occasion-paper": doc.paper,
          "--occasion-ink": doc.ink,
          "--occasion-accent": doc.accent,
        } as CSSProperties
      }
    >
      <a className={styles.skip} href="#occasion-content">
        Skip to content
      </a>
      {extensions &&
        link(
          "",
          doc.logoUrl ? image(doc.logoUrl, doc.brandName) : doc.brandName,
          styles.masthead,
        )}
      <header className={styles.header}>
        {link(
          "",
          doc.logoUrl ? image(doc.logoUrl, doc.brandName) : doc.brandName,
          styles.brand,
        )}
        <nav className={styles.desktopNav} aria-label="Studio navigation">
          {link("", "Home")}
          {link("services", "Services")}
          {link("about", "About")}
          {link("gallery", "Gallery")}
          {link("contact", "Contact")}
        </nav>
        <div className={styles.headerActions}>
          <a
            href={`https://business.jktl.com.ng${templateLoginPath(template.id)}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Sign in to JKTL Business"
            className={styles.signIn}
          >
            <LogIn size={18} />
            <span>Sign in</span>
          </a>
          {link("book", nail ? "Book a visit" : "Enquire", styles.headerBook)}
          <button
            type="button"
            className={styles.menuButton}
            aria-label={menu ? "Close menu" : "Open menu"}
            aria-expanded={menu}
            aria-controls="occasion-menu"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {menu && (
          <nav
            id="occasion-menu"
            className={styles.mobileNav}
            aria-label="Mobile studio navigation"
          >
            {link("", "Home")}
            {link("services", "Services")}
            {link("about", "About")}
            {link("gallery", "Gallery")}
            {link("book", "Book a visit")}
            {link("contact", "Contact")}
          </nav>
        )}
      </header>
      <main id="occasion-content">
        {!path ? (
          <>
            {extensions ? (
              <section className={styles.extensionsHero}>
                <div className={styles.extensionPortrait}>
                  {image(
                    doc.heroImage,
                    "African woman with sleek dark hair — studio inspiration",
                    true,
                  )}
                </div>
                <div className={styles.extensionHeroCopy}>
                  <p className={styles.eyebrow}>{doc.eyebrow}</p>
                  <h1>{doc.headline}</h1>
                  <p>{doc.intro}</p>
                  {button("services", doc.ctaLabel)}
                </div>
                <div className={styles.extensionCollage}>
                  {doc.gallery.slice(0, 3).map((g, i) => (
                    <motion.div
                      key={i}
                      initial={false}
                      whileHover={reduced ? undefined : { y: -3 }}
                    >
                      {link(
                        "gallery",
                        image(g.src, g.alt),
                        undefined,
                        `Explore hair inspiration ${i + 1}`,
                      )}
                    </motion.div>
                  ))}
                </div>
              </section>
            ) : (
              <section className={styles.hero}>
                <div className={styles.heroPhoto}>
                  {image(
                    doc.heroImage,
                    `${doc.brandName} — ${nail ? "expressive nail art on an African woman" : "African bridal beauty inspiration"}`,
                    true,
                  )}
                </div>
                <div className={styles.heroCopy}>
                  <p className={styles.eyebrow}>{doc.eyebrow}</p>
                  <h1>{doc.headline}</h1>
                  <div>
                    <p>{doc.intro}</p>
                    {button("services", doc.ctaLabel)}
                  </div>
                </div>
                {!nail && (
                  <span className={styles.heroNote}>
                    A personal beginning. A beautiful memory.
                  </span>
                )}
              </section>
            )}
            {nail || extensions ? (
              <>
                {offerings()}
                {gallery()}
                {reviewSection}
                {about()}
              </>
            ) : (
              <>
                {about()}
                {offerings()}
                {gallery()}
                {reviewSection}
              </>
            )}
            {process}
            {questions}
          </>
        ) : (
          <>
            <section className={styles.pageIntro}>
              <p className={styles.eyebrow}>{doc.brandName}</p>
              <h1>{heading}</h1>
              <p>
                {service?.description ||
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
                {process}
                {!!beauty.stylists.length && (
                  <section className={styles.team}>
                    <h2>Meet your artists</h2>
                    <div>
                      {beauty.stylists.map((s, i) => (
                        <article key={i}>
                          {image(s.image, s.name)}
                          <h3>{s.name}</h3>
                          <p>{s.role}</p>
                          <p>{s.bio}</p>
                        </article>
                      ))}
                    </div>
                  </section>
                )}
                {reviewSection}
              </>
            )}
            {path === "services" && (
              <>
                {offerings(true)}
                {questions}
              </>
            )}
            {service && (
              <section className={styles.serviceDetail}>
                <div>
                  {image(service.image || doc.heroImage, service.title, true)}
                </div>
                <div>
                  <p className={styles.eyebrow}>Made personal</p>
                  <h2>A little more about your visit.</h2>
                  <p>{service.description}</p>
                  <p className={styles.small}>{service.duration}</p>
                  <p className={styles.small}>{service.price}</p>
                  {service.benefits?.length ? (
                    <ul>
                      {service.benefits.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  ) : null}
                  {service.preparation && <p>{service.preparation}</p>}
                  {button(
                    "book?service=" +
                      encodeURIComponent(
                        beautyServiceSlug(
                          service,
                          doc.offerings.indexOf(service),
                        ),
                      ),
                    "Request this service",
                  )}
                  <p className={styles.small}>
                    Availability and final pricing are confirmed by the studio.
                    No payment is taken here.
                  </p>
                </div>
              </section>
            )}
            {path === "gallery" && gallery(true)}
            {(path === "book" || path === "contact") && (
              <section className={styles.contactLayout}>
                {details}
                <div className={styles.request}>
                  <BeautyRequestForm
                    key={path + queryService}
                    kind={path === "book" ? "appointment" : "contact"}
                    document={doc}
                    initialService={queryService}
                    onRequest={preview ? undefined : onRequest}
                  />
                </div>
              </section>
            )}
          </>
        )}
        {path !== "book" && path !== "contact" && (
          <section className={styles.callout}>
            <div>
              <p className={styles.eyebrow}>{doc.brandName}</p>
              <h2>{nail ? doc.featureTitle : doc.contactTitle}</h2>
            </div>
            {button(
              "book",
              nail ? "Request your appointment" : "Request a consultation",
            )}
          </section>
        )}
        {businessSection}
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <div className={styles.footerBrand}>
            {doc.logoUrl ? image(doc.logoUrl, doc.brandName) : doc.brandName}
          </div>
          <div>
            <h2>Explore</h2>
            {link("about", "About the studio")}
            {link("services", "Our services")}
            {link("gallery", "The gallery")}
            {link("book", "Book a visit")}
            {link("contact", "Get in touch")}
          </div>
          <div>
            <h2>Contact</h2>
            {address && <p>{address}</p>}
            {email && <a href={`mailto:${email}`}>{email}</a>}
            {phone && <a href={`tel:${phone}`}>{phone}</a>}
            {!address && !email && !phone && (
              <p>
                By appointment.
                <br />
                Start with an enquiry.
              </p>
            )}
          </div>
          <div>
            <h2>Follow along</h2>
            {socials.length ? (
              socials.map((s) => (
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
                  )}
                  {s.platform}
                </a>
              ))
            ) : (
              <p>
                Personal stories.
                <br />
                Beautiful details.
              </p>
            )}
          </div>
        </div>
        <div className={styles.footerBottom}>
          <p>
            © {new Date().getFullYear()} {doc.brandName}
          </p>
          {beauty.demoContent && (
            <p>
              Sample website · photos are inspiration, not this studio’s work.
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
