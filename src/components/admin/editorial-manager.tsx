"use client";
import { useState } from "react";
import { savePublicationAction } from "@/lib/actions/editorial-actions";
import type { Publication, PublicationInput } from "@/lib/publications";
import styles from "./editorial-manager.module.css";
const fresh = (): PublicationInput => ({
  slug: "",
  kind: "blog",
  title: "",
  excerpt: "",
  body: "",
  coverImage: "",
  author: "JKTL Team",
  status: "draft",
  revision: 0,
});
function inputOf(p: Publication): PublicationInput {
  return {
    id: p.id,
    slug: p.slug,
    kind: p.kind,
    title: p.title,
    excerpt: p.excerpt,
    body: p.body,
    coverImage: p.coverImage,
    author: p.author,
    status: p.status,
    revision: p.revision,
  };
}
export function EditorialManager({ initial }: { initial: Publication[] }) {
  const [articles, setArticles] = useState(initial);
  const [form, setForm] = useState<PublicationInput>(fresh);
  const [baseline, setBaseline] = useState(() => JSON.stringify(fresh()));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(false);
  const [search, setSearch] = useState("");
  const dirty = JSON.stringify(form) !== baseline;
  function choose(article?: Publication) {
    if (dirty && !window.confirm("Discard unsaved article changes?")) return;
    const next = article ? inputOf(article) : fresh();
    setForm(next);
    setBaseline(JSON.stringify(next));
    setMessage("");
    setPreview(false);
  }
  function field(key: keyof PublicationInput, value: string) {
    setForm((s) => ({ ...s, [key]: value }));
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage("");
    try {
      const result = await savePublicationAction(form);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      const saved = result.article;
      setArticles((list) => [saved, ...list.filter((p) => p.id !== saved.id)]);
      const next = inputOf(saved);
      setForm(next);
      setBaseline(JSON.stringify(next));
      setMessage(
        saved.status === "published"
          ? "Published. The main site reads this publication directly."
          : "Draft saved. It is not visible on the public site.",
      );
    } catch {
      setMessage(
        "Could not save. Your article remains in the editor. Please retry.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className={styles.layout}>
      <aside className={styles.library}>
        <button disabled={pending} onClick={() => choose()}>
          ＋ New article
        </button>
        <label>
          Find an article
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or URL"
          />
        </label>
        <p>{articles.length} articles · latest 200</p>
        {articles
          .filter((p) =>
            `${p.title} ${p.slug}`.toLowerCase().includes(search.toLowerCase()),
          )
          .map((p) => (
            <button
              key={p.id}
              disabled={pending}
              onClick={() => choose(p)}
              aria-pressed={form.id === p.id}
            >
              <small>
                {p.kind === "blog" ? "BLOG" : "RELEASE & UPDATE"} ·{" "}
                {p.status.toUpperCase()}
              </small>
              <strong>{p.title}</strong>
              <span>
                Revision {p.revision} ·{" "}
                {new Date(p.updatedAt).toLocaleDateString("en-NG")}
              </span>
            </button>
          ))}
        {!articles.length && (
          <p>No articles yet. Create a draft to get started.</p>
        )}
      </aside>
      <section className={styles.editor}>
        <div className={styles.top}>
          <div>
            <h2>{form.id ? "Edit article" : "Create an article"}</h2>
            <p>
              {dirty ? "Unsaved changes" : "All saved changes loaded"} ·
              Markdown supported
            </p>
          </div>
          <button onClick={() => setPreview(!preview)}>
            {preview ? "Back to editor" : "Preview text"}
          </button>
        </div>
        {preview ? (
          <article className={styles.preview}>
            <span>{form.kind === "blog" ? "BLOG" : "RELEASES & UPDATES"}</span>
            <h1>{form.title || "Your article title"}</h1>
            <p>{form.excerpt}</p>
            <small>By {form.author}</small>
            <div>{form.body}</div>
            <p>
              Text preview. Markdown formatting is rendered on the public
              article page.
            </p>
          </article>
        ) : (
          <form onSubmit={save} className={styles.form}>
            <fieldset className={styles.fields} disabled={pending}>
              <div className={styles.row}>
                <label>
                  Article type
                  <select
                    value={form.kind}
                    disabled={!!form.id || pending}
                    onChange={(e) => field("kind", e.target.value)}
                  >
                    <option value="blog">Blog</option>
                    <option value="release">Release & update</option>
                  </select>
                </label>
                <label>
                  Visibility
                  <select
                    value={form.status}
                    disabled={pending}
                    onChange={(e) => field("status", e.target.value)}
                  >
                    <option value="draft">Draft — team only</option>
                    <option value="published">Published — public</option>
                  </select>
                </label>
              </div>
              <label>
                Title
                <input
                  required
                  maxLength={180}
                  value={form.title}
                  onChange={(e) => field("title", e.target.value)}
                />
              </label>
              <label>
                URL slug
                <input
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  maxLength={100}
                  value={form.slug}
                  disabled={!!form.id || pending}
                  onChange={(e) => field("slug", e.target.value)}
                />
                <small>
                  Lowercase words separated by hyphens. The URL and article type
                  stay fixed after the first save.
                </small>
              </label>
              <label>
                Short description
                <textarea
                  required
                  rows={3}
                  maxLength={400}
                  value={form.excerpt}
                  onChange={(e) => field("excerpt", e.target.value)}
                />
              </label>
              <div className={styles.row}>
                <label>
                  Author name
                  <input
                    required
                    maxLength={100}
                    value={form.author}
                    onChange={(e) => field("author", e.target.value)}
                  />
                </label>
                <label>
                  Cover image URL (optional)
                  <input
                    type="url"
                    maxLength={2000}
                    placeholder="https://…"
                    value={form.coverImage}
                    onChange={(e) => field("coverImage", e.target.value)}
                  />
                </label>
              </div>
              <label>
                Article content
                <textarea
                  required
                  className={styles.body}
                  rows={20}
                  maxLength={60000}
                  value={form.body}
                  onChange={(e) => field("body", e.target.value)}
                  placeholder={
                    "## A useful heading\n\nTell readers what changed, what it means and what they can do next.\n\n- A clear point\n- Another helpful detail"
                  }
                />
                <small>
                  Use ## headings, **bold**, lists and [links](https://…). Raw
                  HTML is not rendered publicly.
                </small>
              </label>
              <div className={styles.actions}>
                <button type="submit" disabled={pending}>
                  {pending
                    ? "Saving…"
                    : form.status === "published"
                      ? "Save and publish"
                      : "Save draft"}
                </button>
                {form.id && (
                  <a
                    href={`https://jktl.com.ng/${form.kind === "blog" ? "blog" : "updates"}/${form.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open public URL ↗
                  </a>
                )}
              </div>
            </fieldset>
          </form>
        )}
        <p role="status" className={styles.status}>
          {message}
        </p>
        {form.id && (
          <p className={styles.note}>
            To unpublish, set visibility to Draft and save. Existing public URLs
            will stop serving the article. Public feeds update on the next
            request; no Main deployment is needed.
          </p>
        )}
      </section>
    </div>
  );
}
