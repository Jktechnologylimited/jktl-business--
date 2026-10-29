import "server-only";
import { query, validateCmsSession } from "./service";
import { id, digest } from "./model";
import { rateLimit } from "@/lib/domains/store";
export class SiteError extends Error {
  constructor(public status: number) {
    super("Website content request unavailable");
  }
}
export type SiteAccess = {
  project: string;
  organization: string;
  user?: string;
  scopes: string[];
};
export async function authorizeSite(
  request: Request,
  projectValue: unknown,
  operation: "public" | "read" | "write" | "publish" | "upload",
) {
  const project = id(projectValue),
    key = request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  if (!/^[a-f0-9]{64}$/.test(key)) throw new SiteError(401);
  const p = (
    await query(
      "SELECT organization_id FROM custom_projects WHERE id=$1 AND cms_key_hash=$2 AND status='LIVE'",
      [project, digest(key)],
    )
  )[0];
  if (!p) throw new SiteError(401);
  const access: SiteAccess = {
    project,
    organization: String(p.organization_id),
    scopes: [],
  };
  if (operation !== "public") {
    const user = id(request.headers.get("x-jktl-user-id")),
      org = id(request.headers.get("x-jktl-organization-id"));
    const current = await validateCmsSession(project, key, user, org);
    const scopes = current?.cms_scopes as string[] | undefined;
    const needed =
      operation === "publish"
        ? ["content:read", "content:write", "content:publish"]
        : operation === "write" || operation === "upload"
          ? ["content:read", "content:write"]
          : ["content:read"];
    if (
      !current ||
      org !== access.organization ||
      !scopes ||
      needed.some((s) => !scopes.includes(s))
    )
      throw new SiteError(403);
    access.user = user;
    access.scopes = scopes;
  }
  await rateLimit(
    query,
    project,
    "custom-site-" + operation,
    operation === "upload" ? 30 : operation === "public" ? 1000 : 120,
    operation === "upload" ? 3600 : 60,
  );
  return access;
}
export async function boundedBody(request: Request, max: number) {
  if (Number(request.headers.get("content-length") || 0) > max)
    throw new SiteError(413);
  const reader = request.body?.getReader();
  if (!reader) throw new SiteError(400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) {
        await reader.cancel();
        throw new SiteError(413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
export function contentFields(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new SiteError(400);
  const entries = Object.entries(value);
  if (
    !entries.length ||
    entries.length > 1000 ||
    entries.some(
      ([k, v]) =>
        !/^[a-zA-Z][a-zA-Z0-9_.-]{0,119}$/.test(k) ||
        typeof v !== "string" ||
        v.length > 10000 ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v),
    )
  )
    throw new SiteError(400);
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > 200000)
    throw new SiteError(413);
  return value as Record<string, string>;
}
function snapshot(row: Record<string, unknown>) {
  return {
    version: 2,
    projectId: row.project_id,
    revision: row.revision,
    draft: row.draft,
    published: row.published,
    audit: row.audit,
  };
}
export async function loadSiteContent(
  access: SiteAccess,
  view: "draft" | "published",
) {
  if (view === "draft" && !access.user) throw new SiteError(403);
  const rows = await query(
    "SELECT project_id,revision,draft,published,audit FROM custom_site_content WHERE project_id=$1 AND organization_id=$2",
    [access.project, access.organization],
  );
  if (view === "published") return { published: rows[0]?.published ?? null };
  return rows[0] ? snapshot(rows[0]) : null;
}
export async function saveSiteContent(
  access: SiteAccess,
  fieldsValue: unknown,
  revision: unknown,
  mode: unknown,
) {
  if (
    !access.user ||
    !access.scopes.includes("content:write") ||
    (mode === "publish" && !access.scopes.includes("content:publish"))
  )
    throw new SiteError(403);
  if (
    !Number.isSafeInteger(revision) ||
    Number(revision) < 0 ||
    !["draft", "publish"].includes(String(mode))
  )
    throw new SiteError(400);
  const fields = contentFields(fieldsValue),
    event = {
      revision: Number(revision) + 1,
      action: mode,
      actor: access.user,
      organizationId: access.organization,
      at: new Date().toISOString(),
    };
  const params = [
    access.project,
    access.organization,
    JSON.stringify(fields),
    revision,
    mode,
    JSON.stringify(event),
  ];
  const rows =
    Number(revision) === 0
      ? await query(
          `INSERT INTO custom_site_content(project_id,organization_id,revision,draft,published,audit) SELECT $1,$2,1,$3::jsonb,CASE WHEN $5='publish' THEN $3::jsonb ELSE NULL END,jsonb_build_array($6::jsonb) WHERE $4::integer=0 ON CONFLICT(project_id) DO NOTHING RETURNING project_id,revision,draft,published,audit`,
          params.map((v, i) => (i === 3 ? Number(v) : v)),
        )
      : await query(
          `UPDATE custom_site_content SET revision=revision+1,draft=$3::jsonb,published=CASE WHEN $5='publish' THEN $3::jsonb ELSE published END,audit=(SELECT COALESCE(jsonb_agg(value ORDER BY ord),'[]'::jsonb) FROM jsonb_array_elements(audit||jsonb_build_array($6::jsonb)) WITH ORDINALITY a(value,ord) WHERE ord>GREATEST(0,jsonb_array_length(audit)+1-100)),updated_at=now() WHERE project_id=$1 AND organization_id=$2 AND revision=$4 RETURNING project_id,revision,draft,published,audit`,
          params,
        );
  if (!rows[0]) throw new SiteError(409);
  return snapshot(rows[0]);
}

export function mediaFormat(bytes: Buffer) {
  if (bytes.length < 12 || bytes.length > 3145728) throw new SiteError(413);
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return "image/jpeg";
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (
    bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WEBP"
  )
    return "image/webp";
  throw new SiteError(400);
}
export async function saveSiteMedia(
  access: SiteAccess,
  mediaId: string,
  bytes: Buffer,
) {
  if (!access.user || !access.scopes.includes("content:write"))
    throw new SiteError(403);
  const type = mediaFormat(bytes);
  await query(
    "INSERT INTO custom_site_media(id,project_id,organization_id,content_type,data,uploaded_by) VALUES($1,$2,$3,$4,decode($5,'base64'),$6)",
    [
      id(mediaId),
      access.project,
      access.organization,
      type,
      bytes.toString("base64"),
      access.user,
    ],
  );
  return type;
}
export async function loadSiteMedia(access: SiteAccess, mediaId: string) {
  const row = (
    await query(
      "SELECT content_type,encode(data,'base64') AS encoded FROM custom_site_media WHERE id=$1 AND project_id=$2 AND organization_id=$3",
      [id(mediaId), access.project, access.organization],
    )
  )[0];
  if (!row) throw new SiteError(404);
  return {
    type: String(row.content_type),
    bytes: Uint8Array.from(Buffer.from(String(row.encoded), "base64")),
  };
}
