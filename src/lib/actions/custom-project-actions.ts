"use server";
import { after } from "next/server";
import { createCase } from "@/lib/support/service";
import { processSupportNotifications } from "@/lib/support/notifications";
import { requireAdminCapability } from "@/lib/admin-session";
import { getSession } from "@/lib/session";
import { signup, findUserByEmail, hashPassword } from "@/lib/db/auth";
import { sendCustomInvitationEmail } from "@/lib/email";
import {
  query,
  owner,
  audit,
  generateInvoices,
  initializeInvoice,
  verifyInvoice,
} from "@/lib/custom/service";
import {
  id,
  text,
  secureUrl,
  amount,
  date,
  digest,
  token,
  cmsScopes,
  cmsFields,
  configurationText,
  repositoryReference,
} from "@/lib/custom/model";
import { rateLimit } from "@/lib/domains/store";
function fail(e: unknown) {
  console.error("custom request failed");
  const message = e instanceof Error ? e.message : "";
  return {
    ok: false as const,
    error:
      /^(Enter |Use |Invalid |Only |Select |This |Configure |Invitation |Account |Checkout |Payment |Read |Review |Reload |No |A project|Project |Email |Existing |Activate |Too many)/.test(
        message,
      )
        ? message
        : "Could not complete the request. Check access and configuration, then retry.",
  };
}
export async function customWorkspaceAction() {
  try {
    const s = await owner();
    const [projects, services, invoices, requests, clients] = await Promise.all(
      [
        query(
          `SELECT p.id,p.name,p.website_url,p.status,p.cms_tested_at,p.cms_fields,p.cms_scopes,p.analytics_url,p.domain_asset_id,p.description,p.revision,p.maintenance_agreement,
 d.domain,d.expires_at AS domain_expires_at,d.connection_status AS domain_status,e.domain AS email_domain,e.status AS email_status,e.renews_at AS email_renews_at,e.plan_name AS email_plan
 FROM custom_projects p LEFT JOIN domain_assets d ON d.id=p.domain_asset_id AND d.organization_id=p.organization_id LEFT JOIN email_services e ON e.id=p.email_service_id AND e.organization_id=p.organization_id WHERE p.organization_id=$1 AND p.billing_only=false ORDER BY p.created_at`,
          [s.organizationId],
        ),
        query(
          "SELECT * FROM custom_services WHERE organization_id=$1 ORDER BY created_at",
          [s.organizationId],
        ),
        query(
          "SELECT id,project_id,description,amount_kobo,status,due_on,paid_at,reference,authorization_url FROM custom_invoices WHERE organization_id=$1 ORDER BY due_on DESC LIMIT 100",
          [s.organizationId],
        ),
        query(
          "SELECT * FROM custom_requests WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100",
          [s.organizationId],
        ),
        query(
          "SELECT pilot_ready,activated_at FROM custom_clients WHERE organization_id=$1",
          [s.organizationId],
        ),
      ],
    );
    return {
      ok: true as const,
      data: {
        projects,
        services,
        invoices,
        requests,
        client: clients[0] || null,
      },
    };
  } catch (e) {
    return fail(e);
  }
}
export async function customAdminAction() {
  try {
    await requireAdminCapability("manage_custom");
    const [
      clients,
      projects,
      services,
      invoices,
      requests,
      audits,
      invitations,
    ] = await Promise.all([
      query(
        "SELECT c.*,o.name,u.email,u.name AS owner_name FROM custom_clients c JOIN organizations o ON o.id=c.organization_id JOIN users u ON u.id=c.user_id ORDER BY c.created_at DESC",
      ),
      query(
        "SELECT id,organization_id,name,website_url,status,cms_url,cms_tested_at,analytics_url,description,revision,domain_asset_id,deployment_provider,vercel_project_ref,github_repository_ref,internal_notes,maintenance_agreement,email_service_id,cms_fields,cms_scopes FROM custom_projects ORDER BY created_at DESC",
      ),
      query("SELECT * FROM custom_services ORDER BY created_at DESC"),
      query("SELECT * FROM custom_invoices ORDER BY created_at DESC LIMIT 150"),
      query("SELECT * FROM custom_requests ORDER BY created_at DESC LIMIT 100"),
      query("SELECT * FROM custom_audit ORDER BY id DESC LIMIT 100"),
      query(
        "SELECT id,organization_id,expires_at,used_at,sent_at,created_at,accepted_at,revoked_at FROM custom_invitations ORDER BY created_at DESC LIMIT 150",
      ),
    ]);
    return {
      ok: true as const,
      data: {
        clients,
        projects,
        services,
        invoices,
        requests,
        audit: audits,
        invitations,
      },
    };
  } catch (e) {
    return fail(e);
  }
}
export async function createCustomClientAction(input: {
  name: string;
  email: string;
  organizationId?: string;
}) {
  try {
    const a = await requireAdminCapability("manage_custom");
    const name = text(input.name);
    const email = text(input.email, 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw Error("Enter a valid customer email.");
    let user = await findUserByEmail(email),
      org = "",
      activation = false;
    if (user) {
      const rows = await query(
        "SELECT organization_id FROM organization_members WHERE user_id=$1 AND role='owner' AND active=true",
        [user.id],
      );
      const selected = input.organizationId
        ? rows.find((r) => r.organization_id === id(input.organizationId))
        : rows.length === 1
          ? rows[0]
          : null;
      if (!selected)
        throw Error(
          "Select the existing owner organization ID; accounts are never silently reassigned.",
        );
      org = String(selected.organization_id);
    } else {
      const created = await signup({
        name,
        email,
        password: token(),
        businessName: name,
        businessType: "general",
      });
      user = { id: created.userId, name, email };
      org = created.organizationId;
      activation = true;
    }
    await query(
      "INSERT INTO custom_clients(organization_id,user_id,activation_required,activated_at) VALUES($1,$2,$3,CASE WHEN $3=false THEN now() ELSE NULL END) ON CONFLICT(organization_id) DO NOTHING",
      [org, user.id, activation],
    );
    await audit(org, a.id, "CUSTOM_CLIENT_CONFIGURED");
    return { ok: true as const };
  } catch (e) {
    return fail(e);
  }
}
export async function saveCustomProjectAction(input: {
  id?: string;
  organizationId: string;
  name: string;
  websiteUrl: string;
  status: string;
  cmsUrl?: string;
  analyticsUrl?: string;
  description: string;
  revision?: number;
  domainAssetId?: string;
  deploymentProvider?: string;
  vercelProjectRef?: string;
  githubRepositoryRef?: string;
  internalNotes?: string;
  maintenanceAgreement?: string;
  emailServiceId?: string;
  cmsScopes?: string[];
  cmsFields?: string[];
}) {
  try {
    const a = await requireAdminCapability("manage_custom");
    const org = id(input.organizationId);
    const name = text(input.name),
      url = secureUrl(input.websiteUrl),
      cms = secureUrl(input.cmsUrl, true),
      analytics = secureUrl(input.analyticsUrl, true);
    if (!["CONFIGURING", "LIVE", "PAUSED", "ARCHIVED"].includes(input.status))
      throw Error("Select a project status.");
    const domain = input.domainAssetId ? id(input.domainAssetId) : null;
    if (
      domain &&
      !(
        await query(
          "SELECT 1 FROM domain_assets WHERE id=$1 AND organization_id=$2",
          [domain, org],
        )
      ).length
    )
      throw Error("Select a domain owned by this customer.");
    const desc = configurationText(text(input.description, 2000));
    const metadata: Record<string, unknown> = {};
    for (const [key, value, max] of [
      ["deployment_provider", input.deploymentProvider, 100],
      ["vercel_project_ref", input.vercelProjectRef, 200],
      ["internal_notes", input.internalNotes, 4000],
      ["maintenance_agreement", input.maintenanceAgreement, 2000],
    ] as const)
      if (value !== undefined) metadata[key] = configurationText(value, max);
    if (input.githubRepositoryRef !== undefined)
      metadata.github_repository_ref = repositoryReference(
        input.githubRepositoryRef,
      );
    if (input.cmsScopes !== undefined)
      metadata.cms_scopes = cmsScopes(input.cmsScopes);
    if (input.cmsFields !== undefined)
      metadata.cms_fields = cmsFields(input.cmsFields);
    if (input.emailServiceId !== undefined) {
      const emailId = input.emailServiceId ? id(input.emailServiceId) : null;
      if (
        emailId &&
        !(
          await query(
            "SELECT 1 FROM email_services WHERE id=$1 AND organization_id=$2",
            [emailId, org],
          )
        ).length
      )
        throw Error("Select a business email service owned by this client.");
      metadata.email_service_id = emailId;
    }
    const extra = JSON.stringify(metadata);
    const rows = input.id
      ? await query(
          `UPDATE custom_projects SET name=$3,website_url=$4,status=$5,cms_tested_at=CASE WHEN cms_url=$6 AND (NOT ($11::jsonb ? 'cms_fields') OR to_jsonb(cms_fields)=$11::jsonb->'cms_fields') AND (NOT ($11::jsonb ? 'cms_scopes') OR to_jsonb(cms_scopes)=$11::jsonb->'cms_scopes') THEN cms_tested_at ELSE NULL END,cms_url=$6,analytics_url=$7,description=$8,domain_asset_id=$9,revision=revision+1,updated_at=now()  ,deployment_provider=COALESCE($11::jsonb->>'deployment_provider',deployment_provider),vercel_project_ref=COALESCE($11::jsonb->>'vercel_project_ref',vercel_project_ref),github_repository_ref=COALESCE($11::jsonb->>'github_repository_ref',github_repository_ref),internal_notes=COALESCE($11::jsonb->>'internal_notes',internal_notes),maintenance_agreement=COALESCE($11::jsonb->>'maintenance_agreement',maintenance_agreement),email_service_id=CASE WHEN $11::jsonb ? 'email_service_id' THEN ($11::jsonb->>'email_service_id')::uuid ELSE email_service_id END,cms_fields=CASE WHEN $11::jsonb ? 'cms_fields' THEN ARRAY(SELECT jsonb_array_elements_text($11::jsonb->'cms_fields')) ELSE cms_fields END,cms_scopes=CASE WHEN $11::jsonb ? 'cms_scopes' THEN ARRAY(SELECT jsonb_array_elements_text($11::jsonb->'cms_scopes')) ELSE cms_scopes END WHERE id=$1 AND organization_id=$2 AND revision=$10 RETURNING id`,
          [
            id(input.id),
            org,
            name,
            url,
            input.status,
            cms,
            analytics,
            desc,
            domain,
            input.revision,
            extra,
          ],
        )
      : await query(
          `INSERT INTO custom_projects(organization_id,name,website_url,status,cms_url,analytics_url,description,domain_asset_id,deployment_provider,vercel_project_ref,github_repository_ref,internal_notes,maintenance_agreement,email_service_id,cms_fields,cms_scopes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9::jsonb->>'deployment_provider',''),COALESCE($9::jsonb->>'vercel_project_ref',''),COALESCE($9::jsonb->>'github_repository_ref',''),COALESCE($9::jsonb->>'internal_notes',''),COALESCE($9::jsonb->>'maintenance_agreement',''),($9::jsonb->>'email_service_id')::uuid,ARRAY(SELECT jsonb_array_elements_text(COALESCE($9::jsonb->'cms_fields','[]'::jsonb))),ARRAY(SELECT jsonb_array_elements_text(COALESCE($9::jsonb->'cms_scopes','["content:read"]'::jsonb)))) RETURNING id`,
          [org, name, url, input.status, cms, analytics, desc, domain, extra],
        );
    if (!rows.length)
      throw Error("Reload this project; another team member updated it.");
    await audit(org, a.id, "PROJECT_SAVED", {}, String(rows[0].id));
    return { ok: true as const };
  } catch (e) {
    return fail(e);
  }
}
export async function configureCustomCmsAction(
  projectId: string,
  confirmTested: boolean,
) {
  try {
    const a = await requireAdminCapability("manage_custom");
    const p = (
      await query("SELECT * FROM custom_projects WHERE id=$1", [id(projectId)])
    )[0];
    if (!p?.cms_url) throw Error("Configure the CMS callback URL first.");
    if (typeof confirmTested !== "boolean")
      throw Error("Select a CMS integration state.");
    if (confirmTested) {
      if (!Array.isArray(p.cms_fields) || !p.cms_fields.length)
        throw Error(
          "Configure the approved CMS fields before confirming the pilot.",
        );
      if (!p.cms_key_hash)
        throw Error(
          "Configure the integration key and complete the pilot before enabling CMS access.",
        );
      await query(
        "UPDATE custom_projects SET cms_tested_at=now(),revision=revision+1 WHERE id=$1",
        [p.id],
      );
      await audit(
        String(p.organization_id),
        a.id,
        "CMS_PILOT_CONFIRMED",
        {},
        String(p.id),
      );
      return { ok: true as const };
    }
    const key = token();
    await query(
      "UPDATE custom_projects SET cms_key_hash=$2,cms_tested_at=NULL,revision=revision+1 WHERE id=$1",
      [p.id, digest(key)],
    );
    await audit(
      String(p.organization_id),
      a.id,
      "CMS_KEY_ROTATED",
      {},
      String(p.id),
    );
    return { ok: true as const, data: { key } };
  } catch (e) {
    return fail(e);
  }
}
export async function setCustomReadyAction(orgId: string, ready: boolean) {
  try {
    const a = await requireAdminCapability("manage_custom");
    if (typeof ready !== "boolean") throw Error("Select a readiness state.");
    const rows = await query(
      `UPDATE custom_clients c SET pilot_ready=$2 WHERE organization_id=$1 AND($2=false OR EXISTS(SELECT 1 FROM custom_projects p WHERE p.organization_id=c.organization_id AND p.status='LIVE')) RETURNING organization_id`,
      [id(orgId), ready],
    );
    if (!rows.length)
      throw Error(
        "Configure and test at least one live project before marking the client ready.",
      );
    await audit(orgId, a.id, ready ? "PILOT_READY" : "PILOT_DISABLED");
    return { ok: true as const };
  } catch (e) {
    return fail(e);
  }
}
export async function sendCustomInviteAction(orgId: string) {
  try {
    const a = await requireAdminCapability("manage_custom");
    const org = id(orgId);
    await rateLimit(query, org, "custom-invite", 3, 3600);
    const c = (
      await query(
        `SELECT c.*,u.email,o.name FROM custom_clients c JOIN users u ON u.id=c.user_id JOIN organizations o ON o.id=c.organization_id WHERE c.organization_id=$1 AND c.pilot_ready=true AND EXISTS(SELECT 1 FROM custom_projects p WHERE p.organization_id=c.organization_id AND p.status='LIVE')`,
        [org],
      )
    )[0];
    if (!c)
      throw Error(
        "Configure the client dashboard and mark the pilot ready before inviting.",
      );
    const raw = token();
    const inserted = await query(
      `WITH invalidated AS(UPDATE custom_invitations SET used_at=now(),revoked_at=now() WHERE organization_id=$1 AND used_at IS NULL) INSERT INTO custom_invitations(organization_id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '48 hours') RETURNING id`,
      [org, c.user_id, digest(raw)],
    );
    const base =
      process.env.NEXT_PUBLIC_APP_URL || "https://business.jktl.com.ng";
    const result = await sendCustomInvitationEmail({
      to: String(c.email),
      name: String(c.name),
      url: `${base}/custom-activate?token=${raw}`,
    });
    if (!result.ok) {
      await query(
        "UPDATE custom_invitations SET used_at=now(),revoked_at=now() WHERE id=$1",
        [inserted[0].id],
      );
      throw Error(
        "Email delivery failed. Check transactional email settings and resend.",
      );
    }
    await query("UPDATE custom_invitations SET sent_at=now() WHERE id=$1", [
      inserted[0].id,
    ]);
    await audit(org, a.id, "INVITATION_SENT");
    return { ok: true as const };
  } catch (e) {
    return fail(e);
  }
}
export async function inspectCustomInviteAction(raw: string) {
  try {
    if (!/^[a-f0-9]{64}$/.test(raw))
      throw Error("Invitation is invalid or expired.");
    const rows = await query(
      `SELECT c.activation_required,o.name FROM custom_invitations i JOIN custom_clients c ON c.organization_id=i.organization_id JOIN organizations o ON o.id=c.organization_id WHERE i.token_hash=$1 AND i.used_at IS NULL AND i.expires_at>now() AND c.pilot_ready=true`,
      [digest(raw)],
    );
    if (!rows.length) throw Error("Invitation is invalid or expired.");
    return { ok: true as const, data: rows[0] };
  } catch (e) {
    return fail(e);
  }
}
export async function activateCustomInviteAction(
  raw: string,
  password: string,
) {
  try {
    if (!/^[a-f0-9]{64}$/.test(raw))
      throw Error("Invitation is invalid or expired.");
    const c = (
      await query(
        `SELECT c.* FROM custom_invitations i JOIN custom_clients c ON c.organization_id=i.organization_id WHERE i.token_hash=$1 AND i.used_at IS NULL AND i.expires_at>now() AND c.pilot_ready=true`,
        [digest(raw)],
      )
    )[0];
    if (!c) throw Error("Invitation is invalid or expired.");
    await rateLimit(
      query,
      String(c.organization_id),
      "custom-activate",
      10,
      3600,
    );
    let hash: string | null = null;
    if (c.activation_required) {
      if (
        typeof password !== "string" ||
        password.length < 12 ||
        Buffer.byteLength(password, "utf8") > 72
      )
        throw Error(
          "Use at least 12 characters and at most 72 UTF-8 bytes for your password.",
        );
      hash = await hashPassword(password);
    } else {
      const s = await getSession();
      if (
        !s ||
        s.userId !== c.user_id ||
        s.organizationId !== c.organization_id
      )
        throw Error(
          "Existing account holders must sign in to the invited account first.",
        );
    }
    const rows = await query(
      `WITH consumed AS(UPDATE custom_invitations i SET used_at=now(),accepted_at=now() FROM custom_clients c WHERE i.token_hash=$1 AND i.used_at IS NULL AND i.expires_at>now() AND c.organization_id=i.organization_id AND c.pilot_ready=true AND EXISTS(SELECT 1 FROM custom_projects p WHERE p.organization_id=c.organization_id AND p.status='LIVE') RETURNING i.*),updated AS(UPDATE users u SET password_hash=CASE WHEN c.activation_required AND $2::text IS NOT NULL THEN $2 ELSE u.password_hash END FROM consumed i,custom_clients c WHERE u.id=i.user_id AND c.organization_id=i.organization_id RETURNING u.id),activated AS(UPDATE custom_clients c SET activation_required=false,activated_at=now() FROM consumed i WHERE c.organization_id=i.organization_id RETURNING c.organization_id) INSERT INTO custom_audit(organization_id,actor_id,event) SELECT organization_id,user_id::text,'INVITATION_ACCEPTED' FROM consumed RETURNING id`,
      [digest(raw), hash],
    );
    if (!rows.length) throw Error("Invitation is invalid or already used.");
    return { ok: true as const };
  } catch (e) {
    return fail(e);
  }
}
export async function saveCustomServiceAction(input: {
  projectId: string;
  name: string;
  category: string;
  description: string;
  amountKobo: number;
  discountKobo: number;
  interval: string;
  startsOn: string;
}) {
  try {
    const a = await requireAdminCapability("manage_custom");
    const p = (
      await query("SELECT * FROM custom_projects WHERE id=$1", [
        id(input.projectId),
      ])
    )[0];
    if (!p) throw Error("Project not found.");
    const price = amount(input.amountKobo),
      discount = Number(input.discountKobo);
    if (!Number.isSafeInteger(discount) || discount < 0 || discount >= price)
      throw Error("Enter a discount smaller than the service price.");
    if (
      !["HOSTING", "MAINTENANCE", "EMAIL", "DEVELOPMENT", "OTHER"].includes(
        input.category,
      ) ||
      !["MONTHLY", "ANNUAL", "ONCE"].includes(input.interval)
    )
      throw Error("Select a valid service and interval.");
    const starts = date(input.startsOn);
    const rows = await query(
      "INSERT INTO custom_services(project_id,organization_id,name,category,description,amount_kobo,discount_kobo,interval,starts_on,next_due_on) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) RETURNING id",
      [
        p.id,
        p.organization_id,
        text(input.name),
        input.category,
        text(input.description, 2000),
        price,
        discount,
        input.interval,
        starts,
      ],
    );
    await audit(
      String(p.organization_id),
      a.id,
      "SERVICE_PROPOSED",
      { service: rows[0].id },
      String(p.id),
    );
    return { ok: true as const };
  } catch (e) {
    return fail(e);
  }
}
export async function acceptCustomServiceAction(
  serviceId: string,
  revision: number,
  consent: boolean,
) {
  try {
    const s = await owner();
    if (consent !== true)
      throw Error("Read and accept the service agreement first.");
    const rows = await query(
      `WITH accepted AS(UPDATE custom_services s SET status='ACTIVE',accepted_at=now(),accepted_by=$3,revision=revision+1 FROM custom_clients c WHERE s.id=$1 AND s.organization_id=$2 AND s.revision=$4 AND s.status='PROPOSED' AND c.organization_id=s.organization_id AND c.pilot_ready=true AND c.activated_at IS NOT NULL RETURNING s.*) INSERT INTO custom_audit(organization_id,project_id,actor_id,event,detail) SELECT organization_id,project_id,$3::text,'SERVICE_ACCEPTED',jsonb_build_object('service',id,'amountKobo',amount_kobo,'discountKobo',discount_kobo,'interval',interval,'automaticCharging',false) FROM accepted RETURNING id`,
      [id(serviceId), s.organizationId, s.userId, revision],
    );
    if (!rows.length)
      throw Error("Reload the current service agreement before accepting.");
    await generateInvoices();
    return { ok: true as const };
  } catch (e) {
    return fail(e);
  }
}
export async function changeCustomServiceAction(
  serviceId: string,
  status: string,
) {
  try {
    const a = await requireAdminCapability("manage_custom");
    if (!["PAUSED", "CANCELLED"].includes(status))
      throw Error("Select pause or cancel.");
    const rows = await query(
      "UPDATE custom_services SET status=$2,revision=revision+1 WHERE id=$1 RETURNING *",
      [id(serviceId), status],
    );
    if (!rows.length) throw Error("No service found.");
    await audit(
      String(rows[0].organization_id),
      a.id,
      "SERVICE_" + status,
      { service: serviceId },
      String(rows[0].project_id),
    );
    return { ok: true as const };
  } catch (e) {
    return fail(e);
  }
}
export async function payCustomInvoiceAction(invoiceId: string) {
  try {
    const s = await owner();
    await rateLimit(query, s.organizationId, "custom-pay", 6, 60);
    return {
      ok: true as const,
      data: {
        url: await initializeInvoice(id(invoiceId), s.organizationId, s.userId),
      },
    };
  } catch (e) {
    return fail(e);
  }
}
export async function verifyCustomPaymentAction(reference: string) {
  try {
    const s = await owner();
    await rateLimit(query, s.organizationId, "custom-verify", 10, 60);
    if (
      typeof reference !== "string" ||
      reference.length > 100 ||
      !(
        await query(
          "SELECT 1 FROM custom_invoices WHERE organization_id=$1 AND reference=$2",
          [s.organizationId, reference],
        )
      ).length
    )
      throw Error("Payment not found for this account.");
    await verifyInvoice(reference);
    return { ok: true as const };
  } catch (e) {
    return fail(e);
  }
}
export async function createCustomRequestAction(
  projectId: string,
  kind: string,
  message: string,
) {
  try {
    const s = await owner();
    await rateLimit(query, s.organizationId, "custom-support", 10, 3600);
    if (!["CONTENT", "FIX", "DEVELOPMENT", "EMAIL", "SUPPORT"].includes(kind))
      throw Error("Select a support category.");
    const categories: Record<string, string> = {
      CONTENT: "WEBSITE_CONTENT",
      FIX: "WEBSITE_TECHNICAL",
      DEVELOPMENT: "FEATURE_REQUEST",
      EMAIL: "EMAIL",
      SUPPORT: "WEBSITE_TECHNICAL",
    };
    const caseId = await createCase({
      subject: "Custom project: " + kind,
      message: text(message, 3000),
      customProjectId: id(projectId),
      projectCategory: categories[kind],
    });
    await audit(
      s.organizationId,
      s.userId,
      "PROJECT_SUPPORT_LINKED",
      { case: caseId },
      projectId,
    );
    after(() => processSupportNotifications());
    return { ok: true as const };
  } catch (e) {
    return fail(e);
  }
}
export async function replyCustomRequestAction(
  requestId: string,
  status: string,
  reply: string,
) {
  try {
    const a = await requireAdminCapability("manage_custom");
    if (!["PROCESSING", "COMPLETED", "DECLINED"].includes(status))
      throw Error("Select a request status.");
    const rows = await query(
      "UPDATE custom_requests SET status=$2,reply=$3,updated_at=now() WHERE id=$1 RETURNING *",
      [id(requestId), status, text(reply, 4000)],
    );
    if (!rows.length) throw Error("No support request found.");
    await audit(
      String(rows[0].organization_id),
      a.id,
      "SUPPORT_UPDATED",
      { request: requestId, status },
      String(rows[0].project_id),
    );
    return { ok: true as const };
  } catch (e) {
    return fail(e);
  }
}
export async function openCustomCmsAction(projectId: string) {
  try {
    const s = await owner();
    await rateLimit(query, s.organizationId, "custom-cms", 20, 60);
    const p = (
      await query(
        `SELECT p.* FROM custom_projects p JOIN custom_clients c ON c.organization_id=p.organization_id WHERE p.id=$1 AND p.organization_id=$2 AND p.status='LIVE' AND p.cms_tested_at IS NOT NULL AND p.cms_key_hash<>'' AND c.pilot_ready=true AND c.activated_at IS NOT NULL AND c.user_id=$3`,
        [id(projectId), s.organizationId, s.userId],
      )
    )[0];
    if (!p)
      throw Error(
        "This CMS integration is not ready. Request a content update through Support.",
      );
    const raw = token();
    await query(
      "INSERT INTO custom_cms_grants(token_hash,project_id,organization_id,user_id,expires_at,scopes) VALUES($1,$2,$3,$4,now()+interval '90 seconds',$5::text[])",
      [digest(raw), p.id, s.organizationId, s.userId, p.cms_scopes],
    );
    await audit(s.organizationId, s.userId, "CMS_LAUNCH", {}, projectId);
    const url = new URL(String(p.cms_url));
    url.searchParams.set("jktl_code", raw);
    url.searchParams.set("jktl_project", projectId);
    return { ok: true as const, data: { url: url.toString() } };
  } catch (e) {
    return fail(e);
  }
}
