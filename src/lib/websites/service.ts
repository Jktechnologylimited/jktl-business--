import "server-only";
import { query } from "@/lib/custom/service";
import { requireSession } from "@/lib/session";
import { getBusinessProfile } from "@/lib/db/organizations";
import {
  addressSuggestions,
  websiteUrl,
  externalWebsiteUrl,
  type WebsiteCard,
} from "./model";
import {
  getWebsiteTemplate,
  templateDraft,
  parseWebsiteDocument,
} from "@/lib/website-templates";
import { subdomainFormatError } from "@/lib/subdomain";
import { authRateLimit } from "@/lib/security/auth-rate-limit";
export async function websiteAccount(write = false) {
  const s = await requireSession();
  const rows = await query(
    "SELECT role FROM organization_members WHERE organization_id=$1 AND user_id=$2 AND active=true",
    [s.organizationId, s.userId],
  );
  if (
    !rows[0] ||
    (write && !["owner", "manager"].includes(String(rows[0].role)))
  )
    throw Error("Only an owner or manager can manage websites.");
  return {
    ...s,
    canManage: ["owner", "manager"].includes(String(rows[0].role)),
  };
}
export async function websiteList() {
  const s = await websiteAccount();
  const primary = await getBusinessProfile(s.organizationId);
  const [sites, custom] = await Promise.all([
    query(
      "SELECT id,name,subdomain,published,template_id,revision FROM business_websites WHERE organization_id=$1 ORDER BY created_at DESC,id",
      [s.organizationId],
    ),
    query(
      "SELECT id,name,website_url,status FROM custom_projects WHERE organization_id=$1 AND billing_only=false ORDER BY created_at DESC",
      [s.organizationId],
    ),
  ]);
  const cards: WebsiteCard[] = [];
  if (primary && (primary.websiteTemplateId || primary.published))
    cards.push({
      id: "primary",
      kind: "primary",
      name: primary.displayName,
      subdomain: primary.subdomain,
      published: primary.published,
      templateId: primary.websiteTemplateId || "",
      url:
        primary.customDomainVerified && primary.customDomain
          ? externalWebsiteUrl("https://" + primary.customDomain) ||
            websiteUrl(primary.subdomain)
          : websiteUrl(primary.subdomain),
      editUrl: "/business/website/template",
      revision: primary.websiteRevision || 0,
    });
  for (const r of sites)
    cards.push({
      id: String(r.id),
      kind: "template",
      name: String(r.name),
      subdomain: String(r.subdomain),
      published: Boolean(r.published),
      templateId: String(r.template_id),
      url: websiteUrl(String(r.subdomain)),
      editUrl: "/business/website/template?site=" + r.id,
      revision: Number(r.revision),
    });
  for (const r of custom)
    cards.push({
      id: String(r.id),
      kind: "custom",
      name: String(r.name),
      subdomain: "",
      published: r.status === "LIVE",
      templateId: "",
      url: externalWebsiteUrl(r.website_url),
      editUrl: `/business/custom/${r.id}/portal`,
      revision: 0,
    });
  return { sites: cards, canManage: s.canManage };
}
export async function addressCheck(slug: string, exclude?: string) {
  const s = await websiteAccount();
  await authRateLimit(s.userId, "website-address-check", 60, 60);
  if (typeof slug !== "string" || slug.length > 100)
    throw Error("Choose a valid website address.");
  if (
    exclude &&
    exclude !== "primary" &&
    !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(exclude)
  )
    throw Error("Website not found.");
  slug = slug.trim().toLowerCase();
  const error = subdomainFormatError(slug);
  if (error) return { available: false, error, suggestions: [] as string[] };
  if (exclude && exclude !== "primary") {
    const own = await query(
      "SELECT 1 FROM business_websites WHERE id=$1 AND organization_id=$2",
      [exclude, s.organizationId],
    );
    if (!own.length) throw Error("Website not found.");
  }
  const names = addressSuggestions(slug),
    rows = await query(
      "SELECT subdomain,organization_id,site_id FROM website_subdomains WHERE subdomain=ANY($1::text[])",
      [[slug, ...names]],
    );
  const current = rows.find((r) => r.subdomain === slug);
  return {
    available:
      !current ||
      Boolean(
        exclude &&
        current.organization_id === s.organizationId &&
        (exclude === "primary"
          ? current.site_id === null
          : current.site_id === exclude),
      ),
    error: "",
    suggestions: names
      .filter((n) => n !== slug && !rows.some((r) => r.subdomain === n))
      .slice(0, 5),
  };
}
export async function createWebsite(input: {
  name: string;
  subdomain: string;
  templateId: string;
}) {
  const s = await websiteAccount(true);
  await authRateLimit(s.userId, "website-create", 10, 3600);
  if (
    typeof input.name !== "string" ||
    !input.name.trim() ||
    input.name.length > 160 ||
    typeof input.subdomain !== "string" ||
    !getWebsiteTemplate(input.templateId)
  )
    throw Error("Choose a website name, available address and template.");
  const slug = input.subdomain.trim().toLowerCase(),
    error = subdomainFormatError(slug);
  if (error) throw Error(error);
  const rows = await query(
    "INSERT INTO business_websites(organization_id,name,subdomain,template_id,document) VALUES($1,$2,$3,$4,$5::jsonb) RETURNING id",
    [
      s.organizationId,
      input.name.trim(),
      slug,
      input.templateId,
      JSON.stringify(templateDraft(input.templateId, input.name.trim())),
    ],
  );
  return String(rows[0].id);
}
export async function loadWebsite(id: string) {
  const s = await websiteAccount();
  return (
    (
      await query(
        "SELECT * FROM business_websites WHERE id=$1 AND organization_id=$2",
        [id, s.organizationId],
      )
    )[0] || null
  );
}
export async function saveWebsite(input: {
  id: string;
  templateId: string;
  document: unknown;
  revision: number;
  published: boolean;
}) {
  const s = await websiteAccount(true);
  if (
    !getWebsiteTemplate(input.templateId) ||
    !Number.isSafeInteger(input.revision) ||
    input.revision < 0 ||
    typeof input.published !== "boolean"
  )
    throw Error("Check the website version and template.");
  const doc = parseWebsiteDocument(input.document);
  const rows = await query(
    "UPDATE business_websites SET template_id=$1,document=$2::jsonb,revision=revision+1,published=$3,updated_at=now() WHERE id=$4 AND organization_id=$5 AND revision=$6 RETURNING *",
    [
      input.templateId,
      JSON.stringify(doc),
      input.published,
      input.id,
      s.organizationId,
      input.revision,
    ],
  );
  if (!rows[0])
    throw Error(
      "The website changed in another session. Reload before saving again.",
    );
  return rows[0];
}
