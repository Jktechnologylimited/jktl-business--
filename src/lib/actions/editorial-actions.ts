"use server";
import { after } from "next/server";
import { runEditorialMaintenance } from "@/lib/editorial-operations";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { requireAdminCapability } from "@/lib/admin-session";
import { parsePublication, isUuid, safeImage } from "@/lib/publications";
import { saveEditorial } from "@/lib/db/publications";
import { getSql } from "@/lib/db/client";
import { EDITORIAL_PERMISSIONS } from "@/lib/admin-permissions";
export async function savePublicationAction(raw: unknown) {
  try {
    const a = await requireAdminCapability("manage_content");
    const article = await saveEditorial(parsePublication(raw), a);
    revalidatePath("/admin/content");
    if (article.status !== "draft")
      after(async () => {
        try {
          await runEditorialMaintenance();
        } catch {
          console.error("Editorial delivery queued for retry.");
        }
      });
    return { ok: true as const, article };
  } catch (e) {
    unstable_rethrow(e);
    const m = e instanceof Error ? e.message : "";
    return {
      ok: false as const,
      error:
        /^(Check |Choose |Use |Invalid |Add |This article|That URL|Your role|Not signed|Submit |Save |Official |URL )/.test(
          m,
        )
          ? m
          : "Could not save this article. Your changes remain in the editor. Please retry.",
    };
  }
}
export async function configureEditorialMemberAction(f: FormData) {
  const a = await requireAdminCapability("manage_team"),
    id = f.get("id"),
    role = String(f.get("role"));
  if (!isUuid(id) || !["writer", "editor"].includes(role))
    throw Error("Choose a Writer or Editor.");
  const enabled = f.getAll("permissions").map(String);
  const permissions = Object.fromEntries(
    EDITORIAL_PERMISSIONS.map((p) => [
      p,
      role === "editor" && enabled.includes(p),
    ]),
  );
  const rows = await getSql().query(
    `WITH changed AS(UPDATE admin_users SET role=$2,permission_overrides=$3::jsonb WHERE id=$1 AND role IN('writer','editor') RETURNING id),ended AS(DELETE FROM admin_sessions WHERE admin_user_id IN(SELECT id FROM changed)) INSERT INTO distribution_audit(actor_id,event,detail) SELECT $4,'EDITORIAL_PERMISSIONS_CHANGED',jsonb_build_object('member',id,'role',$2::text,'permissions',$3::jsonb) FROM changed RETURNING id`,
    [id, role, JSON.stringify(permissions), a.id],
  );
  if (!rows.length) throw Error("Choose an editorial team member.");
  revalidatePath("/admin/team");
}
export async function saveEditorialProfileAction(f: FormData) {
  const a = await requireAdminCapability("manage_content"),
    slug = String(f.get("slug") || "").trim(),
    name = String(f.get("name") || "").trim(),
    bio = String(f.get("bio") || "").trim(),
    avatar = safeImage(String(f.get("avatar") || "").trim());
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
    slug.length > 100 ||
    !name ||
    name.length > 100 ||
    bio.length > 2000
  )
    throw Error("Check your author profile.");
  await getSql().query(
    `INSERT INTO editorial_profiles(user_id,slug,display_name,bio,avatar_url) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id) DO UPDATE SET slug=excluded.slug,display_name=excluded.display_name,bio=excluded.bio,avatar_url=excluded.avatar_url,updated_at=now()`,
    [a.id, slug, name, bio, avatar],
  );
  revalidatePath("/admin/content");
}
export async function addEditorialCategoryAction(f: FormData) {
  await requireAdminCapability("review_content");
  const name = String(f.get("name") || "").trim();
  if (!name || name.length > 80) throw Error("Check the category name.");
  await getSql()`INSERT INTO editorial_categories(name) VALUES(${name}) ON CONFLICT DO NOTHING`;
  revalidatePath("/admin/content");
}
export async function readEditorialRevisionAction(id: string) {
  const a = await requireAdminCapability("manage_content");
  if (!isUuid(id)) throw Error("Invalid revision.");
  const rows = await getSql().query(
    `SELECT r.snapshot,r.comment,r.revision FROM editorial_revisions r JOIN jktl_publications p ON p.id=r.publication_id WHERE r.id=$1 AND($2='owner' OR p.created_by=$3::uuid OR p.assigned_to=$3::uuid)`,
    [id, a.role, a.id],
  );
  if (!rows.length) throw Error("Your role cannot view that revision.");
  return rows[0];
}

export async function runDueEditorialAction() {
  await requireAdminCapability("manage_team");
  await runEditorialMaintenance();
  revalidatePath("/admin/content");
}
