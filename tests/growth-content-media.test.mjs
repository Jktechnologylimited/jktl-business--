import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import { can } from "../src/lib/admin-permissions.ts";
import {
  growthContentPermission,
  inlineGrowthImage,
} from "../src/lib/growth/content.ts";

test("content image insertion preserves accessible descriptions without injecting Markdown or unsafe URLs", () => {
  const markdown = inlineGrowthImage({
    id: "image",
    alt: "Team [photo]\\\nCaption",
    url: "https://images.example.test/team(1).png",
  });
  assert.ok(markdown.includes("Team  photo"));
  assert.ok(markdown.includes("team%281%29.png"));
  assert.equal(markdown.match(/!\[/g).length, 1);
  assert.throws(
    () => inlineGrowthImage({ id: "x", alt: "x", url: "javascript:alert(1)" }),
    /HTTPS/,
  );
  assert.throws(
    () =>
      inlineGrowthImage({
        id: "x",
        alt: "x",
        url: "https://user:pass@images.example.test/a.png",
      }),
    /HTTPS/,
  );
});

test("Growth uploads reuse editorial storage with per-category authorization, validation and cleanup", async () => {
  const db = new PGlite();
  await db.exec(
    "CREATE TABLE editorial_media(id uuid DEFAULT gen_random_uuid(),url text,alt text,created_by text)",
  );
  let role = "growth_gaming_lead",
    permissions = {},
    uploads = 0,
    deletes = 0,
    fail = false;
  const invalidated = [];
  const existingToken = process.env.BLOB_READ_WRITE_TOKEN;
  const dependencies = {
    "node:crypto": { randomUUID: () => "fixture-image-id" },
    "@vercel/blob": {
      put: async (path, bytes, options) => {
        uploads++;
        assert.match(path, /^editorial\//);
        assert.equal(options.contentType, "image/png");
        assert.equal(options.access, "public");
        assert.ok(bytes.length > 8);
        return {
          url: "https://fixture.public.blob.vercel-storage.com/image.png",
        };
      },
      del: async () => {
        deletes++;
      },
    },
    "@/lib/admin-session": {
      requireAdminCapability: async (capability) => {
        if (!can(role, capability, permissions)) throw Error("Denied");
        return { id: "growth-person", role };
      },
    },
    "@/lib/growth/content": { growthContentPermission },
    "@/lib/support/service": { rate: async () => {} },
    "next/cache": { revalidatePath: (path) => invalidated.push(path) },
    "@/lib/db/client": {
      getSql:
        () =>
        async (parts, ...values) => {
          if (fail) throw Error("Fixture database failure");
          const sql = parts.reduce(
            (all, part, i) =>
              all + part + (i < values.length ? "$" + (i + 1) : ""),
            "",
          );
          return (await db.query(sql, values)).rows;
        },
    },
  };
  const module = { exports: {} };
  new Function(
    "require",
    "module",
    "exports",
    ts.transpileModule(
      readFileSync("src/lib/actions/editorial-media-actions.ts", "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
  )(
    (name) => {
      if (!(name in dependencies)) throw Error(name);
      return dependencies[name];
    },
    module,
    module.exports,
  );
  const form = new FormData();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lGQAAAAASUVORK5CYII=",
    "base64",
  );
  form.set("file", new File([png], "event.png", { type: "image/png" }));
  form.set("alt", "Community game event");
  form.set("rights", "on");
  form.set("growthCategory", "games");
  const upload = () => module.exports.uploadEditorialImageAction(form);
  try {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    await assert.rejects(upload(), /not configured/);
    process.env.BLOB_READ_WRITE_TOKEN = "fixture-only";
    permissions = { growth_games: false };
    await assert.rejects(upload(), /Denied/);
    // A different permitted category cannot grant editorial access.
    form.delete("growthCategory");
    await assert.rejects(upload(), /Denied/);
    form.set("growthCategory", "owner");
    await assert.rejects(upload(), /Choose a content category/);
    form.set("growthCategory", "games");
    permissions = {};
    role = "support";
    await assert.rejects(upload(), /Denied/);
    role = "growth_gaming_lead";
    form.delete("rights");
    await assert.rejects(upload(), /confirm image rights/);
    form.set("rights", "on");
    form.set(
      "file",
      new File(["<svg onload='alert(1)' />"], "fake.png", {
        type: "image/png",
      }),
    );
    await assert.rejects(upload(), /valid PNG/);
    form.set(
      "file",
      new File([new Uint8Array(524289)], "big.png", { type: "image/png" }),
    );
    await assert.rejects(upload(), /512 KB/);
    form.set("file", new File([png], "fake.jpg", { type: "image/jpeg" }));
    await assert.rejects(upload(), /valid PNG/);
    assert.equal(uploads, 0);
    form.set("file", new File([png], "event.png", { type: "image/png" }));
    const image = await upload();
    assert.equal(image.alt, "Community game event");
    assert.match(image.id, /^[0-9a-f-]{36}$/);
    assert.equal(
      (await db.query("SELECT * FROM editorial_media")).rows[0].created_by,
      "growth-person",
    );
    assert.deepEqual(invalidated, [
      "/admin/content",
      "/admin/growth/content",
      "/admin/growth/games",
      "/admin/growth/community",
    ]);
    fail = true;
    await assert.rejects(upload(), /database failure/);
    assert.equal(deletes, 1);
    assert.equal(
      (await db.query("SELECT * FROM editorial_media")).rows.length,
      1,
    );
    // Existing editorial upload flow keeps its permission and return compatibility.
    fail = false;
    role = "writer";
    form.delete("growthCategory");
    await upload();
    assert.equal(
      (await db.query("SELECT * FROM editorial_media")).rows.length,
      2,
    );
  } finally {
    if (existingToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = existingToken;
    await db.close();
  }
});
