/* eslint-disable @next/next/no-img-element -- Template photos are locally compressed or customer-editable; avoid runtime image-optimizer requests. */
"use client";
import {
  useState,
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, LogIn, Menu, X } from "lucide-react";
import {
  templateLoginPath,
  websitePageHref,
  websitePageMeta,
  websitePagePaths,
  beautyServiceSlug,
  type WebsiteDocument,
  type WebsiteTemplate,
} from "@/lib/website-templates";
import type { TemplateContact } from "./TemplateWebsite";
import styles from "./DressmakerWebsite.module.css";
export function DressmakerWebsite({
  template,
  document: doc,
  contact = {},
  preview = false,
  hideBranding = false,
  onInteraction,
  reviews: verifiedReviews = [],
  pagePath = "",
  basePath = "",
  onNavigate,
  businessSection,
}: {
  pagePath?: string;
  basePath?: string;
  onNavigate?: (path: string) => void;
  businessSection?: ReactNode;
  template: WebsiteTemplate;
  document: WebsiteDocument;
  contact?: TemplateContact;
  preview?: boolean;
  hideBranding?: boolean;
  onInteraction?: (kind: "cta" | "contact") => void;
  reviews?: { name: string; quote: string; rating?: number | null }[];
}) {
  const [menu, setMenu] = useState(false),
    [notice, setNotice] = useState("");
  const root = useRef<HTMLDivElement>(null),
    reduced = useReducedMotion();
  const path = pagePath.split(/[?#]/)[0],
    meta = websitePageMeta(template, doc, path);
  const route = (p: string) => websitePageHref(basePath, p);
  const hrefFor = (id: string) =>
    route(
      (
        {
          home: "",
          about: "atelier",
          offerings: "collection",
          contact: "contact",
          approach: "our-process",
          gallery: "gallery",
          questions: "faqs",
        } as Record<string, string>
      )[id] ?? id,
    );
  const look = doc.offerings.find(
    (o, i) => path === "collection/" + beautyServiceSlug(o, i),
  );
  useEffect(() => {
    if (onNavigate)
      root.current?.ownerDocument.defaultView?.scrollTo({ top: 0 });
  }, [pagePath, onNavigate]);
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email || "")
    ? contact.email
    : "";
  const phone = (contact.phone || "").replace(/[^+\d]/g, "");
  const location = [contact.address, contact.city, contact.state]
    .filter(Boolean)
    .join(", ");
  const reviews = verifiedReviews.length
    ? verifiedReviews
    : doc.demoContent
      ? []
      : doc.reviews || [];
  const safeSocial = (url: string) => {
    try {
      const u = new URL(url);
      return u.protocol === "https:" && !u.username && !u.password ? url : "";
    } catch {
      return "";
    }
  };
  const social = doc.socials?.filter((s) => safeSocial(s.url)) || [];
  const image = (src: string, alt: string, eager = false) => (
    <img
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={(e) => {
        if (!e.currentTarget.dataset.fallback) {
          e.currentTarget.dataset.fallback = "true";
          e.currentTarget.src = "/template-art/dressmaker-atelier.svg";
        }
      }}
    />
  );
  const nav = (href: string, label: string) => (
    <a href={href} onClick={() => setMenu(false)}>
      {label}
    </a>
  );
  const consultation = () => onInteraction?.("cta");
  return (
    <div
      ref={root}
      onClickCapture={(event) => {
        const a = (event.target as Element).closest("a");
        if (
          !a ||
          !onNavigate ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          a.target
        )
          return;
        const href = a.getAttribute("href") || "",
          base = basePath.replace(/\/$/, "");
        const to =
          href === base || href === "/"
            ? ""
            : href.startsWith(base + "/")
              ? href.slice(base.length + 1)
              : null;
        if (to !== null && websitePagePaths(template, doc).includes(to)) {
          event.preventDefault();
          onNavigate(to);
          setMenu(false);
          setNotice("");
        }
      }}
      className={styles.site}
      data-layout="catalogue"
      data-dressmaker-template
      style={
        {
          "--atelier-paper": doc.paper,
          "--atelier-ink": doc.ink,
          "--atelier-accent": doc.accent,
        } as CSSProperties
      }
    >
      <a className={styles.skip} href="#atelier-content">
        Skip to content
      </a>
      <header className={styles.header}>
        <nav aria-label="Atelier navigation" className={styles.desktopNav}>
          {nav(hrefFor("about"), "Atelier")}
          {nav(hrefFor("offerings"), "Collection")}
          {nav(hrefFor("contact"), "Contact")}
        </nav>
        <a href={hrefFor("home")} className={styles.brand}>
          {doc.logoUrl ? (
            <img src={doc.logoUrl} alt={doc.brandName} />
          ) : (
            doc.brandName
          )}
        </a>
        <div className={styles.headerActions}>
          <a
            href={`https://business.jktl.com.ng${templateLoginPath(template.id)}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Sign in to JKTL Business"
          >
            <LogIn size={17} />
          </a>
          <a
            className={styles.consultLink}
            href={hrefFor("contact")}
            onClick={consultation}
          >
            {doc.ctaLabel} <ArrowUpRight size={14} />
          </a>
          <button
            className={styles.menuButton}
            type="button"
            aria-label={menu ? "Close menu" : "Open menu"}
            aria-expanded={menu}
            aria-controls="atelier-menu"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {menu && (
          <nav
            id="atelier-menu"
            aria-label="Mobile atelier navigation"
            className={styles.mobileNav}
          >
            {nav(hrefFor("about"), "Atelier")}
            {nav(hrefFor("offerings"), "Collection")}
            {nav(hrefFor("contact"), "Contact")}
          </nav>
        )}
      </header>
      <main id="atelier-content">
        {path && (
          <section className={styles.pageIntro}>
            <span className={styles.eyebrow}>{doc.brandName}</span>
            <h1>{meta.heading}</h1>
            <p>{meta.description}</p>
          </section>
        )}
        {look && (
          <section className={styles.detail}>
            {image(look.image || doc.heroImage, look.title)}
            <div>
              <span className={styles.eyebrow}>Made for your moment</span>
              <p>{look.description}</p>
              {look.price && <p>{look.price}</p>}
              <a
                className={styles.textLink}
                href={route("contact")}
                onClick={consultation}
              >
                Discuss this look <ArrowUpRight size={16} />
              </a>
            </div>
          </section>
        )}

        {!path && (
          <section id="home" className={styles.hero}>
            {image(
              doc.heroImage,
              `${doc.brandName} bridal atelier — sample fashion photography`,
              true,
            )}
            <div className={styles.heroShade} />
            <div className={styles.heroCopy}>
              <div>
                <span className={styles.eyebrow}>{doc.eyebrow}</span>
                <h1>{doc.headline}</h1>
              </div>
              <p>{doc.intro}</p>
            </div>
          </section>
        )}
        {(!path || path === "atelier") && (
          <section id="about" className={styles.about}>
            <span className={styles.eyebrow}>The atelier</span>
            <h2>{doc.aboutTitle}</h2>
            <p>{doc.aboutText}</p>
            <a
              href={hrefFor("contact")}
              className={styles.textLink}
              onClick={consultation}
            >
              Let’s create something personal <ArrowUpRight size={16} />
            </a>
          </section>
        )}
        {(!path || path === "collection") && (
          <section id="offerings" className={styles.collection}>
            <div className={styles.sectionHeading}>
              <h2>{doc.offeringsTitle}</h2>
              <span>Made for your moment</span>
            </div>
            <div className={styles.collectionGrid}>
              {(path === "" ? doc.offerings.slice(0, 2) : doc.offerings).map(
                (item, i) => (
                  <motion.article
                    key={i}
                    initial={false}
                    whileHover={reduced ? undefined : { y: -4 }}
                    transition={{ duration: 0.25 }}
                    className={styles.look}
                  >
                    <a
                      aria-label={`View ${item.title}`}
                      href={route("collection/" + beautyServiceSlug(item, i))}
                    >
                      <div className={styles.lookPhoto}>
                        {image(
                          item.image ||
                            doc.gallery[i % doc.gallery.length]?.src ||
                            doc.heroImage,
                          item.title,
                        )}
                        <span>
                          Explore the look <ArrowUpRight size={16} />
                        </span>
                      </div>
                      <div className={styles.lookCaption}>
                        <h3>{item.title}</h3>
                        <span>{String(i + 1).padStart(2, "0")}</span>
                      </div>
                    </a>
                  </motion.article>
                ),
              )}
            </div>
          </section>
        )}
        {path === "our-process" && (
          <section id="approach" className={styles.journey}>
            <span className={styles.eyebrow}>Thoughtfully, together</span>
            <h2>{doc.featureTitle}</h2>
            <p>{doc.featureText}</p>
            <ol>
              {doc.featureItems.map((step, i) => {
                const split = step.indexOf(" — ");
                return (
                  <li key={i}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <h3>{split < 0 ? step : step.slice(0, split)}</h3>
                    {split >= 0 && <p>{step.slice(split + 3)}</p>}
                  </li>
                );
              })}
            </ol>
          </section>
        )}
        {path === "gallery" && (
          <section id="gallery" className={styles.gallery}>
            <div className={styles.sectionHeading}>
              <h2>{doc.galleryTitle}</h2>
              <a href={hrefFor("contact")} onClick={consultation}>
                Find your own expression <ArrowUpRight size={15} />
              </a>
            </div>
            <div className={styles.mosaic}>
              {doc.gallery.map((photo, i) => (
                <figure key={i}>
                  {image(photo.src, photo.alt)}
                  <figcaption>{photo.category || photo.alt}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}
        {reviews.length > 0 && path === "gallery" && (
          <section id="reviews" className={styles.reviews}>
            <span className={styles.eyebrow}>Kind words</span>
            <h2>Stories from the fitting room</h2>
            {reviews.map((r, i) => (
              <figure key={i}>
                <blockquote>“{r.quote}”</blockquote>
                <figcaption>{r.name}</figcaption>
              </figure>
            ))}
          </section>
        )}
        {path === "faqs" && (
          <section id="questions" className={styles.questions}>
            <h2>{doc.faqTitle}</h2>
            {doc.faqs.map((faq, i) => (
              <details key={i}>
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </section>
        )}
        {Boolean(doc.serviceAreas?.length) && path === "contact" && (
          <section id="service-areas" className={styles.areas}>
            <h2>Visit our atelier</h2>
            <p>{doc.serviceAreas?.join(" · ")}</p>
          </section>
        )}
        {path === "contact" && (
          <section id="contact" className={styles.contact}>
            <span className={styles.eyebrow}>Something entirely yours</span>
            <h2>{doc.contactTitle}</h2>
            <p>{doc.contactText}</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onInteraction?.("contact");
                const data = new FormData(e.currentTarget);
                if (preview) {
                  setNotice(
                    "This is a template preview. Select this template to add your atelier’s contact details.",
                  );
                  return;
                }
                if (!email) {
                  setNotice(
                    "The atelier has not added an email address yet. Please use the contact details below.",
                  );
                  return;
                }
                const subject = encodeURIComponent(
                  `Atelier consultation — ${String(data.get("name"))}`,
                );
                const body = encodeURIComponent(
                  `Name: ${data.get("name")}\nEmail: ${data.get("email")}\n\n${data.get("message")}`,
                );
                window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
                setNotice(
                  "Your email app will open with your enquiry. Send it there to contact the atelier.",
                );
              }}
            >
              <div className={styles.formRow}>
                <label>
                  Your name
                  <input
                    name="name"
                    autoComplete="name"
                    required
                    maxLength={120}
                  />
                </label>
                <label>
                  Email address
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                  />
                </label>
              </div>
              <label>
                Tell us about your occasion
                <textarea name="message" rows={3} required maxLength={2000} />
              </label>
              <button type="submit">
                {doc.ctaLabel} <ArrowUpRight size={16} />
              </button>
              <small>
                {preview
                  ? "Explore the design. No enquiry is sent from this preview."
                  : "Opens your email app so you can send your enquiry directly."}
              </small>
            </form>
            {notice && <p role="status">{notice}</p>}
          </section>
        )}
        {!path && (
          <p className={styles.explore}>
            <a href={route("collection")} className={styles.textLink}>
              Explore the full collection <ArrowUpRight size={16} />
            </a>
          </p>
        )}
        {path === "contact" && businessSection}
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <div>
            {email && <a href={`mailto:${email}`}>{email}</a>}
            {phone && <a href={`tel:${phone}`}>{contact.phone}</a>}
            {!email && !phone && (
              <span>
                {preview
                  ? "Your atelier’s contact details go here."
                  : "Contact details coming soon."}
              </span>
            )}
          </div>
          <p>{location || doc.serviceAreas?.join(" · ")}</p>
          <div className={styles.socials}>
            {social.map((s) => (
              <a
                key={s.platform}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {s.platform.toLowerCase() === "instagram" && (
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="18" cy="6" r="1" />
                  </svg>
                )}
                <span>{s.platform}</span>
              </a>
            ))}
          </div>
        </div>
        <a href={hrefFor("home")} className={styles.footerBrand}>
          {doc.brandName}
        </a>
        <nav aria-label="Footer navigation">
          <a href={route("our-process")}>Our process</a>
          <a href={route("gallery")}>Gallery</a>
          <a href={route("faqs")}>FAQs</a>
          {nav(hrefFor("about"), "Atelier")}
          {nav(hrefFor("offerings"), "Collection")}
          {nav(hrefFor("contact"), "Contact")}
        </nav>
        <div className={styles.footerBottom}>
          <span>
            © {new Date().getFullYear()} {doc.brandName}
          </span>
          {doc.demoContent && <span>Sample design & stock photography</span>}
          {!hideBranding && (
            <a
              href="https://jktl.com.ng"
              target="_blank"
              rel="noopener noreferrer"
            >
              Built with JKTL <ArrowUpRight size={16} className="inline-block align-middle" aria-hidden="true" />
            </a>
          )}
        </div>
      </footer>
    </div>
  );
}
