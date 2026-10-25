"use client";
import { T, useLanguage } from "@/components/i18n/LanguageProvider";
import Link from "next/link";
import { useState } from "react";
import {
  websiteTemplates,
  templateEditorPath,
  templateLoginPath,
} from "@/lib/website-templates";
import styles from "./TemplateGallery.module.css";
export function TemplateGallery({
  insideBusiness = false,
  initialType = "all",
}: {
  insideBusiness?: boolean;
  initialType?: "all" | "website" | "landing" | "blank";
}) {
  const { t } = useLanguage();
  const [type, setType] = useState(initialType);
  const [limit, setLimit] = useState(24);
  const Heading = insideBusiness || initialType === "landing" ? "h2" : "h1";
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All industries");
  const categories = [
    "All industries",
    ...new Set(websiteTemplates.map((t) => t.category)),
  ];
  const filtered = websiteTemplates.filter(
    (t) =>
      (category === "All industries" || t.category === category) &&
      (type === "all" ||
        (type === "blank" ? t.kind === "blank" : t.kind === type)) &&
      `${t.name} ${t.category} ${t.document.brandName}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  return (
    <section className={styles.gallery}>
      <div className={styles.heading}>
        <p>
          <T>Designed for your next chapter</T>
        </p>
        <Heading>
          <T>Pick a 2026 website or landing-page template</T>
          <br />
          <T>that feels like your business.</T>
        </Heading>
        <p>
          <T>
            200 industry designs, plus blank starting points. Preview a design,
            then make it yours in JKTL Business.
          </T>
        </p>
        <label className={styles.search}>
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Search templates…")}
            aria-label="Search website templates"
          />
        </label>
      </div>
      <div className={styles.filters}>
        <label>
          Type{" "}
          <select
            aria-label="Filter template type"
            value={type}
            onChange={(e) => {
              setType(e.target.value as typeof type);
              setLimit(24);
            }}
          >
            <option value="all">
              <T>All templates</T>
            </option>
            <option value="website">
              <T>Websites</T>
            </option>
            <option value="landing">
              <T>Landing pages</T>
            </option>
            <option value="blank">
              <T>Blank templates</T>
            </option>
          </select>
        </label>
        <label>
          Industry{" "}
          <select
            aria-label="Filter templates by industry"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                <T>{c}</T>
              </option>
            ))}
          </select>
        </label>
        <p aria-live="polite">
          {filtered.length} {filtered.length === 1 ? "template" : "templates"}
        </p>
        <button
          type="button"
          onClick={() => {
            setSearch("");
            setCategory("All industries");
            setType("all");
            setLimit(24);
          }}
        >
          All templates
        </button>
      </div>
      <div className={styles.grid}>
        {filtered.slice(0, limit).map((template) => (
          <article key={template.id} className={styles.card}>
            <Link
              href={`/templates/${template.id}`}
              aria-label={`View ${template.name} template`}
              className={styles.thumbnail}
            >
              <div className={styles.browser}>
                <i />
                <i />
                <i />
              </div>
              <img
                src={`/template-previews/${template.id}.jpg`}
                alt={`${template.name} website preview`}
                loading="lazy"
                onError={(e) => {
                  if (!e.currentTarget.dataset.fallback) {
                    e.currentTarget.dataset.fallback = "true";
                    e.currentTarget.src = `/template-art/${template.sourceId || template.id}.svg`;
                  }
                }}
              />
              {template.kind !== "blank" && (
                <div className={styles.photoStrip}>
                  <img
                    ref={(node) => {
                      if (
                        node?.complete &&
                        !node.naturalWidth &&
                        !node.dataset.photoFallback
                      ) {
                        node.dataset.photoFallback = "true";
                        node.src = "/brand/entrepreneur-studio.png";
                      }
                    }}
                    src={template.document.heroImage}
                    alt={`${template.category} inspiration`}
                    loading="lazy"
                    onError={(e) => {
                      if (!e.currentTarget.dataset.photoFallback) {
                        e.currentTarget.dataset.photoFallback = "true";
                        e.currentTarget.src = "/brand/entrepreneur-studio.png";
                      }
                    }}
                  />
                  <span>
                    {template.document.brandName}
                    <small>Picture your business here</small>
                  </span>
                </div>
              )}
              <span className={styles.previewLabel}>Live preview ↗</span>
            </Link>
            <div className={styles.cardTitle}>
              <div>
                <h2>{template.name}</h2>
                <p>{template.category}</p>
              </div>
              <span>
                {template.kind === "landing"
                  ? "Landing page"
                  : template.kind === "blank"
                    ? "Blank"
                    : "Website"}
              </span>
            </div>
            <div className={styles.actions}>
              <Link href={`/templates/${template.id}`}>View</Link>
              <Link
                href={
                  insideBusiness
                    ? templateEditorPath(template.id)
                    : `https://business.jktl.com.ng${templateLoginPath(template.id)}`
                }
              >
                Edit <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </article>
        ))}
      </div>
      {filtered.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((n) => n + 24)}
          className={styles.more}
        >
          Show more templates ({filtered.length - limit} remaining)
        </button>
      )}
      {!filtered.length && (
        <div className={styles.empty}>
          <h2>No templates found</h2>
          <p>Try another industry or search term.</p>
          <button
            onClick={() => {
              setSearch("");
              setCategory("All industries");
              setType("all");
              setLimit(24);
            }}
          >
            Clear filters
          </button>
        </div>
      )}
      <p className={styles.note}>
        Preview names and content are fictional starter examples, not live
        client businesses. Edit your content and contact details before
        publishing.
      </p>
    </section>
  );
}
