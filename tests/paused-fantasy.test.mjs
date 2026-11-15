import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { load } from "./fixtures/lifecycle-db.mjs";

test("public feature discovery hides the retained Fantasy registry entry", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE feature_registry(slug text,name text,category text,route text,description text,is_new boolean,starts_at timestamptz,ends_at timestamptz);
      INSERT INTO feature_registry(slug,name,route,is_new) VALUES('fantasy','JKTL Fantasy','/games/fantasy',true),('tycoon','Business Tycoon','/play/tycoon',true);`);
    const route = load("src/app/api/public/features/route.ts", {
      "next/server": {
        NextResponse: { json: (data, options) => Response.json(data, options) },
      },
      "@/lib/custom/service": {
        query: async (sql) => (await db.query(sql)).rows,
      },
    });
    const response = await route.GET(
      new Request("https://business.jktl.com.ng/api/public/features", {
        headers: { Origin: "https://jktl.com.ng" },
      }),
    );
    assert.equal(response.status, 200);
    assert.deepEqual(
      (await response.json()).features.map((f) => f.slug),
      ["tycoon"],
    );
    assert.equal(
      (await db.query("SELECT * FROM feature_registry WHERE slug='fantasy'"))
        .rows.length,
      1,
    );
    assert.equal(
      response.headers.get("Vercel-CDN-Cache-Control"),
      "public, s-maxage=60",
    );
  } finally {
    await db.close();
  }
});
