"use client";
import { useState } from "react";
import {
  websiteTemplates,
  templateEditorPath,
  templateLoginPath,
} from "@/lib/website-templates";
import styles from "./TemplateGallery.module.css";
export function TemplateGallery({
  insideBusiness = false,
}: {
  insideBusiness?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All industries");
  const categories = [
    "All industries",
    ...new Set(websiteTemplates.map((t) => t.category)),
  ];
  const filtered = websiteTemplates.filter(
    (t) =>
      (category === "All industries" || t.category === category) &&
      `${t.name} ${t.category} ${t.document.brandName}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  return (
    <section className={styles.gallery}>
      <div className={styles.heading}>
        <p>Designed for your next chapter</p>
        <h1>
          Pick the website template
          <br />
          that feels like your business.
        </h1>
        <p>
          20 complete starter websites. Preview a design, then make it yours in
          JKTL Business.
        </p>
        <label className={styles.search}>
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates…"
            aria-label="Search website templates"
          />
        </label>
      </div>
      <div className={styles.filters}>
        <label>
          Industry{" "}
          <select
            aria-label="Filter templates by industry"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
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
          }}
        >
          All templates
        </button>
      </div>
      <div className={styles.grid}>
        {filtered.map((template) => (
          <article key={template.id} className={styles.card}>
            <a
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
                    e.currentTarget.src = `/template-art/${template.id}.svg`;
                  }
                }}
              />
              <span className={styles.previewLabel}>Live preview ↗</span>
            </a>
            <div className={styles.cardTitle}>
              <div>
                <h2>{template.name}</h2>
                <p>{template.category}</p>
              </div>
              <span>JKTL</span>
            </div>
            <div className={styles.actions}>
              <a href={`/templates/${template.id}`}>View</a>
              <a
                href={
                  insideBusiness
                    ? templateEditorPath(template.id)
                    : `https://business.jktl.com.ng${templateLoginPath(template.id)}`
                }
              >
                Edit <span aria-hidden="true">↗</span>
              </a>
            </div>
          </article>
        ))}
      </div>
      {!filtered.length && (
        <div className={styles.empty}>
          <h2>No templates found</h2>
          <p>Try another industry or search term.</p>
          <button
            onClick={() => {
              setSearch("");
              setCategory("All industries");
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
