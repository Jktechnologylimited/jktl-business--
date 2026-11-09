import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
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
function load(file, deps) {
  const module = { exports: {} };
  const code = ts.transpileModule(
    readFileSync(new URL(file, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    },
  ).outputText;
  new Function("require", "module", "exports", code)(
    (name) => (name in deps ? deps[name] : require(name)),
    module,
    module.exports,
  );
  return module.exports;
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
const { OccasionWebsite } = load(
  "../src/components/templates/OccasionWebsite.tsx",
  { ...common, "./BeautyWebsite": beauty, "./OccasionWebsite.module.css": css },
);
const ids = ["bridal-aura", "nail-culture", "fiora-locks"];
test("both original multi-page starters round-trip the existing CMS schema and retain safe selection paths", () => {
  for (const id of ids) {
    const template = catalog.getWebsiteTemplate(id),
      doc = catalog.templateDraft(id, "Our Own Studio");
    assert.equal(template.kind, "website");
    assert.deepEqual(catalog.parseWebsiteDocument(doc), doc);
    assert.equal(doc.brandName, "Our Own Studio");
    assert.equal(doc.beauty.demoContent, true);
    assert.deepEqual(doc.reviews, []);
    assert.deepEqual(doc.socials, []);
    assert.deepEqual(doc.beauty.contact, {
      phone: "",
      email: "",
      address: "",
      whatsapp: "",
      mapUrl: "",
    });
    assert.equal(catalog.templateLoginPath(id), "/login?template=" + id);
    assert.equal(
      catalog.templateEditorPath(id),
      "/business/website/template?template=" + id,
    );
    const paths = catalog.websitePagePaths(template, doc);
    assert.equal(paths.length, id === "fiora-locks" ? 10 : 9);
    for (const path of paths) {
      const html = renderToStaticMarkup(
        createElement(OccasionWebsite, {
          template,
          document: doc,
          pagePath: path,
          preview: true,
          basePath: "/template-canvas/" + id,
        }),
      );
      assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, id + "/" + path);
      assert.ok(html.length > 4000);
      assert.doesNotMatch(html, /wix\.com|localhost|javascript:|Request sent!/);
      assert.match(html, /aria-label="Sign in to JKTL Business"/);
      assert.ok(html.includes("/login?template=" + id));
      const meta = catalog.beautyPageMeta(doc, path);
      assert.ok(meta.description.length > 80);
      if (
        ["", "about", "services", "gallery", "book", "contact"].includes(path)
      ) {
        assert.ok(meta.title.includes(doc.brandName));
        assert.ok(!meta.description.includes(template.document.brandName));
      }
      if (path === "book" || path === "contact") {
        assert.match(
          html,
          /No request will be submitted|no request will be submitted/,
        );
        assert.match(html, /name="website"/);
        assert.match(html, /name="email"/);
      }
    }
    const modified = structuredClone(doc);
    modified.offerings[0].title = "Our own signature service";
    modified.offerings[0].price = "Owner-defined pricing";
    modified.beauty.hours[0].hours = "10:00–18:00";
    modified.beauty.contact.email = "studio@example.test";
    modified.socials = [
      { platform: "instagram", url: "https://www.instagram.com/example/" },
    ];
    assert.deepEqual(catalog.parseWebsiteDocument(modified), modified);
    modified.offerings[1].slug = modified.offerings[0].slug;
    assert.throws(
      () => catalog.parseWebsiteDocument(modified),
      /duplicate service/,
    );
  }
});
test("genuine reviews, live service requests and business modules reuse the existing website boundaries", () => {
  for (const id of ids) {
    const template = catalog.getWebsiteTemplate(id),
      doc = catalog.templateDraft(id);
    doc.beauty.demoContent = false;
    doc.reviews = [
      {
        name: "Client supplied by owner",
        quote: "Our genuine studio experience.",
        rating: 5,
      },
    ];
    const html = renderToStaticMarkup(
      createElement(OccasionWebsite, {
        template,
        document: doc,
        reviews: [
          {
            name: "Verified customer",
            quote: "Verified feedback from our visit.",
            rating: 5,
          },
        ],
        businessSection: createElement(
          "div",
          { id: "business-module" },
          "Live business tools",
        ),
      }),
    );
    assert.match(html, /Verified feedback from our visit/);
    assert.doesNotMatch(html, /Our genuine studio experience/);
    assert.match(html, /id="business-module"/);
    assert.doesNotMatch(html, /Sample website/);
    const contact = renderToStaticMarkup(
      createElement(OccasionWebsite, {
        template,
        document: doc,
        pagePath: "contact",
        onRequest: async () => ({ ok: true }),
      }),
    );
    assert.doesNotMatch(contact, /no request will be submitted/);
    const preview = renderToStaticMarkup(
      createElement(OccasionWebsite, {
        template,
        document: doc,
        preview: true,
        pagePath: "contact",
        onRequest: async () => {
          throw Error("Preview must never send");
        },
      }),
    );
    assert.match(preview, /no request will be submitted/);
  }
});
test("Main and Business share the catalogue, renderers and every bundled template photo", (t) => {
  const main = new URL("../../jktl-main/", import.meta.url);
  if (!existsSync(main)) return t.skip("Paired checkout unavailable");
  for (const [a, b] of [
    ["src/lib/website-templates.ts", "lib/website-templates.ts"],
    ...[
      "OccasionWebsite.tsx",
      "OccasionWebsite.module.css",
      "TemplateWebsite.tsx",
      "BeautyWebsite.tsx",
    ].map((name) => [
      "src/components/templates/" + name,
      "components/templates/" + name,
    ]),
  ]) {
    assert.deepEqual(
      readFileSync(new URL("../" + a, import.meta.url)),
      readFileSync(new URL(b, main)),
    );
  }
  for (const id of ids) {
    const doc = catalog.getWebsiteTemplate(id).document;
    const images = [
      doc.heroImage,
      doc.beauty.aboutImage,
      ...doc.gallery.map((g) => g.src),
      ...doc.offerings.map((o) => o.image),
    ];
    for (const file of new Set(images)) {
      assert.match(file, /^\/template-photos\/african\//);
      assert.deepEqual(
        readFileSync(new URL("../public" + file, import.meta.url)),
        readFileSync(new URL("public" + file, main)),
      );
    }
  }
});
test("published bridal/nail pages use the registered template, customer canonical host and complete sitemap", async () => {
  for (const id of ids) {
    const template = catalog.getWebsiteTemplate(id),
      doc = catalog.templateDraft(id);
    const site = {
      profile: {
        websiteTemplateId: id,
        websiteDocument: doc,
        published: true,
        organizationId: "org-fixture",
        subdomain: "studio",
        customDomain: "studio.example.test",
        customDomainVerified: true,
        phone: "",
        email: "",
        address: "",
        city: "",
        state: "",
      },
    };
    const dependencies = {
      "@/lib/website-templates": catalog,
      "@/lib/db/public": { getPublicSiteBySubdomain: async () => site },
      "@/lib/db/prospects": { isProspectOrganization: async () => false },
      "next/headers": {
        headers: async () => new Headers({ host: "studio.example.test" }),
      },
      "next/navigation": {
        notFound: () => {
          throw Error("404");
        },
      },
      react: { cache: (fn) => fn },
    };
    const helper = load("../src/lib/beauty/public-pages.ts", dependencies);
    for (const route of catalog.websitePagePaths(template)) {
      const metadata = await helper.beautyMetadata("studio", route);
      assert.equal(
        metadata.alternates.canonical,
        "https://studio.example.test/" + route,
      );
      assert.ok(metadata.title.absolute.includes(doc.brandName));
    }
    const schema = helper.beautyStructuredData(
      doc,
      "https://studio.example.test",
      "",
      site.profile,
    );
    assert.equal(
      schema["@type"],
      id === "fiora-locks"
        ? "HairSalon"
        : id === "nail-culture"
          ? "NailSalon"
          : "BeautySalon",
    );
    assert.equal(schema.aggregateRating, undefined);
    const { GET } = load("../src/app/sites/[subdomain]/sitemap.xml/route.ts", {
      ...dependencies,
      "@/lib/beauty/public-pages": helper,
    });
    const response = await GET(
      new Request("https://studio.example.test/sitemap.xml"),
      { params: Promise.resolve({ subdomain: "studio" }) },
    );
    assert.equal(response.status, 200);
    assert.equal(
      ((await response.text()).match(/<loc>/g) || []).length,
      id === "fiora-locks" ? 10 : 9,
    );
    await assert.rejects(
      () => helper.beautyMetadata("studio", "not-a-page"),
      /404/,
    );
  }
});
