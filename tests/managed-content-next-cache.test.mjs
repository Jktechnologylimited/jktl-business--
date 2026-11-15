import test from "node:test";
import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { load } from "./fixtures/lifecycle-db.mjs";

test("installed Next Data Cache reuses public snapshots even in a force-dynamic route", async () => {
  const previousStorage = globalThis.AsyncLocalStorage;
  globalThis.AsyncLocalStorage = AsyncLocalStorage;
  const cache = await import("next/cache.js");
  const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external.js");
  const entries = new Map();
  // Actual Next cache serialization/keying with an isolated in-memory storage adapter.
  const incrementalCache = {
    generateSimpleCacheKey: async value => value,
    get: async key => entries.has(key) ? { value: entries.get(key), isStale: false } : null,
    set: async (key, value) => { entries.set(key, structuredClone(value)); },
  };
  let reads = 0, failing = false;
  const published = load("src/lib/custom/published-site.ts", {
    "server-only": {}, "next/cache": cache, "./service": {}, "./model": {},
    "./managed-site": {}, "@/lib/domains/store": {},
    "./site-cache-tags": { managedSiteTag: p => "project:" + p, managedOrganizationTag: o => "org:" + o },
    "./site-store": { loadSiteContent: async (access, view, revision) => {
      assert.equal(view, "published"); assert.deepEqual(access.scopes, []); assert.equal(access.user, undefined);
      reads++; if (failing) throw Error("fixture DB failure");
      return { published: { title: `Public revision ${revision}` } };
    } },
  });
  const access = { project: "public-project", organization: "org-one", scopes: [], contentRevision: 1, projectRevision: 1 };
  const read = async value => {
    const work = { incrementalCache, forceDynamic: true, isStaticGeneration: false, nextFetchId: 1, pendingRevalidates: {} };
    return workAsyncStorage.run(work, async () => {
      const result = await published.cachedPublishedSite(value);
      await Promise.all(Object.values(work.pendingRevalidates));
      return result;
    });
  };
  try {
    assert.deepEqual(await read(access), { published: { title: "Public revision 1" } });
    await read(access); assert.equal(reads, 1);
    await read({ ...access, organization: "org-two" }); assert.equal(reads, 2);
    await read({ ...access, projectRevision: 2 }); assert.equal(reads, 3);
    await read({ ...access, contentRevision: 2 }); assert.equal(reads, 4);
    failing = true;
    await assert.rejects(() => read({ ...access, contentRevision: 3 }));
    await assert.rejects(() => read({ ...access, contentRevision: 3 }));
    assert.equal(reads, 6, "Next never caches the rejected callback");
    failing = false; await read({ ...access, contentRevision: 3 }); assert.equal(reads, 7);
    for (const value of entries.values()) assert.deepEqual(Object.keys(JSON.parse(value.data.body)), ["published"]);
  } finally {
    if (previousStorage === undefined) delete globalThis.AsyncLocalStorage; else globalThis.AsyncLocalStorage = previousStorage;
  }
});
