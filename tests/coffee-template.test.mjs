import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "./fixtures/lifecycle-db.mjs";
import * as catalog from "../src/lib/website-templates.ts";

const css = { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
const beauty = load("src/components/templates/BeautyWebsite.tsx", { "@/lib/website-templates": catalog, "./BeautyWebsite.module.css": css });
const { CoffeeWebsite } = load("src/components/templates/CoffeeWebsite.tsx", { "@/lib/website-templates": catalog, "./BeautyWebsite": beauty, "./CoffeeWebsite.module.css": css });
const template = catalog.getWebsiteTemplate("kora-coffee");

test("coffee is an editable single landing page and uses the customer's own branding", () => {
  assert.equal(template.kind, "landing");
  assert.equal(template.category, "Food & Hospitality");
  const doc = catalog.templateDraft(template.id, "Our Coffee House");
  assert.equal(doc.design, "coffee");
  assert.deepEqual(catalog.parseWebsiteDocument(doc), doc);
  assert.ok(!doc.aboutText.includes("Kora Coffee"));
  assert.ok(doc.seoTitle.includes(doc.brandName));
  assert.ok(doc.seoDescription.includes(doc.brandName));
  assert.equal(doc.beauty, undefined);
  doc.offerings[0].category = "Our seasonal menu";
  doc.offerings[0].price = "Owner-confirmed price";
  doc.offerings[0].slug = "our-seasonal-latte";
  doc.aboutImage = "https://example.test/our-team.jpg";
  assert.deepEqual(catalog.parseWebsiteDocument(doc), doc);
  assert.deepEqual(catalog.websitePagePaths(template, doc), [""]);
  assert.equal(catalog.templatePageKind(template), "landing");
  const invalid = structuredClone(doc);
  invalid.offerings[1].slug = invalid.offerings[0].slug;
  assert.throws(() => catalog.parseWebsiteDocument(invalid), /unique collection/);
  invalid.offerings[1].slug = "flat-white";
  invalid.heroImage = "/template-photos/coffee/../../secret.jpg";
  assert.throws(() => catalog.parseWebsiteDocument(invalid), /HTTPS/);
});

test("the coffee landing page has one server-rendered H1, real section links and an inline enquiry", () => {
  const doc = catalog.templateDraft(template.id);
  const paths = catalog.websitePagePaths(template, doc);
  const titles = new Set();
  const descriptions = new Set();
  for (const path of paths) {
    const html = renderToStaticMarkup(createElement(CoffeeWebsite, { template, document: doc, pagePath: path, preview: true, basePath: "/template-canvas/kora-coffee" }));
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, path);
    assert.ok(html.length > 5000, path);
    assert.match(html, /Sign in to JKTL Business/);
    assert.match(html, /\/login\?template=kora-coffee/);
    assert.doesNotMatch(html, /Order confirmed|Add to cart|wix\.com|webflow\.io|A NOTE TO THE STUDIO|\p{Emoji_Presentation}|\ufe0f/u);
    const meta = catalog.websitePageMeta(template, doc, path);
    assert.ok(meta.title.includes(doc.brandName));
    assert.ok(meta.description.length > 60);
    assert.ok(meta.description.length <= 160);
    titles.add(meta.title);
    descriptions.add(meta.description);
    assert.match(html, /data-page-kind="landing"/);
    assert.doesNotMatch(html, /href="\/template-canvas\/kora-coffee\//);
    for (const match of html.matchAll(/href="#([^"#]+)"/g)) assert.ok(html.includes('id="' + match[1] + '"'), match[0]);
    for (const section of ["home", "offerings", "about", "approach", "gallery", "questions", "contact"]) assert.ok(html.includes('id="' + section + '"'));

    if (path === "") {
      assert.match(html, /Preview form · no request will be submitted/);
      assert.match(html, /A NOTE TO THE COFFEE TEAM/);
      assert.match(html, /Orders, availability and prices are confirmed/);
    }
  }
  assert.equal(titles.size, paths.length);
  assert.equal(descriptions.size, paths.length);
});

test("coffee assets, font license and renderers are local and mirrored across both sites", () => {
  for (const [business, main] of [["src/lib/website-templates.ts", "lib/website-templates.ts"], ["src/components/templates/CoffeeWebsite.tsx", "components/templates/CoffeeWebsite.tsx"], ["src/components/templates/CoffeeWebsite.module.css", "components/templates/CoffeeWebsite.module.css"]]) {
    assert.equal(readFileSync(new URL("../" + business, import.meta.url), "utf8"), readFileSync(new URL("../../jktl-main/" + main, import.meta.url), "utf8"));
  }
  for (const image of [template.document.heroImage, template.document.aboutImage, ...template.document.gallery.map(item => item.src), ...template.document.offerings.map(item => item.image)]) {
    assert.ok(image.startsWith("/template-photos/"));
    assert.ok(existsSync(new URL("../public" + image, import.meta.url)), image);
    assert.ok(existsSync(new URL("../../jktl-main/public" + image, import.meta.url)), image);
  }
  for (const file of ["anton-latin.ttf", "anton-OFL.txt"]) assert.ok(existsSync(new URL("../public/template-fonts/" + file, import.meta.url)));
});

test("a published coffee landing page has its own canonical, cafe schema and one sitemap URL", async () => {
  const doc = catalog.templateDraft(template.id, "Client Coffee");
  doc.demoContent = false;
  const site = { profile: { organizationId: "org-a", published: true, websiteTemplateId: template.id, websiteDocument: doc, subdomain: "coffee", customDomain: "coffee.example.test", customDomainVerified: true, email: "", phone: "", address: "", city: "", state: "" } };
  const deps = { "react": { cache: fn => fn }, "next/headers": { headers: async () => new Headers({ host: "coffee.example.test" }) }, "next/navigation": { notFound: () => { throw Error("404"); } }, "@/lib/website-templates": catalog, "@/lib/db/public": { getPublicSiteBySubdomain: async () => site }, "@/lib/db/prospects": { isProspectOrganization: async () => false } };
  const helper = load("src/lib/beauty/public-pages.ts", deps);
  for (const path of catalog.websitePagePaths(template, doc)) {
    const meta = await helper.beautyMetadata("coffee", path);
    assert.equal(meta.alternates.canonical, "https://coffee.example.test/" + path);
  }
  const schema = helper.beautyStructuredData(doc, "https://coffee.example.test", "", site.profile);
  assert.equal(schema["@type"], "CafeOrCoffeeShop");
  assert.equal(schema.aggregateRating, undefined);
  assert.equal(schema.address, undefined);
  const { GET } = load("src/app/sites/[subdomain]/sitemap.xml/route.ts", { ...deps, "@/lib/beauty/public-pages": helper });
  const response = await GET(new Request("https://coffee.example.test/sitemap.xml"), { params: Promise.resolve({ subdomain: "coffee" }) });
  assert.equal(((await response.text()).match(/<loc>/g) || []).length, 1);
  await assert.rejects(() => helper.beautyMetadata("coffee", "menu"), /404/);
});

test("published coffee enquiries retain tenant scope and never create a paid booking", async () => {
  const writes = [], emails = [], bookings = [];
  let published = true;
  const { submitBeautyWebsiteRequestAction: submit } = load("src/lib/actions/public-website-request-actions.ts", {
    "next/headers": { headers: async () => new Headers({ "x-forwarded-for": "203.0.113.1" }) },
    "@/lib/website-templates": catalog,
    "@/lib/db/public": { getPublicSiteBySubdomain: async () => ({ profile: { published, organizationId: "actual-coffee-tenant", websiteTemplateId: template.id, websiteDocument: template.document }, services: [] }) },
    "@/lib/db/customers": { createCustomer: async (org, id, input) => writes.push({ org, id, input }) },
    "@/lib/db/organizations": { getOwnerEmail: async org => org === "actual-coffee-tenant" ? "owner@example.test" : "wrong@example.test" },
    "@/lib/actions/public-actions": { createPublicBookingAction: async (...args) => bookings.push(args) },
    "@/lib/email": { sendWebsiteRequestEmail: async input => emails.push(input) },
    "@/lib/support/service": { rate: async () => {} }
  });
  const input = { kind: "contact", organizationId: "attacker-tenant", name: "Preview Test", email: "visitor@example.test", phone: "+2348090000000", message: "Tell me about the house latte.", service: "", date: "", time: "", website: "" };
  assert.equal((await submit("coffee", input)).ok, true);
  assert.equal(writes[0].org, "actual-coffee-tenant");
  assert.equal(emails[0].to, "owner@example.test");
  assert.equal((await submit("coffee", { ...input, kind: "appointment" })).ok, false);
  assert.equal((await submit("coffee", { ...input, website: "bot" })).ok, false);
  assert.equal((await submit("coffee", { ...input, email: "invalid" })).ok, false);
  published = false;
  assert.equal((await submit("coffee", input)).ok, false);
  assert.equal(writes.length, 1);
  assert.equal(bookings.length, 0);
});

test("the shared renderer dispatches coffee without changing saved legacy templates", () => {
  const { TemplateWebsite } = load("src/components/templates/TemplateWebsite.tsx", { "@/lib/website-templates": catalog, "./CoffeeWebsite": { CoffeeWebsite }, "./BeautyWebsite": beauty, "./MedicalWebsite": { MedicalWebsite: () => null }, "./JewelleryWebsite": { JewelleryWebsite: () => null }, "./DressmakerWebsite": { DressmakerWebsite: () => null }, "./LegalWebsite": { LegalWebsite: () => null }, "./CosmeticsWebsite": { CosmeticsWebsite: () => null }, "./OccasionWebsite": { OccasionWebsite: () => null }, "./TattooWebsite": { TattooWebsite: () => null }, "./TemplateWebsite.module.css": css });
  const html = renderToStaticMarkup(createElement(TemplateWebsite, { template, document: template.document }));
  assert.match(html, /data-layout="coffee"/);
  assert.match(html, /data-page-kind="landing"/);
  const old = catalog.templateDraft("restaurant");
  assert.equal(old.design, undefined);
  assert.match(renderToStaticMarkup(createElement(TemplateWebsite, { template: catalog.getWebsiteTemplate("restaurant"), document: old })), /data-layout="hospitality"/);
});
