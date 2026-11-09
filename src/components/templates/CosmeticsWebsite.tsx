/* eslint-disable @next/next/no-img-element -- Bundled catalogue photographs and owner-provided HTTPS images are served without runtime image optimization. */
"use client";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  LogIn,
  Menu,
  Search,
  X,
} from "lucide-react";
import {
  beautyServiceSlug,
  jewelleryCategories,
  templateLoginPath,
  websitePageHref,
  websitePageMeta,
  websitePagePaths,
  type WebsiteDocument,
  type WebsiteTemplate,
} from "@/lib/website-templates";
import { BeautyRequestForm, type BeautyRequest } from "./BeautyWebsite";
import type { TemplateContact } from "./TemplateWebsite";
import styles from "./CosmeticsWebsite.module.css";
const querySnapshot = () => window.location.search;
const serverQuery = () => "";
function subscribeQuery(fn: () => void) {
  window.addEventListener("popstate", fn);
  return () => window.removeEventListener("popstate", fn);
}

export function CosmeticsWebsite({
  template,
  document: doc,
  contact = {},
  preview = false,
  hideBranding = false,
  pagePath = "",
  basePath = "",
  onNavigate,
  onRequest,
  onInteraction,
  businessSection,
  reviews: verifiedReviews = [],
}: {
  template: WebsiteTemplate;
  document: WebsiteDocument;
  contact?: TemplateContact;
  preview?: boolean;
  hideBranding?: boolean;
  pagePath?: string;
  basePath?: string;
  onNavigate?: (path: string) => void;
  onRequest?: (
    input: BeautyRequest,
  ) => Promise<{ ok: boolean; error?: string }>;
  onInteraction?: (kind: "cta" | "contact") => void;
  businessSection?: ReactNode;
  reviews?: { name: string; quote: string; rating?: number | null }[];
}) {
  const [menu, setMenu] = useState(false),
    [search, setSearch] = useState("");
  const root = useRef<HTMLDivElement>(null),
    track = useRef<HTMLDivElement>(null),
    reduced = useReducedMotion();
  const path = pagePath.split(/[?#]/)[0],
    paths = websitePagePaths(template, doc),
    meta = websitePageMeta(template, doc, path),
    categories = jewelleryCategories(doc);
  const product = doc.offerings.find(
    (p, i) => path === "products/" + beautyServiceSlug(p, i),
  );
  const category = categories.find((c) => path === "shop/" + c.slug);
  const browserQuery = useSyncExternalStore(
    subscribeQuery,
    querySnapshot,
    serverQuery,
  );
  const requestedSlug = new URLSearchParams(
    pagePath.split("?")[1] || browserQuery,
  ).get("product");
  const requested = doc.offerings.find(
    (p, i) => beautyServiceSlug(p, i) === requestedSlug,
  );
  const shown = doc.offerings
    .map((p, i) => ({ p, i }))
    .filter(
      ({ p }) =>
        (!category ||
          (p.category || "The collection").toLowerCase() ===
            category.name.toLowerCase()) &&
        (!search.trim() ||
          (p.title + " " + p.description + " " + (p.category || ""))
            .toLowerCase()
            .includes(search.trim().toLowerCase())),
    );
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email || "")
    ? contact.email
    : "";
  const phone = (contact.phone || "").replace(/[^+\d]/g, ""),
    address = [contact.address, contact.city, contact.state]
      .filter(Boolean)
      .join(", ");
  const social = (
    doc.socials?.length
      ? doc.socials
      : [
          { platform: "instagram", url: contact.instagramUrl || "" },
          { platform: "facebook", url: contact.facebookUrl || "" },
        ]
  ).filter((s) => {
    try {
      const u = new URL(s.url);
      return u.protocol === "https:" && !u.username && !u.password;
    } catch {
      return false;
    }
  });
  const reviews = verifiedReviews.length
    ? verifiedReviews
    : doc.demoContent
      ? []
      : doc.reviews || [];
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
          e.currentTarget.src = "/template-art/velora-cosmetics.svg";
        }
      }}
    />
  );
  const link = (
    to: string,
    label: ReactNode,
    cls?: string,
    ariaLabel?: string,
  ) => (
    <a
      href={websitePageHref(basePath, to)}
      className={cls}
      aria-label={ariaLabel}
      aria-current={path === to ? "page" : undefined}
      onClick={(e) => {
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
  const enquiryPath = (p: WebsiteDocument["offerings"][number], i: number) =>
    "contact?product=" + encodeURIComponent(beautyServiceSlug(p, i));
  const cards = (carousel = false) => (
    <div
      ref={carousel ? track : undefined}
      className={carousel ? styles.productTrack : styles.productGrid}
      aria-label={carousel ? "Featured beauty products" : undefined}
    >
      {shown.map(({ p, i }) => (
        <motion.article
          key={beautyServiceSlug(p, i)}
          initial={false}
          whileHover={reduced ? undefined : { y: -4 }}
        >
          {link(
            "products/" + beautyServiceSlug(p, i),
            <>
              <div className={styles.productPhoto}>
                {image(p.image || doc.heroImage, p.title)}
                <span>
                  Discover <ArrowUpRight size={15} />
                </span>
              </div>
              <p className={styles.category}>
                {p.category || "The collection"}
              </p>
              <h3>{p.title}</h3>
              <p className={styles.price}>{p.price || "Enquire for price"}</p>
            </>,
            undefined,
            `Explore ${p.title}`,
          )}
        </motion.article>
      ))}
    </div>
  );
  const collections = (
    <section className={styles.collections}>
      <div className={styles.sectionIntro}>
        <div>
          <p className={styles.eyebrow}>An edit, made personal</p>
          <h2>{doc.galleryTitle}</h2>
        </div>
        {link("shop", "Explore all products", styles.textLink)}
      </div>
      <div className={styles.collectionGrid}>
        {categories.map((c, i) => {
          const photo =
            doc.gallery.find(
              (g) => g.category?.toLowerCase() === c.name.toLowerCase(),
            ) || doc.gallery[i % Math.max(1, doc.gallery.length)];
          return (
            <motion.article
              key={c.slug}
              initial={false}
              whileHover={reduced ? undefined : { y: -4 }}
            >
              {link(
                "shop/" + c.slug,
                <>
                  {image(photo?.src || doc.heroImage, photo?.alt || c.name)}
                  <div>
                    <h3>{c.name}</h3>
                    <ArrowUpRight size={19} />
                  </div>
                </>,
                undefined,
                `Explore ${c.name} collection`,
              )}
            </motion.article>
          );
        })}
      </div>
    </section>
  );
  const values = (
    <section className={styles.values}>
      <div>
        <p className={styles.eyebrow}>The details behind your edit</p>
        <h2>{doc.featureTitle}</h2>
        <p>{doc.featureText}</p>
        <div className={styles.valuePoints}>
          {doc.featureItems.map((v, i) => (
            <article key={i}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <p>{v}</p>
            </article>
          ))}
        </div>
        {button("editorial", "Explore our perspective")}
      </div>
      <div className={styles.valuePhotos}>
        {image(
          doc.aboutImage || doc.heroImage,
          "A personal beauty perspective",
        )}
        {image(
          doc.offerings[2]?.image || doc.heroImage,
          "Colour and finish inspiration",
        )}
      </div>
    </section>
  );
  const reviewSection = (
    <section className={styles.reviews}>
      <div className={styles.sectionIntro}>
        <div>
          <p className={styles.eyebrow}>A personal conversation</p>
          <h2>Your words, your experience.</h2>
        </div>
      </div>
      <div className={styles.reviewGrid}>
        {reviews.length ? (
          reviews.slice(0, 6).map((r, i) => (
            <figure key={i}>
              <blockquote>{r.quote}</blockquote>
              <figcaption>{r.name}</figcaption>
            </figure>
          ))
        ) : (
          <div className={styles.reviewEmpty}>
            <p>
              {doc.demoContent
                ? "Make room for genuine customer stories. Add your own feedback when you make this website yours."
                : "We look forward to sharing our customers’ stories here."}
            </p>
            {button("contact", "Talk to the boutique")}
          </div>
        )}
      </div>
    </section>
  );
  const care = (
    <section className={styles.care}>
      <div>
        <p className={styles.eyebrow}>Before you choose</p>
        <h2>{doc.faqTitle}</h2>
      </div>
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
  return (
    <div
      ref={root}
      className={styles.site}
      data-template-id={template.sourceId || template.id}
      data-layout="catalogue"
      data-cosmetics-template
      style={
        {
          "--cosmetic-paper": doc.paper,
          "--cosmetic-ink": doc.ink,
          "--cosmetic-accent": doc.accent,
        } as CSSProperties
      }
    >
      <a className={styles.skip} href="#cosmetic-content">
        Skip to content
      </a>
      <div className={styles.ribbon}>
        <div>
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} aria-hidden={i > 0 ? true : undefined}>
              {doc.eyebrow}
              <span aria-hidden="true">✦</span>
            </span>
          ))}
        </div>
      </div>
      <header className={styles.header}>
        <nav
          className={styles.desktopNav}
          aria-label="Beauty boutique navigation"
        >
          {link("", "Home")}
          {link("about", "About")}
          {link("shop", "Shop")}
          {link("contact", "Contact")}
        </nav>
        {link(
          "",
          doc.logoUrl ? image(doc.logoUrl, doc.brandName) : doc.brandName,
          styles.brand,
        )}
        <div className={styles.headerActions}>
          <a
            className={styles.signIn}
            href={`https://business.jktl.com.ng${templateLoginPath(template.id)}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Sign in to JKTL Business"
          >
            <LogIn size={17} />
            <span>Sign in</span>
          </a>
          {link("shop", "The collection", styles.collectionLink)}
          <button
            className={styles.menuButton}
            type="button"
            aria-label={menu ? "Close menu" : "Open menu"}
            aria-expanded={menu}
            aria-controls="cosmetics-menu"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
        {menu && (
          <nav
            className={styles.mobileNav}
            id="cosmetics-menu"
            aria-label="Mobile beauty boutique navigation"
          >
            {link("", "Home")}
            {link("shop", "Shop the collection")}
            {link("about", "About")}
            {link("editorial", "Our perspective")}
            {link("care", "Care & questions")}
            {link("contact", "Contact")}
          </nav>
        )}
      </header>
      <main id="cosmetic-content">
        {!path ? (
          <>
            <section className={styles.hero}>
              <div className={styles.heroCopy}>
                <p className={styles.eyebrow}>{doc.eyebrow}</p>
                <h1>{doc.headline}</h1>
                <p>{doc.intro}</p>
                {button("shop", doc.ctaLabel)}
              </div>
              <div className={styles.heroPhoto}>
                {image(
                  doc.heroImage,
                  "African woman wearing an expressive makeup look",
                  true,
                )}
              </div>
            </section>
            <section className={styles.featured}>
              <div className={styles.sectionIntro}>
                <div>
                  <p className={styles.eyebrow}>Find your own favourites</p>
                  <h2>{doc.offeringsTitle}</h2>
                </div>
                <div className={styles.trackControls}>
                  <button
                    type="button"
                    aria-label="Previous products"
                    onClick={() =>
                      track.current?.scrollBy({
                        left: -(track.current?.clientWidth || 300) * 0.8,
                        behavior: reduced ? "auto" : "smooth",
                      })
                    }
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <button
                    type="button"
                    aria-label="Next products"
                    onClick={() =>
                      track.current?.scrollBy({
                        left: (track.current?.clientWidth || 300) * 0.8,
                        behavior: reduced ? "auto" : "smooth",
                      })
                    }
                  >
                    <ArrowRight size={18} />
                  </button>
                  {link("shop", "View the collection", styles.textLink)}
                </div>
              </div>
              {cards(true)}
              {doc.demoContent && (
                <p className={styles.finePrint}>
                  Sample collection · product photography is inspiration.
                  Replace it with your actual products before publishing.
                </p>
              )}
            </section>
            {collections}
            {values}
            {reviewSection}
          </>
        ) : (
          <>
            <section className={styles.pageIntro}>
              <p className={styles.eyebrow}>{doc.brandName}</p>
              <h1>{meta.heading}</h1>
              <p>
                {product?.description ||
                  (path === "about"
                    ? doc.intro
                    : path === "contact"
                      ? doc.contactText
                      : path === "care"
                        ? "Ask about the details before making your choice."
                        : doc.featureText)}
              </p>
            </section>
            {(path === "shop" || category) && (
              <section className={styles.shop}>
                <nav
                  className={styles.categories}
                  aria-label="Collection categories"
                >
                  {link(
                    "shop",
                    "All products",
                    path === "shop" ? styles.active : undefined,
                  )}
                  {categories.map((c) => (
                    <span key={c.slug}>
                      {link(
                        "shop/" + c.slug,
                        c.name,
                        path === "shop/" + c.slug ? styles.active : undefined,
                      )}
                    </span>
                  ))}
                </nav>
                <label className={styles.search}>
                  <Search size={18} aria-hidden="true" />
                  <span className={styles.srOnly}>Search the collection</span>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search the collection…"
                    type="search"
                    maxLength={120}
                  />
                </label>
                <p className={styles.resultCount} role="status">
                  {shown.length} {shown.length === 1 ? "product" : "products"}
                </p>
                {cards()}
                {!shown.length && (
                  <div className={styles.empty}>
                    <h2>A different expression?</h2>
                    <p>Try another search or explore the other collections.</p>
                    <button type="button" onClick={() => setSearch("")}>
                      Clear search
                    </button>
                  </div>
                )}
              </section>
            )}
            {product && (
              <section className={styles.productDetail}>
                <div className={styles.detailPhoto}>
                  {image(product.image || doc.heroImage, product.title, true)}
                </div>
                <div>
                  <p className={styles.eyebrow}>
                    {product.category || "The collection"}
                  </p>
                  <h2>A closer look.</h2>
                  <p>{product.description}</p>
                  <p className={styles.detailPrice}>
                    {product.price || "Enquire for price"}
                  </p>
                  {product.benefits?.length ? (
                    <ul>
                      {product.benefits.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  ) : null}
                  {product.preparation && (
                    <p className={styles.finePrint}>{product.preparation}</p>
                  )}
                  {button(
                    enquiryPath(product, doc.offerings.indexOf(product)),
                    "Ask about this product",
                  )}
                  <p className={styles.finePrint}>
                    The boutique confirms products, shades, availability and
                    price. An enquiry does not create an order or take payment.
                  </p>
                  {doc.demoContent && (
                    <p className={styles.finePrint}>
                      Sample product · replace details and imagery with your
                      own.
                    </p>
                  )}
                </div>
              </section>
            )}
            {path === "about" && (
              <section className={styles.about}>
                <div>
                  {image(
                    doc.aboutImage || doc.heroImage,
                    "Personal makeup and beauty inspiration",
                  )}
                </div>
                <div>
                  <p className={styles.eyebrow}>Our perspective</p>
                  <h2>{doc.aboutTitle}</h2>
                  <p className={styles.paragraph}>{doc.aboutText}</p>
                  {button("shop", "Discover the edit")}
                </div>
              </section>
            )}
            {path === "editorial" && (
              <>
                {values}
                {collections}
              </>
            )}
            {path === "care" && care}
            {path === "contact" && (
              <section className={styles.contact}>
                <div>
                  <h2>{doc.contactTitle}</h2>
                  <p>{doc.contactText}</p>
                  {requested && (
                    <div className={styles.requested}>
                      <p className={styles.eyebrow}>Your product enquiry</p>
                      <h3>{requested.title}</h3>
                      <p>{requested.price}</p>
                    </div>
                  )}
                  {address ? (
                    <p>{address}</p>
                  ) : (
                    <p>
                      Ask the boutique about visit and delivery arrangements.
                    </p>
                  )}
                  {email && <a href={`mailto:${email}`}>{email}</a>}
                  {phone && <a href={`tel:${phone}`}>{phone}</a>}
                  {doc.serviceAreas?.length ? (
                    <>
                      <h3>Collection & service areas</h3>
                      <ul>
                        {doc.serviceAreas.map((a) => (
                          <li key={a}>{a}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>
                <div className={styles.request}>
                  <BeautyRequestForm
                    key={requestedSlug || "general"}
                    kind="contact"
                    document={doc}
                    initialMessage={
                      requested
                        ? `I would like to know more about ${requested.title}. Please confirm the current products, shades, availability and price.`
                        : ""
                    }
                    onRequest={preview ? undefined : onRequest}
                  />
                </div>
              </section>
            )}
          </>
        )}
        {businessSection}
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerDetails}>
            <div>
              <h2>Explore</h2>
              {link("shop", "The collection")}
              {link("about", "Our story")}
              {link("editorial", "Our perspective")}
              {link("care", "Care & questions")}
              {link("contact", "Ask the boutique")}
            </div>
            <div>
              <h2>Get in touch</h2>
              {email && <a href={`mailto:${email}`}>{email}</a>}
              {phone && <a href={`tel:${phone}`}>{phone}</a>}
              {address && <p>{address}</p>}
              {social.map((s) => (
                <a
                  key={s.platform}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ArrowUpRight size={14} aria-hidden="true" />
                  {s.platform}
                </a>
              ))}
              {!email && !phone && !address && !social.length && (
                <p>
                  Your own kind of beauty.
                  <br />
                  Start with a conversation.
                </p>
              )}
            </div>
          </div>
          <div className={styles.footerPhoto}>
            {image(
              doc.gallery[2]?.src || doc.heroImage,
              "A personal beauty expression",
            )}
          </div>
          <div className={styles.footerBrand}>
            {doc.logoUrl ? image(doc.logoUrl, doc.brandName) : doc.brandName}
          </div>
        </div>
        <div className={styles.footerBottom}>
          <p>
            © {new Date().getFullYear()} {doc.brandName}
          </p>
          {doc.demoContent && (
            <p>Sample website · photos and products are inspiration.</p>
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
