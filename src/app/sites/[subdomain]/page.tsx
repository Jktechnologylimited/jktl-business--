import { cache } from "react";
import type { Metadata } from "next";
import { getPublicSiteBySubdomain } from "@/lib/db/public";
import { PublicSiteView } from "@/components/public-site/public-site-view";

export const dynamic = "force-dynamic";

// `generateMetadata` and the page component both need this lookup; `cache()`
// dedupes them into a single query per request instead of hitting Postgres
// twice for the same page load.
const getSite = cache((subdomain: string) => getPublicSiteBySubdomain(subdomain));

export async function generateMetadata({ params }: { params: Promise<{ subdomain: string }> }): Promise<Metadata> {
  const { subdomain } = await params;
  const site = await getSite(subdomain.toLowerCase());
  if (!site) return { title: "Site not found — JKTL Business" };
  return {
    title: site.profile.displayName,
    description: site.profile.tagline || `Book with ${site.profile.displayName}`,
  };
}

export default async function PublicSitePage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = await params;
  const site = await getSite(subdomain.toLowerCase());

  if (!site) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-paper px-6 text-center">
        <h1 className="font-display text-xl font-semibold text-ink">This site isn&apos;t available</h1>
        <p className="max-w-sm text-sm text-ink-muted">
          It may not be published yet, or the address is incorrect. If this is your business, sign in to JKTL Business and publish your site
          from Website settings.
        </p>
      </div>
    );
  }

  return (
    <PublicSiteView
      profile={site.profile}
      services={site.services}
      products={site.products}
      testimonials={site.testimonials}
      subdomain={subdomain.toLowerCase()}
      mode="live"
    />
  );
}
