import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import crypto from "node:crypto";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import * as model from "../src/lib/domains/model.ts";
function load(path, deps = {}) {
  const code = ts.transpileModule(
    readFileSync(new URL(path, import.meta.url), "utf8"),
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
      if (!(n in deps)) throw Error("Unexpected dependency " + n);
      return deps[n];
    },
    m,
    m.exports,
  );
  return m.exports;
}
const adapter = () =>
  load("../src/lib/domains/go54.ts", {
    "server-only": {},
    "node:crypto": crypto,
  });
const reg = () => load("../src/lib/domains/registry.ts", { "server-only": {} });
const store = load("../src/lib/domains/store.ts", { "./model": model });
const ops = load("../src/lib/domains/registrar-operations.ts", {
  "server-only": {},
  "node:crypto": crypto,
  "./model": model,
  "./store": store,
});
const admin = load("../src/lib/domains/registrar-admin.ts", {
  "server-only": {},
  "./model": model,
});
const org = "00000000-0000-4000-8000-000000000001",
  actor = "00000000-0000-4000-8000-000000000002";
function environment(vars) {
  const before = Object.fromEntries(
    Object.keys(vars).map((k) => [k, process.env[k]]),
  );
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return () => {
    for (const [k, v] of Object.entries(before)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
}
test("GO54 HMAC matches the supplied PHP expression, UTC hour and hexadecimal-text Base64", () => {
  const api = adapter();
  const h = api.go54Headers(
    { email: "reseller@example.test", apiKey: "fixture-secret" },
    new Date("2026-10-29T00:59:00+01:00"),
  );
  // Independently computed with Python hmac/sha256 + Base64(hex text).
  assert.equal(
    h.token,
    "NDhlYzE4MWJkNWUzNjU5MTc4MmI5ZTYwYjZkNzY4Zjc3MWE4ZTNiM2QyNTBlMDVkN2UwNmRkOTQ3YjM0ZTQxZg==",
  );
  assert.equal(h.username, "reseller@example.test");
  assert.notEqual(
    h.token,
    crypto
      .createHmac("sha256", "reseller@example.test:26-10-28 23")
      .update("fixture-secret")
      .digest("base64"),
  );
  assert.equal(api.GO54_WRITES_IMPLEMENTED, false);
});
test("nested forms use PHP-style brackets, RFC1738 spaces, indexed arrays and scalar flags", () => {
  const api = adapter();
  // Synthetic nested keys test serialization, NOT a claimed GO54 contact schema.
  assert.equal(
    api.go54Form({
      domain: "example.com.ng",
      regperiod: 1,
      nameservers: ["ns1.example.test", "ns2.example.test"],
      contacts: { role: { field: "Ada Test" } },
      addons: { flag: true },
      omitted: null,
    }),
    "domain=example.com.ng&regperiod=1&nameservers%5B0%5D=ns1.example.test&nameservers%5B1%5D=ns2.example.test&contacts%5Brole%5D%5Bfield%5D=Ada+Test&addons%5Bflag%5D=1",
  );
  assert.throws(() => api.go54Form({ "bad[key]": "x" }));
  assert.throws(() => api.go54Form({ cost: 1.2 }));
});
test("pricing transport uses only the confirmed authenticated GET, caches privately and never infers response fields", async () => {
  const restore = environment({
      GO54_RESELLER_EMAIL: "reseller@example.test",
      GO54_API_KEY: "fixture-secret",
    }),
    oldFetch = globalThis.fetch;
  const api = adapter();
  let calls = 0;
  try {
    globalThis.fetch = async (url, init) => {
      calls++;
      assert.equal(String(url), api.GO54_BASE_URL + "/tlds/pricing");
      assert.equal(init.method, "GET");
      assert.equal(init.body, undefined);
      assert.equal(init.redirect, "error");
      assert.equal(init.headers.username, "reseller@example.test");
      return Response.json({ opaque: ["unmapped-test-payload"] });
    };
    const values = await Promise.all(
      Array.from({ length: 4 }, () => api.fetchGo54WholesalePricing()),
    );
    assert.equal(calls, 1);
    assert.deepEqual(values[0], { opaque: ["unmapped-test-payload"] });
    values[0].opaque[0] = "changed";
    assert.deepEqual(await api.fetchGo54WholesalePricing(), {
      opaque: ["unmapped-test-payload"],
    });
    assert.equal(calls, 1);
    globalThis.fetch = async () => new Response("not-json", { status: 200 });
    await assert.rejects(
      api.fetchGo54WholesalePricing(true),
      /valid pricing JSON/,
    );
    globalThis.fetch = async () => new Response("error", { status: 401 });
    await assert.rejects(
      api.fetchGo54WholesalePricing(true),
      /pricing request failed/,
    );
    delete process.env.GO54_API_KEY;
    const fresh = adapter();
    await assert.rejects(fresh.fetchGo54WholesalePricing(), /credentials/);
  } finally {
    restore();
    globalThis.fetch = oldFetch;
  }
});
test("authoritative RDAP discovery does not equate 404 with purchasable availability", async () => {
  const restore = environment({
      DOMAIN_RDAP_ENABLED: "true",
      DOMAIN_RDAP_ALLOWED_TLDS: "ng",
    }),
    oldFetch = globalThis.fetch;
  try {
    const registry = reg();
    let calls = 0;
    globalThis.fetch = async (url) => {
      calls++;
      if (String(url) === "https://data.iana.org/rdap/dns.json")
        return Response.json({
          services: [[["ng"], ["https://registry.example.test/rdap/"]]],
        });
      assert.equal(
        String(url),
        "https://registry.example.test/rdap/domain/example.com.ng",
      );
      return Response.json({ errorCode: 404 }, { status: 404 });
    };
    assert.deepEqual(await registry.registryLookup("example.com.ng"), {
      status: "NOT_FOUND",
      source: "rdap",
    });
    assert.equal(calls, 2);
    await registry.registryLookup("example.com.ng");
    assert.equal(calls, 2);
    const lookup = load("../src/lib/domains/lookup.ts", {
      "server-only": {},
      "./registry": registry,
    });
    const clean = environment({
      DOMAIN_AVAILABILITY_URL: undefined,
      DOMAIN_AVAILABILITY_API_KEY: undefined,
    });
    try {
      const result = await lookup.lookupDomain("example.com.ng", {});
      assert.equal(result.status, "UNKNOWN");
      assert.equal(result.costKobo, null);
      assert.equal(result.registryStatus, "NOT_FOUND");
    } finally {
      clean();
    }
    const registered = reg();
    globalThis.fetch = async (url) =>
      String(url).endsWith("dns.json")
        ? Response.json({
            services: [[["ng"], ["https://registry.example.test/rdap/"]]],
          })
        : Response.json({
            objectClassName: "domain",
            ldhName: "owned.com.ng",
            entities: [{ private: "never retained" }],
          });
    assert.deepEqual(await registered.registryLookup("owned.com.ng"), {
      status: "REGISTERED",
      source: "rdap",
    });
  } finally {
    restore();
    globalThis.fetch = oldFetch;
  }
});
test("registry policy, unsupported bootstrap, throttles and bad responses fail closed", async () => {
  const oldFetch = globalThis.fetch;
  const restore = environment({
    DOMAIN_RDAP_ENABLED: "false",
    DOMAIN_RDAP_ALLOWED_TLDS: "ng",
  });
  try {
    globalThis.fetch = async () => {
      throw Error("Must not call an unapproved service");
    };
    assert.equal(
      (await reg().registryLookup("example.com.ng")).status,
      "UNKNOWN",
    );
    process.env.DOMAIN_RDAP_ENABLED = "true";
    process.env.DOMAIN_RDAP_ALLOWED_TLDS = "com";
    assert.equal(
      (await reg().registryLookup("example.com.ng")).status,
      "UNKNOWN",
    );
    process.env.DOMAIN_RDAP_ALLOWED_TLDS = "ng";
    globalThis.fetch = async () => Response.json({ services: [] });
    assert.equal(
      (await reg().registryLookup("example.com.ng")).status,
      "UNKNOWN",
    );
    for (const response of [
      () => new Response("slow", { status: 429 }),
      () => Response.json({ errorCode: 401 }, { status: 401 }),
      () => new Response("html", { status: 404 }),
    ]) {
      const registry = reg();
      globalThis.fetch = async (url) =>
        String(url).endsWith("dns.json")
          ? Response.json({
              services: [[["ng"], ["https://registry.example.test/rdap/"]]],
            })
          : response();
      assert.equal(
        (await registry.registryLookup("example.com.ng")).status,
        "UNKNOWN",
      );
    }
    const registry = reg();
    globalThis.fetch = async () =>
      Response.json({ services: [[["ng"], ["http://127.0.0.1/private"]]] });
    assert.equal(
      (await registry.registryLookup("example.com.ng")).status,
      "UNKNOWN",
    );
  } finally {
    restore();
    globalThis.fetch = oldFetch;
  }
});

async function fixture() {
  const db = new PGlite();
  await db.exec(
    `CREATE TABLE organizations(id uuid PRIMARY KEY);CREATE TABLE admin_users(id uuid PRIMARY KEY,role text,email text,disabled_at timestamptz);INSERT INTO organizations VALUES('${org}');INSERT INTO admin_users VALUES('${actor}','owner','owner@example.test',NULL);`,
  );
  for (const name of [
    "034_domain_orders.sql",
    "056_domain_discovery.sql",
    "057_registrar_operations.sql",
  ])
    await db.exec(
      readFileSync(new URL("../migrations/" + name, import.meta.url), "utf8"),
    );
  const q = async (s, p = []) => (await db.query(s, p)).rows;
  await q(
    "UPDATE domain_prices SET registration_price=500000,renewal_price=600000,registration_cost=300000,renewal_cost=400000,enabled=true,max_years=5 WHERE extension='.com.ng'",
  );
  let transaction = 1000;
  async function order(domain = "example.com.ng", paid = true) {
    const id = crypto.randomUUID(),
      reference = "jktl_domain_" + id.replaceAll("-", "");
    await q(
      `INSERT INTO domain_checks(organization_id,domain,extension,status,price_revision,valid_until) VALUES($1,$2,'.com.ng','AVAILABLE',1,now()+interval '5 minutes')`,
      [org, domain],
    );
    await store.reserveOrder(q, {
      id,
      org,
      domain,
      extension: ".com.ng",
      kind: "REGISTER",
      years: 1,
      priceRevision: 1,
      contact: "encrypted-fixture",
      email: "owner@example.test",
      reference,
    });
    if (paid)
      await store.recordPayment(q, {
        reference,
        id: String(++transaction),
        status: "success",
        currency: "NGN",
        amount: 500000,
        paid_at: new Date().toISOString(),
        customer: { email: "owner@example.test" },
        metadata: {
          type: "domain_order",
          orderId: id,
          organizationId: org,
          domain,
          years: 1,
        },
      });
    return id;
  }
  return { db, q, order };
}
const preflight = (domain) => ({
  domain,
  kind: "REGISTER",
  years: 1,
  eligibilityVerified: true,
  availability: "AVAILABLE",
  checkedAt: new Date(),
  wallet: {
    source: "API",
    currency: "NGN",
    balanceKobo: 2000000,
    checkedAt: new Date(),
  },
});
test("paid operation ledger blocks timeout replays until authoritative reconciliation and finalizes once", async () => {
  const { db, q, order } = await fixture();
  try {
    const unpaid = await order("unpaid.com.ng", false);
    await assert.rejects(
      ops.claimPaidRegistrarAttempt(q, unpaid),
      /verified paid/,
    );
    const id = await order();
    const claimed = await ops.claimPaidRegistrarAttempt(q, id);
    assert.equal(claimed.claimed, true);
    const operation = String(claimed.operation.id);
    assert.equal((await ops.claimPaidRegistrarAttempt(q, id)).claimed, false);
    await assert.rejects(
      ops.markRegistrarSubmitted(q, operation, 300000, {
        ...preflight("example.com.ng"),
        wallet: {
          source: "OPERATOR",
          currency: "NGN",
          balanceKobo: 999999,
          checkedAt: new Date(),
        },
      }),
      /authenticated sufficient/,
    );
    await assert.rejects(
      ops.markRegistrarSubmitted(q, operation, 300000, {
        ...preflight("example.com.ng"),
        checkedAt: new Date(0),
      }),
      /Fresh/,
    );
    await assert.rejects(
      ops.markRegistrarSubmitted(q, operation, 300000, {
        ...preflight("example.com.ng"),
        wallet: {
          source: "API",
          currency: "NGN",
          balanceKobo: 1,
          checkedAt: new Date(),
        },
      }),
      /sufficient/,
    );
    await ops.markRegistrarSubmitted(
      q,
      operation,
      300000,
      preflight("example.com.ng"),
    );
    await assert.rejects(
      ops.markRegistrarSubmitted(
        q,
        operation,
        300000,
        preflight("example.com.ng"),
      ),
      /already submitted/,
    );
    await ops.markRegistrarUnknown(q, operation);
    assert.equal((await ops.claimPaidRegistrarAttempt(q, id)).claimed, false);
    assert.equal(
      (await q("SELECT status FROM domain_orders WHERE id=$1", [id]))[0].status,
      "PROCESSING",
    );
    const other = await order("other.com.ng");
    const otherOp = (await ops.claimPaidRegistrarAttempt(q, other)).operation;
    await assert.rejects(
      ops.markRegistrarSubmitted(
        q,
        String(otherOp.id),
        300000,
        preflight("other.com.ng"),
      ),
      /reconciliation/,
    );
    await assert.rejects(
      ops.confirmRegistrarNotApplied(q, operation, {
        domain: "example.com.ng",
        accountVerified: false,
        definitelyNotApplied: true,
        pending: false,
        checkedAt: new Date(),
      }),
      /authoritative/,
    );
    // A mock authoritative account/transaction lookup confirms the first request
    // did not apply and is not pending; mere RDAP absence cannot clear this gate.
    await ops.confirmRegistrarNotApplied(q, operation, {
      domain: "example.com.ng",
      accountVerified: true,
      definitelyNotApplied: true,
      pending: false,
      checkedAt: new Date(),
    });
    const retry = await ops.claimPaidRegistrarAttempt(q, id);
    assert.equal(retry.claimed, true);
    assert.equal(Number(retry.operation.attempt), 2);
    await ops.markRegistrarSubmitted(
      q,
      String(retry.operation.id),
      300000,
      preflight("example.com.ng"),
    );
    const start = new Date(),
      end = model.expectedExpiry(start, 1);
    await ops.recordRegistrarConfirmation(q, String(retry.operation.id), {
      domain: "example.com.ng",
      transactionReference: "fixture-registrar-123",
      registeredAt: start.toISOString(),
      expiresAt: end.toISOString(),
      nameservers: ["ns1.example.test", "ns2.example.test"],
      accountVerified: true,
    });
    await db.exec(`CREATE FUNCTION fixture_reject_asset() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'local fixture failure'; END $$;
      CREATE TRIGGER fixture_asset_failure BEFORE INSERT ON domain_assets FOR EACH ROW EXECUTE FUNCTION fixture_reject_asset();`);
    try {
      await assert.rejects(
        ops.finalizeRegistrarConfirmation(q, String(retry.operation.id), actor),
      );
    } finally {
      await db.exec(
        "DROP TRIGGER fixture_asset_failure ON domain_assets; DROP FUNCTION fixture_reject_asset();",
      );
    }
    assert.equal((await ops.claimPaidRegistrarAttempt(q, id)).claimed, false);
    assert.equal(
      (
        await q("SELECT state FROM domain_registrar_operations WHERE id=$1", [
          retry.operation.id,
        ])
      )[0].state,
      "CONFIRMED",
    );
    await ops.finalizeRegistrarConfirmation(
      q,
      String(retry.operation.id),
      actor,
    );
    await ops.finalizeRegistrarConfirmation(
      q,
      String(retry.operation.id),
      actor,
    );
    assert.equal(
      (
        await q("SELECT count(*)::int n FROM domain_assets WHERE domain=$1", [
          "example.com.ng",
        ])
      )[0].n,
      1,
    );
    assert.equal(
      (await q("SELECT status FROM domain_orders WHERE id=$1", [id]))[0].status,
      "ACTIVE",
    );
    assert.equal((await ops.claimPaidRegistrarAttempt(q, id)).claimed, false);
    assert.equal(
      (await q("SELECT count(*)::int n FROM domain_payments"))[0].n,
      2,
    );
    const asset = (
      await q("SELECT * FROM domain_assets WHERE domain='example.com.ng'")
    )[0];
    const renewalId = crypto.randomUUID(),
      reference = "jktl_domain_" + renewalId.replaceAll("-", "");
    await store.reserveOrder(q, {
      id: renewalId,
      org,
      domain: "example.com.ng",
      extension: ".com.ng",
      kind: "RENEW",
      assetId: asset.id,
      years: 2,
      priceRevision: 1,
      contact: "encrypted-fixture",
      email: "owner@example.test",
      reference,
    });
    await store.recordPayment(q, {
      reference,
      id: "9000",
      status: "success",
      currency: "NGN",
      amount: 1200000,
      paid_at: new Date().toISOString(),
      customer: { email: "owner@example.test" },
      metadata: {
        type: "domain_order",
        orderId: renewalId,
        organizationId: org,
        domain: "example.com.ng",
        years: 2,
      },
    });
    const renewal = await ops.claimPaidRegistrarAttempt(q, renewalId);
    await ops.markRegistrarSubmitted(q, String(renewal.operation.id), 800000, {
      ...preflight("example.com.ng"),
      kind: "RENEW",
      years: 2,
      availability: "REGISTERED_TO_RESELLER",
    });
    const renewedExpiry = model.expectedExpiry(
      new Date(String(asset.expires_at)),
      2,
    );
    await ops.recordRegistrarConfirmation(q, String(renewal.operation.id), {
      domain: "example.com.ng",
      transactionReference: "fixture-renewal-9000",
      registeredAt: new Date(String(asset.registered_at)).toISOString(),
      expiresAt: renewedExpiry.toISOString(),
      nameservers: ["ns1.example.test", "ns2.example.test"],
      accountVerified: true,
    });
    await ops.finalizeRegistrarConfirmation(
      q,
      String(renewal.operation.id),
      actor,
    );
    assert.equal(
      +new Date(
        (
          await q("SELECT expires_at FROM domain_assets WHERE id=$1", [
            asset.id,
          ])
        )[0].expires_at,
      ),
      +renewedExpiry,
    );
    assert.equal(
      (await q("SELECT count(*)::int n FROM domain_assets"))[0].n,
      1,
    );
  } finally {
    await db.close();
  }
});
test("private wholesale markups preserve manual prices, accepted orders and snapshots; wallet alerts reach owners only", async () => {
  const { db, q, order } = await fixture();
  try {
    const id = await order();
    assert.equal(admin.markedUpPrice(101, 1000, 7), 119);
    assert.throws(() => admin.markedUpPrice(1, -1, 0));
    await admin.saveVerifiedWholesale(q, actor, {
      extension: ".com.ng",
      registration: 200000,
      renewal: 300000,
      transfer: 100000,
      revision: 1,
    });
    let price = (
      await q("SELECT * FROM domain_prices WHERE extension='.com.ng'")
    )[0];
    assert.equal(Number(price.registration_price), 500000);
    await admin.saveMarkupPolicy(q, actor, {
      extension: ".com.ng",
      revision: 2,
      mode: "MARKUP",
      bps: 2500,
      fixed: 10000,
    });
    price = (
      await q("SELECT * FROM domain_prices WHERE extension='.com.ng'")
    )[0];
    assert.equal(Number(price.registration_price), 260000);
    assert.equal(
      Number(
        (await q("SELECT amount_kobo FROM domain_orders WHERE id=$1", [id]))[0]
          .amount_kobo,
      ),
      500000,
    );
    await assert.rejects(
      admin.saveMarkupPolicy(q, actor, {
        extension: ".com.ng",
        revision: 2,
        mode: "MANUAL",
        bps: 0,
        fixed: 0,
      }),
      /changed/,
    );
    await admin.saveOperatorWallet(q, actor, {
      balance: 100,
      threshold: 500,
      revision: 1,
    });
    await admin.saveOperatorWallet(q, actor, {
      balance: 90,
      threshold: 500,
      revision: 2,
    });
    assert.equal(
      (await q("SELECT count(*)::int n FROM domain_registrar_alerts"))[0].n,
      1,
    );
    const messages = [];
    await q(
      "INSERT INTO admin_users(id,role,email) VALUES($1,'affiliate_manager','other-team@example.test')",
      [crypto.randomUUID()],
    );
    assert.deepEqual(
      await admin.flushRegistrarAlerts(q, async (message) => {
        messages.push(message);
        return { ok: true };
      }),
      { sent: 1, failed: 0 },
    );
    assert.equal(messages[0].to, "owner@example.test");
    assert.equal(messages[0].path, "/admin/domains");
    assert.equal(messages[0].category, "internal");
    assert.equal(messages.length, 1);
    assert.deepEqual(
      await admin.flushRegistrarAlerts(q, async () => {
        throw Error("duplicate email");
      }),
      { sent: 0, failed: 0 },
    );
    await admin.saveOperatorWallet(q, actor, {
      balance: 900,
      threshold: 500,
      revision: 3,
    });
    await admin.saveOperatorWallet(q, actor, {
      balance: 10,
      threshold: 500,
      revision: 4,
    });
    assert.equal(
      (await q("SELECT count(*)::int n FROM domain_registrar_alerts"))[0].n,
      2,
    );
    // Migration replay must retain amounts, assets and paid receipts.
    await db.exec(
      readFileSync(
        new URL("../migrations/057_registrar_operations.sql", import.meta.url),
        "utf8",
      ),
    );
    assert.equal(
      (await q("SELECT count(*)::int n FROM domain_payments"))[0].n,
      1,
    );
    assert.equal(
      (
        await q(
          "SELECT purchases_enabled,automation_enabled FROM domain_purchase_controls",
        )
      )[0].automation_enabled,
      false,
    );
  } finally {
    await db.close();
  }
});
test("all private registrar actions reject an unauthorized caller before reading or writing", async () => {
  let calls = 0;
  const actions = load("../src/lib/actions/registrar-actions.ts", {
    "@/lib/admin-session": {
      requireAdminCapability: async () => {
        throw Error("denied");
      },
    },
    "@/lib/domains/service": {
      query: async () => {
        calls++;
        return [];
      },
    },
    "@/lib/domains/go54": {
      fetchGo54WholesalePricing: async () => {
        calls++;
      },
      GO54_WRITES_IMPLEMENTED: false,
    },
    "@/lib/domains/registrar-admin": admin,
    "@/lib/domains/store": store,
  });
  for (const fn of Object.values(actions))
    assert.equal((await fn({})).ok, false);
  assert.equal(calls, 0);
});
