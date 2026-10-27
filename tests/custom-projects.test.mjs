import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import * as model from "../src/lib/custom/model.ts";
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
    (n) => (n in deps ? deps[n] : require(n)),
    m,
    m.exports,
  );
  return m.exports;
}
const org = "10000000-0000-4000-8000-000000000001",
  other = "10000000-0000-4000-8000-000000000002",
  user = "10000000-0000-4000-8000-000000000003",
  admin = "10000000-0000-4000-8000-000000000004";
test("Custom validation rejects unsafe URLs, invalid dates and malformed prices", () => {
  for (const url of [
    "javascript:alert(1)",
    "http://client.test",
    "https://user:pass@client.test",
    "https://127.0.0.1",
    "https://localhost",
  ])
    assert.throws(() => model.secureUrl(url));
  assert.equal(
    model.secureUrl("https://client.example/api/jktl/callback"),
    "https://client.example/api/jktl/callback",
  );
  assert.throws(() => model.date("2026-02-30"));
  assert.throws(() => model.amount(1.5));
  assert.throws(() => model.id("injected"));
  assert.equal(can("editor", "manage_custom"), false);
  assert.equal(can("owner", "manage_custom"), true);
});
test("Custom onboarding, billing, independent CMS grants and tenant boundaries use real SQL", async (t) => {
  const db = new PGlite();
  const q = async (s, a = []) => (await db.query(s, a)).rows;
  await db.exec(
    `CREATE TABLE organizations(id uuid PRIMARY KEY,name text);CREATE TABLE users(id uuid PRIMARY KEY,email text,name text,password_hash text);CREATE TABLE organization_members(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid,user_id uuid,role text,active boolean,email text);CREATE TABLE domain_assets(id uuid PRIMARY KEY,organization_id uuid);CREATE TABLE domain_rate_limits(bucket text PRIMARY KEY,hits integer,expires_at timestamptz);INSERT INTO organizations VALUES('${org}','Pilot Law'),('${other}','Other client');INSERT INTO users VALUES('${user}','owner@example.test','Owner','unusable-random-password');INSERT INTO organization_members(organization_id,user_id,role,active,email) VALUES('${org}','${user}','owner',true,'owner@example.test');`,
  );
  await db.exec(
    readFileSync(
      new URL("../migrations/035_custom_projects.sql", import.meta.url),
      "utf8",
    ),
  );
  // Migration 050 adds a billing-only flag to the existing project store.
  await db.exec(
    "ALTER TABLE custom_projects ADD COLUMN billing_only boolean NOT NULL DEFAULT false",
  );
  const sql = Object.assign(
    (strings, ...values) =>
      q(
        strings.reduce((a, s, i) => a + (i ? "$" + i : "") + s, ""),
        values,
      ),
    { query: q },
  );
  let session = { organizationId: org, userId: user },
    role = "owner",
    payments = 0,
    verifyData = null,
    verifyThrows = false,
    sendOk = true,
    sent = [],
    passwordHashes = 0;
  const service = load("../src/lib/custom/service.ts", {
    "server-only": {},
    "@/lib/db/client": { getSql: () => sql },
    "@/lib/session": { requireSession: async () => session },
    "./model": model,
    "@/lib/db/organizations": {
      getUser: async () => ({ email: "owner@example.test" }),
    },
    "@/lib/paystack": {
      initializeDomainPayment: async (p) => {
        payments++;
        assert.equal(p.metadata.type, "custom_invoice");
        assert.equal(p.plan, undefined);
        return {
          reference: p.reference,
          authorizationUrl: "https://checkout.paystack.com/mock",
        };
      },
      verifyTransaction: async () => {
        if (verifyThrows) throw Error("outage");
        return verifyData;
      },
    },
  });
  const rate = load("../src/lib/domains/store.ts", {
    "./model": load("../src/lib/domains/model.ts", {}),
  }).rateLimit;
  const actions = load("../src/lib/actions/custom-project-actions.ts", {
    "@/lib/admin-session": {
      requireAdminCapability: async (cap) => {
        if (!can(role, cap)) throw Error("Forbidden");
        return { id: admin };
      },
    },
    "@/lib/session": { getSession: async () => session },
    "@/lib/db/auth": {
      findUserByEmail: async () => ({
        id: user,
        name: "Owner",
        email: "owner@example.test",
      }),
      signup: async () => {
        throw Error("Unexpected signup");
      },
      hashPassword: async (p) => {
        passwordHashes++;
        return "hashed-" + p;
      },
    },
    "@/lib/email": {
      sendCustomInvitationEmail: async (p) => {
        sent.push(p);
        return { ok: sendOk };
      },
    },
    "@/lib/custom/service": service,
    "@/lib/custom/model": model,
    "@/lib/domains/store": { rateLimit: rate },
  });
  let project, invite, serviceRow, invoice, key, code;
  try {
    await t.test(
      "client configuration sends no mail and no invitation before a live pilot",
      async () => {
        assert.equal(
          (
            await actions.createCustomClientAction({
              name: "Pilot Law",
              email: "owner@example.test",
            })
          ).ok,
          true,
        );
        assert.equal(sent.length, 0);
        assert.equal((await actions.sendCustomInviteAction(org)).ok, false);
        assert.equal((await actions.setCustomReadyAction(org, true)).ok, false);
        assert.equal(
          (
            await actions.saveCustomProjectAction({
              organizationId: org,
              name: "Law Firm",
              websiteUrl: "https://law.example",
              status: "CONFIGURING",
              description: "Independent law website",
              cmsUrl: "https://law.example/api/jktl/callback",
            })
          ).ok,
          true,
        );
        project = (await q("SELECT * FROM custom_projects"))[0];
        assert.equal((await actions.setCustomReadyAction(org, true)).ok, false);
        assert.equal(
          (
            await actions.saveCustomProjectAction({
              id: project.id,
              organizationId: org,
              name: "Law Firm",
              websiteUrl: "https://law.example",
              status: "LIVE",
              description: "Independent law website",
              cmsUrl: "https://law.example/api/jktl/callback",
              revision: 1,
            })
          ).ok,
          true,
        );
        assert.equal(
          (
            await actions.saveCustomProjectAction({
              id: project.id,
              organizationId: org,
              name: "Stale edit",
              websiteUrl: "https://law.example",
              status: "LIVE",
              description: "Stale",
              revision: 1,
            })
          ).ok,
          false,
        );
        assert.equal((await actions.setCustomReadyAction(org, true)).ok, true);
      },
    );
    await t.test(
      "invitation is email-bound, hashed, expiring and single use; existing password stays unchanged",
      async () => {
        assert.equal((await actions.sendCustomInviteAction(org)).ok, true);
        invite = new URL(sent[0].url).searchParams.get("token");
        assert.equal(
          (await q("SELECT token_hash FROM custom_invitations"))[0].token_hash,
          model.digest(invite),
        );
        assert.equal(
          (await actions.inspectCustomInviteAction(invite)).ok,
          true,
        );
        session = { organizationId: other, userId: other };
        assert.equal(
          (await actions.activateCustomInviteAction(invite, "ignored")).ok,
          false,
        );
        session = { organizationId: org, userId: user };
        assert.equal(
          (await actions.activateCustomInviteAction(invite, "ignored")).ok,
          true,
        );
        assert.equal(
          (await actions.activateCustomInviteAction(invite, "ignored")).ok,
          false,
        );
        assert.equal(
          (await q("SELECT password_hash FROM users"))[0].password_hash,
          "unusable-random-password",
        );
        assert.equal(passwordHashes, 0);
      },
    );
    await t.test(
      "service proposals require explicit acceptance; invoices are unique and snapshot discounts",
      async () => {
        const proposed = await actions.saveCustomServiceAction({
          projectId: project.id,
          name: "Managed infrastructure",
          category: "HOSTING",
          description:
            "JKTL monitoring, deployment management and infrastructure support. Third-party hosting separately itemized.",
          amountKobo: 1500000,
          discountKobo: 100000,
          interval: "MONTHLY",
          startsOn: new Date().toISOString().slice(0, 10),
        });
        assert.equal(proposed.ok, true);
        await service.generateInvoices();
        assert.equal((await q("SELECT * FROM custom_invoices")).length, 0);
        serviceRow = (await q("SELECT * FROM custom_services"))[0];
        assert.equal(
          (await actions.acceptCustomServiceAction(serviceRow.id, 1, false)).ok,
          false,
        );
        assert.equal(
          (await actions.acceptCustomServiceAction(serviceRow.id, 1, true)).ok,
          true,
        );
        await service.generateInvoices();
        const invoices = await q("SELECT * FROM custom_invoices");
        assert.equal(invoices.length, 1);
        invoice = invoices[0];
        assert.equal(Number(invoice.amount_kobo), 1400000);
        assert.equal(
          (await actions.acceptCustomServiceAction(serviceRow.id, 1, true)).ok,
          false,
        );
        assert.equal(payments, 0);
      },
    );
    await t.test(
      "payment initialization is one-off, scoped and reuses a reserved reference",
      async () => {
        session = { organizationId: other, userId: other };
        assert.equal(
          (await actions.payCustomInvoiceAction(invoice.id)).ok,
          false,
        );
        assert.equal(payments, 0);
        session = { organizationId: org, userId: user };
        assert.equal(
          (await actions.payCustomInvoiceAction(invoice.id)).ok,
          true,
        );
        assert.equal(
          (await actions.payCustomInvoiceAction(invoice.id)).ok,
          true,
        );
        assert.equal(payments, 1);
        invoice = (await q("SELECT * FROM custom_invoices"))[0];
        verifyData = {
          reference: invoice.reference,
          status: "success",
          id: 555001,
          amount: Number(invoice.amount_kobo),
          currency: "NGN",
          paid_at: new Date().toISOString(),
          customer: { email: "owner@example.test" },
          metadata: {
            type: "custom_invoice",
            invoiceId: invoice.id,
            organizationId: org,
          },
        };
        verifyData.amount++;
        await assert.rejects(() => service.verifyInvoice(invoice.reference));
        assert.equal(
          (await q("SELECT status FROM custom_invoices"))[0].status,
          "OPEN",
        );
        verifyData.amount--;
        verifyThrows = true;
        await assert.rejects(() =>
          service.handleCustomEvent("charge.success", {
            reference: invoice.reference,
          }),
        );
        verifyThrows = false;
        assert.equal(
          await service.handleCustomEvent("charge.success", {
            reference: invoice.reference,
          }),
          true,
        );
        assert.equal(
          await service.handleCustomEvent("charge.success", {
            reference: invoice.reference,
          }),
          true,
        );
        assert.equal(
          (await q("SELECT * FROM custom_audit WHERE event='INVOICE_PAID'"))
            .length,
          1,
        );
        assert.equal(
          (await q("SELECT status FROM custom_invoices"))[0].status,
          "PAID",
        );
        const s = (await q("SELECT * FROM custom_services"))[0];
        assert.ok(new Date(s.next_due_on) > new Date(invoice.due_on));
        assert.equal(
          await service.handleCustomEvent("charge.success", {
            reference: "website_other",
          }),
          false,
        );
      },
    );
    await t.test(
      "CMS grants fail closed until pilot, use hashed keys/codes and cannot be replayed or cross projects",
      async () => {
        assert.equal((await actions.openCustomCmsAction(project.id)).ok, false);
        const generated = await actions.configureCustomCmsAction(
          project.id,
          false,
        );
        assert.equal(generated.ok, true);
        key = generated.data.key;
        assert.equal(
          (await q("SELECT cms_key_hash FROM custom_projects"))[0].cms_key_hash,
          model.digest(key),
        );
        assert.equal(
          (await actions.configureCustomCmsAction(project.id, true)).ok,
          true,
        );
        const launched = await actions.openCustomCmsAction(project.id);
        assert.equal(launched.ok, true);
        code = new URL(launched.data.url).searchParams.get("jktl_code");
        assert.equal(await service.redeemGrant(code, other, key), null);
        assert.equal(
          await service.redeemGrant(code, project.id, model.token()),
          null,
        );
        const identity = await service.redeemGrant(code, project.id, key);
        assert.equal(identity.organization_id, org);
        assert.equal(identity.user_id, user);
        assert.equal(await service.redeemGrant(code, project.id, key), null);
        const expired = await actions.openCustomCmsAction(project.id);
        const c = new URL(expired.data.url).searchParams.get("jktl_code");
        await q(
          "UPDATE custom_cms_grants SET expires_at=now()-interval '1 second' WHERE token_hash=$1",
          [model.digest(c)],
        );
        assert.equal(await service.redeemGrant(c, project.id, key), null);
        await actions.configureCustomCmsAction(project.id, false);
        assert.equal((await actions.openCustomCmsAction(project.id)).ok, false);
      },
    );
    await t.test(
      "tenant data, support and admin role permissions remain isolated",
      async () => {
        assert.equal(
          (
            await actions.createCustomRequestAction(
              project.id,
              "CONTENT",
              "Please update the opening hours.",
            )
          ).ok,
          true,
        );
        session = { organizationId: other, userId: other };
        await q(
          "INSERT INTO organization_members(organization_id,user_id,role,active,email) VALUES($1,$2,'owner',true,'other@example.test')",
          [other, other],
        );
        const isolated = await actions.customWorkspaceAction();
        assert.equal(isolated.data.projects.length, 0);
        assert.equal(isolated.data.invoices.length, 0);
        assert.equal(
          (
            await actions.createCustomRequestAction(
              project.id,
              "FIX",
              "Cross tenant request",
            )
          ).ok,
          false,
        );
        session = { organizationId: org, userId: user };
        role = "editor";
        assert.equal((await actions.customAdminAction()).ok, false);
        assert.equal(
          (await actions.setCustomReadyAction(org, false)).ok,
          false,
        );
        role = "owner";
        const req = (await q("SELECT * FROM custom_requests"))[0];
        assert.equal(
          (
            await actions.replyCustomRequestAction(
              req.id,
              "COMPLETED",
              "Opening hours updated and published.",
            )
          ).ok,
          true,
        );
        assert.equal(
          (await actions.changeCustomServiceAction(serviceRow.id, "PAUSED")).ok,
          true,
        );
        await service.generateInvoices();
        assert.equal((await q("SELECT * FROM custom_invoices")).length, 1);
      },
    );
    await t.test(
      "new-client activation changes password once and invalid/expired invitations never hash a password",
      async () => {
        await q(
          "UPDATE custom_clients SET activation_required=true,activated_at=NULL WHERE organization_id=$1",
          [org],
        );
        await q("DELETE FROM domain_rate_limits");
        assert.equal((await actions.sendCustomInviteAction(org)).ok, true);
        const raw = new URL(sent.at(-1).url).searchParams.get("token");
        assert.equal(
          (await actions.activateCustomInviteAction(raw, "short")).ok,
          false,
        );
        assert.equal(passwordHashes, 0);
        assert.equal(
          (
            await actions.activateCustomInviteAction(
              raw,
              "a-good-long-password",
            )
          ).ok,
          true,
        );
        assert.equal(passwordHashes, 1);
        assert.equal(
          (await q("SELECT password_hash FROM users"))[0].password_hash,
          "hashed-a-good-long-password",
        );
        assert.equal(
          (
            await actions.activateCustomInviteAction(
              raw,
              "another-long-password",
            )
          ).ok,
          false,
        );
        assert.equal(passwordHashes, 1);
      },
    );
    await t.test(
      "invoice and reminder notices retry safely without exposing CMS secrets",
      async () => {
        await q(
          "UPDATE custom_invoices SET status='OPEN',due_on=(now() AT TIME ZONE 'Africa/Lagos')::date+1",
        );
        let success = false,
          notices = [];
        const n = load("../src/lib/custom/notifications.ts", {
          "server-only": {},
          "./service": service,
          "@/lib/email": {
            sendCustomNoticeEmail: async (p) => {
              notices.push(p);
              return { ok: success };
            },
          },
        });
        let r = await n.runCustomMaintenance();
        assert.equal(r.failed, 2);
        r = await n.runCustomMaintenance();
        assert.equal(r.failed, 0);
        assert.equal(
          notices.length,
          2,
          "leased failures do not resend immediately",
        );
        await q(
          "UPDATE custom_outbox SET lease_until=now()-interval '1 second'",
        );
        success = true;
        r = await n.runCustomMaintenance();
        assert.equal(r.sent, 2);
        assert.equal(JSON.stringify(notices).includes(key), false);
        assert.equal((await n.runCustomMaintenance()).sent, 0);
      },
    );
  } finally {
    await db.close();
  }
});
test("CMS adapter rejects forged identity and delegates publishing to site permissions/audited persistence", async () => {
  const { exchangeJktlGrant, publishJktlContent } =
    await import("../packages/custom-cms/index.mjs");
  const opts = { code: model.token(), projectId: org, apiKey: model.token() };
  await assert.rejects(() =>
    exchangeJktlGrant({
      ...opts,
      fetchImpl: async () =>
        Response.json({
          issuer: "https://evil.test",
          audience: org,
          scope: [],
        }),
    }),
  );
  const identity = await exchangeJktlGrant({
    ...opts,
    fetchImpl: async (_u, p) => {
      assert.equal(p.redirect, "error");
      assert.equal(p.cache, "no-store");
      return Response.json({
        issuer: "https://business.jktl.com.ng",
        audience: org,
        subject: user,
        organizationId: org,
        scope: ["content:read", "content:write", "content:publish"],
      });
    },
  });
  let persisted = 0,
    revalidated = 0;
  await assert.rejects(() =>
    publishJktlContent({
      identity,
      resource: "service:1",
      authorize: async () => false,
      saveWithAudit: async () => {
        persisted++;
      },
      revalidate: async () => {
        revalidated++;
      },
    }),
  );
  assert.equal(persisted, 0);
  await publishJktlContent({
    identity,
    resource: "service:1",
    content: { title: "Updated" },
    authorize: async () => true,
    saveWithAudit: async () => {
      persisted++;
    },
    revalidate: async () => {
      revalidated++;
    },
  });
  assert.equal(persisted, 1);
  assert.equal(revalidated, 1);
});
