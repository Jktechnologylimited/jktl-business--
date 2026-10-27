"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  savePublicationAction,
  saveEditorialProfileAction,
  addEditorialCategoryAction,
  readEditorialRevisionAction,
  runDueEditorialAction,
} from "@/lib/actions/editorial-actions";
import { uploadEditorialImageAction } from "@/lib/actions/editorial-media-actions";
import { ActionForm } from "@/components/distribution/action-form";
import { can } from "@/lib/admin-permissions";
import type { EditorialActor } from "@/lib/editorial-policy";
import {
  PUBLICATION_KINDS,
  PUBLICATION_STATUSES,
  type Publication,
  type PublicationInput,
} from "@/lib/publications";
import styles from "./editorial-manager.module.css";
type Workspace = {
  articles: Publication[];
  media: Record<string, unknown>[];
  categories: string[];
  profile: Record<string, unknown> | null;
  editors: Record<string, unknown>[];
  history: Record<string, unknown>[];
};
const routes = {
  column: "columns",
  blog: "blog",
  release: "releases",
  update: "updates",
};
const label = (s: string) =>
  s.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
const fresh = (name: string): PublicationInput => ({
  slug: "",
  kind: "blog",
  title: "",
  excerpt: "",
  body: "",
  coverImage: "",
  author: name,
  status: "draft",
  revision: 0,
  subtitle: "",
  category: "",
  tags: [],
  seoTitle: "",
  metaDescription: "",
  seriesSlug: "",
  chapter: null,
  product: "",
  versionLabel: "",
  features: [],
  sensitive: false,
  featured: false,
  assignedTo: null,
  scheduledAt: null,
  comment: "",
});
const inputOf = (p: Publication): PublicationInput => ({ ...p, comment: "" });
export function EditorialManager({
  workspace,
  actor,
  name,
}: {
  workspace: Workspace;
  actor: EditorialActor;
  name: string;
}) {
  const [articles, setArticles] = useState(workspace.articles),
    [form, setForm] = useState<PublicationInput>(() => fresh(name)),
    [baseline, setBaseline] = useState(() => JSON.stringify(fresh(name))),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),
    [preview, setPreview] = useState(false),
    [search, setSearch] = useState(""),
    [view, setView] = useState("Overview"),
    [autosave, setAutosave] = useState(true);
  const [historical, setHistorical] = useState<Record<string, unknown> | null>(
    null,
  );
  const formRef = useRef<HTMLFormElement>(null),
    bodyRef = useRef<HTMLTextAreaElement>(null),
    saving = useRef(false);
  const dirty = JSON.stringify(form) !== baseline,
    reviewer = can(actor.role, "review_content", actor.permissions);
  const tabs = [
    "Overview",
    "All Content",
    "Create Content",
    "Columns",
    "Blog",
    "Releases",
    "Updates",
    "Media Library",
    ...(reviewer ? ["Editorial Review"] : []),
    "My Profile",
  ];
  useEffect(() => {
    if (
      !autosave ||
      !dirty ||
      pending ||
      form.status !== "draft" ||
      !form.title ||
      !form.slug ||
      !form.excerpt ||
      !form.body
    )
      return;
    const timer = setTimeout(() => {
      if (formRef.current?.checkValidity() && !saving.current)
        formRef.current.requestSubmit();
    }, 3000);
    return () => clearTimeout(timer);
  }, [autosave, dirty, pending, form]);
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [dirty]);
  function choose(article?: Publication) {
    if (pending) return;
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    const next = article ? inputOf(article) : fresh(name);
    setForm(next);
    setBaseline(JSON.stringify(next));
    setMessage("");
    setPreview(false);
    setView("Create Content");
  }
  function field<K extends keyof PublicationInput>(
    key: K,
    value: PublicationInput[K],
  ) {
    setForm((s) => ({ ...s, [key]: value }));
  }
  function insert(before: string, after = "") {
    const t = bodyRef.current,
      start = t?.selectionStart || 0,
      end = t?.selectionEnd || 0;
    field(
      "body",
      form.body.slice(0, start) +
        before +
        (form.body.slice(start, end) || "Your text") +
        after +
        form.body.slice(end),
    );
    t?.focus();
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving.current) return;
    saving.current = true;
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
        `${label(saved.status)} saved · revision ${saved.revision}. ${saved.status === "published" ? "Visible on the public website." : "Unpublished content stays private."}`,
      );
    } catch {
      setMessage("Could not save. Your changes remain in the editor.");
    } finally {
      saving.current = false;
      setPending(false);
    }
  }
  const selected = articles.find((p) => p.id === form.id),
    editable =
      reviewer ||
      !selected ||
      ["draft", "revision_requested", "rejected"].includes(selected.status);
  const filtered = articles
    .filter((p) =>
      `${p.title} ${p.slug} ${p.category} ${p.tags.join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .filter(
      (p) =>
        !["Columns", "Blog", "Releases", "Updates"].includes(view) ||
        p.kind ===
          (
            {
              Columns: "column",
              Blog: "blog",
              Releases: "release",
              Updates: "update",
            } as Record<string, string>
          )[view],
    )
    .filter(
      (p) =>
        view !== "Editorial Review" ||
        [
          "submitted",
          "in_review",
          "approved",
          "revision_requested",
          "scheduled",
        ].includes(p.status),
    );
  const statuses = reviewer
    ? PUBLICATION_STATUSES
    : !selected ||
        ["draft", "revision_requested", "rejected"].includes(selected.status)
      ? ["draft", "submitted"]
      : [form.status];
  return (
    <div className={styles.workspace}>
      <nav className={styles.tabs} aria-label="Editorial workspace">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            aria-current={view === t ? "page" : undefined}
            onClick={() => (t === "Create Content" ? choose() : setView(t))}
          >
            {t}
          </button>
        ))}
      </nav>
      {view === "Overview" ? (
        <section className={styles.editor}>
          <p className={styles.eyebrow}>JKTL EDITORIAL TEAM</p>
          <h2 className="text-3xl">One workspace. Every story.</h2>
          <p className="mt-3 text-ink-muted">
            Create → submit → review → approve → publish. Official releases and
            sensitive announcements require Owner approval. Writing release
            notes never deploys software.
          </p>
          <div className={styles.stats}>
            {["draft", "submitted", "approved", "scheduled", "published"].map(
              (status) => (
                <div key={status}>
                  <strong>
                    {articles.filter((p) => p.status === status).length}
                  </strong>
                  <span>{label(status)}</span>
                </div>
              ),
            )}
          </div>
          <button onClick={() => choose()} className={styles.primary}>
            Create content
          </button>
          {actor.role === "owner" && (
            <ActionForm action={runDueEditorialAction}>
              <button className={styles.primary} type="submit">
                Publish due scheduled content & retry notices
              </button>
            </ActionForm>
          )}
          <p className="mt-4 text-sm text-ink-muted">
            You see your own and assigned content. The Owner sees the full
            library and assigns reviews. Status incidents remain on{" "}
            <a
              href="https://status.jktl.com.ng"
              target="_blank"
              rel="noreferrer"
            >
              JKTL Status ↗
            </a>
            .
          </p>
        </section>
      ) : view === "My Profile" ? (
        <section className={`${styles.editor} ${styles.form}`}>
          <h2 className="text-2xl">Your public author profile</h2>
          <ActionForm
            action={saveEditorialProfileAction}
            className={styles.form}
          >
            <label>
              Display name
              <input
                name="name"
                required
                maxLength={100}
                defaultValue={String(workspace.profile?.display_name || name)}
              />
            </label>
            <label>
              Profile URL slug
              <input
                name="slug"
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                maxLength={100}
                defaultValue={String(workspace.profile?.slug || "")}
              />
            </label>
            <label>
              Biography
              <textarea
                name="bio"
                maxLength={2000}
                rows={5}
                defaultValue={String(workspace.profile?.bio || "")}
              />
            </label>
            <label>
              Avatar HTTPS URL
              <input
                name="avatar"
                type="url"
                defaultValue={String(workspace.profile?.avatar_url || "")}
              />
            </label>
            <button className={styles.primary}>Save profile</button>
          </ActionForm>
        </section>
      ) : view === "Media Library" ? (
        <section className={`${styles.editor} ${styles.form}`}>
          <h2 className="text-2xl">Shared media library</h2>
          <p className="text-sm text-ink-muted">
            Uploaded images are public assets. Upload only images cleared for
            publication. Draft article text remains private.
          </p>
          <ActionForm
            action={uploadEditorialImageAction}
            className={styles.form}
          >
            <label>
              Image
              <input
                type="file"
                name="file"
                accept="image/png,image/jpeg,image/webp"
                required
              />
            </label>
            <label>
              Image description
              <input name="alt" required maxLength={300} />
            </label>
            <label>
              <span>
                <input
                  type="checkbox"
                  name="rights"
                  required
                  style={{ width: "auto" }}
                />{" "}
                I have permission to publish this image.
              </span>
            </label>
            <button className={styles.primary}>
              Upload image · up to 512 KB
            </button>
          </ActionForm>
          <div className={styles.mediaGrid}>
            {workspace.media.map((m) => (
              <article key={String(m.id)}>
                <img src={String(m.url)} alt={String(m.alt)} loading="lazy" />
                <p>{String(m.alt)}</p>
                <button
                  onClick={() => {
                    field("coverImage", String(m.url));
                    setView("Create Content");
                  }}
                >
                  Use as cover
                </button>
                <button
                  onClick={() => {
                    field(
                      "body",
                      form.body +
                        `\n\n![${String(m.alt).replace(/[\[\]]/g, "")}](${m.url})\n`,
                    );
                    setView("Create Content");
                  }}
                >
                  Insert in article
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <div className={styles.layout}>
          <aside className={styles.library}>
            <button disabled={pending} onClick={() => choose()}>
              ＋ Create content
            </button>
            <label>
              Find content
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Title, category or tag"
              />
            </label>
            <p>{filtered.length} items · latest 200</p>
            {filtered.map((p) => (
              <button
                key={p.id}
                disabled={pending}
                onClick={() => choose(p)}
                aria-pressed={form.id === p.id}
              >
                <small>
                  {label(p.kind)} · {label(p.status)}
                </small>
                <strong>{p.title}</strong>
                <span>Revision {p.revision}</span>
              </button>
            ))}
          </aside>
          <section className={styles.editor}>
            <div className={styles.top}>
              <div>
                <h2>{form.id ? "Edit content" : "Create content"}</h2>
                <p>
                  Destination: JKTL {label(form.kind)} ·{" "}
                  {dirty ? "Unsaved changes" : "Saved"}
                </p>
              </div>
              <button onClick={() => setPreview(!preview)}>
                {preview ? "Back to editor" : "Preview"}
              </button>
            </div>
            {preview ? (
              <article className={styles.preview}>
                <span>PRIVATE PREVIEW · {label(form.kind)}</span>
                {form.coverImage && <img src={form.coverImage} alt="" />}
                <h1>{form.title || "Your title"}</h1>
                <p>{form.subtitle}</p>
                <p>{form.excerpt}</p>
                <small>By {form.author}</small>
                <div>
                  <ReactMarkdown
                    skipHtml
                    components={{
                      img: ({ src, alt }) =>
                        typeof src === "string" &&
                        src.startsWith("https://") ? (
                          <img src={src} alt={alt || ""} />
                        ) : null,
                    }}
                  >
                    {form.body}
                  </ReactMarkdown>
                </div>
              </article>
            ) : (
              <form ref={formRef} onSubmit={save} className={styles.form}>
                <fieldset
                  disabled={pending || !editable}
                  className={styles.fields}
                >
                  <div className={styles.row}>
                    <label>
                      Publication destination
                      <select
                        value={form.kind}
                        disabled={!!form.id}
                        onChange={(e) =>
                          field(
                            "kind",
                            e.target.value as PublicationInput["kind"],
                          )
                        }
                      >
                        {PUBLICATION_KINDS.map((k) => (
                          <option value={k} key={k}>
                            {label(k)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Workflow status
                      <select
                        value={form.status}
                        onChange={(e) =>
                          field(
                            "status",
                            e.target.value as PublicationInput["status"],
                          )
                        }
                      >
                        {statuses.map((s) => (
                          <option key={s} value={s}>
                            {label(s)}
                          </option>
                        ))}
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
                    Subtitle
                    <input
                      maxLength={240}
                      value={form.subtitle || ""}
                      onChange={(e) => field("subtitle", e.target.value)}
                    />
                  </label>
                  <label>
                    URL slug
                    <input
                      required
                      maxLength={100}
                      pattern="[a-z0-9]+(-[a-z0-9]+)*"
                      value={form.slug}
                      disabled={!!form.id}
                      onChange={(e) => field("slug", e.target.value)}
                    />
                    <small>
                      jktl.com.ng/{routes[form.kind]}/
                      {form.slug || "your-title"} · URL and destination stay
                      fixed after saving.
                    </small>
                  </label>
                  <label>
                    Summary
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
                      Category
                      <select
                        value={form.category || ""}
                        onChange={(e) => field("category", e.target.value)}
                      >
                        <option value="">Choose category</option>
                        {workspace.categories.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Tags · comma separated
                      <input
                        value={(form.tags || []).join(", ")}
                        onChange={(e) =>
                          field(
                            "tags",
                            e.target.value.split(",").map((x) => x.trim()),
                          )
                        }
                      />
                    </label>
                  </div>
                  <div className={styles.row}>
                    <label>
                      Author
                      <input
                        required
                        maxLength={100}
                        value={form.author}
                        readOnly={actor.role === "writer"}
                        onChange={(e) => field("author", e.target.value)}
                      />
                    </label>
                    <label>
                      Cover image · HTTPS URL
                      <input
                        type="url"
                        value={form.coverImage}
                        maxLength={2000}
                        onChange={(e) => field("coverImage", e.target.value)}
                      />
                    </label>
                  </div>
                  <div className={styles.bodyField}>
                    <label htmlFor="editorial-body">Article content</label>
                    <div className={styles.toolbar} aria-label="Formatting">
                      <button type="button" onClick={() => insert("**", "**")}>
                        Bold
                      </button>
                      <button type="button" onClick={() => insert("*", "*")}>
                        Italic
                      </button>
                      <button type="button" onClick={() => insert("\n## ")}>
                        Heading
                      </button>
                      <button type="button" onClick={() => insert("\n- ")}>
                        List
                      </button>
                      <button
                        type="button"
                        onClick={() => insert("[", "](https://example.com)")}
                      >
                        Link
                      </button>
                    </div>
                    <textarea
                      id="editorial-body"
                      ref={bodyRef}
                      required
                      maxLength={60000}
                      rows={20}
                      className={styles.body}
                      value={form.body}
                      onChange={(e) => field("body", e.target.value)}
                    />
                    <small>
                      Formatted Markdown; use the shared Media Library for
                      inline images. Raw HTML is never rendered.
                    </small>
                  </div>
                  {form.kind === "column" && (
                    <div className={styles.row}>
                      <label>
                        Series URL slug
                        <input
                          value={form.seriesSlug || ""}
                          onChange={(e) => field("seriesSlug", e.target.value)}
                        />
                      </label>
                      <label>
                        Chapter
                        <input
                          type="number"
                          min={1}
                          max={10000}
                          value={form.chapter || ""}
                          onChange={(e) =>
                            field(
                              "chapter",
                              e.target.value ? Number(e.target.value) : null,
                            )
                          }
                        />
                      </label>
                    </div>
                  )}
                  {form.kind === "release" && (
                    <>
                      <div className={styles.row}>
                        <label>
                          Product
                          <input
                            maxLength={100}
                            value={form.product || ""}
                            onChange={(e) => field("product", e.target.value)}
                          />
                        </label>
                        <label>
                          Version · optional
                          <input
                            maxLength={80}
                            value={form.versionLabel || ""}
                            onChange={(e) =>
                              field("versionLabel", e.target.value)
                            }
                          />
                        </label>
                      </div>
                      <label>
                        Features · comma separated
                        <input
                          value={(form.features || []).join(", ")}
                          onChange={(e) =>
                            field(
                              "features",
                              e.target.value.split(",").map((x) => x.trim()),
                            )
                          }
                        />
                      </label>
                    </>
                  )}
                  <label>
                    <span>
                      <input
                        type="checkbox"
                        style={{ width: "auto" }}
                        checked={form.sensitive === true}
                        onChange={(e) => field("sensitive", e.target.checked)}
                      />{" "}
                      Sensitive company, security, billing or operational
                      announcement
                    </span>
                    <small>
                      Requires Owner approval and explicit publication
                      permission. Release approval is always restricted.
                    </small>
                  </label>
                  <details>
                    <summary>SEO metadata</summary>
                    <div className={styles.form}>
                      <label>
                        SEO title
                        <input
                          maxLength={180}
                          value={form.seoTitle || ""}
                          onChange={(e) => field("seoTitle", e.target.value)}
                        />
                      </label>
                      <label>
                        Meta description
                        <textarea
                          maxLength={320}
                          value={form.metaDescription || ""}
                          onChange={(e) =>
                            field("metaDescription", e.target.value)
                          }
                        />
                      </label>
                    </div>
                  </details>
                  {reviewer && (
                    <>
                      <label>
                        Assigned editor
                        <select
                          value={form.assignedTo || ""}
                          onChange={(e) =>
                            field("assignedTo", e.target.value || null)
                          }
                        >
                          <option value="">Unassigned</option>
                          {workspace.editors.map((u) => (
                            <option key={String(u.id)} value={String(u.id)}>
                              {String(u.name)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>
                          <input
                            type="checkbox"
                            style={{ width: "auto" }}
                            checked={form.featured === true}
                            onChange={(e) =>
                              field("featured", e.target.checked)
                            }
                          />{" "}
                          Feature this article
                        </span>
                      </label>
                    </>
                  )}
                  {form.status === "scheduled" && (
                    <label>
                      Publication date and time · your local timezone
                      <small>
                        Publishes on the next existing daily job after this time
                        (about 09:00 WAT). An Owner can run due publishing
                        sooner from Overview.
                      </small>
                      <input
                        type="datetime-local"
                        required
                        value={
                          form.scheduledAt
                            ? new Date(
                                new Date(form.scheduledAt).getTime() -
                                  new Date(
                                    form.scheduledAt,
                                  ).getTimezoneOffset() *
                                    60000,
                              )
                                .toISOString()
                                .slice(0, 16)
                            : ""
                        }
                        onChange={(e) =>
                          field(
                            "scheduledAt",
                            e.target.value
                              ? new Date(e.target.value).toISOString()
                              : null,
                          )
                        }
                      />
                    </label>
                  )}
                  <label>
                    Editorial feedback
                    <textarea
                      rows={3}
                      maxLength={3000}
                      value={form.comment || ""}
                      onChange={(e) => field("comment", e.target.value)}
                    />
                  </label>
                  <div className={styles.actions}>
                    <button type="submit" disabled={pending}>
                      {pending ? "Saving…" : `Save · ${label(form.status)}`}
                    </button>
                    {form.id && form.status === "published" && (
                      <a
                        target="_blank"
                        rel="noreferrer"
                        href={`https://jktl.com.ng/${routes[form.kind]}/${form.slug}`}
                      >
                        Open public article ↗
                      </a>
                    )}
                  </div>
                </fieldset>
                <label>
                  <span>
                    <input
                      type="checkbox"
                      style={{ width: "auto" }}
                      checked={autosave}
                      onChange={(e) => setAutosave(e.target.checked)}
                    />{" "}
                    Autosave valid drafts after 3 seconds
                  </span>
                </label>
              </form>
            )}
            {!editable && (
              <p className={styles.note}>
                This submission is with the editorial team. You can preview it
                and read feedback below. Changes reopen when revisions are
                requested.
              </p>
            )}
            <p role="status" className={styles.status}>
              {message}
            </p>
            <details className={styles.note}>
              <summary>Revision history & feedback</summary>
              {workspace.history
                .filter((h) => h.publication_id === form.id)
                .map((h) => (
                  <article key={String(h.id)}>
                    <p>
                      Revision {String(h.revision)} · {label(String(h.status))}{" "}
                      · {String(h.actor || "JKTL Team")} ·{" "}
                      {new Date(String(h.created_at)).toLocaleString()}
                    </p>
                    <p>{String(h.comment || "No review comment")}</p>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const r = await readEditorialRevisionAction(
                            String(h.id),
                          );
                          setHistorical(r.snapshot as Record<string, unknown>);
                        } catch {
                          setMessage("Could not load this revision.");
                        }
                      }}
                    >
                      Read this revision
                    </button>
                  </article>
                ))}
              <p>Reload the workspace to load newly saved history.</p>
            </details>
            {historical && (
              <section className={styles.preview}>
                <button onClick={() => setHistorical(null)}>
                  Close revision
                </button>
                <h2>{String(historical.title)}</h2>
                <p>
                  Revision {String(historical.revision)} ·{" "}
                  {String(historical.status)}
                </p>
                <div>
                  <ReactMarkdown skipHtml>
                    {String(historical.body)}
                  </ReactMarkdown>
                </div>
              </section>
            )}
            {reviewer && (
              <details className={styles.note}>
                <summary>Manage categories</summary>
                <ActionForm action={addEditorialCategoryAction}>
                  <label>
                    Category name
                    <input name="name" required maxLength={80} />
                  </label>
                  <button>Add category</button>
                </ActionForm>
              </details>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
