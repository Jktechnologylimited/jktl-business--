export const PUBLICATION_KINDS = [
  "column",
  "blog",
  "release",
  "update",
] as const;
export type PublicationKind = (typeof PUBLICATION_KINDS)[number];
export const PUBLICATION_STATUSES = [
  "draft",
  "submitted",
  "in_review",
  "approved",
  "published",
  "revision_requested",
  "scheduled",
  "rejected",
  "unpublished",
] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];
export type Publication = {
  id: string;
  slug: string;
  kind: PublicationKind;
  title: string;
  excerpt: string;
  body: string;
  coverImage: string;
  author: string;
  status: PublicationStatus;
  revision: number;
  publishedAt: string | null;
  updatedAt: string;
  subtitle: string;
  category: string;
  tags: string[];
  seoTitle: string;
  metaDescription: string;
  seriesSlug: string;
  chapter: number | null;
  product: string;
  versionLabel: string;
  features: string[];
  sensitive: boolean;
  featured: boolean;
  createdBy: string | null;
  assignedTo: string | null;
  approvedBy: string | null;
  scheduledAt: string | null;
  authorSlug: string;
  authorBio: string;
  authorAvatar: string;
};
export type PublicationInput = Pick<
  Publication,
  | "slug"
  | "kind"
  | "title"
  | "excerpt"
  | "body"
  | "coverImage"
  | "author"
  | "status"
> &
  Partial<
    Pick<
      Publication,
      | "subtitle"
      | "category"
      | "tags"
      | "seoTitle"
      | "metaDescription"
      | "seriesSlug"
      | "chapter"
      | "product"
      | "versionLabel"
      | "features"
      | "sensitive"
      | "featured"
      | "assignedTo"
      | "scheduledAt"
    >
  > & { id?: string; revision: number; comment?: string };
export function safeImage(value: string) {
  if (!value) return "";
  try {
    const u = new URL(value);
    if (u.protocol === "https:" && !u.username && !u.password) return value;
  } catch {}
  throw Error("Use a full HTTPS image URL.");
}
export const isUuid = (s: unknown): s is string =>
  typeof s === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
export function parsePublication(input: unknown): PublicationInput {
  if (!input || typeof input !== "object") throw Error("Invalid article.");
  const s = input as Record<string, unknown>;
  const text = (k: string, max: number, required = false) => {
    const v = s[k] ?? "";
    if (typeof v !== "string" || v.length > max || (required && !v.trim()))
      throw Error(`Check ${k}.`);
    return v.trim();
  };
  const slug = text("slug", 100, true);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    throw Error("Use lowercase letters, numbers and hyphens for the URL.");
  if (!(PUBLICATION_KINDS as readonly unknown[]).includes(s.kind))
    throw Error("Choose a publication destination.");
  if (!(PUBLICATION_STATUSES as readonly unknown[]).includes(s.status))
    throw Error("Choose a valid editorial status.");
  const list = (k: string) => {
    const v = s[k] ?? [];
    if (
      !Array.isArray(v) ||
      v.length > 20 ||
      v.some((x) => typeof x !== "string" || x.length > 100)
    )
      throw Error(`Check ${k}.`);
    return [...new Set(v.map((x) => (x as string).trim()).filter(Boolean))];
  };
  const body = text("body", 60000, true);
  if (s.status !== "draft" && body.length < 50)
    throw Error("Add at least 50 characters before submitting or publishing.");
  if (!Number.isSafeInteger(s.revision) || Number(s.revision) < 0)
    throw Error("Invalid article revision.");
  if (s.id && (!isUuid(s.id) || Number(s.revision) < 1))
    throw Error("Invalid article ID or revision.");
  if (!s.id && s.revision !== 0) throw Error("Invalid new article revision.");
  const seriesSlug = text("seriesSlug", 100);
  if (seriesSlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(seriesSlug))
    throw Error("Check seriesSlug.");
  const chapter =
    s.chapter == null || s.chapter === "" ? null : Number(s.chapter);
  if (
    chapter !== null &&
    (!Number.isSafeInteger(chapter) ||
      chapter < 1 ||
      chapter > 10000 ||
      !seriesSlug)
  )
    throw Error("Check chapter and series.");
  if (s.assignedTo && !isUuid(s.assignedTo))
    throw Error("Choose a valid editor.");
  let scheduledAt: string | null = null;
  if (s.scheduledAt) {
    if (
      typeof s.scheduledAt !== "string" ||
      !Number.isFinite(Date.parse(s.scheduledAt))
    )
      throw Error("Check scheduledAt.");
    scheduledAt = new Date(s.scheduledAt).toISOString();
  }
  if (
    s.status === "scheduled" &&
    (!scheduledAt || Date.parse(scheduledAt) <= Date.now())
  )
    throw Error("Choose a future publication time.");
  for (const k of ["sensitive", "featured"])
    if (s[k] !== undefined && typeof s[k] !== "boolean")
      throw Error(`Check ${k}.`);
  return {
    id: s.id ? String(s.id) : undefined,
    slug,
    kind: s.kind as PublicationKind,
    status: s.status as PublicationStatus,
    revision: Number(s.revision),
    title: text("title", 180, true),
    excerpt: text("excerpt", 400, true),
    body,
    author: text("author", 100, true),
    coverImage: safeImage(text("coverImage", 2000)),
    subtitle: text("subtitle", 240),
    category: text("category", 80),
    tags: list("tags"),
    seoTitle: text("seoTitle", 180),
    metaDescription: text("metaDescription", 320),
    seriesSlug,
    chapter,
    product: text("product", 100),
    versionLabel: text("versionLabel", 80),
    features: list("features"),
    sensitive: s.sensitive === true,
    featured: s.featured === true,
    assignedTo: s.assignedTo ? String(s.assignedTo) : null,
    scheduledAt,
    comment: text("comment", 3000),
  };
}
export function mapPublication(r: Record<string, unknown>): Publication {
  const d = (k: string) => (r[k] ? new Date(String(r[k])).toISOString() : null);
  return {
    id: String(r.id),
    slug: String(r.slug),
    kind: r.kind as PublicationKind,
    title: String(r.title),
    excerpt: String(r.excerpt),
    body: String(r.body ?? ""),
    coverImage: String(r.cover_image ?? ""),
    author: String(r.profile_name || r.author),
    status: r.status as PublicationStatus,
    revision: Number(r.revision),
    publishedAt: d("published_at"),
    updatedAt: d("updated_at")!,
    subtitle: String(r.subtitle ?? ""),
    category: String(r.category ?? ""),
    tags: (r.tags || []) as string[],
    seoTitle: String(r.seo_title ?? ""),
    metaDescription: String(r.meta_description ?? ""),
    seriesSlug: String(r.series_slug ?? ""),
    chapter: r.chapter ? Number(r.chapter) : null,
    product: String(r.product ?? ""),
    versionLabel: String(r.version_label ?? ""),
    features: (r.features || []) as string[],
    sensitive: r.sensitive === true,
    featured: r.featured === true,
    createdBy: r.created_by ? String(r.created_by) : null,
    assignedTo: r.assigned_to ? String(r.assigned_to) : null,
    approvedBy: r.approved_by ? String(r.approved_by) : null,
    scheduledAt: d("scheduled_at"),
    authorSlug: String(r.author_slug ?? ""),
    authorBio: String(r.author_bio ?? ""),
    authorAvatar: String(r.author_avatar ?? ""),
  };
}
