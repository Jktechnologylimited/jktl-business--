import "server-only";
import { owner, query } from "./service";
import { id } from "./model";
import { siteManifest } from "./site-schema";
import { SiteError, type SiteAccess } from "./site-store";
export async function managedSite(
  projectValue: unknown,
  operation: "read" | "write" | "publish" | "upload",
) {
  const session = await owner(),
    project = id(projectValue);
  const p = (
    await query(
      `SELECT p.id,p.organization_id,p.name,p.website_url,p.cms_scopes,p.cms_manifest FROM custom_projects p JOIN custom_clients c ON c.organization_id=p.organization_id WHERE p.id=$1 AND p.organization_id=$2 AND p.managed_cms=true AND p.billing_only=false AND p.status='LIVE' AND c.pilot_ready=true AND c.activated_at IS NOT NULL AND c.user_id=$3`,
      [project, session.organizationId, session.userId],
    )
  )[0];
  const scopes = p?.cms_scopes as string[] | undefined,
    needed =
      operation === "publish"
        ? ["content:read", "content:write", "content:publish"]
        : operation === "read"
          ? ["content:read"]
          : ["content:read", "content:write"];
  if (!p || !scopes || needed.some((s) => !scopes.includes(s)))
    throw new SiteError(403);
  const access: SiteAccess = {
    project,
    organization: session.organizationId,
    user: session.userId,
    scopes,
  };
  return {
    access,
    manifest: siteManifest(p.cms_manifest),
    name: String(p.name),
    websiteUrl: String(p.website_url),
  };
}
export async function publicManagedSite(projectValue: unknown) {
  const project = id(projectValue);
  const p = (
    await query(
      "SELECT organization_id FROM custom_projects WHERE id=$1 AND managed_cms=true AND billing_only=false AND status='LIVE'",
      [project],
    )
  )[0];
  if (!p) throw new SiteError(404);
  return {
    project,
    organization: String(p.organization_id),
    scopes: [],
  } as SiteAccess;
}
