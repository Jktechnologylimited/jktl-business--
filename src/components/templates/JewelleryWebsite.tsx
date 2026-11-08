/* eslint-disable @next/next/no-img-element -- Compressed local and customer-editable template photos avoid runtime image optimization. */
"use client";
import {
  useEffect,
  useSyncExternalStore,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  ChevronRight,
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
import type { TemplateContact } from "./TemplateWebsite";
import styles from "./JewelleryWebsite.module.css";
const jewelleryQuerySnapshot = () => window.location.search;
const jewelleryServerQuery = () => "";
function jewelleryQuerySubscribe(fn: () => void) {
  window.addEventListener("popstate", fn);
  return () => window.removeEventListener("popstate", fn);
}
export function JewelleryWebsite({
  template,
  document: doc,
  contact = {},
  preview = false,
  hideBranding = false,
  pagePath = "",
  basePath = "",
  onNavigate,
  onInteraction,
  businessSection,
  reviews: actualReviews = [],
}: {
  template: WebsiteTemplate;
  document: WebsiteDocument;
  contact?: TemplateContact;
  preview?: boolean;
  hideBranding?: boolean;
  pagePath?: string;
  basePath?: string;
  onNavigate?: (path: string) => void;
  onInteraction?: (kind: "cta" | "contact") => void;
  businessSection?: ReactNode;
  reviews?: { name: string; quote: string; rating?: number | null }[];
}) {
  const [menu, setMenu] = useState(false),
    [query, setQuery] = useState(""),
    [notice, setNotice] = useState("");
  const root = useRef<HTMLDivElement>(null),
    reduced = useReducedMotion(),
    path = pagePath.split(/[?#]/)[0],
    meta = websitePageMeta(template, doc, path),
    route = (p: string) => websitePageHref(basePath, p),
    categories = jewelleryCategories(doc);
  const category = categories.find((c) => path === "shop/" + c.slug),
    product = doc.offerings.find(
      (o, i) => path === "pieces/" + beautyServiceSlug(o, i),
    );
  const browserQuery = useSyncExternalStore(
    jewelleryQuerySubscribe,
    jewelleryQuerySnapshot,
    jewelleryServerQuery,
  );
  const requestedSlug = new URLSearchParams(
    pagePath.split("?")[1] || browserQuery,
  ).get("piece");
  const requestedPiece = doc.offerings.find(
    (o, i) => beautyServiceSlug(o, i) === requestedSlug,
  );
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email || "")
      ? contact.email
      : "",
    phone = (contact.phone || "").replace(/[^+\d]/g, "");
  const location = [contact.address, contact.city, contact.state]
    .filter(Boolean)
    .join(", ");
  const social = (doc.socials || []).filter((s) => {
    try {
      const u = new URL(s.url);
      return u.protocol === "https:" && !u.username && !u.password;
    } catch {
      return false;
    }
  });
  const reviews = actualReviews.length
    ? actualReviews
    : doc.demoContent
      ? []
      : doc.reviews || [];
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
          e.currentTarget.src = "/template-art/jewellery-luxe.svg";
        }
      }}
    />
  );
  const link = (p: string, label: ReactNode, cls?: string) => (
    <a
      key={p}
      href={route(p)}
      className={cls}
      aria-current={path === p ? "page" : undefined}
    >
      {label}
    </a>
  );
  const shown = doc.offerings
    .map((item, index) => ({ item, index }))
    .filter(
      ({ item }) =>
        (!category ||
          (item.category?.trim() || "The collection").toLowerCase() ===
            category.name.toLowerCase()) &&
        (!query ||
          (item.title + " " + item.description + " " + item.category)
            .toLowerCase()
            .includes(query.toLowerCase())),
    );
  const products = (limit?: number) => (
    <div className={styles.products}>
      {(limit ? shown.slice(0, limit) : shown).map(({ item, index }) => (
        <motion.article
          key={index}
          initial={false}
          whileHover={reduced ? undefined : { y: -4 }}
          transition={{ duration: 0.25 }}
        >
          {link(
            "pieces/" + beautyServiceSlug(item, index),
            <>
              <div className={styles.productPhoto}>
                {photo(item.image || doc.heroImage, item.title)}
                <span>
                  Discover <ArrowUpRight size={14} />
                </span>
              </div>
              <div className={styles.productCopy}>
                <span>{item.category || "The collection"}</span>
                <h3>{item.title}</h3>
                <p>{item.price || "Enquire for price"}</p>
              </div>
            </>,
          )}
        </motion.article>
      ))}
    </div>
  );
  return (
    <div
      ref={root}
      className={styles.site}
      data-layout="catalogue"
      data-jewellery-template
      style={
        {
          "--jewel-paper": doc.paper,
          "--jewel-ink": doc.ink,
          "--jewel-accent": doc.accent,
        } as CSSProperties
      }
      onClickCapture={(e) => {
        const a = (e.target as Element).closest("a");
        if (!a) return;
        const href = a.getAttribute("href") || "";
        if (href.split("?")[0] === route("contact")) onInteraction?.("contact");
        if (
          !onNavigate ||
          e.button !== 0 ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey ||
          a.target
        )
          return;
        const base = basePath.replace(/\/$/, ""),
          to =
            href === base || href === "/"
              ? ""
              : href.startsWith(base + "/")
                ? href.slice(base.length + 1)
                : null;
        if (
          to !== null &&
          websitePagePaths(template, doc).includes(to.split(/[?#]/)[0])
        ) {
          e.preventDefault();
          onNavigate(to);
          setMenu(false);
          setQuery("");
          setNotice("");
        }
      }}
    >
      <a className={styles.skip} href="#jewellery-content">
        Skip to content
      </a>
      <header className={styles.header}>
        {link(
          "",
          doc.logoUrl ? (
            <img src={doc.logoUrl} alt={doc.brandName} />
          ) : (
            doc.brandName
          ),
          styles.brand,
        )}
        <nav className={styles.desktopNav} aria-label="Boutique navigation">
          {link("shop", "Shop all")}
          {categories.map((c) => link("shop/" + c.slug, c.name))}
          {link("about", "Our story")}
        </nav>
        <div className={styles.actions}>
          <a
            href={`https://business.jktl.com.ng${templateLoginPath(template.id)}`}
            aria-label="Sign in to JKTL Business"
            title="Sign in to JKTL Business"
            target="_blank"
            rel="noopener noreferrer"
          >
            <LogIn size={17} />
          </a>
          <a href={route("shop")} aria-label="Search collection">
            <Search size={17} />
          </a>
          <button
            type="button"
            className={styles.menuButton}
            onClick={() => setMenu(!menu)}
            aria-label={menu ? "Close menu" : "Open menu"}
            aria-expanded={menu}
            aria-controls="jewellery-menu"
          >
            {menu ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
        {menu && (
          <nav
            id="jewellery-menu"
            className={styles.mobileNav}
            aria-label="Mobile boutique navigation"
          >
            {link("", "Home")}
            {link("shop", "Shop all")}
            {categories.map((c) => link("shop/" + c.slug, c.name))}
            {link("about", "Our story")}
            {link("editorial", "The journal")}
            {link("contact", "Contact")}
          </nav>
        )}
      </header>
      <main id="jewellery-content">
        {!path && (
          <>
            <section className={styles.hero}>
              {photo(
                doc.heroImage,
                `${doc.brandName} jewellery editorial portrait`,
                true,
              )}
              <div className={styles.shade} />
              <div className={styles.heroCopy}>
                <span>{doc.eyebrow}</span>
                <h1>{doc.headline}</h1>
                <p>{doc.intro}</p>
                {link(
                  "shop",
                  <>
                    {doc.ctaLabel} <ArrowUpRight size={14} />
                  </>,
                  styles.lightLink,
                )}
              </div>
            </section>
            <section className={styles.intro}>
              <span className={styles.eyebrow}>
                The art of a personal detail
              </span>
              <h2>{doc.aboutTitle}</h2>
              <p>{doc.intro}</p>
            </section>
            <section
              className={styles.categories}
              aria-label="Shop by category"
            >
              {categories.slice(0, 2).map((c) => {
                const item = doc.offerings.find(
                  (o) =>
                    (o.category?.trim() || "The collection").toLowerCase() ===
                    c.name.toLowerCase(),
                );
                return (
                  <article key={c.slug}>
                    {link(
                      "shop/" + c.slug,
                      <>
                        <div>{photo(item?.image || doc.heroImage, c.name)}</div>
                        <h3>
                          {c.name}
                          <ArrowUpRight size={17} />
                        </h3>
                      </>,
                    )}
                  </article>
                );
              })}
            </section>
            <section className={styles.edit}>
              <div className={styles.heading}>
                <div>
                  <span className={styles.eyebrow}>Objects of affection</span>
                  <h2>{doc.offeringsTitle}</h2>
                </div>
                {link("shop", "View all pieces", styles.textLink)}
              </div>
              {products(4)}
            </section>
            <section className={styles.campaign}>
              {photo(
                doc.aboutImage || doc.heroImage,
                "Jewellery editorial portrait with statement earrings",
              )}
              <div>
                <span className={styles.eyebrow}>An everyday ritual</span>
                <h2>{doc.featureTitle}</h2>
                <p>{doc.featureText}</p>
                {link(
                  "editorial",
                  <>
                    Explore the story <ArrowUpRight size={15} />
                  </>,
                  styles.lightLink,
                )}
              </div>
            </section>
            <section className={styles.split}>
              <div>
                <span className={styles.eyebrow}>Worn your way</span>
                <h2>{doc.galleryTitle}</h2>
                <p>{doc.featureText}</p>
                {link(
                  "shop",
                  <>
                    Find your favourite <ArrowUpRight size={15} />
                  </>,
                  styles.textLink,
                )}
              </div>
              {photo(
                doc.gallery[0]?.src || doc.heroImage,
                doc.gallery[0]?.alt || doc.brandName,
              )}
            </section>
          </>
        )}
        {path && (
          <section className={styles.pageIntro}>
            <nav aria-label="Breadcrumb">
              {link("", "Home")}
              <ChevronRight size={12} />
              {product ? link("shop", "Shop") : null}
              <span>{meta.heading}</span>
            </nav>
            {!product && (
              <>
                <h1>{meta.heading}</h1>
                <p>{meta.description}</p>
              </>
            )}
          </section>
        )}
        {(path === "shop" || category) && (
          <section className={styles.shop}>
            <nav className={styles.filters} aria-label="Collection categories">
              {link("shop", "All pieces")}
              {categories.map((c) => link("shop/" + c.slug, c.name))}
            </nav>
            <label className={styles.filterSearch}>
              <Search size={16} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search this collection…"
                aria-label="Search products"
              />
            </label>
            {products()}
            {!shown.length && (
              <p role="status" className={styles.noResults}>
                No pieces match your search.
              </p>
            )}
            {path === "shop" && businessSection}
          </section>
        )}
        {product && (
          <section className={styles.detail}>
            {photo(product.image || doc.heroImage, product.title, true)}
            <div>
              <span className={styles.eyebrow}>
                {product.category || "The collection"}
              </span>
              <h1>{product.title}</h1>
              <p className={styles.price}>
                {product.price || "Enquire for price"}
              </p>
              <p>{product.description}</p>
              {link(
                "contact?piece=" +
                  encodeURIComponent(
                    beautyServiceSlug(product, doc.offerings.indexOf(product)),
                  ),
                <>
                  Enquire about this piece <ArrowUpRight size={15} />
                </>,
                styles.button,
              )}
              <p className={styles.small}>
                Confirm materials, sizing and availability with the boutique
                before ordering.
              </p>
              {link("care", "Care, sizing & ordering", styles.textLink)}
            </div>
          </section>
        )}
        {path === "about" && (
          <section className={styles.story}>
            <div>
              {photo(
                doc.aboutImage || doc.heroImage,
                "Portrait from the boutique’s jewellery inspiration edit",
              )}
            </div>
            <article>
              <span className={styles.eyebrow}>A considered point of view</span>
              <h2>{doc.aboutTitle}</h2>
              <p>{doc.aboutText}</p>
              {link(
                "shop",
                <>
                  Discover the collection <ArrowUpRight size={15} />
                </>,
                styles.textLink,
              )}
            </article>
          </section>
        )}
        {path === "editorial" && (
          <section className={styles.editorial}>
            <h2>{doc.featureTitle}</h2>
            <p>{doc.featureText}</p>
            <div className={styles.gallery}>
              {doc.gallery.map((item, i) => (
                <figure key={i}>
                  {photo(item.src, item.alt)}
                  <figcaption>{item.category || item.alt}</figcaption>
                </figure>
              ))}
            </div>
            <ol>
              {doc.featureItems.map((step, i) => (
                <li key={i}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <p>{step}</p>
                </li>
              ))}
            </ol>
            {reviews.length > 0 && (
              <section className={styles.reviews}>
                <h2>From our customers</h2>
                {reviews.map((r, i) => (
                  <blockquote key={i}>
                    <p>“{r.quote}”</p>
                    <cite>{r.name}</cite>
                  </blockquote>
                ))}
              </section>
            )}
          </section>
        )}
        {path === "care" && (
          <section className={styles.care}>
            <h2>{doc.faqTitle}</h2>
            {doc.faqs.map((item, i) => (
              <details key={i}>
                <summary>
                  {item.question}
                  <span>+</span>
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
            {link("contact", "Ask the boutique", styles.textLink)}
          </section>
        )}
        {path === "contact" && (
          <section className={styles.contact}>
            <div>
              <span className={styles.eyebrow}>A personal conversation</span>
              <h2>{doc.contactTitle}</h2>
              <p>{doc.contactText}</p>
              {email && (
                <a href={`mailto:${encodeURIComponent(email)}`}>{email}</a>
              )}
              {phone && <a href={`tel:${phone}`}>{contact.phone}</a>}
              {location && <p>{location}</p>}
              {doc.serviceAreas?.length ? (
                <p>{doc.serviceAreas.join(" · ")}</p>
              ) : null}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onInteraction?.("contact");
                if (preview) {
                  setNotice(
                    "This is a template preview. Select this template to add your boutique’s details. No enquiry has been sent.",
                  );
                  return;
                }
                if (!email) {
                  setNotice(
                    "The boutique has not added an email address yet. Please use the contact details shown on this page.",
                  );
                  return;
                }
                const data = new FormData(e.currentTarget);
                window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`Jewellery enquiry — ${data.get("name")}`)}&body=${encodeURIComponent(`Name: ${data.get("name")}\nEmail: ${data.get("email")}\n\n${data.get("message")}`)}`;
                setNotice(
                  "Your email app will open with your enquiry. Send it there to contact the boutique.",
                );
              }}
            >
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
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                />
              </label>
              <label>
                Your enquiry
                <textarea
                  name="message"
                  key={requestedPiece?.title || "general-enquiry"}
                  defaultValue={
                    requestedPiece
                      ? `I would like to enquire about ${requestedPiece.title}.`
                      : ""
                  }
                  rows={4}
                  required
                  maxLength={2000}
                />
              </label>
              <button type="submit" className={styles.button}>
                Prepare enquiry <ArrowUpRight size={15} />
              </button>
              <small>
                {preview
                  ? "Preview only. No enquiry is sent."
                  : "Opens your email app to send directly to the boutique."}
              </small>
              {notice && <p role="status">{notice}</p>}
            </form>
            {businessSection}
          </section>
        )}
      </main>
      <section className={styles.stay}>
        <h2>Keep a little beauty close.</h2>
        <p>{doc.contactText}</p>
        {link(
          "contact",
          <>
            Stay in touch <ArrowUpRight size={14} />
          </>,
          styles.textLink,
        )}
      </section>
      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          {link("", doc.brandName, styles.footerBrand)}
          <div>
            <h2>Explore</h2>
            {link("shop", "Shop all")}
            {categories.map((c) => link("shop/" + c.slug, c.name))}
          </div>
          <div>
            <h2>The boutique</h2>
            {link("about", "Our story")}
            {link("editorial", "The journal")}
            {link("care", "Care & questions")}
            {link("contact", "Contact")}
          </div>
          <div>
            <h2>Find us</h2>
            {location ? (
              <p>{location}</p>
            ) : (
              <p>
                {preview
                  ? "Your boutique details go here."
                  : "Contact the boutique for visit arrangements."}
              </p>
            )}
            {email && (
              <a href={`mailto:${encodeURIComponent(email)}`}>{email}</a>
            )}
            {phone && <a href={`tel:${phone}`}>{contact.phone}</a>}
            {social.map((s) => (
              <a
                key={s.platform}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {s.platform} ↗
              </a>
            ))}
          </div>
        </div>
        <div className={styles.footerBottom}>
          <span>
            © {new Date().getFullYear()} {doc.brandName}
          </span>
          {doc.demoContent && (
            <span>Demonstration collection · stock photography</span>
          )}
          {!hideBranding && (
            <a
              href="https://jktl.com.ng"
              target="_blank"
              rel="noopener noreferrer"
            >
              Built with JKTL ↗
            </a>
          )}
        </div>
      </footer>
    </div>
  );
}
