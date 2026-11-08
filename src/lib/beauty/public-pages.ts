import { cache } from "react";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicSiteBySubdomain } from "@/lib/db/public";
import { isProspectOrganization } from "@/lib/db/prospects";
import {
  websitePageMeta,
  getWebsiteTemplate,
  websitePagePaths,
  parseWebsiteDocument,
} from "@/lib/website-templates";
function templateSite(
  site: Awaited<ReturnType<typeof getPublicSiteBySubdomain>>,
) {
  if (!site?.profile.published) notFound();
  const template = getWebsiteTemplate(site.profile.websiteTemplateId);
  if (!template || !site.profile.websiteDocument) notFound();
  let doc;
  try {
    doc = parseWebsiteDocument(site.profile.websiteDocument);
  } catch {
    notFound();
  }
  return { site, doc, template };
}
export const getBeautySite = cache(async (subdomain: string) =>
  templateSite(await getPublicSiteBySubdomain(subdomain.toLowerCase())),
);
export function publicWebsiteOrigin(profile: {
  customDomainVerified: boolean;
  customDomain: string;
  subdomain: string;
}) {
  const host =
    profile.customDomainVerified && profile.customDomain
      ? profile.customDomain
      : `${profile.subdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN || "jktl.com.ng"}`;
  if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(host))
    throw Error("Invalid published host");
  return `https://${host}`;
}
export async function publicWebsiteBase(subdomain: string) {
  const host =
    (await headers()).get("host")?.split(":")[0]?.toLowerCase() || "";
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "jktl.com.ng";
  return [
    "localhost",
    "127.0.0.1",
    root,
    "business." + root,
    "app." + root,
  ].includes(host)
    ? `/sites/${subdomain}`
    : "";
}
export async function beautyMetadata(
  subdomain: string,
  path: string,
  loadedSite?: Awaited<ReturnType<typeof getPublicSiteBySubdomain>>,
): Promise<Metadata> {
  const { site, doc, template } = loadedSite
    ? templateSite(loadedSite)
    : await getBeautySite(subdomain);
  if (!websitePagePaths(template, doc).includes(path)) notFound();
  const meta = websitePageMeta(template, doc, path),
    url = publicWebsiteOrigin(site.profile) + "/" + path;
  const title = meta.title.includes(doc.brandName)
    ? meta.title
    : `${meta.title} | ${doc.brandName}`;
  const preview = await isProspectOrganization(site.profile.organizationId);
  return {
    title: { absolute: title },
    description: meta.description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: meta.description,
      url,
      siteName: doc.brandName,
      type: "website",
      images: [
        {
          url: new URL(doc.heroImage, publicWebsiteOrigin(site.profile)).href,
          alt: doc.brandName,
        },
      ],
    },
    ...(preview ? { robots: { index: false, follow: false } } : {}),
  };
}
export function beautyStructuredData(
  doc: ReturnType<typeof parseWebsiteDocument>,
  origin: string,
  path: string,
  profile: {
    phone: string;
    email: string;
    address: string;
    city: string;
    state: string;
    websiteTemplateId?: string | null;
  },
) {
  const template = getWebsiteTemplate(profile.websiteTemplateId);
  const b = doc.beauty,
    details = b?.contact || { phone: "", email: "", address: "" };
  return {
    "@context": "https://schema.org",
    "@type":
      doc.design === "legal"
        ? "LegalService"
        : doc.beauty
          ? "HairSalon"
          : doc.design === "jewellery"
            ? "JewelryStore"
            : doc.design === "dressmaker"
              ? "ClothingStore"
              : "Organization",
    name: doc.brandName,
    "@id":
      origin +
      (doc.design === "legal"
        ? "/#legal-practice"
        : doc.beauty
          ? "/#salon"
          : "/#business"),
    url: origin,
    mainEntityOfPage: origin + "/" + path,
    description: template
      ? websitePageMeta(template, doc, path).description
      : doc.seoDescription || doc.intro,
    image: new URL(doc.heroImage, origin).href,
    ...(!(doc.design === "legal" ||
    doc.design === "dressmaker" ||
    doc.design === "jewellery"
      ? doc.demoContent
      : b?.demoContent) &&
    (details.address || profile.address)
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: details.address || profile.address,
            addressLocality: profile.city,
            addressRegion: profile.state,
            addressCountry: "NG",
          },
        }
      : {}),
    ...(details.phone || profile.phone
      ? { telephone: details.phone || profile.phone }
      : {}),
    ...(details.email || profile.email
      ? { email: details.email || profile.email }
      : {}),
  };
}
