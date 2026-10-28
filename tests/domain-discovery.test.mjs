import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import crypto from "node:crypto";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import * as model from "../src/lib/domains/model.ts";
import { emailIntent, emailDestination } from "../src/lib/product-intent.ts";
function load(file, deps) {
  const code = ts.transpileModule(
    readFileSync(new URL(file, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", code)(
    (n) => {
      if (!(n in deps)) throw Error(n);
      return deps[n];
    },
    mod,
    mod.exports,
  );
  return mod.exports;
}
const store = load("../src/lib/domains/store.ts", { "./model": model });
const registry = load("../src/lib/domains/registry.ts", { "server-only": {} });
const lookup = load("../src/lib/domains/lookup.ts", {
  "server-only": {},
  "./registry": registry,
});
async function fixture() {
  const db = new PGlite();
  await db.exec(
    "CREATE TABLE organizations(id uuid PRIMARY KEY);CREATE TABLE admin_users(id uuid PRIMARY KEY);",
  );
  for (const f of ["034_domain_orders.sql", "056_domain_discovery.sql"])
    await db.exec(
      readFileSync(new URL("../migrations/" + f, import.meta.url), "utf8"),
    );
  const q = async (s, p = []) => (await db.query(s, p)).rows;
  await q(
    "UPDATE domain_prices SET enabled=true,registration_price=500000,renewal_price=650000,registration_cost=300000,renewal_cost=400000 WHERE extension IN('.com','.com.ng','.ng')",
  );
  const service = load("../src/lib/domains/discovery.ts", {
    "server-only": {},
    "node:crypto": crypto,
    "@/lib/db/client": { getSql: () => ({ query: q }) },
    "./model": model,
    "./store": store,
    "./lookup": lookup,
  });
  return { db, q, service };
}
const original = {
  url: process.env.DOMAIN_AVAILABILITY_URL,
  key: process.env.DOMAIN_AVAILABILITY_API_KEY,
  fetch: globalThis.fetch,
};
function configure() {
  process.env.DOMAIN_AVAILABILITY_URL = "https://lookup.example.test/check";
  process.env.DOMAIN_AVAILABILITY_API_KEY = "fixture-secret";
}
function reset() {
  for (const [k, v] of [
    ["DOMAIN_AVAILABILITY_URL", original.url],
    ["DOMAIN_AVAILABILITY_API_KEY", original.key],
  ])
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  globalThis.fetch = original.fetch;
}
const valid = (domain) => ({
  domain,
  available: true,
  premium: false,
  reserved: false,
  eligible: true,
  currency: "NGN",
  registrationPriceKobo: 250000,
});
test("availability requires actual eligibility and price evidence, never a missing DNS record or a bare boolean", async () => {
  try {
    delete process.env.DOMAIN_AVAILABILITY_URL;
    delete process.env.DOMAIN_AVAILABILITY_API_KEY;
    assert.equal(
      (
        await lookup.lookupDomain("example.com", {
          registration_cost: 300000,
          registration_price: 500000,
        })
      ).status,
      "UNKNOWN",
    );
    configure();
    let response = valid("example.com");
    globalThis.fetch = async (url, options) => {
      assert.equal(options.headers.Authorization, "Bearer fixture-secret");
      assert.equal(options.redirect, "error");
      return Response.json(response);
    };
    const price = { registration_cost: 300000, registration_price: 500000 };
    assert.equal(
      (await lookup.lookupDomain("example.com", price)).status,
      "AVAILABLE",
    );
    for (const changed of [{ available: false }, { reserved: true }]) {
      response = { ...valid("example.com"), ...changed };
      assert.equal(
        (await lookup.lookupDomain("example.com", price)).status,
        "UNAVAILABLE",
      );
    }
    for (const changed of [
      { domain: "wrong.com" },
      { premium: true },
      { eligible: false },
      { registrationPriceKobo: 400000 },
      { registrationPriceKobo: "250000" },
      { currency: "USD" },
      { reserved: undefined },
      { eligible: undefined },
    ]) {
      response = { ...valid("example.com"), ...changed };
      assert.equal(
        (await lookup.lookupDomain("example.com", price)).status,
        "UNKNOWN",
      );
    }
    response = valid("example.com");
    assert.equal(
      (
        await lookup.lookupDomain("example.com", {
          ...price,
          registration_cost: 0,
        })
      ).status,
      "UNKNOWN",
    );
    globalThis.fetch = async () => new Response("{}", { status: 401 });
    assert.equal(
      (await lookup.lookupDomain("example.com", price)).status,
      "UNKNOWN",
    );
    globalThis.fetch = async () => {
      throw Error("secret error");
    };
    assert.equal(
      (await lookup.lookupDomain("example.com", price)).status,
      "UNKNOWN",
    );
  } finally {
    reset();
  }
});
test("public search shares authoritative prices, redacts private data, caches lookups, revalidates revisions and blocks purchases by default", async () => {
  const f = await fixture();
  try {
    configure();
    let calls = 0;
    globalThis.fetch = async (url) => {
      calls++;
      return Response.json(valid(new URL(url).searchParams.get("domain")));
    };
    const first = await f.service.publicDomainSearch(
      { name: "mybrand.com.ng", extension: ".com" },
      "192.0.2.1",
      f.q,
    );
    assert.equal(first.results[0].domain, "mybrand.com.ng");
    assert.equal(first.results.length, 3);
    assert.ok(
      first.results.every(
        (r) =>
          r.status === "AVAILABLE" &&
          !r.purchaseAllowed &&
          r.registrationKobo === 500000 &&
          r.renewalKobo === 650000,
      ),
    );
    assert.equal(calls, 3);
    assert.doesNotMatch(
      JSON.stringify(first),
      /fixture-secret|costKobo|supplier|organization_id|registration_cost/,
    );
    await f.service.publicDomainSearch(
      { name: "mybrand", extension: ".com.ng" },
      "192.0.2.1",
      f.q,
    );
    assert.equal(calls, 3);
    await f.q(
      "UPDATE domain_prices SET revision=revision+1,registration_price=550000 WHERE extension='.com.ng'",
    );
    const updated = await f.service.publicDomainSearch(
      { name: "mybrand", extension: ".com.ng" },
      "192.0.2.1",
      f.q,
    );
    assert.equal(updated.results[0].registrationKobo, 550000);
    assert.equal(calls, 4);
    await assert.rejects(
      f.service.requireDomainPurchases(f.q),
      /temporarily unavailable/,
    );
    await assert.rejects(
      f.q("UPDATE domain_purchase_controls SET purchases_enabled=true"),
      /check constraint/,
    );
    await f.q(
      "UPDATE domain_purchase_controls SET readonly_verified_at=now(),e2e_verified_at=now(),purchases_enabled=true",
    );
    await f.service.requireDomainPurchases(f.q);
    for (let i = 0; i < 9; i++)
      await f.service.publicDomainSearch(
        { name: "mybrand", extension: ".com.ng" },
        "192.0.2.1",
        f.q,
      );
    await assert.rejects(
      f.service.publicDomainSearch(
        { name: "mybrand", extension: ".com.ng" },
        "192.0.2.1",
        f.q,
      ),
      /Too many/,
    );
    await assert.rejects(
      f.service.publicDomainSearch(
        { name: "https://evil.test", extension: ".com" },
        "192.0.2.2",
        f.q,
      ),
      /Use /,
    );
    await assert.rejects(
      f.service.publicDomainSearch({ name: "jktl.com.ng" }, "192.0.2.3", f.q),
      /platform addresses/,
    );
    await f.q("UPDATE domain_prices SET enabled=false WHERE extension='.com'");
    const unsupported = await f.service.publicDomainSearch(
      { name: "mybrand", extension: ".com" },
      "192.0.2.4",
      f.q,
    );
    assert.equal(unsupported.availabilityStatus, "UNSUPPORTED");
    assert.deepEqual(unsupported.results, []);
    assert.equal(unsupported.purchasesEnabled, false);
    await f.db.exec(
      readFileSync(
        new URL("../migrations/056_domain_discovery.sql", import.meta.url),
        "utf8",
      ),
    );
    assert.equal(
      (await f.service.purchaseControls(f.q)).purchasesEnabled,
      true,
    );
  } finally {
    reset();
    await f.db.close();
  }
});
test("concurrent anonymous searches share one provider request per name", async () => {
  const f = await fixture();
  try {
    configure();
    let calls = 0;
    globalThis.fetch = async (url) => {
      calls++;
      return Response.json(valid(new URL(url).searchParams.get("domain")));
    };
    const results = await Promise.all([
      f.service.publicDomainSearch(
        { name: "concurrency", extension: ".com.ng" },
        "192.0.2.10",
        f.q,
      ),
      f.service.publicDomainSearch(
        { name: "concurrency", extension: ".com.ng" },
        "192.0.2.11",
        f.q,
      ),
    ]);
    assert.equal(calls, 3);
    assert.ok(
      results.some((r) => r.results.some((s) => s.status === "AVAILABLE")),
    );
  } finally {
    reset();
    await f.db.close();
  }
});
test("domain-only intent survives login, signup and onboarding without accepting arbitrary redirects", () => {
  for (const domain of ["mybrand.com.ng", "mybrand.ng", "mybrand.com"]) {
    const p = new URLSearchParams({ next: "domains", domain });
    const carried = new URLSearchParams(emailIntent(p));
    assert.equal(carried.get("domain"), domain);
    assert.equal(
      emailDestination(carried),
      "/business/domains?domain=" + domain,
    );
  }
  for (const domain of [
    "https://evil.test",
    "//evil.test",
    "jktl.com.ng",
    "business.jktl.com.ng",
    "evil.com?next=https://evil.test",
  ]) {
    const p = new URLSearchParams({ next: "domains", domain });
    assert.equal(emailDestination(p), "/business/domains");
    assert.equal(emailIntent(p), "?next=domains");
  }
});
