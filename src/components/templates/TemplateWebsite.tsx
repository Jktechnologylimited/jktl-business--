"use client";
import {
  useState,
  useRef,
  useEffect,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  templateLoginPath,
  type WebsiteTemplate,
  type WebsiteDocument,
} from "@/lib/website-templates";
import styles from "./TemplateWebsite.module.css";
import { BeautyWebsite, type BeautyRequest } from "./BeautyWebsite";
export type TemplateContact = {
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  logoUrl?: string | null;
  instagramUrl?: string;
  facebookUrl?: string;
  tiktokUrl?: string;
};
function LegacyTemplateWebsite({
  template,
  document: doc,
  contact = {},
  preview = false,
  hideBranding = false,
  accent,
  businessSection,
  bookingAvailable = false,
  reviews: existingReviews = [],
  onInteraction,
}: {
  template: WebsiteTemplate;
  document: WebsiteDocument;
  contact?: TemplateContact;
  preview?: boolean;
  hideBranding?: boolean;
  accent?: string;
  businessSection?: ReactNode;
  bookingAvailable?: boolean;
  reviews?: { name: string; quote: string; rating?: number | null }[];
  onInteraction?: (kind: "cta" | "contact") => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // A failed image can finish before React attaches its onError handler.
    root.current?.querySelectorAll("img").forEach((image) => {
      if (image.complete && !image.naturalWidth && !image.dataset.fallback) {
        image.src = `/template-art/${template.sourceId || template.id}.svg`;
      }
    });
  }, [template.id, template.sourceId, doc.heroImage]);
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
        if (
          e.currentTarget.getAttribute("src") !==
          `/template-art/${template.sourceId || template.id}.svg`
        ) {
          e.currentTarget.src = `/template-art/${template.sourceId || template.id}.svg`;
        }
      }}
    />
  );
  const reviews = doc.reviews?.length ? doc.reviews : existingReviews;
  const visibleReviews = reviews.length
    ? reviews
    : preview
      ? [
          {
            name: "Example customer",
            quote:
              "Add a genuine customer review here before publishing. This sample is not published.",
            rating: 5,
          },
        ]
      : [];
  const socialLinks = doc.socials?.length
    ? doc.socials
    : [
        { platform: "instagram", url: contact.instagramUrl },
        { platform: "facebook", url: contact.facebookUrl },
        { platform: "tiktok", url: contact.tiktokUrl },
      ].filter((v): v is { platform: string; url: string } =>
        Boolean(v.url?.startsWith("https://")),
      );
  const sectionEnabled = (key: string) =>
    template.sectionOrder.includes(key) &&
    (!doc.blank ||
      (key === "about"
        ? Boolean(doc.aboutText)
        : key === "offerings"
          ? doc.offerings.length > 0
          : key === "gallery"
            ? doc.gallery.length > 0
            : key === "feature"
              ? doc.featureItems.length > 0
              : key === "faq"
                ? doc.faqs.length > 0
                : key === "areas"
                  ? Boolean(doc.serviceAreas?.length)
                  : key === "reviews"
                    ? Boolean(doc.reviews?.length)
                    : true));
  const sections: Record<string, React.ReactNode> = {
    areas: (
      <section id="service-areas" className={styles.areas}>
        <p className={styles.label}>Local to you</p>
        <h2>Service areas</h2>
        <p>
          {doc.serviceAreas?.length
            ? doc.serviceAreas.join(" · ")
            : preview
              ? "Add the towns, cities or regions you serve in the editor."
              : "Contact us to discuss service coverage."}
        </p>
      </section>
    ),
    reviews: (
      <section id="reviews" className={styles.reviews}>
        <div className={styles.sectionHeading}>
          <p className={styles.label}>Kind words</p>
          <h2>Reviews</h2>
          {!reviews.length && preview && (
            <p>Sample review · replace with genuine feedback in the editor</p>
          )}
        </div>
        <div className={styles.cards}>
          {visibleReviews.map((review, i) => (
            <blockquote key={i}>
              {review.rating && review.rating > 0 ? (
                <p aria-label={`${review.rating} out of 5 stars`}>
                  {"★".repeat(review.rating)}
                </p>
              ) : null}
              <p>{review.quote}</p>
              <cite>{review.name}</cite>
            </blockquote>
          ))}
        </div>
        {!visibleReviews.length && (
          <p>Genuine customer feedback will be added here.</p>
        )}
      </section>
    ),

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
      data-kind={template.kind || "website"}
      onClickCapture={(event) => {
        const link = (event.target as Element).closest("a");
        if (!link || !onInteraction) return;
        const href = link.getAttribute("href") || "";
        if (
          href.startsWith("mailto:") ||
          href.startsWith("tel:") ||
          href === "#contact"
        )
          onInteraction("contact");
        else if (link.classList.contains(styles.primary)) onInteraction("cta");
      }}
    >
      <header className={styles.header}>
        <a href="#home" className={styles.brand}>
          {doc.logoUrl || contact.logoUrl ? (
            img(doc.logoUrl || contact.logoUrl!, "", styles.logo)
          ) : (
            <span className={styles.monogram} aria-hidden="true">
              {doc.brandName
                .split(/\s+/)
                .map((w) => w[0])
                .slice(0, 2)
                .join("")}
            </span>
          )}
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
          <a href="#home">Home</a>
          {sectionEnabled("about") && <a href="#about">About</a>}
          {sectionEnabled("offerings") && <a href="#offerings">Services</a>}
          {sectionEnabled("gallery") && <a href="#gallery">Gallery</a>}
          {sectionEnabled("areas") && (
            <a href="#service-areas">Service areas</a>
          )}
          {sectionEnabled("reviews") && <a href="#reviews">Reviews</a>}
          {bookingAvailable && <a href="#book">Book an appointment</a>}
          <a href="#contact" className={styles.navContact}>
            Get in touch ↗
          </a>
          <a
            href={
              preview
                ? `https://business.jktl.com.ng${templateLoginPath(template.id)}`
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
        </nav>
      </header>
      <section id="home" className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.label}>{doc.eyebrow}</p>
          <h1>
            {doc.headline ||
              (preview ? "Your headline starts here" : doc.brandName)}
          </h1>
          <p className={styles.intro}>{doc.intro}</p>
          <div className={styles.heroActions}>
            <a
              href={sectionEnabled("offerings") ? "#offerings" : "#contact"}
              className={styles.primary}
            >
              {doc.ctaLabel} ↗
            </a>
            <a
              href={sectionEnabled("about") ? "#about" : "#contact"}
              className={styles.textLink}
            >
              {sectionEnabled("about") ? "Our story" : "Get in touch"}{" "}
              <span aria-hidden="true">↓</span>
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
      {template.sectionOrder.filter(sectionEnabled).map((key) => (
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
      <div className={styles.socials}>
        {socialLinks.map((social) => (
          <a
            key={social.platform}
            href={social.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={social.platform}
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
              {social.platform === "instagram" ? (
                <>
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="18" cy="6" r="1" />
                </>
              ) : social.platform === "youtube" ? (
                <>
                  <rect x="2" y="5" width="20" height="14" rx="4" />
                  <path d="m10 9 6 3-6 3z" />
                </>
              ) : social.platform === "facebook" ? (
                <path d="M14 22V12h4l1-4h-5V6c0-2 1-3 4-3V0h-4c-4 0-6 2-6 6v2H5v4h3v10" />
              ) : social.platform === "linkedin" ? (
                <>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M7 10v8m0-12v1m5 11v-8m0 4c0-5 6-5 6 0v4" />
                </>
              ) : social.platform === "x" ? (
                <path d="m4 3 16 18M20 3 4 21" />
              ) : (
                <path d="M14 3v12a4 4 0 1 1-4-4m4-8c0 4 3 6 7 6" />
              )}
            </svg>
          </a>
        ))}
      </div>
      <footer className={styles.footer}>
        <strong>{doc.brandName}</strong>
        <p>
          © {new Date().getFullYear()} {doc.brandName}
        </p>
        {!hideBranding && (
          <a
            href="https://jktl.com.ng"
            target="_blank"
            rel="noopener noreferrer"
          >
            Built with JKTL ↗
          </a>
        )}
      </footer>
    </div>
  );
}

export function TemplateWebsite(
  props: Parameters<typeof LegacyTemplateWebsite>[0] & {
    pagePath?: string;
    basePath?: string;
    initialService?: string;
    onNavigate?: (path: string) => void;
    onRequest?: (
      input: BeautyRequest,
    ) => Promise<{ ok: boolean; error?: string }>;
  },
) {
  if (props.document.beauty?.version === 2) return <BeautyWebsite {...props} />;
  return <LegacyTemplateWebsite {...props} />;
}
