import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { load } from "./fixtures/lifecycle-db.mjs";
import * as catalogue from "../src/lib/website-templates.ts";
const notFound = () => {
  throw Error("404");
};
function setup(id = "fashion") {
  const template = catalogue.getWebsiteTemplate(id),
    profile = {
      published: true,
      organizationId: "org",
      websiteTemplateId: id,
      websiteDocument: catalogue.templateDraft(id, "Customer business"),
      customDomainVerified: false,
      customDomain: "",
      subdomain: "customer",
      phone: "",
      email: "",
      address: "",
      city: "",
      state: "",
    };
  const site = { profile, services: [], products: [], testimonials: [] };
  let reads = 0,
    prospect = false,
    host = "business.jktl.com.ng";
  const db = {
    getPublicSiteBySubdomain: async (slug) => {
      reads++;
      return slug === "customer" ? site : null;
    },
  };
  const pages = load("src/lib/beauty/public-pages.ts", {
    react: { cache: (f) => f },
    "next/headers": { headers: async () => new Headers({ host }) },
    "next/navigation": { notFound },
    "@/lib/db/public": db,
    "@/lib/db/prospects": { isProspectOrganization: async () => prospect },
    "@/lib/website-templates": catalogue,
  });
  return {
    site,
    template,
    pages,
    db,
    get reads() {
      return reads;
    },
    set prospect(p) {
      prospect = p;
    },
    set host(h) {
      host = h;
    },
  };
}
test("published generic and dressmaker pages resolve actual routes and correct per-page metadata", async () => {
  for (const id of [
    "fashion",
    "dressmaker-atelier",
    "law-firm-counsel",
    "beauty-atelier",
  ]) {
    const f = setup(id),
      paths = catalogue.websitePagePaths(
        f.template,
        f.site.profile.websiteDocument,
      );
    const loaded = await f.pages.getBeautySite("customer");
    assert.equal(loaded.template.id, id);
    for (const path of paths) {
      const m = await f.pages.beautyMetadata("customer", path, f.site);
      assert.equal(
        m.alternates.canonical,
        "https://customer.jktl.com.ng/" + path,
      );
      assert.ok(m.description.length <= 160);
    }
    assert.equal(
      f.reads,
      1,
      "metadata must reuse the loaded profile instead of querying it again",
    );
    await assert.rejects(
      f.pages.beautyMetadata("customer", "not-a-page", f.site),
      /404/,
    );
    f.site.profile.customDomainVerified = true;
    f.site.profile.customDomain = "atelier.example.test";
    const m = await f.pages.beautyMetadata("customer", paths[1], f.site);
    assert.equal(
      m.alternates.canonical,
      "https://atelier.example.test/" + paths[1],
    );
    f.prospect = true;
    assert.equal(
      (await f.pages.beautyMetadata("customer", "", f.site)).robots.index,
      false,
    );
    await assert.rejects(f.pages.getBeautySite("other-business"), /404/);
    f.site.profile.published = false;
    await assert.rejects(f.pages.getBeautySite("customer"), /404/);
  }
});
test("published sitemap and actual child-page handler follow the same website route registry", async () => {
  for (const id of [
    "fashion",
    "dressmaker-atelier",
    "jewellery-luxe",
    "blank-landing",
  ]) {
    const f = setup(id),
      deps = {
        "@/lib/db/public": f.db,
        "@/lib/db/prospects": { isProspectOrganization: async () => false },
        "@/lib/website-templates": catalogue,
        "@/lib/beauty/public-pages": f.pages,
      };
    const sitemap = load(
      "src/app/sites/[subdomain]/sitemap.xml/route.ts",
      deps,
    );
    const r = await sitemap.GET(
      new Request("https://example.test/sitemap.xml"),
      { params: Promise.resolve({ subdomain: "customer" }) },
    );
    assert.equal(r.status, 200);
    const xml = await r.text(),
      paths = catalogue.websitePagePaths(f.template);
    assert.equal((xml.match(/<loc>/g) || []).length, paths.length);
    for (const path of paths)
      assert.ok(
        xml.includes("https://customer.jktl.com.ng/" + path + "</loc>"),
      );
    const route = load("src/app/sites/[subdomain]/[...path]/page.tsx", {
      ...deps,
      "next/navigation": { notFound },
      "react/jsx-runtime": await import("react/jsx-runtime"),
      "@/lib/public-site-assistant": { publicSiteAssistant: async () => null },
      "@/components/public-site/public-site-view": {
        PublicSiteView: (p) => React.createElement("main", null, p.pagePath),
      },
    });
    for (const path of paths.filter(Boolean)) {
      const view = await route.default({
        params: Promise.resolve({
          subdomain: "customer",
          path: path.split("/"),
        }),
        searchParams: Promise.resolve({}),
      });
      assert.ok(view);
    }
    await assert.rejects(
      route.default({
        params: Promise.resolve({
          subdomain: "customer",
          path: ["not-a-page"],
        }),
        searchParams: Promise.resolve({}),
      }),
      /404/,
    );
  }
});
test("published route bases and schema retain each business origin and category", async () => {
  const f = setup("dressmaker-atelier");
  assert.equal(await f.pages.publicWebsiteBase("customer"), "/sites/customer");
  f.host = "customer.jktl.com.ng";
  assert.equal(await f.pages.publicWebsiteBase("customer"), "");
  f.host = "atelier.example.test";
  assert.equal(await f.pages.publicWebsiteBase("customer"), "");
  const data = f.pages.beautyStructuredData(
    f.site.profile.websiteDocument,
    "https://customer.jktl.com.ng",
    "collection",
    f.site.profile,
  );
  assert.equal(data["@type"], "ClothingStore");
  assert.equal(
    data.mainEntityOfPage,
    "https://customer.jktl.com.ng/collection",
  );
  assert.equal(data.aggregateRating, undefined);
});
