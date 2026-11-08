import { redirect } from "next/navigation";
import { loadWebsite } from "@/lib/websites/service";
import type { WebsiteDocument } from "@/lib/website-templates";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getBusinessProfile } from "@/lib/db/organizations";
import { getWebsiteTemplate } from "@/lib/website-templates";
import { TemplateEditor } from "@/components/templates/TemplateEditor";
export const dynamic = "force-dynamic";
export default async function TemplateEditorPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string; site?: string }>;
}) {
  const params = await searchParams;
  if (params.template && !getWebsiteTemplate(params.template)) notFound();
  const session = await getSession();
  let profile = session
    ? await getBusinessProfile(session.organizationId)
    : null;
  if (params.site) {
    if (!session) redirect("/login");
    if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(params.site))
      notFound();
    const site = await loadWebsite(params.site);
    if (!site || !profile) notFound();
    profile = {
      ...profile,
      id: String(site.id),
      displayName: String(site.name),
      subdomain: String(site.subdomain),
      customDomain: "",
      customDomainVerified: false,
      published: Boolean(site.published),
      websiteTemplateId: String(site.template_id),
      websiteDocument: site.document as WebsiteDocument,
      websiteRevision: Number(site.revision),
    };
  }
  const selected =
    getWebsiteTemplate(params.template)?.id ||
    profile?.websiteTemplateId ||
    "law-firm";
  return (
    <TemplateEditor
      key={`${profile?.id || "demo"}-${selected}`}
      initialProfile={profile}
      selectedId={selected}
      siteId={params.site}
    />
  );
}
