import { publicSiteAssistant } from "@/lib/public-site-assistant";
import { notFound } from "next/navigation";
import { PublicSiteView } from "@/components/public-site/public-site-view";
import { beautyPagePaths } from "@/lib/website-templates";
import {
  getBeautySite,
  beautyMetadata,
  publicWebsiteBase,
  publicWebsiteOrigin,
  beautyStructuredData,
} from "@/lib/beauty/public-pages";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ subdomain: string; path: string[] }>;
}) {
  const p = await params;
  return beautyMetadata(p.subdomain, p.path.join("/"));
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ subdomain: string; path: string[] }>;
  searchParams: Promise<{ service?: string }>;
}) {
  const { subdomain, path: segments } = await params,
    path = segments.join("/");
  const { site, doc } = await getBeautySite(subdomain);
  if (!beautyPagePaths(doc).includes(path)) notFound();
  const structured = beautyStructuredData(
    doc,
    publicWebsiteOrigin(site.profile),
    path,
    site.profile,
  );
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structured).replace(/</g, "\\u003c"),
        }}
      />
      <PublicSiteView
        profile={site.profile}
        services={site.services}
        products={site.products}
        testimonials={site.testimonials}
        subdomain={subdomain.toLowerCase()}
        mode="live"
        aiAssistant={await publicSiteAssistant(site.profile)}
        pagePath={path}
        siteBasePath={await publicWebsiteBase(subdomain)}
        initialServiceSlug={(await searchParams).service}
      />
    </>
  );
}
