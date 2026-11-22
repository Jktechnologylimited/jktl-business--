import test from "node:test";
import assert from "node:assert/strict";
import { load } from "./fixtures/lifecycle-db.mjs";

const catalog = load("src/lib/website-templates.ts");
const sites = new Map();
let assistantCalls = 0;
function notFound() { const error = Error("Not found"); error.digest = "NEXT_HTTP_ERROR_FALLBACK;404"; throw error; }
const dependencies = {
  "react": { cache: fn => fn },
  "next/navigation": { notFound },
  "next/headers": { headers: async () => new Headers({ host: "localhost:3318" }) },
  "@/lib/db/public": { getPublicSiteBySubdomain: async slug => sites.get(slug) || null },
  "@/lib/db/prospects": { isProspectOrganization: async () => false },
  "@/lib/prospects/site-builder": { previewNotice: () => null },
  "@/lib/website-templates": catalog,
  "@/lib/public-site-assistant": { publicSiteAssistant: async () => { assistantCalls++; return null; } },
  "@/components/public-site/public-site-view": { PublicSiteView: () => null },
};
const helpers = load("src/lib/beauty/public-pages.ts", dependencies);
const page = load("src/app/sites/[subdomain]/page.tsx", { ...dependencies, "@/lib/beauty/public-pages": helpers });
const route = subdomain => ({ params: Promise.resolve({ subdomain }) });
function site(subdomain, overrides = {}) {
  return { profile: { organizationId: subdomain, subdomain, displayName: "Client " + subdomain, published: true, customDomainVerified: false, customDomain: "", websiteTemplateId: "", websiteDocument: null, ...overrides }, services: [], products: [], testimonials: [] };
}

test("missing and unpublished sites use Next's 404/noindex path before downstream account work", async () => {
  sites.clear(); assistantCalls = 0;
  sites.set("draft", site("draft", { published: false }));
  for (const slug of ["missing", "draft"]) {
    await assert.rejects(() => page.generateMetadata(route(slug)), error => error.digest === "NEXT_HTTP_ERROR_FALLBACK;404");
    await assert.rejects(() => page.default(route(slug)), error => error.digest === "NEXT_HTTP_ERROR_FALLBACK;404");
  }
  assert.equal(assistantCalls, 0);
});

test("published customer domains retain their own canonical and never canonicalize to JKTL Main", async () => {
  sites.clear();
  sites.set("one", site("one", { customDomainVerified: true, customDomain: "www.customer-one.example" }));
  sites.set("two", site("two", { customDomainVerified: false, customDomain: "unverified.example" }));
  assert.equal((await page.generateMetadata(route("one"))).alternates.canonical, "https://www.customer-one.example");
  assert.equal((await page.generateMetadata(route("two"))).alternates.canonical, "https://two.jktl.com.ng");
  await page.default(route("one"));
  await page.default(route("two"));
});

test("template customer canonicals, sitemap and robots use the verified customer domain", async () => {
  const draft = catalog.templateDraft("law-firm", "Customer One");
  sites.clear(); sites.set("template-one", site("template-one", { websiteTemplateId: "law-firm", websiteDocument: draft, customDomain: "customer-one.example", customDomainVerified: true }));
  for (const path of catalog.websitePagePaths(catalog.getWebsiteTemplate("law-firm"), draft)) {
    const metadata = await helpers.beautyMetadata("template-one", path);
    assert.equal(metadata.alternates.canonical, "https://customer-one.example/" + path);
    assert.ok(!metadata.alternates.canonical.includes("https://jktl.com.ng"));
  }
  const sitemap = load("src/app/sites/[subdomain]/sitemap.xml/route.ts", { ...dependencies, "@/lib/beauty/public-pages": helpers });
  const response = await sitemap.GET(new Request("https://customer-one.example/sitemap.xml"), route("template-one"));
  const xml = await response.text();
  assert.match(xml, /https:\/\/customer-one\.example/); assert.ok(!xml.includes("https://jktl.com.ng"));
  const robots = load("src/app/sites/[subdomain]/robots.txt/route.ts", { ...dependencies, "@/lib/beauty/public-pages": helpers });
  assert.match(await (await robots.GET(new Request("https://customer-one.example/robots.txt"), route("template-one"))).text(), /Sitemap: https:\/\/customer-one\.example\/sitemap.xml/);
});
