// Provider payloads are synthetic test fixtures, never live financial requests.
import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { load } from "./fixtures/lifecycle-db.mjs";
import * as policy from "../src/lib/invoicing/policy.ts";
const model = load("src/lib/merchant-fees/model.ts", {
  "@/lib/invoicing/policy": policy,
});
const org = crypto.randomUUID(),
  other = crypto.randomUUID(),
  invoice = crypto.randomUUID(),
  actor = crypto.randomUUID();
const form = (o) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o))
    for (const n of Array.isArray(v) ? v : [v]) f.append(k, String(n));
  return f;
};
async function fixture() {
  const db = new PGlite(),
    q = async (s, p = []) => (await db.query(s, p)).rows;
  await db.exec(
    `CREATE TABLE organizations(id uuid PRIMARY KEY,name text,slug text);CREATE TABLE business_profiles(organization_id uuid,display_name text);CREATE TABLE admin_users(id uuid PRIMARY KEY);CREATE TABLE growth_visits(id uuid PRIMARY KEY,organization_id uuid,created_at timestamptz DEFAULT now());CREATE TABLE invoices(id uuid PRIMARY KEY,organization_id uuid,total_kobo bigint,status text,paid_at timestamptz,paid_via text DEFAULT 'manual',payment_reference text DEFAULT '',platform_fee_kobo bigint DEFAULT 0);INSERT INTO organizations VALUES('${org}','Fixture merchant','one'),('${other}','Other merchant','two');INSERT INTO business_profiles VALUES('${org}','Fixture merchant'),('${other}','Other merchant');INSERT INTO admin_users VALUES('${actor}');INSERT INTO invoices(id,organization_id,total_kobo,status) VALUES('${invoice}','${org}',7500000,'pending');`,
  );
  await db.exec(readFileSync("migrations/076_company_finance.sql", "utf8"));
  await db.exec(readFileSync("migrations/077_buyer_paid_fees.sql", "utf8"));
  await db.exec(readFileSync("migrations/077_buyer_paid_fees.sql", "utf8"));
  const notices = [],
    calls = [],
    state = { allowed: true, timeout: false, verified: null, tenant: org };
  const getInvoice = async (o, id) => {
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
          onlineReceivedKobo: Number(r.online_received_kobo),
          platformFeeKobo: Number(r.platform_fee_kobo),
        }
      : null;
  };
  const getPublicInvoice = async (id) => {
    const r = (
      await q("SELECT organization_id FROM invoices WHERE id=$1", [id])
    )[0];
    return r
      ? {
          ...(await getInvoice(r.organization_id, id)),
          payoutReady: true,
          number: "INV-FIXTURE",
          customerEmail: "payer@example.test",
        }
      : null;
  };
  const fees = load("src/lib/merchant-fees/service.ts", {
    "server-only": {},
    "node:crypto": await import("node:crypto"),
    "@/lib/custom/service": { query: q },
    "@/lib/db/invoices": { getPublicInvoice },
    "@/lib/db/payments": {
      getPaymentSettings: async () => ({
        bankCode: "058",
        accountNumber: "0000000000",
        accountName: "Fixture owner",
        subaccountCode: "ACCT_fixture",
      }),
    },
    "@/lib/invoicing/policy": policy,
    "./model": model,
  });
  const payments = load("src/lib/company-finance/payments.ts", {
    "server-only": {},
    "node:crypto": await import("node:crypto"),
    "@/lib/custom/service": { query: q },
    "@/lib/db/invoices": { getInvoice },
    "@/lib/paystack": {
      INVOICE_PLATFORM_FEE_KOBO: policy.INVOICE_PLATFORM_FEE_KOBO,
    },
    "@/lib/invoice-finalize": {
      finalizeInvoicePaid: async (...a) => notices.push(a),
    },
    "./model": await import("../src/lib/company-finance/model.ts"),
  });
  const caps = {
    requireAdminCapability: async (cap) => {
      assert.ok(
        ["manage_company_finance", "view_company_finance"].includes(cap),
      );
      if (!state.allowed) throw Error("Unauthorized");
      return { id: actor };
    },
  };
  const owner = load("src/lib/actions/merchant-fee-actions.ts", {
    "node:crypto": await import("node:crypto"),
    "@/lib/admin-session": caps,
    "@/lib/security/auth-rate-limit": { authRateLimit: async () => {} },
    "@/lib/custom/service": { query: q },
    "next/cache": { revalidatePath() {}, revalidateTag() {} },
    "@/lib/merchant-fees/model": model,
    "@/lib/merchant-fees/service": fees,
  });
  const checkout = load("src/lib/actions/invoice-payment-actions.ts", {
    "next/headers": { headers: async () => new Headers() },
    "@/lib/security/auth-rate-limit": { authRateLimit: async () => {} },
    "@/lib/custom/service": { query: q },
    "@/lib/company-finance/payments": payments,
    "@/lib/merchant-fees/service": fees,
    "@/lib/paystack": {
      initializeInvoicePayment: async (p) => {
        calls.push(p);
        if (state.timeout) throw Error("Synthetic timeout");
        return {
          authorizationUrl: "https://checkout.paystack.com/fixture",
          reference: p.reference,
        };
      },
      verifyTransaction: async () => state.verified,
    },
  });
  const reporting = load("src/lib/merchant-fees/reporting.ts", {
    "server-only": {},
    "@/lib/custom/service": { query: q },
    "@/lib/admin-session": caps,
    "@/lib/invoicing/access": {
      invoiceAccess: async () => ({ organizationId: state.tenant }),
    },
    "@/lib/investor/model": await import("../src/lib/investor/model.ts"),
  });
  const envNames = [
      "PAYSTACK_SECRET_KEY",
      "JKTL_BUYER_PAID_FEES_APPROVED",
      "JKTL_BUYER_FEES_TEST_MODE",
    ],
    saved = Object.fromEntries(envNames.map((k) => [k, process.env[k]]));
  for (const k of envNames) delete process.env[k];
  const activate = async (id = "00000000-0000-4000-8000-000000000077") => {
    process.env.PAYSTACK_SECRET_KEY = "sk_test_synthetic";
    process.env.JKTL_BUYER_FEES_TEST_MODE = "true";
    const c = (await q("SELECT rev FROM merchant_fee_configuration"))[0];
    await owner.activateBuyerFeePolicyAction(
      form({
        policy_id: id,
        rev: c.rev,
        provider_evidence: "Synthetic split response test fixture",
        requirements_evidence: "Synthetic explicit test-only approval fixture",
        confirmed: "on",
      }),
    );
  };
  const payload = (call, patch = {}) => ({
    id: "provider-" + call.reference,
    reference: call.reference,
    status: "success",
    currency: "NGN",
    domain: "live",
    fees: 31000,
    paid_at: "2026-11-08T09:00:00Z",
    amount: call.amountKobo,
    metadata: call.metadata,
    ...patch,
  });
  return {
    db,
    q,
    fees,
    payments,
    owner,
    checkout,
    reporting,
    activate,
    payload,
    state,
    notices,
    calls,
    close: async () => {
      for (const k of envNames) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
      await db.close();
    },
  };
}
test("requested NGN boundaries use merchant principal once, including cart totals and company billing exemptions", () => {
  const p = {
    id: "fixture",
    version: 1,
    label: "Fixture only",
    enabled: true,
    bands: model.PROPOSED_BANDS,
    sources: ["INVOICE", "WEBSITE"],
    exemptOrganizations: [],
  };
  for (const [naira, fee] of [
    [1000, 0],
    [4999, 0],
    [4999.99, 0],
    [5000, 100],
    [20000, 100],
    [49999, 100],
    [49999.99, 100],
    [50000, 200],
    [100000, 200],
  ])
    for (const source of ["INVOICE", "WEBSITE"])
      assert.equal(
        model.buyerFee(model.minorInput(String(naira)), source, org, p),
        fee * 100,
      );
  assert.equal(
    model.buyerFee(2500000 + 2500000, "WEBSITE", org, p),
    20000,
    "one fee on the order total, not a fee per item",
  );
  assert.equal(
    model.buyerFee(4999999, "INVOICE", org, p),
    10000,
    "added fee cannot push the payment to the next band",
  );
  for (const source of [
    "SUBSCRIPTION",
    "DOMAIN",
    "EMAIL",
    "CUSTOM",
    "INFRASTRUCTURE",
  ])
    assert.equal(model.buyerFee(10000000, source, org, p), 0);
  assert.equal(
    model.buyerFee(10000000, "INVOICE", org, {
      ...p,
      exemptOrganizations: [org],
    }),
    0,
  );
  assert.equal(
    model.buyerFee(10000000, "INVOICE", org, { ...p, enabled: false }),
    0,
  );
  assert.throws(() =>
    model.validateBands([
      { minKobo: 0, feeKobo: 0 },
      { minKobo: 0, feeKobo: 100 },
    ]),
  );
  assert.throws(() => model.validateBands([{ minKobo: 0, feeKobo: -1 }]));
  assert.throws(() => model.buyerFee(1.5, "INVOICE", org, p));
});
test("migration seeds an inactive proposal; publishing requires provider gates, approval, current revision and Owner access", async () => {
  const f = await fixture();
  try {
    assert.equal(
      (await f.q("SELECT active_policy_id FROM merchant_fee_configuration"))[0]
        .active_policy_id,
      null,
    );
    assert.equal(
      (await f.fees.invoiceCheckoutContext(invoice, 2000000)).quote.feeKobo,
      5000,
    );
    await assert.rejects(
      f.owner.activateBuyerFeePolicyAction(
        form({
          policy_id: "00000000-0000-4000-8000-000000000077",
          rev: 0,
          confirmed: "on",
        }),
      ),
      /locked/,
    );
    f.state.allowed = false;
    await assert.rejects(
      f.owner.saveBuyerFeePolicyAction(new FormData()),
      /Unauthorized/,
    );
    f.state.allowed = true;
    await f.activate();
    assert.equal(
      (await f.fees.invoiceCheckoutContext(invoice, 2000000)).quote.feeKobo,
      10000,
    );
    await assert.rejects(
      f.q("UPDATE merchant_fee_policies SET enabled=false"),
      /immutable/,
    );
    await assert.rejects(
      f.q(
        "INSERT INTO merchant_fee_policies(label,bands,sources,created_by) VALUES('Malformed','[{}]','{INVOICE}','fixture')",
      ),
      /check constraint/,
    );
    await assert.rejects(
      f.owner.activateBuyerFeePolicyAction(
        form({
          policy_id: "00000000-0000-4000-8000-000000000077",
          rev: 0,
          provider_evidence: "Synthetic provider evidence",
          requirements_evidence: "Synthetic reviewed approval",
          confirmed: "on",
        }),
      ),
      /latest policy/,
    );
    const pub = load("src/app/api/public/transaction-fees/route.ts", {
      "next/server": await import("next/server.js"),
      "@/lib/merchant-fees/service": f.fees,
    });
    assert.deepEqual(
      await (await pub.GET()).json(),
      { approved: false },
      "test approval never publishes a live schedule",
    );
  } finally {
    await f.close();
  }
});
test("quote confirmation, full and partial payments retain principal and charge one fee per successful payment", async () => {
  const f = await fixture();
  try {
    await f.activate();
    const first = (await f.fees.invoiceCheckoutContext(invoice, 2000000)).quote;
    assert.equal(first.buyerTotalKobo, 2010000);
    assert.equal(
      (await f.q("SELECT count(*) n FROM merchant_payment_attempts"))[0].n,
      0,
    );
    const forged = await f.checkout.initiateInvoicePaymentAction(
      invoice,
      2000000,
      "forged",
    );
    assert.equal(forged.ok, false);
    assert.equal(f.calls.length, 0);
    assert.equal(
      (
        await f.checkout.initiateInvoicePaymentAction(
          invoice,
          2000000,
          first.token,
        )
      ).ok,
      true,
    );
    assert.equal(f.calls[0].transactionChargeKobo, 10000);
    assert.equal(f.calls[0].subaccountCode, "ACCT_fixture");
    const data = f.payload(f.calls[0]);
    await f.payments.recordVerifiedMerchantPayment(data);
    await f.payments.recordVerifiedMerchantPayment(data);
    let inv = (await f.q("SELECT * FROM invoices"))[0];
    assert.equal(inv.status, "pending");
    assert.equal(Number(inv.online_received_kobo), 2000000);
    assert.equal(Number(inv.total_kobo), 7500000);
    assert.equal(f.notices.length, 1);
    assert.equal(f.notices[0][2].remainingKobo, 5500000);
    const last = (await f.fees.invoiceCheckoutContext(invoice)).quote;
    assert.equal(last.principalKobo, 5500000);
    assert.equal(last.feeKobo, 20000);
    await f.checkout.initiateInvoicePaymentAction(
      invoice,
      last.principalKobo,
      last.token,
    );
    await f.payments.recordVerifiedMerchantPayment(f.payload(f.calls[1]));
    inv = (await f.q("SELECT * FROM invoices"))[0];
    assert.equal(inv.status, "paid");
    assert.equal(Number(inv.online_received_kobo), 7500000);
    assert.equal(Number(inv.platform_fee_kobo), 30000);
    assert.equal(f.notices.length, 2);
    assert.equal(
      Number(
        (await f.q("SELECT sum(principal_kobo) n FROM merchant_payments"))[0].n,
      ),
      7500000,
    );
  } finally {
    await f.close();
  }
});
test("frozen quotes survive policy changes and rollback; stale, changed or excessive payments cannot start silently", async () => {
  const f = await fixture();
  try {
    await f.activate();
    const q = (await f.fees.invoiceCheckoutContext(invoice, 2000000)).quote;
    await f.checkout.initiateInvoicePaymentAction(
      invoice,
      q.principalKobo,
      q.token,
    );
    await f.owner.saveBuyerFeePolicyAction(
      form({
        label: "New fee draft",
        bands: JSON.stringify([{ minKobo: 0, feeKobo: 25000 }]),
        sources: ["INVOICE"],
        enabled: "on",
      }),
    );
    const id = (
      await f.q(
        "SELECT id FROM merchant_fee_policies ORDER BY version DESC LIMIT 1",
      )
    )[0].id;
    await f.activate(id);
    const frozen = (await f.fees.invoiceCheckoutContext(invoice, 3000000))
      .quote;
    assert.equal(frozen.feeKobo, 10000);
    assert.equal(frozen.principalKobo, 2000000);
    assert.equal(frozen.token, q.token);
    assert.equal(frozen.locked, true);
    const c = (await f.q("SELECT rev FROM merchant_fee_configuration"))[0];
    await f.owner.rollbackBuyerFeePolicyAction(
      form({
        rev: c.rev,
        reason: "Synthetic rollback verification",
        confirmed: "on",
      }),
    );
    assert.equal(
      (await f.fees.invoiceCheckoutContext(invoice)).quote.feeKobo,
      10000,
    );
    await f.q("UPDATE invoices SET total_kobo=8000000");
    await assert.rejects(
      f.fees.invoiceCheckoutContext(invoice),
      /changed after checkout/,
    );
    const result = await f.payments.recordVerifiedMerchantPayment(
      f.payload(f.calls[0]),
    );
    assert.equal(result.applied, false);
    assert.equal(
      Number(
        (await f.q("SELECT online_received_kobo FROM invoices"))[0]
          .online_received_kobo,
      ),
      0,
    );
  } finally {
    await f.close();
  }
});
test("concurrent and timed-out initializations preserve one checkout and delayed confirmations remain pending", async () => {
  const f = await fixture();
  try {
    await f.activate();
    f.state.timeout = true;
    const quote = (await f.fees.invoiceCheckoutContext(invoice, 2000000)).quote;
    const r = await Promise.all([
      f.checkout.initiateInvoicePaymentAction(
        invoice,
        quote.principalKobo,
        quote.token,
      ),
      f.checkout.initiateInvoicePaymentAction(
        invoice,
        quote.principalKobo,
        quote.token,
      ),
    ]);
    assert.equal(
      r.every((x) => !x.ok),
      true,
    );
    assert.equal(f.calls.length, 1);
    assert.equal(
      (await f.q("SELECT state FROM merchant_payment_attempts"))[0].state,
      "UNKNOWN",
    );
    f.state.timeout = false;
    const locked = (await f.fees.invoiceCheckoutContext(invoice)).quote;
    await f.checkout.initiateInvoicePaymentAction(
      invoice,
      locked.principalKobo,
      locked.token,
    );
    assert.equal(f.calls.length, 1);
    f.state.verified = f.payload(f.calls[0], { status: "pending" });
    assert.equal(
      (
        await f.checkout.verifyInvoicePaymentAction(
          f.calls[0].reference,
          invoice,
        )
      ).data.status,
      "pending",
    );
    assert.equal(
      (await f.q("SELECT status FROM invoices"))[0].status,
      "pending",
    );
  } finally {
    await f.close();
  }
});
test("wrong amount, currency and tenant cannot settle; full/partial refunds and disputes stay auditable with held fee allocations", async () => {
  const f = await fixture();
  try {
    await f.activate();
    const quote = (await f.fees.invoiceCheckoutContext(invoice, 2000000)).quote;
    await f.checkout.initiateInvoicePaymentAction(
      invoice,
      quote.principalKobo,
      quote.token,
    );
    const p = f.payload(f.calls[0]);
    for (const patch of [
      { amount: p.amount - 1 },
      { currency: "USD" },
      { status: "failed" },
      { metadata: { ...p.metadata, organizationId: other } },
    ])
      await assert.rejects(
        f.payments.recordVerifiedMerchantPayment({ ...p, ...patch }),
      );
    assert.equal(f.notices.length, 0);
    await f.payments.recordVerifiedMerchantPayment(p);
    for (const [id, amount] of [
      ["partial", 500000],
      ["remaining", 1510000],
    ]) {
      const data = {
        id,
        amount,
        currency: "NGN",
        transaction: { reference: p.reference },
      };
      await f.payments.handleMerchantPaymentEvent("refund.processed", data);
      await f.payments.handleMerchantPaymentEvent("refund.processed", data);
    }
    await f.payments.handleMerchantPaymentEvent("charge.dispute.create", {
      id: "dispute",
      amount: 100000,
      currency: "NGN",
      transaction: { reference: p.reference },
    });
    assert.equal(
      (
        await f.q(
          "SELECT count(*) n FROM merchant_payment_events WHERE kind='REFUND'",
        )
      )[0].n,
      2,
    );
    const { merchantSql } = load("src/lib/company-finance/queries.ts"),
      { preparedSourceSql } = load("src/lib/investor/queries.ts");
    const stats = (
      await f.q(preparedSourceSql(merchantSql), [
        "2026-11-01",
        "2026-12-01",
        "2026-10-01",
        "2026-11-10",
      ])
    )[0].data;
    assert.equal(stats.earnedFees, 0);
    assert.equal(stats.heldFees, 10000);
    assert.equal(stats.payerRefunds, 2010000);
    assert.equal(stats.disputedTransactions, 1);
  } finally {
    await f.close();
  }
});
test("merchant payment reporting is tenant-scoped and company filters are validated before reading records", async () => {
  const f = await fixture();
  try {
    const quote = (await f.fees.invoiceCheckoutContext(invoice, 2000000)).quote;
    await f.checkout.initiateInvoicePaymentAction(
      invoice,
      quote.principalKobo,
      quote.token,
    );
    await f.payments.recordVerifiedMerchantPayment(f.payload(f.calls[0]));
    let r = await f.reporting.businessPaymentReport("2026-11-01", "2026-11-09");
    assert.equal(r.rows.length, 1);
    f.state.tenant = other;
    r = await f.reporting.businessPaymentReport("2026-11-01", "2026-11-09");
    assert.equal(r.rows.length, 0);
    const period = (await import("../src/lib/investor/model.ts")).reportPeriod(
      "2026-11-01",
      "2026-11-09",
    );
    f.state.allowed = false;
    await assert.rejects(
      f.reporting.companyPaymentReport(period, {}),
      /Unauthorized/,
    );
    f.state.allowed = true;
    await assert.rejects(
      f.reporting.companyPaymentReport(period, { source: "SUBSCRIPTION" }),
      /valid payment filters/,
    );
    assert.equal(
      (
        await f.reporting.companyPaymentReport(period, {
          business: org,
          status: "SUCCESS",
          provider: "paystack",
        })
      ).rows.length,
      1,
    );
  } finally {
    await f.close();
  }
});
test("invoicing and payments intents survive authentication without selecting a website or accepting arbitrary redirects", async () => {
  const i = await import("../src/lib/product-intent.ts");
  for (const [next, dest] of [
    ["invoices", "/business/invoices"],
    ["payments", "/business/settings#payments"],
  ]) {
    const p = new URLSearchParams({ next });
    assert.equal(i.emailIntent(p), "?next=" + next);
    assert.equal(i.emailDestination(p), dest);
  }
  assert.equal(
    i.emailIntent(new URLSearchParams({ next: "https://evil.test" })),
    "",
  );
  assert.equal(
    i.emailDestination(new URLSearchParams({ next: "https://evil.test" })),
    null,
  );
});

test("the public disclosure publishes only an approved live invoice schedule and never exemptions or provider evidence", async () => {
  const next = await import("next/server.js"),
    privatePolicy = {
      id: "private",
      version: 7,
      enabled: true,
      bands: model.PROPOSED_BANDS,
      sources: ["INVOICE", "WEBSITE"],
      exemptOrganizations: [org],
      providerEvidence: "private approval",
    };
  const route = load("src/app/api/public/transaction-fees/route.ts", {
    "next/server": next,
    "@/lib/merchant-fees/service": {
      activationGate: () => "live",
      activeFeePolicy: async () => privatePolicy,
    },
  });
  let data = await (await route.GET()).json();
  assert.equal(data.approved, true);
  assert.deepEqual(data.bands, model.PROPOSED_BANDS);
  assert.deepEqual(data.sources, ["INVOICE"]);
  assert.equal(JSON.stringify(data).includes(org), false);
  assert.equal(JSON.stringify(data).includes("private"), false);
  privatePolicy.sources = ["WEBSITE"];
  data = await (await route.GET()).json();
  assert.deepEqual(
    data.bands,
    [{ minKobo: 0, feeKobo: 0 }],
    "a future-only source does not advertise fees on the currently supported invoice path",
  );
});
