import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { load } from "./fixtures/lifecycle-db.mjs";
import * as model from "../src/lib/custom/model.ts";

const project = "abcd0000-0000-4000-8000-000000000001";
const org = "abcd0000-0000-4000-8000-000000000002";
const other = "abcd0000-0000-4000-8000-000000000003";
const otherProject = "abcd0000-0000-4000-8000-000000000004";
const user = "abcd0000-0000-4000-8000-000000000005";

async function fixture() {
  const db = new PGlite(), calls = [], invalidations = [], entries = new Map();
  let failing = false, pause = null, clock = 0;
  const q = async (sql, args = []) => {
    calls.push({ sql, args });
    if (failing) throw Error("private database failure");
    if (pause && sql.startsWith("SELECT published")) await pause;
    return (await db.query(sql, args)).rows;
  };
  await db.exec(`CREATE TABLE users(id uuid PRIMARY KEY);
    CREATE TABLE custom_projects(id uuid PRIMARY KEY,organization_id uuid,managed_cms boolean DEFAULT true,billing_only boolean DEFAULT false,status text DEFAULT 'LIVE',revision integer DEFAULT 1,UNIQUE(id,organization_id));
    CREATE TABLE domain_rate_limits(bucket text PRIMARY KEY,hits integer NOT NULL,expires_at timestamptz NOT NULL);
    INSERT INTO users VALUES('${user}');
    INSERT INTO custom_projects(id,organization_id) VALUES('${project}','${org}'),('${otherProject}','${other}');`);
  await db.exec(readFileSync(new URL("../migrations/063_custom_site_content.sql", import.meta.url), "utf8"));
  await db.query(`INSERT INTO custom_site_content(project_id,organization_id,revision,draft,published,audit)
    VALUES($1,$2,1,'{"title":"SECRET DRAFT"}','{"title":"Public one"}','[{"actor":"PRIVATE AUDIT"}]'),
    ($3,$4,1,'{"title":"OTHER DRAFT"}','{"title":"Other public"}','[]')`, [project, org, otherProject, other]);
  // An isolated test cache, not a claim about measured Vercel CDN behaviour.
  const nextCache = {
    unstable_cache: (fn, keys, options) => async (...args) => {
      const key = JSON.stringify([keys, args]);
      const hit = entries.get(key);
      if (hit && hit.until > clock) return structuredClone(hit.value);
      const value = await fn(...args); // Rejections are not cached.
      entries.set(key, { value: structuredClone(value), tags: options.tags, until: clock + options.revalidate });
      return value;
    },
    revalidateTag: (tag, profile) => {
      assert.deepEqual(profile, { expire: 0 }); invalidations.push(tag);
      for (const [key, entry] of entries) if (entry.tags.includes(tag)) entries.delete(key);
    },
  };
  const tags = load("src/lib/custom/site-cache-tags.ts", { "server-only": {}, "next/cache": nextCache });
  const domains = load("src/lib/domains/store.ts", { "./model": load("src/lib/domains/model.ts") });
  const store = load("src/lib/custom/site-store.ts", {
    "server-only": {}, "./service": { query: q }, "./model": model,
    "@/lib/domains/store": domains, "./site-cache-tags": tags,
  });
  const managed = load("src/lib/custom/managed-site.ts", {
    "server-only": {}, "./service": { query: q }, "./model": model,
    "./site-store": store, "./site-schema": {},
  });
  const published = load("src/lib/custom/published-site.ts", {
    "server-only": {}, "next/cache": nextCache, "./service": { query: q }, "./model": model,
    "./site-store": store, "./managed-site": managed, "@/lib/domains/store": domains,
    "./site-cache-tags": tags,
  });
  const route = load("src/app/api/custom/sites/[projectId]/content/route.ts", {
    "@/lib/custom/published-site": published, "@/lib/custom/site-store": store,
    "@/lib/domains/store": domains,
  });
  const get = (p = project) => route.GET(new Request("https://business.example/content"), { params: Promise.resolve({ projectId: p }) });
  const access = { project, organization: org, user, scopes: ["content:read", "content:write", "content:publish"] };
  return { db, q, calls, entries, invalidations, tags, store, published, get, access,
    fail: value => { failing = value; }, pause: value => { pause = value; }, advance: seconds => { clock += seconds; } };
}

test("published content projects only public fields; cold/warm requests use two/one DB round trips", async () => {
  const f = await fixture();
  try {
    let result = await f.get();
    assert.equal(result.status, 200); assert.deepEqual(await result.json(), { published: { title: "Public one" } });
    assert.equal(f.calls.length, 2);
    assert.match(f.calls[1].sql, /^SELECT published FROM/);
    assert.doesNotMatch(f.calls.map(c => c.sql).join(" "), /\bdraft\b|\baudit\b/);
    for (const header of ["cache-control", "cdn-cache-control", "vercel-cdn-cache-control"]) assert.equal(result.headers.get(header), "no-store");
    assert.equal(result.headers.get("set-cookie"), null);
    f.calls.length = 0;
    result = await f.get(project.toUpperCase());
    assert.deepEqual(await result.json(), { published: { title: "Public one" } });
    assert.equal(f.calls.length, 1, "warm request still checks eligibility and writes its rate count");
    assert.equal((await f.db.query("SELECT hits FROM domain_rate_limits")).rows[0].hits, 2);
    f.calls.length = 0; f.advance(301); await f.get(); assert.equal(f.calls.length, 2);
    const encoded = JSON.stringify([...f.entries.values()]);
    assert.doesNotMatch(encoded, /SECRET DRAFT|PRIVATE AUDIT|organization_id|user/);
  } finally { await f.db.close(); }
});

test("draft isolation, publish invalidation and revision keys prevent stale/in-flight publication reuse", async () => {
  const f = await fixture();
  try {
    await f.get();
    await f.store.saveSiteContent(f.access, { title: "Unpublished new" }, 1, "draft");
    assert.deepEqual(f.invalidations, []);
    assert.deepEqual(await (await f.get()).json(), { published: { title: "Public one" } });
    await f.store.saveSiteContent(f.access, { title: "Published new" }, 2, "publish");
    assert.ok(f.invalidations.includes("managed-site:" + project));
    assert.deepEqual(await (await f.get()).json(), { published: { title: "Published new" } });
    await assert.rejects(() => f.store.saveSiteContent(f.access, { title: "Wrong revision" }, 1, "publish"));
    const before = f.invalidations.length;
    await assert.rejects(() => f.store.saveSiteContent({ ...f.access, organization: other }, { title: "Foreign" }, 3, "publish"));
    assert.equal(f.invalidations.length, before);
    // Old cached keys may exist on another instance, but the current DB revision selects a new key.
    await f.q("UPDATE custom_site_content SET published='{" + '"title":"Externally versioned"' + "}',revision=revision+1 WHERE project_id=$1", [project]);
    assert.deepEqual(await (await f.get()).json(), { published: { title: "Externally versioned" } });
    assert.equal((await f.store.loadSiteContent(f.access, "draft")).draft.title, "Published new");
    await assert.rejects(() => f.store.loadSiteContent({ ...f.access, user: undefined }, "draft"));
  } finally { await f.db.close(); }
});

test("every cached request checks suspension, billing-only mode, CMS deactivation, deletion and tenant", async () => {
  const f = await fixture();
  try {
    await f.get();
    for (const [change, restore] of [["status='SUSPENDED'", "status='LIVE'"], ["managed_cms=false", "managed_cms=true"], ["billing_only=true", "billing_only=false"]]) {
      await f.q(`UPDATE custom_projects SET ${change},revision=revision+1 WHERE id=$1`, [project]);
      f.calls.length = 0; assert.equal((await f.get()).status, 404); assert.equal(f.calls.length, 1);
      await f.q(`UPDATE custom_projects SET ${restore},revision=revision+1 WHERE id=$1`, [project]);
      assert.equal((await f.get()).status, 200);
    }
    assert.deepEqual(await (await f.get(otherProject)).json(), { published: { title: "Other public" } });
    assert.deepEqual(await f.store.loadSiteContent({ ...f.access, organization: other }, "published"), { published: null });
    await f.q("DELETE FROM custom_site_content WHERE project_id=$1", [project]);
    await f.q("UPDATE custom_projects SET organization_id=$2,revision=revision+1 WHERE id=$1", [project, other]);
    assert.deepEqual(await (await f.get()).json(), { published: null }, "a transfer cannot reuse old-tenant data");
    await f.q("DELETE FROM custom_projects WHERE id=$1", [project]);
    assert.equal((await f.get()).status, 404);
  } finally { await f.db.close(); }
});

test("cache hits retain the 1000/minute distributed limit and return noncached 429 with Retry-After", async t => {
  t.mock.method(Date, "now", () => 1800000000123);
  const f = await fixture();
  try {
    await f.get(); await f.q("UPDATE domain_rate_limits SET hits=999");
    assert.equal((await f.get()).status, 200);
    f.calls.length = 0;
    const denied = await f.get(); assert.equal(denied.status, 429); assert.equal(f.calls.length, 1);
    assert.equal(denied.headers.get("retry-after"), "60"); assert.equal(denied.headers.get("cache-control"), "no-store");
    assert.equal((await f.db.query("SELECT hits FROM domain_rate_limits")).rows[0].hits, 1000);
    assert.doesNotMatch(JSON.stringify(await denied.json()), /Public one|private/);
    await f.q("DELETE FROM domain_rate_limits"); assert.equal((await f.get()).status, 200);
    f.calls.length = 0; assert.equal((await f.get("not-a-uuid")).status, 404); assert.equal(f.calls.length, 0);
  } finally { await f.db.close(); }
});

test("cache misses coalesce within an instance, errors are not cached and failed admissions fail closed", async () => {
  const f = await fixture();
  try {
    let resume; f.pause(new Promise(resolve => { resume = resolve; }));
    const requests = Array.from({ length: 8 }, () => f.get());
    for (let attempts = 0; attempts < 100 && !f.calls.some(c => c.sql.startsWith("SELECT published")); attempts++)
      await new Promise(resolve => setTimeout(resolve, 1));
    resume(); f.pause(null);
    assert.ok((await Promise.all(requests)).every(r => r.status === 200));
    assert.equal(f.calls.filter(c => c.sql.startsWith("SELECT published")).length, 1);
    assert.equal(f.calls.length, 9, "eight mandatory admissions plus one public content read");
    f.fail(true); const failed = await f.get(); assert.equal(failed.status, 503);
    assert.equal(failed.headers.get("cache-control"), "no-store");
    assert.doesNotMatch(JSON.stringify(await failed.json()), /private|Public one/);
    f.fail(false); assert.equal((await f.get()).status, 200);
    const stale = await f.published.admitPublishedSite(project);
    await f.q("UPDATE custom_site_content SET revision=revision+1 WHERE project_id=$1", [project]);
    f.tags.invalidateManagedSite(project, org);
    await assert.rejects(() => f.published.cachedPublishedSite(stale), e => e.status === 409);
    assert.equal(f.entries.size, 0, "the stale-read error is not cached");
    assert.equal((await f.get()).status, 200);
  } finally { await f.db.close(); }
});

test("managed content TTL configuration is bounded", async () => {
  const f = await fixture(), original = process.env.JKTL_MANAGED_CONTENT_REVALIDATE_SECONDS;
  try {
    for (const [input, expected] of [["300", 300], ["60", 60], ["3600", 3600], ["0", 300], ["99999", 300], ["NaN", 300]]) {
      process.env.JKTL_MANAGED_CONTENT_REVALIDATE_SECONDS = input;
      assert.equal(f.published.publishedContentRevalidation(), expected);
    }
  } finally {
    if (original === undefined) delete process.env.JKTL_MANAGED_CONTENT_REVALIDATE_SECONDS; else process.env.JKTL_MANAGED_CONTENT_REVALIDATE_SECONDS = original;
    await f.db.close();
  }
});

test("public catalogue successes have a strict 60-second CDN lifetime; errors never cache", async () => {
  const cache = load("src/lib/public-response-cache.ts");
  const next = { NextResponse: { json: (body, init) => Response.json(body, init) } };
  for (const [file, moduleName, method, result] of [
    ["domain-prices", "@/lib/domains/service", "publicPrices", [{ extension: ".ng", registration_price: 1000 }]],
    ["email-plans", "@/lib/business-email/service", "emailPlans", [{ id: "public-plan", price_kobo: 2000 }]],
    ["transaction-fees", "@/lib/merchant-fees/service", "activeFeePolicy", { enabled: true, bands: [{ minKobo: 0, feeKobo: 10 }], sources: ["INVOICE"] }],
  ]) {
    let fail = false;
    const route = load(`src/app/api/public/${file}/route.ts`, {
      "next/server": next, "@/lib/public-response-cache": cache,
      [moduleName]: { activationGate: () => "live", [method]: async (...args) => { assert.equal(args.length, 0); if (fail) throw Error("private"); return result; } },
    });
    const ok = await route.GET(); assert.equal(ok.status, 200);
    assert.equal(ok.headers.get("vercel-cdn-cache-control"), "public, s-maxage=60");
    assert.equal(ok.headers.get("cache-control"), "public, max-age=0, must-revalidate");
    assert.equal(ok.headers.get("set-cookie"), null);
    fail = true; const error = await route.GET(); assert.equal(error.status, 503);
    for (const header of ["cache-control", "cdn-cache-control", "vercel-cdn-cache-control"]) assert.equal(error.headers.get(header), "no-store");
    assert.doesNotMatch(JSON.stringify(await error.json()), /private/);
  }
  const publications = load("src/app/api/publications/route.ts", {
    "next/server": next, "@/lib/public-response-cache": cache,
    "@/lib/publications": { PUBLICATION_KINDS: ["blog"] },
    "@/lib/db/publications": { publishedArticles: async (kind, slug, offset) => { assert.equal(kind, "blog"); assert.equal(offset, 0); return slug ? [] : [{ title: "Public" }]; } },
  });
  const req = query => ({ nextUrl: new URL("https://business.example/api/publications?" + query) });
  assert.equal((await publications.GET(req("kind=blog"))).headers.get("cdn-cache-control"), "public, s-maxage=60");
  for (const query of ["kind=private", "kind=blog&offset=-1", "kind=blog&slug=not-found"]) assert.equal((await publications.GET(req(query))).headers.get("cdn-cache-control"), "no-store");
});
