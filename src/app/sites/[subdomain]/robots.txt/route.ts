import { getPublicSiteBySubdomain } from "@/lib/db/public";
import { isProspectOrganization } from "@/lib/db/prospects";
import { publicWebsiteOrigin } from "@/lib/beauty/public-pages";
export const dynamic = "force-dynamic";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ subdomain: string }> },
) {
  const site = await getPublicSiteBySubdomain(
    (await params).subdomain.toLowerCase(),
  );
  if (!site?.profile.published)
    return new Response("User-agent: *\nDisallow: /\n", {
      headers: { "Content-Type": "text/plain" },
    });
  const preview = await isProspectOrganization(site.profile.organizationId);
  return new Response(
    preview
      ? "User-agent: *\nDisallow: /\n"
      : `User-agent: *\nAllow: /\nSitemap: ${publicWebsiteOrigin(site.profile)}/sitemap.xml\n`,
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public,max-age=300",
      },
    },
  );
}
