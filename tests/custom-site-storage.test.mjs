import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import * as model from "../src/lib/custom/model.ts";
const require = createRequire(import.meta.url);
function load(file, deps) {
  const code = ts.transpileModule(
      readFileSync(new URL(file, import.meta.url), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    m = { exports: {} };
  new Function("require", "module", "exports", code)(
    (n) => (n in deps ? deps[n] : require(n)),
    m,
    m.exports,
  );
  return m.exports;
}
const project = "10000000-0000-4000-8000-000000000001",
  org = "10000000-0000-4000-8000-000000000002",
  other = "10000000-0000-4000-8000-000000000003",
  user = "10000000-0000-4000-8000-000000000004",
  key = "a".repeat(64);
test("PostgreSQL stores scoped drafts, atomic publication and bounded audit without Blob", async () => {
  const db = new PGlite(),
    query = async (s, p = []) => (await db.query(s, p)).rows;
  try {
    await db.exec(
      `CREATE TABLE users(id uuid PRIMARY KEY);CREATE TABLE custom_projects(id uuid PRIMARY KEY,organization_id uuid,cms_key_hash text,status text,UNIQUE(id,organization_id));INSERT INTO users VALUES('${user}');INSERT INTO custom_projects VALUES('${project}','${org}','${model.digest(key)}','LIVE');`,
    );
    const migration = readFileSync(
      new URL("../migrations/063_custom_site_content.sql", import.meta.url),
      "utf8",
    );
    await db.exec(migration);
    await db.exec(migration);
    let scopes = ["content:read", "content:write", "content:publish"];
    const store = load("../src/lib/custom/site-store.ts", {
      "server-only": {},
      "./service": {
        query,
        validateCmsSession: async (p, k, u, o) =>
          p === project && k === key && u === user && o === org
            ? { cms_scopes: scopes }
            : null,
      },
      "./model": model,
      "@/lib/domains/store": { rateLimit: async () => {} },
    });
    const request = (headers = {}) =>
      new Request("https://business.jktl.com.ng/api/custom/cms/content", {
        headers: {
          authorization: "Bearer " + key,
          "x-jktl-user-id": user,
          "x-jktl-organization-id": org,
          ...headers,
        },
      });
    await assert.rejects(() =>
      store.authorizeSite(
        request({ authorization: "Bearer wrong" }),
        project,
        "read",
      ),
    );
    await assert.rejects(() =>
      store.authorizeSite(
        request({ "x-jktl-organization-id": other }),
        project,
        "read",
      ),
    );
    const access = await store.authorizeSite(request(), project, "publish"),
      publicAccess = await store.authorizeSite(request(), project, "public");
    assert.deepEqual(await store.loadSiteContent(publicAccess, "published"), {
      published: null,
    });
    await assert.rejects(() => store.loadSiteContent(publicAccess, "draft"));
    let draft = await store.saveSiteContent(
      access,
      { heroTitle: "Draft one" },
      0,
      "draft",
    );
    assert.equal(draft.revision, 1);
    assert.equal(draft.published, null);
    await assert.rejects(
      () =>
        store.saveSiteContent(access, { heroTitle: "Duplicate" }, 0, "publish"),
      (e) => e.status === 409,
    );
    let published = await store.saveSiteContent(
      access,
      { heroTitle: "Published" },
      1,
      "publish",
    );
    assert.equal(published.revision, 2);
    assert.equal(published.published.heroTitle, "Published");
    await store.saveSiteContent(
      access,
      { heroTitle: "Unpublished" },
      2,
      "draft",
    );
    assert.equal(
      (await store.loadSiteContent(publicAccess, "published")).published
        .heroTitle,
      "Published",
    );
    await assert.rejects(
      () => store.saveSiteContent(access, { heroTitle: "Stale" }, 1, "publish"),
      (e) => e.status === 409,
    );
    await assert.rejects(
      () =>
        store.saveSiteContent(
          { ...access, organization: other },
          { heroTitle: "Cross tenant" },
          3,
          "publish",
        ),
      (e) => e.status === 409,
    );
    scopes = ["content:read"];
    await assert.rejects(
      () => store.authorizeSite(request(), project, "write"),
      (e) => e.status === 403,
    );
    await assert.rejects(
      () =>
        store.saveSiteContent(
          { ...access, scopes },
          { heroTitle: "Escalated" },
          3,
          "publish",
        ),
      (e) => e.status === 403,
    );
    scopes = access.scopes;
    const attempts = await Promise.allSettled([
      store.saveSiteContent(
        access,
        { heroTitle: "Concurrent A" },
        3,
        "publish",
      ),
      store.saveSiteContent(
        access,
        { heroTitle: "Concurrent B" },
        3,
        "publish",
      ),
    ]);
    assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
    for (let rev = 4; rev < 108; rev++)
      await store.saveSiteContent(
        access,
        { heroTitle: "Audit " + rev },
        rev,
        "draft",
      );
    const final = await store.loadSiteContent(access, "draft");
    assert.equal(final.audit.length, 100);
    assert.equal(final.audit.at(-1).actor, user);
    assert.deepEqual(
      await store.loadSiteContent(
        { ...publicAccess, organization: other },
        "published",
      ),
      { published: null },
    );
    const png = Buffer.from([
      137,
      80,
      78,
      71,
      13,
      10,
      26,
      10,
      ...Array(20).fill(0),
    ]);
    assert.equal(await store.saveSiteMedia(access, other, png), "image/png");
    const media = await store.loadSiteMedia(publicAccess, other);
    assert.equal(media.type, "image/png");
    assert.deepEqual(Buffer.from(media.bytes), png);
    await assert.rejects(
      () =>
        store.loadSiteMedia({ ...publicAccess, organization: other }, other),
      (e) => e.status === 404,
    );
    await assert.rejects(() =>
      store.saveSiteMedia(access, user, Buffer.from('<svg onload="evil"/>')),
    );
    await assert.rejects(
      () =>
        store.saveSiteMedia({ ...access, scopes: ["content:read"] }, user, png),
      (e) => e.status === 403,
    );
    const rows = await query("SELECT * FROM custom_site_content");
    assert.equal(rows.length, 1);
    await db.exec(migration);
    assert.equal(
      (await query("SELECT revision FROM custom_site_content"))[0].revision,
      108,
    );
  } finally {
    await db.close();
  }
});
test("storage validates bounded payloads and rejects injected field paths", async () => {
  const store = load("../src/lib/custom/site-store.ts", {
    "server-only": {},
    "./service": {},
    "./model": model,
    "@/lib/domains/store": {},
  });
  for (const value of [
    null,
    [],
    { "bad/path": "x" },
    { title: 123 },
    { title: "x".repeat(10001) },
  ])
    assert.throws(() => store.contentFields(value));
  assert.throws(() =>
    store.contentFields({
      title: "x".repeat(10000),
      ...Object.fromEntries(
        Array.from({ length: 25 }, (_, i) => ["field" + i, "x".repeat(10000)]),
      ),
    }),
  );
  await assert.rejects(
    () =>
      store.boundedBody(
        new Request("https://example.test", {
          method: "POST",
          body: "x".repeat(11),
        }),
        10,
      ),
    (e) => e.status === 413,
  );
});
