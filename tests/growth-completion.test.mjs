import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { load, fixture as lifecycleFixture } from "./fixtures/lifecycle-db.mjs";
const { SOURCES, preparedSourceSql } = load("src/lib/investor/queries.ts");
async function revenueFixture() {
  const db = new PGlite();
  // Reuse the established investor ledger fixture, then add actual newer source columns.
  const original = readFileSync("tests/investor-reports.test.mjs", "utf8");
  const ddl = original.match(/await db.exec\(`([\s\S]*?)`\);/)[1];
  await db.exec(ddl);
  await db.exec(`ALTER TABLE email_orders ADD COLUMN id text,ADD COLUMN service_id text,ADD COLUMN period_months int,ADD COLUMN plan_id text,ADD COLUMN consent_at timestamptz;
ALTER TABLE email_services ADD COLUMN id text,ADD COLUMN license_type text,ADD COLUMN period_months int,ADD COLUMN period_price_kobo bigint,ADD COLUMN plan_id text;
ALTER TABLE custom_invoices ADD COLUMN service_id text;
CREATE TABLE custom_services(id text,organization_id text,status text,accepted_at timestamptz,accepted_by text,interval text,starts_on date,amount_kobo bigint,discount_kobo bigint,category text);
CREATE TABLE infrastructure_accounts(organization_id text,subscription_status text,renewal_date date,price_kobo_per_cycle bigint);
CREATE TABLE growth_legacy_payments(reference text,provider_transaction text,organization_id text,amount_kobo bigint,months int,paid_at timestamptz,period_end timestamptz);
CREATE TABLE growth_recurring_snapshots(day date PRIMARY KEY,items jsonb,coverage jsonb,created_at timestamptz DEFAULT now());
CREATE TABLE growth_visits(id text,organization_id text,created_at timestamptz);
CREATE TABLE activation_milestones(organization_id text,milestone text,occurred_at timestamptz);
CREATE TABLE growth_acquisition_costs(affiliate_id text,spent_on date,amount_kobo bigint,voided_at timestamptz);
DELETE FROM website_plan_payments;DELETE FROM website_plan_subscriptions;DELETE FROM domain_payments;DELETE FROM custom_invoice_payments;DELETE FROM custom_invoices;
INSERT INTO website_plan_payments(reference,provider_transaction_id,organization_id,amount_kobo,paid_at,interval) VALUES('web','tx-web','a',120000,'2026-11-02','yearly');INSERT INTO website_plan_subscriptions(organization_id,interval) VALUES('a','yearly');
INSERT INTO email_orders VALUES('email','tx-email','b',120000,'2026-11-02','eo','service-b',12,'team','2026-10-01');
INSERT INTO email_services VALUES('b','ACTIVE','2027-11-01','service-b','PAID',12,120000,'team');
INSERT INTO custom_services VALUES('contract-c','c','ACTIVE','2026-10-01','owner','MONTHLY','2026-10-01',50000,0,'MAINTENANCE'),('unaccepted','c','ACTIVE',NULL,NULL,'ANNUAL','2026-01-01',999999,0,'MAINTENANCE'),('oneoff','c','ACTIVE','2026-10-01','owner','ONCE','2026-01-01',999999,0,'DEVELOPMENT');
INSERT INTO custom_invoices(id,version,status,reference,provider_transaction,organization_id,amount_kobo,currency,paid_at,paid_kobo,due_on,issued_at,service_id) VALUES('inv-c',1,'PAID','custom-c','tx-custom','c',50000,'NGN','2026-11-02',50000,'2026-11-01','2026-11-01','contract-c');
INSERT INTO infrastructure_accounts VALUES('b','active','2027-11-01',120000);INSERT INTO growth_legacy_payments VALUES('legacy','legacy-tx','b',120000,12,'2026-11-01','2027-11-01');`);
  const source = async (k) =>
    (
      await db.query(preparedSourceSql(SOURCES[k].sql), [
        "2026-11-01",
        "2026-12-01",
        "2026-10-01",
        "2026-11-08T12:00:00Z",
      ])
    ).rows[0].data;
  return { db, source };
}
test("company run-rate requires paid current evidence and accepted recurring contracts; one-off and unaccepted fees excluded", async () => {
  const f = await revenueFixture();
  try {
    const r = await f.source("companyRecurring");
    assert.equal(r.mrr, 80000);
    assert.equal(r.arr, 960000);
    assert.equal(r.services, 4);
    assert.equal(r.customCandidatesExcluded, 1);
    await f.db.exec(
      "UPDATE email_services SET license_type='LEGACY_FREE'; UPDATE custom_services SET accepted_at=NULL;",
    );
    assert.equal((await f.source("companyRecurring")).mrr, 20000);
  } finally {
    await f.db.close();
  }
});
test("daily revenue movements compare only consecutive evidence snapshots", async () => {
  const f = await revenueFixture();
  try {
    await f.db.query(
      "INSERT INTO growth_recurring_snapshots(day,items) VALUES($1,$2),($3,$4),($5,$6)",
      [
        "2026-11-01",
        JSON.stringify([
          { service_key: "lost", mrr: 1000 },
          { service_key: "up", mrr: 2000 },
          { service_key: "down", mrr: 1000 },
        ]),
        "2026-11-02",
        JSON.stringify([
          { service_key: "up", mrr: 4000 },
          { service_key: "down", mrr: 500 },
          { service_key: "new", mrr: 3000 },
        ]),
        "2026-11-04",
        "[]",
      ],
    );
    const r = await f.source("movements");
    assert.equal(r.daysCompared, 1);
    assert.equal(r.churnedMrr, 1000);
    assert.equal(r.expansionMrr, 2000);
    assert.equal(r.contractionMrr, 500);
    assert.equal(r.newMrr, 3000);
  } finally {
    await f.db.close();
  }
});
test("consented cohort is nested and never equates all registrations with all visitors", async () => {
  const f = await revenueFixture();
  try {
    await f.db.exec(
      `INSERT INTO growth_visits VALUES('one','a','2026-11-01'),('two','b','2026-11-01'),('three',NULL,'2026-11-01');INSERT INTO activation_milestones VALUES('a','template_selected','2026-11-02'),('a','website_published','2026-11-03'),('a','website_paid','2026-11-04'),('b','website_paid','2026-11-04');`,
    );
    const r = await f.source("conversion");
    assert.equal(r.visitors, 3);
    assert.equal(r.registered, 2);
    assert.equal(r.selected, 1);
    assert.equal(r.published, 1);
    assert.equal(r.paid, 1);
  } finally {
    await f.db.close();
  }
});
test("acquisition CAC needs recorded nonvoid costs and a first retained paying customer", async () => {
  const f = await revenueFixture();
  try {
    await f.db.exec(
      `INSERT INTO affiliates VALUES('partner','Partner','partner','active','2026-01-01');INSERT INTO affiliate_referrals VALUES('partner','a');INSERT INTO growth_acquisition_costs VALUES('partner','2026-11-01',20000,NULL),('partner','2026-11-02',99999,now());`,
    );
    const r = await f.source("acquisitionCosts");
    assert.equal(r.sources[0].newPaying, 1);
    assert.equal(r.sources[0].spend, 20000);
    assert.equal(r.sources[0].cac, 20000);
  } finally {
    await f.db.close();
  }
});
test("optional journey paths strip unsafe/private URLs and signup linking requires consent", async () => {
  let writes = 0;
  const v = load("src/lib/growth/visits.ts", {
    "server-only": {},
    "next/headers": {
      cookies: async () => ({
        get: (n) => ({
          value:
            n === "jktl_growth_visit"
              ? "00000000-0000-4000-8000-000000000001"
              : "no",
        }),
      }),
    },
    "@/lib/custom/service": {
      query: async () => {
        writes++;
        return [];
      },
    },
  });
  assert.equal(
    v.publicGrowthPath("/templates/law-firm"),
    "/templates/law-firm",
  );
  for (const p of [
    "/admin",
    "/signup?email=secret",
    "https://evil.test",
    "/api/key",
    "//evil",
  ])
    assert.equal(v.publicGrowthPath(p), null);
  await v.consumeGrowthVisit("org");
  assert.equal(writes, 0);
});
test("event-driven journey emails reuse queue safety, honor opt-out, suppress resolved payment warnings and do not resend first publications", async () => {
  const f = await lifecycleFixture();
  try {
    await f.db.exec(
      `CREATE TABLE affiliates(id uuid PRIMARY KEY);CREATE TABLE activation_milestones(organization_id uuid,milestone text);CREATE TABLE chatbot_leads(id uuid,organization_id uuid);CREATE TABLE website_plan_subscriptions(organization_id uuid,status text,period_end timestamptz);`,
    );
    await f.db.exec(
      readFileSync("migrations/075_growth_completion.sql", "utf8"),
    );
    await f.db.exec(
      readFileSync("migrations/075_growth_completion.sql", "utf8"),
    );
    await f.q(
      "INSERT INTO growth_recurring_snapshots(day,items) VALUES(current_date,'[]')",
    );
    await assert.rejects(
      f.q("UPDATE growth_recurring_snapshots SET items='[]'"),
      /immutable/,
    );
    await assert.rejects(
      f.q("DELETE FROM growth_recurring_snapshots"),
      /immutable/,
    );
    const a = await f.account("FREE_DOMAIN");
    await f.svc.reconcileLifecycle();
    await f.q(
      "INSERT INTO activation_milestones VALUES($1,'website_published')",
      [a.id],
    );
    await f.svc.reconcileJourneySignals();
    await f.svc.reconcileJourneySignals();
    assert.equal(
      (
        await f.q(
          "SELECT count(*) n FROM lifecycle_events WHERE purpose='PUBLISHED'",
        )
      )[0].n,
      1,
    );
    const sent = await f.svc.dispatchLifecycle();
    assert.equal(sent.accepted, 1);
    assert.match(f.sent[0].bodyHtml, /Review and share my website/);
    assert.equal(f.sent[0].category, "service");
    await f.svc.reconcileJourneySignals();
    assert.equal((await f.svc.dispatchLifecycle()).accepted, 0);
    const b = await f.account("DRAFT");
    await f.svc.reconcileLifecycle();
    await f.q(
      "INSERT INTO growth_signals(organization_id,kind,source_key,occurred_at) VALUES($1,'PAID_FEATURE',$1::uuid::text,now()-interval '2 days')",
      [b.id],
    );
    await f.svc.reconcileJourneySignals();
    await f.svc.dispatchLifecycle();
    assert.equal(
      (
        await f.q(
          "SELECT state FROM lifecycle_events WHERE organization_id=$1 AND purpose='PAID_FEATURE'",
          [b.id],
        )
      )[0].state,
      "SUPPRESSED",
    );
    await f.q(
      "INSERT INTO website_plan_subscriptions VALUES($1,'past_due',now()+interval '1 day')",
      [b.id],
    );
    await f.svc.reconcileJourneySignals();
    await f.q(
      "UPDATE website_plan_subscriptions SET status='active' WHERE organization_id=$1",
      [b.id],
    );
    await f.svc.dispatchLifecycle();
    assert.equal(
      (
        await f.q(
          "SELECT state FROM lifecycle_events WHERE organization_id=$1 AND purpose='PAYMENT_FAILED'",
          [b.id],
        )
      )[0].state,
      "CANCELLED",
    );
  } finally {
    await f.db.close();
  }
});
test("daily snapshot capture uses actual recurring SQL, preserves the day and fails closed on missing sources", async () => {
  const f = await revenueFixture();
  try {
    await f.db.exec("CREATE TABLE growth_signals(id text);");
    const q = async (s, p = []) => (await f.db.query(s, p)).rows;
    const svc = load("src/lib/growth/revenue-service.ts", {
      "server-only": {},
      "@/lib/db/client": { getSql: () => ({ query: q }) },
      "@/lib/custom/service": { query: q },
      "@/lib/investor/queries": load("src/lib/investor/queries.ts"),
    });
    assert.equal((await svc.captureRecurringSnapshot()).saved, 1);
    const saved = (await q("SELECT items FROM growth_recurring_snapshots"))[0]
      .items;
    await q("UPDATE website_plan_payments SET amount_kobo=999999");
    assert.equal((await svc.captureRecurringSnapshot()).saved, 0);
    assert.deepEqual(
      (await q("SELECT items FROM growth_recurring_snapshots"))[0].items,
      saved,
    );
    await q("DROP TABLE growth_legacy_payments");
    await assert.rejects(svc.captureRecurringSnapshot(), /coverage incomplete/);
  } finally {
    await f.db.close();
  }
});
test("financial evidence actions reject unauthorized users and invalid spend before any write", async () => {
  let authorized = false,
    writes = 0;
  let params;
  const actions = load("src/lib/actions/growth-reporting-actions.ts", {
    "@/lib/admin-session": {
      requireAdminCapability: async (cap) => {
        assert.equal(cap, "manage_team");
        if (!authorized) throw Error("Unauthorized");
        return { id: "team" };
      },
    },
    "@/lib/custom/service": {
      query: async (_s, p) => {
        params = p;
        writes++;
        return [];
      },
    },
    "next/cache": { revalidatePath() {} },
    "@/lib/growth/revenue-service": {
      captureRecurringSnapshot: async () => {},
    },
    "@/lib/paystack": {
      verifyTransaction: async () => {
        throw Error("Not called");
      },
    },
    "@/lib/billing": {},
  });
  await assert.rejects(
    actions.addAcquisitionCostAction(new FormData()),
    /Unauthorized/,
  );
  authorized = true;
  const f = new FormData();
  f.set("spent_on", "2026-02-30");
  f.set("amount_ngn", "-100");
  f.set("evidence", "test evidence");
  await assert.rejects(actions.addAcquisitionCostAction(f));
  assert.equal(writes, 0);
  f.set("spent_on", "2026-11-01");
  f.set("amount_ngn", "2500.50");
  await actions.addAcquisitionCostAction(f);
  assert.equal(params[2], 250050);
  assert.equal(writes, 1);
});
test("public analytics rejects foreign origins and unsafe paths, writes no private data, and uses secure first-party cookies", async () => {
  const next = await import("next/server.js");
  let writes = [];
  const route = load("src/app/api/growth/visit/route.ts", {
    "next/server": next,
    "@/lib/custom/service": {
      query: async (s, p = []) => {
        writes.push({ s, p });
        return s.includes("RETURNING id")
          ? [{ id: "00000000-0000-4000-8000-000000000001" }]
          : [];
      },
    },
    "@/lib/security/auth-rate-limit": { authRateLimit: async () => {} },
    "@/lib/growth/visits": {
      VISIT_COOKIE: "jktl_growth_visit",
      validVisit: (v) => /^[0-9a-f-]{36}$/.test(v),
      publicGrowthPath: (v) => (v === "/" ? v : null),
    },
  });
  const req = (origin, body, extra = {}) =>
    new next.NextRequest("https://business.jktl.com.ng/api/growth/visit", {
      method: "POST",
      headers: { origin, "Content-Type": "application/json", ...extra },
      body: JSON.stringify(body),
    });
  assert.equal(
    (await route.POST(req("https://evil.test", { consent: true, path: "/" })))
      .status,
    403,
  );
  assert.equal(writes.length, 0);
  assert.equal(
    (
      await route.POST(
        req("https://jktl.com.ng", { consent: true, path: "/admin" }),
      )
    ).status,
    400,
  );
  assert.equal(writes.length, 0);
  assert.equal(
    (
      await route.POST(
        req("https://jktl.com.ng", { consent: true, path: "/" }, { dnt: "1" }),
      )
    ).status,
    400,
  );
  assert.equal(writes.length, 0);
  const accepted = await route.POST(
    req("https://jktl.com.ng", { consent: true, path: "/" }),
  );
  assert.equal(accepted.status, 200);
  assert.equal(
    accepted.headers.get("access-control-allow-origin"),
    "https://jktl.com.ng",
  );
  assert.match(accepted.headers.get("set-cookie"), /HttpOnly/i);
  assert.match(accepted.headers.get("set-cookie"), /Secure/i);
  assert.equal(JSON.stringify(writes).includes("x-forwarded-for"), false);
});
test("collections include reconciled legacy cash once and remain separate from recurring revenue", async () => {
  const f = await revenueFixture();
  try {
    let r = await f.source("collections");
    assert.equal(r.gross, 410000);
    assert.equal(r.transactions, 4);
    await f.db.exec(
      "UPDATE growth_legacy_payments SET reference='web',provider_transaction='tx-web';",
    );
    r = await f.source("collections");
    assert.equal(r.gross, 290000);
    assert.equal(r.transactions, 3);
  } finally {
    await f.db.close();
  }
});
