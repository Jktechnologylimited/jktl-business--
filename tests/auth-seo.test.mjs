import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
function load(file) {
  const m = { exports: {} };
  new Function(
    "module",
    "exports",
    ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
  )(m, m.exports);
  return m.exports;
}
const auth = load("../src/lib/auth-page.ts");
test("authentication metadata uses one query-free canonical and noindex for every query variant", () => {
  for (const path of [
    "/login",
    "/signup",
    "/onboarding",
    "/forgot-password",
    "/reset-password",
    "/admin/login",
    "/affiliates/login",
    "/partners/login",
  ]) {
    const m = auth.authPageMetadata(
      path,
      "Account access",
      "Secure account access.",
    );
    assert.equal(m.robots.index, false);
    assert.equal(m.robots.follow, false);
    assert.equal(m.alternates.canonical, "https://business.jktl.com.ng" + path);
    assert.ok(!m.alternates.canonical.includes("?"));
  }
});
test("server query handling preserves template, invite, product and referral inputs without changing first-value semantics", () => {
  const p = auth.authSearchParams({
    template: ["law-firm", "school"],
    next: "programs",
    program: "partner",
    invite: "a".repeat(64),
    ref: "REF123",
    emailPlan: "pro",
    empty: "",
    absent: undefined,
  });
  assert.equal(p.get("template"), "law-firm");
  assert.deepEqual(p.getAll("template"), ["law-firm", "school"]);
  for (const key of ["next", "program", "invite", "ref", "emailPlan"])
    assert.ok(p.get(key));
  assert.equal(p.get("empty"), "");
  assert.equal(p.get("absent"), null);
});
test("auth server pages await request params and keep the visible heading in the actual form", () => {
  for (const route of ["login", "signup"]) {
    const wrapper = readFileSync(
        new URL("../src/app/" + route + "/page.tsx", import.meta.url),
        "utf8",
      ),
      form = readFileSync(
        new URL(
          "../src/app/" + route + "/" + route + "-client.tsx",
          import.meta.url,
        ),
        "utf8",
      );
    assert.match(wrapper, /await searchParams/);
    assert.match(wrapper, /authPageMetadata/);
    assert.equal((form.match(/<h1\b/g) || []).length, 1);
    assert.doesNotMatch(form, /useSearchParams|<Suspense/);
  }
  const sitemap = readFileSync(
    new URL(
      "../src/app/sites/[subdomain]/sitemap.xml/route.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.ok(!sitemap.includes('"/login"'));
  assert.ok(!sitemap.includes('"/signup"'));
});

test("generated public website sitemap paths exclude platform authentication routes",async()=>{const catalog=await import('../src/lib/website-templates.ts');for(const template of catalog.websiteTemplates){const paths=catalog.beautyPagePaths(template.document);assert.ok(!paths.includes('login'),template.id);assert.ok(!paths.includes('signup'),template.id);assert.ok(!paths.some(p=>p.includes('?template=')),template.id);}});
