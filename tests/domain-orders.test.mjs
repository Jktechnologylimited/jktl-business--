import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import crypto from "node:crypto";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import * as model from "../src/lib/domains/model.ts";
import { can } from "../src/lib/admin-permissions.ts";
const require = createRequire(import.meta.url);
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
  const m = { exports: {} };
  new Function("require", "module", "exports", code)(
    (n) => {
      if (!(n in deps)) throw Error("Unexpected import " + n);
      return deps[n];
    },
    m,
    m.exports,
  );
  return m.exports;
}
const store = load("../src/lib/domains/store.ts", { "./model": model });
const orgA = "00000000-0000-4000-8000-000000000001",
  orgB = "00000000-0000-4000-8000-000000000002",
  userA = "00000000-0000-4000-8000-000000000003",
  adminId = "00000000-0000-4000-8000-000000000004";
const contact = {
  name: "Example Owner",
  email: "owner@example.test",
  phone: "+2348012345678",
  company: "Example",
  address: "1 Example Road",
  city: "Lagos",
  state: "Lagos",
  postalCode: "100001",
  country: "NG",
};
async function fixture() {
  const db = new PGlite();
  await db.exec(
    `CREATE TABLE organizations(id uuid PRIMARY KEY);CREATE TABLE admin_users(id uuid PRIMARY KEY);CREATE TABLE organization_members(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid,user_id uuid,role text,active boolean,email text);CREATE TABLE business_profiles(organization_id uuid PRIMARY KEY,display_name text,subdomain text,published boolean,custom_domain text DEFAULT '',custom_domain_token text DEFAULT '',custom_domain_verified boolean DEFAULT false);INSERT INTO organizations(id) VALUES('${orgA}'),('${orgB}');INSERT INTO admin_users(id) VALUES('${adminId}');INSERT INTO organization_members(organization_id,user_id,role,active,email) VALUES('${orgA}','${userA}','owner',true,'owner@example.test');INSERT INTO business_profiles(organization_id,display_name,subdomain,published) VALUES('${orgA}','Example Business','example',true),('${orgB}','Other Business','other',true);`,
  );
  await db.exec(
    readFileSync(
      new URL("../migrations/034_domain_orders.sql", import.meta.url),
      "utf8",
    ),
  );
  const q = async (sql, args) => (await db.query(sql, args)).rows;
  await q(
    `UPDATE domain_prices SET registration_price=500000,renewal_price=650000,enabled=true,max_years=5 WHERE extension='.com.ng'`,
    [],
  );
  let tx = 100;
  return {
    db,
    q,
    async available(domain, org = orgA) {
      return q(
        `INSERT INTO domain_checks(organization_id,domain,extension,status,source,checked_at,valid_until,price_revision) VALUES($1,$2,'.com.ng','AVAILABLE','manual',now(),now()+interval '10 minutes',1) ON CONFLICT(organization_id,domain) DO UPDATE SET status='AVAILABLE',price_revision=1,valid_until=now()+interval '10 minutes' RETURNING *`,
        [org, domain],
      );
    },
    async order(
      domain = "example.com.ng",
      org = orgA,
      kind = "REGISTER",
      assetId,
    ) {
      if (kind === "REGISTER") await this.available(domain, org);
      const id = crypto.randomUUID();
      return store.reserveOrder(q, {
        id,
        org,
        domain,
        extension: ".com.ng",
        kind,
        assetId,
        years: 1,
        priceRevision: 1,
        contact: "encrypted-placeholder",
        email: "owner@example.test",
        reference: "jktl_domain_" + id.replaceAll("-", ""),
      });
    },
    payment(o, changes = {}) {
      return {
        status: "success",
        currency: "NGN",
        reference: o.reference,
        id: String(++tx),
        amount: Number(o.amount_kobo),
        paid_at: new Date().toISOString(),
        customer: { email: "owner@example.test" },
        metadata: {
          type: "domain_order",
          orderId: o.id,
          organizationId: o.organization_id,
          domain: o.domain,
          years: o.years,
        },
        ...changes,
      };
    },
  };
}
test("domain labels, contact, prices and registry dates validate before money moves", () => {
  assert.equal(
    model.normalizeOrderDomain("My-Company.COM.NG", ".com.ng"),
    "my-company.com.ng",
  );
  for (const name of [
    "https://fake.com.ng",
    "a.b",
    "-bad",
    "x/y",
    "jktl.com.ng",
  ])
    assert.throws(() => model.normalizeOrderDomain(name, ".com.ng"));
  assert.deepEqual(model.parseRegistrant(contact), contact);
  assert.throws(() => model.parseRegistrant({ ...contact, email: "bad" }));
  assert.equal(model.orderTotal("500000", 2, 5), 1000000);
  for (const years of [0, 1.5, 11])
    assert.throws(() => model.orderTotal(100, years, 10));
  assert.throws(() => model.priceKobo(-1));
  assert.throws(() => model.parseNameservers("just-one.test"));
  assert.deepEqual(model.parseNameservers("NS1.EXAMPLE.COM, ns2.example.com"), [
    "ns1.example.com",
    "ns2.example.com",
  ]);
  assert.equal(
    model.expectedExpiry(new Date("2024-02-29T00:00:00Z"), 1).toISOString(),
    "2025-02-28T00:00:00.000Z",
  );
});
test("registrant contacts are authenticated ciphertext, not plaintext or reusable across keys", () => {
  const old = process.env.DOMAIN_CONTACT_ENCRYPTION_KEY;
  try {
    process.env.DOMAIN_CONTACT_ENCRYPTION_KEY = crypto
      .randomBytes(32)
      .toString("base64");
    const c = load("../src/lib/domains/contacts.ts", {
      "server-only": {},
      "node:crypto": crypto,
      "./model": model,
    });
    const encoded = c.encryptContact(contact);
    assert.ok(!encoded.includes(contact.email));
    assert.deepEqual(c.decryptContact(encoded), contact);
    const damaged = Buffer.from(encoded, "base64");
    damaged[30] ^= 1;
    assert.throws(() => c.decryptContact(damaged.toString("base64")));
    process.env.DOMAIN_CONTACT_ENCRYPTION_KEY = crypto
      .randomBytes(32)
      .toString("base64");
    assert.throws(() => c.decryptContact(encoded));
    delete process.env.DOMAIN_CONTACT_ENCRYPTION_KEY;
    assert.throws(() => c.encryptContact(contact), /not configured/);
  } finally {
    if (old === undefined) delete process.env.DOMAIN_CONTACT_ENCRYPTION_KEY;
    else process.env.DOMAIN_CONTACT_ENCRYPTION_KEY = old;
  }
});
test("database enforces order holds, verified charges, fulfillment, renewal and partial/full refunds", async (t) => {
  const f = await fixture();
  try {
    await t.test(
      "search freshness, tenant isolation and duplicate order protection",
      async () => {
        await assert.rejects(
          store.reserveOrder(f.q, {
            id: crypto.randomUUID(),
            org: orgA,
            domain: "not-checked.com.ng",
            extension: ".com.ng",
            kind: "REGISTER",
            years: 1,
            priceRevision: 1,
            contact: "x",
            email: contact.email,
            reference: "not-checked",
          }),
          /Availability/,
        );
        const order = await f.order();
        await assert.rejects(f.order(), (e) => e.code === "23505");
        await assert.rejects(
          f.order("example.com.ng", orgB),
          (e) => e.code === "23505",
        );
        assert.equal(
          Number((await f.q("SELECT count(*) n FROM domain_orders", []))[0].n),
          1,
        );
        await f.q(
          `UPDATE domain_checks SET valid_until=now()-interval '1 minute' WHERE domain='expired.com.ng'`,
          [],
        );
        await f.available("fresh.com.ng");
        await f.q(
          "UPDATE domain_prices SET revision=2 WHERE extension='.com.ng'",
          [],
        );
        await assert.rejects(
          store.reserveOrder(f.q, {
            id: crypto.randomUUID(),
            org: orgA,
            domain: "fresh.com.ng",
            extension: ".com.ng",
            kind: "REGISTER",
            years: 1,
            priceRevision: 2,
            contact: "x",
            email: contact.email,
            reference: "price-changed",
          }),
          /Availability/,
        );
        await f.q(
          "UPDATE domain_prices SET revision=1 WHERE extension='.com.ng'",
          [],
        );
        assert.equal(order.status, "PENDING_PAYMENT");
      },
    );
    let registration;
    await t.test(
      "payment verification rejects amount, currency, metadata and transaction reuse",
      async () => {
        registration = (
          await f.q(
            "SELECT * FROM domain_orders WHERE domain='example.com.ng'",
            [],
          )
        )[0];
        for (const change of [
          { amount: 1 },
          { currency: "USD" },
          { status: "failed" },
          { paid_at: null },
          { metadata: { type: "domain_order" } },
          { customer: { email: "someone@example.test" } },
          { id: { fake: true } },
        ])
          await assert.rejects(
            store.recordPayment(f.q, f.payment(registration, change)),
            /mismatch/,
          );
        const payment = f.payment(registration);
        await store.recordPayment(f.q, payment);
        assert.equal((await store.recordPayment(f.q, payment)).duplicate, true);
        assert.equal(
          Number(
            (await f.q("SELECT count(*) n FROM domain_payments", []))[0].n,
          ),
          1,
        );
        assert.equal(
          Number((await f.q("SELECT count(*) n FROM domain_assets", []))[0].n),
          0,
          "payment never buys a domain",
        );
        const other = await f.order("other.com.ng");
        await assert.rejects(
          store.recordPayment(f.q, f.payment(other, { id: payment.id })),
          (e) => e.code === "23505",
        );
        assert.equal(
          (
            await f.q("SELECT status FROM domain_orders WHERE id=$1", [
              other.id,
            ])
          )[0].status,
          "PENDING_PAYMENT",
        );
      },
    );
    let asset;
    await t.test(
      "manual fulfillment requires processing, matching revision and real registrar confirmation dates",
      async () => {
        let o = (
          await f.q("SELECT * FROM domain_orders WHERE id=$1", [
            registration.id,
          ])
        )[0];
        await assert.rejects(
          store.changeOrder(f.q, {
            id: o.id,
            admin: adminId,
            revision: Number(o.revision),
            status: "ACTIVE",
          }),
          /not allowed/,
        );
        await store.changeOrder(f.q, {
          id: o.id,
          admin: adminId,
          revision: Number(o.revision),
          status: "PROCESSING",
        });
        await assert.rejects(
          store.changeOrder(f.q, {
            id: o.id,
            admin: adminId,
            revision: Number(o.revision),
            status: "FAILED",
            reason: "Supplier could not register",
          }),
          /changed/,
        );
        o = (await f.q("SELECT * FROM domain_orders WHERE id=$1", [o.id]))[0];
        const start = new Date();
        start.setUTCHours(0, 0, 0, 0);
        const expiry = model.expectedExpiry(start, 1);
        await assert.rejects(
          store.changeOrder(f.q, {
            id: o.id,
            admin: adminId,
            revision: Number(o.revision),
            status: "ACTIVE",
            supplierReference: "paid-ref",
            registeredAt: start.toISOString(),
            expiresAt: "2099-01-01",
            nameservers: "ns1.example.com,ns2.example.com",
          }),
          /dates/,
        );
        await store.changeOrder(f.q, {
          id: o.id,
          admin: adminId,
          revision: Number(o.revision),
          status: "ACTIVE",
          supplierReference: "supplier-example-1",
          registeredAt: start.toISOString(),
          expiresAt: expiry.toISOString(),
          nameservers: "ns1.example.com,ns2.example.com",
        });
        asset = (
          await f.q("SELECT * FROM domain_assets WHERE domain=$1", [o.domain])
        )[0];
        assert.ok(asset);
        assert.equal(asset.organization_id, orgA);
        assert.equal(
          (await f.q("SELECT status FROM domain_orders WHERE id=$1", [o.id]))[0]
            .status,
          "ACTIVE",
        );
      },
    );
    await t.test(
      "renewal uses current renewal price and changes expiry only on registrar confirmation",
      async () => {
        const o = await f.order(asset.domain, orgA, "RENEW", asset.id);
        assert.equal(Number(o.amount_kobo), 650000);
        await assert.rejects(
          f.order(asset.domain, orgA, "RENEW", asset.id),
          (e) => e.code === "23505",
        );
        await assert.rejects(
          f.order(asset.domain, orgB, "RENEW", asset.id),
          /Availability/,
        );
        await store.recordPayment(f.q, f.payment(o));
        assert.equal(
          String(
            (
              await f.q("SELECT expires_at FROM domain_assets WHERE id=$1", [
                asset.id,
              ])
            )[0].expires_at,
          ),
          String(asset.expires_at),
        );
        let current = (
          await f.q("SELECT * FROM domain_orders WHERE id=$1", [o.id])
        )[0];
        await store.changeOrder(f.q, {
          id: o.id,
          admin: adminId,
          revision: Number(current.revision),
          status: "PROCESSING",
        });
        current = (
          await f.q("SELECT * FROM domain_orders WHERE id=$1", [o.id])
        )[0];
        await store.changeOrder(f.q, {
          id: o.id,
          admin: adminId,
          revision: Number(current.revision),
          status: "ACTIVE",
          supplierReference: "supplier-renewal-1",
          registeredAt: new Date().toISOString(),
          expiresAt: model
            .expectedExpiry(new Date(String(asset.expires_at)), 1)
            .toISOString(),
          nameservers: "ns1.example.com,ns2.example.com",
        });
        assert.ok(
          new Date(
            String(
              (
                await f.q("SELECT expires_at FROM domain_assets WHERE id=$1", [
                  asset.id,
                ])
              )[0].expires_at,
            ),
          ) > new Date(String(asset.expires_at)),
        );
      },
    );
    await t.test(
      "failed registration enters refund review, retries do not duplicate partial refunds",
      async () => {
        const o = await f.order("failed.com.ng");
        const payment = f.payment(o);
        await store.recordPayment(f.q, payment);
        let row = (
          await f.q("SELECT * FROM domain_orders WHERE id=$1", [o.id])
        )[0];
        await store.changeOrder(f.q, {
          id: o.id,
          admin: adminId,
          revision: Number(row.revision),
          status: "FAILED",
          reason: "Domain became unavailable at the supplier.",
        });
        row = (await f.q("SELECT * FROM domain_orders WHERE id=$1", [o.id]))[0];
        await store.changeOrder(f.q, {
          id: o.id,
          admin: adminId,
          revision: Number(row.revision),
          status: "REFUND_PENDING",
          reason: "Please refund the failed registration in full.",
        });
        const refund = {
          id: 2001,
          currency: "NGN",
          amount: 200000,
          transaction: { reference: o.reference, id: payment.id },
        };
        await store.recordRefund(f.q, refund);
        await store.recordRefund(f.q, refund);
        row = (await f.q("SELECT * FROM domain_orders WHERE id=$1", [o.id]))[0];
        assert.equal(row.status, "REFUND_PENDING");
        assert.equal(Number(row.refunded_kobo), 200000);
        await assert.rejects(
          store.recordRefund(f.q, { ...refund, id: 2002, amount: 500001 }),
          /mismatch/,
        );
        await store.recordRefund(f.q, { ...refund, id: 2003, amount: 300000 });
        row = (await f.q("SELECT * FROM domain_orders WHERE id=$1", [o.id]))[0];
        assert.equal(row.status, "REFUNDED");
        assert.equal(Number(row.refunded_kobo), 500000);
        assert.equal(
          (
            await f.q(
              "SELECT * FROM domain_assets WHERE domain='failed.com.ng'",
              [],
            )
          ).length,
          0,
        );
      },
    );
    await t.test(
      "a late successful payment after cancellation becomes refund-pending rather than fulfilled",
      async () => {
        const o = await f.order("cancelled.com.ng");
        await f.q("UPDATE domain_orders SET status='CANCELLED' WHERE id=$1", [
          o.id,
        ]);
        await store.recordPayment(f.q, f.payment(o));
        assert.equal(
          (await f.q("SELECT status FROM domain_orders WHERE id=$1", [o.id]))[0]
            .status,
          "REFUND_PENDING",
        );
      },
    );
    await t.test(
      "rate limits fail closed and owner/editor permissions stay distinct",
      async () => {
        await store.rateLimit(f.q, orgA, "test", 2, 60);
        await store.rateLimit(f.q, orgA, "test", 2, 60);
        await assert.rejects(
          store.rateLimit(f.q, orgA, "test", 2, 60),
          /Too many/,
        );
        assert.equal(can("owner", "manage_domains"), true);
        for (const r of ["editor", "analyst", "affiliate_manager"])
          assert.equal(can(r, "manage_domains"), false);
      },
    );
  } finally {
    await f.db.close();
  }
});
test("availability, checkout, webhook retries, admin tasks and website connection use real tenant-scoped queries", async (t) => {
  const f = await fixture();
  const oldKey = process.env.DOMAIN_CONTACT_ENCRYPTION_KEY,
    oldUrl = process.env.DOMAIN_AVAILABILITY_URL,
    oldApiKey = process.env.DOMAIN_AVAILABILITY_API_KEY,
    oldCname = process.env.DOMAIN_WEBSITE_CNAME,
    oldFetch = globalThis.fetch;
  let session = { userId: userA, organizationId: orgA },
    role = "owner",
    verifications = 0,
    initializations = 0,
    verifyResponse = null,
    providerError = false,
    txt = [],
    cname = [],
    websiteEligible = true;
  const after = () => {};
  try {
    process.env.DOMAIN_CONTACT_ENCRYPTION_KEY = crypto
      .randomBytes(32)
      .toString("base64");
    delete process.env.DOMAIN_AVAILABILITY_URL;
    delete process.env.DOMAIN_AVAILABILITY_API_KEY;
    const sql = async (parts, ...values) =>
      f.q(
        parts.reduce(
          (s, p, i) => s + p + (i < values.length ? "$" + (i + 1) : ""),
          "",
        ),
        values,
      );
    sql.query = f.q;
    const provider = {
      initializeDomainPayment: async (p) => {
        initializations++;
        return {
          authorizationUrl: "https://checkout.paystack.com/test-only",
          reference: p.reference,
          accessCode: "test",
        };
      },
      verifyTransaction: async () => {
        verifications++;
        if (providerError) throw Error("Temporary test provider failure");
        return verifyResponse;
      },
      getDomainRefund: async () => null,
    };
    const service = load("../src/lib/domains/service.ts", {
      "server-only": {},
      "node:crypto": crypto,
      "@/lib/db/client": { getSql: () => sql },
      "@/lib/session": {
        requireSession: async () => {
          if (!session) throw Error("Not signed in.");
          return session;
        },
      },
      "@/lib/db/organizations": {
        getUser: async () => ({ email: contact.email }),
      },
      "@/lib/paystack": provider,
      "./model": model,
      "./store": store,
    });
    const contacts = load("../src/lib/domains/contacts.ts", {
      "server-only": {},
      "node:crypto": crypto,
      "./model": model,
    });
    const startCustom = async (domain) => {
      if (!websiteEligible)
        return {
          ok: false,
          error: "Upgrade your website plan before adding a custom domain.",
        };
      await f.q(
        `UPDATE business_profiles SET custom_domain=$2,custom_domain_token='test-ownership-token',custom_domain_verified=false WHERE organization_id=$1`,
        [session.organizationId, domain],
      );
      return {
        ok: true,
        data: {
          recordName: "_jktl-verify." + domain,
          recordValue: "jktl-domain-verify=test-ownership-token",
        },
      };
    };
    const actions = load("../src/lib/actions/domain-order-actions.ts", {
      "next/server": { after },
      "node:dns/promises": {
        resolveTxt: async () => txt,
        resolveCname: async () => cname,
        resolve4: async () => [],
      },
      "@/lib/admin-session": {
        requireAdminCapability: async (cap) => {
          if (!can(role, cap)) throw Error("Your role cannot manage domains.");
          return { id: adminId };
        },
      },
      "@/lib/business-email/service":{handleEmailEvent:async()=>false},
"@/lib/custom/service": { handleCustomEvent: async () => false },
      "@/lib/domains/service": service,
      "@/lib/domains/contacts": contacts,
      "@/lib/domains/model": model,
      "@/lib/domains/store": store,
      "@/lib/paystack": provider,
      "@/lib/actions/domain-actions": {
        startCustomDomainVerificationAction: startCustom,
      },
      "@/lib/domains/notifications": {
        flushDomainNotifications: async () => ({ sent: 0, failed: 0 }),
      },
    });
    await t.test(
      "unconfigured searches queue a manual check and never infer availability from DNS",
      async () => {
        const result = await actions.searchDomainsAction("manual", ".com.ng");
        assert.equal(result.ok, true);
        assert.equal(result.data.check.status, "UNKNOWN");
        assert.equal(
          (
            await actions.createDomainOrderAction({
              domain: "manual.com.ng",
              extension: ".com.ng",
              kind: "REGISTER",
              years: 1,
              priceRevision: 1,
              registrant: contact,
              consent: true,
              termsVersion: model.DOMAIN_TERMS,
            })
          ).ok,
          false,
        );
        assert.equal(initializations, 0);
        assert.equal(
          (
            await actions.confirmDomainAvailabilityAction(
              result.data.check.id,
              true,
            )
          ).ok,
          true,
        );
      },
    );
    await t.test(
      "configured lookup provider checks exact domain, premium status and current price without leaking its key",
      async () => {
        process.env.DOMAIN_AVAILABILITY_URL =
          "https://availability.example.test/check";
        process.env.DOMAIN_AVAILABILITY_API_KEY = "test-only-key";
        let data;
        globalThis.fetch = async (url, options) => {
          assert.equal(new URL(url).searchParams.get("domain"), data.domain);
          assert.equal(options.headers.Authorization, "Bearer test-only-key");
          return Response.json(data);
        };
        for (const [name, available, premium, expected] of [
          ["normal", true, false, "AVAILABLE"],
          ["premium", true, true, "UNKNOWN"],
          ["taken", false, false, "UNAVAILABLE"],
        ]) {
          data = {
            domain: name + ".com.ng",
            available,
            premium,
            currency: "NGN",
          };
          const r = await actions.searchDomainsAction(name, ".com.ng");
          assert.equal(r.ok, true);
          assert.equal(r.data.check.status, expected);
        }
        globalThis.fetch = async () => {
          throw Error("test outage");
        };
        assert.equal(
          (await actions.searchDomainsAction("outage", ".com.ng")).data.check
            .status,
          "UNKNOWN",
        );
        delete process.env.DOMAIN_AVAILABILITY_URL;
        delete process.env.DOMAIN_AVAILABILITY_API_KEY;
      },
    );
    let order;
    await t.test(
      "one-off checkout snapshots prices, encrypts contact and refuses a duplicate charge",
      async () => {
        const r = await actions.createDomainOrderAction({
          domain: "manual.com.ng",
          extension: ".com.ng",
          kind: "REGISTER",
          years: 1,
          priceRevision: 1,
          registrant: contact,
          consent: true,
          termsVersion: model.DOMAIN_TERMS,
        });
        assert.equal(r.ok, true);
        assert.equal(initializations, 1);
        order = (
          await f.q("SELECT * FROM domain_orders WHERE id=$1", [r.data.id])
        )[0];
        assert.equal(Number(order.amount_kobo), 500000);
        assert.ok(!order.contact_ciphertext.includes(contact.address));
        assert.deepEqual(
          contacts.decryptContact(order.contact_ciphertext),
          contact,
        );
        const duplicate = await actions.createDomainOrderAction({
          domain: "manual.com.ng",
          extension: ".com.ng",
          kind: "REGISTER",
          years: 1,
          priceRevision: 1,
          registrant: contact,
          consent: true,
          termsVersion: model.DOMAIN_TERMS,
        });
        assert.equal(duplicate.ok, false);
        assert.equal(initializations, 1);
        const admin = await actions.adminDomainsAction();
        assert.equal(
          admin.data.orders[0].registrant,
          null,
          "unpaid registrant details are not exposed",
        );
        const customer = await actions.customerDomainsAction();
        assert.equal(
          JSON.stringify(customer).includes("contact_ciphertext"),
          false,
        );
        assert.equal(JSON.stringify(customer).includes(contact.address), false);
      },
    );
    await t.test(
      "domain charge webhooks retry before ledger commit and never enter the subscription handler",
      async () => {
        let legacy = 0;
        const next = {
          NextResponse: { json: (b, o) => Response.json(b, o) },
          after,
        };
        const route = load("../src/app/api/webhooks/paystack/route.ts", {
          "next/server": next,
          "@/lib/business-email/service":{handleEmailEvent:async()=>false},
"@/lib/custom/service": { handleCustomEvent: async () => false },
          "@/lib/domains/service": service,
          "@/lib/website-billing-webhooks": {
            handleWebsiteBillingEvent: async () => {
              legacy++;
              return false;
            },
          },
          "@/lib/db/organizations": {},
          "@/lib/paystack": {
            verifyWebhookSignature: (_raw, sig) => sig === "valid",
          },
          "@/lib/db/billing": {
            recordWebhookEventOnce: async () => {
              legacy++;
              return true;
            },
          },
          "@/lib/db/invoices": {},
          "@/lib/ai/billing-fulfilment": {},
          "@/lib/invoice-finalize": {},
          "@/lib/db/affiliates": {},
          "@/lib/db/storage-overage": {},
          "@/lib/billing": {},
        });
        verifyResponse = f.payment(order);
        const req = (sig = "valid") =>
          new Request("https://business.jktl.com.ng/api/webhooks/paystack", {
            method: "POST",
            headers: { "x-paystack-signature": sig },
            body: JSON.stringify({
              event: "charge.success",
              data: {
                reference: order.reference,
                metadata: verifyResponse.metadata,
              },
            }),
          });
        assert.equal((await route.POST(req("invalid"))).status, 401);
        providerError = true;
        assert.equal((await route.POST(req())).status, 503);
        assert.equal(
          (await f.q("SELECT * FROM domain_payments", [])).length,
          0,
        );
        providerError = false;
        assert.equal((await route.POST(req())).status, 200);
        const count = verifications;
        assert.equal((await route.POST(req())).status, 200);
        assert.equal(
          verifications,
          count,
          "verified duplicate uses the committed ledger",
        );
        assert.equal(legacy, 0);
        assert.equal(
          (await f.q("SELECT * FROM domain_payments", [])).length,
          1,
        );
        const admin = await actions.adminDomainsAction();
        assert.deepEqual(admin.data.orders[0].registrant, contact);
      },
    );
    await t.test(
      "customer and admin boundaries protect order/contact access",
      async () => {
        role = "editor";
        assert.equal((await actions.adminDomainsAction()).ok, false);
        role = "owner";
        await f.q(
          "UPDATE organization_members SET role='manager' WHERE user_id=$1",
          [userA],
        );
        assert.equal((await actions.customerDomainsAction()).ok, false);
        await f.q(
          "UPDATE organization_members SET role='owner' WHERE user_id=$1",
          [userA],
        );
        await f.q(
          `INSERT INTO organization_members(organization_id,user_id,role,active,email) VALUES($1,$2,'owner',true,'other@example.test')`,
          [orgB, orgB],
        );
        session = { userId: orgB, organizationId: orgB };
        const before = verifications;
        assert.equal(
          (await actions.verifyDomainPaymentAction(order.reference)).ok,
          false,
        );
        assert.equal(verifications, before);
        assert.equal(
          (
            await actions.requestOrderSupportAction(
              order.id,
              "Show me another tenant order",
            )
          ).ok,
          false,
        );
        session = { userId: userA, organizationId: orgA };
      },
    );
    await t.test(
      "connection stays pending until TXT, DNS target and manual hosting confirmation all agree",
      async () => {
        let o = (
          await f.q("SELECT * FROM domain_orders WHERE id=$1", [order.id])
        )[0];
        await store.changeOrder(f.q, {
          id: o.id,
          admin: adminId,
          revision: Number(o.revision),
          status: "PROCESSING",
        });
        o = (await f.q("SELECT * FROM domain_orders WHERE id=$1", [o.id]))[0];
        const start = new Date();
        start.setUTCHours(0, 0, 0, 0);
        await store.changeOrder(f.q, {
          id: o.id,
          admin: adminId,
          revision: Number(o.revision),
          status: "ACTIVE",
          supplierReference: "test-supplier-connection",
          registeredAt: start.toISOString(),
          expiresAt: model.expectedExpiry(start, 1).toISOString(),
          nameservers: "ns1.example.test,ns2.example.test",
        });
        const asset = (
          await f.q("SELECT * FROM domain_assets WHERE domain=$1", [
            order.domain,
          ])
        )[0];
        await f.q(
          "ALTER TABLE business_profiles ADD COLUMN website_template_id text DEFAULT 'law-firm'",
          [],
        );
        websiteEligible = false;
        assert.equal(
          (await actions.requestDomainConnectionAction(asset.id)).ok,
          false,
        );
        websiteEligible = true;
        assert.equal(
          (await actions.requestDomainConnectionAction(asset.id)).ok,
          true,
        );
        assert.equal(
          (await actions.verifyPurchasedDomainConnectionAction(asset.id)).ok,
          false,
        );
        txt = [["jktl-domain-verify=test-ownership-token"]];
        process.env.DOMAIN_WEBSITE_CNAME = "host.example.test";
        cname = ["wrong.example.test"];
        assert.equal(
          (await actions.verifyPurchasedDomainConnectionAction(asset.id)).ok,
          false,
        );
        cname = ["host.example.test"];
        let r = await actions.verifyPurchasedDomainConnectionAction(asset.id);
        assert.equal(r.ok, true);
        assert.equal(r.data.status, "DNS_VERIFIED");
        assert.equal(
          (
            await f.q(
              "SELECT custom_domain_verified FROM business_profiles WHERE organization_id=$1",
              [orgA],
            )
          )[0].custom_domain_verified,
          false,
        );
        const task = (
          await f.q("SELECT * FROM domain_tasks WHERE kind='CONNECT'", [])
        )[0];
        assert.equal(
          (
            await actions.completeDomainTaskAction(
              task.id,
              "COMPLETED",
              "Hosting and SSL checked manually",
              "hosting-project/domain-reference",
            )
          ).ok,
          true,
        );
        r = await actions.verifyPurchasedDomainConnectionAction(asset.id);
        assert.equal(r.ok, true);
        assert.equal(r.data.status, "CONNECTED");
        const profile = (
          await f.q(
            "SELECT * FROM business_profiles WHERE organization_id=$1",
            [orgA],
          )
        )[0];
        assert.equal(profile.custom_domain_verified, true);
        assert.equal(profile.website_template_id, "law-firm");
        assert.equal(
          (
            await actions.requestDomainTaskAction(
              asset.id,
              "NAMESERVERS",
              "Change to the two confirmed new nameservers.",
            )
          ).ok,
          true,
        );
        const nsTask = (
          await f.q("SELECT * FROM domain_tasks WHERE kind='NAMESERVERS'", [])
        )[0];
        assert.equal(
          (
            await actions.completeDomainTaskAction(
              nsTask.id,
              "COMPLETED",
              "Supplier confirmed the new nameservers.",
              undefined,
              "ns1.new.example,ns2.new.example",
            )
          ).ok,
          true,
        );
        assert.deepEqual(
          (
            await f.q("SELECT nameservers FROM domain_assets WHERE id=$1", [
              asset.id,
            ])
          )[0].nameservers,
          ["ns1.new.example", "ns2.new.example"],
        );
      },
    );
    await t.test(
      "admin price edits are revision-safe and public data excludes supplier costs",
      async () => {
        const prices = await service.publicPrices();
        assert.equal(prices[0].supplier, undefined);
        assert.equal(prices[0].registration_cost, undefined);
        const p = {
          extension: ".com.ng",
          supplier: "GO54",
          registrationCost: 300000,
          registrationPrice: 550000,
          renewalCost: 400000,
          renewalPrice: 700000,
          transferPrice: null,
          enabled: true,
          maxYears: 5,
          requirements: "Registry rules apply",
          revision: 1,
        };
        assert.equal((await actions.saveDomainPriceAction(p)).ok, true);
        assert.equal((await actions.saveDomainPriceAction(p)).ok, false);
        assert.equal(
          Number(
            (
              await f.q(
                "SELECT registration_price FROM domain_prices WHERE extension='.com.ng'",
                [],
              )
            )[0].registration_price,
          ),
          550000,
        );
      },
    );
  } finally {
    globalThis.fetch = oldFetch;
    for (const [k, v] of Object.entries({
      DOMAIN_CONTACT_ENCRYPTION_KEY: oldKey,
      DOMAIN_AVAILABILITY_URL: oldUrl,
      DOMAIN_AVAILABILITY_API_KEY: oldApiKey,
      DOMAIN_WEBSITE_CNAME: oldCname,
    })) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await f.db.close();
  }
});

test("renewal reminders use 30/14/7/1 day dates and durable idempotent notice retries", async () => {
  const f = await fixture();
  try {
    for (const days of [30, 14, 7, 1, 2])
      await f.q(
        `INSERT INTO domain_assets(organization_id,domain,extension,registered_at,expires_at,supplier_reference) VALUES($1,$2,'.com.ng',now()-interval '1 year',now()+($3::int*interval '1 day'),'test-supplier')`,
        [orgA, `reminder${days}.com.ng`, days],
      );
    const sql = Object.assign(
      (s, ...v) =>
        f.q(
          s.reduce((a, p, i) => a + (i ? "$" + i : "") + p, ""),
          v,
        ),
      { query: f.q },
    );
    let success = false,
      sends = [];
    const n = load("../src/lib/domains/notifications.ts", {
      "server-only": {},
      "@/lib/db/client": { getSql: () => sql },
      "@/lib/email": {
        sendDomainOrderEmail: async (p) => {
          sends.push(p);
          return { ok: success };
        },
      },
      "@/lib/db/push": {
        getNotificationPrefs: async () => ({ pushEnabled: false }),
      },
      "@/lib/push": {
        sendPush: async () => {
          throw Error("Unexpected push");
        },
      },
    });
    assert.equal(await n.enqueueDomainReminders(), 4);
    assert.equal(await n.enqueueDomainReminders(), 0);
    assert.deepEqual(await n.flushDomainNotifications(10), {
      sent: 0,
      failed: 4,
    });
    assert.deepEqual(await n.flushDomainNotifications(10), {
      sent: 0,
      failed: 0,
    });
    await f.q(
      "UPDATE domain_outbox SET lease_until=now()-interval '1 second'",
      [],
    );
    success = true;
    assert.deepEqual(await n.flushDomainNotifications(10), {
      sent: 4,
      failed: 0,
    });
    assert.deepEqual(await n.flushDomainNotifications(10), {
      sent: 0,
      failed: 0,
    });
    assert.equal(new Set(sends.map((p) => p.key)).size, 4);
    assert.equal(
      sends.every((p) => p.to === "owner@example.test"),
      true,
    );
  } finally {
    await f.db.close();
  }
});
test("one-off domain checkout payload has no recurring plan; real HMAC verification rejects tampering", async () => {
  const oldKey = process.env.PAYSTACK_SECRET_KEY,
    oldFetch = globalThis.fetch;
  process.env.PAYSTACK_SECRET_KEY = "sk_test_not_a_real_key";
  try {
    const pay = load("../src/lib/paystack.ts", {
      "server-only": {},
      "node:crypto": crypto,
    });
    globalThis.fetch = async (u, init) => {
      assert.equal(u, "https://api.paystack.co/transaction/initialize");
      const p = JSON.parse(init.body);
      assert.equal(p.currency, "NGN");
      assert.equal(p.amount, 500000);
      assert.equal(p.reference, "jktl_domain_example");
      assert.equal(p.plan, undefined);
      assert.equal(p.authorization_code, undefined);
      return Response.json({
        status: true,
        data: {
          authorization_url: "https://checkout.paystack.com/test",
          reference: p.reference,
          access_code: "test",
        },
      });
    };
    await pay.initializeDomainPayment({
      email: "owner@example.test",
      amountKobo: 500000,
      reference: "jktl_domain_example",
      callbackUrl: "https://business.jktl.com.ng/business/domains",
      metadata: { type: "domain_order" },
    });
    const body = JSON.stringify({ event: "charge.success" }),
      sig = crypto
        .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
        .update(body)
        .digest("hex");
    assert.equal(pay.verifyWebhookSignature(body, sig), true);
    assert.equal(pay.verifyWebhookSignature(body + " ", sig), false);
    assert.equal(pay.verifyWebhookSignature(body, "bad"), false);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = oldKey;
  }
});
