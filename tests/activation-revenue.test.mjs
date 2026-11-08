import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { load } from "./fixtures/lifecycle-db.mjs";
const { SOURCES, preparedSourceSql } = load("src/lib/investor/queries.ts");
const { websiteNextStep } = load("src/lib/websites/activation.ts");
const ids = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
];
test("persisted site state selects the current draft, preserves Custom clients and never requires reselecting a template", () => {
  assert.equal(websiteNextStep([]).href, "/business/templates");
  const draft = {
    id: "extra",
    kind: "template",
    published: false,
    editUrl: "/business/website/template?site=extra",
  };
  assert.equal(websiteNextStep([draft]).href, draft.editUrl);
  const live = { ...draft, published: true };
  assert.equal(websiteNextStep([draft, live]).stage, "published");
  assert.equal(websiteNextStep([{ ...draft, kind: "custom" }]).stage, "custom");
});
test("activation migration is additive, repeatable and captures one observed milestone per account across sites and payment replays", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE organizations(id uuid PRIMARY KEY,created_at timestamptz DEFAULT now());
 CREATE TABLE organization_members(organization_id uuid,role text,active boolean);
 CREATE TABLE business_profiles(organization_id uuid,website_template_id text,published boolean DEFAULT false,country_code text);
 CREATE TABLE business_websites(id uuid PRIMARY KEY,organization_id uuid,published boolean DEFAULT false);
 CREATE TABLE website_plan_payments(reference text PRIMARY KEY,organization_id uuid);
 CREATE TABLE lifecycle_current(organization_id uuid,stage text);
 INSERT INTO organizations(id) VALUES('${ids[0]}');
 INSERT INTO business_profiles VALUES('${ids[0]}','old-template',true,'NG');`);
    const migration = readFileSync(
      "migrations/074_activation_milestones.sql",
      "utf8",
    );
    await db.exec(migration);
    const q = async (s, p = []) => (await db.query(s, p)).rows;
    const installed = (
      await q("SELECT installed_at FROM activation_tracking")
    )[0].installed_at;
    assert.equal(
      (await q("SELECT count(*) n FROM activation_milestones"))[0].n,
      0,
      "no invented historical events",
    );
    await db.exec(`UPDATE business_profiles SET published=true; INSERT INTO organizations(id) VALUES('${ids[1]}');
 INSERT INTO lifecycle_current VALUES('${ids[0]}','MANAGED'),('${ids[1]}','FREE_DOMAIN');
 INSERT INTO organization_members VALUES('${ids[1]}','owner',true);
 INSERT INTO business_profiles VALUES('${ids[1]}',NULL,false,'NG');
 UPDATE business_profiles SET website_template_id='law' WHERE organization_id='${ids[1]}';
 UPDATE business_profiles SET published=true WHERE organization_id='${ids[1]}';
 UPDATE business_profiles SET published=false WHERE organization_id='${ids[1]}';
 UPDATE business_profiles SET published=true WHERE organization_id='${ids[1]}';
 INSERT INTO business_websites VALUES(gen_random_uuid(),'${ids[1]}',true);
 INSERT INTO website_plan_payments VALUES('verified-a','${ids[1]}'),('verified-b','${ids[1]}');`);
    assert.equal(
      (
        await q(
          "SELECT count(*) n FROM activation_milestones WHERE organization_id=$1",
          [ids[1]],
        )
      )[0].n,
      4,
    );
    await db.exec(migration);
    assert.deepEqual(
      (await q("SELECT installed_at FROM activation_tracking"))[0].installed_at,
      installed,
    );
    const source = (
      await q(preparedSourceSql(SOURCES.activation.sql), [
        "2020-01-01",
        "2100-01-01",
        "2019-01-01",
        "2099-01-01",
      ])
    )[0].data;
    for (const key of ["registered", "selected", "published", "paid"])
      assert.equal(source[key], 1);
    await q("DELETE FROM lifecycle_current WHERE organization_id=$1", [ids[1]]);
    const filtered = (
      await q(preparedSourceSql(SOURCES.activation.sql), [
        "2020-01-01",
        "2100-01-01",
        "2019-01-01",
        "2099-01-01",
      ])
    )[0].data;
    assert.equal(
      filtered.paid,
      0,
      "ineligible accounts do not inflate metrics",
    );
  } finally {
    await db.close();
  }
});
test("Custom receivables exclude drafts, paid and void records and subtract paid instalments", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE lifecycle_current(organization_id text);
 CREATE TABLE custom_invoices(organization_id text,status text,currency text,issued_at timestamptz,due_on date,amount_kobo bigint,paid_kobo bigint,payment_review boolean);
 INSERT INTO lifecycle_current VALUES('eligible');
 INSERT INTO custom_invoices VALUES
 ('eligible','OPEN','NGN','2026-10-01','2026-10-20',10000,2500,false),
 ('eligible','OPEN','NGN','2026-10-01','2026-12-20',20000,5000,true),
 ('eligible','DRAFT','NGN','2026-10-01','2026-10-20',999999,0,false),
 ('eligible','VOID','NGN','2026-10-01','2026-10-20',999999,0,false),
 ('eligible','PAID','NGN','2026-10-01','2026-10-20',999999,999999,false),
 ('eligible','OPEN','USD','2026-10-01','2026-10-20',999999,0,false),
 ('prospect','OPEN','NGN','2026-10-01','2026-10-20',999999,0,false);`);
    const { rows } = await db.query(
      preparedSourceSql(SOURCES.receivables.sql),
      ["2026-10-01", "2026-11-01", "2026-09-01", "2026-11-08"],
    );
    assert.deepEqual(rows[0].data, {
      outstanding: 22500,
      overdue: 7500,
      invoices: 2,
      underReview: 15000,
    });
  } finally {
    await db.close();
  }
});
