"use client";
import {
  useState,
  useRef,
  useEffect,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { WebsiteTemplate, WebsiteDocument } from "@/lib/website-templates";
import styles from "./TemplateWebsite.module.css";
export type TemplateContact = {
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  logoUrl?: string | null;
};
export function TemplateWebsite({
  template,
  document: doc,
  contact = {},
  preview = false,
  accent,
  businessSection,
  bookingAvailable = false,
}: {
  template: WebsiteTemplate;
  document: WebsiteDocument;
  contact?: TemplateContact;
  preview?: boolean;
  accent?: string;
  businessSection?: ReactNode;
  bookingAvailable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // A failed image can finish before React attaches its onError handler.
    root.current?.querySelectorAll("img").forEach((image) => {
      if (image.complete && !image.naturalWidth && !image.dataset.fallback) {
        image.dataset.fallback = "true";
        image.src = `/template-art/${template.id}.svg`;
      }
    });
  }, [template.id, doc.heroImage]);
  const colour = /^#[0-9a-f]{6}$/i.test(accent || "") ? accent! : doc.accent;
  const channel = (text: string) => text.trim();
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email || "")
    ? contact.email
    : "";
  const phone = (contact.phone || "").replace(/[^+\d]/g, "");
  const location = [contact.address, contact.city, contact.state]
    .filter(Boolean)
    .join(", ");
  const number = parseInt(colour.slice(1), 16);
  const brightness =
    (((number >> 16) & 255) * 299 +
      ((number >> 8) & 255) * 587 +
      (number & 255) * 114) /
    1000;
  const css = {
    "--template-accent": colour,
    "--template-paper": doc.paper,
    "--template-ink": doc.ink,
    "--template-button-ink": brightness > 155 ? "#14211b" : "#ffffff",
  } as CSSProperties;
  const img = (src: string, alt: string, className?: string) => (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={(e) => {
        if (!e.currentTarget.dataset.fallback) {
          e.currentTarget.dataset.fallback = "true";
          e.currentTarget.src = `/template-art/${template.id}.svg`;
        }
      }}
    />
  );
  const sections: Record<string, React.ReactNode> = {
    about: (
      <section id="about" className={styles.about}>
        <p className={styles.label}>Our story</p>
        <h2>{doc.aboutTitle}</h2>
        <p>{doc.aboutText}</p>
      </section>
    ),
    offerings: (
      <section id="offerings" className={styles.offerings}>
        <div className={styles.sectionHeading}>
          <p className={styles.label}>Discover</p>
          <h2>{doc.offeringsTitle}</h2>
        </div>
        <div className={styles.cards}>
          {doc.offerings.map((item, i) => (
            <article key={i}>
              <span className={styles.number}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <a href="#contact">
                Find out more <span aria-hidden="true">↗</span>
              </a>
            </article>
          ))}
        </div>
      </section>
    ),
    gallery: (
      <section id="gallery" className={styles.gallery}>
        <div className={styles.sectionHeading}>
          <p className={styles.label}>In focus</p>
          <h2>{doc.galleryTitle}</h2>
        </div>
        <div className={styles.galleryGrid}>
          {doc.gallery.map((item, i) => (
            <figure key={i}>
              {img(item.src, item.alt)}
              <figcaption>{item.alt}</figcaption>
            </figure>
          ))}
        </div>
      </section>
    ),
    feature: (
      <section id="approach" className={styles.feature}>
        <div>
          <p className={styles.label}>Our approach</p>
          <h2>{doc.featureTitle}</h2>
          <p>{doc.featureText}</p>
          <a href="#contact" className={styles.outline}>
            Start a conversation ↗
          </a>
        </div>
        <ol>
          {doc.featureItems.map((item, i) => (
            <li key={i}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              {item}
            </li>
          ))}
        </ol>
      </section>
    ),
    faq: (
      <section id="questions" className={styles.faq}>
        <div>
          <p className={styles.label}>Questions</p>
          <h2>{doc.faqTitle}</h2>
        </div>
        <div>
          {doc.faqs.map((faq, i) => (
            <details key={i}>
              <summary>
                {faq.question}
                <span aria-hidden="true">+</span>
              </summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>
    ),
  };
  return (
    <div
      ref={root}
      className={styles.site}
      data-layout={template.layout}
      style={css}
    >
      <header className={styles.header}>
        <a href="#home" className={styles.brand}>
          {contact.logoUrl && img(contact.logoUrl, "", styles.logo)}
          {doc.brandName}
        </a>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          aria-controls={`template-nav-${template.id}`}
          onClick={() => setOpen(!open)}
        >
          {open ? "Close" : "Menu"}{" "}
          <span aria-hidden="true">{open ? "×" : "☰"}</span>
        </button>
        <nav
          id={`template-nav-${template.id}`}
          aria-label={`${doc.brandName} website`}
          className={open ? styles.expanded : ""}
          onClick={() => setOpen(false)}
        >
          <a href="#about">About</a>
          <a href="#offerings">Explore</a>
          <a href="#gallery">Gallery</a>
          <a href="#questions">Questions</a>
          {bookingAvailable && <a href="#book">Book an appointment</a>}
          <a href="#contact" className={styles.navContact}>
            Get in touch ↗
          </a>
        </nav>
      </header>
      <section id="home" className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.label}>{doc.eyebrow}</p>
          <h1>{doc.headline}</h1>
          <p className={styles.intro}>{doc.intro}</p>
          <div className={styles.heroActions}>
            <a href="#offerings" className={styles.primary}>
              {doc.ctaLabel} ↗
            </a>
            <a href="#about" className={styles.textLink}>
              Our story <span aria-hidden="true">↓</span>
            </a>
          </div>
        </div>
        <div className={styles.heroImage}>
          {img(doc.heroImage, `${template.name} inspiration`)}
          <span className={styles.imageCaption}>
            {doc.brandName}
            <span>EST. YOUR NEXT CHAPTER</span>
          </span>
        </div>
      </section>
      <div className={styles.ticker}>
        <span>{doc.brandName}</span>
        <span aria-hidden="true">✦</span>
        <span>{doc.eyebrow}</span>
        <span aria-hidden="true">✦</span>
        <a href="#contact">Let’s connect ↗</a>
      </div>
      {template.sectionOrder.map((key) => (
        <div key={key}>{sections[key]}</div>
      ))}
      {businessSection}
      <section id="contact" className={styles.contact}>
        <p className={styles.label}>Get in touch</p>
        <h2>{doc.contactTitle}</h2>
        <p>{doc.contactText}</p>
        <div className={styles.contactLinks}>
          {email && (
            <a className={styles.primary} href={`mailto:${channel(email)}`}>
              Email us ↗
            </a>
          )}
          {phone && (
            <a className={styles.outline} href={`tel:${phone}`}>
              Call {contact.phone}
            </a>
          )}
          {!email && !phone && (
            <p>
              {preview
                ? "Demonstration website. Add your contact details in the editor before publishing."
                : "Contact details will be available here soon."}
            </p>
          )}
        </div>
        {location && <p className={styles.location}>{location}</p>}
      </section>
      <footer className={styles.footer}>
        <strong>{doc.brandName}</strong>
        <p>
          © {new Date().getFullYear()} {doc.brandName}
        </p>
        <a href="https://jktl.com.ng" target="_blank" rel="noopener noreferrer">
          Built with JKTL ↗
        </a>
      </footer>
    </div>
  );
}
