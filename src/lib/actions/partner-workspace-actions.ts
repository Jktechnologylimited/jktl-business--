"use server";
import { randomBytes, createHash } from "node:crypto";
import { query } from "@/lib/custom/service";
import { approvedPartner, workspace, product } from "@/lib/partners/access";
import {
  getWebsiteTemplate,
  parseWebsiteDocument,
} from "@/lib/website-templates";
import { saveTemplateDocument } from "@/lib/website-template-store";
import { rate } from "@/lib/support/service";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
function field(f: FormData, k: string, max = 200, required = false) {
  const v = String(f.get(k) || "").trim();
  if (v.length > max || (required && !v)) throw Error("Please check " + k);
  return v;
}
export async function createPartnerWorkspaceAction(f: FormData) {
  const p = await approvedPartner();
  await rate("workspace-create:" + p.id, 20);
  const name = field(f, "businessName", 160, true),
    email = field(f, "contactEmail", 254, true);
  if (!/^\S+@\S+\.\S+$/.test(email))
    throw Error("Valid contact email required");
  const services = f.getAll("services").map(String);
  for (const slug of services) await product(slug, "VIEW");
  const rows = await query(
    `WITH added AS(INSERT INTO partner_workspaces(partner_id,business_name,business_category,contact_name,contact_email,phone,country,preferred_domain,requirements,selected_services) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::text[]) RETURNING id) INSERT INTO distribution_audit(actor_id,event,affiliate_id,detail) SELECT $1,'WORKSPACE_CREATED',$1,jsonb_build_object('workspace',id) FROM added RETURNING detail`,
    [
      p.id,
      name,
      field(f, "category"),
      field(f, "contactName", 160, true),
      email,
      field(f, "phone", 40),
      field(f, "country", 80),
      field(f, "domain", 253),
      field(f, "requirements", 2000),
      services,
    ],
  );
  redirect(
    "/partners/workspace?id=" +
      String((rows[0].detail as { workspace: string }).workspace),
  );
}
export async function partnerWorkspaceDataAction(id: string) {
  const { w } = await workspace(id);
  const registry = await query(
    "SELECT slug,name,route,partner_mode,partner_actions FROM feature_registry WHERE partner_mode<>'UNAVAILABLE' ORDER BY category,name",
  );
  let website = null;
  if (w.organization_id) {
    const r = await query(
      `SELECT p.website_template_id,p.website_document,p.website_revision,p.published,p.subdomain FROM business_profiles p JOIN partner_client_access a ON a.organization_id=p.organization_id WHERE p.organization_id=$1 AND a.partner_id=$2 AND a.revoked_at IS NULL AND 'MANAGE_WEBSITE_CONTENT'=ANY(a.scopes)`,
      [w.organization_id, w.partner_id],
    );
    website = r[0] || null;
  }
  return { workspace: w, registry, website };
}
export async function savePartnerWebsiteAction(input: {
  id: string;
  templateId: string;
  document: unknown;
  revision: number;
  publish: boolean;
}) {
  try {
    const { p, w } = await workspace(input.id);
    await product("website-builder", "CONFIGURE");
    if (
      !getWebsiteTemplate(input.templateId) ||
      !Number.isInteger(input.revision) ||
      input.revision < 0 ||
      typeof input.publish !== "boolean"
    )
      throw Error("Invalid website selection");
    const document = parseWebsiteDocument(input.document);
    if (!w.organization_id) {
      if (input.publish) throw Error("Client must accept before publishing");
      const saved = await query(
        "UPDATE partner_workspaces SET template_id=$3,document=$4::jsonb,revision=revision+1 WHERE id=$1 AND partner_id=$2 AND revision=$5 AND organization_id IS NULL RETURNING revision",
        [
          w.id,
          p.id,
          input.templateId,
          JSON.stringify(document),
          input.revision,
        ],
      );
      if (!saved.length)
        throw Error("The draft changed. Reload before saving.");
      await query(
        "INSERT INTO distribution_audit(actor_id,event,affiliate_id,detail) VALUES($1,'WORKSPACE_DRAFT_SAVED',$1,jsonb_build_object('workspace',$2::text))",
        [p.id, w.id],
      );
      return { ok: true };
    }
    // Reuse the customer website save engine. The wrapped update locks and checks
    // the client grant and current partner/product state inside the same statement.
    const savedProfile = await saveTemplateDocument(
      async (sql, args) =>
        query(
          `WITH permitted AS(SELECT a.id FROM partner_client_access a JOIN affiliates p ON p.id=a.partner_id JOIN feature_registry f ON f.slug='website-builder' WHERE a.partner_id=$7 AND a.organization_id=$5 AND a.revoked_at IS NULL AND 'MANAGE_WEBSITE_CONTENT'=ANY(a.scopes) AND(NOT $4 OR 'PUBLISH_WEBSITE'=ANY(a.scopes)) AND p.status='active' AND p.programme='partner' AND p.partner_terms_confirmed=true AND f.partner_mode='SELF_SERVICE' AND 'CONFIGURE'=ANY(f.partner_actions) FOR UPDATE OF a),updated AS(${sql.replace("published=$4", "published=CASE WHEN $4 THEN true ELSE published END").replace("WHERE organization_id=$5", "WHERE EXISTS(SELECT 1 FROM permitted) AND organization_id=$5")}),logged AS(INSERT INTO distribution_audit(actor_id,event,affiliate_id,detail) SELECT $7,CASE WHEN $4 THEN 'PARTNER_WEBSITE_PUBLISHED' ELSE 'PARTNER_WEBSITE_SAVED' END,$7,jsonb_build_object('organization',organization_id,'revision',website_revision) FROM updated RETURNING id) SELECT updated.* FROM updated JOIN logged ON true`,
          [...args, p.id],
        ),
      {
        organizationId: String(w.organization_id),
        templateId: input.templateId,
        document,
        revision: input.revision,
        published: input.publish,
      },
    );
    revalidatePath("/sites/" + String(savedProfile.subdomain));
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error &&
        /^(The website changed|The draft changed|Client must accept|Invalid website|Please check|Images must|Choose valid|Website content|Unsupported website|This product action|Client access revoked)/.test(
          e.message,
        )
          ? e.message
          : "Unable to save website. Check current client permissions and reload before retrying.",
    };
  }
}
export async function inviteWorkspaceOwnerAction(id: string) {
  const { p, w } = await workspace(id);
  if (w.organization_id) throw Error("Workspace already claimed");
  const token = randomBytes(32).toString("hex");
  await query(
    "INSERT INTO partner_client_invitations(partner_id,token_hash,label,workspace_id) VALUES($1,$2,$3,$4)",
    [
      p.id,
      createHash("sha256").update(token).digest("hex"),
      w.business_name,
      w.id,
    ],
  );
  return {
    url: "https://business.jktl.com.ng/business/distribution?invite=" + token,
  };
}
export async function configurePartnerProductAction(f: FormData) {
  const { requireAdminCapability } = await import("@/lib/admin-session");
  const a = await requireAdminCapability("manage_team");
  const mode = field(f, "mode");
  const actions = f.getAll("actions").map(String);
  if (
    !["UNAVAILABLE", "SELF_SERVICE", "ASSISTED", "QUOTE"].includes(mode) ||
    actions.some(
      (v) =>
        ![
          "VIEW",
          "PREVIEW",
          "CONFIGURE",
          "MANAGE",
          "REQUEST_SETUP",
          "REQUEST_SUPPORT",
        ].includes(v),
    )
  )
    throw Error("Invalid capabilities");
  const slug = field(f, "slug");
  await query(
    `WITH changed AS(UPDATE feature_registry SET partner_mode=$2,partner_actions=$3::text[],revision=revision+1 WHERE slug=$1 RETURNING slug) INSERT INTO distribution_audit(actor_id,event,detail) SELECT $4,'PARTNER_PRODUCT_CONFIGURED',jsonb_build_object('slug',slug,'mode',$2::text,'actions',$3::text[]) FROM changed`,
    [slug, mode, actions, a.id],
  );
  revalidatePath("/admin/distribution/products");
}
