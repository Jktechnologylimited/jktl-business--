import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as catalogue from "../src/lib/website-templates.ts";
const require = createRequire(import.meta.url);
const css = {
  __esModule: true,
  default: new Proxy({}, { get: (_, key) => String(key) }),
};
function load(file, deps) {
  const out = {};
  new Function(
    "require",
    "exports",
    ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText,
  )((n) => {
    if (n in deps) return deps[n];
    if (n.startsWith("node:")) return require(n);
    throw Error("Unexpected " + n);
  }, out);
  return out;
}
const reactDeps = {
  react: require("react"),
  "react/jsx-runtime": require("react/jsx-runtime"),
};
const { BeautyWebsite } = load(
  "../src/components/templates/BeautyWebsite.tsx",
  {
    ...reactDeps,
    "@/lib/website-templates": catalogue,
    "./BeautyWebsite.module.css": css,
  },
);
const { TemplateWebsite } = load(
  "../src/components/templates/TemplateWebsite.tsx",
  {
    ...reactDeps,
    "@/lib/website-templates": catalogue,
    "./BeautyWebsite": { BeautyWebsite },
    "./TemplateWebsite.module.css": css,
  },
);
const draft = () => catalogue.templateDraft("hair-salon", "Studio Example");
test("one versioned salon entry gains ten real pages; saved v1 salons keep their old document and renderer", () => {
  assert.equal(catalogue.websiteTemplates.length, 202);
  const doc = draft();
  assert.equal(doc.beauty.version, 2);
  assert.deepEqual(catalogue.parseWebsiteDocument(doc), doc);
  assert.equal(catalogue.beautyPagePaths(doc).length, 10);
  const old = draft();
  delete old.beauty;
  old.headline = "Existing saved salon headline";
  assert.equal(catalogue.parseWebsiteDocument(old).beauty, undefined);
  assert.deepEqual(catalogue.beautyPagePaths(old), [""]);
  const html = renderToStaticMarkup(
    createElement(TemplateWebsite, {
      template: catalogue.getWebsiteTemplate("hair-salon"),
      document: old,
      preview: true,
    }),
  );
  assert.ok(html.includes('data-layout="portrait"'));
  assert.ok(html.includes('id="home"'));
});
test("each salon page renders meaningful distinct content and actual route links, with honest preview forms", () => {
  const doc = draft();
  const headings = new Set();
  for (const path of catalogue.beautyPagePaths(doc)) {
    const html = renderToStaticMarkup(
      createElement(BeautyWebsite, {
        document: doc,
        pagePath: path,
        basePath: "/template-canvas/hair-salon",
      }),
    );
    assert.match(html, /<h1>/);
    assert.doesNotMatch(html, /undefined|javascript:/);
    assert.ok(html.includes('href="/template-canvas/hair-salon/about"'));
    assert.ok(html.includes('href="/template-canvas/hair-salon/services"'));
    const meta = catalogue.beautyPageMeta(doc, path);
    assert.ok(meta.description.length > 80);
    headings.add(meta.title);
    if (path === "book" || path === "contact") {
      assert.match(html, /no request will be submitted/);
      assert.match(html, /name="email"/);
      assert.doesNotMatch(html, /Request sent!/);
    }
  }
  assert.equal(headings.size, 10);
});
test("CMS additions round-trip and invalid content/URLs/duplicate service paths cannot be saved", () => {
  const doc = draft();
  doc.beauty.contact.phone = "+2348090000000";
  doc.beauty.contact.email = "salon@example.test";
  doc.beauty.contact.address = "Owner-provided address";
  doc.offerings[0].price = "₦30,000";
  doc.beauty.stylists[0].name = "Owner-provided stylist";
  assert.deepEqual(catalogue.parseWebsiteDocument(doc), doc);
  for (const mutate of [
    (d) => (d.beauty.version = 3),
    (d) => (d.beauty.contact.mapUrl = "javascript:alert(1)"),
    (d) => (d.offerings[0].slug = "../login"),
    (d) => (d.offerings[1].slug = d.offerings[0].slug),
    (d) => (d.beauty.stylists[0].image = "http://insecure.test/a.jpg"),
    (d) => (d.beauty.contact.email = "bad"),
    (d) => d.beauty.pages.push(d.beauty.pages[0]),
  ]) {
    const copy = structuredClone(doc);
    mutate(copy);
    assert.throws(() => catalogue.parseWebsiteDocument(copy));
  }
  const hostile = structuredClone(doc);
  hostile.brandName = "<script>bad()</script>";
  const html = renderToStaticMarkup(
    createElement(BeautyWebsite, { document: hostile }),
  );
  assert.doesNotMatch(html, /<script>bad/);
  assert.match(html, /&lt;script&gt;/);
});
function requestFixture() {
  let site = {
    profile: {
      organizationId: "org-a",
      published: true,
      websiteTemplateId: "hair-salon",
      websiteDocument: draft(),
    },
    services: [],
  };
  const writes = [],
    sent = [],
    bookings = [],
    rates = [];
  let failStore = false,
    failMail = false;
  const actions = load("../src/lib/actions/public-website-request-actions.ts", {
    "next/headers": {
      headers: async () => new Headers({ "x-forwarded-for": "203.0.113.1" }),
    },
    "@/lib/db/public": { getPublicSiteBySubdomain: async () => site },
    "@/lib/db/customers": {
      createCustomer: async (org, id, input) => {
        if (failStore) throw Error("storage failure");
        writes.push({ org, id, input });
        return { id };
      },
    },
    "@/lib/db/organizations": {
      getOwnerEmail: async () => "owner@example.test",
    },
    "@/lib/website-templates": catalogue,
    "@/lib/actions/public-actions": {
      createPublicBookingAction: async (subdomain, input) => {
        bookings.push({ subdomain, input });
        return { ok: true, data: { id: "fixture" } };
      },
    },
    "@/lib/email": {
      sendWebsiteRequestEmail: async (input) => {
        if (failMail) throw Error("provider failure");
        sent.push(input);
      },
    },
    "@/lib/support/service": {
      rate: async (key, max) => {
        rates.push({ key, max });
      },
    },
  });
  const input = {
    kind: "contact",
    name: "Visitor",
    email: "visitor@example.test",
    phone: "+2348090000000",
    service: "",
    date: "",
    time: "",
    message: "Please tell me about your salon.",
    website: "",
  };
  return {
    actions,
    input,
    writes,
    sent,
    bookings,
    rates,
    setSite: (v) => (site = v),
    site: () => site,
    failStore: () => (failStore = true),
    failMail: () => (failMail = true),
  };
}
test("public contact requests resolve tenant server-side, persist before success and notify the actual owner", async () => {
  const f = requestFixture();
  assert.equal(
    (await f.actions.submitBeautyWebsiteRequestAction("studio", f.input)).ok,
    true,
  );
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].org, "org-a");
  assert.match(f.writes[0].input.notes, /Website contact enquiry/);
  assert.equal(f.sent[0].to, "owner@example.test");
  assert.ok(
    f.rates.every(
      (r) => !r.key.includes("visitor@") && !r.key.includes("203.0.113.1"),
    ),
  );
  f.failStore();
  assert.equal(
    (await f.actions.submitBeautyWebsiteRequestAction("studio", f.input)).ok,
    false,
  );
  assert.equal(f.sent.length, 1);
  const g = requestFixture();
  g.failMail();
  assert.equal(
    (await g.actions.submitBeautyWebsiteRequestAction("studio", g.input)).ok,
    true,
  );
  assert.equal(g.writes.length, 1);
});
test("invalid, bot, unpublished and wrong-template requests cannot write customer data", async () => {
  for (const change of [
    { email: "bad" },
    { phone: "" },
    { phone: "----------" },
    { website: "spam" },
    { message: "" },
    { name: "" },
  ]) {
    const f = requestFixture();
    assert.equal(
      (
        await f.actions.submitBeautyWebsiteRequestAction("studio", {
          ...f.input,
          ...change,
        })
      ).ok,
      false,
    );
    assert.equal(f.writes.length, 0);
  }
  for (const site of [
    null,
    { profile: { published: false } },
    { profile: { published: true, websiteTemplateId: "not-real" } },
  ]) {
    const f = requestFixture();
    f.setSite(site);
    assert.equal(
      (await f.actions.submitBeautyWebsiteRequestAction("studio", f.input)).ok,
      false,
    );
    assert.equal(f.writes.length, 0);
  }
});
test("appointment requests validate WAT and use authoritative services or save an unconfirmed enquiry", async () => {
  const f = requestFixture();
  const date = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const input = {
    ...f.input,
    kind: "appointment",
    service: "cut-and-finish",
    date,
    time: "14:30",
  };
  assert.equal(
    (await f.actions.submitBeautyWebsiteRequestAction("studio", input)).ok,
    true,
  );
  assert.match(f.writes[0].input.notes, /14:30 WAT \(not confirmed\)/);
  assert.equal(f.bookings.length, 0);
  const g = requestFixture();
  g.site().services = [
    {
      id: "real-service-id",
      active: true,
      name: g.site().profile.websiteDocument.offerings[0].title,
      priceKobo: 999900,
      durationMin: 70,
    },
  ];
  assert.equal(
    (await g.actions.submitBeautyWebsiteRequestAction("studio", input)).ok,
    true,
  );
  assert.equal(g.bookings[0].input.serviceId, "real-service-id");
  assert.equal(g.bookings[0].input.startsAt, `${date}T13:30:00.000Z`);
  assert.equal(g.writes.length, 0);
  for (const change of [
    { date: "2026-02-30" },
    { time: "25:00" },
    { date: "2000-01-01" },
    { service: "not-owned" },
  ])
    assert.equal(
      (
        await g.actions.submitBeautyWebsiteRequestAction("studio", {
          ...input,
          ...change,
        })
      ).ok,
      false,
    );
});
test("page metadata uses the verified customer host and structured data never invents reviews or ratings", async () => {
  const doc = draft(),
    site = {
      profile: {
        published: true,
        organizationId: "org-a",
        websiteDocument: doc,
        subdomain: "studio",
        customDomain: "salon.example.test",
        customDomainVerified: true,
        phone: "",
        email: "",
        address: "",
        city: "",
        state: "",
      },
    };
  const helper = load("../src/lib/beauty/public-pages.ts", {
    react: { cache: (f) => f },
    "next/headers": {
      headers: async () => new Headers({ host: "studio.jktl.com.ng" }),
    },
    "next/navigation": {
      notFound: () => {
        throw Error("404");
      },
    },
    "@/lib/db/public": { getPublicSiteBySubdomain: async () => site },
    "@/lib/db/prospects": { isProspectOrganization: async () => false },
    "@/lib/website-templates": catalogue,
  });
  const meta = await helper.beautyMetadata("studio", "about");
  assert.equal(meta.alternates.canonical, "https://salon.example.test/about");
  assert.equal(meta.openGraph.siteName, doc.brandName);
  const json = helper.beautyStructuredData(
    doc,
    "https://salon.example.test",
    "about",
    site.profile,
  );
  assert.equal(json["@type"], "HairSalon");
  assert.equal(json.review, undefined);
  assert.equal(json.aggregateRating, undefined);
  assert.equal(json.address, undefined);
  await assert.rejects(
    () => helper.beautyMetadata("studio", "not-real"),
    /404/,
  );
  assert.equal(await helper.publicWebsiteBase("studio"), "");
});

test("published sitemap contains only the real salon paths and excludes unpublished/prospect sites", async () => {
  const doc = draft();
  let site = {
    profile: {
      published: true,
      websiteDocument: doc,
      organizationId: "org-a",
      customDomainVerified: false,
      customDomain: "",
      subdomain: "studio",
    },
  };
  let prospect = false;
  const { GET } = load("../src/app/sites/[subdomain]/sitemap.xml/route.ts", {
    "@/lib/db/public": { getPublicSiteBySubdomain: async () => site },
    "@/lib/db/prospects": { isProspectOrganization: async () => prospect },
    "@/lib/website-templates": catalogue,
    "@/lib/beauty/public-pages": {
      publicWebsiteOrigin: () => "https://studio.jktl.com.ng",
    },
  });
  const context = { params: Promise.resolve({ subdomain: "studio" }) };
  const response = await GET(
    new Request("https://studio.jktl.com.ng/sitemap.xml"),
    context,
  );
  assert.equal(response.status, 200);
  const xml = await response.text();
  assert.equal((xml.match(/<loc>/g) || []).length, 10);
  assert.match(
    xml,
    /<loc>https:\/\/studio.jktl.com.ng\/services\/cut-and-finish<\/loc>/,
  );
  assert.doesNotMatch(xml, /template-canvas|\/sites\//);
  prospect = true;
  assert.equal(
    (await GET(new Request("https://example.test"), context)).status,
    404,
  );
  prospect = false;
  site.profile.published = false;
  assert.equal(
    (await GET(new Request("https://example.test"), context)).status,
    404,
  );
});
test("tenant middleware preserves actual page paths and serves bundled template assets directly", async () => {
  const { middleware } = load("../middleware.ts", {
    "next/server": {
      NextResponse: {
        next: () => ({ kind: "next" }),
        rewrite: (url) => ({ kind: "rewrite", url }),
      },
    },
    "@/lib/db/public": { getSubdomainByCustomDomain: async () => null },
  });
  const request = (path) => {
    const url = new URL("https://studio.jktl.com.ng" + path);
    url.clone = () => new URL(url.href);
    return {
      nextUrl: url,
      headers: new Headers({ host: "studio.jktl.com.ng" }),
    };
  };
  assert.equal(
    (await middleware(request("/template-photos/beauty/hero.jpg"))).kind,
    "next",
  );
  const page = await middleware(
    request("/services/cut-and-finish?source=gallery"),
  );
  assert.equal(page.url.pathname, "/sites/studio/services/cut-and-finish");
  assert.equal(page.url.search, "?source=gallery");
});
