import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { can } from "../src/lib/admin-permissions.ts";
test("marketing upload uses the existing Blob provider, checks file signatures and rights, and keeps Growth submissions in draft", async () => {
  let role = "analyst",
    uploads = 0,
    deleted = 0,
    saved = [],
    fail = false;
  const old = process.env.BLOB_READ_WRITE_TOKEN;
  const deps = {
    "@vercel/blob": {
      put: async (name, b, o) => {
        uploads++;
        assert.ok(name.startsWith("affiliate-materials/"));
        assert.equal(o.contentType, "image/png");
        return {
          url: "https://fixture.public.blob.vercel-storage.com/graphic.png",
        };
      },
      del: async () => {
        deleted++;
      },
    },
    "node:crypto": { randomUUID: () => "fixture-random-id" },
    "@/lib/admin-session": {
      requireAdminCapability: async (cap) => {
        if (!can(role, cap)) throw Error("Denied");
        return { id: "fixture-team", role };
      },
    },
    "@/lib/custom/service": {
      query: async (sql, args) => {
        if (fail) throw Error("Database unavailable");
        saved.push(args);
        return [];
      },
    },
    "@/lib/support/service": { rate: async () => {} },
    "next/cache": { revalidatePath() {} },
  };
  const m = { exports: {} };
  new Function(
    "require",
    "module",
    "exports",
    ts.transpileModule(
      readFileSync(
        new URL(
          "../src/lib/actions/marketing-upload-actions.ts",
          import.meta.url,
        ),
        "utf8",
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
  )((n) => deps[n], m, m.exports);
  const f = new FormData();
  f.set("title", "Approved website graphic");
  f.set("product", "website-builder");
  f.set("audience", "BOTH");
  f.set("rights", "on");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lGQAAAAASUVORK5CYII=",
    "base64",
  );
  f.set("file", new File([png], "graphic.png", { type: "image/png" }));
  try {
    await assert.rejects(m.exports.uploadMarketingGraphicAction(f), /Denied/);
    role = "owner";
    delete process.env.BLOB_READ_WRITE_TOKEN;
    await assert.rejects(
      m.exports.uploadMarketingGraphicAction(f),
      /Uploads are not configured/,
    );
    process.env.BLOB_READ_WRITE_TOKEN = "fixture";
    f.set("file", new File(["<svg/>"], "graphic.png", { type: "image/png" }));
    await assert.rejects(
      m.exports.uploadMarketingGraphicAction(f),
      /valid PNG/,
    );
    f.set("file", new File([png], "graphic.png", { type: "image/png" }));
    await m.exports.uploadMarketingGraphicAction(f);
    assert.equal(saved[0][4], true);
    role = "growth_gaming_lead";
    await m.exports.uploadMarketingGraphicAction(f);
    assert.equal(saved[1][4], false);
    fail = true;
    await assert.rejects(
      m.exports.uploadMarketingGraphicAction(f),
      /Database unavailable/,
    );
    assert.equal(deleted, 1);
    assert.equal(uploads, 3);
  } finally {
    if (old === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = old;
  }
});
