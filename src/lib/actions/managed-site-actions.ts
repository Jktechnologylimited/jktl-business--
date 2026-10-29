"use server";
import { randomUUID } from "node:crypto";
import { managedSite } from "@/lib/custom/managed-site";
import {
  loadSiteContent,
  saveSiteContent,
  saveSiteMedia,
  mediaFormat,
} from "@/lib/custom/site-store";
import { query, audit } from "@/lib/custom/service";
import { managedFields, siteManifest } from "@/lib/custom/site-schema";
import { requireAdminCapability } from "@/lib/admin-session";
import { id, cmsScopes } from "@/lib/custom/model";
import { rateLimit } from "@/lib/domains/store";
export async function managedEditorAction(project: string) {
  try {
    const p = await managedSite(project, "read");
    const snapshot = await loadSiteContent(p.access, "draft");
    const defaults = Object.fromEntries(
      Object.entries(p.manifest).map(([k, f]) => [k, f.default]),
    );
    const stored =
      snapshot && "draft" in snapshot
        ? (snapshot.draft as Record<string, string>)
        : {};
    const draft = Object.fromEntries(
      Object.keys(defaults).map((k) => [k, stored[k] ?? defaults[k]]),
    );
    return {
      ok: true as const,
      data: {
        name: p.name,
        websiteUrl: p.websiteUrl,
        manifest: p.manifest,
        draft: managedFields(draft, p.manifest),
        revision:
          snapshot && "revision" in snapshot ? Number(snapshot.revision) : 0,
        scopes: p.access.scopes,
      },
    };
  } catch {
    return {
      ok: false as const,
      error:
        "This website editor is unavailable. Sign in to the approved owner account or contact JKTL support.",
    };
  }
}
export async function saveManagedSiteAction(
  project: string,
  value: unknown,
  revision: number,
  publish: boolean,
) {
  try {
    if (typeof publish !== "boolean") throw Error();
    const p = await managedSite(project, publish ? "publish" : "write");
    await rateLimit(query, p.access.project, "managed-site-save", 120, 60);
    const result = await saveSiteContent(
      p.access,
      managedFields(value, p.manifest),
      revision,
      publish ? "publish" : "draft",
    );
    return { ok: true as const, revision: Number(result.revision) };
  } catch {
    return {
      ok: false as const,
      error:
        "Save was not confirmed. Check your permissions and reload the latest draft before retrying.",
    };
  }
}
export async function uploadManagedImageAction(
  project: string,
  data: FormData,
) {
  try {
    const p = await managedSite(project, "upload");
    await rateLimit(query, p.access.project, "managed-site-upload", 30, 3600);
    const image = data.get("image");
    if (!(image instanceof File) || image.size < 12 || image.size > 3145728)
      throw Error();
    const bytes = Buffer.from(await image.arrayBuffer()),
      type = mediaFormat(bytes),
      mediaId = randomUUID(),
      ext =
        type === "image/jpeg" ? "jpg" : type === "image/png" ? "png" : "webp";
    await saveSiteMedia(p.access, mediaId, bytes);
    return { ok: true as const, url: "/api/jktl/media/" + mediaId + "." + ext };
  } catch {
    return {
      ok: false as const,
      error:
        "Upload failed. Use PNG, JPEG or WebP up to 3 MB and check editing permissions.",
    };
  }
}
export async function managedCmsConfigAction(project: string) {
  try {
    await requireAdminCapability("manage_custom");
    const row = (
      await query(
        "SELECT revision,managed_cms,cms_manifest,cms_scopes FROM custom_projects WHERE id=$1",
        [id(project)],
      )
    )[0];
    if (!row) throw Error();
    return { ok: true as const, data: row };
  } catch {
    return {
      ok: false as const,
      error: "Could not load editor configuration.",
    };
  }
}
export async function saveManagedCmsConfigAction(
  project: string,
  revision: number,
  enabled: boolean,
  manifest: unknown,
  scopes: unknown,
) {
  try {
    const a = await requireAdminCapability("manage_custom");
    if (typeof enabled !== "boolean" || !Number.isSafeInteger(revision))
      throw Error();
    const fields = siteManifest(manifest),
      permissions = cmsScopes(scopes);
    const rows = await query(
      "UPDATE custom_projects SET managed_cms=$3,cms_manifest=$4::jsonb,cms_scopes=$5::text[],cms_fields=ARRAY['site.text','site.images','site.navigation','site.seo'],revision=revision+1,updated_at=now() WHERE id=$1 AND revision=$2 RETURNING organization_id",
      [id(project), revision, enabled, JSON.stringify(fields), permissions],
    );
    if (!rows.length) throw Error();
    await audit(
      String(rows[0].organization_id),
      a.id,
      "MANAGED_CMS_CONFIGURED",
      { enabled, fields: Object.keys(fields).length },
      project,
    );
    return { ok: true as const };
  } catch {
    return {
      ok: false as const,
      error:
        "Could not save the editor configuration. Check the manifest and reload the latest project revision.",
    };
  }
}
