import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "./fixtures/lifecycle-db.mjs";
import { can, navFor } from "../src/lib/admin-permissions.ts";
const additions = load("src/lib/knowledge/additions.ts");
const knowledge = load("src/lib/support/knowledge.ts", {
  "@/lib/knowledge/additions": additions,
});
const catalog = load("src/lib/knowledge/catalog.ts", {
  "@/lib/support/knowledge": knowledge,
});
const team = load("src/lib/knowledge/team.ts", { "server-only": {} });
const pages = load("src/components/knowledge/knowledge-pages.tsx", {
  "next/link": {
    __esModule: true,
    default: ({ children, ...props }) => createElement("a", props, children),
  },
  "@/lib/knowledge/catalog": catalog,
});
test("public and Team guides are complete, unique and point to real platform routes", () => {
  const all = [...knowledge.HELP_GUIDES, ...team.TEAM_GUIDES];
  assert.equal(new Set(all.map((g) => g.id)).size, all.length);
  assert.equal(knowledge.HELP_GUIDES.length, 55);
  assert.equal(team.TEAM_GUIDES.length, 15);
  for (const g of all) {
    assert.ok(g.title && g.summary && g.escalate, g.id);
    assert.ok(g.steps.length >= 1 && g.problems.length >= 1, g.id);
    assert.match(g.id, /^[a-z0-9-]+$/);
    assert.ok(catalog.TOPICS.some((t) => t[0] === catalog.topicFor(g)));
    const path = g.route.split("?")[0];
    if (path.startsWith("/")) {
      assert.ok(
        [
          "src/app" + path + "/page.tsx",
          "src/app/admin/(command)" + path.slice(6) + "/page.tsx",
          "src/app/partners/(dashboard)" + path.slice(9) + "/page.tsx",
          "src/app/affiliates/(dashboard)" + path.slice(11) + "/page.tsx",
        ].some(existsSync),
        `${g.id}: ${path}`,
      );
    } else assert.equal(new URL(path).hostname, "jktl.com.ng");
  }
  assert.ok(knowledge.HELP_GUIDES.flatMap((g) => g.steps).length >= 200);
});
test("search and related guides cover whole-platform topics without exposing Team runbooks", () => {
  assert.ok(
    catalog
      .searchArticles(knowledge.HELP_GUIDES, "partner percentage", "partners")
      .some((g) => g.id === "partner-commission"),
  );
  assert.ok(
    catalog
      .searchArticles(knowledge.HELP_GUIDES, "charged", "billing")
      .some((g) => g.id === "payment-recovery"),
  );
  assert.equal(
    catalog.searchArticles(knowledge.HELP_GUIDES, "nonexistentstringxyz")
      .length,
    0,
  );
  assert.equal(
    catalog.searchArticles(knowledge.HELP_GUIDES, "", "team").length,
    0,
  );
  assert.ok(
    !knowledge
      .guideReply("investor company reporting")
      .guides.some((g) => g.id.startsWith("team-")),
  );
  assert.ok(
    knowledge
      .relevantGuides("partner commission percentage")
      .some((g) => g.id === "partner-commission"),
  );
  const g = knowledge.HELP_GUIDES.find((g) => g.id === "partner-commission");
  assert.ok(
    !catalog
      .relatedArticles(g, knowledge.HELP_GUIDES)
      .some((a) => a.id === g.id),
  );
  assert.deepEqual(catalog.searchQuery({ q: ["private"], topic: "invalid" }), {
    q: "",
    topic: "all",
  });
  assert.equal(catalog.searchQuery({ q: "x".repeat(900) }).q.length, 200);
});
test("articles have meaningful server-rendered headings, steps and working support links", () => {
  const g = knowledge.HELP_GUIDES.find((g) => g.id === "account-to-published");
  const html = renderToStaticMarkup(
    createElement(pages.KnowledgeArticle, {
      guide: g,
      articles: knowledge.HELP_GUIDES,
    }),
  );
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.ok(html.includes(g.title));
  assert.ok(html.includes(g.steps[0]));
  assert.match(html, /href="\/business\/help"/);
  assert.match(html, /If something goes wrong/);
  const results = renderToStaticMarkup(
    createElement(pages.KnowledgeIndex, {
      articles: knowledge.HELP_GUIDES,
      q: "partner percentage",
      topic: "partners",
    }),
  );
  assert.match(results, /partner-commission/);
  assert.doesNotMatch(results, /team-domain-operations/);
});
test("private knowledge routes require Team authorization before reading route parameters", async () => {
  const deps = {
    "@/lib/admin-page-guard": {
      guardAdminPage: async (cap) => {
        assert.equal(cap, "view_knowledge");
        throw Error("Denied");
      },
    },
    "@/components/knowledge/knowledge-pages": pages,
    "@/lib/knowledge/catalog": catalog,
    "@/lib/knowledge/team": team,
    "next/navigation": {
      notFound() {
        throw Error("404");
      },
    },
  };
  for (const file of [
    "src/app/admin/(command)/knowledge/page.tsx",
    "src/app/admin/(command)/knowledge/[slug]/page.tsx",
  ]) {
    const page = load(file, deps).default;
    await assert.rejects(
      () =>
        page({
          searchParams: Promise.resolve({}),
          params: Promise.resolve({ slug: "team-access" }),
        }),
      /Denied/,
    );
  }
  for (const role of [
    "owner",
    "analyst",
    "support",
    "affiliate_manager",
    "writer",
    "editor",
    "growth_gaming_lead",
  ]) {
    assert.equal(can(role, "view_knowledge"), true);
    assert.ok(navFor(role).some((n) => n.href === "/admin/knowledge"));
  }
  assert.equal(can("support", "manage_team"), false);
  assert.equal(can("analyst", "record_payouts"), false);
});
test("public routes cannot serve Team article slugs and metadata respects search canonicalization", async () => {
  const article = load("src/app/help/[slug]/page.tsx", {
    "@/components/knowledge/knowledge-pages": pages,
    "@/lib/knowledge/catalog": catalog,
    "next/navigation": {
      notFound() {
        throw Error("404");
      },
    },
  });
  await assert.rejects(
    () => article.default({ params: Promise.resolve({ slug: "team-access" }) }),
    /404/,
  );
  const meta = await article.generateMetadata({
    params: Promise.resolve({ slug: "partner-commission" }),
  });
  assert.equal(
    meta.alternates.canonical,
    "https://business.jktl.com.ng/help/partner-commission",
  );
  const home = load("src/app/help/page.tsx", {
    "@/components/knowledge/knowledge-pages": pages,
    "@/lib/knowledge/catalog": catalog,
  });
  assert.equal(
    (
      await home.generateMetadata({
        searchParams: Promise.resolve({ q: "payment" }),
      })
    ).robots.index,
    false,
  );
  assert.equal(
    (await home.generateMetadata({ searchParams: Promise.resolve({}) })).robots
      .index,
    true,
  );
  assert.doesNotMatch(
    readFileSync("src/lib/knowledge/catalog.ts", "utf8"),
    /from.*team/,
  );
});
