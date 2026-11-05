import "server-only";
import { query } from "./service";
import type { ProjectActor } from "./portal-access";
import { id } from "./model";
import { rate, createCase, answerCase, handoff } from "@/lib/support/service";
import { text, redact, sensitive, wantsHuman } from "@/lib/support/model";
export async function portalCases(actor: ProjectActor) {
  return query(
    "SELECT id,subject,status,project_category,updated_at FROM support_cases WHERE custom_project_id=$1 AND organization_id=$2 AND requester_id=$3 ORDER BY updated_at DESC LIMIT 100",
    [actor.projectId, actor.organizationId, actor.userId],
  );
}
export async function portalCase(actor: ProjectActor, caseId: string) {
  const cases = await query(
    "SELECT id,subject,status,project_category,updated_at FROM support_cases WHERE id=$1 AND custom_project_id=$2 AND organization_id=$3 AND requester_id=$4",
    [id(caseId), actor.projectId, actor.organizationId, actor.userId],
  );
  if (!cases[0]) throw Error("Support ticket unavailable.");
  const messages = await query(
    "SELECT id,sender,body,created_at FROM support_messages WHERE case_id=$1 AND organization_id=$2 ORDER BY created_at,id LIMIT 200",
    [caseId, actor.organizationId],
  );
  return { case: cases[0], messages }; // Internal notes live in support_notes and are never selected.
}
export async function createPortalCase(
  actor: ProjectActor,
  input: { subject: string; message: string; category: string },
) {
  return createCase(
    {
      subject: input.subject,
      message: input.message,
      customProjectId: actor.projectId,
      projectCategory: input.category,
    },
    actor,
  );
}
export async function replyPortalCase(
  actor: ProjectActor,
  caseId: string,
  message: string,
) {
  const { case: c } = await portalCase(actor, caseId);
  if (c.status === "RESOLVED")
    throw Error("Open a new ticket for further help.");
  await rate("message:" + actor.userId, 40);
  const body = redact(text(message));
  const rows = await query(
    `WITH target AS(SELECT * FROM support_cases WHERE id=$1 AND organization_id=$2 AND requester_id=$3 AND status<>'RESOLVED' FOR UPDATE),inserted AS(INSERT INTO support_messages(case_id,organization_id,sender,actor_id,body) SELECT id,organization_id,'user',$3,$4 FROM target RETURNING id),touched AS(UPDATE support_cases SET updated_at=now() WHERE id=$1 AND EXISTS(SELECT 1 FROM inserted)),queued AS(INSERT INTO support_outbox(event_key,case_id,audience) SELECT 'user:'||i.id::text,$1,CASE WHEN c.sensitive THEN 'owner' ELSE 'staff' END FROM inserted i CROSS JOIN target c WHERE c.status IN('WAITING','HUMAN','ESCALATED')) SELECT id FROM inserted`,
    [caseId, actor.organizationId, actor.userId, body],
  );
  if (!rows.length) throw Error("Open a new ticket for further help.");
  if (sensitive(body))
    await handoff(caseId, actor.organizationId, true, actor.userId);
  else if (c.status === "AI" && wantsHuman(body)) {
    await answerCase(caseId, actor.organizationId, body, true);
    await handoff(caseId, actor.organizationId, false, actor.userId);
  } else if (c.status === "AI")
    await answerCase(caseId, actor.organizationId, body);
}
export async function portalAttachments(actor: ProjectActor, caseId: string) {
  await portalCase(actor, caseId);
  return query(
    "SELECT id,file_name,mime,size,created_at FROM support_case_attachments WHERE case_id=$1 AND organization_id=$2 ORDER BY created_at",
    [caseId, actor.organizationId],
  );
}
export async function uploadPortalAttachment(
  actor: ProjectActor,
  caseId: string,
  input: { name: unknown; body: unknown },
) {
  const { case: c } = await portalCase(actor, caseId);
  if (c.status === "RESOLVED")
    throw Error("Open a new ticket for further help.");
  await rate("project-attachment:" + actor.userId, 20);
  if (
    typeof input.body !== "string" ||
    input.body.length > 699052 ||
    !/^[a-zA-Z0-9+/]+={0,2}$/.test(input.body)
  )
    throw Error("Choose a PNG, JPEG, WebP or PDF up to 512 KB.");
  const bytes = Buffer.from(input.body, "base64");
  if (bytes.length < 1 || bytes.length > 524288)
    throw Error("Choose a file up to 512 KB.");
  let mime = "";
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    mime = "image/png";
  else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    mime = "image/jpeg";
  else if (
    bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WEBP"
  )
    mime = "image/webp";
  else if (bytes.subarray(0, 5).toString() === "%PDF-")
    mime = "application/pdf";
  if (!mime) throw Error("Choose a PNG, JPEG, WebP or PDF.");
  const name = text(input.name, 120).replace(/[^a-zA-Z0-9._ -]/g, "_");
  const rows = await query(
    `WITH allowed AS(UPDATE support_cases SET attachment_bytes=attachment_bytes+$4,updated_at=now() WHERE id=$1 AND organization_id=$2 AND requester_id=$3 AND status<>'RESOLVED' AND attachment_bytes+$4<=5242880 RETURNING id,sensitive),inserted AS(INSERT INTO support_case_attachments(case_id,organization_id,actor_id,file_name,mime,size,body) SELECT id,$2,$3,$5,$6,$4,$7 FROM allowed RETURNING id),queued AS(INSERT INTO support_outbox(event_key,case_id,audience) SELECT 'attachment:'||i.id::text,$1,CASE WHEN c.sensitive THEN 'owner' ELSE 'staff' END FROM inserted i CROSS JOIN allowed c) SELECT id FROM inserted`,
    [
      caseId,
      actor.organizationId,
      actor.userId,
      bytes.length,
      name,
      mime,
      bytes.toString("base64"),
    ],
  );
  if (!rows.length)
    throw Error("Support ticket unavailable or attachment limit reached.");
  return rows[0];
}
export async function downloadPortalAttachment(
  actor: ProjectActor,
  caseId: string,
  attachmentId: string,
) {
  await portalCase(actor, caseId);
  return (
    await query(
      "SELECT file_name,mime,body FROM support_case_attachments WHERE id=$1 AND case_id=$2 AND organization_id=$3",
      [id(attachmentId), caseId, actor.organizationId],
    )
  )[0];
}
