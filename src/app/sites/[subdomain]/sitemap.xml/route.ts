import { getPublicSiteBySubdomain } from "@/lib/db/public";
import { isProspectOrganization } from "@/lib/db/prospects";
import { beautyPagePaths, parseWebsiteDocument } from "@/lib/website-templates";
import { publicWebsiteOrigin } from "@/lib/beauty/public-pages";
export const dynamic = "force-dynamic";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ subdomain: string }> },
) {
  const site = await getPublicSiteBySubdomain(
    (await params).subdomain.toLowerCase(),
  );
  if (
    !site?.profile.published ||
    (await isProspectOrganization(site.profile.organizationId))
  )
    return new Response("Not found", { status: 404 });
  const paths = site.profile.websiteDocument
    ? beautyPagePaths(parseWebsiteDocument(site.profile.websiteDocument))
    : [""];
  const origin = publicWebsiteOrigin(site.profile);
  const escape = (s: string) =>
    s.replace(
      /[<>&"']/g,
      (c) =>
        ({
          "<": "&lt;",
          ">": "&gt;",
          "&": "&amp;",
          '"': "&quot;",
          "'": "&apos;",
        })[c]!,
    );
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${escape(origin + "/" + path)}</loc></url>`).join("")}</urlset>`,
    {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public,max-age=300",
      },
    },
  );
}
