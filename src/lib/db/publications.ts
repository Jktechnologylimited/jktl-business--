import "server-only";
import { getSql } from "./client";
import {
  mapPublication,
  type PublicationInput,
  type PublicationKind,
} from "@/lib/publications";
export async function listEditorial() {
  const sql = getSql();
  return (
    await sql`SELECT * FROM jktl_publications ORDER BY updated_at DESC LIMIT 200`
  ).map(mapPublication);
}
export async function publishedArticles(kind: PublicationKind, slug?: string) {
  const sql = getSql();
  const rows = slug
    ? await sql`SELECT id,slug,kind,title,excerpt,body,cover_image,author,status,revision,published_at,updated_at FROM jktl_publications WHERE kind=${kind} AND slug=${slug} AND status='published' AND published_at<=now() LIMIT 1`
    : await sql`SELECT id,slug,kind,title,excerpt,'' AS body,cover_image,author,status,revision,published_at,updated_at FROM jktl_publications WHERE kind=${kind} AND status='published' AND published_at<=now() ORDER BY published_at DESC LIMIT 100`;
  return rows.map(mapPublication);
}
export async function saveEditorial(input: PublicationInput, adminId: string) {
  const sql = getSql();
  if (input.id) {
    const rows =
      await sql`UPDATE jktl_publications SET title=${input.title},excerpt=${input.excerpt},body=${input.body},cover_image=${input.coverImage},author=${input.author},status=${input.status},published_at=CASE WHEN ${input.status}='published' THEN COALESCE(published_at,now()) ELSE published_at END,updated_by=${adminId},updated_at=now(),revision=revision+1 WHERE id=${input.id} AND revision=${input.revision} AND slug=${input.slug} AND kind=${input.kind} RETURNING *`;
    if (!rows.length)
      throw Error(
        "This article changed in another tab. Reload the latest version before saving. URL and article type cannot be changed after creation.",
      );
    return mapPublication(rows[0]);
  }
  const rows =
    await sql`INSERT INTO jktl_publications(slug,kind,title,excerpt,body,cover_image,author,status,published_at,created_by,updated_by) VALUES(${input.slug},${input.kind},${input.title},${input.excerpt},${input.body},${input.coverImage},${input.author},${input.status},CASE WHEN ${input.status}='published' THEN now() ELSE NULL END,${adminId},${adminId}) ON CONFLICT(slug) DO NOTHING RETURNING *`;
  if (!rows.length)
    throw Error("That URL is already used. Choose another slug.");
  return mapPublication(rows[0]);
}
