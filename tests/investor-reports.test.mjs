import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { load } from "./fixtures/lifecycle-db.mjs";
import * as model from "../src/lib/investor/model.ts";
import { can } from "../src/lib/admin-permissions.ts";
const { SOURCES, preparedSourceSql } = load("src/lib/investor/queries.ts");
const period = model.reportPeriod(
  "2026-10-01",
  "2026-10-31",
  new Date("2026-11-08T12:00:00Z"),
);
const now = "2026-11-08T12:00:00Z";
async function fixture() {
  const db = new PGlite();
  const q = async (s, p = []) => (await db.query(s, p)).rows;
  await db.exec(`
 CREATE TABLE admin_users(id uuid PRIMARY KEY);
 CREATE TABLE organizations(id text PRIMARY KEY,slug text,is_demo boolean DEFAULT false,is_prospect boolean DEFAULT false,created_at timestamptz DEFAULT '2026-10-05');
 CREATE TABLE lifecycle_current(organization_id text PRIMARY KEY,stage text);
 CREATE TABLE business_profiles(organization_id text,country_code text);
 CREATE TABLE website_plan_payments(reference text,provider_transaction_id text,organization_id text,amount_kobo bigint,currency text DEFAULT 'NGN',paid_at timestamptz,plan_id text DEFAULT 'growth',interval text DEFAULT 'monthly',period_end timestamptz DEFAULT '2027-01-01');
 CREATE TABLE website_plan_refund_requests(payment_reference text,status text);
 CREATE TABLE domain_orders(reference text,organization_id text,currency text DEFAULT 'NGN',refunded_kobo bigint DEFAULT 0);
 CREATE TABLE domain_payments(reference text,provider_transaction text,amount_kobo bigint,paid_at timestamptz);
 CREATE TABLE email_orders(reference text,provider_transaction text,organization_id text,amount_kobo bigint,paid_at timestamptz);
 CREATE TABLE custom_invoices(id text,version int,status text,reference text,provider_transaction text,organization_id text,amount_kobo bigint,currency text,paid_at timestamptz);
 CREATE TABLE custom_invoice_payments(invoice_id text,reference text,provider_transaction text,amount_kobo bigint,currency text,verified_at timestamptz,refunded_kobo bigint DEFAULT 0,state text);
 CREATE TABLE distribution_payment_risks(reference text);
 CREATE TABLE distribution_risk_state(reference text,state text);
 CREATE TABLE website_plan_subscriptions(organization_id text,plan_id text DEFAULT 'growth',interval text DEFAULT 'monthly',status text DEFAULT 'active',period_end timestamptz DEFAULT '2027-01-01');
 CREATE TABLE website_metric_events(organization_id text,event_type text,created_at timestamptz);
 CREATE TABLE tycoon_saves(user_id text,updated_at timestamptz);
 CREATE TABLE affiliates(programme text,status text,created_at timestamptz);
 CREATE TABLE distribution_ledger(amount_kobo bigint,status text,currency text DEFAULT 'NGN');
 CREATE TABLE distribution_payouts(amount_kobo bigint,status text,currency text DEFAULT 'NGN',confirmed_at timestamptz);
 CREATE TABLE custom_projects(organization_id text,status text);
 CREATE TABLE domain_assets(organization_id text,expires_at timestamptz);
 CREATE TABLE email_services(organization_id text,status text,renews_at timestamptz);
 CREATE TABLE support_cases(organization_id text,status text,created_at timestamptz);
 CREATE TABLE renewal_items(organization_id text,due_on date);
 INSERT INTO organizations(id,slug) VALUES('a','business-a'),('b','business-b'),('c','business-c'),('prospect','prospect'),('demo','demo');
 INSERT INTO lifecycle_current VALUES('a','FREE_DOMAIN'),('b','MANAGED'),('c','NO_SITE');
 INSERT INTO business_profiles VALUES('a','NG'),('b','NG');
 INSERT INTO website_plan_payments(reference,provider_transaction_id,organization_id,amount_kobo,paid_at,interval) VALUES
 ('annual','tx1','a',120000,'2026-10-02','yearly'),
 ('old','tx2','b',80000,'2026-10-01','monthly'),
 ('refunded','tx3','b',90000,'2026-10-15','monthly'),
 ('incomplete',NULL,'a',50000,'2026-10-05','monthly'),
 ('demo-pay','tx-demo','demo',999999,'2026-10-05','monthly');
 INSERT INTO website_plan_refund_requests VALUES('refunded','refunded');
 INSERT INTO website_plan_subscriptions(organization_id,interval) VALUES('a','yearly'),('b','monthly');
 INSERT INTO domain_orders(reference,organization_id,refunded_kobo) VALUES('domain','a',1000),('annual','a',0);
 INSERT INTO domain_payments VALUES('domain','tx4',10000,'2026-10-05'),('annual','tx1',120000,'2026-10-02');
 INSERT INTO distribution_payment_risks VALUES('domain');
 INSERT INTO custom_invoices VALUES('invoice',2,'PAID','invoice','custom-tx','b',50000,'NGN','2026-10-08');
 INSERT INTO custom_invoice_payments VALUES('invoice','installment','custom-tx',20000,'NGN','2026-10-08',0,'success');
 INSERT INTO website_metric_events VALUES('a','view','2026-10-02'),('a','cta','2026-10-02'),('demo','view','2026-10-02');
 INSERT INTO tycoon_saves VALUES('one','2026-10-15');
 INSERT INTO distribution_ledger VALUES(1000,'AVAILABLE','NGN'),(999999,'AVAILABLE','USD');
 INSERT INTO distribution_payouts VALUES(2000,'PAID','NGN','2026-10-05'),(999999,'PAID','USD','2026-10-05');
 `);
  await db.exec(readFileSync("migrations/071_investor_reports.sql", "utf8"));
  const params = [period.start, period.end, period.previousStart, now];
  const source = async (key) =>
    (await q(preparedSourceSql(SOURCES[key].sql), params))[0].data;
  const sql = {
    query: (s, p) => ({ s, p }),
    transaction: async (statements) => {
      const results = [];
      for (const { s, p } of statements) results.push(await q(s, p));
      return results;
    },
  };
  // Neon queries are lazy promise-like statements, including outside transactions.
  sql.query = (s, p) => ({
    s,
    p,
    then: (resolve, reject) => q(s, p).then(resolve, reject),
  });
  const service = load("src/lib/investor/service.ts", {
    "server-only": {},
    "@/lib/db/client": { getSql: () => sql },
    "./queries": { SOURCES, preparedSourceSql },
    "./model": model,
  });
  return { db, q, source, service };
}
test("report dates use WAT, equal prior days, bounds and honest zero denominators", () => {
  assert.equal(period.start, "2026-09-30T23:00:00.000Z");
  assert.equal(period.previousFrom, "2026-08-31");
  assert.equal(period.previousTo, "2026-09-30");
  assert.equal(model.watDay(new Date("2026-11-07T23:30:00Z")), "2026-11-08");
  for (const args of [
    ["2026-02-30", "2026-03-01"],
    ["2026-11-09", "2026-11-10"],
    ["2020-01-01", "2026-01-01"],
  ])
    assert.throws(() => model.reportPeriod(...args, new Date(now)));
  assert.equal(model.percent(0, 0), null);
  assert.equal(model.change(2, 0), null);
  assert.equal(model.percent(0, 5), 0);
  assert.equal(model.monthlySeries(period, [], "gross")[0].gross, 0);
  assert.throws(() => model.assertSafeNumbers({ amount: 2 ** 54 }));
});
test("actual aggregate SQL deduplicates, excludes incomplete/demo evidence and separates refunds/risk/MRR", async () => {
  const f = await fixture();
  try {
    const a = await f.source("accounts");
    assert.equal(a.total, 3);
    assert.equal(a.custom, 1);
    assert.equal(a.published, 1);
    const r = await f.source("receipts");
    assert.equal(r.gross, 320000);
    assert.equal(r.refunds, 91000);
    assert.equal(r.risk, 9000);
    assert.equal(r.retained, 220000);
    assert.equal(r.transactions, 5);
    assert.equal(r.duplicates, 1);
    assert.equal(r.invalid, 1);
    assert.equal(
      r.products.find((p) => p.product === "Custom projects").gross,
      20000,
      "use installments, not invoice total",
    );
    const s = await f.source("subscriptions");
    assert.equal(s.mrr, 10000);
    assert.equal(s.arr, 120000);
    assert.equal(s.verified, 1);
    assert.equal(
      s.unverified,
      1,
      "latest refunded receipt must not revive older paid MRR",
    );
    await f.q("INSERT INTO distribution_risk_state VALUES('domain','CLEARED')");
    assert.equal((await f.source("receipts")).risk, 0);
    assert.equal((await f.source("activity")).views, 1);
    assert.equal((await f.source("activity")).recentSavers, 1);
    const p = await f.source("partners");
    assert.equal(p.available, 1000);
    assert.equal(p.paidOut, 2000);
    await f.source("portfolio");
  } finally {
    await f.db.close();
  }
});
test("saved reports keep figures frozen, validate JSONB digest and export real PDFs and flat CSV", async () => {
  const f = await fixture();
  try {
    const actor = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    await f.q("INSERT INTO admin_users VALUES($1)", [actor]);
    const report = await f.service.saveInvestorReport(
      actor,
      period,
      "Source reconciliation pending.",
    );
    assert.equal(report.receipts.data.gross, 320000);
    assert.equal(report.digest.length, 64);
    await f.q(
      "UPDATE website_plan_payments SET amount_kobo=300000 WHERE reference='annual'",
    );
    const saved = await f.service.readInvestorReport(report.id);
    assert.equal(saved.receipts.data.gross, 320000);
    assert.equal(f.service.reportDigest(saved), report.digest);
    const csv = model.reportCsv(saved);
    assert.match(csv, /320000/);
    assert.match(csv, /Website plans/);
    assert.doesNotMatch(csv, /\{"month"/);
    assert.equal(model.csvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"');
    const { investorPdf } = load("src/lib/investor/pdf.ts", {
      "server-only": {},
      "./model": model,
    });
    const bytes = await investorPdf(saved);
    const doc = await PDFDocument.load(bytes);
    assert.ok(doc.getPageCount() >= 4);
    assert.equal(doc.getTitle(), "JKTL investor management report");
    writeFileSync("/tmp/jktl-investor-test.pdf", bytes);
    writeFileSync("/tmp/jktl-investor-fixture.json", JSON.stringify(saved));
    await f.q(
      "UPDATE investor_reports SET payload=jsonb_set(payload,'{notes}','\"tampered\"') WHERE id=$1",
      [report.id],
    );
    await assert.rejects(
      () => f.service.readInvestorReport(report.id),
      /verify/,
    );
    assert.equal(await f.service.readInvestorReport("not-a-uuid"), null);
  } finally {
    await f.db.close();
  }
});
test("private downloads reject unauthorized callers before any snapshot access", async () => {
  let actor = null,
    reads = 0;
  const route = load(
    "src/app/admin/(command)/insights/reports/[id]/download/route.ts",
    {
      "@/lib/admin-session": { getAdminSession: async () => actor },
      "@/lib/admin-permissions": { can },
      "@/lib/investor/service": {
        readInvestorReport: async () => {
          reads++;
          return null;
        },
      },
      "@/lib/investor/model": model,
      "@/lib/investor/pdf": { investorPdf: async () => new Uint8Array() },
    },
  );
  const call = (format = "pdf") =>
    route.GET(
      new Request(
        "https://business.jktl.com.ng/admin/insights/reports/id/download?format=" +
          format,
      ),
      { params: Promise.resolve({ id: "id" }) },
    );
  assert.equal((await call()).status, 401);
  actor = { role: "support" };
  assert.equal((await call()).status, 403);
  actor = { role: "affiliate_manager" };
  assert.equal((await call()).status, 403);
  assert.equal(reads, 0);
  actor = { role: "analyst" };
  assert.equal((await call("html")).status, 400);
  assert.equal((await call()).status, 404);
  assert.equal(reads, 1);
  assert.equal(can("owner", "export_insights"), true);
  assert.equal(can("analyst", "export_insights"), true);
  assert.equal(can("analyst", "record_payouts"), false);
});

test("missing sources are unavailable and required gaps block saved reports", async () => {
  const f = await fixture();
  try {
    await f.q("DROP TABLE tycoon_saves");
    let r = await f.service.loadInvestorReport(period);
    assert.equal(r.activity.available, false);
    assert.equal(r.accounts.available, true);
    await f.q("DROP TABLE website_plan_subscriptions");
    r = await f.service.loadInvestorReport(period);
    assert.equal(r.subscriptions.available, false);
    await assert.rejects(
      () =>
        f.service.saveInvestorReport(
          "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          period,
          "",
        ),
      /sources are unavailable/,
    );
    assert.equal(
      Number((await f.q("SELECT count(*) n FROM investor_reports"))[0].n),
      0,
    );
  } finally {
    await f.db.close();
  }
});

test("snapshot action checks export permission first and ignores client-supplied financial figures", async () => {
  let deny = true,
    saved;
  const action = load("src/lib/actions/investor-report-actions.ts", {
    "next/navigation": {
      redirect: (url) => {
        throw Error("redirect:" + url);
      },
    },
    "@/lib/admin-session": {
      requireAdminCapability: async (cap) => {
        assert.equal(cap, "export_insights");
        if (deny) throw Error("Denied");
        return { id: "owner" };
      },
    },
    "@/lib/investor/model": model,
    "@/lib/investor/service": {
      saveInvestorReport: async (...args) => {
        saved = args;
        return { id: "snapshot" };
      },
    },
  });
  const form = new FormData();
  form.set("from", period.from);
  form.set("to", period.to);
  form.set("gross", "999999999");
  form.set("notes", "Reconciled separately");
  await assert.rejects(
    () => action.generateInvestorReportAction(form),
    /Denied/,
  );
  assert.equal(saved, undefined);
  deny = false;
  await assert.rejects(
    () => action.generateInvestorReportAction(form),
    /redirect:\/admin\/insights\/reports\/snapshot/,
  );
  assert.equal(saved.length, 3);
  assert.equal(saved[0], "owner");
  assert.equal(saved[2], "Reconciled separately");
  assert.equal("gross" in saved[1], false);
});
