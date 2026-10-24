import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { PGlite } from "@electric-sql/pglite";
import * as catalogue from "../src/lib/website-templates.ts";
import * as storage from "../src/lib/website-template-store.ts";
const require = createRequire(import.meta.url);
function loadTs(path, dependencies) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const exports = {};
  new Function("require", "exports", code)((name) => {
    if (name in dependencies) return dependencies[name];
    throw new Error(`Unexpected dependency ${name}`);
  }, exports);
  return exports;
}
test("all 200 industry templates plus blanks have complete, valid, independent documents", () => {
  const { websiteTemplates: all } = catalogue;
  assert.equal(all.length, 202);
  assert.equal(all.filter((t) => t.kind !== "blank").length, 200);
  assert.equal(new Set(all.map((t) => t.id)).size, 202);
  assert.ok(new Set(all.map((t) => t.layout)).size >= 10);
  for (const id of ["law-firm", "church", "school", "music-label", "med-spa"])
    assert.ok(catalogue.getWebsiteTemplate(id));
  for (const template of all) {
    assert.deepEqual(
      catalogue.parseWebsiteDocument(template.document),
      template.document,
    );
    assert.equal(
      new Set(template.sectionOrder).size,
      template.sectionOrder.length,
    );
    assert.ok(
      template.sectionOrder.every((key) =>
        [
          "about",
          "feature",
          "gallery",
          "offerings",
          "faq",
          "areas",
          "reviews",
        ].includes(key),
      ),
    );
    assert.equal(
      catalogue.templateEditorPath(template.id),
      `/business/website/template?template=${template.id}`,
    );
    assert.equal(
      catalogue.templateLoginPath(template.id),
      `/login?template=${template.id}`,
    );
    assert.ok(
      existsSync(
        new URL(`../public/template-art/${template.sourceId || template.id}.svg`, import.meta.url),
      ),
    );
    const draft = catalogue.templateDraft(template.id, "My own business");
    assert.equal(draft.brandName, "My own business");
    if (draft.offerings.length) {
      draft.offerings[0].title = "changed";
      assert.notEqual(template.document.offerings[0].title, "changed");
    }
  }
  assert.equal(
    catalogue.templateEditorPath("https://evil.example"),
    "/business/templates",
  );
  assert.equal(catalogue.templateLoginPath("unknown"), "/login");
});
test("documents reject dangerous image protocols, invalid colours, oversized content and unexpected structure", () => {
  const base = catalogue.templateDraft("school");
  for (const patch of [
    { heroImage: "javascript:alert(1)" },
    { heroImage: "data:text/html,hello" },
    { heroImage: "https://user:password@example.com/image.jpg" },
    { accent: "red" },
    { headline: "" },
    { aboutText: "a".repeat(5001) },
    { offerings: [] },
    { gallery: [] },
    { faqs: [{ question: "why", answer: 12 }] },
    { featureItems: [""] },
    { version: 2 },
  ])
    assert.throws(() => catalogue.parseWebsiteDocument({ ...base, ...patch }));
  const cleaned = catalogue.parseWebsiteDocument({
    ...base,
    organizationId: "forged",
    published: true,
  });
  assert.equal("organizationId" in cleaned, false);
  assert.equal("published" in cleaned, false);
});
test("actual full-site renderer renders every template and safely escapes edited copy", () => {
  const { TemplateWebsite } = loadTs(
    "../src/components/templates/TemplateWebsite.tsx",
    {
      "@/lib/website-templates": catalogue,
      react: require("react"),
      "react/jsx-runtime": require("react/jsx-runtime"),
      "./TemplateWebsite.module.css": {
        __esModule: true,
        default: new Proxy({}, { get: (_, key) => String(key) }),
      },
    },
  );
  for (const template of catalogue.websiteTemplates) {
    const html = renderToStaticMarkup(
      createElement(TemplateWebsite, {
        template,
        document: template.document,
        preview: true,
      }),
    );
    const sections = template.document.blank ? [] : template.sectionOrder;
    for (const id of [
      "home",
      "contact",
      ...sections.map(
        (key) =>
          ({ feature: "approach", faq: "questions", areas: "service-areas" })[
            key
          ] || key,
      ),
    ])
      assert.ok(html.includes(`id="${id}"`), `${template.id} missing ${id}`);
    assert.ok(html.includes(`data-layout="${template.layout}"`));
    assert.ok(
      html.includes(template.document.headline.replaceAll("&", "&amp;")),
    );
    assert.ok(!html.includes("undefined"));
  }
  const template = catalogue.getWebsiteTemplate("law-firm");
  const doc = { ...template.document, headline: "<script>alert(1)</script>" };
  const html = renderToStaticMarkup(
    createElement(TemplateWebsite, {
      template,
      document: doc,
      contact: { email: "owner@example.com", phone: "+2347000000000" },
    }),
  );
  assert.ok(!html.includes("<script>alert"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("mailto:owner@example.com"));
  assert.ok(html.includes("tel:+2347000000000"));
});
test("Main and Business publish the same catalogue and renderer", (t) => {
  const root = new URL("../../jktl-main/", import.meta.url);
  if (!existsSync(root))
    return t.skip("Optional paired-checkout consistency check.");
  for (const [a, b] of [
    ["../src/lib/website-templates.ts", "lib/website-templates.ts"],
    [
      "../src/components/templates/TemplateWebsite.tsx",
      "components/templates/TemplateWebsite.tsx",
    ],
    [
      "../src/components/templates/TemplateWebsite.module.css",
      "components/templates/TemplateWebsite.module.css",
    ],
    [
      "../src/components/templates/TemplateGallery.tsx",
      "components/templates/TemplateGallery.tsx",
    ],
  ])
    assert.equal(
      createHash("sha256")
        .update(readFileSync(new URL(a, import.meta.url)))
        .digest("hex"),
      createHash("sha256")
        .update(readFileSync(new URL(b, root)))
        .digest("hex"),
    );
});
test("database and real save action: tenant isolation, roles, draft/publish, concurrency, and migration repeatability", async (t) => {
  const db = new PGlite();
  try {
    for (const file of readdirSync(new URL("../migrations/", import.meta.url))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.exec(
        readFileSync(
          new URL(`../migrations/${file}`, import.meta.url),
          "utf8",
        ).replace(/CREATE EXTENSION[^;]*;/gi, ""),
      );
    const query = async (text, params) => (await db.query(text, params)).rows;
    const [{ id: orgA }, { id: orgB }] = await query(
      "INSERT INTO organizations(name,slug) VALUES ('Template A','template-a'),('Template B','template-b') RETURNING id",
      [],
    );
    const [{ id: userId }] = await query(
      "INSERT INTO users(name,email,password_hash) VALUES ('Template user','template@example.com','fixture') RETURNING id",
      [],
    );
    await query(
      "INSERT INTO business_profiles(organization_id,business_type,display_name,subdomain) VALUES ($1,'general','Original A','template-a'),($2,'general','Original B','template-b')",
      [orgA, orgB],
    );
    await query(
      "INSERT INTO organization_members(organization_id,user_id,name,email,role) VALUES ($1,$2,'Template user','template@example.com','staff')",
      [orgA, userId],
    );
    let signedIn = true;
    const invalidated = [];
    const sql = async (parts, ...values) =>
      query(
        parts.reduce((text, part, i) => text + (i ? `$${i}` : "") + part, ""),
        values,
      );
    sql.query = query;
    const actions = loadTs("../src/lib/actions/website-template-actions.ts", {
      "next/cache": { revalidatePath: (path) => invalidated.push(path) },
      "@/lib/session": {
        requireSession: async () => {
          if (!signedIn) throw new Error("Not signed in.");
          return { organizationId: orgA, userId };
        },
      },
      "@/lib/db/client": {
        getSql: () => sql,
        isSchemaOutOfDateError: (e) => ["42P01", "42703"].includes(e?.code),
      },
      "@/lib/db/organizations": {
        getBusinessProfile: async (id) => {
          const [r] = await query(
            "SELECT * FROM business_profiles WHERE organization_id=$1",
            [id],
          );
          return {
            id: r.id,
            organizationId: r.organization_id,
            subdomain: r.subdomain,
            websiteTemplateId: r.website_template_id,
            websiteRevision: r.website_revision,
            websiteDocument: r.website_document,
            published: r.published,
          };
        },
      },
      "@/lib/website-templates": catalogue,
      "@/lib/website-template-store": storage,
    });
    const input = {
      templateId: "school",
      document: catalogue.templateDraft("school", "My academy"),
      revision: 0,
      published: false,
      organizationId: orgB,
    };
    await t.test(
      "anonymous users and staff cannot save a website",
      async () => {
        signedIn = false;
        assert.equal(
          (await actions.saveWebsiteTemplateAction(input)).ok,
          false,
        );
        signedIn = true;
        assert.match(
          (await actions.saveWebsiteTemplateAction(input)).error,
          /owner or manager/,
        );
        assert.equal(
          (
            await query(
              "SELECT website_revision FROM business_profiles WHERE organization_id=$1",
              [orgA],
            )
          )[0].website_revision,
          0,
        );
      },
    );
    await query(
      "UPDATE organization_members SET role='owner' WHERE organization_id=$1",
      [orgA],
    );
    await t.test(
      "invalid template/content is rejected before persistence",
      async () => {
        assert.equal(
          (
            await actions.saveWebsiteTemplateAction({
              ...input,
              templateId: "unknown",
            })
          ).ok,
          false,
        );
        assert.equal(
          (
            await actions.saveWebsiteTemplateAction({
              ...input,
              document: { ...input.document, heroImage: "javascript:bad" },
            })
          ).ok,
          false,
        );
      },
    );
    await t.test(
      "owner saves the selected document to their own organization, without publishing or replacing identity",
      async () => {
        const result = await actions.saveWebsiteTemplateAction(input);
        assert.equal(result.ok, true);
        assert.equal(result.data.websiteTemplateId, "school");
        assert.equal(
          result.data.websiteDocument.headline,
          input.document.headline,
        );
        assert.equal(result.data.published, false);
        const [a] = await query(
          "SELECT * FROM business_profiles WHERE organization_id=$1",
          [orgA],
        );
        assert.equal(a.display_name, "Original A");
        assert.equal(a.website_revision, 1);
        const [b] = await query(
          "SELECT * FROM business_profiles WHERE organization_id=$1",
          [orgB],
        );
        assert.equal(b.website_template_id, "");
        assert.equal(b.website_revision, 0);
        assert.ok(invalidated.includes("/sites/template-a"));
      },
    );
    await t.test(
      "reload reads edited content, stale saves are rejected and explicit publication works",
      async () => {
        const stale = await actions.saveWebsiteTemplateAction(input);
        assert.equal(stale.ok, false);
        const updated = await actions.saveWebsiteTemplateAction({
          ...input,
          revision: 1,
          published: true,
          document: { ...input.document, headline: "Edited academy headline" },
        });
        assert.equal(updated.ok, true);
        assert.equal(updated.data.published, true);
        assert.equal(
          updated.data.websiteDocument.headline,
          "Edited academy headline",
        );
        assert.equal(updated.data.websiteRevision, 2);
      },
    );
    await t.test(
      "manager is allowed, all 20 templates can be persisted and the migration reruns safely",
      async () => {
        await query(
          "UPDATE organization_members SET role='manager' WHERE organization_id=$1",
          [orgA],
        );
        let revision = 2;
        for (const template of catalogue.websiteTemplates) {
          const result = await actions.saveWebsiteTemplateAction({
            ...input,
            revision,
            templateId: template.id,
            document: catalogue.templateDraft(template.id, "Own brand"),
            published: false,
          });
          assert.equal(result.ok, true, template.id);
          revision++;
        }
        await db.exec(
          readFileSync(
            new URL("../migrations/029_website_templates.sql", import.meta.url),
            "utf8",
          ),
        );
        assert.equal(
          (
            await query(
              "SELECT website_revision FROM business_profiles WHERE organization_id=$1",
              [orgA],
            )
          )[0].website_revision,
          revision,
        );
      },
    );
  } finally {
    await db.close();
  }
});

test("template selection survives auth steps while rejecting unknown ids and external redirects", () => {
  const selection = loadTs("../src/lib/template-selection.ts", {
    "./website-templates": catalogue,
  });
  const old = globalThis.window;
  const items = new Map();
  try {
    globalThis.window = {
      sessionStorage: {
        getItem: (key) => items.get(key) || null,
        setItem: (key, value) => items.set(key, value),
        removeItem: (key) => items.delete(key),
      },
    };
    selection.rememberTemplate("school");
    assert.equal(selection.pendingTemplate(), "school");
    assert.equal(selection.pendingTemplate("church"), "church");
    assert.equal(selection.pendingTemplate("https://evil.example"), "");
    selection.rememberTemplate("unknown");
    assert.equal(selection.pendingTemplate(), "school");
    assert.equal(selection.templateBusinessType("law-firm"), "general");
    assert.equal(selection.templateBusinessType("hair-salon"), "salon");
    selection.clearPendingTemplate();
    assert.equal(selection.pendingTemplate(), "");
  } finally {
    if (old === undefined) delete globalThis.window;
    else globalThis.window = old;
  }
  assert.equal(selection.pendingTemplate("music-label"), "music-label");
});

test("template-based public sites retain actual booking, product and chat components", () => {
  const { TemplateWebsite } = loadTs(
    "../src/components/templates/TemplateWebsite.tsx",
    {
      "@/lib/website-templates": catalogue,
      react: require("react"),
      "react/jsx-runtime": require("react/jsx-runtime"),
      "./TemplateWebsite.module.css": {
        __esModule: true,
        default: new Proxy({}, { get: (_, key) => String(key) }),
      },
    },
  );
  const empty = () => null;
  const { PublicSiteView } = loadTs(
    "../src/components/public-site/public-site-view.tsx",
    {
      react: require("react"),
      "react/jsx-runtime": require("react/jsx-runtime"),
      "framer-motion": { motion: {}, AnimatePresence: empty },
      "lucide-react": require("lucide-react"),
      "@/components/templates/TemplateWebsite": { TemplateWebsite },
      "@/components/templates/PublishedSiteMetrics": loadTs(
        "../src/components/templates/PublishedSiteMetrics.tsx",
        { react: require("react") },
      ),
      "@/lib/website-templates": catalogue,
      "./public-booking-form": {
        PublicBookingForm: (props) =>
          createElement("form", { "data-existing-booking-mode": props.mode }),
      },
      "./chat-widget": {
        ChatWidget: () =>
          createElement("div", { "data-existing-scripted-chat": true }),
      },
      "./site-ai-chat": {
        SiteAiChat: () =>
          createElement("div", { "data-existing-ai-chat": true }),
      },
      "./site-sections": {
        FaqSection: empty,
        GallerySection: empty,
        HoursLocationSection: empty,
        TrustBar: empty,
      },
      "./social-icons": {
        InstagramIcon: empty,
        TikTokIcon: empty,
        FacebookIcon: empty,
        SnapchatIcon: empty,
      },
      "@/lib/format": {
        formatKobo: (v) => `NGN ${v / 100}`,
        initials: () => "",
      },
      "@/lib/contact": {
        waLink: () => "",
        telLink: () => "",
        mailLink: () => "",
        textOnColor: () => "#ffffff",
      },
      "@/lib/fonts": {
        getSiteFontPair: () => ({ displayVar: "serif", bodyVar: "sans-serif" }),
      },
    },
  );
  const props = {
    profile: {
      websiteTemplateId: "hair-salon",
      websiteDocument: catalogue.templateDraft("hair-salon"),
      themeColor: "#234567",
      displayName: "Own business",
      phone: "",
      email: "",
      address: "",
      city: "",
      state: "",
    },
    services: [
      {
        id: "real-service",
        name: "Existing service",
        description: "Your real service",
        priceKobo: 100000,
        durationMin: 30,
        active: true,
      },
    ],
    products: [
      {
        id: "real-product",
        name: "Existing product",
        priceKobo: 20000,
        active: true,
      },
    ],
    testimonials: [],
    subdomain: "own-business",
    mode: "live",
  };
  const html = renderToStaticMarkup(createElement(PublicSiteView, props));
  assert.ok(html.includes("Existing service"));
  assert.ok(html.includes("Existing product"));
  assert.ok(html.includes('data-existing-booking-mode="live"'));
  assert.ok(html.includes("data-existing-scripted-chat"));
  const ai = renderToStaticMarkup(
    createElement(PublicSiteView, {
      ...props,
      aiAssistant: {
        enabled: true,
        packLabel: "Enabled pack",
        greeting: "Hello",
      },
    }),
  );
  assert.ok(ai.includes("data-existing-ai-chat"));
  const preview = renderToStaticMarkup(
    createElement(PublicSiteView, { ...props, mode: "preview" }),
  );
  assert.ok(preview.includes('data-existing-booking-mode="preview"'));
  assert.ok(!preview.includes("data-existing-scripted-chat"));
});
