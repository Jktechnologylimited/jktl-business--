import "server-only";
import { getSession } from "@/lib/session";
import { query } from "./service";
import { digest, id } from "./model";
import { requestSignature, validSignature } from "./portal-model";
import { rateLimit } from "@/lib/domains/store";
export type ProjectActor = {
  projectId: string;
  organizationId: string;
  userId: string;
  email: string;
  name: string;
  scopes: string[];
  integration?: boolean;
};
export async function projectActor(
  request: Request,
  projectId: string,
  scope: string,
  raw = "",
): Promise<ProjectActor> {
  id(projectId);
  const bearer = request.headers.get("authorization");
  if (!bearer) {
    const session = await getSession();
    if (!session) throw Error("Sign in required.");
    if (
      request.method !== "GET" &&
      request.headers.get("origin") !== new URL(request.url).origin
    )
      throw Error("Request origin rejected.");
    const rows = await query(
      `SELECT u.id,u.email,u.name,p.organization_id FROM custom_projects p JOIN organization_members m ON m.organization_id=p.organization_id AND m.user_id=$2 AND m.role='owner' AND m.active=true JOIN users u ON u.id=m.user_id WHERE p.id=$1 AND p.organization_id=$3 AND p.status IN('LIVE','CONFIGURING')`,
      [projectId, session.userId, session.organizationId],
    );
    const row = rows[0];
    if (!row) throw Error("Project access denied.");
    await rateLimit(
      query,
      projectId + session.userId,
      "project-portal",
      120,
      60,
    );
    return {
      projectId,
      organizationId: String(row.organization_id),
      userId: String(row.id),
      email: String(row.email),
      name: String(row.name),
      scopes: [scope],
    };
  }
  const key = bearer.replace(/^Bearer /, "");
  if (!/^jktl_proj_[0-9a-f-]{36}\.[a-f0-9]{64}$/.test(key))
    throw Error("Integration access denied.");
  const subject = request.headers.get("x-jktl-user") || "",
    timestamp = request.headers.get("x-jktl-timestamp") || "",
    nonce = request.headers.get("x-jktl-nonce") || "";
  if (
    !/^\d{13}$/.test(timestamp) ||
    Math.abs(Date.now() - Number(timestamp)) > 300000 ||
    !/^[a-f0-9]{32,64}$/.test(nonce) ||
    !subject ||
    subject.length > 200 ||
    /[\r\n]/.test(subject)
  )
    throw Error("Integration assertion expired or invalid.");
  const url = new URL(request.url);
  const expected = requestSignature(
    key,
    request.method,
    url.pathname + url.search,
    subject,
    timestamp,
    nonce,
    digest(raw),
  );
  if (!validSignature(request.headers.get("x-jktl-signature") || "", expected))
    throw Error("Integration signature rejected.");
  const rows = await query(
    `SELECT k.id,u.id AS user_id,u.email,u.name,p.organization_id FROM custom_project_keys k JOIN custom_projects p ON p.id=k.project_id AND p.organization_id=k.organization_id JOIN custom_project_owners a ON a.project_id=p.id AND a.organization_id=p.organization_id AND a.local_subject=$3 AND a.active=true JOIN organization_members m ON m.organization_id=p.organization_id AND m.user_id=a.user_id AND m.active=true JOIN users u ON u.id=m.user_id WHERE p.id=$1 AND k.key_hash=$2 AND k.revoked_at IS NULL AND p.portal_enabled=true AND p.status='LIVE' AND $4=ANY(k.scopes) AND $4=ANY(a.scopes)`,
    [projectId, digest(key), subject, scope],
  );
  const row = rows[0];
  if (!row) throw Error("Integration or owner permission revoked.");
  const claimed = await query(
    "INSERT INTO custom_project_nonces(key_id,nonce) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING nonce",
    [row.id, nonce],
  );
  if (!claimed.length) throw Error("Integration assertion already used.");
  await rateLimit(
    query,
    projectId + String(row.user_id),
    "project-portal",
    120,
    60,
  );
  return {
    projectId,
    organizationId: String(row.organization_id),
    userId: String(row.user_id),
    email: String(row.email),
    name: String(row.name),
    scopes: [scope],
    integration: true,
  };
}
