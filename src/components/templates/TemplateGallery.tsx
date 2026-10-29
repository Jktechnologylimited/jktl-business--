"use client";
import { T, useLanguage } from "@/components/i18n/LanguageProvider";
import Link from "next/link";
import { useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Search, X } from "lucide-react";
import {
  websiteTemplates,
  getWebsiteTemplate,
  templateEditorPath,
  templateLoginPath,
  type WebsiteTemplate,
} from "@/lib/website-templates";
import styles from "./TemplateGallery.module.css";
// Show different industries/designs together instead of ten editions of the
// same starter consecutively. Registry records and identifiers stay unchanged.
const groups = new Map<string, WebsiteTemplate[]>();
for (const template of websiteTemplates) {
  const key = template.sourceId || template.id;
  groups.set(key, [...(groups.get(key) || []), template]);
}
const catalogGroups = [...groups.values()];
const browsingTemplates = Array.from(
  { length: Math.max(...catalogGroups.map((group) => group.length)) },
  (_, index) =>
    catalogGroups.flatMap((group) => (group[index] ? [group[index]] : [])),
).flat();

export function TemplateGallery({
  insideBusiness = false,
  initialType = "all",
}: {
  insideBusiness?: boolean;
  initialType?: "all" | "website" | "landing" | "blank";
}) {
  const { t } = useLanguage();
  const reducedMotion = useReducedMotion();
  const [type, setType] = useState(initialType),
    [limit, setLimit] = useState(24),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("All industries"),
    [industry, setIndustry] = useState("");
  const [info, setInfo] = useState<WebsiteTemplate | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const Heading = insideBusiness || initialType === "landing" ? "h2" : "h1";
  const CardHeading = Heading === "h1" ? "h2" : "h3";
  const categories = [
    "All industries",
    ...new Set(websiteTemplates.map((template) => template.category)),
  ];
  const industryChoices =
    category === "All industries"
      ? []
      : [
          ...new Set(
            websiteTemplates
              .filter((template) => template.category === category)
              .map((template) => template.sourceId || template.id),
          ),
        ]
          .map((id) => getWebsiteTemplate(id))
          .filter((template): template is WebsiteTemplate => Boolean(template));
  const filtered = browsingTemplates.filter(
    (template) =>
      (category === "All industries" || template.category === category) &&
      (!industry || (template.sourceId || template.id) === industry) &&
      (type === "all" ||
        (type === "blank"
          ? template.kind === "blank"
          : template.kind === type)) &&
      `${template.name} ${template.category} ${template.document.brandName}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  function reset() {
    setSearch("");
    setCategory("All industries");
    setIndustry("");
    setType("all");
    setLimit(24);
  }
  function chooseCategory(value: string) {
    setCategory(value);
    setIndustry("");
    setLimit(24);
  }
  const editPath = (id: string) =>
    insideBusiness
      ? templateEditorPath(id)
      : `https://business.jktl.com.ng${templateLoginPath(id)}`;
  return (
    <section
      className={styles.gallery}
      data-template-catalog
      data-business={insideBusiness}
    >
      <header className={styles.heading}>
        <p>
          <T>Made for your next chapter</T>
        </p>
        <Heading>
          <T>
            {initialType === "landing"
              ? "Landing-page templates for every business."
              : "Website templates for every business."}
          </T>
        </Heading>
        <p>
          <T>
            Explore website and landing-page designs, plus blank starting
            points. Find your favourite and make it yours.
          </T>
        </p>
      </header>
      <div
        className={styles.filters}
        role="group"
        aria-label="Template filters"
      >
        <div className={styles.filterChoices}>
          <label>
            <span className={styles.srOnly}>
              <T>Type</T>
            </span>
            <select
              aria-label="Filter template type"
              value={type}
              onChange={(e) => {
                const value = e.target.value as typeof type;
                setType(value);
                setLimit(24);
                if (value === "blank") {
                  setCategory("All industries");
                  setIndustry("");
                }
              }}
            >
              <option value="all">{t("Type")}</option>
              <option value="website">{t("Websites")}</option>
              <option value="landing">{t("Landing pages")}</option>
              <option value="blank">{t("Blank templates")}</option>
            </select>
          </label>
          <label data-active={category !== "All industries"}>
            <span className={styles.srOnly}>
              <T>Industry</T>
            </span>
            <select
              aria-label="Filter templates by industry"
              value={category}
              onChange={(e) => chooseCategory(e.target.value)}
            >
              {categories.map((value) => (
                <option key={value} value={value}>
                  {t(value === "All industries" ? "Industry" : value)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="button" className={styles.reset} onClick={reset}>
          <T>All Templates</T>
        </button>
        <label className={styles.search}>
          <span className={styles.srOnly}>
            <T>Search website templates</T>
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setLimit(24);
            }}
            placeholder={t("Search all templates…")}
            aria-label="Search website templates"
          />
          <Search size={21} aria-hidden="true" />
        </label>
      </div>
      <div className={styles.browseHeader}>
        <div
          className={styles.chips}
          role="group"
          aria-label={t(
            category === "All industries"
              ? "Browse template industries"
              : "Browse this industry",
          )}
        >
          <button
            type="button"
            aria-pressed={category === "All industries" || !industry}
            onClick={() => {
              setIndustry("");
              setLimit(24);
            }}
          >
            <T>All</T>
          </button>
          {industryChoices.length
            ? industryChoices.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  aria-pressed={industry === template.id}
                  onClick={() => {
                    setIndustry(template.id);
                    setLimit(24);
                  }}
                >
                  {t(template.name)}
                </button>
              ))
            : categories
                .filter((c) => c !== "All industries")
                .map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={false}
                    onClick={() => chooseCategory(value)}
                  >
                    {t(value)}
                  </button>
                ))}
        </div>
        <div className={styles.resultsHeading}>
          <h2>
            <T>
              {search.trim()
                ? "Search results"
                : category === "All industries"
                  ? type === "blank"
                    ? "Blank templates"
                    : type === "landing"
                      ? "Landing page templates"
                      : type === "website"
                        ? "Website templates"
                        : "All website templates"
                  : category}
            </T>
          </h2>
          <p role="status" aria-live="polite">
            {filtered.length}{" "}
            <T>{filtered.length === 1 ? "template" : "templates"}</T>
          </p>
        </div>
      </div>
      <div className={styles.grid}>
        {filtered.slice(0, limit).map((template) => (
          <motion.article
            key={template.id}
            className={styles.card}
            initial={false}
            whileHover={reducedMotion ? undefined : { y: -6 }}
            transition={{ duration: reducedMotion ? 0 : 0.25, ease: "easeOut" }}
          >
            <div className={styles.preview}>
              <Link
                href={`/templates/${template.id}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`View ${template.name} template`}
                className={styles.thumbnail}
              >
                <div className={styles.browser} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>
                <img
                  src={`/template-previews/${template.id}.jpg`}
                  width={1000}
                  height={676}
                  alt={`${template.name} website preview`}
                  loading="lazy"
                  onError={(e) => {
                    if (!e.currentTarget.dataset.fallback) {
                      e.currentTarget.dataset.fallback = "true";
                      e.currentTarget.src = `/template-art/${template.sourceId || template.id}.svg`;
                    }
                  }}
                />
              </Link>
              <div className={styles.overlay}>
                <Link
                  href={editPath(template.id)}
                  className={styles.edit}
                  aria-label={`Edit ${template.name} template`}
                >
                  <T>Edit</T>
                </Link>
                <Link
                  href={`/templates/${template.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.view}
                  aria-label={`Preview ${template.name} template`}
                >
                  <T>View</T>
                </Link>
                <button
                  type="button"
                  className={styles.info}
                  aria-label={`Information about ${template.name}`}
                  onClick={() => {
                    setInfo(template);
                    dialog.current?.showModal();
                  }}
                >
                  <T>Info</T>
                </button>
              </div>
            </div>
            <div className={styles.cardTitle}>
              <div>
                <CardHeading>{template.name}</CardHeading>
                <p>{t(template.category)}</p>
              </div>
              <span className={styles.badge}>
                <T>
                  {template.kind === "landing"
                    ? "Landing page"
                    : template.kind === "blank"
                      ? "Blank"
                      : "Website"}
                </T>
              </span>
            </div>
          </motion.article>
        ))}
      </div>
      {filtered.length > limit && (
        <button
          type="button"
          className={styles.more}
          onClick={() => setLimit((n) => n + 24)}
        >
          <T>Show more templates</T>{" "}
          <span>
            ({filtered.length - limit} <T>remaining</T>)
          </span>
        </button>
      )}
      {!filtered.length && (
        <div className={styles.empty}>
          <h2>
            <T>No templates found</T>
          </h2>
          <p>
            <T>Try another industry or search term.</T>
          </p>
          <button type="button" onClick={reset}>
            <T>Clear filters</T>
          </button>
        </div>
      )}
      <p className={styles.note}>
        <T>
          Preview names and content are fictional starter examples, not live
          client businesses. Edit your content and contact details before
          publishing.
        </T>
      </p>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-label="Template information"
      >
        <button
          type="button"
          className={styles.close}
          aria-label="Close template details"
          onClick={() => dialog.current?.close()}
        >
          <X size={22} />
        </button>
        {info && (
          <>
            <p className={styles.dialogLabel}>{t(info.category)}</p>
            <h2>{info.name}</h2>
            <p>{info.document.intro}</p>
            <p className={styles.dialogNote}>
              <T>
                {info.document.beauty
                  ? "Includes a full multipage salon website."
                  : info.kind === "landing"
                    ? "A focused landing page for your business."
                    : info.kind === "blank"
                      ? "Start with a blank layout and make it your own."
                      : "A complete, editable website design."}
              </T>
            </p>
            <p className={styles.dialogNote}>
              <T>
                Preview freely. Sign in when you are ready to edit your selected
                template.
              </T>
            </p>
            <div className={styles.dialogActions}>
              <Link
                href={`/templates/${info.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <T>View template</T>
              </Link>
              <Link href={editPath(info.id)}>
                <T>Select Template</T>
              </Link>
            </div>
          </>
        )}
      </dialog>
    </section>
  );
}
