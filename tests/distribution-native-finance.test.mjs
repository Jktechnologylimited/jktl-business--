import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import * as rules from "../src/lib/distribution/product-rules.ts";
import { can } from "../src/lib/admin-permissions.ts";
function load(file, deps) {
  const m = { exports: {} };
  new Function(
    "require",
    "module",
    "exports",
    ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  )(
    (n) => {
      if (!(n in deps)) throw Error("Missing " + n);
      return deps[n];
    },
    m,
    m.exports,
  );
  return m.exports;
}
const rule = (product, extra = {}) => ({
  product,
  kind: "PERCENTAGE",
  rateBps: 1500,
  fixedKobo: 0,
  recurring: true,
  paidMonths: 12,
  taxBps: 0,
  marginReserveKobo: 0,
  capKobo: 100000000,
  ...extra,
});
test("product calculations reject malformed terms and cap percentage/fixed rewards to actual margin and remaining paid months", () => {
  const r = rules.productRules([rule("business_email")])[0];
  assert.equal(
    rules.nativeCommission(r, 2500000, 10000, 1000000, 12, 12).commissionKobo,
    223500,
  );
  assert.equal(
    rules.nativeCommission(r, 2500000, 10000, 1000000, 12, 6).commissionKobo,
    111750,
  );
  assert.equal(
    rules.nativeCommission(r, 2500000, 10000, 3000000, 12, 12).commissionKobo,
    0,
  );
  assert.equal(
    rules.nativeCommission(
      { ...r, kind: "FIXED", fixedKobo: 50000 },
      1000000,
      10000,
      980000,
      1,
      1,
    ).commissionKobo,
    10000,
  );
  for (const bad of [
    [rule("domain_registration")],
    [rule("unknown")],
    [rule("business_email"), rule("business_email")],
    [rule("business_email", { paidMonths: 13 })],
    [rule("business_email", { kind: "FIXED", fixedKobo: 0 })],
  ])
    assert.throws(() => rules.productRules(bad));
});
test("native Email, domains and custom projects share verified ledger, actual cost evidence, product periods and idempotent reversals", async () => {
  const db = new PGlite();
  try {
    for (const f of readdirSync(new URL("../migrations/", import.meta.url))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.exec(
        readFileSync(
          new URL("../migrations/" + f, import.meta.url),
          "utf8",
        ).replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/g, ""),
      );
    const query = async (s, p = []) => (await db.query(s, p)).rows;
    const user = (
        await query(
          "INSERT INTO users(name,email,password_hash) VALUES('Customer','customer@example.test','unused') RETURNING id",
        )
      )[0].id,
      org = (
        await query(
          "INSERT INTO organizations(name,slug) VALUES('Customer','native-finance') RETURNING id",
        )
      )[0].id;
    await query(
      "INSERT INTO organization_members(organization_id,user_id,name,email,role) VALUES($1,$2,'Customer','customer@example.test','owner')",
      [org, user],
    );
    const affiliate = (
        await query(
          "INSERT INTO affiliates(name,email,password_hash,referral_code,programme,status,commission_model) VALUES('Affiliate','affiliate@example.test','unused','NATIVE-FINANCE','affiliate','active','policy') RETURNING id",
        )
      )[0].id,
      policy = (
        await query(
          "SELECT id FROM distribution_policies WHERE code='proposed-affiliate-v2'",
        )
      )[0].id;
    const terms = {
      plans: [],
      holdDays: 14,
      payoutMinimumKobo: 1,
      payoutRequestDay: 1,
      payoutPaymentDay: 28,
      productRules: rules.productRules([
        rule("business_email"),
        rule("domain_registration", {
          kind: "FIXED",
          fixedKobo: 50000,
          recurring: false,
        }),
        rule("custom_project", {
          rateBps: 500,
          recurring: false,
          marginReserveKobo: 100000,
        }),
      ]),
    };
    const contract = (
      await query(
        "INSERT INTO distribution_contracts(affiliate_id,policy_id,terms,model,status,activated_at,created_by) VALUES($1,$2,$3::jsonb,'REFERRAL','ACTIVE',now()-interval '1 hour','fixture-owner') RETURNING id",
        [affiliate, policy, JSON.stringify(terms)],
      )
    )[0].id;
    await query(
      "INSERT INTO affiliate_referrals(affiliate_id,organization_id) VALUES($1,$2)",
      [affiliate, org],
    );
    const verified = new Map();
    function provider(ref, id, amount, sourceId, type) {
      verified.set(ref, {
        id: String(id),
        status: "success",
        domain: "live",
        reference: ref,
        currency: "NGN",
        amount,
        fees: type === "custom_invoice" ? 200000 : 10000,
        customer: { email: "customer@example.test" },
        metadata: {
          type,
          organizationId: org,
          [type === "custom_invoice" ? "invoiceId" : "orderId"]: sourceId,
        },
      });
    }
    async function email(ref, id) {
      const o = (
        await query(
          "INSERT INTO email_orders(organization_id,kind,domain,plan_id,plan_revision,plan_name,mailbox_limit,storage_gb,period_months,features,amount_kobo,mailboxes,terms_version,status,reference,billing_email,provider_transaction,paid_at) VALUES($1,'NEW',$2,'starter',1,'Starter',1,5,12,'[]',2500000,'[]','fixture','ACTIVE',$3,'customer@example.test',$4,now()) RETURNING id",
          [org, ref + ".example.test", ref, String(id)],
        )
      )[0].id;
      provider(ref, id, 2500000, o, "business_email");
    }
    await email("native-email", 101);
    const domain = (
      await query(
        "INSERT INTO domain_orders(organization_id,domain,extension,kind,years,status,amount_kobo,renewal_kobo,price_revision,contact_ciphertext,billing_email,reference,terms_version,paid_at) VALUES($1,'domain.example.com','.com','REGISTER',1,'ACTIVE',1000000,1000000,1,'fixture','customer@example.test','native-domain','fixture',now()) RETURNING id",
        [org],
      )
    )[0].id;
    await query(
      "INSERT INTO domain_payments(reference,provider_transaction,amount_kobo,paid_at) VALUES('native-domain','102',1000000,now())",
    );
    provider("native-domain", 102, 1000000, domain, "domain_order");
    await query(
      "INSERT INTO custom_clients(organization_id,user_id) VALUES($1,$2)",
      [org, user],
    );
    const project = (
        await query(
          "INSERT INTO custom_projects(organization_id,name,website_url) VALUES($1,'Project','https://example.test') RETURNING id",
          [org],
        )
      )[0].id,
      service = (
        await query(
          "INSERT INTO custom_services(project_id,organization_id,name,category,description,amount_kobo,interval,starts_on,next_due_on,status) VALUES($1,$2,'Project build','DEVELOPMENT','Verified project work',10000000,'ONCE',current_date,current_date,'ACTIVE') RETURNING id",
          [project, org],
        )
      )[0].id,
      invoice = (
        await query(
          "INSERT INTO custom_invoices(service_id,organization_id,project_id,due_on,description,amount_kobo,status,reference,provider_transaction,billing_email,paid_at) VALUES($1,$2,$3,current_date,'Project work',10000000,'PAID','native-custom','103','customer@example.test',now()) RETURNING id",
          [service, org, project],
        )
      )[0].id;
    provider("native-custom", 103, 10000000, invoice, "custom_invoice");
    let role = "owner";
    const deps = {
        "server-only": {},
        "./product-rules": rules,
        "@/lib/distribution/product-rules": rules,
        "@/lib/custom/service": { query },
        "@/lib/paystack": {
          verifyTransaction: async (ref) => verified.get(ref),
        },
        "@/lib/admin-session": {
          requireAdminCapability: async (cap) => {
            if (!can(role, cap)) throw Error("Denied");
            return { id: "fixture-owner", role };
          },
        },
        "@/lib/affiliate-session": {
          requireAffiliateSession: async () => ({ id: affiliate }),
        },
        "next/server": { after() {} },
        "next/cache": { revalidatePath() {} },
        "@/lib/distribution/notifications": {
          flushProgramNotices: async () => {},
        },
      },
      engine = load("../src/lib/distribution/finance.ts", deps),
      actions = load(
        "../src/lib/actions/distribution-finance-actions.ts",
        deps,
      );
    assert.equal(
      (await engine.reconcileDistributionPayments()).processed,
      0,
      "No actual cost evidence means no commission",
    );
    async function cost(ref, product, value) {
      const f = new FormData();
      for (const [k, v] of Object.entries({
        reference: ref,
        product,
        cost: String(value),
        supplier: "receipt-" + ref,
        evidence:
          "Actual supplier receipt verified against the completed order",
        actual: "on",
      }))
        f.set(k, v);
      await actions.recordProductCostAction(f);
    }
    role = "growth_gaming_lead";
    await assert.rejects(
      cost("native-email", "business_email", 1000000),
      /Denied/,
    );
    role = "owner";
    await cost("native-email", "business_email", 1000000);
    await cost("native-domain", "domain_registration", 800000);
    await cost("native-custom", "custom_project", 5000000);
    verified.get("native-email").domain = "test";
    verified.get("native-domain").amount = 1;
    verified.get("native-custom").metadata.organizationId = "wrong-org";
    assert.equal((await engine.reconcileDistributionPayments()).processed, 0);
    verified.get("native-email").domain = "live";
    verified.get("native-domain").amount = 1000000;
    verified.get("native-custom").metadata.organizationId = org;
    const results = await Promise.all([
      engine.reconcileDistributionPayments(),
      engine.reconcileDistributionPayments(),
    ]);
    assert.equal(
      results.reduce((n, r) => n + r.processed, 0),
      3,
    );
    assert.ok(results.every((r) => r.failed === 0));
    const ledger = await query(
      "SELECT reference,product,amount_kobo,eligible_months FROM distribution_ledger ORDER BY reference",
    );
    assert.deepEqual(
      Object.fromEntries(
        ledger.map((r) => [r.reference, Number(r.amount_kobo)]),
      ),
      {
        "native-custom": 240000,
        "native-domain": 50000,
        "native-email": 223500,
      },
    );
    assert.equal(
      (
        await query(
          "SELECT paid_months FROM distribution_customer_periods WHERE contract_id=$1 AND product='business_email'",
          [contract],
        )
      )[0].paid_months,
      12,
    );
    await assert.rejects(
      cost("native-email", "business_email", 0),
      /cannot be changed/,
    );
    await email("native-email-next", 104);
    await cost("native-email-next", "business_email", 1000000);
    await engine.reconcileDistributionPayments();
    assert.equal(
      Number(
        (
          await query(
            "SELECT amount_kobo FROM distribution_ledger WHERE reference='native-email-next'",
          )
        )[0].amount_kobo,
      ),
      0,
      "Thirteenth paid month is ineligible",
    );
    await query(
      "UPDATE domain_orders SET refunded_kobo=amount_kobo,status='REFUNDED' WHERE reference='native-domain'",
    );
    await engine.reconcileDistributionPayments();
    assert.equal(
      (
        await query(
          "SELECT status FROM distribution_ledger WHERE reference='native-domain'",
        )
      )[0].status,
      "REVERSED",
    );
    await query(
      "UPDATE affiliates SET bank_verified_at=now(),bank_code='001',bank_name='Fixture Bank',account_number='0123456789',account_name='Affiliate',status='suspended' WHERE id=$1",
      [affiliate],
    );
    await query(
      "UPDATE distribution_ledger SET available_at=now()-interval '1 day' WHERE status='PENDING'",
    );
    for (const reference of [
      "native-email",
      "native-custom",
      "native-email-next",
    ]) {
      const review = new FormData();
      review.set("reference", reference);
      review.set(
        "reason",
        "Verified pre-suspension earned obligation with actual payment proof",
      );
      await actions.reviewDistributionCommissionAction(review);
    }
    const future = new FormData();
    future.set("minimum", "5000000");
    future.set("day", "28");
    future.set("paymentDay", "28");
    await actions.setDistributionPayoutSettingsAction(future);
    await assert.rejects(
      actions.requestDistributionPayoutAction(),
      /Payout unavailable/,
    );
    const onBehalf = new FormData();
    onBehalf.set("affiliate", affiliate);
    onBehalf.set("reviewed", "on");
    onBehalf.set(
      "reason",
      "Honor existing earned obligations under the preserved accepted terms",
    );
    await actions.requestDistributionPayoutForAffiliateAction(onBehalf);
    await assert.rejects(
      actions.requestDistributionPayoutForAffiliateAction(onBehalf),
      /Payout unavailable/,
    );
    const payout = (await query("SELECT * FROM distribution_payouts"))[0];
    assert.equal(
      Number(payout.amount_kobo),
      463500,
      "Existing accepted minimum and request day survive future default changes",
    );
    const transfer = new FormData();
    transfer.set("id", payout.id);
    transfer.set("status", "APPROVED");
    await actions.manageDistributionPayoutAction(transfer);
    transfer.set("status", "PAID");
    transfer.set("confirmed", "on");
    transfer.set("bankReference", "fixture-confirmed-native-payout");
    await actions.manageDistributionPayoutAction(transfer);
    assert.equal(
      (
        await query(
          "SELECT status FROM distribution_ledger WHERE reference='native-custom'",
        )
      )[0].status,
      "PAID",
    );
    for (let i = 0; i < 2; i++)
      await engine.recordDistributionRisk("refund.processed", {
        id: 99,
        transaction: { reference: "native-custom" },
      });
    assert.equal(
      (
        await query(
          "SELECT status FROM distribution_ledger WHERE reference='native-custom'",
        )
      )[0].status,
      "PAID",
    );
    assert.equal(
      Number(
        (
          await query(
            "SELECT amount_kobo FROM distribution_adjustments WHERE reference='native-custom'",
          )
        )[0].amount_kobo,
      ),
      -240000,
    );
    assert.equal(
      (await query("SELECT count(*)::int n FROM distribution_adjustments"))[0]
        .n,
      1,
    );
    assert.equal(
      (
        await query("SELECT state FROM distribution_policies WHERE id=$1", [
          policy,
        ])
      )[0].state,
      "DRAFT",
    );
    await query(
      "INSERT INTO distribution_referral_visits(affiliate_id,expires_at) VALUES($1,now()-interval '1 day')",
      [affiliate],
    );
    const visits = Number(
      (
        await query(
          "SELECT qualified_visit_count FROM affiliate_activity WHERE affiliate_id=$1",
          [affiliate],
        )
      )[0].qualified_visit_count,
    );
    await query(
      "DELETE FROM distribution_referral_visits WHERE expires_at<now()",
    );
    assert.equal(
      Number(
        (
          await query(
            "SELECT qualified_visit_count FROM affiliate_activity WHERE affiliate_id=$1",
            [affiliate],
          )
        )[0].qualified_visit_count,
      ),
      visits,
    );
    await db.exec(
      readFileSync(
        new URL(
          "../migrations/054_distribution_product_rules.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    assert.equal(
      (await query("SELECT count(*)::int n FROM distribution_ledger"))[0].n,
      4,
    );
  } finally {
    await db.close();
  }
});
