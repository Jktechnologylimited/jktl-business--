import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { load } from "./fixtures/lifecycle-db.mjs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import * as workflow from "../src/lib/partners/workflow.ts";
const { PARTNER_CLIENTS_SQL } = load("src/lib/partners/dashboard.ts", {
  "server-only": {},
  "@/lib/custom/service": {},
});
const link = {
  __esModule: true,
  default: ({ children, ...props }) => createElement("a", props, children),
};
test("portfolio rows are scoped by partner and hide live website details after access changes", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `CREATE TABLE partner_workspaces(id text,partner_id text,business_name text,organization_id text,contact_name text,contact_email text,template_id text,created_at timestamptz DEFAULT now());CREATE TABLE partner_client_access(id text,partner_id text,organization_id text,revoked_at timestamptz,scopes text[]);CREATE TABLE business_profiles(organization_id text,website_template_id text,published boolean,subdomain text);INSERT INTO partner_workspaces VALUES('draft','p','Draft',NULL,'Owner','owner@example.test','',now()),('client','p','Client','org','Owner','owner@example.test','law-firm',now()),('foreign','other','Other client','other-org','Other','other@example.test','',now());INSERT INTO partner_client_access VALUES('grant','p','org',NULL,ARRAY['MANAGE_WEBSITE_CONTENT','PUBLISH_WEBSITE']);INSERT INTO business_profiles VALUES('org','law-firm',true,'client-site');`,
    );
    let rows = (await db.query(PARTNER_CLIENTS_SQL, ["p"])).rows;
    assert.equal(rows.length, 2);
    assert.equal(
      workflow.clientStage(rows.find((r) => r.id === "client")),
      "published",
    );
    assert.equal(
      workflow.clientStage(rows.find((r) => r.id === "draft")),
      "draft",
    );
    await db.exec(
      "UPDATE partner_client_access SET scopes=ARRAY['VIEW_ALLOWED_SERVICES']",
    );
    rows = (await db.query(PARTNER_CLIENTS_SQL, ["p"])).rows;
    const restricted = rows.find((r) => r.id === "client");
    assert.equal(restricted.subdomain, null);
    assert.equal(restricted.live_template, null);
    assert.equal(workflow.clientStage(restricted), "access-needed");
    await db.exec("UPDATE partner_client_access SET revoked_at=now()");
    assert.equal(
      (await db.query(PARTNER_CLIENTS_SQL, ["p"])).rows.find(
        (r) => r.id === "client",
      ).access_active,
      false,
    );
  } finally {
    await db.close();
  }
});
test("stages distinguish draft, owner approval, permissions, readiness and publication", () => {
  assert.equal(
    workflow.clientStage({ template_id: "law-firm" }),
    "awaiting-owner",
  );
  assert.equal(
    workflow.clientStage({
      organization_id: "o",
      access_active: false,
      published: true,
    }),
    "access-needed",
  );
  assert.equal(
    workflow.clientStage({
      organization_id: "o",
      access_active: true,
      can_edit: true,
    }),
    "ready-to-build",
  );
  assert.equal(
    workflow.clientStage({
      organization_id: "o",
      access_active: true,
      can_edit: true,
      live_template: "law-firm",
    }),
    "ready-to-publish",
  );
  assert.equal(
    workflow.safeWebsiteUrl("client-name"),
    "https://client-name.jktl.com.ng",
  );
  for (const s of [
    "https://evil.test",
    "name.evil.test",
    "../client",
    "x@evil",
    "",
  ])
    assert.equal(workflow.safeWebsiteUrl(s), null);
});
test("billing cards distinguish the billing party and never offer pay again for a verified paid invoice", async () => {
  const page = load("src/app/partners/(dashboard)/billing/page.tsx", {
    "next/link": link,
    "@/lib/partners/access": { approvedPartner: async () => ({ id: "p" }) },
    "@/lib/custom/service": {
      query: async (s, args) => {
        assert.equal(args[0], "p");
        assert.match(s, /revoked_at IS NULL/);
        return [
          {
            id: "paid",
            label: "Paid client",
            amount_kobo: 120000,
            currency: "NGN",
            status: "ACCEPTED",
            invoice_status: "PAID",
            scope: "Paid service pending setup",
            billing_party: "PARTNER",
          },
          {
            id: "due",
            label: "Partner pays",
            amount_kobo: 200000,
            currency: "NGN",
            status: "ACCEPTED",
            invoice_status: "ISSUED",
            scope: "Awaiting payment",
            billing_party: "PARTNER",
          },
          {
            id: "customer",
            label: "Customer pays",
            amount_kobo: 250000,
            currency: "NGN",
            status: "ACCEPTED",
            scope: "Customer approval",
            billing_party: "CUSTOMER",
          },
        ];
      },
    },
  }).default;
  const html = renderToStaticMarkup(await page());
  assert.match(html, /Paid · setup pending/);
  assert.ok(html.includes("/business/distribution#quote-due"));
  assert.ok(!html.includes("/business/distribution#quote-paid"));
  assert.ok(!html.includes("/business/distribution#quote-customer"));
  assert.match(html, /Billing party: client business/);
});
