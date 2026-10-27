import "server-only";
import { getSql } from "./client";
import {
  mapPublication,
  type PublicationInput,
  type PublicationKind,
} from "@/lib/publications";
import { can } from "@/lib/admin-permissions";
import {
  checkEditorialChange,
  official,
  type EditorialActor,
} from "@/lib/editorial-policy";
export async function listEditorial(actor?: EditorialActor) {
  const sql = getSql();
  return (
    actor && actor.role !== "owner"
      ? await sql`SELECT * FROM jktl_publications WHERE created_by=${actor.id} OR assigned_to=${actor.id} ORDER BY updated_at DESC LIMIT 200`
      : await sql`SELECT * FROM jktl_publications ORDER BY updated_at DESC LIMIT 200`
  ).map(mapPublication);
}
export async function publishedArticles(
  kind: PublicationKind,
  slug?: string,
  offset = 0,
) {
  const sql = getSql();
  const rows = await sql.query(
    `SELECT p.*,ep.slug author_slug,ep.display_name profile_name,ep.bio author_bio,ep.avatar_url author_avatar FROM jktl_publications p LEFT JOIN editorial_profiles ep ON ep.user_id=p.created_by WHERE p.kind=$1 AND p.status='published' AND p.published_at<=now() AND ($2::text IS NULL OR p.slug=$2) ORDER BY p.featured DESC,p.published_at DESC,p.id DESC LIMIT 200 OFFSET $3`,
    [kind, slug || null, slug ? 0 : offset],
  );
  return rows.map((r) => {
    const p = mapPublication(r);
    return {
      ...p,
      body: slug ? p.body : "",
      createdBy: null,
      assignedTo: null,
      approvedBy: null,
      scheduledAt: null,
    };
  });
}
export async function saveEditorial(
  input: PublicationInput,
  actor: EditorialActor,
) {
  const sql = getSql();
  // Recheck the current account, not a browser-supplied role or stale page snapshot.
  const users =
    await sql`SELECT id,role,permission_overrides FROM admin_users WHERE id=${actor.id} AND disabled_at IS NULL AND staff_revoked_at IS NULL`;
  if (!users[0]) throw Error("Not signed in to an active team account.");
  actor = {
    id: String(users[0].id),
    role: users[0].role,
    permissions: users[0].permission_overrides || {},
  };
  const existing = input.id
    ? (await sql`SELECT * FROM jktl_publications WHERE id=${input.id}`)[0]
    : null;
  const old = existing ? mapPublication(existing) : null;
  if (input.id && !old) throw Error("Invalid article ID.");
  checkEditorialChange(actor, input, old);
  if (
    input.category &&
    !(
      await sql`SELECT name FROM editorial_categories WHERE name=${input.category}`
    ).length
  )
    throw Error("Choose an existing editorial category.");
  if (old && ["published", "scheduled"].includes(input.status)) {
    const approver = (
      await sql`SELECT role,permission_overrides FROM admin_users WHERE id=${old.approvedBy} AND disabled_at IS NULL AND staff_revoked_at IS NULL`
    )[0];
    if (
      !approver ||
      !can(approver.role, "review_content", approver.permission_overrides) ||
      (official(input) && approver.role !== "owner")
    )
      throw Error(
        "Official or editorial approval is no longer valid. Submit it for review again.",
      );
  }

  if (input.assignedTo) {
    const assigned =
      await sql`SELECT id FROM admin_users WHERE id=${input.assignedTo} AND role IN('owner','editor') AND disabled_at IS NULL AND staff_revoked_at IS NULL`;
    if (!assigned.length) throw Error("Choose an active editor.");
  }
  if (actor.role === "writer") {
    const profile = (
      await sql`SELECT display_name FROM editorial_profiles WHERE user_id=${actor.id}`
    )[0];
    const user = (
      await sql`SELECT name FROM admin_users WHERE id=${actor.id}`
    )[0];
    input = {
      ...input,
      author: String(profile?.display_name || user?.name || "JKTL Team"),
    };
  }
  const params = [
    input.slug,
    input.kind,
    input.title,
    input.excerpt,
    input.body,
    input.coverImage,
    input.author,
    input.status,
    actor.id,
    input.subtitle || "",
    input.category || "",
    JSON.stringify(input.tags || []),
    input.seoTitle || "",
    input.metaDescription || "",
    input.seriesSlug || "",
    input.chapter ?? null,
    input.product || "",
    input.versionLabel || "",
    JSON.stringify(input.features || []),
    input.sensitive === true,
    input.featured === true,
    input.assignedTo || null,
    input.scheduledAt || null,
    input.comment || "",
    input.id || null,
    input.revision,
  ];
  const rows = await sql.query(
    `WITH changed AS (
 ${
   input.id
     ? `UPDATE jktl_publications SET title=$3,excerpt=$4,body=$5,cover_image=$6,author=$7,status=$8,
 subtitle=$10,category=$11,tags=$12::jsonb,seo_title=$13,meta_description=$14,series_slug=$15,chapter=$16,product=$17,version_label=$18,features=$19::jsonb,sensitive=$20,featured=$21,assigned_to=$22::uuid,
 approved_by=CASE WHEN $8='approved' THEN $9::uuid WHEN $8 IN('published','scheduled') THEN approved_by ELSE NULL END,
 published_by=CASE WHEN $8='published' THEN $9::uuid ELSE published_by END,
 scheduled_by=CASE WHEN $8='scheduled' THEN $9::uuid ELSE NULL END,scheduled_at=CASE WHEN $8='scheduled' THEN $23::timestamptz ELSE NULL END,
 published_at=CASE WHEN $8='published' THEN COALESCE(published_at,now()) ELSE published_at END,updated_by=$9::uuid,updated_at=now(),revision=revision+1 WHERE id=$25::uuid AND revision=$26 AND slug=$1 AND kind=$2 RETURNING *`
     : `INSERT INTO jktl_publications(slug,kind,title,excerpt,body,cover_image,author,status,created_by,updated_by,subtitle,category,tags,seo_title,meta_description,series_slug,chapter,product,version_label,features,sensitive,featured,assigned_to) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::uuid,$9::uuid,$10,$11,$12::jsonb,$13,$14,$15,$16,$17,$18,$19::jsonb,$20,$21,$22::uuid) ON CONFLICT(slug) DO NOTHING RETURNING *`
 }
 ), history AS(INSERT INTO editorial_revisions(publication_id,revision,actor_id,snapshot,comment) SELECT id,revision,$9::uuid,to_jsonb(changed),$24 FROM changed RETURNING id),
 notices AS(INSERT INTO editorial_notices(publication_id,recipient_id,event,revision)
 SELECT p.id,u.id,p.status,p.revision FROM changed p JOIN admin_users u ON u.disabled_at IS NULL AND u.staff_revoked_at IS NULL AND
 (u.id=p.created_by OR u.id=p.assigned_to OR (u.role='owner' AND p.status='submitted')) WHERE p.status<>COALESCE($27,'') AND p.status IN('submitted','in_review','revision_requested','approved','published','rejected')
 ON CONFLICT DO NOTHING RETURNING id) SELECT * FROM changed WHERE ($25::uuid IS NULL OR true) AND ($26::integer>=0) AND ($23::timestamptz IS NULL OR true)`,
    [...params, old?.status || null],
  );
  if (!rows.length)
    throw Error(
      input.id
        ? "This article changed in another tab. Reload the latest version before saving."
        : "That URL is already used. Choose another slug.",
    );
  return mapPublication(rows[0]);
}
export async function editorialWorkspace(actor: EditorialActor) {
  const sql = getSql();
  const [articles, media, categories, profile, editors, history] =
    await Promise.all([
      listEditorial(actor),
      sql`SELECT id,url,alt FROM editorial_media ORDER BY created_at DESC LIMIT 100`,
      sql`SELECT name FROM editorial_categories ORDER BY name`,
      sql`SELECT * FROM editorial_profiles WHERE user_id=${actor.id}`,
      sql`SELECT id,name FROM admin_users WHERE role IN('owner','editor') AND disabled_at IS NULL AND staff_revoked_at IS NULL ORDER BY name`,
      sql.query(
        `SELECT r.id,r.publication_id,r.revision,r.comment,r.created_at,r.snapshot->>'status' status,u.name actor FROM editorial_revisions r JOIN jktl_publications p ON p.id=r.publication_id LEFT JOIN admin_users u ON u.id=r.actor_id WHERE $2='owner' OR p.created_by=$1::uuid OR p.assigned_to=$1::uuid ORDER BY r.created_at DESC LIMIT 200`,
        [actor.id, actor.role],
      ),
    ]);
  return {
    articles,
    media,
    categories: categories.map((r) => String(r.name)),
    profile: profile[0] || null,
    editors,
    history,
  };
}
