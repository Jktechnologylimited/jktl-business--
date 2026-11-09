import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as catalog from "../src/lib/website-templates.ts";
const require = createRequire(import.meta.url);
const css = {
  __esModule: true,
  default: new Proxy({}, { get: (_, key) => String(key) }),
};
function load(file, deps = {}) {
  const m = { exports: {} };
  new Function(
    "require",
    "module",
    "exports",
    ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText,
  )((n) => (n in deps ? deps[n] : require(n)), m, m.exports);
  return m.exports;
}
const common = {
  react: require("react"),
  "react/jsx-runtime": require("react/jsx-runtime"),
  "@/lib/website-templates": catalog,
};
const beauty = load("../src/components/templates/BeautyWebsite.tsx", {
  ...common,
  "./BeautyWebsite.module.css": css,
});
const { CosmeticsWebsite } = load(
  "../src/components/templates/CosmeticsWebsite.tsx",
  {
    ...common,
    "./BeautyWebsite": beauty,
    "./CosmeticsWebsite.module.css": css,
  },
);
const template = catalog.getWebsiteTemplate("velora-cosmetics");
test("cosmetics products, categories and personal branding round-trip without changing existing designs", () => {
  const d = catalog.templateDraft(template.id, "Our Beauty Boutique");
  assert.equal(d.design, "cosmetics");
  assert.deepEqual(catalog.parseWebsiteDocument(d), d);
  assert.equal(d.beauty, undefined);
  assert.equal(d.demoContent, true);
  assert.ok(d.seoDescription.includes(d.brandName));
  assert.ok(!d.seoDescription.includes(template.document.brandName));
  assert.ok(d.seoTitle.includes(d.brandName));
  assert.ok(!d.seoTitle.includes(template.document.brandName));
  assert.equal(catalog.websitePagePaths(template, d).length, 15);
  assert.equal(new Set(catalog.websitePagePaths(template, d)).size, 15);
  d.offerings[0].category = "Our Collection";
  d.offerings[0].price = "Owner-defined pricing";
  d.offerings[0].benefits = ["Owner-provided product detail"];
  d.gallery[0].category = "Our Collection";
  assert.deepEqual(catalog.parseWebsiteDocument(d), d);
  assert.ok(
    catalog.websitePagePaths(template, d).includes("shop/our-collection"),
  );
  const duplicate = structuredClone(d);
  duplicate.offerings[1].slug = duplicate.offerings[0].slug;
  assert.throws(
    () => catalog.parseWebsiteDocument(duplicate),
    /unique collection/,
  );
  const unsafe = structuredClone(d);
  unsafe.offerings[0].image = "javascript:alert(1)";
  assert.throws(() => catalog.parseWebsiteDocument(unsafe), /HTTPS/);
  assert.equal(
    catalog.getWebsiteTemplate("jewellery-luxe").document.design,
    "jewellery",
  );
});
test("all cosmetics pages have a single useful server-rendered heading and meaningful unique metadata", () => {
  const d = catalog.templateDraft(template.id),
    titles = new Set();
  for (const path of catalog.websitePagePaths(template, d)) {
    const html = renderToStaticMarkup(
      createElement(CosmeticsWebsite, {
        template,
        document: d,
        preview: true,
        pagePath: path,
        basePath: "/template-canvas/" + template.id,
      }),
    );
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, path);
    assert.ok(html.length > 4000);
    assert.doesNotMatch(
      html,
      /wix\.com|javascript:|Add to cart|Order confirmed/,
    );
    assert.match(html, /aria-label="Sign in to JKTL Business"/);
    assert.ok(html.includes("/login?template=velora-cosmetics"));
    const meta = catalog.websitePageMeta(template, d, path);
    assert.ok(meta.title.includes(d.brandName));
    assert.ok(meta.description.length > 60);
    titles.add(meta.title);
    if (path.startsWith("products/")) {
      assert.match(html, /Ask about this product/);
      assert.match(html, /does not create an order or take payment/);
    }
  }
  assert.equal(titles.size, 15);
  const enquiry = renderToStaticMarkup(
    createElement(CosmeticsWebsite, {
      template,
      document: d,
      preview: true,
      pagePath: "contact?product=daily-skin-edit",
    }),
  );
  assert.match(enquiry, /Your product enquiry/);
  assert.match(enquiry, /I would like to know more about The daily skin edit/);
  assert.match(enquiry, /no request will be submitted/);
});
test("customer-site canonicals, sitemap and Store schema use the real published cosmetics document", async () => {
  const d = catalog.templateDraft(template.id),
    site = {
      profile: {
        organizationId: "org-fixture",
        published: true,
        websiteTemplateId: template.id,
        websiteDocument: d,
        subdomain: "beauty",
        customDomain: "beauty.example.test",
        customDomainVerified: true,
        phone: "",
        email: "",
        address: "",
        city: "",
        state: "",
      },
    };
  const deps = {
    ...common,
    react: { cache: (f) => f },
    "next/headers": {
      headers: async () => new Headers({ host: "beauty.example.test" }),
    },
    "next/navigation": {
      notFound: () => {
        throw Error("404");
      },
    },
    "@/lib/db/public": { getPublicSiteBySubdomain: async () => site },
    "@/lib/db/prospects": { isProspectOrganization: async () => false },
  };
  const helper = load("../src/lib/beauty/public-pages.ts", deps);
  for (const path of catalog.websitePagePaths(template, d)) {
    const m = await helper.beautyMetadata("beauty", path);
    assert.equal(m.alternates.canonical, "https://beauty.example.test/" + path);
  }
  const schema = helper.beautyStructuredData(
    d,
    "https://beauty.example.test",
    "",
    site.profile,
  );
  assert.equal(schema["@type"], "Store");
  assert.equal(schema.aggregateRating, undefined);
  assert.equal(schema.address, undefined);
  const { GET } = load("../src/app/sites/[subdomain]/sitemap.xml/route.ts", {
    ...deps,
    "@/lib/beauty/public-pages": helper,
  });
  const r = await GET(new Request("https://beauty.example.test/sitemap.xml"), {
    params: Promise.resolve({ subdomain: "beauty" }),
  });
  assert.equal(((await r.text()).match(/<loc>/g) || []).length, 15);
  await assert.rejects(
    () => helper.beautyMetadata("beauty", "checkout"),
    /404/,
  );
});
test("genuine feedback and business modules remain separate from sample product content", () => {
  const d = catalog.templateDraft(template.id);
  d.demoContent = false;
  d.reviews = [
    {
      name: "Owner's customer",
      quote: "Owner-supplied genuine feedback.",
      rating: 5,
    },
  ];
  const html = renderToStaticMarkup(
    createElement(CosmeticsWebsite, {
      template,
      document: d,
      reviews: [
        {
          name: "Verified customer",
          quote: "Verified boutique feedback.",
          rating: 5,
        },
      ],
      businessSection: createElement(
        "div",
        { id: "live-business-module" },
        "Actual business records",
      ),
    }),
  );
  assert.match(html, /Verified boutique feedback/);
  assert.doesNotMatch(html, /Owner-supplied genuine feedback/);
  assert.match(html, /id="live-business-module"/);
  assert.doesNotMatch(html, /Sample website/);
});
