import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const fixture = { exports: {} };
new Function("module", "exports", ts.transpileModule(readFileSync(new URL("../next.config.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(fixture, fixture.exports);
const config = fixture.exports.default;

test("private workspaces, authentication, onboarding and payment links send an HTTP noindex directive", async () => {
  const rules = await config.headers();
  for (const source of ["/business/:path*", "/admin/:path*", "/affiliates/:path*", "/partners/:path*", "/login", "/signup", "/forgot-password", "/reset-password", "/onboarding/:path*", "/pay/:path*"]) {
    const headers = rules.find(rule => rule.source === source)?.headers || [];
    assert.equal(headers.find(header => header.key === "X-Robots-Tag")?.value, "noindex, nofollow", source);
  }
});

test("the noindex policy does not blanket the wildcard customer websites, public templates, guides or games", async () => {
  const rules = await config.headers();
  const noindexSources = rules.filter(rule => rule.headers.some(header => header.key === "X-Robots-Tag")).map(rule => rule.source);
  for (const source of ["/:path*", "/", "/sites/:path*", "/templates/:path*", "/template-canvas/:path*", "/play/:path*", "/help/:path*"]) assert.ok(!noindexSources.includes(source), source);
  assert.equal(config.experimental.serverActions.bodySizeLimit, "4mb");
  assert.ok(rules.find(rule => rule.source === "/business/:path*").headers.some(header => header.key === "X-Frame-Options" && header.value === "DENY"));
});
