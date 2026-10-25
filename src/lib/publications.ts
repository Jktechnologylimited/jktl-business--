export type PublicationKind = "blog" | "release";
export type Publication = {
  id: string;
  slug: string;
  kind: PublicationKind;
  title: string;
  excerpt: string;
  body: string;
  coverImage: string;
  author: string;
  status: "draft" | "published";
  revision: number;
  publishedAt: string | null;
  updatedAt: string;
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
> & { id?: string; revision: number };
export function parsePublication(input: unknown): PublicationInput {
  if (!input || typeof input !== "object") throw Error("Invalid article.");
  const s = input as Record<string, unknown>;
  const text = (key: string, max: number, required = true) => {
    const v = s[key];
    if (typeof v !== "string" || v.length > max || (required && !v.trim()))
      throw Error(`Check ${key}.`);
    return v.trim();
  };
  const slug = text("slug", 100);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    throw Error("Use lowercase letters, numbers and hyphens for the URL.");
  const kind = s.kind;
  if (kind !== "blog" && kind !== "release")
    throw Error("Choose Blog or Release & update.");
  const status = s.status;
  if (status !== "draft" && status !== "published")
    throw Error("Choose draft or published.");
  const title = text("title", 180),
    excerpt = text("excerpt", 400),
    body = text("body", 60000),
    author = text("author", 100),
    coverImage = text("coverImage", 2000, false);
  if (coverImage) {
    let url;
    try {
      url = new URL(coverImage);
    } catch {
      throw Error("Use a full HTTPS cover image URL.");
    }
    if (url.protocol !== "https:" || url.username || url.password)
      throw Error("Use a full HTTPS cover image URL.");
  }
  if (status === "published" && body.length < 50)
    throw Error("Add at least 50 characters before publishing.");
  if (!Number.isSafeInteger(s.revision) || Number(s.revision) < 0)
    throw Error("Invalid article revision.");
  let id: string | undefined;
  if (s.id !== undefined && s.id !== "") {
    if (
      typeof s.id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s.id)
    )
      throw Error("Invalid article ID.");
    id = s.id;
    if (Number(s.revision) < 1) throw Error("Invalid article revision.");
  } else if (s.revision !== 0) throw Error("Invalid new article revision.");
  return {
    id,
    slug,
    kind,
    title,
    excerpt,
    body,
    coverImage,
    author,
    status,
    revision: Number(s.revision),
  };
}
export function mapPublication(r: Record<string, unknown>): Publication {
  return {
    id: String(r.id),
    slug: String(r.slug),
    kind: r.kind as PublicationKind,
    title: String(r.title),
    excerpt: String(r.excerpt),
    body: String(r.body ?? ""),
    coverImage: String(r.cover_image ?? ""),
    author: String(r.author),
    status: r.status as Publication["status"],
    revision: Number(r.revision),
    publishedAt: r.published_at
      ? new Date(String(r.published_at)).toISOString()
      : null,
    updatedAt: new Date(String(r.updated_at)).toISOString(),
  };
}
