"use server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  member,
  customerCase,
  staffCase,
  rate,
  query,
  answerCase,
  handoff,
  createCase,
  supportProjectContext,
} from "@/lib/support/service";
import { requireAdminCapability } from "@/lib/admin-session";
import {
  id,
  redact,
  sensitive,
  text,
  SCOPES,
  pushSubscription,
  publicError,
  wantsHuman,
} from "@/lib/support/model";
import {
  getWebsiteTemplate,
  templateDraft,
  parseWebsiteDocument,
} from "@/lib/website-templates";
import { processSupportNotifications } from "@/lib/support/notifications";
export async function supportHomeAction() {
  const s = await member();
  return {
    projects: await query(
      "SELECT id,name FROM custom_projects WHERE organization_id=$1 AND billing_only=false ORDER BY name",
      [s.organizationId],
    ),
    cases: await query(
      "SELECT id,subject,status,updated_at FROM support_cases WHERE organization_id=$1 AND requester_id=$2 ORDER BY updated_at DESC LIMIT 30",
      [s.organizationId, s.userId],
    ),
  };
}
export async function supportCaseAction(caseId: string) {
  const { c } = await customerCase(caseId);
  return {
    case: c,
    project: await supportProjectContext(c),
    messages: await query(
      "SELECT * FROM(SELECT id,sender,body,guide_ids,created_at FROM support_messages WHERE case_id=$1 ORDER BY created_at DESC,id DESC LIMIT 120) recent ORDER BY created_at,id",
      [c.id],
    ),
  };
}
export async function createSupportCaseAction(input: {
  subject: string;
  message: string;
  customProjectId?: string;
  projectCategory?: string;
}) {
  try {
    const caseId = await createCase(input);
    after(() => processSupportNotifications());
    return { ok: true as const, id: caseId };
  } catch (e) {
    return { ok: false as const, error: publicError(e) };
  }
}
export async function sendSupportMessageAction(
  caseId: string,
  message: string,
) {
  try {
    const { s, c } = await customerCase(caseId);
    if (c.status === "RESOLVED")
      throw Error("Open a new case for further help.");
    await rate("message:" + s.userId, 40);
    const body = redact(text(message));
    const inserted = await query(
      `WITH target AS(SELECT * FROM support_cases WHERE id=$1 AND organization_id=$2 AND requester_id=$3 AND status<>'RESOLVED' FOR UPDATE), inserted AS(INSERT INTO support_messages(case_id,organization_id,sender,actor_id,body) SELECT id,organization_id,'user',$3,$4 FROM target RETURNING id),touched AS(UPDATE support_cases SET updated_at=now() WHERE id=$1 AND EXISTS(SELECT 1 FROM inserted)),queued AS(INSERT INTO support_outbox(event_key,case_id,audience) SELECT 'user:'||i.id::text,$1,CASE WHEN c.sensitive THEN 'owner' ELSE 'staff' END FROM inserted i CROSS JOIN target c WHERE c.status IN('WAITING','HUMAN','ESCALATED')) SELECT id FROM inserted`,
      [c.id, s.organizationId, s.userId, body],
    );
    if (!inserted.length) throw Error("Open a new case for further help.");
    if (sensitive(body))
      await handoff(String(c.id), s.organizationId, true, s.userId);
    else if (c.status === "AI" && wantsHuman(body)) {
      await answerCase(String(c.id), s.organizationId, body, true);
      await handoff(String(c.id), s.organizationId, false, s.userId);
    } else if (c.status === "AI")
      await answerCase(String(c.id), s.organizationId, body);
    after(() => processSupportNotifications());
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: publicError(e) };
  }
}
async function requestHumanActionCore(caseId: string, escalate = false) {
  const { s, c } = await customerCase(caseId);
  if (c.status === "RESOLVED") throw Error("This case is resolved.");
  await rate("handoff:" + s.userId, 10);
  await handoff(String(c.id), s.organizationId, escalate, s.userId);
  after(() => processSupportNotifications());
  return { ok: true as const };
}
async function grantSupportActionCore(caseId: string, scopes: string[]) {
  const { s, c } = await customerCase(caseId);
  await member(true);
  if (
    !Array.isArray(scopes) ||
    scopes.some((v) => !SCOPES.includes(v as (typeof SCOPES)[number]))
  )
    throw Error("Choose valid assistance permissions.");
  const unique = [...new Set(scopes)];
  if (unique.length) await rate("grant:" + s.userId, 20);
  const changed = await query(
    `WITH changed AS(UPDATE support_cases SET consent_scopes=$3::text[],consent_until=CASE WHEN cardinality($3::text[])>0 THEN now()+interval '24 hours' ELSE NULL END,revision=revision+1 WHERE id=$1 AND organization_id=$2 AND sensitive=false AND status IN('WAITING','HUMAN') RETURNING *) INSERT INTO support_audit(case_id,organization_id,actor_id,event,detail) SELECT id,organization_id,$4,'ASSISTANCE_PERMISSION_CHANGED',jsonb_build_object('scopes',consent_scopes,'until',consent_until) FROM changed RETURNING id`,
    [c.id, s.organizationId, unique, s.userId],
  );
  if (!changed.length)
    throw Error(
      "Permission was not changed. Request human help on an active, non-sensitive case first.",
    );
  return { ok: true as const };
}
export async function supportQueueAction() {
  const a = await requireAdminCapability("manage_support");
  return {
    owner: a.role === "owner",
    cases: await query(
      `SELECT c.id,c.subject,c.status,c.sensitive,c.assigned_to,c.updated_at,o.name AS business_name FROM support_cases c JOIN organizations o ON o.id=c.organization_id WHERE $1='owner' OR(c.sensitive=false AND(c.status='WAITING' AND c.assigned_to IS NULL OR c.assigned_to=$2)) ORDER BY CASE WHEN c.status='ESCALATED' THEN 0 WHEN c.status='WAITING' THEN 1 ELSE 2 END,c.updated_at DESC LIMIT 100`,
      [a.role, a.id],
    ),
  };
}
export async function staffSupportCaseAction(caseId: string) {
  const { a, c } = await staffCase(caseId);
  const shared =
    Array.isArray(c.consent_scopes) &&
    c.consent_scopes.includes("website_draft") &&
    new Date(String(c.consent_until)) > new Date();
  return {
    case: c,
    project: await supportProjectContext(c),
    messages: await query(
      "SELECT * FROM(SELECT id,sender,body,guide_ids,created_at FROM support_messages WHERE case_id=$1 ORDER BY created_at DESC,id DESC LIMIT 120) recent ORDER BY created_at,id",
      [c.id],
    ),
    notes: await query(
      "SELECT id,body,created_at FROM support_notes WHERE case_id=$1 ORDER BY created_at DESC LIMIT 50",
      [c.id],
    ),
    audit: await query(
      `SELECT event,actor_id,CASE WHEN $2='owner' THEN detail ELSE jsonb_build_object('revision',detail->'revision','template',detail->'template') END AS detail,created_at FROM support_audit WHERE case_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [c.id, a.role],
    ),
    website:
      c.assigned_to === a.id && shared
        ? (
            await query(
              `SELECT p.display_name,p.subdomain,p.published,p.website_template_id,p.website_revision,p.website_document FROM business_profiles p JOIN organization_members m ON m.organization_id=p.organization_id AND m.user_id=$2 AND m.role='owner' AND m.active=true WHERE p.organization_id=$1`,
              [c.organization_id, c.requester_id],
            )
          )[0]
        : null,
  };
}
async function claimSupportCaseActionCore(caseId: string) {
  const a = await requireAdminCapability("manage_support");
  const r = await query(
    `WITH changed AS(UPDATE support_cases SET consent_scopes=CASE WHEN assigned_to IS NULL THEN consent_scopes ELSE '{}'::text[] END,consent_until=CASE WHEN assigned_to IS NULL THEN consent_until ELSE NULL END,assigned_to=$2,status=CASE WHEN sensitive THEN 'ESCALATED' ELSE 'HUMAN' END,revision=revision+1,updated_at=now() WHERE id=$1 AND(assigned_to IS NULL AND status='WAITING' AND sensitive=false OR $3='owner' AND status IN('WAITING','HUMAN','ESCALATED')) RETURNING *) INSERT INTO support_audit(case_id,organization_id,actor_id,event) SELECT id,organization_id,$2,'CLAIMED' FROM changed RETURNING id`,
    [id(caseId), a.id, a.role],
  );
  if (!r.length) throw Error("This case was claimed or requires an owner.");
  return { ok: true as const };
}
async function staffSupportReplyActionCore(
  caseId: string,
  body: string,
  kind: "reply" | "note" | "resolve" | "escalate" = "reply",
) {
  const { a, c } = await staffCase(caseId);
  if (!["reply", "note", "resolve", "escalate"].includes(kind))
    throw Error("Invalid action.");
  if (
    c.assigned_to !== a.id ||
    !["HUMAN", "ESCALATED"].includes(String(c.status))
  )
    throw Error("Claim this active case first.");
  const message = redact(text(body));
  if (kind === "escalate") {
    await handoff(String(c.id), String(c.organization_id), true, a.id);
    after(() => processSupportNotifications());
    return { ok: true as const };
  }
  if (kind === "note") {
    await query(
      `INSERT INTO support_notes(case_id,actor_id,body) SELECT id,$2,$3 FROM support_cases WHERE id=$1 AND assigned_to=$2 AND(status='HUMAN' AND sensitive=false OR $4='owner' AND status='ESCALATED')`,
      [c.id, a.id, message, a.role],
    );
    return { ok: true as const };
  }
  const r = await query(
    `WITH changed AS(UPDATE support_cases SET status=CASE WHEN $4 THEN 'RESOLVED' ELSE status END,consent_scopes=CASE WHEN $4 THEN '{}'::text[] ELSE consent_scopes END,consent_until=CASE WHEN $4 THEN NULL ELSE consent_until END,updated_at=now(),revision=revision+1 WHERE id=$1 AND assigned_to=$2 AND(status='HUMAN' AND sensitive=false OR $5='owner' AND status='ESCALATED') RETURNING *),message AS(INSERT INTO support_messages(case_id,organization_id,sender,actor_id,body) SELECT id,organization_id,'support',$2,$3 FROM changed RETURNING id,case_id),logged AS(INSERT INTO support_audit(case_id,organization_id,actor_id,event) SELECT id,organization_id,$2,CASE WHEN $4 THEN 'RESOLVED' ELSE 'REPLIED' END FROM changed) INSERT INTO support_outbox(event_key,case_id,audience) SELECT 'reply:'||id::text,case_id,'customer' FROM message RETURNING id`,
    [c.id, a.id, message, kind === "resolve", a.role],
  );
  if (!r.length) throw Error("The case changed. Reload before replying.");
  after(() => processSupportNotifications());
  return { ok: true as const };
}
async function assistedWebsiteActionCore(
  caseId: string,
  input: {
    templateId: string;
    document: unknown;
    revision: number;
    publish: boolean;
  },
) {
  const a = await requireAdminCapability("manage_support");
  id(caseId);
  if (
    !Number.isInteger(input.revision) ||
    input.revision < 0 ||
    typeof input.publish !== "boolean"
  )
    throw Error("Invalid website revision.");
  const template = getWebsiteTemplate(input.templateId);
  if (!template) throw Error("Choose a supported template.");
  const document = parseWebsiteDocument(input.document);
  const changed = await query(
    `WITH target AS(SELECT c.id,c.organization_id,p.website_document,p.website_template_id,p.website_revision,p.published FROM support_cases c JOIN business_profiles p ON p.organization_id=c.organization_id JOIN organization_members m ON m.organization_id=c.organization_id AND m.user_id=c.requester_id AND m.role='owner' AND m.active=true WHERE c.id=$1 AND c.assigned_to=$2 AND c.status='HUMAN' AND c.sensitive=false AND c.consent_until>now() AND 'website_draft'=ANY(c.consent_scopes) AND(NOT $6 OR 'website_publish'=ANY(c.consent_scopes)) AND p.website_revision=$5 AND(p.website_template_id='' OR p.website_template_id=$3) AND(NOT $6 OR p.published=false) AND p.published=false FOR UPDATE OF c,p),updated AS(UPDATE business_profiles p SET website_template_id=$3,website_document=$4::jsonb,website_revision=p.website_revision+1,theme_color=$7,published=$6 FROM target t WHERE p.organization_id=t.organization_id RETURNING p.organization_id,p.website_revision),logged AS(INSERT INTO support_audit(case_id,organization_id,actor_id,event,detail) SELECT t.id,t.organization_id,$2,CASE WHEN $6 THEN 'FIRST_WEBSITE_PUBLISHED' ELSE 'WEBSITE_DRAFT_SAVED' END,jsonb_build_object('before',t.website_document,'after',$4::jsonb,'template',$3,'revision',u.website_revision) FROM target t JOIN updated u ON u.organization_id=t.organization_id RETURNING id) SELECT id FROM logged`,
    [
      caseId,
      a.id,
      input.templateId,
      JSON.stringify(document),
      input.revision,
      input.publish,
      document.accent,
    ],
  );
  if (!changed.length)
    throw Error(
      "Save blocked: claim the case, obtain current owner permission and reload the unpublished website. Existing templates and published websites cannot be replaced through support.",
    );
  revalidatePath("/business/website");
  revalidatePath("/business/website/template");
  revalidatePath("/sites", "layout");
  return { ok: true as const };
}
export async function starterDocumentAction(
  templateId: string,
  caseId: string,
) {
  const { a, c } = await staffCase(caseId);
  if (
    c.assigned_to !== a.id ||
    c.sensitive ||
    c.status !== "HUMAN" ||
    !Array.isArray(c.consent_scopes) ||
    !c.consent_scopes.includes("website_draft") ||
    new Date(String(c.consent_until)) <= new Date()
  )
    throw Error(
      "Only an assigned agent with current permission can prepare a draft.",
    );
  const template = getWebsiteTemplate(templateId);
  if (!template) throw Error("Template unavailable.");
  const profile = (
    await query(
      `SELECT p.display_name FROM business_profiles p JOIN organization_members m ON m.organization_id=p.organization_id AND m.user_id=$2 AND m.active=true AND m.role='owner' WHERE p.organization_id=$1`,
      [c.organization_id, c.requester_id],
    )
  )[0];
  if (!profile)
    throw Error("Only an active business owner can authorize this draft.");
  return templateDraft(templateId, String(profile.display_name));
}

async function supportDeviceActionCore(subscription: unknown, remove = false) {
  const a = await requireAdminCapability("manage_support");
  const sub = pushSubscription(subscription);
  if (
    !remove &&
    (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
      !process.env.VAPID_PRIVATE_KEY)
  )
    throw Error("Push notifications are not configured in this deployment.");
  const session = (await cookies()).get("jktl_admin_session")?.value;
  if (!session) throw Error("Sign in again.");
  if (remove)
    await query(
      "DELETE FROM support_push_subscriptions WHERE endpoint=$1 AND admin_id=$2",
      [sub.endpoint, a.id],
    );
  else
    await query(
      `INSERT INTO support_push_subscriptions(endpoint,admin_id,session_id,p256dh,auth) SELECT $1,$2,id,$4,$5 FROM admin_sessions WHERE id=$3 AND admin_user_id=$2 AND expires_at>now() ON CONFLICT(endpoint) DO UPDATE SET admin_id=excluded.admin_id,business_session_id=NULL,session_id=excluded.session_id,p256dh=excluded.p256dh,auth=excluded.auth`,
      [sub.endpoint, a.id, session, sub.p256dh, sub.auth],
    );
  return { ok: true as const };
}
async function retrySupportAlertsActionCore() {
  await requireAdminCapability("manage_support");
  const result = await processSupportNotifications();
  if (!result.configured)
    throw Error("Push notifications are not configured in this deployment.");
  return { ok: true as const };
}

export async function requestHumanAction(
  ...args: Parameters<typeof requestHumanActionCore>
) {
  try {
    return await requestHumanActionCore(...args);
  } catch (error) {
    return { ok: false as const, error: publicError(error) };
  }
}

export async function grantSupportAction(
  ...args: Parameters<typeof grantSupportActionCore>
) {
  try {
    return await grantSupportActionCore(...args);
  } catch (error) {
    return { ok: false as const, error: publicError(error) };
  }
}

export async function claimSupportCaseAction(
  ...args: Parameters<typeof claimSupportCaseActionCore>
) {
  try {
    return await claimSupportCaseActionCore(...args);
  } catch (error) {
    return { ok: false as const, error: publicError(error) };
  }
}

export async function staffSupportReplyAction(
  ...args: Parameters<typeof staffSupportReplyActionCore>
) {
  try {
    return await staffSupportReplyActionCore(...args);
  } catch (error) {
    return { ok: false as const, error: publicError(error) };
  }
}

export async function assistedWebsiteAction(
  ...args: Parameters<typeof assistedWebsiteActionCore>
) {
  try {
    return await assistedWebsiteActionCore(...args);
  } catch (error) {
    return { ok: false as const, error: publicError(error) };
  }
}

export async function supportDeviceAction(
  ...args: Parameters<typeof supportDeviceActionCore>
) {
  try {
    return await supportDeviceActionCore(...args);
  } catch (error) {
    return { ok: false as const, error: publicError(error) };
  }
}

export async function retrySupportAlertsAction(
  ...args: Parameters<typeof retrySupportAlertsActionCore>
) {
  try {
    return await retrySupportAlertsActionCore(...args);
  } catch (error) {
    return { ok: false as const, error: publicError(error) };
  }
}
