"use client";
import { useState, type CSSProperties, type ReactNode } from "react";
import {
  beautyServiceSlug,
  templateLoginPath,
  type WebsiteDocument,
  type WebsiteTemplate,
} from "@/lib/website-templates";
import type { TemplateContact } from "./TemplateWebsite";
import type { BeautyRequest } from "./BeautyWebsite";
import styles from "./LegalWebsite.module.css";

type Props = {
  template: WebsiteTemplate;
  document: WebsiteDocument;
  contact?: TemplateContact;
  preview?: boolean;
  pagePath?: string;
  basePath?: string;
  onNavigate?: (path: string) => void;
  onRequest?: (
    input: BeautyRequest,
  ) => Promise<{ ok: boolean; error?: string }>;
  hideBranding?: boolean;
  onInteraction?: (kind: "cta" | "contact") => void;
  businessSection?: ReactNode;
  reviews?: { name: string; quote: string; rating?: number | null }[];
};
export function LegalWebsite({
  template,
  document: doc,
  contact = {},
  preview = false,
  pagePath = "",
  basePath = "",
  onNavigate,
  onRequest,
  hideBranding = false,
  onInteraction,
  businessSection,
  reviews: existingReviews = [],
}: Props) {
  const [menu, setMenu] = useState(false);
  const path = pagePath.split("?")[0];
  const reviews = doc.reviews?.length ? doc.reviews : existingReviews;
  const practice = doc.offerings.find(
    (o, i) => path === `practice-areas/${beautyServiceSlug(o, i)}`,
  );
  const article = doc.faqs.find(
    (f, i) =>
      path ===
      `insights/${beautyServiceSlug({ title: f.question, description: "" }, i)}`,
  );
  const url = (to: string) =>
    `${basePath.replace(/\/$/, "")}${to ? "/" + to : ""}` || "/";
  const link = (to: string, label: ReactNode, className?: string) => (
    <a
      href={url(to)}
      className={className}
      aria-current={path === to ? "page" : undefined}
      onClick={(e) => {
        if (to === "contact") onInteraction?.("cta");
        if (
          onNavigate &&
          !e.ctrlKey &&
          !e.metaKey &&
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
  const photo = (src: string, alt: string, eager = false) => (
    <img
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      width={1200}
      height={900}
      onError={(e) => {
        if (!e.currentTarget.dataset.fallback) {
          e.currentTarget.dataset.fallback = "true";
          e.currentTarget.src = `/template-art/${template.id}.svg`;
        }
      }}
    />
  );
  const cta = () =>
    link(
      "contact",
      <>
        {doc.ctaLabel}
        <span aria-hidden="true">↗</span>
      </>,
      styles.button,
    );
  const practices = () => (
    <div className={styles.practiceGrid}>
      {doc.offerings.map((o, i) => (
        <article key={i}>
          <span className={styles.kicker}>0{i + 1}</span>
          {doc.legalVariant === "family" && o.image && photo(o.image, o.title)}
          <h3>{o.title}</h3>
          <p>{o.description}</p>
          {link(
            `practice-areas/${beautyServiceSlug(o, i)}`,
            <>
              Explore this practice <span aria-hidden="true">→</span>
            </>,
          )}
        </article>
      ))}
    </div>
  );
  const attorneys = () => (
    <div className={styles.attorneys}>
      {doc.gallery.map((person, i) => (
        <article key={i}>
          {photo(person.src, person.alt)}
          <h3>{person.alt}</h3>
          <p>{person.category}</p>
        </article>
      ))}
    </div>
  );
  const insights = () => (
    <div className={styles.insightGrid}>
      {doc.faqs.map((f, i) => (
        <article key={i}>
          <p className={styles.kicker}>FIRM PERSPECTIVES</p>
          <h3>
            {link(
              `insights/${beautyServiceSlug({ title: f.question, description: "" }, i)}`,
              f.question,
            )}
          </h3>
          <p>{f.answer.split("\n\n")[0]}</p>
          {link(
            `insights/${beautyServiceSlug({ title: f.question, description: "" }, i)}`,
            "Read perspective →",
            styles.textLink,
          )}
        </article>
      ))}
    </div>
  );
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email || "")
    ? contact.email
    : "";
  const phone = (contact.phone || "").replace(/[^+\d]/g, "");
  const address = [contact.address, contact.city, contact.state]
    .filter(Boolean)
    .join(", ");
  const initials = doc.brandName
    .split(/\s+/)
    .filter((w) => w !== "&")
    .map((w) => w[0])
    .slice(0, 2)
    .join("&");
  const title = (label: string, description?: string) => (
    <header className={styles.pageHeading}>
      <p className={styles.kicker}>{doc.brandName}</p>
      <h1>{label}</h1>
      {description && <p>{description}</p>}
    </header>
  );
  return (
    <div
      className={styles.site}
      data-legal-variant={doc.legalVariant}
      data-legal-template
      style={
        {
          "--legal-paper": doc.paper,
          "--legal-ink": doc.ink,
          "--legal-accent": doc.accent,
        } as CSSProperties
      }
    >
      <a href="#legal-content" className={styles.skip}>
        Skip to content
      </a>
      <header className={styles.header}>
        {link(
          "",
          <>
            {doc.logoUrl ? (
              photo(doc.logoUrl, `${doc.brandName} logo`)
            ) : (
              <strong>{initials}</strong>
            )}
            <small>{doc.brandName}</small>
          </>,
          styles.brand,
        )}
        <nav
          className={menu ? styles.navOpen : styles.nav}
          id="legal-nav"
          aria-label="Firm navigation"
        >
          {[
            ["", "Home"],
            ["practice-areas", "Practice areas"],
            ["about", "About"],
            ["attorneys", "Attorneys"],
            ["insights", "Insights"],
          ].map(([to, label]) => (
            <span key={to}>{link(to, label)}</span>
          ))}
          {link("contact", "Contact →", styles.navContact)}
        </nav>
        <div className={styles.headerActions}>
          <a
            className={styles.signIn}
            href={`https://business.jktl.com.ng${preview ? templateLoginPath(template.id) : "/login"}`}
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
            type="button"
            aria-controls="legal-nav"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? "Close −" : "Menu +"}
          </button>
        </div>
      </header>
      <main id="legal-content" tabIndex={-1}>
        {path === "" && (
          <>
            <section className={styles.hero} id="home">
              {photo(
                doc.heroImage,
                doc.legalVariant === "family"
                  ? "Three professionals in corporate attire discussing a matter in an office"
                  : "A considered workspace for professional conversations",
                true,
              )}
              <h1>{doc.headline}</h1>
              <div className={styles.heroBottom}>
                <p className={styles.kicker}>{doc.eyebrow}</p>
                <p>{doc.intro}</p>
                {cta()}
              </div>
            </section>
            <section className={styles.about} id="about">
              <p className={styles.kicker}>INTRODUCING THE FIRM</p>
              <h2>{doc.aboutTitle}</h2>
              <div>
                <div>
                  <p>{doc.aboutText.split("\n\n")[0]}</p>
                  {link("about", "Discover our approach →", styles.textLink)}
                </div>
                {photo(
                  doc.aboutImage || doc.heroImage,
                  "A collaborative professional team",
                )}
              </div>
            </section>
            <section className={styles.section} id="practice-areas">
              <h2>{doc.offeringsTitle}</h2>
              {practices()}
            </section>
            <section
              className={`${styles.section} ${styles.teamSection}`}
              id="attorneys"
            >
              <h2>{doc.galleryTitle}</h2>
              {doc.demoContent && (
                <p className={styles.demo}>
                  Editable sample profiles · replace names, roles and
                  photographs before publishing.
                </p>
              )}
              {attorneys()}
            </section>
            <section className={styles.statement}>
              <p className={styles.kicker}>{doc.featureTitle}</p>
              <blockquote>{doc.featureText}</blockquote>
              <p>{doc.featureItems.join(" · ")}</p>
            </section>
            <section className={styles.news} id="insights">
              <h2>{doc.faqTitle}</h2>
              <div className={styles.newsBackdrop}>
                {photo(
                  doc.heroImage,
                  doc.legalVariant === "family"
                    ? "Professionals in suits in conversation"
                    : "Light and space in a professional office",
                )}
                {insights()}
              </div>
            </section>
          </>
        )}
        {path === "about" && (
          <>
            {title(doc.aboutTitle)}
            <section className={styles.aboutPage}>
              {photo(
                doc.aboutImage || doc.heroImage,
                "A collaborative professional team",
              )}
              <div>
                {doc.aboutText.split("\n\n").map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
                <h2>{doc.featureTitle}</h2>
                <ul>
                  {doc.featureItems.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
                {cta()}
              </div>
            </section>
          </>
        )}
        {path === "practice-areas" && (
          <>
            {title(doc.offeringsTitle, doc.intro)}
            <section className={styles.section}>{practices()}</section>
          </>
        )}
        {practice && (
          <>
            {title(practice.title, practice.description)}
            <section className={styles.reading}>
              <h2>A considered next step.</h2>
              <ul>
                {practice.benefits?.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
              <p>{practice.preparation}</p>
              <p>
                Scope, availability and fees are discussed before an engagement
                is agreed. This page is general information, not legal advice.
              </p>
              {cta()}
            </section>
          </>
        )}
        {path === "attorneys" && (
          <>
            {title(doc.galleryTitle)}
            <section className={styles.section}>
              {doc.demoContent && (
                <p className={styles.demo}>
                  Editable sample profiles · replace with your firm’s verified
                  team information.
                </p>
              )}
              {attorneys()}
            </section>
          </>
        )}
        {path === "insights" && (
          <>
            {title(doc.faqTitle)}
            <section className={styles.section}>{insights()}</section>
          </>
        )}
        {article && (
          <article className={styles.reading}>
            {title(article.question)}
            {article.answer.split("\n\n").map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {link("insights", "← All perspectives", styles.textLink)}
          </article>
        )}
        {path === "contact" && (
          <>
            {title(doc.contactTitle, doc.contactText)}
            <section className={styles.contactLayout}>
              <aside>
                <h2>Start with a conversation.</h2>
                {email && (
                  <p>
                    <a href={`mailto:${email}`}>{email}</a>
                  </p>
                )}
                {phone && (
                  <p>
                    <a href={`tel:${phone}`}>{contact.phone}</a>
                  </p>
                )}
                {address && <p>{address}</p>}
                {!email && !phone && !address && (
                  <p>
                    {preview
                      ? "Add your firm’s verified contact details in Business before publishing."
                      : "Use the form to make a general enquiry."}
                  </p>
                )}
                <p>
                  For urgent or time-sensitive matters, contact a qualified
                  lawyer directly. Do not rely on this form for deadlines.
                </p>
              </aside>
              <LegalEnquiry document={doc} onRequest={onRequest} />
            </section>
            {businessSection}
          </>
        )}
        {reviews.length > 0 && (
          <section className={styles.section}>
            <h2>Client feedback</h2>
            <div className={styles.reviewGrid}>
              {reviews.map((review, i) => (
                <blockquote key={i}>
                  <p>“{review.quote}”</p>
                  <cite>{review.name}</cite>
                </blockquote>
              ))}
            </div>
          </section>
        )}
        {doc.serviceAreas?.length ? (
          <section className={styles.areas}>
            <h2>Service areas</h2>
            <p>{doc.serviceAreas.join(" · ")}</p>
          </section>
        ) : null}
        {path !== "contact" && (
          <section className={styles.contactStrip}>
            <h2>{doc.contactTitle}</h2>
            {cta()}
          </section>
        )}
      </main>
      <footer className={styles.footer}>
        <div>
          <div>
            {email && (
              <p>
                <a href={`mailto:${email}`}>{email}</a>
              </p>
            )}
            {phone && (
              <p>
                <a href={`tel:${phone}`}>{contact.phone}</a>
              </p>
            )}
            {address && <p>{address}</p>}
          </div>
          <div>
            {link("practice-areas", "Practice areas")}
            {link("about", "About the firm")}
            {link("insights", "Perspectives")}
            {link("contact", "Contact")}
          </div>
          <div>
            {doc.socials?.map((s) => (
              <a
                key={s.platform}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {s.platform}
              </a>
            ))}
          </div>
        </div>
        <strong className={styles.footerMark}>{initials}</strong>
        <p>{doc.brandName}</p>
        <p className={styles.finePrint}>
          General information only. No lawyer-client relationship is created by
          visiting this site or sending an enquiry.
        </p>
        {doc.demoContent && (
          <p className={styles.finePrint}>
            Demonstration firm · sample attorney profiles and stock photography.
          </p>
        )}
        <div className={styles.footerBottom}>
          <span>
            © {new Date().getFullYear()} {doc.brandName}
          </span>
          {!hideBranding && (
            <a
              href="https://jktl.com.ng"
              target="_blank"
              rel="noopener noreferrer"
            >
              Made with JKTL ↗
            </a>
          )}
        </div>
      </footer>
    </div>
  );
}
function LegalEnquiry({
  document: doc,
  onRequest,
}: {
  document: WebsiteDocument;
  onRequest?: Props["onRequest"];
}) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  if (done)
    return (
      <div role="status">
        <h2>Your enquiry has been received.</h2>
        <p>
          The firm will respond to discuss the appropriate next step. No
          appointment or engagement has been confirmed.
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
          setError("This is a template preview. No enquiry was sent.");
          return;
        }
        const f = new FormData(e.currentTarget);
        setPending(true);
        try {
          const r = await onRequest({
            kind: "contact",
            name: String(f.get("name") || ""),
            email: String(f.get("email") || ""),
            phone: String(f.get("phone") || ""),
            service: "",
            date: "",
            time: "",
            message: `Practice area: ${String(f.get("area") || "General enquiry")}\n${String(f.get("message") || "")}`,
            website: String(f.get("website") || ""),
          });
          if (r.ok) setDone(true);
          else
            setError(
              r.error || "We could not save your enquiry. Please try again.",
            );
        } catch {
          setError("We could not save your enquiry. Please try again.");
        } finally {
          setPending(false);
        }
      }}
    >
      {!onRequest && (
        <p className={styles.finePrint}>
          Preview form · no enquiry will be submitted.
        </p>
      )}
      <label>
        Your name
        <input name="name" required maxLength={120} autoComplete="name" />
      </label>
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
          name="phone"
          type="tel"
          required
          maxLength={40}
          autoComplete="tel"
        />
      </label>
      <label>
        Practice area
        <select name="area">
          <option value="">General enquiry</option>
          {doc.offerings.map((o, i) => (
            <option key={i} value={o.title}>
              {o.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Brief enquiry
        <textarea name="message" rows={5} required maxLength={1800} />
      </label>
      <label className={styles.honeypot} aria-hidden="true">
        Leave this blank
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <p className={styles.finePrint}>
        Please do not send confidential documents or sensitive case details.
        Sending an enquiry does not create a lawyer-client relationship or
        subscribe you to marketing.
      </p>
      {error && <p role="alert">{error}</p>}
      <button className={styles.button} type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send general enquiry →"}
      </button>
    </form>
  );
}
