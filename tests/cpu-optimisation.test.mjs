import test from "node:test";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server.js";
test("middleware skips pass-through assets while retaining tenant and protected routes", () => {
  const source = readFileSync(
    new URL("../middleware.ts", import.meta.url),
    "utf8",
  );
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      source.slice(source.lastIndexOf("export const config")),
      {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
      },
    ).outputText,
    { exports },
  );
  const matches = (url) =>
    unstable_doesMiddlewareMatch({
      config: exports.config,
      nextConfig: {},
      url,
    });
  for (const url of [
    "/template-photos/person.webp",
    "/fonts/body.woff2",
    "/preview.mp4",
    "/api/site-metrics",
  ])
    assert.equal(matches(url), false, url);
  for (const url of [
    "/",
    "/business",
    "/admin",
    "/api/paystack/webhook",
    "/sites/tenant",
    "/robots.txt",
    "/sitemap.xml",
  ])
    assert.equal(matches(url), true, url);
});
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function moduleAt(file, globals = {}) {
  const code = ts.transpileModule(
    readFileSync(new URL(file, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, ...globals });
  return exports;
}
const { needsBusinessBootstrap } = moduleAt("../src/lib/business-bootstrap.ts");
test("only Business workspace and onboarding/auth routes hydrate private offline data", () => {
  for (const path of [
    "/business",
    "/business/invoices",
    "/onboarding",
    "/login",
    "/signup",
  ])
    assert.equal(needsBusinessBootstrap(path), true, path);
  for (const path of [
    "/",
    "/templates",
    "/template-canvas/lumi-atelier",
    "/sites/customer",
    "/play/tycoon",
    "/chatbots/c/site",
    "/partners/login",
    "/admin/login",
    "/login-other",
  ])
    assert.equal(needsBusinessBootstrap(path), false, path);
});
test("polling coalesces, pauses hidden tabs, refreshes on return and cleans up", async () => {
  let now = 0,
    id = 0,
    calls = 0,
    resolve;
  const timers = new Map();
  function target() {
    const events = new Map();
    return {
      events,
      hidden: false,
      addEventListener(k, f) {
        if (!events.has(k)) events.set(k, new Set());
        events.get(k).add(f);
      },
      removeEventListener(k, f) {
        events.get(k)?.delete(f);
      },
      emit(k) {
        for (const f of events.get(k) || []) f();
      },
    };
  }
  const document = target(),
    window = target();
  const { startVisiblePolling } = moduleAt(
    "../src/lib/browser/visible-polling.ts",
    {
      document,
      window,
      Date: { now: () => now },
      setTimeout: (f, delay) => {
        timers.set(++id, { f, at: now + delay });
        return id;
      },
      clearTimeout: (i) => timers.delete(i),
    },
  );
  const flush = async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
  };
  const advance = async (ms) => {
    now += ms;
    for (const [key, t] of [...timers])
      if (t.at <= now) {
        timers.delete(key);
        t.f();
      }
    await flush();
  };
  const stop = startVisiblePolling(
    () => {
      calls++;
      return new Promise((r) => (resolve = r));
    },
    30000,
    1000,
  );
  await flush();
  assert.equal(calls, 1);
  window.emit("focus");
  await advance(60000);
  assert.equal(calls, 1, "no overlap while request pending");
  resolve();
  await flush();
  document.hidden = true;
  document.emit("visibilitychange");
  await advance(120000);
  assert.equal(calls, 1);
  assert.equal(timers.size, 0);
  document.hidden = false;
  document.emit("visibilitychange");
  await flush();
  assert.equal(calls, 2, "returning tab refreshes");
  stop();
  resolve();
  await flush();
  await advance(120000);
  window.emit("focus");
  await flush();
  assert.equal(calls, 2);
  assert.equal(timers.size, 0);
  assert.equal(window.events.get("focus").size, 0);
});
test("poll rejection waits for the next interval rather than retrying immediately", async () => {
  let now = 0,
    calls = 0;
  const timers = new Map();
  let id = 0;
  const target = {
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
  };
  const { startVisiblePolling } = moduleAt(
    "../src/lib/browser/visible-polling.ts",
    {
      document: target,
      window: target,
      Date: { now: () => now },
      setTimeout: (f, d) => {
        timers.set(++id, { f, d });
        return id;
      },
      clearTimeout: (i) => timers.delete(i),
    },
  );
  const stop = startVisiblePolling(async () => {
    calls++;
    throw Error("network unavailable");
  }, 30000);
  for (let i = 0; i < 15; i++) await Promise.resolve();
  assert.equal(calls, 1);
  assert.equal([...timers.values()][0].d, 30000);
  stop();
  assert.equal(timers.size, 0);
});
test("only public feature successes are CDN cacheable; errors stay uncached and CORS varies by origin", async () => {
  const source = readFileSync(
    new URL("../src/app/api/public/features/route.ts", import.meta.url),
    "utf8",
  );
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  let fail = false;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require: (name) =>
      name === "next/server"
        ? { NextResponse: { json: (body, init) => Response.json(body, init) } }
        : {
            query: async () => {
              if (fail) throw Error("DB unavailable");
              return [
                {
                  slug: "domains",
                  route: "/domains",
                  show_new: true,
                  ends_at: null,
                },
              ];
            },
          },
  });
  for (const origin of ["https://jktl.com.ng", "https://www.jktl.com.ng"]) {
    const r = await exports.GET(
      new Request("https://business.jktl.com.ng/api/public/features", {
        headers: { Origin: origin, Cookie: "private=value" },
      }),
    );
    assert.equal(r.headers.get("access-control-allow-origin"), origin);
    assert.equal(r.headers.get("vary"), "Origin");
    assert.match(r.headers.get("vercel-cdn-cache-control"), /s-maxage=60/);
    assert.equal(r.headers.has("set-cookie"), false);
    assert.equal((await r.json()).features[0].slug, "domains");
  }
  fail = true;
  const r = await exports.GET(
    new Request("https://business.jktl.com.ng/api/public/features"),
  );
  assert.equal(r.status, 503);
  assert.equal(r.headers.get("vercel-cdn-cache-control"), "no-store");
});
