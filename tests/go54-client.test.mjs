import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import crypto from "node:crypto";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
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
      if (!(n in deps)) throw Error("Unexpected import " + n);
      return deps[n];
    },
    m,
    m.exports,
  );
  return m.exports;
}
const auth = load("../src/lib/domains/go54.ts", {
  "server-only": {},
  "node:crypto": crypto,
});
const diagnostics = load("../src/lib/domains/go54-diagnostics.ts", {
  "server-only": {},
  "node:crypto": crypto,
});
const sdk = load("../src/lib/domains/go54-client.ts", {
  "server-only": {},
  "./go54": auth,
  "./go54-diagnostics": diagnostics,
});
const credentials = {
  email: "reseller@example.test",
  apiKey: "fixture-secret-not-real",
};
const envKeys = [
  "NODE_ENV",
  "GO54_EPP_READ_METHOD",
  "GO54_LOCK_READ_METHOD",
  "GO54_NAMESERVERS_READ_METHOD",
  "GO54_CONTACTS_READ_METHOD",
];
function environment(changes = {}) {
  const previous = Object.fromEntries(
    [...envKeys, ...Object.keys(changes)].map((k) => [k, process.env[k]]),
  );
  Object.assign(
    process.env,
    {
      NODE_ENV: "test",
      GO54_EPP_READ_METHOD: "GET",
      GO54_LOCK_READ_METHOD: "GET",
      GO54_NAMESERVERS_READ_METHOD: "GET",
      GO54_CONTACTS_READ_METHOD: "GET",
    },
    changes,
  );
  return () => {
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
}
// All JSON bodies in this file are SYNTHETIC TEST FIXTURES, not official GO54 responses.
const body = {
  fixtureOnly: true,
  opaqueEnvelope: { unexpectedValue: "unverified fixture" },
};
const contact = (role) => ({
  firstname: "Example",
  lastname: "Person",
  fullname: "Example Person",
  companyname: "",
  email: role + "@example.test",
  address1: "1 Example Road",
  address2: "",
  city: "Lagos",
  state: "Lagos",
  zipcode: "110001",
  country: "Nigeria",
  phonenumber: "+234.812345678",
});
const contacts = () =>
  Object.fromEntries(
    ["registrant", "tech", "billing", "admin"].map((role) => [
      role,
      contact(role),
    ]),
  );
const registration = () => ({
  domain: "example.com.ng",
  regperiod: 1,
  nameservers: ["ns1.example.test", "ns2.example.test"],
  contacts: contacts(),
});
function mock(transport) {
  return sdk.createMockGo54Client(
    transport,
    credentials,
    () => new Date("2026-10-28T23:45:00Z"),
  );
}

test("documented operation requests use exact paths, methods and distinct nameserver encodings", async () => {
  const restore = environment(),
    calls = [];
  try {
    const client = mock(async (url, init) => {
      calls.push({ url: String(url), ...init });
      return Response.json(body);
    });
    const cases = [
      [
        "register",
        "POST",
        "/order/domains/register",
        () =>
          client.register({
            ...registration(),
            domainfields: "fixture-domain-field",
            addons: { idprotection: 0 },
          }),
      ],
      [
        "renew",
        "POST",
        "/order/domains/renew",
        () =>
          client.renew({
            domain: "example.com.ng",
            regperiod: 2,
            addons: { dnsmanagement: 0, emailforwarding: 0, idprotection: 0 },
          }),
      ],
      [
        "transfer",
        "POST",
        "/order/domains/transfer",
        () =>
          client.transfer({ ...registration(), eppcode: "fixture-epp&+=code" }),
      ],
      [
        "nameservers.read",
        "GET",
        "/domains/example.com.ng/nameservers",
        () => client.getNameservers("example.com.ng"),
      ],
      [
        "nameservers.update",
        "POST",
        "/domains/example.com.ng/nameservers",
        () =>
          client.updateNameservers("example.com.ng", [
            "ns3.example.test",
            "ns4.example.test",
          ]),
      ],
      [
        "lock.read",
        "GET",
        "/domains/example.com.ng/lock",
        () => client.getLock("example.com.ng"),
      ],
      [
        "lock.update",
        "POST",
        "/domains/example.com.ng/lock",
        () => client.updateLock("example.com.ng", true),
      ],
      [
        "lock.update",
        "POST",
        "/domains/example.com.ng/lock",
        () => client.updateLock("example.com.ng", false),
      ],
      [
        "epp.read",
        "GET",
        "/domains/example.com.ng/eppcode",
        () => client.getEpp("example.com.ng"),
      ],
      [
        "contacts.read",
        "GET",
        "/domains/example.com.ng/contact",
        () => client.getContacts("example.com.ng"),
      ],
      [
        "domain.sync",
        "POST",
        "/domains/example.com.ng/sync",
        () => client.syncDomain("example.com.ng"),
      ],
      [
        "transfer.sync",
        "POST",
        "/domains/example.com.ng/transfersync",
        () => client.syncTransfer("example.com.ng"),
      ],
      ["pricing.read", "GET", "/tlds/pricing", () => client.getPricing()],
    ];
    for (const [operation, method, path, call] of cases) {
      const result = await call(),
        request = calls.at(-1);
      assert.equal(request.url, auth.GO54_BASE_URL + path);
      assert.equal(request.method, method);
      assert.equal(request.redirect, "error");
      assert.equal(request.headers.username, credentials.email);
      assert.equal(
        request.headers.token,
        auth.go54Headers(credentials, new Date("2026-10-28T23:45:00Z")).token,
      );
      assert.equal(result.operation, operation);
      assert.equal(result.verification, "RESPONSE_SCHEMA_UNVERIFIED");
      assert.deepEqual(result.payload, body);
      if (method === "GET") assert.equal(request.body, undefined);
      else {
        assert.equal(
          request.headers["Content-Type"],
          "application/x-www-form-urlencoded",
        );
        assert.equal(
          new URLSearchParams(request.body).get("domain"),
          "example.com.ng",
        );
      }
    }
    const register = new URLSearchParams(calls[0].body),
      transfer = new URLSearchParams(calls[2].body),
      ns = new URLSearchParams(calls[4].body);
    assert.equal(register.get("nameservers[ns1]"), "ns1.example.test");
    assert.equal(register.has("nameservers[0]"), false);
    assert.equal(transfer.get("nameservers[0]"), "ns1.example.test");
    assert.equal(ns.get("nameservers[0]"), "ns3.example.test");
    assert.equal(transfer.get("eppcode"), "fixture-epp&+=code");
    assert.equal(register.get("domainfields"), "fixture-domain-field");
    for (const role of ["registrant", "tech", "billing", "admin"])
      for (const [field, value] of Object.entries(contact(role)))
        assert.equal(register.get(`contacts[${role}][${field}]`), value);
    assert.equal(new URLSearchParams(calls[6].body).get("lockstatus"), "true");
    assert.equal(new URLSearchParams(calls[7].body).get("lockstatus"), "false");
  } finally {
    restore();
  }
});
test("contact completeness, namespace and period bounds reject bad input before transport", () => {
  const restore = environment();
  let calls = 0;
  try {
    const client = mock(async () => {
      calls++;
      return Response.json(body);
    });
    assert.throws(
      () =>
        client.register({
          ...registration(),
          contacts: { registrant: contact("registrant") },
        }),
      /four authorized/,
    );
    const bad = registration();
    delete bad.contacts.tech.lastname;
    assert.throws(() => client.register(bad), /contact fields/);
    assert.throws(
      () =>
        client.register({
          ...registration(),
          nameservers: Array.from(
            { length: 6 },
            (_, i) => `ns${i}.example.test`,
          ),
        }),
      /two to five/,
    );
    assert.throws(
      () =>
        client.register({
          ...registration(),
          nameservers: ["ns1.example.test", "ns1.example.test"],
        }),
      /distinct/,
    );
    assert.throws(
      () => client.renew({ domain: "example.com/../../wallet", regperiod: 1 }),
      /domain/,
    );
    assert.throws(
      () => client.renew({ domain: "example.com", regperiod: 99 }),
      /period/,
    );
    assert.throws(
      () => client.transfer({ ...registration(), eppcode: "" }),
      /EPP/,
    );
    assert.throws(
      () => client.register({ ...registration(), addons: { undocumented: 1 } }),
      /addons/,
    );
    assert.equal(calls, 0);
  } finally {
    restore();
  }
});
test("live mutation gate cannot be bypassed with runtime settings or production mock mode", async () => {
  const restore = environment({
      NODE_ENV: "production",
      GO54_LIVE_OPERATIONS_APPROVED: "true",
    }),
    previousFetch = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls++;
      return Response.json(body);
    };
    const client = sdk.createGo54Client();
    for (const call of [
      () => client.register(registration()),
      () => client.renew({ domain: "example.com", regperiod: 1 }),
      () => client.transfer({ ...registration(), eppcode: "fixture" }),
      () =>
        client.updateNameservers("example.com", [
          "ns1.example.test",
          "ns2.example.test",
        ]),
      () => client.updateLock("example.com", false),
      () => client.syncDomain("example.com"),
      () => client.syncTransfer("example.com"),
    ])
      await assert.rejects(
        call(),
        (e) =>
          e instanceof sdk.Go54RequestError &&
          e.requestMayHaveReachedRegistrar === false,
      );
    assert.throws(
      () =>
        sdk.createMockGo54Client(async () => Response.json(body), credentials),
      /restricted/,
    );
    assert.equal(calls, 0);
    assert.equal(sdk.GO54_LIVE_POSTS_ENABLED, false);
  } finally {
    restore();
    globalThis.fetch = previousFetch;
  }
});
test("GET/POST conflicts are explicit server configuration and never automatic fallback", async () => {
  const restore = environment({
      GO54_EPP_READ_METHOD: "POST",
      GO54_LOCK_READ_METHOD: "POST",
      GO54_NAMESERVERS_READ_METHOD: "POST",
      GO54_CONTACTS_READ_METHOD: "POST",
    }),
    calls = [];
  try {
    const client = mock(async (url, init) => {
      calls.push({ ...init, url: String(url) });
      return Response.json({ fixtureOnly: true }, { status: 405 });
    });
    for (const fn of [
      () => client.getEpp("example.com"),
      () => client.getLock("example.com"),
      () => client.getNameservers("example.com"),
      () => client.getContacts("example.com"),
    ]) {
      const reply = await fn();
      assert.equal(reply.httpStatus, 405);
      assert.equal(reply.verification, "RESPONSE_SCHEMA_UNVERIFIED");
      const request = calls.at(-1);
      assert.equal(request.method, "POST");
      assert.equal(
        new URLSearchParams(request.body).get("domain"),
        "example.com",
      );
    }
    assert.equal(calls.length, 4);
    process.env.GO54_EPP_READ_METHOD = "DELETE";
    assert.throws(() => client.getEpp("example.com"), /configuration/);
    assert.equal(calls.length, 4);
  } finally {
    restore();
  }
});
test("all JSON shapes and HTTP error JSON remain unverified; invalid JSON is safely diagnosed", async () => {
  const restore = environment();
  try {
    for (const payload of [
      body,
      null,
      "fixture scalar",
      [1, 2, 3],
      { fixtureOnly: true, opaque: true },
    ]) {
      const reply = await mock(async () => Response.json(payload)).getPricing();
      assert.deepEqual(reply.payload, payload);
      assert.equal(reply.verification, "RESPONSE_SCHEMA_UNVERIFIED");
    }
    const errorReply = await mock(async () =>
      Response.json(
        { fixtureOnly: true, unknownError: ["fixture"] },
        { status: 422 },
      ),
    ).getPricing();
    assert.equal(errorReply.httpStatus, 422);
    assert.equal(errorReply.diagnostic.jsonValid, true);
    const invalid = mock(
      async () =>
        new Response("<html>secret-provider-body</html>", { status: 502 }),
    );
    await assert.rejects(
      invalid.getPricing(),
      (e) =>
        e.requestMayHaveReachedRegistrar === true &&
        e.diagnostic.jsonValid === false &&
        e.diagnostic.httpStatus === 502 &&
        !JSON.stringify(e).includes("secret-provider-body"),
    );
    let calls = 0;
    const timeout = mock(async () => {
      calls++;
      throw Error("private upstream message " + credentials.apiKey);
    });
    await assert.rejects(
      timeout.renew({ domain: "example.com", regperiod: 1 }),
      (e) =>
        e.requestMayHaveReachedRegistrar === true &&
        !e.message.includes(credentials.apiKey),
    );
    assert.equal(calls, 1);
  } finally {
    restore();
  }
});
test("unknown diagnostic fields survive while credentials, contacts and unknown EPP fields are redacted", async () => {
  const restore = environment();
  try {
    const client = mock(async (url, init) =>
      Response.json({
        fixtureOnly: true,
        unrecognized: {
          flag: true,
          cost: 12345,
          secret: credentials.apiKey,
          echo: "prefix " + init.headers.token,
          email: "customer@example.test",
        },
        contacts: { arbitraryLabel: "private-address" },
        unexpectedEcho: "x " + credentials.apiKey,
      }),
    );
    const result = await client.getPricing();
    const sanitized = JSON.stringify(result.diagnostic.payload);
    for (const secret of [
      credentials.apiKey,
      "customer@example.test",
      "private-address",
      auth.go54Headers(credentials, new Date("2026-10-28T23:45:00Z")).token,
    ])
      assert.ok(!sanitized.includes(secret));
    assert.equal(result.diagnostic.payload.unrecognized.cost, 12345);
    assert.equal(result.diagnostic.payload.unrecognized.flag, true);
    const privateRead = mock(async () =>
      Response.json({
        fixtureOnly: true,
        mystery: { whollyUnknownField: "sensitive-epp-fixture", number: 1234 },
      }),
    );
    for (const reply of [
      await privateRead.getEpp("example.com"),
      await privateRead.getContacts("example.com"),
    ]) {
      assert.equal(
        reply.diagnostic.payload.mystery.whollyUnknownField,
        "[REDACTED]",
      );
      assert.equal(reply.diagnostic.payload.mystery.number, "[REDACTED]");
    }
    const started = performance.now();
    const huge = diagnostics.sanitizeGo54Payload(
      { unknown: "x".repeat(200000) },
      "pricing.read",
    );
    assert.ok(JSON.stringify(huge).length < 40000);
    diagnostics.sanitizeGo54Payload(
      { unknown: "x".repeat(200000) + "@" },
      "pricing.read",
    );
    assert.ok(
      performance.now() - started < 2000,
      "diagnostic redaction must stay bounded for long upstream strings",
    );
    diagnostics.sanitizeGo54Payload(
      JSON.parse('{"__proto__":{"polluted":true}}'),
      "pricing.read",
    );
    assert.equal({}.polluted, undefined);
  } finally {
    restore();
  }
});
test("diagnostic storage is capability-checked, redacted, additive and never enables purchases", async () => {
  const db = new PGlite(),
    actor = crypto.randomUUID();
  try {
    await db.exec(
      "CREATE TABLE organizations(id uuid PRIMARY KEY);CREATE TABLE admin_users(id uuid PRIMARY KEY);",
    );
    await db.query("INSERT INTO admin_users VALUES($1)", [actor]);
    for (const name of [
      "034_domain_orders.sql",
      "056_domain_discovery.sql",
      "058_go54_diagnostics.sql",
    ])
      await db.exec(
        readFileSync(new URL("../migrations/" + name, import.meta.url), "utf8"),
      );
    const q = async (s, p = []) => (await db.query(s, p)).rows;
    let authorized = false,
      requests = 0;
    const actions = load("../src/lib/actions/registrar-actions.ts", {
      "@/lib/admin-session": {
        requireAdminCapability: async (cap) => {
          assert.equal(cap, "manage_domains");
          if (!authorized) throw Error("denied");
          return { id: actor };
        },
      },
      "@/lib/domains/service": { query: q },
      "@/lib/domains/go54": {
        GO54_REQUEST_CONTRACTS_IMPLEMENTED: true,
        GO54_WRITES_IMPLEMENTED: false,
      },
      "@/lib/domains/go54-client": {
        Go54RequestError: sdk.Go54RequestError,
        configuredGo54ReadMethods: sdk.configuredGo54ReadMethods,
        createGo54Client: () => ({
          getPricing: async () => {
            requests++;
            return {
              httpStatus: 200,
              diagnostic: {
                operation: "pricing.read",
                method: "GET",
                httpStatus: 200,
                jsonValid: true,
                observedAt: new Date().toISOString(),
                payload: {
                  fixtureOnly: true,
                  unknownEnvelope: { a: 1 },
                  password: "secret-fixture",
                },
              },
            };
          },
        }),
      },
      "@/lib/domains/go54-diagnostics": diagnostics,
      "@/lib/domains/registrar-admin": {},
      "@/lib/domains/store": { rateLimit: async () => {} },
    });
    assert.equal((await actions.checkGo54PricingTransportAction()).ok, false);
    assert.equal(requests, 0);
    authorized = true;
    assert.equal((await actions.checkGo54PricingTransportAction()).ok, true);
    assert.equal(requests, 1);
    const saved = (await q("SELECT * FROM domain_registrar_diagnostics"))[0];
    assert.equal(saved.sanitized_payload.password, "[REDACTED]");
    assert.equal(saved.sanitized_payload.unknownEnvelope.a, 1);
    assert.equal(
      (
        await q(
          "SELECT purchases_enabled,automation_enabled FROM domain_purchase_controls",
        )
      )[0].purchases_enabled,
      false,
    );
    await db.exec(
      readFileSync(
        new URL("../migrations/058_go54_diagnostics.sql", import.meta.url),
        "utf8",
      ),
    );
    assert.equal(
      (await q("SELECT count(*)::int n FROM domain_registrar_diagnostics"))[0]
        .n,
      1,
    );
  } finally {
    await db.close();
  }
});
