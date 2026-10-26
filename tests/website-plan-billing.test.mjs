import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import * as pricing from "../src/lib/website-pricing.ts";
import * as billing from "../src/lib/billing.ts";
function load(file, deps) {
  const code = ts.transpileModule(
    readFileSync(new URL(file, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", code)(
    (name) => {
      if (!(name in deps)) throw new Error(`Unexpected ${name}`);
      return deps[name];
    },
    mod,
    mod.exports,
  );
  return mod.exports;
}
const store = load("../src/lib/website-plan-store.ts", {
  "./website-pricing": pricing,
  "./billing": billing,
});
const org = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
async function setup() {
  const db = new PGlite();
  await db.exec("CREATE TABLE organizations(id uuid primary key);");
  await db.exec(`INSERT INTO organizations VALUES('${org}'),('${other}')`);
  const migration = readFileSync(
    new URL("../migrations/031_website_plan_billing.sql", import.meta.url),
    "utf8",
  );
  await db.exec(migration);
  await db.exec(migration);
  const query = async (text, params) => (await db.query(text, params)).rows;
  return { db, query };
}
async function checkout(
  query,
  ref = "jktl_web_11111111111111111111111111111111",
  organization = org,
) {
  const reserve = await store.reserveWebsiteCheckout(query, {
    org: organization,
    planId: "growth",
    interval: "yearly",
    reference: ref,
  });
  await query(
    `UPDATE website_plan_checkouts SET provider_plan_code='PLN_growth',status='ready' WHERE reference=$1`,
    [ref],
  );
  return reserve;
}
function payment(overrides = {}) {
  return {
    id: 9001,
    status: "success",
    reference: "jktl_web_11111111111111111111111111111111",
    amount: 15000000,
    currency: "NGN",
    paid_at: new Date().toISOString(),
    plan: { plan_code: "PLN_growth" },
    customer: { customer_code: "CUS_owner" },
    metadata: {
      type: "website_plan",
      organizationId: org,
      planId: "growth",
      interval: "yearly",
    },
    ...overrides,
  };
}
test("database checkout lock prevents parallel duplicate starts and cross-tenant state", async () => {
  const { db, query } = await setup();
  try {
    const rows = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        store.reserveWebsiteCheckout(query, {
          org,
          planId: "growth",
          interval: "yearly",
          reference: `ref_${i}`,
        }),
      ),
    );
    assert.equal(rows.filter((r) => r.created).length, 1);
    assert.equal(new Set(rows.map((r) => r.row.reference)).size, 1);
    assert.equal(
      (await query("SELECT * FROM website_plan_checkouts", [])).length,
      1,
    );
    const second = await store.reserveWebsiteCheckout(query, {
      org: other,
      planId: "starter",
      interval: "monthly",
      reference: "other_ref",
    });
    assert.equal(second.created, true);
    await assert.rejects(
      () =>
        store.reserveWebsiteCheckout(query, {
          org,
          planId: "free",
          interval: "yearly",
          reference: "free",
        }),
      /Free/,
    );
  } finally {
    await db.close();
  }
});
test("verified payment activates exactly once; forged values and wrong tenant fail closed", async () => {
  const { db, query } = await setup();
  try {
    await checkout(query);
    for (const override of [
      { amount: 1 },
      { currency: "USD" },
      {
        metadata: {
          type: "website_plan",
          organizationId: other,
          planId: "growth",
          interval: "yearly",
        },
      },
      { plan: { plan_code: "PLN_wrong" } },
      { paid_at: "bad" },
      { status: "failed" },
    ])
      await assert.rejects(() =>
        store.fulfilWebsitePayment(query, payment(override), org),
      );
    await assert.rejects(
      () => store.fulfilWebsitePayment(query, payment(), other),
      /another business/,
    );
    assert.equal(
      (await query("SELECT * FROM website_plan_payments", [])).length,
      0,
    );
    const verified = payment();
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        store.fulfilWebsitePayment(query, verified, org),
      ),
    );
    assert.equal(results.filter((r) => r.applied).length, 1);
    assert.equal(
      (await query("SELECT * FROM website_plan_payments", [])).length,
      1,
    );
    let sub = await store.currentWebsitePlan(query, org);
    assert.equal(sub.plan_id, "growth");
    assert.equal(sub.status, "active");
    assert.equal(
      new Date(sub.period_end).toISOString(),
      billing
        .addBillingCycle(new Date(verified.paid_at), "yearly")
        .toISOString(),
    );
    assert.equal(await store.currentWebsitePlan(query, other), null);
    await assert.rejects(
      () =>
        store.reserveWebsiteCheckout(query, {
          org,
          planId: "business",
          interval: "monthly",
          reference: "dupe",
        }),
      /paid plan/,
    );
    // Metadata-free signed recurring payment maps to the saved subscription and provider plan.
    await query(
      `UPDATE website_plan_subscriptions SET subscription_code='SUB_1',email_token='private-token' WHERE organization_id=$1`,
      [org],
    );
    const nextPaid = billing.addBillingCycle(
      new Date(verified.paid_at),
      "yearly",
    );
    const renewal = payment({
      id: 9002,
      reference: "renewal_1",
      metadata: null,
      paid_at: nextPaid.toISOString(),
      subscription: {
        subscription_code: "SUB_1",
        next_payment_date: billing
          .addBillingCycle(nextPaid, "yearly")
          .toISOString(),
      },
    });
    assert.equal(
      (await store.fulfilWebsitePayment(query, renewal)).applied,
      true,
    );
    sub = await store.currentWebsitePlan(query, org);
    assert.equal(
      new Date(sub.period_end).getUTCFullYear(),
      nextPaid.getUTCFullYear() + 1,
    );
    assert.equal(
      (await store.fulfilWebsitePayment(query, renewal)).applied,
      false,
    );
    // A late duplicate of the first charge cannot roll the interval or date back.
    await store.fulfilWebsitePayment(query, verified, org);
    assert.equal(
      new Date(
        (await store.currentWebsitePlan(query, org)).period_end,
      ).toISOString(),
      new Date(sub.period_end).toISOString(),
    );
  } finally {
    await db.close();
  }
});
test("14-day guarantee is tenant scoped, first payment only, repeatable and deadline enforced", async () => {
  const { db, query } = await setup();
  try {
    await checkout(query);
    await store.fulfilWebsitePayment(query, payment(), org);
    const request = await store.requestWebsiteRefund(
      query,
      org,
      "Not the right fit",
    );
    assert.equal(request.status, "requested");
    const repeat = await store.requestWebsiteRefund(
      query,
      org,
      "Another click",
    );
    assert.equal(request.payment_reference, repeat.payment_reference);
    assert.equal(
      (await query("SELECT * FROM website_plan_refund_requests", [])).length,
      1,
    );
    await assert.rejects(
      () => store.requestWebsiteRefund(query, other, "Not eligible"),
      /window/,
    );
    await assert.rejects(
      () => store.requestWebsiteRefund(query, org, "x"),
      /explain/,
    );
    await query(
      `DELETE FROM website_plan_refund_requests WHERE organization_id=$1`,
      [org],
    );
    await query(
      `UPDATE website_plan_payments SET paid_at=now()-interval '14 days 1 second' WHERE organization_id=$1`,
      [org],
    );
    await assert.rejects(
      () => store.requestWebsiteRefund(query, org, "Too late"),
      /window/,
    );
  } finally {
    await db.close();
  }
});
test("billing actions require the active owner; plan changes stop renewal before saving and billing output never exposes provider token", async () => {
  let ownerRole = true;
  let disabled = 0;
  let write = 0;
  const row = {
    organization_id: org,
    plan_id: "growth",
    interval: "yearly",
    period_end: "2027-01-01",
    subscription_code: "SUB_1",
    email_token: "secret-token",
    customer_code: "CUS_private",
    cancel_at_period_end: false,
  };
  const query = async (text, params) => {
    if (text.startsWith("SELECT * FROM website_plan_subscriptions"))
      return [row];
    if (text.startsWith("UPDATE website_plan_subscriptions")) {
      write++;
      return [];
    }
    return [];
  };
  const sql = Object.assign(
    async () => (ownerRole ? [{ user_id: "owner" }] : []),
    { query },
  );
  const actions = load("../src/lib/actions/website-billing-actions.ts", {
    "node:crypto": await import("node:crypto"),
    "@/lib/session": {
      requireSession: async () => ({ organizationId: org, userId: "owner" }),
    },
    "@/lib/db/client": {
      getSql: () => sql,
      isSchemaOutOfDateError: () => false,
    },
    "@/lib/db/organizations": { getInfrastructure: async () => null },
    "@/lib/paystack": {
      stopWebsiteProviderSubscription: async (code, token) => {
        assert.equal(code, "SUB_1");
        assert.equal(token, "secret-token");
        disabled++;
      },
    },
    "@/lib/website-plan-store": store,
    "@/lib/website-pricing": pricing,
  });
  assert.equal(
    (await actions.startWebsitePlanCheckoutAction("growth", "yearly", false))
      .ok,
    false,
  );
  ownerRole = false;
  assert.equal((await actions.getWebsiteBillingAction()).ok, false);
  assert.equal(
    (await actions.scheduleWebsitePlanChangeAction("starter", "monthly")).ok,
    false,
  );
  assert.equal(disabled, 0);
  ownerRole = true;
  assert.equal(
    (await actions.scheduleWebsitePlanChangeAction("starter", "monthly")).ok,
    true,
  );
  assert.equal(disabled, 1);
  assert.equal(write, 1);
  const result = await actions.getWebsiteBillingAction();
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(result).includes("secret-token"), false);
  assert.equal(JSON.stringify(result).includes("CUS_private"), false);
});
test("signed website webhook lifecycle: retries early attachment, confirms renewals, failure, cancellation and processed refund", async () => {
  const { db, query } = await setup();
  try {
    await db.exec(
      "CREATE TABLE paystack_webhook_events(dedupe_key text primary key,event text);",
    );
    await query(
      `INSERT INTO website_plan_provider_plans(organization_id,plan_id,interval,amount_kobo,plan_code,lease_token) VALUES($1,'growth','yearly',15000000,'PLN_growth','lease')`,
      [org],
    );
    await checkout(query);
    const sql = Object.assign(
      (strings, ...values) => {
        let text = strings[0];
        values.forEach((value, i) => {
          text += `$${i + 1}` + strings[i + 1];
        });
        return query(text, values);
      },
      { query },
    );
    const webhooks = load("../src/lib/website-billing-webhooks.ts", {
      "@/lib/db/client": { getSql: () => sql },
      "@/lib/website-plan-store": store,
    });
    const crypto = await import("node:crypto");
    const oldSecret = process.env.PAYSTACK_SECRET_KEY;
    process.env.PAYSTACK_SECRET_KEY = "test-only-webhook-key";
    try {
      const provider = load("../src/lib/paystack.ts", {
        "server-only": {},
        "node:crypto": crypto,
      });
      const next = await import("next/server.js");
      const dbBilling = {
        recordWebhookEventOnce: async (key, event) =>
          (
            await query(
              `INSERT INTO paystack_webhook_events VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING *`,
              [key, event],
            )
          ).length > 0,
      };
      const route = load("../src/app/api/webhooks/paystack/route.ts", {
        "@/lib/distribution/notifications": {
          flushProgramNotices: async () => ({}),
        },
        "@/lib/distribution/finance": {
          recordDistributionRisk: async () => {},
          reconcileDistributionPayments: async () => ({}),
        },
        "next/server": next,
        "@/lib/db/client": { getSql: () => sql },
        "@/lib/db/organizations": { getInfrastructure: async () => null },
        "@/lib/website-billing-webhooks": webhooks,
        "@/lib/business-email/service": { handleEmailEvent: async () => false },
        "@/lib/custom/service": { handleCustomEvent: async () => false },
        "@/lib/domains/service": { handleDomainEvent: async () => false },
        "@/lib/paystack": provider,
        "@/lib/db/billing": dbBilling,
        "@/lib/db/invoices": {},
        "@/lib/ai/billing-fulfilment": {},
        "@/lib/invoice-finalize": {},
        "@/lib/db/affiliates": {},
        "@/lib/db/storage-overage": {},
        "@/lib/billing": billing,
      });
      async function send(event, data, valid = true) {
        const body = JSON.stringify({ event, data });
        const signature = valid
          ? crypto
              .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
              .update(body)
              .digest("hex")
          : "bad";
        return route.POST(
          new next.NextRequest("http://localhost/api/webhooks/paystack", {
            method: "POST",
            body,
            headers: { "x-paystack-signature": signature },
          }),
        );
      }
      const create = {
        id: 70,
        subscription_code: "SUB_1",
        email_token: "private-token",
        customer: { customer_code: "CUS_owner" },
        plan: { plan_code: "PLN_growth" },
        next_payment_date: billing
          .addBillingCycle(new Date(), "yearly")
          .toISOString(),
      };
      assert.equal(
        (await send("charge.success", payment(), false)).status,
        401,
      );
      assert.equal(
        (await query("SELECT * FROM website_plan_payments", [])).length,
        0,
      );
      assert.equal((await send("subscription.create", create)).status, 503);
      assert.equal(
        (await query("SELECT * FROM paystack_webhook_events", [])).length,
        0,
      );
      const paid = payment();
      assert.equal((await send("charge.success", paid)).status, 200);
      assert.equal((await send("charge.success", paid)).status, 200);
      assert.equal(
        (await query("SELECT * FROM website_plan_payments", [])).length,
        1,
      );
      assert.equal((await send("subscription.create", create)).status, 200);
      assert.equal(
        (await store.currentWebsitePlan(query, org)).subscription_code,
        "SUB_1",
      );
      assert.equal(
        (
          await send("invoice.payment_failed", {
            id: 71,
            subscription: { subscription_code: "SUB_1" },
          })
        ).status,
        200,
      );
      assert.equal(
        (await store.currentWebsitePlan(query, org)).status,
        "past_due",
      );
      assert.equal(
        (
          await send("subscription.not_renew", {
            id: 72,
            subscription_code: "SUB_1",
          })
        ).status,
        200,
      );
      const end = (await store.currentWebsitePlan(query, org)).period_end;
      assert.ok(new Date(end) > new Date());
      assert.equal(
        (await store.currentWebsitePlan(query, org)).cancel_at_period_end,
        true,
      );
      // Two businesses owned by the same email/customer have distinct provider
      // plan codes, so subscription.create can never attach to both tenants.
      await query(
        `INSERT INTO website_plan_provider_plans(organization_id,plan_id,interval,amount_kobo,plan_code,lease_token) VALUES($1,'growth','yearly',15000000,'PLN_other','lease')`,
        [other],
      );
      const otherRef = "jktl_web_22222222222222222222222222222222";
      await checkout(query, otherRef, other);
      await query(
        `UPDATE website_plan_checkouts SET provider_plan_code='PLN_other' WHERE reference=$1`,
        [otherRef],
      );
      assert.equal(
        (
          await send(
            "charge.success",
            payment({
              id: 9010,
              reference: otherRef,
              plan: { plan_code: "PLN_other" },
              metadata: {
                type: "website_plan",
                organizationId: other,
                planId: "growth",
                interval: "yearly",
              },
            }),
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await send("subscription.create", {
            ...create,
            id: 170,
            subscription_code: "SUB_2",
            plan: { plan_code: "PLN_other" },
          })
        ).status,
        200,
      );
      assert.equal(
        (await store.currentWebsitePlan(query, org)).subscription_code,
        "SUB_1",
      );
      assert.equal(
        (await store.currentWebsitePlan(query, other)).subscription_code,
        "SUB_2",
      );
      await store.requestWebsiteRefund(query, org, "Within guarantee");
      assert.equal(
        (
          await send("refund.processed", {
            id: 73,
            transaction: { reference: paid.reference },
            amount: paid.amount,
            currency: "NGN",
          })
        ).status,
        200,
      );
      assert.equal(
        (await query("SELECT status FROM website_plan_refund_requests", []))[0]
          .status,
        "refunded",
      );
      assert.ok(
        new Date((await store.currentWebsitePlan(query, org)).period_end) <=
          new Date(),
      );
      const laterPaid = billing.addBillingCycle(
        new Date(paid.paid_at),
        "monthly",
      );
      const laterEnd = billing.addBillingCycle(laterPaid, "yearly");
      await query(
        `UPDATE website_plan_subscriptions SET last_paid_at=$2,period_end=$3,status='active' WHERE organization_id=$1`,
        [org, laterPaid.toISOString(), laterEnd.toISOString()],
      );
      await webhooks.handleWebsiteBillingEvent("refund.processed", {
        transaction: { reference: paid.reference },
        amount: paid.amount,
        currency: "NGN",
      });
      assert.equal(
        new Date(
          (await store.currentWebsitePlan(query, org)).period_end,
        ).toISOString(),
        laterEnd.toISOString(),
        "An old refund cannot revoke a later paid period",
      );
    } finally {
      if (oldSecret === undefined) delete process.env.PAYSTACK_SECRET_KEY;
      else process.env.PAYSTACK_SECRET_KEY = oldSecret;
    }
  } finally {
    await db.close();
  }
});
test("new paid entitlements enforce finite image storage and collaborator counts while preserving legacy access", async () => {
  const { db, query } = await setup();
  try {
    await db.exec(
      `CREATE TABLE ai_receptionist_contracts(organization_id uuid,status text);CREATE TABLE infrastructure_accounts(organization_id uuid,storage_used_bytes bigint,storage_limit_bytes bigint);INSERT INTO infrastructure_accounts VALUES('${org}',0,52428800);CREATE TABLE organization_members(id uuid primary key,organization_id uuid,user_id uuid,name text,email text,role text,title text,active boolean default true);INSERT INTO organization_members(id,organization_id,name,email,role,title) VALUES('33333333-3333-4333-8333-333333333333','${org}','Owner','owner@example.com','owner','');`,
    );
    await checkout(query);
    await store.fulfilWebsitePayment(query, payment(), org);
    const sql = Object.assign(
      (strings, ...values) => {
        let text = strings[0];
        values.forEach((_, i) => (text += `$${i + 1}` + strings[i + 1]));
        return {
          text,
          values,
          then(resolve, reject) {
            return query(text, values).then(resolve, reject);
          },
        };
      },
      {
        query,
        transaction: async (statements) =>
          db.transaction(async (tx) => {
            const result = [];
            for (const statement of statements)
              result.push(
                (await tx.query(statement.text, statement.values)).rows,
              );
            return result;
          }),
      },
    );
    let legacy = false;
    const access = load("../src/lib/db/entitlements.ts", {
      "server-only": {},
      "./client": { getSql: () => sql },
      "./billing": { isSubscriptionActive: async () => legacy },
    });
    const entitlement = await access.getEntitlement(org);
    assert.equal(entitlement.source, "website_plan");
    assert.equal(entitlement.teamSeats, 5);
    assert.equal(entitlement.storageBytes, 5 * 1024 ** 3);
    const storage = load("../src/lib/db/storage.ts", {
      "server-only": {},
      "./client": { getSql: () => sql },
      "./entitlements": access,
      "@/lib/billing": billing,
    });
    assert.equal(
      (await storage.getStorageUsage(org)).limitBytes,
      5 * 1024 ** 3,
    );
    await query(
      `UPDATE infrastructure_accounts SET storage_used_bytes=$2 WHERE organization_id=$1`,
      [org, 5 * 1024 ** 3],
    );
    assert.equal(await storage.hasStorageQuota(org, 1), false);
    assert.equal((await storage.getStorageUsage(org)).overageKobo, 0);
    legacy = true;
    assert.equal((await access.getEntitlement(org)).source, "legacy_plan");
    assert.equal(await storage.hasStorageQuota(org, 1), true);
    legacy = false;
    const members = load("../src/lib/db/members.ts", {
      "./client": { getSql: () => sql },
    });
    const attempts = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) =>
        members.addMember(
          org,
          `44444444-4444-4444-8444-${String(i).padStart(12, "0")}`,
          {
            name: `Staff ${i}`,
            email: `staff${i}@example.com`,
            role: "staff",
            title: "",
          },
          5,
        ),
      ),
    );
    assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 4);
    assert.equal(
      Number(
        (
          await query(
            "SELECT count(*) AS n FROM organization_members WHERE organization_id=$1",
            [org],
          )
        )[0].n,
      ),
      5,
    );
    await assert.rejects(() =>
      members.addMember(other, "33333333-3333-4333-8333-333333333333", {
        name: "Forged",
        email: "x@example.com",
        role: "staff",
        title: "",
      }),
    );
    assert.equal(
      (
        await query(
          `SELECT name FROM organization_members WHERE role='owner'`,
          [],
        )
      )[0].name,
      "Owner",
    );
  } finally {
    await db.close();
  }
});
test("real checkout action uses server quotes, explicit consent and separate provider plans for businesses sharing an email", async () => {
  const { db, query } = await setup();
  try {
    let currentOrg = org;
    const created = [],
      initialized = [];
    const sql = Object.assign(async () => [{ user_id: "owner" }], { query });
    const actions = load("../src/lib/actions/website-billing-actions.ts", {
      "node:crypto": await import("node:crypto"),
      "@/lib/session": {
        requireSession: async () => ({
          organizationId: currentOrg,
          userId: "owner",
        }),
      },
      "@/lib/db/client": {
        getSql: () => sql,
        isSchemaOutOfDateError: () => false,
      },
      "@/lib/db/organizations": {
        getInfrastructure: async () => null,
        getUser: async () => ({ email: "same-owner@example.com" }),
      },
      "@/lib/paystack": {
        findWebsiteProviderPlan: async () => null,
        createPlan: async (params) => {
          created.push(params);
          return { planCode: `PLN_tenant_${created.length}` };
        },
        initializeWebsitePlanCheckout: async (params) => {
          initialized.push(params);
          return {
            reference: params.reference,
            authorizationUrl: `https://checkout.paystack.com/test_${initialized.length}`,
            accessCode: "test",
          };
        },
      },
      "@/lib/website-plan-store": store,
      "@/lib/website-pricing": pricing,
    });
    assert.equal(
      (await actions.startWebsitePlanCheckoutAction("growth", "yearly", false))
        .ok,
      false,
    );
    assert.equal(created.length, 0);
    assert.equal(
      (await actions.startWebsitePlanCheckoutAction("growth", "yearly", true))
        .ok,
      true,
    );
    assert.equal(
      (await actions.startWebsitePlanCheckoutAction("growth", "yearly", true))
        .ok,
      true,
    );
    assert.equal(created.length, 1);
    assert.equal(initialized.length, 1);
    currentOrg = other;
    assert.equal(
      (await actions.startWebsitePlanCheckoutAction("growth", "yearly", true))
        .ok,
      true,
    );
    assert.equal(created.length, 2);
    assert.notEqual(created[0].name, created[1].name);
    assert.equal(initialized[0].amountKobo, 15000000);
    assert.equal(initialized[1].amountKobo, 15000000);
    assert.notEqual(
      initialized[0].metadata.organizationId,
      initialized[1].metadata.organizationId,
    );
    assert.equal(
      (
        await query(
          "SELECT DISTINCT plan_code FROM website_plan_provider_plans",
          [],
        )
      ).length,
      2,
    );
    const rows = await query(
      "SELECT terms_version,consent_at FROM website_plan_checkouts",
      [],
    );
    assert.equal(rows[0].terms_version, "website-2026-10-24");
    assert.ok(rows[0].consent_at);
  } finally {
    await db.close();
  }
});
