import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import * as metrics from "../src/lib/site-metrics.ts";
import * as templates from "../src/lib/website-templates.ts";
const require = createRequire(import.meta.url);
test("public event validation rejects client-supplied conversions and malformed identifiers", () => {
  const event = {
    subdomain: "site-one",
    templateId: "law-firm",
    eventId: randomUUID(),
    event: "view",
  };
  assert.equal(
    metrics.parseSiteEvent({ ...event, organizationId: "forged" })
      .organizationId,
    undefined,
  );
  for (const bad of [
    { event: "booking" },
    { event: "unknown" },
    { eventId: "bad" },
    { subdomain: "../../x" },
    { templateId: "<script>" },
  ])
    assert.throws(() => metrics.parseSiteEvent({ ...event, ...bad }));
  assert.equal(
    templates.templatePageKind(templates.getWebsiteTemplate("blank-landing")),
    "landing",
  );
  assert.equal(
    templates.templatePageKind(templates.getWebsiteTemplate("blank-website")),
    "website",
  );
});
test("published metrics API and reporting: origin, publication, deduplication, rate limiting and tenant scope", async (t) => {
  const db = new PGlite();
  try {
    for (const file of readdirSync(new URL("../migrations/", import.meta.url))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.exec(
        readFileSync(
          new URL(`../migrations/${file}`, import.meta.url),
          "utf8",
        ).replace(/CREATE EXTENSION[^;]*;/gi, ""),
      );
    const query = async (text, params) => (await db.query(text, params)).rows;
    const [{ id: a }, { id: b }] = await query(
      "INSERT INTO organizations(name,slug) VALUES('One','site-one'),('Two','site-two') RETURNING id",
      [],
    );
    await query(
      "INSERT INTO business_profiles(organization_id,business_type,display_name,subdomain,website_template_id,published) VALUES($1,'general','One','site-one','law-firm',true),($2,'general','Two','site-two','school',true)",
      [a, b],
    );
    const sql = async (parts, ...values) =>
      query(
        parts.reduce((text, part, i) => text + (i ? `$${i}` : "") + part, ""),
        values,
      );
    sql.query = query;
    const source = readFileSync(
      new URL("../src/app/api/site-metrics/route.ts", import.meta.url),
      "utf8",
    );
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const exports = {};
    const deps = {
      "next/server": require("next/server"),
      "node:crypto": require("node:crypto"),
      "@/lib/db/client": { getSql: () => sql },
      "@/lib/website-templates": templates,
      "@/lib/site-metrics": metrics,
    };
    new Function("require", "exports", compiled)((name) => {
      if (!(name in deps)) throw new Error(name);
      return deps[name];
    }, exports);
    const { NextRequest } = require("next/server");
    const send = (body, options = {}) =>
      exports.POST(
        new NextRequest("https://site-one.jktl.com.ng/api/site-metrics", {
          method: "POST",
          headers: {
            host: "site-one.jktl.com.ng",
            origin: options.origin || "https://site-one.jktl.com.ng",
            "user-agent": options.agent || "Browser",
            "x-forwarded-for": options.ip || "198.51.100.2",
          },
          body: JSON.stringify(body),
        }),
      );
    const event = {
      subdomain: "site-one",
      templateId: "law-firm",
      eventId: randomUUID(),
      event: "view",
      organizationId: b,
    };
    await t.test("origin and event validation fail closed", async () => {
      assert.equal(
        (await send(event, { origin: "https://evil.example" })).status,
        403,
      );
      assert.equal((await send({ ...event, event: "booking" })).status, 400);
    });
    await t.test(
      "server resolves the published tenant and retries do not duplicate an event",
      async () => {
        assert.equal((await send(event)).status, 202);
        assert.equal((await send(event)).status, 202);
        const rows = await query("SELECT * FROM website_metric_events", []);
        assert.equal(rows.length, 1);
        assert.equal(rows[0].organization_id, a);
        assert.equal(
          (
            await send({
              ...event,
              subdomain: "site-two",
              templateId: "school",
              eventId: randomUUID(),
            })
          ).status,
          403,
        );
      },
    );
    await t.test(
      "unpublished or stale template attribution is rejected",
      async () => {
        assert.equal(
          (
            await send({
              ...event,
              templateId: "church",
              eventId: randomUUID(),
            })
          ).status,
          404,
        );
        await query(
          "UPDATE business_profiles SET published=false WHERE organization_id=$1",
          [a],
        );
        assert.equal(
          (await send({ ...event, eventId: randomUUID() })).status,
          404,
        );
        await query(
          "UPDATE business_profiles SET published=true WHERE organization_id=$1",
          [a],
        );
      },
    );
    await t.test(
      "reporting separates tenants, selected templates and confirmed server bookings",
      async () => {
        for (const type of ["cta", "contact", "booking"])
          await metrics.recordSiteEvent(query, {
            organizationId: a,
            templateId: "law-firm",
            eventId: randomUUID(),
            event: type,
            kind: "website",
          });
        await metrics.recordSiteEvent(query, {
          organizationId: a,
          templateId: "school-launch",
          eventId: randomUUID(),
          event: "view",
          kind: "landing",
        });
        await metrics.recordSiteEvent(query, {
          organizationId: b,
          templateId: "school",
          eventId: randomUUID(),
          event: "view",
          kind: "website",
        });
        const rows = await metrics.siteMetrics(query, a);
        assert.equal(rows.length, 2);
        const law = rows.find((r) => r.template_id === "law-firm");
        assert.equal(law.views, 1);
        assert.equal(law.cta_clicks, 1);
        assert.equal(law.contact_clicks, 1);
        assert.equal(law.bookings, 1);
        assert.ok(!rows.some((r) => r.template_id === "school"));
      },
    );
    await t.test(
      "known bots are ignored and request bursts are bounded",
      async () => {
        assert.equal(
          (
            await send(
              { ...event, eventId: randomUUID() },
              { agent: "Example crawler" },
            )
          ).status,
          204,
        );
        for (let i = 0; i < 120; i++)
          assert.equal(
            (
              await send(
                { ...event, eventId: randomUUID() },
                { ip: "198.51.100.99" },
              )
            ).status,
            202,
          );
        assert.equal(
          (
            await send(
              { ...event, eventId: randomUUID() },
              { ip: "198.51.100.99" },
            )
          ).status,
          429,
        );
      },
    );
    await t.test("migration reruns preserve existing metrics", async () => {
      await db.exec(
        readFileSync(
          new URL("../migrations/030_website_metrics.sql", import.meta.url),
          "utf8",
        ),
      );
      assert.ok((await metrics.siteMetrics(query, a)).length);
    });
  } finally {
    await db.close();
  }
});
