import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { load } from "./fixtures/lifecycle-db.mjs";
import { verifiedMerchantPayment } from "../src/lib/company-finance/model.ts";
const org = crypto.randomUUID(),
  other = crypto.randomUUID(),
  invoice = crypto.randomUUID();
async function fixture() {
  const db = new PGlite();
  const q = async (s, p = []) => (await db.query(s, p)).rows;
  await db.exec(`CREATE TABLE organizations(id uuid PRIMARY KEY,slug text);CREATE TABLE admin_users(id uuid PRIMARY KEY);CREATE TABLE growth_visits(id uuid PRIMARY KEY,organization_id uuid,created_at timestamptz DEFAULT now());
 CREATE TABLE invoices(id uuid PRIMARY KEY,organization_id uuid,total_kobo bigint,status text,paid_at timestamptz,paid_via text,payment_reference text,platform_fee_kobo bigint);
 INSERT INTO organizations VALUES('${org}','business'),('${other}','other');INSERT INTO invoices VALUES('${invoice}','${org}',100000,'pending',NULL,NULL,NULL,0);`);
  await db.exec(readFileSync("migrations/076_company_finance.sql", "utf8"));
  await db.exec(readFileSync("migrations/076_company_finance.sql", "utf8"));
  await db.exec(readFileSync("migrations/077_buyer_paid_fees.sql", "utf8"));
  const notices = [];
  const svc = load("src/lib/company-finance/payments.ts", {
    "server-only": {},
    "node:crypto": await import("node:crypto"),
    "@/lib/custom/service": { query: q },
    "@/lib/db/invoices": {
      getInvoice: async (o, id) => {
        const r = (
          await q("SELECT * FROM invoices WHERE organization_id=$1 AND id=$2", [
            o,
            id,
          ])
        )[0];
        return r
          ? {
              id: r.id,
              organizationId: r.organization_id,
              totalKobo: Number(r.total_kobo),
              status: r.status,
              onlineReceivedKobo:Number(r.online_received_kobo||0),
            }
          : null;
      },
    },
    "@/lib/paystack": { INVOICE_PLATFORM_FEE_KOBO: 5000 },
    "@/lib/invoice-finalize": {
      finalizeInvoicePaid: async (...args) => notices.push(args),
    },
    "./model": { verifiedMerchantPayment },
  });
  const payment = (ref) => ({
    id: "provider-" + ref,
    reference: ref,
    status: "success",
    currency: "NGN",
    amount: 105000,
    fees: 7000,
    domain: "live",
    paid_at: "2026-11-08T09:00:00Z",
    metadata: {
      type: "invoice_payment",
      organizationId: org,
      invoiceId: invoice,
    },
  });
  return { db, q, svc, payment, notices };
}
test("one reserved invoice checkout survives concurrency and quoted amounts cannot change", async () => {
  const f = await fixture();
  try {
    const r = await Promise.all([
      f.svc.reserveMerchantCheckout(
        { id: invoice, organizationId: org, totalKobo: 100000 },
        "ACCT_fixture",
      ),
      f.svc.reserveMerchantCheckout(
        { id: invoice, organizationId: org, totalKobo: 100000 },
        "ACCT_fixture",
      ),
    ]);
    assert.equal(r.filter((x) => x.created).length, 1);
    assert.equal(r[0].row.reference, r[1].row.reference);
    await assert.rejects(
      f.q("UPDATE merchant_payment_attempts SET fee_kobo=9000"),
      /immutable/,
    );
  } finally {
    await f.db.close();
  }
});
test("verified GPV is merchant money, only the fixed fee is revenue, processor costs may make contribution negative", async () => {
  const f = await fixture();
  try {
    const r = await f.svc.reserveMerchantCheckout(
      { id: invoice, organizationId: org, totalKobo: 100000 },
      "ACCT_fixture",
    );
    const data = f.payment(r.row.reference);
    await f.svc.recordVerifiedMerchantPayment(data);
    await f.svc.recordVerifiedMerchantPayment(data);
    assert.equal(f.notices.length, 1);
    assert.equal(
      (await f.q("SELECT count(*) n FROM merchant_payments"))[0].n,
      1,
    );
    const { merchantSql } = load("src/lib/company-finance/queries.ts");
    const stats = (
      await f.q(
        load("src/lib/investor/queries.ts").preparedSourceSql(merchantSql),
        ["2026-11-01", "2026-12-01", "2026-10-01", "2026-11-10"],
      )
    )[0].data;
    assert.equal(stats.gpv, 100000);
    assert.equal(stats.payerTotal, 105000);
    assert.equal(stats.earnedFees, 5000);
    assert.equal(stats.processorCosts, 7000);
    assert.equal(stats.contribution, -2000);
    assert.notEqual(stats.earnedFees, stats.gpv);
  } finally {
    await f.db.close();
  }
});
test("wrong amounts, currencies and tenant metadata cannot mark an invoice paid", async () => {
  const f = await fixture();
  try {
    const r = await f.svc.reserveMerchantCheckout(
        { id: invoice, organizationId: org, totalKobo: 100000 },
        "ACCT_fixture",
      ),
      data = f.payment(r.row.reference);
    for (const patch of [
      { amount: 100000 },
      { currency: "USD" },
      { status: "pending" },
      { metadata: { ...data.metadata, organizationId: other } },
    ])
      await assert.rejects(
        f.svc.recordVerifiedMerchantPayment({ ...data, ...patch }),
      );
    assert.equal(
      (await f.q("SELECT status FROM invoices"))[0].status,
      "pending",
    );
    assert.equal(f.notices.length, 0);
  } finally {
    await f.db.close();
  }
});
test("refunds and disputes reserve fee revenue until explicit reconciliation; evidence is immutable", async () => {
  const f = await fixture();
  try {
    const r = await f.svc.reserveMerchantCheckout(
      { id: invoice, organizationId: org, totalKobo: 100000 },
      "ACCT_fixture",
    );
    await f.svc.recordVerifiedMerchantPayment(f.payment(r.row.reference));
    const refund = {
      id: "refund-1",
      amount: 105000,
      currency: "NGN",
      transaction: { reference: r.row.reference },
    };
    await f.svc.handleMerchantPaymentEvent("refund.processed", refund);
    await f.svc.handleMerchantPaymentEvent("refund.processed", refund);
    assert.equal(
      (await f.q("SELECT count(*) n FROM merchant_payment_events"))[0].n,
      1,
    );
    const source = load("src/lib/investor/queries.ts");
    let stats = (
      await f.q(
        source.preparedSourceSql(source.SOURCES.merchantTransactions.sql),
        ["2026-11-01", "2026-12-01", "2026-10-01", "2026-11-10"],
      )
    )[0].data;
    assert.equal(stats.earnedFees, 0);
    assert.equal(stats.heldFees, 5000);
    assert.equal(stats.contribution, null);
    await assert.rejects(
      f.q("UPDATE merchant_payments SET gross_fee_kobo=1"),
      /immutable/,
    );
    await f.q(
      "INSERT INTO merchant_payment_events VALUES('adjustment',$1,'FEE_ADJUSTMENT',0,-5000,'Verified full fee reversal','team',now())",
      [r.row.reference],
    );
    await f.q(
      "INSERT INTO merchant_payment_events VALUES('adjustment',$1,'FEE_ADJUSTMENT',0,-5000,'Verified full fee reversal','team',now()) ON CONFLICT DO NOTHING",
      [r.row.reference],
    );
    assert.equal(
      (
        await f.q(
          "SELECT count(*) n FROM merchant_payment_events WHERE kind='FEE_ADJUSTMENT'",
        )
      )[0].n,
      1,
    );
    await assert.rejects(
      f.q(
        "INSERT INTO merchant_payment_events VALUES('over-adjust',$1,'FEE_ADJUSTMENT',0,-1,'Invalid excessive reversal','team',now())",
        [r.row.reference],
      ),
      /original verified fee/,
    );
  } finally {
    await f.db.close();
  }
});
test("real charges against changed invoices are recorded for review without silently settling the changed balance", async () => {
  const f = await fixture();
  try {
    const r = await f.svc.reserveMerchantCheckout(
      { id: invoice, organizationId: org, totalKobo: 100000 },
      "ACCT_fixture",
    );
    await f.q("UPDATE invoices SET total_kobo=200000");
    const result = await f.svc.recordVerifiedMerchantPayment(
      f.payment(r.row.reference),
    );
    assert.equal(result.applied, false);
    assert.equal(
      (await f.q("SELECT status FROM invoices"))[0].status,
      "pending",
    );
    assert.equal(
      (await f.q("SELECT count(*) n FROM merchant_payments"))[0].n,
      1,
    );
    assert.equal(f.notices.length, 0);
  } finally {
    await f.db.close();
  }
});
async function reportingFixture() {
  const f = await fixture();
  const raw = readFileSync("tests/investor-reports.test.mjs", "utf8")
    .match(/await db.exec\(`([\s\S]*?)`\);/)[1]
    .split(" INSERT INTO organizations(id,slug)")[0];
  await f.db.exec(
    raw
      .replaceAll("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS ")
      .replaceAll("organization_id text", "organization_id uuid"),
  );
  await f.db
    .exec(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_demo boolean DEFAULT false;ALTER TABLE distribution_payouts ADD COLUMN IF NOT EXISTS bank_reference text;
 CREATE TABLE growth_acquisition_costs(id uuid DEFAULT gen_random_uuid(),affiliate_id text,spent_on date,amount_kobo bigint,evidence text,voided_at timestamptz);
 CREATE TABLE distribution_product_costs(reference text,cost_kobo bigint,supplier_reference text);
 CREATE TABLE growth_legacy_payments(reference text,provider_transaction text,organization_id uuid,amount_kobo bigint,paid_at timestamptz);
 CREATE TABLE growth_recurring_snapshots(day date PRIMARY KEY,items jsonb);
 CREATE TABLE activation_tracking(id boolean PRIMARY KEY DEFAULT true,installed_at timestamptz DEFAULT now());INSERT INTO activation_tracking DEFAULT VALUES;
 CREATE TABLE activation_milestones(organization_id uuid,milestone text,occurred_at timestamptz DEFAULT now());
 INSERT INTO lifecycle_current VALUES('${org}','FREE_DOMAIN');INSERT INTO website_plan_payments(reference,provider_transaction_id,organization_id,amount_kobo,paid_at) VALUES('saas-real','ps-saas','${org}',50000,'2026-11-08');`);
  await f.db.exec(readFileSync("migrations/076_company_finance.sql", "utf8"));
  const admin = crypto.randomUUID();
  await f.q("INSERT INTO admin_users VALUES($1)", [admin]);
  const actions = load("src/lib/actions/company-finance-actions.ts", {
    "node:crypto": await import("node:crypto"),
    "@/lib/admin-session": {
      requireAdminCapability: async () => ({ id: admin }),
    },
    "@/lib/security/auth-rate-limit": { authRateLimit: async () => {} },
    "@/lib/custom/service": { query: f.q },
    "next/cache": { revalidatePath() {}, revalidateTag() {} },
    "@/lib/company-finance/model":
      await import("../src/lib/company-finance/model.ts"),
    "@/lib/paystack": {
      verifyTransaction: async () => {
        throw Error("No live calls");
      },
    },
    "@/lib/company-finance/payments": f.svc,
  });
  const source = async (key) =>
    (
      await f.q(
        load("src/lib/investor/queries.ts").preparedSourceSql(
          load("src/lib/investor/queries.ts").SOURCES[key].sql,
        ),
        [
          "2026-11-01T00:00:00+01:00",
          "2026-11-10T00:00:00+01:00",
          "2026-10-23T00:00:00+01:00",
          "2026-11-10T12:00:00Z",
        ],
      )
    )[0].data;
  return { ...f, actions, source, admin };
}
const form = (entries) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, String(v));
  return f;
};
test("actual company costs are auditable, imports deduplicate, FX is explicit, and profit requires complete evidence", async () => {
  const f = await reportingFixture();
  try {
    const r = await f.svc.reserveMerchantCheckout(
      { id: invoice, organizationId: org, totalKobo: 100000 },
      "ACCT_fixture",
    );
    await f.svc.recordVerifiedMerchantPayment(f.payment(r.row.reference));
    const input = {
      category_id: "hosting",
      incurred_on: "2026-11-08",
      amount: "100",
      currency: "NGN",
      economic_key: "cloud-invoice-001",
      evidence: "Verified supplier bill",
    };
    await f.actions.recordCompanyCostsAction(form(input));
    await assert.rejects(
      f.actions.recordCompanyCostsAction(form({ ...input, amount: "101" })),
      /different cost evidence/,
    );
    assert.equal(
      (await f.q("SELECT count(*) n FROM company_cost_entries"))[0].n,
      1,
    );
    let p = await f.source("profitability");
    const { profitabilityResult } =
      await import("../src/lib/investor/model.ts");
    assert.equal(p.recordedCompanyReceipts, 50000);
    assert.equal(p.merchantFeeRevenue, 5000);
    assert.equal(p.directCosts, 17000);
    assert.equal(profitabilityResult(p).gross, null);
    await f.actions.attestFinancePeriodAction(
      form({
        from: "2026-11-01",
        to: "2026-11-09",
        rev: 0,
        revenue_complete: "on",
        direct_complete: "on",
        opex_complete: "on",
        tax_complete: "on",
        evidence: "Complete bank and supplier statement reconciliation",
      }),
    );
    p = await f.source("profitability");
    assert.equal(profitabilityResult(p).net, 38000);
    assert.notEqual(
      profitabilityResult(p).revenue,
      155000,
      "GPV must never enter company revenue",
    );
    const c = (await f.q("SELECT id FROM company_cost_entries"))[0];
    await f.actions.reverseCompanyCostAction(
      form({ id: c.id, reason: "Supplier invoice was entered in error" }),
    );
    p = await f.source("profitability");
    assert.equal(
      p.directComplete,
      false,
      "new corrections invalidate completeness",
    );
    assert.equal(profitabilityResult(p).net, null);
    assert.equal(
      Number(
        (await f.q("SELECT sum(ngn_kobo) n FROM company_cost_entries"))[0].n,
      ),
      0,
    );
    await assert.rejects(
      f.q("UPDATE company_cost_entries SET ngn_kobo=1"),
      /immutable/,
    );
    await assert.rejects(
      f.actions.recordCompanyCostsAction(
        form({
          ...input,
          currency: "USD",
          economic_key: "foreign-invoice-001",
        }),
      ),
      /exchange rate/,
    );
  } finally {
    await f.db.close();
  }
});
test("expanded stages and approved campaigns use actual forward events and no unknown UTM attribution", async () => {
  const f = await reportingFixture();
  try {
    const visit = crypto.randomUUID();
    await f.q(
      "INSERT INTO growth_visits(id,organization_id,created_at) VALUES($1,$2,'2026-11-08')",
      [visit, org],
    );
    await f.q(
      "INSERT INTO growth_funnel_events(event_key,visit_id,stage,origin,occurred_at) VALUES('gallery',$1,'gallery_visit','CONSENTED','2026-11-08'),('preview',$1,'template_preview','CONSENTED','2026-11-08')",
      [visit],
    );
    await f.q(
      "INSERT INTO activation_milestones(organization_id,milestone) VALUES($1,'template_selected'),($1,'website_published')",
      [org],
    );
    const funnel = await f.source("extendedFunnel");
    assert.equal(
      funnel.stages.find((s) => s.stage === "website_published").people,
      1,
    );
    assert.equal(funnel.cohort[0].reached, 1);
    assert.equal(funnel.cohort[1].reached, 1);
    assert.equal(
      funnel.cohort.find((s) => s.stage === "registration_started").reached,
      0,
    );
    const svc = load("src/lib/growth/funnel.ts", {
      "server-only": {},
      "@/lib/custom/service": { query: f.q },
    });
    await svc.recordConsentedFunnel(visit, "/templates", null, {
      source: "unapproved",
      medium: "social",
      campaign: "private",
    });
    assert.equal(
      (await f.q("SELECT campaign_id FROM growth_visits"))[0].campaign_id,
      null,
    );
    await f.actions.saveGrowthCampaignAction(
      form({
        id: "approved",
        name: "Approved campaign",
        utm_source: "approved",
        utm_medium: "social",
        utm_campaign: "launch",
        enabled: "on",
      }),
    );
    await svc.recordConsentedFunnel(visit, "/templates", "template_selected", {
      source: "approved",
      medium: "social",
      campaign: "launch",
    });
    await svc.recordConsentedFunnel(visit, "/templates", "template_selected", {
      source: "approved",
      medium: "social",
      campaign: "launch",
    });
    const channels = await f.source("campaigns");
    assert.equal(channels.campaigns[0].registered, 1);
    assert.equal(
      (
        await f.q(
          "SELECT count(*) n FROM growth_funnel_events WHERE visit_id=$1 AND stage='template_selected'",
          [visit],
        )
      )[0].n,
      1,
    );
    await f.source("subscriptionLifecycle");
    await f.source("retention");
    await f.source("channelFinancials");
  } finally {
    await f.db.close();
  }
});
test("report presets use WAT and foreign currency conversion uses exact decimal half-up arithmetic", async () => {
  const { presetPeriod, profitabilityResult } =
      await import("../src/lib/investor/model.ts"),
    { convertMinor } = await import("../src/lib/company-finance/model.ts");
  const now = new Date("2026-11-08T23:30:00Z");
  assert.equal(presetPeriod("today", now).from, "2026-11-09");
  assert.equal(presetPeriod("last-month", now).from, "2026-10-01");
  assert.equal(presetPeriod("last-month", now).to, "2026-10-31");
  assert.equal(presetPeriod("7days", now).from, "2026-11-03");
  assert.equal(convertMinor(101, "0.5"), 51);
  assert.equal(convertMinor(100, "1500.12345678"), 150012);
  assert.throws(() => convertMinor(10, "-1"));
  assert.equal(
    profitabilityResult({
      recordedCompanyReceipts: 0,
      merchantFeeRevenue: 0,
      directCosts: 0,
      operatingExpenses: 0,
      taxes: 0,
      revenueComplete: false,
      directComplete: false,
      opexComplete: false,
      taxComplete: false,
    }).net,
    null,
  );
});

test("timed-out invoice setup stays uncertain and reuses one server reference; callbacks bind to the invoice", async () => {
  const f = await fixture();
  try {
    let initializes = 0,
      outcome = "timeout";
    let verified;
    const policy = await import("../src/lib/invoicing/policy.ts");
    const fees=load("src/lib/merchant-fees/service.ts",{'server-only':{},'node:crypto':await import('node:crypto'),'@/lib/custom/service':{query:f.q},'@/lib/db/invoices':{getPublicInvoice:async()=>{const row=(await f.q('SELECT * FROM invoices WHERE id=$1',[invoice]))[0];return {id:invoice,organizationId:org,totalKobo:Number(row.total_kobo),status:row.status,onlineReceivedKobo:Number(row.online_received_kobo),payoutReady:true,number:'INV-TEST',customerEmail:'payer@example.test'}}},'@/lib/db/payments':{getPaymentSettings:async()=>({bankCode:'058',accountNumber:'0000000000',accountName:'Example Merchant',subaccountCode:'ACCT_fixture'})},'@/lib/invoicing/policy':policy,'./model':load('src/lib/merchant-fees/model.ts',{'@/lib/invoicing/policy':policy})});
    const token=(await fees.invoiceCheckoutContext(invoice)).quote.token;
    const actions = load("src/lib/actions/invoice-payment-actions.ts", {
      '@/lib/merchant-fees/service': fees,
      "next/headers": { headers: async () => new Headers() },
      "@/lib/security/auth-rate-limit": { authRateLimit: async () => {} },
      "@/lib/custom/service": { query: f.q },
      "@/lib/company-finance/payments": f.svc,
      "@/lib/invoicing/policy": policy,
      "@/lib/db/invoices": {
        getPublicInvoice: async () => ({
          id: invoice,
          organizationId: org,
          totalKobo: 100000,
          status: "pending",
          payoutReady: true,
          customerEmail: "payer@example.test",
          number: "INV-TEST",
        }),
      },
      "@/lib/db/payments": {
        getPaymentSettings: async () => ({
          bankCode: "058",
          accountNumber: "0000000000",
          accountName: "Example Merchant",
          subaccountCode: "ACCT_fixture",
        }),
      },
      "@/lib/paystack": {
        INVOICE_PLATFORM_FEE_KOBO: policy.INVOICE_PLATFORM_FEE_KOBO,
        initializeInvoicePayment: async (request) => {
          initializes++;
          assert.equal(request.amountKobo, 105000);
          if (outcome === "timeout") throw Error("Synthetic timeout");
          return {
            reference: request.reference,
            authorizationUrl: "https://checkout.paystack.com/synthetic",
          };
        },
        verifyTransaction: async () => verified,
      },
    });
    const first = await actions.initiateInvoicePaymentAction(invoice,100000,token);
    assert.equal(first.ok, false);
    assert.match(first.error, /do not start another payment/);
    const saved = (await f.q("SELECT * FROM merchant_payment_attempts"))[0];
    assert.equal(saved.state, "UNKNOWN");
    outcome = "ready";
    const uncertain = await actions.initiateInvoicePaymentAction(invoice,100000,token);
    assert.equal(uncertain.ok, false);
    assert.equal(initializes, 1);
    await f.q(
      "UPDATE merchant_payment_attempts SET state='READY',authorization_url='https://checkout.paystack.com/synthetic' WHERE reference=$1",
      [saved.reference],
    );
    const reused = await actions.initiateInvoicePaymentAction(invoice,100000,token);
    assert.equal(reused.ok, true);
    assert.equal(initializes, 1);
    verified = { ...f.payment(saved.reference), status: "pending" };
    const pending = await actions.verifyInvoicePaymentAction(
      saved.reference,
      invoice,
    );
    assert.equal(pending.data.status, "pending");
    assert.equal(
      (await f.q("SELECT status FROM invoices"))[0].status,
      "pending",
    );
    const crossed = await actions.verifyInvoicePaymentAction(
      saved.reference,
      crypto.randomUUID(),
    );
    assert.equal(crossed.ok, false);
    verified = f.payment(saved.reference);
    const paid = await actions.verifyInvoicePaymentAction(
      saved.reference,
      invoice,
    );
    assert.equal(paid.data.status, "success");
    await actions.verifyInvoicePaymentAction(saved.reference, invoice);
    assert.equal(f.notices.length, 1);
  } finally {
    await f.db.close();
  }
});
test("unknown mode and missing processing charges stay excluded until later verified evidence, without rewriting the ledger", async () => {
  const f = await fixture();
  try {
    const r = await f.svc.reserveMerchantCheckout(
      { id: invoice, organizationId: org, totalKobo: 100000 },
      "ACCT_fixture",
    );
    const initial = {
      ...f.payment(r.row.reference),
      domain: undefined,
      fees: undefined,
    };
    await f.svc.recordVerifiedMerchantPayment(initial);
    const source = load("src/lib/investor/queries.ts"),
      read = async () =>
        (
          await f.q(
            source.preparedSourceSql(source.SOURCES.merchantTransactions.sql),
            ["2026-11-01", "2026-12-01", "2026-10-01", "2026-11-10"],
          )
        )[0].data;
    assert.equal((await read()).gpv, 0);
    await f.svc.recordVerifiedMerchantPayment(f.payment(r.row.reference));
    const stats = await read();
    assert.equal(stats.gpv, 100000);
    assert.equal(stats.contribution, -2000);
    assert.equal(stats.excludedMode, 0);
    assert.equal(
      (await f.q("SELECT mode,processor_kobo FROM merchant_payments"))[0].mode,
      "unknown",
    );
    assert.equal(f.notices.length, 1);
  } finally {
    await f.db.close();
  }
});
test("company financial writes authorize before database or provider access; read-only analysts cannot mutate", async () => {
  const permissions = load("src/lib/admin-permissions.ts");
  assert.equal(permissions.can("analyst", "view_company_finance", {}), false);
  assert.equal(
    permissions.can("analyst", "view_company_finance", {
      view_company_finance: true,
    }),
    true,
  );
  assert.equal(
    permissions.can("analyst", "manage_company_finance", {
      manage_company_finance: true,
    }),
    false,
  );
  assert.equal(
    permissions.can("affiliate_manager", "view_company_finance", {
      view_company_finance: true,
    }),
    false,
  );
  let reads = 0,
    providers = 0;
  const a = load("src/lib/actions/company-finance-actions.ts", {
    "node:crypto": await import("node:crypto"),
    "@/lib/admin-session": {
      requireAdminCapability: async (cap) => {
        assert.equal(cap, "manage_company_finance");
        throw Error("Not authorized");
      },
    },
    "@/lib/custom/service": {
      query: async () => {
        reads++;
        return [];
      },
    },
    "next/cache": { revalidatePath() {}, revalidateTag() {} },
    "@/lib/security/auth-rate-limit": { authRateLimit: async () => {} },
    "@/lib/company-finance/model":
      await import("../src/lib/company-finance/model.ts"),
    "@/lib/paystack": {
      verifyTransaction: async () => {
        providers++;
      },
    },
    "@/lib/company-finance/payments": {
      recordVerifiedMerchantPayment: async () => {
        providers++;
      },
    },
  });
  for (const name of [
    "recordCompanyCostsAction",
    "reverseCompanyCostAction",
    "saveCostCategoryAction",
    "attestFinancePeriodAction",
    "reconcileMerchantPaymentAction",
    "reconcileMerchantFeeAction",
    "saveGrowthCampaignAction",
    "saveWebsiteFeeDraftAction",
  ])
    await assert.rejects(a[name](new FormData()), /Not authorized/);
  assert.equal(reads, 0);
  assert.equal(providers, 0);
});

test("empty signup profiles do not claim content; real repeated saves produce one first stage and daily activity", async () => {
  const f = await fixture();
  try {
    await f.db.exec(
      "CREATE TABLE business_profiles(organization_id uuid PRIMARY KEY REFERENCES organizations(id),website_template_id text NOT NULL DEFAULT '',website_document jsonb NOT NULL DEFAULT '{}');",
    );
    await f.db.exec(readFileSync("migrations/076_company_finance.sql", "utf8"));
    await f.q("INSERT INTO business_profiles(organization_id) VALUES($1)", [
      org,
    ]);
    assert.equal(
      (await f.q("SELECT count(*) n FROM growth_funnel_events"))[0].n,
      0,
    );
    await f.q(
      "UPDATE business_profiles SET website_template_id='fixture' WHERE organization_id=$1",
      [org],
    );
    await f.q(
      "UPDATE business_profiles SET website_document=$2::jsonb WHERE organization_id=$1",
      [org, JSON.stringify({ title: "Real business content" })],
    );
    await f.q(
      "UPDATE business_profiles SET website_document=$2::jsonb WHERE organization_id=$1",
      [org, JSON.stringify({ title: "Updated business content" })],
    );
    assert.equal(
      (
        await f.q(
          "SELECT count(*) n FROM growth_funnel_events WHERE stage='website_content_added'",
        )
      )[0].n,
      1,
    );
    assert.equal(
      (await f.q("SELECT count(*) n FROM growth_activity_days"))[0].n,
      1,
    );
  } finally {
    await f.db.close();
  }
});

test("a proposed website fee is stored inactive and cannot activate or alter the existing invoice surcharge", async () => {
  const f = await reportingFixture();
  try {
    await f.actions.saveWebsiteFeeDraftAction(
      form({
        fee_type: "PERCENTAGE",
        amount: "1.25",
        fee_bearer: "PAYER",
        evidence: "Draft only; provider terms need review",
        enabled: "on",
      }),
    );
    const p = (await f.q("SELECT * FROM company_fee_policy_drafts"))[0];
    assert.equal(p.enabled, false);
    assert.equal(Number(p.fee_value), 125);
    await assert.rejects(
      f.q("UPDATE company_fee_policy_drafts SET enabled=true"),
      /check constraint/,
    );
    assert.equal(
      (await import("../src/lib/invoicing/policy.ts"))
        .INVOICE_PLATFORM_FEE_KOBO,
      5000,
    );
  } finally {
    await f.db.close();
  }
});

test("actual signed webhook routing rejects tampering, retries transient failures and bypasses the legacy receipt gate safely", async () => {
  const f = await fixture(),
    prior = process.env.PAYSTACK_SECRET_KEY;
  process.env.PAYSTACK_SECRET_KEY = "synthetic-test-only-webhook-secret";
  try {
    const crypto = await import("node:crypto"),
      next = await import("next/server.js"),
      provider = load("src/lib/paystack.ts", {
        "server-only": {},
        "node:crypto": crypto,
        "@/lib/invoicing/policy":
          await import("../src/lib/invoicing/policy.ts"),
      });
    let unavailable = true,
      legacy = 0;
    const route = load("src/app/api/webhooks/paystack/route.ts", {
      "@/lib/company-finance/payments": {
        handleMerchantPaymentEvent: async (...args) => {
          if (unavailable) throw Error("Synthetic transient storage failure");
          return f.svc.handleMerchantPaymentEvent(...args);
        },
      },
      "@/lib/distribution/notifications": {},
      "@/lib/distribution/finance": {},
      "@/lib/business-email/service": {},
      "@/lib/custom/service": {},
      "@/lib/domains/service": {},
      "@/lib/website-billing-webhooks": {},
      "@/lib/db/organizations": {},
      "next/server": next,
      "@/lib/paystack": provider,
      "@/lib/db/billing": {
        recordWebhookEventOnce: async () => {
          legacy++;
          return false;
        },
      },
      "@/lib/invoicing/policy": await import("../src/lib/invoicing/policy.ts"),
      "@/lib/db/invoices": {},
      "@/lib/ai/billing-fulfilment": {},
      "@/lib/invoice-finalize": {},
      "@/lib/db/affiliates": {},
      "@/lib/db/storage-overage": {},
      "@/lib/billing": {},
    });
    const send = async (event, data, tamper = false) => {
      const body = JSON.stringify({ event, data }),
        signature = crypto
          .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
          .update(body)
          .digest("hex");
      return route.POST(
        new next.NextRequest("http://localhost/api/webhooks/paystack", {
          method: "POST",
          body,
          headers: { "x-paystack-signature": tamper ? "invalid" : signature },
        }),
      );
    };
    const r = await f.svc.reserveMerchantCheckout(
        { id: invoice, organizationId: org, totalKobo: 100000 },
        "ACCT_fixture",
      ),
      p = f.payment(r.row.reference);
    assert.equal((await send("charge.success", p, true)).status, 401);
    assert.equal((await send("charge.success", p)).status, 503);
    assert.equal(
      (await f.q("SELECT count(*) n FROM merchant_payments"))[0].n,
      0,
    );
    unavailable = false;
    const earlyRefund = {
      id: "early-fixture-refund",
      transaction: { reference: r.row.reference },
      amount: 5000,
      currency: "NGN",
    };
    assert.equal(
      (await send("refund.processed", earlyRefund)).status,
      503,
      "an out-of-order known refund must retry before the original charge is recorded",
    );
    assert.equal((await send("charge.success", p)).status, 200);
    assert.equal((await send("charge.success", p)).status, 200);
    assert.equal(f.notices.length, 1);
    assert.equal(legacy, 0);
    const refund = {
      id: "fixture-refund",
      transaction: { reference: r.row.reference },
      amount: 5000,
      currency: "NGN",
    };
    assert.equal((await send("refund.processed", refund)).status, 200);
    assert.equal((await send("refund.processed", refund)).status, 200);
    assert.equal(
      (
        await f.q(
          "SELECT count(*) n FROM merchant_payment_events WHERE kind='REFUND'",
        )
      )[0].n,
      1,
    );
  } finally {
    if (prior === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = prior;
    await f.db.close();
  }
});

test("expanded reports export real calculated results with explicit money units and render a PDF from the same snapshot", async () => {
  const f = await reportingFixture();
  try {
    const model = await import("../src/lib/investor/model.ts");
    const report = {
      version: 1,
      id: crypto.randomUUID(),
      generatedAt: new Date().toISOString(),
      period: model.reportPeriod("2026-11-01", "2026-11-09"),
      notes: "Synthetic export fixture",
    };
    for (const key of [
      "accounts",
      "receipts",
      "subscriptions",
      "activity",
      "partners",
      "portfolio",
      "profitability",
      "merchantTransactions",
      "extendedFunnel",
      "retention",
      "subscriptionLifecycle",
      "campaigns",
    ]) {
      try {
        report[key] = { available: true, data: await f.source(key) };
      } catch {
        report[key] = {
          available: false,
          reason: "Fixture does not install optional source",
        };
      }
    }
    assert.equal(report.profitability.available, true);
    const csv = model.reportCsv(report);
    assert.match(csv, /'?profitability/);
    assert.match(csv, /integer NGN kobo/);
    assert.match(csv, /Unavailable — incomplete coverage or denominator/);
    assert.match(csv, /evidence completeness/);
    const pdf = load("src/lib/investor/pdf.ts", {
      "server-only": {},
      "./model": model,
    });
    const bytes = await pdf.investorPdf(report);
    assert.equal(Buffer.from(bytes).subarray(0, 4).toString(), "%PDF");
    const { PDFDocument } = await import("pdf-lib");
    assert.ok((await PDFDocument.load(bytes)).getPageCount() > 3);
  } finally {
    await f.db.close();
  }
});

test("executive inventory counts primary, additional and connected Custom sites separately from recurring customers and services", async () => {
  const f = await reportingFixture();
  try {
    await f.db.exec(
      "ALTER TABLE business_profiles ADD COLUMN published boolean DEFAULT false,ADD COLUMN website_template_id text DEFAULT '';ALTER TABLE custom_projects ADD COLUMN billing_only boolean DEFAULT false,ADD COLUMN website_url text DEFAULT '';CREATE TABLE business_websites(organization_id uuid,published boolean DEFAULT false);",
    );
    await f.q("INSERT INTO lifecycle_current VALUES($1,'MANAGED')", [other]);
    await f.q(
      "INSERT INTO business_profiles(organization_id,published,website_template_id) VALUES($1,true,'fixture')",
      [org],
    );
    await f.q("INSERT INTO business_websites VALUES($1,true),($1,false)", [
      org,
    ]);
    await f.q(
      "INSERT INTO custom_projects(organization_id,status,billing_only,website_url) VALUES($1,'LIVE',false,'https://example.test')",
      [other],
    );
    await f.q(
      "INSERT INTO growth_recurring_snapshots VALUES('2026-11-08',$1::jsonb)",
      [
        JSON.stringify([
          { organization_id: org, mrr: 10000, service_key: "website" },
          { organization_id: org, mrr: 5000, service_key: "email" },
        ]),
      ],
    );
    const r = await f.source("executiveInventory");
    assert.equal(r.registered, 2);
    assert.equal(r.websitesCreated, 4);
    assert.equal(r.websitesPublished, 3);
    assert.equal(r.freeWebsiteAccounts, 1);
    assert.equal(r.paidCustomers, 1);
    assert.equal(r.paidServices, 2);
  } finally {
    await f.db.close();
  }
});
