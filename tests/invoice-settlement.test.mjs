// All providers, recipients and account numbers below are synthetic fixtures.
import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { load } from "./fixtures/lifecycle-db.mjs";
import * as policy from "../src/lib/invoicing/policy.ts";
import * as rows from "../src/lib/db/rows.ts";
import * as addresses from "../src/lib/mail/addresses.ts";
const org = crypto.randomUUID(),
  other = crypto.randomUUID(),
  customer = crypto.randomUUID();
const settings = {
  bankCode: "058",
  bankName: "Fixture Bank",
  accountNumber: "0000000000",
  accountName: "Fixture Owner",
  subaccountCode: "ACCT_fixture",
};
const input = () => ({
  id: crypto.randomUUID(),
  number: "INV-FIXTURE",
  customerId: customer,
  status: "pending",
  dueDate: "2026-11-30",
  discountKobo: 0,
  notes: "",
  items: [
    {
      id: crypto.randomUUID(),
      description: "Website design",
      quantity: 1,
      unitPriceKobo: 100000,
    },
  ],
});
test("receiving bank requirement is enforced by SQL and preserves tenant ownership", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `CREATE TABLE organizations(id uuid PRIMARY KEY);CREATE TABLE customers(id uuid PRIMARY KEY,organization_id uuid);CREATE TABLE payment_settings(organization_id uuid PRIMARY KEY,settlement_bank_code text,settlement_account_number text,settlement_account_name text,paystack_subaccount_code text);`,
    );
    const init = readFileSync(
      new URL("../migrations/001_init.sql", import.meta.url),
      "utf8",
    );
    await db.exec(
      init.slice(
        init.indexOf("CREATE TABLE IF NOT EXISTS invoices ("),
        init.indexOf("CREATE TABLE IF NOT EXISTS inventory_movements ("),
      ),
    );
    await db.exec(
      `ALTER TABLE invoices ADD COLUMN paid_via text DEFAULT 'manual',ADD COLUMN platform_fee_kobo bigint DEFAULT 0,ADD COLUMN payment_reference text DEFAULT '';INSERT INTO organizations VALUES('${org}'),('${other}');INSERT INTO customers VALUES('${customer}','${org}');`,
    );
    const sql = async (parts, ...values) =>
      (
        await db.query(
          parts.reduce((s, p, i) => s + (i ? "$" + i : "") + p, ""),
          values,
        )
      ).rows;
    const inv = load("src/lib/db/invoices.ts", {
      "./client": { getSql: () => sql },
      "./rows": rows,
    });
    await assert.rejects(inv.createInvoice(org, input()), /receiving bank/);
    await db.query("INSERT INTO payment_settings VALUES($1,$2,$3,$4,$5)", [
      org,
      settings.bankCode,
      settings.accountNumber,
      settings.accountName,
      settings.subaccountCode,
    ]);
    const request = input(),
      created = await inv.createInvoice(org, request);
    assert.equal(created.invoice.organizationId, org);
    assert.equal(created.invoice.totalKobo, 100000);
    await db.query("INSERT INTO payment_settings VALUES($1,$2,$3,$4,$5)", [
      other,
      settings.bankCode,
      settings.accountNumber,
      settings.accountName,
      "ACCT_other",
    ]);
    await assert.rejects(
      inv.createInvoice(other, { ...request, notes: "attacker" }),
    );
    assert.equal((await inv.getInvoice(org, request.id)).notes, "");
    await assert.rejects(
      inv.createInvoice(org, { ...input(), discountKobo: 100001 }),
    );
    assert.equal(
      (
        await inv.markInvoicePaidOnline(org, request.id, {
          reference: "fixture-payment",
          platformFeeKobo: 5000,
        })
      ).status,
      "paid",
    );
    assert.equal(
      await inv.markInvoicePaidOnline(org, request.id, {
        reference: "fixture-payment",
        platformFeeKobo: 5000,
      }),
      null,
    );
  } finally {
    await db.close();
  }
});
test("owners alone change receiving accounts, names are resolved server-side and failed setup is not saved", async () => {
  let role = "staff",
    writes = 0,
    provider = 0,
    bank = "";
  const session = { organizationId: org, userId: crypto.randomUUID() };
  const access = load("src/lib/invoicing/access.ts", {
    "server-only": {},
    "@/lib/session": { requireSession: async () => session },
    "@/lib/custom/service": { query: async () => [{ role }] },
  });
  await assert.rejects(access.invoiceAccess(true));
  role = "manager";
  await access.invoiceAccess();
  await assert.rejects(access.invoiceAccess(true));
  role = "owner";
  await access.invoiceAccess(true);
  const pay = load("src/lib/actions/payment-settings-actions.ts", {
    "@/lib/invoicing/access": access,
    "@/lib/db/organizations": {
      getBusinessProfile: async () => ({ displayName: "Fixture Business" }),
    },
    "@/lib/db/payments": {
      getPaymentSettings: async () => ({ ...settings, subaccountCode: "" }),
      savePaymentSettings: async (_, s) => {
        writes++;
        bank = s.bankName;
        return s;
      },
    },
    "@/lib/paystack": {
      listBanks: async () => [{ code: "058", name: "Official fixture bank" }],
      resolveAccountNumber: async () => ({
        accountNumber: "0000000000",
        accountName: "Resolved Fixture Owner",
      }),
      createSubaccount: async () => {
        provider++;
        return { subaccountCode: "ACCT_fixture" };
      },
    },
  });
  const r = await pay.savePaymentSettingsAction({
    bankCode: "058",
    bankName: "forged",
    accountNumber: "0000000000",
  });
  assert.equal(r.ok, true);
  assert.equal(bank, "Official fixture bank");
  assert.equal(r.data.accountName, "Resolved Fixture Owner");
  assert.equal(writes, 1);
  assert.equal(provider, 1);
  assert.equal(
    (
      await pay.savePaymentSettingsAction({
        bankCode: "058",
        bankName: "x",
        accountNumber: "abcdefghij",
      })
    ).ok,
    false,
  );
  assert.equal(writes, 1);
});
test("provider requests use settlement_bank and split payment into only the saved business subaccount", async () => {
  const previous = globalThis.fetch,
    key = process.env.PAYSTACK_SECRET_KEY,
    sent = [];
  process.env.PAYSTACK_SECRET_KEY = "synthetic-not-a-live-key";
  globalThis.fetch = async (url, opts) => {
    sent.push({ url, body: JSON.parse(opts.body) });
    return {
      ok: true,
      json: async () => ({
        status: true,
        data: url.endsWith("/subaccount")
          ? { subaccount_code: "ACCT_fixture" }
          : {
              authorization_url: "https://checkout.paystack.com/fixture",
              reference: "fixture",
            },
      }),
    };
  };
  try {
    const p = load("src/lib/paystack.ts", { "server-only": {}, "@/lib/invoicing/policy": policy });
    await p.createSubaccount({
      businessName: "Fixture Business",
      bankCode: "058",
      accountNumber: "0000000000",
    });
    assert.equal(sent[0].body.settlement_bank, "058");
    assert.equal(sent[0].body.bank_code, undefined);
    await p.initializeInvoicePayment({
      email: "payer@example.test",
      amountKobo: 105000,
      subaccountCode: settings.subaccountCode,
      transactionChargeKobo: 5000,
      callbackUrl: "https://business.jktl.com.ng/pay/fixture/callback",
      metadata: {
        type: "invoice_payment",
        organizationId: org,
        invoiceId: "fixture",
      },
    });
    assert.equal(sent[1].body.subaccount, "ACCT_fixture");
    assert.equal(sent[1].body.amount, 105000);
    assert.equal(sent[1].body.transaction_charge, 5000);
    assert.equal(sent[1].body.bearer, "account");
  } finally {
    globalThis.fetch = previous;
    if (key === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = key;
  }
});
test("only exact successful NGN payments pass and bank readiness cannot be forged with partial details", () => {
  const payment = {
    status: "success",
    amount: 105000,
    currency: "NGN",
    reference: "fixture",
  };
  assert.equal(policy.validInvoicePayment(payment, 100000, 5000), true);
  for (const patch of [
    { amount: 100000 },
    { amount: 104999 },
    { currency: "USD" },
    { status: "failed" },
    { reference: "" },
    { amount: "105000" },
  ])
    assert.equal(
      policy.validInvoicePayment({ ...payment, ...patch }, 100000, 5000),
      false,
    );
  assert.equal(policy.payoutReady(settings), true);
  assert.equal(policy.payoutReady({ ...settings, subaccountCode: "" }), false);
  assert.equal(policy.payoutReady({ ...settings, accountName: "" }), false);
  assert.match(
    policy.businessInvoiceSender("Business\r\n<fake@example.test>"),
    /<notifications@mail\.jktl\.com\.ng>$/,
  );
  assert.doesNotMatch(
    policy.businessInvoiceSender("Business\r\nFake"),
    /[\r\n]/,
  );
});
test("actual invoice, receipt and owner notice provider payloads identify the business and preserve Reply-To", async () => {
  const sent = [],
    previous = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = "synthetic-not-live";
  const escapeHtml = (v) =>
    String(v || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  const email = load("src/lib/email.ts", {
    "@/lib/invoicing/policy": policy,
    "@/lib/mail/addresses": addresses,
    "@/lib/mail/history": { recordMailAttempt: async () => {} },
    "@/lib/mail/provider-outcome": { uncertainProviderRejection: () => false },
    "@/lib/mail/invitation-date": {},
    "@/lib/mail/layout": {
      escapeHtml,
      mailAction: (url, label) => `<a href="${url}">${label}</a>`,
    },
    "@/lib/mail/service": {
      brandEmail: async (to, title, html, text) => ({
        permitted: true,
        html,
        text,
        delivery: {
          from: "JKTL Business <notifications@mail.jktl.com.ng>",
          replyTo: "info@jktl.com.ng",
        },
      }),
    },
    resend: {
      Resend: class {
        emails = {
          send: async (p) => {
            sent.push(p);
            return { data: { id: "fixture" }, error: null };
          },
        };
      },
    },
    "@/lib/format": {
      formatKobo: (n) => `NGN ${n / 100}`,
      formatShortDate: String,
      formatTime: String,
    },
  });
  try {
    const p = {
      to: "payer@example.test",
      customerName: "Customer",
      businessName: "Ada Designs",
      invoiceNumber: "INV-1",
      totalKobo: 100000,
    };
    assert.equal(
      (
        await email.sendInvoiceEmail({
          ...p,
          dueDate: "2026-11-30",
          lines: [{ description: "Design", quantity: 1, totalKobo: 100000 }],
          payUrl: "https://business.jktl.com.ng/pay/fixture",
        })
      ).ok,
      true,
    );
    assert.equal(
      (
        await email.sendPaymentReceiptEmail({
          ...p,
          paidAt: "2026-11-08T12:00:00Z",
          reference: "fixture",
        })
      ).ok,
      true,
    );
    assert.equal(
      (
        await email.sendBusinessInvoicePaidEmail({
          ...p,
          invoiceId: "fixture",
          online: true,
          reference: "fixture",
        })
      ).ok,
      true,
    );
    assert.equal((await email.sendPaymentReceiptEmail({...p,totalKobo:2000000,platformFeeKobo:10000,remainingKobo:5500000,paidAt:'2026-11-08T12:00:00Z',reference:'partial-fixture'})).ok,true);
    assert.match(sent[3].html,/Buyer total: NGN 20100/);
    assert.match(sent[3].text,/Outstanding invoice principal: NGN 55000/);
    assert.match(sent[3].text,/partial payment/);
    assert.doesNotMatch(sent[3].html,/The invoice is settled/);
    assert.equal(sent.length, 4);
    for (const p of sent) {
      assert.equal(
        p.from,
        '"Ada Designs via JKTL Business" <notifications@mail.jktl.com.ng>',
      );
      assert.equal(p.replyTo, "info@jktl.com.ng");
      assert.match(p.html, /Ada Designs|invoice/);
      assert.ok(p.text.length > 0);
    }
    assert.match(sent[2].text, /settlement schedule/);
  } finally {
    if (previous === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previous;
  }
});
test("bank gate is enforced on create and send, including direct action calls", async () => {
  let created = 0,
    sent = 0,
    ready = false;
  const a = load("src/lib/actions/invoice-actions.ts", {
    "@/lib/invoicing/access": {
      invoiceAccess: async () => ({ organizationId: org }),
    },
    "@/lib/invoicing/policy": policy,
    "@/lib/db/payments": {
      getPaymentSettings: async () => ({
        ...settings,
        subaccountCode: ready ? "ACCT_fixture" : "",
      }),
    },
    "@/lib/db/invoices": {
      createInvoice: async () => {
        created++;
        return { invoice: {}, items: [] };
      },
    },
    "@/lib/db/customers": {
      getCustomer: async () => ({ email: "fixture@example.test" }),
    },
    "@/lib/db/organizations": {},
    "@/lib/email": {
      sendInvoiceEmail: async () => {
        sent++;
      },
    },
    "@/lib/notify": {},
    "@/lib/invoice-finalize": {},
  });
  assert.equal(
    (await a.createInvoiceAction(input())).error,
    policy.BANK_REQUIRED,
  );
  assert.equal(
    (await a.sendInvoiceEmailAction("fixture")).error,
    policy.BANK_REQUIRED,
  );
  assert.equal(created, 0);
  assert.equal(sent, 0);
  ready = true;
  assert.equal((await a.createInvoiceAction(input())).ok, true);
  assert.equal(created, 1);
});
test("payment finalization awaits owner notice, customer receipt and PWA alerts", async () => {
  const events = [];
  const finalize = load("src/lib/invoice-finalize.ts", {
    "server-only": {},
    "@/lib/db/customers": {
      getCustomer: async () => ({
        name: "Customer",
        email: "customer@example.test",
      }),
    },
    "@/lib/db/organizations": {
      getBusinessProfile: async () => ({ displayName: "Ada Designs" }),
      getOwnerEmail: async () => "owner@example.test",
    },
    "@/lib/email": {
      sendPaymentReceiptEmail: async (p) => events.push(["receipt", p]),
      sendBusinessInvoicePaidEmail: async (p) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        events.push(["owner", p]);
      },
    },
    "@/lib/notify": {
      notifyInvoicePaid: async () => events.push(["invoice-alert"]),
      notifyPaymentReceived: async () => events.push(["payment-alert"]),
    },
  });
  const invoice = {
    id: "fixture",
    number: "INV-1",
    status: "paid",
    customerId: customer,
    totalKobo: 100000,
    paidVia: "online",
    paidAt: "2026-11-08T12:00:00Z",
  };
  await finalize.finalizeInvoicePaid(org, invoice, {
    reference: "fixture",
    method: "card",
  });
  assert.equal(events.length, 4);
  assert.equal(
    events.find((e) => e[0] === "owner")[1].to,
    "owner@example.test",
  );
  assert.equal(events.find((e) => e[0] === "owner")[1].online, true);
  assert.equal(
    events.find((e) => e[0] === "receipt")[1].to,
    "customer@example.test",
  );
});
test("sending a draft issues it before delivering its payable link", async () => {
  const steps = [];
  const a = load("src/lib/actions/invoice-actions.ts", {
    "@/lib/invoicing/access": {
      invoiceAccess: async () => ({ organizationId: org }),
    },
    "@/lib/invoicing/policy": policy,
    "@/lib/db/payments": { getPaymentSettings: async () => settings },
    "@/lib/db/invoices": {
      getInvoice: async () => ({
        id: "fixture",
        status: "draft",
        customerId: customer,
        number: "INV-1",
        totalKobo: 100000,
        dueDate: "2026-11-30",
      }),
      getInvoiceItems: async () => [],
      updateInvoiceStatus: async (_, id, status) => {
        steps.push(status);
        return {};
      },
    },
    "@/lib/db/customers": {
      getCustomer: async () => ({
        email: "fixture@example.test",
        name: "Fixture",
      }),
    },
    "@/lib/db/organizations": {
      getBusinessProfile: async () => ({ displayName: "Ada Designs" }),
    },
    "@/lib/email": {
      sendInvoiceEmail: async (p) => {
        steps.push("email");
        assert.match(p.payUrl, /\/pay\/fixture$/);
        return { ok: true };
      },
    },
    "@/lib/notify": { notifyInvoiceSent: async () => steps.push("notice") },
    "@/lib/invoice-finalize": {},
  });
  assert.equal((await a.sendInvoiceEmailAction("fixture")).ok, true);
  assert.deepEqual(steps, ["pending", "email", "notice"]);
});
