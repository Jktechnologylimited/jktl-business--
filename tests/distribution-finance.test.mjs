import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";
import { readFileSync } from "node:fs";
import * as productRules from "../src/lib/distribution/product-rules.ts";
import { DEFAULT_TERMS } from "../src/lib/affiliate-commission.ts";
import { applyMigrationBatch } from "../scripts/sql-statements.mjs";
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
      if (!(n in deps)) throw Error(n);
      return deps[n];
    },
    m,
    m.exports,
  );
  return m.exports;
}
const affiliate = "10000000-0000-4000-8000-000000000001",
  org = "10000000-0000-4000-8000-000000000002",
  user = "10000000-0000-4000-8000-000000000003",
  policy = "10000000-0000-4000-8000-000000000004",
  admin = "10000000-0000-4000-8000-000000000005";
test("accepted new-cohort finance uses verified live payments, bounded service months, holds, reversals and controlled payouts", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `CREATE TABLE affiliates(id uuid PRIMARY KEY,name text,email text,programme text,status text,commission_model text,commission_bps int,signup_bonus_kobo bigint,subscription_bonus_kobo bigint,recurring_monthly_kobo bigint,bank_verified_at timestamptz,bank_code text,bank_name text,account_number text,account_name text);INSERT INTO affiliates VALUES('${affiliate}','Agency','agency@example.test','partner','active','tiered',2000,2000000,4000000,350000,now(),'001','Bank','0123456789','Agency');CREATE TABLE affiliate_sessions(id uuid PRIMARY KEY,affiliate_id uuid,created_at timestamptz DEFAULT now(),expires_at timestamptz);CREATE TABLE organizations(id uuid PRIMARY KEY);INSERT INTO organizations VALUES('${org}');CREATE TABLE users(id uuid PRIMARY KEY,email text);INSERT INTO users VALUES('${user}','client@example.test');CREATE TABLE organization_members(organization_id uuid,user_id uuid);INSERT INTO organization_members VALUES('${org}','${user}');CREATE TABLE affiliate_referrals(affiliate_id uuid,organization_id uuid);CREATE TABLE affiliate_earnings(affiliate_id uuid);CREATE TABLE distribution_account_links(user_id uuid,affiliate_id uuid);CREATE TABLE partner_service_requests(id uuid PRIMARY KEY);CREATE TABLE distribution_policies(id uuid PRIMARY KEY,state text,program text);INSERT INTO distribution_policies VALUES('${policy}','DRAFT','PARTNER');CREATE TABLE distribution_audit(id bigserial,actor_id text,event text,affiliate_id uuid,detail jsonb);CREATE TABLE website_plan_payments(reference text PRIMARY KEY,organization_id uuid,plan_id text,interval text,amount_kobo bigint,currency text,paid_at timestamptz,period_end timestamptz,provider_transaction_id text UNIQUE);CREATE TABLE website_plan_refund_requests(payment_reference text,status text);`,
    );
    const query = async (s, p = []) => {
      try {
        return (await db.query(s, p)).rows;
      } catch (e) {
        throw e;
      }
    };
    const adapter = {
      query: (s, p) => ({ s, p }),
      transaction: async (rows) => {
        await db.exec("BEGIN");
        try {
          for (const r of rows) await db.query(r.s, r.p);
          await db.exec("COMMIT");
        } catch (e) {
          await db.exec("ROLLBACK");
          throw e;
        }
      },
    };
    const migration = readFileSync(
      new URL("../migrations/042_distribution_finance.sql", import.meta.url),
      "utf8",
    );
    await applyMigrationBatch(adapter, [migration]);
    await applyMigrationBatch(adapter, [migration]);
    await applyMigrationBatch(adapter, [
      readFileSync(
        new URL(
          "../migrations/043_distribution_operations.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    ]);
    await applyMigrationBatch(adapter, [
      readFileSync(
        new URL(
          "../migrations/054_distribution_product_rules.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    ]);
    let role = "owner";
    const deps = {
      "@/lib/distribution/product-rules": productRules,
      "next/server": { after: () => {} },
      "@/lib/distribution/notifications": {
        flushProgramNotices: async () => ({}),
      },
      "@/lib/admin-session": {
        requireAdminCapability: async (cap) => {
          if (role !== "owner") throw Error("Denied");
          return { id: admin, role };
        },
      },
      "@/lib/affiliate-session": {
        requireAffiliateSession: async () => ({ id: affiliate }),
      },
      "@/lib/custom/service": { query },
      "next/cache": { revalidatePath: () => {} },
    };
    const a = load("../src/lib/actions/distribution-finance-actions.ts", deps);
    const f = new FormData();
    for (const [k, v] of Object.entries({
      affiliate,
      policy,
      model: "REFERRAL",
      rateBps: "1500",
      duration: "12",
      holdDays: "14",
      taxBps: "0",
      thirdPartyCostKobo: "0",
      marginReserveKobo: "0",
      capKobo: "100000000",
    }))
      f.set(k, v);
    f.append("plans", "growth");
    role = "support";
    await assert.rejects(a.offerDistributionContractAction(f));
    role = "owner";
    await query(
      "UPDATE distribution_finance_settings SET minimum_payout_kobo=1,payout_day=1",
    );
    await a.offerDistributionContractAction(f);
    const contract = (await query("SELECT * FROM distribution_contracts"))[0];
    const consent = new FormData();
    consent.set("id", contract.id);
    await assert.rejects(a.acceptDistributionContractAction(consent));
    consent.set("consent", "on");
    await a.acceptDistributionContractAction(consent);
    consent.set("approved", "on");
    await a.activateDistributionContractAction(consent);
    assert.equal(
      (await query("SELECT commission_model FROM affiliates"))[0]
        .commission_model,
      "policy",
    );
    await assert.rejects(
      query("UPDATE distribution_contracts SET terms='{}' WHERE id=$1", [
        contract.id,
      ]),
    );
    await query("INSERT INTO affiliate_referrals VALUES($1,$2)", [
      affiliate,
      org,
    ]);
    let domain = "live";
    const verified = new Map();
    const engine = load("../src/lib/distribution/finance.ts", {
      "server-only": {},
      "./product-rules": productRules,
      "@/lib/custom/service": { query },
      "@/lib/paystack": {
        verifyTransaction: async (ref) => ({ ...verified.get(ref), domain }),
      },
    });
    async function payment(ref, amount, interval = "monthly") {
      const id = "tx-" + ref;
      await query(
        "INSERT INTO website_plan_payments VALUES($1,$2,'growth',$3,$4,'NGN',now()+interval '1 second',now()+interval '1 year',$5)",
        [ref, org, interval, amount, id],
      );
      verified.set(ref, {
        status: "success",
        reference: ref,
        id,
        amount,
        currency: "NGN",
        fees: 10000,
      });
    }
    await payment("monthly-1", 500000);
    const parallel = await Promise.all([
      engine.reconcileDistributionPayments(),
      engine.reconcileDistributionPayments(),
    ]);
    let result = {
      processed: parallel.reduce((n, r) => n + r.processed, 0),
      failed: parallel.reduce((n, r) => n + r.failed, 0),
    };
    assert.equal(result.failed, 0);
    assert.equal(result.processed, 1);
    assert.equal(
      (await query("SELECT amount_kobo FROM distribution_ledger"))[0]
        .amount_kobo,
      73500,
    );
    await engine.reconcileDistributionPayments();
    assert.equal(
      (await query("SELECT count(*)::int n FROM distribution_ledger"))[0].n,
      1,
    );
    await payment("monthly-2", 500000);
    domain = "test";
    await engine.reconcileDistributionPayments();
    assert.equal(
      (await query("SELECT count(*)::int n FROM distribution_ledger"))[0].n,
      1,
    );
    domain = "live";
    await engine.reconcileDistributionPayments();
    await payment("annual-3", 6000000, "yearly");
    await engine.reconcileDistributionPayments();
    assert.equal(
      (
        await query(
          "SELECT eligible_months FROM distribution_ledger WHERE reference='annual-3'",
        )
      )[0].eligible_months,
      10,
    );
    await payment("cutoff-4", 500000);
    await engine.reconcileDistributionPayments();
    assert.equal(
      (
        await query(
          "SELECT amount_kobo FROM distribution_ledger WHERE reference='cutoff-4'",
        )
      )[0].amount_kobo,
      0,
    );
    const review = new FormData();
    review.set("reference", "monthly-1");
    review.set("reason", "Verified economics and customer eligibility");
    await assert.rejects(a.reviewDistributionCommissionAction(review));
    await query(
      "UPDATE distribution_ledger SET available_at=now()-interval '1 day'",
    );
    await a.reviewDistributionCommissionAction(review);
    await query(
      "UPDATE distribution_finance_settings SET minimum_payout_kobo=1,payout_day=1",
    );
    await a.requestDistributionPayoutAction();
    await assert.rejects(a.requestDistributionPayoutAction());
    const payout = (await query("SELECT * FROM distribution_payouts"))[0];
    assert.equal(payout.amount_kobo, 73500);
    const manage = new FormData();
    manage.set("id", payout.id);
    manage.set("status", "PAID");
    await assert.rejects(a.manageDistributionPayoutAction(manage));
    await query("UPDATE affiliates SET status='suspended' WHERE id=$1", [
      affiliate,
    ]);
    manage.set("status", "APPROVED");
    await a.manageDistributionPayoutAction(manage);
    manage.set("status", "PAID");
    manage.set("confirmed", "on");
    manage.set("bankReference", "TEST-TRANSFER-01");
    await a.manageDistributionPayoutAction(manage);
    await query("UPDATE affiliates SET status='active' WHERE id=$1", [
      affiliate,
    ]);
    assert.equal(
      (await query("SELECT status FROM distribution_payouts"))[0].status,
      "PAID",
    );
    await assert.rejects(
      query(
        "UPDATE distribution_ledger SET amount_kobo=1 WHERE reference='monthly-1'",
      ),
    );
    await assert.rejects(
      query("UPDATE distribution_payouts SET amount_kobo=1"),
    );
    await assert.rejects(a.manageDistributionPayoutAction(manage));
    await engine.recordDistributionRisk("refund.processed", {
      id: "refund-1",
      transaction: { reference: "monthly-1" },
    });
    await engine.recordDistributionRisk("refund.processed", {
      id: "refund-1",
      transaction: { reference: "monthly-1" },
    });
    assert.equal(
      (await query("SELECT amount_kobo FROM distribution_adjustments"))[0]
        .amount_kobo,
      -73500,
    );
    assert.equal(
      (
        await query(
          "SELECT status FROM distribution_ledger WHERE reference='monthly-1'",
        )
      )[0].status,
      "PAID",
      "paid history is immutable",
    );
    await engine.recordDistributionRisk("charge.dispute.create", {
      id: "dispute-1",
      transaction: { reference: "annual-3" },
    });
    assert.equal(
      (
        await query(
          "SELECT status FROM distribution_ledger WHERE reference='annual-3'",
        )
      )[0].status,
      "UNDER_REVIEW",
    );
    const resolution = new FormData();
    resolution.set("reference", "annual-3");
    resolution.set("state", "CLEARED");
    resolution.set("evidence", "Provider dashboard confirms dispute won");
    resolution.set("confirmed", "on");
    await a.resolveDistributionRiskAction(resolution);
    assert.equal(
      (
        await query(
          "SELECT status FROM distribution_ledger WHERE reference='annual-3'",
        )
      )[0].status,
      "PENDING",
    );
    assert.equal(
      (await query("SELECT count(*)::int n FROM distribution_payment_risks"))[0]
        .n,
      2,
    );

    review.set("reference", "monthly-2");
    await a.reviewDistributionCommissionAction(review);
    await assert.rejects(
      a.requestDistributionPayoutAction(),
      "refund debt offsets available earnings",
    );
    review.set("reference", "annual-3");
    await a.reviewDistributionCommissionAction(review);
    await a.requestDistributionPayoutAction();
    const held = (
      await query("SELECT * FROM distribution_payouts WHERE status='REQUESTED'")
    )[0];
    await engine.recordDistributionRisk("charge.dispute.create", {
      id: "dispute-2",
      transaction: { reference: "monthly-2" },
    });
    const heldForm = new FormData();
    heldForm.set("id", held.id);
    heldForm.set("status", "APPROVED");
    await assert.rejects(a.manageDistributionPayoutAction(heldForm));
    heldForm.set("status", "DECLINED");
    await a.manageDistributionPayoutAction(heldForm);
    assert.equal(
      (
        await query(
          "SELECT status FROM distribution_ledger WHERE reference='monthly-2'",
        )
      )[0].status,
      "UNDER_REVIEW",
    );
    assert.equal(
      (await query("SELECT payout_id FROM distribution_adjustments"))[0]
        .payout_id,
      null,
    );
    resolution.set("reference", "monthly-2");
    await a.resolveDistributionRiskAction(resolution);
    review.set("reference", "monthly-2");
    await a.reviewDistributionCommissionAction(review);
    await a.requestDistributionPayoutAction();
    const finalPayout = (
      await query("SELECT * FROM distribution_payouts WHERE status='REQUESTED'")
    )[0];
    assert.equal(finalPayout.amount_kobo, 748749);
    heldForm.set("id", finalPayout.id);
    heldForm.set("status", "APPROVED");
    await a.manageDistributionPayoutAction(heldForm);
    heldForm.set("status", "PAID");
    heldForm.set("confirmed", "on");
    heldForm.set("bankReference", "TEST-TRANSFER-02");
    await a.manageDistributionPayoutAction(heldForm);
    assert.equal(
      Number(
        (
          await query(
            "SELECT sum(amount_kobo) n FROM distribution_payouts WHERE status='PAID'",
          )
        )[0].n,
      ),
      822249,
    );
    await db.exec(
      "ALTER TABLE affiliates ALTER COLUMN id SET DEFAULT gen_random_uuid();ALTER TABLE affiliates ADD COLUMN password_hash text;ALTER TABLE affiliates ADD COLUMN referral_code text UNIQUE;ALTER TABLE affiliates ADD COLUMN application_note text;ALTER TABLE affiliates ADD CONSTRAINT affiliates_email_key UNIQUE(email);ALTER TABLE users ADD COLUMN name text DEFAULT 'Client Person';ALTER TABLE distribution_account_links ADD COLUMN program text;",
    );
    await applyMigrationBatch(adapter, [
      readFileSync(
        new URL(
          "../migrations/046_distribution_multi_role.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    ]);
    const programs = load(
      "../src/lib/actions/distribution-program-actions.ts",
      {
        "node:crypto": await import("node:crypto"),
        "@/lib/affiliate-commission": { DEFAULT_TERMS },
        "@/lib/session": {
          requireSession: async () => ({ userId: user, organizationId: org }),
        },
        "@/lib/custom/service": {
          query,
          owner: async () => ({ userId: user, organizationId: org }),
        },
        "@/lib/db/auth": {
          hashPassword: async () => "fixture-unusable-password",
        },
        "@/lib/support/service": { rate: async () => {} },
        "@/lib/admin-session": deps["@/lib/admin-session"],
        "@/lib/affiliate-session": deps["@/lib/affiliate-session"],
        "next/cache": deps["next/cache"],
        "next/server": { after: () => {} },
        "@/lib/distribution/notifications": {
          flushProgramNotices: async () => ({}),
        },
      },
    );
    const application = new FormData();
    for (const [k, v] of Object.entries({
      program: "partner",
      phone: "08000000000",
      country: "Nigeria",
      company: "Client Agency",
      category: "Consulting",
      partnership: "Help clients launch websites",
      consent: "on",
    }))
      application.set(k, v);
    await programs.applyBusinessProgramAction(application);
    const applicant = (
      await query("SELECT * FROM affiliates WHERE email='client@example.test'")
    )[0];
    assert.equal(applicant.status, "pending");
    assert.equal(applicant.application_data.accountSource, "BUSINESS");
    assert.equal(
      (
        await query(
          "SELECT * FROM distribution_account_links WHERE user_id=$1",
          [user],
        )
      ).length,
      1,
    );
    await assert.rejects(programs.applyBusinessProgramAction(application));
    application.set("program", "affiliate");
    application.set("platform", "Business education");
    application.set("promotion", "Educational website tutorials");
    await programs.applyBusinessProgramAction(application);
    assert.equal(
      (
        await query(
          "SELECT * FROM distribution_account_links WHERE user_id=$1",
          [user],
        )
      ).length,
      2,
    );
    await assert.rejects(programs.applyBusinessProgramAction(application));
    await assert.rejects(
      query("INSERT INTO distribution_account_links VALUES($1,$2,$3)", [
        user,
        applicant.id,
        "affiliate",
      ]),
    );
    const reviewApp = new FormData();
    reviewApp.set("id", applicant.id);
    reviewApp.set("stage", "REJECTED");
    reviewApp.set(
      "note",
      "Business verification needs additional documentation",
    );
    await programs.manageProgramApplicationAction(reviewApp);
    assert.equal(
      (
        await query("SELECT application_stage FROM affiliates WHERE id=$1", [
          applicant.id,
        ])
      )[0].application_stage,
      "REJECTED",
    );
    assert.ok(
      (
        await query("SELECT count(*)::int n FROM distribution_program_notices")
      )[0].n > 0,
    );
    // Reseller fulfillment requires a real native payment for the exact owner and amount.
    await db.exec(
      `ALTER TABLE affiliates ADD COLUMN partner_terms_confirmed boolean DEFAULT true;UPDATE affiliates SET status='active' WHERE programme='partner';CREATE TABLE partner_client_access(id uuid PRIMARY KEY,partner_id uuid,organization_id uuid,revoked_at timestamptz);ALTER TABLE partner_service_requests ADD COLUMN relationship_id uuid;CREATE TABLE domain_orders(reference text,organization_id uuid,amount_kobo bigint,paid_at timestamptz,status text,currency text,refunded_kobo bigint DEFAULT 0);CREATE TABLE email_orders(reference text,organization_id uuid,amount_kobo bigint,paid_at timestamptz,status text);CREATE TABLE custom_invoices(reference text,organization_id uuid,amount_kobo bigint,paid_at timestamptz,status text);`,
    );
    const relationship = "20000000-0000-4000-8000-000000000001",
      request = "20000000-0000-4000-8000-000000000002";
    await query("INSERT INTO partner_client_access VALUES($1,$2,$3,NULL)", [
      relationship,
      applicant.id,
      org,
    ]);
    await query("INSERT INTO partner_service_requests VALUES($1,$2)", [
      request,
      relationship,
    ]);
    await query(
      "INSERT INTO distribution_contracts(affiliate_id,policy_id,terms,model,status,created_by) VALUES($1,$2,'{}','RESELLER','ACTIVE','fixture')",
      [applicant.id, policy],
    );
    const quote = new FormData();
    for (const [k, v] of Object.entries({
      request,
      amount: "500000",
      scope: "Annual licensed mailbox setup for the accepted business",
      billingParty: "CUSTOMER",
      reviewed: "on",
    }))
      quote.set(k, v);
    await programs.createPartnerQuoteAction(quote);
    const quoted = (await query("SELECT * FROM partner_commercial_quotes"))[0];
    const acceptQuote = new FormData();
    acceptQuote.set("id", quoted.id);
    acceptQuote.set("consent", "on");
    await programs.acceptPartnerQuoteAction(acceptQuote);
    const complete = new FormData();
    for (const [k, v] of Object.entries({
      id: quoted.id,
      paymentReference: "native-proof",
      supplierReference: "TEST-SUPPLIER-01",
      supplierCost: "300000",
      proof: "Verified supplier invoice and active customer setup",
      confirmed: "on",
    }))
      complete.set(k, v);
    await assert.rejects(programs.completePartnerQuoteAction(complete));
    await query(
      "INSERT INTO domain_orders VALUES('native-proof',$1,400000,now(),'ACTIVE','NGN',0)",
      [org],
    );
    await assert.rejects(programs.completePartnerQuoteAction(complete));
    await query(
      "UPDATE domain_orders SET amount_kobo=500000,refunded_kobo=500000",
    );
    await assert.rejects(programs.completePartnerQuoteAction(complete));
    await query("UPDATE domain_orders SET refunded_kobo=0");
    await programs.completePartnerQuoteAction(complete);
    assert.equal(
      (await query("SELECT status FROM partner_commercial_quotes"))[0].status,
      "FULFILLED",
    );
    await assert.rejects(programs.completePartnerQuoteAction(complete));
  } finally {
    await db.close();
  }
});
