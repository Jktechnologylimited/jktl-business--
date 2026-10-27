import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { readFileSync } from "node:fs";
test("program notices stay queued without delivery configuration and isolate retries from other recipients", async () => {
  const old = process.env.RESEND_API_KEY;
  let queried = 0,
    delivered = [],
    sent = [],
    fail = true;
  const deps = {
    "server-only": {},
    "./push": {
      flushProgrammePush: async () => ({
        configured: false,
        delivered: 0,
        failed: 0,
      }),
    },
    "@/lib/custom/service": {
      query: async (s, p) => {
        queried++;
        if (s.startsWith("WITH picked"))
          return [
            { id: 1, audience: "PROGRAM", affiliate_id: "one" },
            { id: 2, audience: "STAFF", affiliate_id: "two" },
            { id: 3, audience: "PROGRAM", affiliate_id: "empty" },
          ];
        if (s.startsWith("SELECT email FROM admin_users")) {
          assert.ok(s.includes("'owner','affiliate_manager'"));
          return [{ email: "owner@example.test" }];
        }
        if (s.startsWith("SELECT email"))
          return p[0] === "empty" ? [] : [{ email: "member@example.test" }];
        if (s.startsWith("UPDATE distribution_program_notices"))
          delivered.push(p[0]);
        return [];
      },
    },
    "@/lib/email": {
      sendPartnerNoticeEmail: async (input) => {
        sent.push(input);
        if (fail && input.to === "member@example.test")
          throw Error("temporary provider failure");
        return { ok: true };
      },
    },
  };
  const m = { exports: {} };
  new Function(
    "require",
    "module",
    "exports",
    ts.transpileModule(
      readFileSync(
        new URL("../src/lib/distribution/notifications.ts", import.meta.url),
        "utf8",
      ),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } },
    ).outputText,
  )((n) => deps[n], m, m.exports);
  try {
    delete process.env.RESEND_API_KEY;
    assert.equal((await m.exports.flushProgramNotices()).configured, false);
    assert.equal(queried, 0);
    process.env.RESEND_API_KEY = "test-mock-only";
    let result = await m.exports.flushProgramNotices();
    assert.equal(result.failed, 2);
    assert.deepEqual(delivered, [2]);
    assert.equal(sent[1].key, "distribution-notice-2-owner@example.test");
    fail = false;
    delivered = [];
    result = await m.exports.flushProgramNotices();
    assert.deepEqual(delivered, [1, 2]);
    assert.equal(result.failed, 1);
  } finally {
    if (old === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = old;
  }
});
