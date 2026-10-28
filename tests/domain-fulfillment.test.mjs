// All registrar results below are synthetic INTERNAL fixtures, NOT official
// GO54 response schemas. No network or paid registrar operations are executed.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import crypto from "node:crypto";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import * as model from "../src/lib/domains/model.ts";
import { can } from "../src/lib/admin-permissions.ts";
process.env.NODE_ENV = "test";
function load(file, deps) {
  const m = { exports: {} };
  const code = ts.transpileModule(
    readFileSync(new URL(file, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  new Function("require", "module", "exports", code)(
    (n) => {
      if (!(n in deps)) throw Error("Unexpected " + n);
      return deps[n];
    },
    m,
    m.exports,
  );
  return m.exports;
}
const store = load("../src/lib/domains/store.ts", { "./model": model });
const ledger = load("../src/lib/domains/registrar-operations.ts", {
  "server-only": {},
  "node:crypto": crypto,
  "./model": model,
  "./store": store,
});
const fulfillment = load("../src/lib/domains/fulfillment.ts", {
  "server-only": {},
  "./go54": { GO54_WRITES_IMPLEMENTED: false },
  "./registrar-operations": ledger,
});
const org = crypto.randomUUID(),
  other = crypto.randomUUID(),
  admin = crypto.randomUUID(),
  partner = crypto.randomUUID();
const migration = readFileSync(
  new URL("../migrations/059_domain_fulfillment.sql", import.meta.url),
  "utf8",
);
async function fixture() {
  const db = new PGlite();
  await db.exec(`CREATE TABLE organizations(id uuid PRIMARY KEY);CREATE TABLE admin_users(id uuid PRIMARY KEY,role text,name text,email text,disabled_at timestamptz);INSERT INTO organizations VALUES('${org}'),('${other}');INSERT INTO admin_users VALUES('${admin}','owner','Owner','owner@example.test',NULL);
 CREATE TABLE affiliates(id uuid PRIMARY KEY,programme text,status text,partner_terms_confirmed boolean);CREATE TABLE partner_client_access(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),partner_id uuid,organization_id uuid,revoked_at timestamptz,scopes text[]);CREATE TABLE feature_registry(slug text PRIMARY KEY,partner_mode text,partner_actions text[]);`);
  for (const f of [
    "034_domain_orders.sql",
    "056_domain_discovery.sql",
    "057_registrar_operations.sql",
    "058_go54_diagnostics.sql",
  ])
    await db.exec(
      readFileSync(new URL("../migrations/" + f, import.meta.url), "utf8"),
    );
  await db.exec(migration);
  const q = async (sql, params = []) => (await db.query(sql, params)).rows;
  await q(
    "UPDATE domain_prices SET enabled=true,registration_price=500000,registration_cost=300000,renewal_price=600000,renewal_cost=400000,max_years=5 WHERE extension='.com.ng'",
  );
  async function order(domain = "example.com.ng", options = {}) {
    await q(
      "INSERT INTO domain_checks(organization_id,domain,extension,status,source,price_revision,checked_at,valid_until) VALUES($1,$2,'.com.ng','AVAILABLE','manual',1,now(),now()+interval '10 minutes') ON CONFLICT DO NOTHING",
      [org, domain],
    );
    const id = crypto.randomUUID(),
      reference = "jktl_domain_" + id.replaceAll("-", "");
    const row = await store.reserveOrder(q, {
      id,
      org,
      domain,
      extension: ".com.ng",
      kind: "REGISTER",
      years: 1,
      priceRevision: 1,
      contact: "encrypted-fixture",
      email: "customer@example.test",
      reference,
      ...options,
    });
    return row;
  }
  let tx = 1000;
  const payment = (row) => ({
    reference: row.reference,
    id: String(++tx),
    amount: Number(row.amount_kobo),
    status: "success",
    currency: "NGN",
    paid_at: new Date().toISOString(),
    customer: { email: "customer@example.test" },
    metadata: {
      type: "domain_order",
      orderId: row.id,
      organizationId: org,
      domain: row.domain,
      years: Number(row.years),
    },
  });
  const paid = async () => {
    const row = await order();
    await store.recordPayment(q, payment(row));
    return row;
  };
  const automatic = async () => {
    await q(
      "UPDATE domain_purchase_controls SET purchases_enabled=true,automation_enabled=true,readonly_verified_at=now(),e2e_verified_at=now(),default_fulfillment_mode='AUTOMATIC'",
    );
    await q(
      "UPDATE domain_prices SET manual_only=false WHERE extension='.com.ng'",
    );
  };
  const current = async (id) =>
    (await q("SELECT * FROM domain_orders WHERE id=$1", [id]))[0];
  const adapter = (
    row,
    send = async () => ({
      kind: "CONFIRMED",
      confirmation: {
        domain: row.domain,
        transactionReference: "synthetic-transaction-123",
        registeredAt: new Date().toISOString(),
        expiresAt: model.expectedExpiry(new Date(), 1).toISOString(),
        nameservers: ["ns1.example.test", "ns2.example.test"],
        accountVerified: true,
      },
    }),
  ) => ({
    preflight: async () => ({
      costKobo: 300000,
      request: { testFixture: true },
      proof: {
        domain: row.domain,
        kind: "REGISTER",
        years: 1,
        eligibilityVerified: true,
        availability: "AVAILABLE",
        checkedAt: new Date(),
        wallet: {
          source: "API",
          currency: "NGN",
          balanceKobo: 1000000,
          checkedAt: new Date(),
        },
      },
    }),
    register: send,
  });
  return { db, q, order, paid, payment, automatic, current, adapter };
}
test("IDNA normalization and honest discovery/progress vocabulary", () => {
  assert.equal(
    model.normalizeOrderDomain("café.com.ng", ".com.ng"),
    "xn--caf-dma.com.ng",
  );
  for (const name of [
    "https://example.com.ng",
    "a/b",
    "user@host",
    "example.com.ng:443",
    "%65xample",
  ])
    assert.throws(() => model.normalizeOrderDomain(name, ".com.ng"));
  assert.equal(
    model.domainAvailabilityStatus({
      status: "UNKNOWN",
      registryStatus: "NOT_FOUND",
    }),
    "APPEARS_AVAILABLE",
  );
  assert.equal(
    model.domainAvailabilityStatus({ status: "UNAVAILABLE" }),
    "REGISTERED",
  );
  assert.equal(
    model.domainAvailabilityStatus({ status: "UNKNOWN" }),
    "UNKNOWN",
  );
  assert.equal(
    model.domainAvailabilityStatus({ status: "UNKNOWN" }, false),
    "UNSUPPORTED",
  );
  assert.match(
    model.domainProgress({
      status: "PROCESSING",
      fulfillment_stage: "RECONCILIATION_REQUIRED",
    }),
    /no second payment/,
  );
  assert.equal(
    model.domainProgress({
      status: "REFUNDED",
      fulfillment_stage: "REGISTERING",
    }),
    "Refund confirmed",
  );
});
test("verified payment routes once to the same manual order, unpaid and repeated webhooks cannot buy", async () => {
  const f = await fixture();
  try {
    const row = await f.order();
    await fulfillment.dispatchDomainOrder(f.q, String(row.id));
    assert.equal((await f.current(row.id)).status, "PENDING_PAYMENT");
    const data = f.payment(row);
    await store.recordPayment(f.q, data);
    await fulfillment.dispatchDomainOrder(f.q, String(row.id));
    await store.recordPayment(f.q, data);
    await fulfillment.dispatchDomainOrder(f.q, String(row.id));
    assert.equal((await f.current(row.id)).fulfillment_stage, "MANUAL_REVIEW");
    assert.equal(
      (await f.current(row.id)).fallback_reason,
      "AUTOMATION_DISABLED",
    );
    assert.equal((await f.q("SELECT * FROM domain_payments")).length, 1);
    assert.equal((await f.q("SELECT * FROM domain_orders")).length, 1);
    assert.equal(
      (await f.q("SELECT * FROM domain_registrar_operations")).length,
      0,
    );
    assert.equal(
      (
        await f.q(
          "SELECT * FROM domain_outbox WHERE event_key LIKE '%:fulfillment-review'",
        )
      ).length,
      1,
    );
    await f.db.exec(migration);
    assert.equal((await f.current(row.id)).status, "PAID");
    assert.equal((await f.current(row.id)).amount_kobo, 500000);
  } finally {
    await f.db.close();
  }
});
test("mock automatic workflow serializes concurrent workers and activates only after confirmed response", async () => {
  const f = await fixture();
  try {
    const row = await f.paid();
    await f.automatic();
    let submits = 0;
    const base = f.adapter(row);
    const adapter = {
      ...base,
      register: async (request) => {
        submits++;
        assert.equal(request.testFixture, true);
        return base.register(request);
      },
    };
    await Promise.all([
      fulfillment.dispatchDomainOrderMock(f.q, row.id, adapter),
      fulfillment.dispatchDomainOrderMock(f.q, row.id, adapter),
    ]);
    assert.equal(submits, 1);
    assert.equal((await f.current(row.id)).status, "ACTIVE");
    const assets = await f.q("SELECT * FROM domain_assets");
    assert.equal(assets.length, 1);
    assert.equal(assets[0].organization_id, org);
    assert.equal(
      (await f.q("SELECT * FROM domain_registrar_operations"))[0].state,
      "CONFIRMED",
    );
  } finally {
    await f.db.close();
  }
});
test("wallet and availability preflight failures route safely without a registrar request", async () => {
  for (const reason of [
    "INSUFFICIENT_WALLET",
    "CONTACT_REQUIRED",
    "AVAILABILITY_UNCONFIRMED",
  ]) {
    const f = await fixture();
    try {
      const row = await f.paid();
      await f.automatic();
      let sent = 0;
      await fulfillment.dispatchDomainOrderMock(f.q, row.id, {
        preflight: async () => ({ manual: reason }),
        register: async () => {
          sent++;
          throw Error();
        },
      });
      assert.equal(sent, 0);
      assert.equal((await f.current(row.id)).fallback_reason, reason);
      assert.equal(
        (await f.current(row.id)).fulfillment_stage,
        "MANUAL_REVIEW",
      );
      assert.equal((await f.q("SELECT * FROM domain_assets")).length, 0);
    } finally {
      await f.db.close();
    }
  }
});
test("timeouts and ambiguous results require account reconciliation, block manual completion and never repeat spending", async () => {
  for (const response of ["timeout", "unknown"]) {
    const f = await fixture();
    try {
      const row = await f.paid();
      await f.automatic();
      let sent = 0;
      const adapter = f.adapter(row, async () => {
        sent++;
        if (response === "timeout") throw Error("synthetic timeout");
        return { kind: "UNKNOWN" };
      });
      await fulfillment.dispatchDomainOrderMock(f.q, row.id, adapter);
      await fulfillment.dispatchDomainOrderMock(f.q, row.id, adapter);
      assert.equal(sent, 1);
      assert.equal(
        (await f.current(row.id)).fulfillment_stage,
        "RECONCILIATION_REQUIRED",
      );
      const pending = await f.current(row.id);
      await assert.rejects(
        store.changeOrder(f.q, {
          id: row.id,
          admin,
          revision: Number(pending.revision),
          status: "FAILED",
          reason: "Synthetic failure",
        }),
        /reconciliation/,
      );
      await assert.rejects(
        store.changeOrder(f.q, {
          id: row.id,
          admin,
          revision: Number(pending.revision),
          status: "ACTIVE",
          supplierReference: "another-reference",
          registeredAt: new Date().toISOString(),
          expiresAt: model.expectedExpiry(new Date(), 1).toISOString(),
          nameservers: "ns1.example.test ns2.example.test",
        }),
        /reconciliation/,
      );
      assert.equal((await f.q("SELECT * FROM domain_assets")).length, 0);
      const op = (await f.q("SELECT * FROM domain_registrar_operations"))[0];
      await assert.rejects(
        ledger.confirmRegistrarNotApplied(f.q, op.id, {
          domain: row.domain,
          checkedAt: new Date(),
          accountVerified: true,
          definitelyNotApplied: true,
          pending: true,
        }),
      );
      await ledger.confirmRegistrarNotApplied(f.q, op.id, {
        domain: row.domain,
        checkedAt: new Date(),
        accountVerified: true,
        definitelyNotApplied: true,
        pending: false,
      });
      await fulfillment.routeManual(f.q, row.id, "PROVIDER_RECOVERABLE", admin);
      assert.equal(
        (await f.current(row.id)).fulfillment_stage,
        "MANUAL_REVIEW",
      );
      assert.equal(
        (
          await f.q("SELECT inflight_operation_id FROM domain_registrar_state")
        )[0].inflight_operation_id,
        null,
      );
    } finally {
      await f.db.close();
    }
  }
});
test("confirmed registrar operation survives local failure; recovery finalizes locally without another purchase", async () => {
  const f = await fixture();
  try {
    const row = await f.paid();
    await f.automatic();
    let sent = 0;
    const base = f.adapter(row);
    const adapter = {
      ...base,
      register: async (r) => {
        sent++;
        return base.register(r);
      },
    };
    let fail = true;
    const flaky = async (sql, args) => {
      if (fail && sql.includes("asset AS(INSERT INTO domain_assets")) {
        fail = false;
        throw Error("synthetic local failure");
      }
      return f.q(sql, args);
    };
    await fulfillment.dispatchDomainOrderMock(flaky, row.id, adapter);
    assert.equal(
      (await f.q("SELECT * FROM domain_registrar_operations"))[0].state,
      "CONFIRMED",
    );
    assert.notEqual((await f.current(row.id)).status, "ACTIVE");
    await fulfillment.dispatchDomainOrder(f.q, row.id);
    assert.equal(sent, 1);
    assert.equal((await f.current(row.id)).status, "ACTIVE");
    assert.equal((await f.q("SELECT * FROM domain_assets")).length, 1);
  } finally {
    await f.db.close();
  }
});
test("runtime preferences cannot enable unverified live adapter; ordinary support cannot change pricing", async () => {
  const f = await fixture();
  try {
    const row = await f.paid();
    await f.automatic();
    await fulfillment.dispatchDomainOrder(f.q, row.id);
    assert.equal(
      (await f.current(row.id)).fallback_reason,
      "CONTRACT_UNVERIFIED",
    );
    assert.equal(
      (await f.q("SELECT * FROM domain_registrar_operations")).length,
      0,
    );
    assert.equal(can("support", "fulfill_domains"), true);
    assert.equal(can("support", "manage_domains"), false);
    assert.equal(can("analyst", "fulfill_domains"), false);
    assert.equal(can("owner", "manage_domains"), true);
  } finally {
    await f.db.close();
  }
});
test("partner domain purchases require explicit current client scope and never change organization ownership", async () => {
  const f = await fixture();
  try {
    await f.q("INSERT INTO affiliates VALUES($1,'partner','active',true)", [
      partner,
    ]);
    await f.q(
      "INSERT INTO feature_registry VALUES('domains','ASSISTED',ARRAY['VIEW','REQUEST_SETUP'])",
    );
    await f.q(
      "INSERT INTO partner_client_access(partner_id,organization_id,scopes) VALUES($1,$2,ARRAY['VIEW_ALLOWED_SERVICES','REQUEST_SERVICE_CHANGES'])",
      [partner, org],
    );
    await assert.rejects(f.order("denied.com.ng", { partnerId: partner }));
    await f.q(
      "UPDATE partner_client_access SET scopes=array_append(scopes,'PURCHASE_DOMAINS') WHERE partner_id=$1",
      [partner],
    );
    const row = await f.order("client.com.ng", { partnerId: partner });
    assert.equal(row.organization_id, org);
    assert.equal(row.billing_email, "customer@example.test");
    assert.equal((await f.q("SELECT * FROM domain_assets")).length, 0);
    await f.q(
      "UPDATE partner_client_access SET revoked_at=now() WHERE partner_id=$1",
      [partner],
    );
    await assert.rejects(f.order("revoked.com.ng", { partnerId: partner }));
  } finally {
    await f.db.close();
  }
});

test("assigned fulfillment uses atomic assignment checks and privileged settings reject support", async () => {
  const f = await fixture();
  try {
    const support = crypto.randomUUID(),
      replacement = crypto.randomUUID();
    await f.q(
      "INSERT INTO admin_users(id,role,name,email) VALUES($1,'support','Support','support@example.test'),($2,'support','Other','other@example.test')",
      [support, replacement],
    );
    const row = await f.paid();
    await fulfillment.dispatchDomainOrder(f.q, row.id);
    let role = "support";
    const actions = load("../src/lib/actions/domain-fulfillment-actions.ts", {
      "@/lib/admin-session": {
        requireAdminCapability: async (capability) => {
          if (!can(role, capability)) throw Error("denied");
          return { id: role === "owner" ? admin : support };
        },
      },
      "@/lib/domains/service": { query: f.q },
      "@/lib/domains/fulfillment": fulfillment,
      "@/lib/domains/registrar-operations": ledger,
      "@/lib/domains/store": store,
    });
    assert.equal(
      (await actions.saveDomainFulfillmentSettingsAction({ mode: "AUTOMATIC" }))
        .ok,
      false,
    );
    assert.equal(
      (
        await actions.assignDomainOrderAction({
          id: row.id,
          assignee: support,
          revision: 1,
        })
      ).ok,
      false,
    );
    role = "owner";
    const before = await f.current(row.id);
    assert.equal(
      (
        await actions.assignDomainOrderAction({
          id: row.id,
          assignee: support,
          revision: Number(before.fulfillment_revision),
        })
      ).ok,
      true,
    );
    assert.equal(
      (
        await actions.assignDomainOrderAction({
          id: row.id,
          assignee: replacement,
          revision: Number(before.fulfillment_revision),
        })
      ).ok,
      false,
    );
    const assigned = await f.current(row.id);
    await assert.rejects(
      store.changeOrder(f.q, {
        id: row.id,
        admin: replacement,
        assignedOnly: true,
        revision: Number(assigned.revision),
        status: "PROCESSING",
      }),
    );
    await store.changeOrder(f.q, {
      id: row.id,
      admin: support,
      assignedOnly: true,
      revision: Number(assigned.revision),
      status: "PROCESSING",
    });
    assert.equal((await f.current(row.id)).status, "PROCESSING");
  } finally {
    await f.db.close();
  }
});

test("a verified recoverable outcome clears the operation gate and routes the same paid order to manual review", async () => {
  const f = await fixture();
  try {
    const row = await f.paid();
    await f.automatic();
    let sent = 0;
    const adapter = f.adapter(row, async () => {
      sent++;
      return {
        kind: "NOT_APPLIED",
        evidence: {
          domain: row.domain,
          checkedAt: new Date(),
          accountVerified: true,
          definitelyNotApplied: true,
          pending: false,
        },
      };
    });
    await fulfillment.dispatchDomainOrderMock(f.q, row.id, adapter);
    const current = await f.current(row.id);
    assert.equal(sent, 1);
    assert.equal(current.fulfillment_stage, "MANUAL_REVIEW");
    assert.equal(current.fallback_reason, "PROVIDER_RECOVERABLE");
    assert.equal(
      (await f.q("SELECT * FROM domain_registrar_operations"))[0].state,
      "NOT_APPLIED",
    );
    assert.equal((await f.q("SELECT * FROM domain_orders")).length, 1);
  } finally {
    await f.db.close();
  }
});
test("existing Go54 email binding is supported, conflicting aliases fail closed without credential disclosure", () => {
  const adapter = load("../src/lib/domains/go54.ts", {
    "server-only": {},
    "node:crypto": crypto,
  });
  const old = {
    email: process.env.GO54_API_EMAIL,
    legacy: process.env.GO54_RESELLER_EMAIL,
    key: process.env.GO54_API_KEY,
  };
  try {
    process.env.GO54_API_EMAIL = "reseller@example.test";
    process.env.GO54_API_KEY = "synthetic-only-key";
    delete process.env.GO54_RESELLER_EMAIL;
    assert.equal(
      adapter.configuredGo54Credentials().email,
      "reseller@example.test",
    );
    process.env.GO54_RESELLER_EMAIL = "conflict@example.test";
    assert.throws(() => adapter.configuredGo54Credentials(), /Conflicting/);
    delete process.env.GO54_API_EMAIL;
    assert.equal(
      adapter.configuredGo54Credentials().email,
      "conflict@example.test",
    );
  } finally {
    for (const [key, value] of Object.entries({
      GO54_API_EMAIL: old.email,
      GO54_RESELLER_EMAIL: old.legacy,
      GO54_API_KEY: old.key,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
