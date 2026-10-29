import {
  beautyMetadata,
  publicWebsiteBase,
  publicWebsiteOrigin,
  beautyStructuredData,
} from "@/lib/beauty/public-pages";
import { cache } from "react";
import type { Metadata } from "next";
import { getPublicSiteBySubdomain } from "@/lib/db/public";
import { publicSiteAssistant } from "@/lib/public-site-assistant";
import { isProspectOrganization } from "@/lib/db/prospects";
import { previewNotice } from "@/lib/prospects/site-builder";
import { PublicSiteView } from "@/components/public-site/public-site-view";

export const dynamic = "force-dynamic";

// `generateMetadata` and the page component both need this lookup; `cache()`
// dedupes them into a single query per request instead of hitting Postgres
// twice for the same page load.
const getSite = cache((subdomain: string) =>
  getPublicSiteBySubdomain(subdomain),
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}): Promise<Metadata> {
  const { subdomain } = await params;
  const site = await getSite(subdomain.toLowerCase());
  if (!site) return { title: "Site not found — JKTL Business" };

  if (site.profile.websiteDocument?.beauty?.version === 2)
    return beautyMetadata(subdomain, "");
  // A site built for a prospect is a preview: it must not be indexed, or it
  // could outrank the website the business actually owns.
  const isProspect = await isProspectOrganization(site.profile.organizationId);

  return {
    title: site.profile.websiteDocument?.seoTitle || site.profile.displayName,
    description:
      site.profile.websiteDocument?.seoDescription ||
      site.profile.tagline ||
      `Book with ${site.profile.displayName}`,
    alternates: {
      canonical: `https://${site.profile.customDomainVerified && site.profile.customDomain ? site.profile.customDomain : `${site.profile.subdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN || "jktl.com.ng"}`}`,
    },
    openGraph: {
      title: site.profile.websiteDocument?.seoTitle || site.profile.displayName,
      description:
        site.profile.websiteDocument?.seoDescription || site.profile.tagline,
      siteName: site.profile.displayName,
    },
    ...(isProspect ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function PublicSitePage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  const site = await getSite(subdomain.toLowerCase());

  if (!site) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-paper px-6 text-center">
        <h1 className="font-display text-xl font-semibold text-ink">
          This site isn&apos;t available
        </h1>
        <p className="max-w-sm text-sm text-ink-muted">
          It may not be published yet, or the address is incorrect. If this is
          your business, sign in to JKTL Business and publish your site from
          Website settings.
        </p>
      </div>
    );
  }

  // The website's AI chatbot is only offered when the business actually has
  // the receptionist switched on. Its greeting and pack are resolved here
  // rather than in the browser, so what a visitor sees first matches what the
  // agent is allowed to say for this vertical.
  const [aiAssistant, isProspect] = await Promise.all([
    publicSiteAssistant(site.profile),
    isProspectOrganization(site.profile.organizationId),
  ]);

  return (
    <>
      {site.profile.websiteDocument?.beauty && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              beautyStructuredData(
                site.profile.websiteDocument,
                publicWebsiteOrigin(site.profile),
                "",
                site.profile,
              ),
            ).replace(/</g, "\\u003c"),
          }}
        />
      )}
      <PublicSiteView
        siteBasePath={
          site.profile.websiteDocument?.beauty
            ? await publicWebsiteBase(subdomain)
            : undefined
        }
        profile={site.profile}
        services={site.services}
        products={site.products}
        testimonials={site.testimonials}
        subdomain={subdomain.toLowerCase()}
        mode="live"
        aiAssistant={aiAssistant}
        previewNotice={isProspect ? previewNotice() : undefined}
      />
    </>
  );
}
