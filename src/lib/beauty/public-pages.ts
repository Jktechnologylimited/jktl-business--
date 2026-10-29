import { cache } from "react";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicSiteBySubdomain } from "@/lib/db/public";
import { isProspectOrganization } from "@/lib/db/prospects";
import {
  beautyPageMeta,
  beautyPagePaths,
  parseWebsiteDocument,
} from "@/lib/website-templates";
export const getBeautySite = cache(async (subdomain: string) => {
  const site = await getPublicSiteBySubdomain(subdomain.toLowerCase());
  if (!site?.profile.published) notFound();
  if (
    site.profile.websiteDocument?.beauty?.version !== 2 &&
    site.profile.websiteDocument?.design !== "legal"
  )
    notFound();
  let doc;
  try {
    doc = parseWebsiteDocument(site.profile.websiteDocument);
  } catch {
    notFound();
  }
  if (!doc.beauty && doc.design !== "legal") notFound();
  return { site, doc };
});
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
): Promise<Metadata> {
  const { site, doc } = await getBeautySite(subdomain);
  if (!beautyPagePaths(doc).includes(path)) notFound();
  const meta = beautyPageMeta(doc, path),
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
  },
) {
  const b = doc.beauty!,
    details = b?.contact || { phone: "", email: "", address: "" };
  return {
    "@context": "https://schema.org",
    "@type": doc.design === "legal" ? "LegalService" : "HairSalon",
    name: doc.brandName,
    "@id": origin + (doc.design === "legal" ? "/#legal-practice" : "/#salon"),
    url: origin,
    mainEntityOfPage: origin + "/" + path,
    description: beautyPageMeta(doc, path).description,
    image: new URL(doc.heroImage, origin).href,
    ...(!(doc.design === "legal" ? doc.demoContent : b.demoContent) &&
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
