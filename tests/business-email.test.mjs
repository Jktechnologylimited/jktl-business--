import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import * as model from "../src/lib/business-email/model.ts";
import * as customModel from "../src/lib/custom/model.ts";
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
    ).outputText,
    m = { exports: {} };
  new Function("require", "module", "exports", code)(
    (n) => (n in deps ? deps[n] : require(n)),
    m,
    m.exports,
  );
  return m.exports;
}
const org = "20000000-0000-4000-8000-000000000001",
  other = "20000000-0000-4000-8000-000000000002",
  user = "20000000-0000-4000-8000-000000000003",
  admin = "20000000-0000-4000-8000-000000000004";
test("email domains, mailbox limits, DNS and paid licensing validate before checkout", () => {
  assert.equal(model.emailDomain("EXAMPLE.com.ng"), "example.com.ng");
  for (const d of [
    "https://example.com",
    "jktl.com.ng",
    "business.jktl.com.ng",
    "not a domain",
    "localhost",
  ])
    assert.throws(() => model.emailDomain(d));
  assert.deepEqual(model.mailboxAddresses("hello info", "example.com", 2), [
    "hello@example.com",
    "info@example.com",
  ]);
  for (const b of ["hello@other.com", "hello hello", "a b c"])
    assert.throws(() => model.mailboxAddresses(b, "example.com", 2));
  assert.equal(
    model.launchReady({
      enabled: true,
      purchasable: true,
      price_kobo: 2500000,
      paid_license_confirmed: false,
    }),
    false,
  );
  assert.throws(() =>
    model.dnsRecords([{ type: "A", name: "@", value: "1.2.3.4" }]),
  );
  assert.equal(
    model.addMonths(new Date("2028-02-29T00:00:00Z"), 12).toISOString(),
    "2029-02-28T00:00:00.000Z",
  );
  assert.equal(can("editor", "manage_email"), false);
  assert.equal(can("editor", "manage_features"), true);
});
test("email checkout, provisioning, renewals, badges and partners use real isolated PostgreSQL data", async (t) => {
  const db = new PGlite(),
    q = async (s, a = []) => (await db.query(s, a)).rows;
  await db.exec(
    `CREATE TABLE organizations(id uuid PRIMARY KEY,name text);CREATE TABLE users(id uuid PRIMARY KEY,email text);CREATE TABLE organization_members(organization_id uuid,user_id uuid,role text,active boolean,email text,created_at timestamptz DEFAULT now());CREATE TABLE domain_assets(id uuid,organization_id uuid,domain text);CREATE TABLE domain_rate_limits(bucket text PRIMARY KEY,hits integer,expires_at timestamptz);CREATE TABLE affiliates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text,email text UNIQUE,password_hash text,referral_code text UNIQUE,commission_bps int,status text,application_note text,commission_model text,signup_bonus_kobo bigint,subscription_bonus_kobo bigint,recurring_monthly_kobo bigint,recurring_months_cap int);INSERT INTO organizations VALUES('${org}','Pilot'),('${other}','Other');INSERT INTO users VALUES('${user}','owner@example.test');INSERT INTO organization_members VALUES('${org}','${user}','owner',true,'owner@example.test',now());`,
  );
  const migration = readFileSync(
    new URL("../migrations/036_email_features_partners.sql", import.meta.url),
    "utf8",
  );
  await db.exec(migration);
  await db.exec(migration);
  let session = { organizationId: org, userId: user },
    role = "owner",
    payCalls = 0,
    payment = null,
    providerError = false,
    txt = [];
  const owner = async () => {
    if (
      !(
        await q(
          "SELECT 1 FROM organization_members WHERE organization_id=$1 AND user_id=$2 AND active AND role='owner'",
          [session.organizationId, session.userId],
        )
      ).length
    )
      throw Error("Only the business owner can manage email.");
    return session;
  };
  const core = { query: q, owner };
  const paystack = {
    initializeDomainPayment: async (p) => {
      payCalls++;
      assert.equal(p.metadata.type, "business_email");
      assert.equal(p.plan, undefined);
      return {
        reference: p.reference,
        authorizationUrl: "https://checkout.paystack.com/test",
      };
    },
    verifyTransaction: async () => {
      if (providerError) throw Error("Provider outage");
      return payment;
    },
  };
  const service = load("../src/lib/business-email/service.ts", {
    "server-only": {},
    "@/lib/custom/service": core,
    "@/lib/db/organizations": {
      getUser: async () => ({ email: "owner@example.test" }),
    },
    "@/lib/paystack": paystack,
    "./model": model,
  });
  const rate = load("../src/lib/domains/store.ts", {
    "./model": load("../src/lib/domains/model.ts", {}),
  }).rateLimit;
  const adminCapability = async (c) => {
    if (!can(role, c)) throw Error("Forbidden");
    return { id: admin };
  };
  const actions = load("../src/lib/actions/business-email-actions.ts", {
    "node:dns/promises": { resolveTxt: async () => txt },
    "@/lib/admin-session": { requireAdminCapability: adminCapability },
    "@/lib/paystack": paystack,
    "@/lib/business-email/service": service,
    "@/lib/business-email/model": model,
    "@/lib/custom/model": customModel,
    "@/lib/domains/store": { rateLimit: rate },
  });
  const features = load("../src/lib/actions/feature-actions.ts", {
    "@/lib/admin-session": { requireAdminCapability: adminCapability },
    "@/lib/custom/service": core,
    "@/lib/custom/model": customModel,
  });
  let order, asset;
  const request = () => ({
    planId: "starter",
    planRevision: 1,
    overrideRevision: 0,
    domain: "pilot.example",
    mailboxes: "hello",
    consent: true,
    termsVersion: model.EMAIL_TERMS,
  });
  const charge = (o) => ({
    id: 900001,
    status: "success",
    reference: o.reference,
    currency: "NGN",
    amount: Number(o.amount_kobo),
    paid_at: new Date().toISOString(),
    customer: { email: "owner@example.test" },
    metadata: {
      type: "business_email",
      orderId: o.id,
      organizationId: o.organization_id,
      domain: o.domain,
    },
  });
  try {
    await t.test(
      "proposed annual prices seed correctly, public data is safe, and every checkout starts disabled",
      async () => {
        const p = await service.emailPlans();
        assert.deepEqual(
          p.map((v) => Number(v.price_kobo)),
          [2500000, 6500000, 12000000, 0],
        );
        assert.ok(p.every((v) => v.checkout_available === false));
        assert.ok(p.every((v) => v.period_months === 12));
        assert.equal(p[0].procurement_cost_kobo, undefined);
        assert.equal(
          (await actions.orderBusinessEmailAction(request())).ok,
          false,
        );
        assert.equal(payCalls, 0);
        const plan = (
          await q("SELECT * FROM email_plans WHERE id='starter'")
        )[0];
        assert.equal(
          (await actions.saveEmailPlanAction({ ...plan, purchasable: true }))
            .ok,
          false,
        );
      },
    );
    await t.test(
      "checkout requires every procurement confirmation, snapshots server price, and refuses duplicates",
      async () => {
        const p = (await q("SELECT * FROM email_plans WHERE id='starter'"))[0];
        assert.equal(
          (
            await actions.saveEmailPlanAction({
              ...p,
              purchasable: true,
              procurement_cost_kobo: 1000000,
              resale_confirmed: true,
              paid_license_confirmed: true,
              features_confirmed: true,
            })
          ).ok,
          true,
        );
        const r = await actions.orderBusinessEmailAction({
          ...request(),
          planRevision: 2,
        });
        assert.equal(r.ok, true, r.error);
        order = (await q("SELECT * FROM email_orders"))[0];
        assert.equal(Number(order.amount_kobo), 2500000);
        assert.equal(order.status, "PENDING_PAYMENT");
        assert.equal((await q("SELECT * FROM email_services")).length, 0);
        assert.equal(
          (
            await actions.orderBusinessEmailAction({
              ...request(),
              planRevision: 2,
            })
          ).ok,
          false,
        );
        assert.equal(payCalls, 1);
      },
    );
    await t.test(
      "verified charges are exact, idempotent, tenant scoped and retryable without subscriptions fallback",
      async () => {
        payment = charge(order);
        payment.amount++;
        await assert.rejects(() =>
          service.verifyEmailReference(order.reference),
        );
        assert.equal((await q("SELECT * FROM email_services")).length, 0);
        payment.amount--;
        providerError = true;
        await assert.rejects(() =>
          service.handleEmailEvent("charge.success", {
            reference: order.reference,
          }),
        );
        providerError = false;
        assert.equal(
          await service.handleEmailEvent("charge.success", {
            reference: order.reference,
          }),
          true,
        );
        assert.equal(
          await service.handleEmailEvent("charge.success", {
            reference: order.reference,
          }),
          true,
        );
        assert.equal((await q("SELECT * FROM email_services")).length, 1);
        order = (await q("SELECT * FROM email_orders"))[0];
        asset = (await q("SELECT * FROM email_services"))[0];
        assert.equal(order.service_id, asset.id);
        assert.equal(asset.status, "AWAITING_DOMAIN_VERIFICATION");
        assert.equal((await q("SELECT * FROM email_mailboxes")).length, 1);
        assert.equal(
          (await q("SELECT * FROM email_audit WHERE event='PAYMENT_VERIFIED'"))
            .length,
          1,
        );
        assert.equal(
          await service.handleEmailEvent("charge.success", {
            reference: "website-ref",
          }),
          false,
        );
        session = { organizationId: other, userId: other };
        assert.equal(
          (await actions.verifyBusinessEmailPaymentAction(order.reference)).ok,
          false,
        );
        session = { organizationId: org, userId: user };
      },
    );
    await t.test(
      "ownership and actual licensed provisioning are required before activation",
      async () => {
        const dns = [
          { type: "MX", name: "@", value: "mx.provider.test", priority: 10 },
          {
            type: "SPF",
            name: "@",
            value: "v=spf1 include:provider.test ~all",
          },
          {
            type: "DKIM",
            name: "selector._domainkey",
            value: "v=DKIM1; p=test-public-key",
          },
          { type: "DMARC", name: "_dmarc", value: "v=DMARC1; p=none" },
        ];
        const start = new Date();
        const fulfill = () => ({
          serviceId: asset.id,
          orderId: order.id,
          revision: Number(asset.revision),
          status: "ACTIVE",
          providerPlan: "Paid test licence",
          providerReference: "test-reference",
          licenseType: "PAID",
          dns,
          sendReceiveConfirmed: true,
          dnsConfirmed: true,
          webmailUrl: "https://mail.provider.test",
          activationUrl: "",
          startsAt: start.toISOString(),
          renewsAt: model.addMonths(start, 12).toISOString(),
          note: "Licensed setup and sending/receiving tests completed.",
        });
        assert.equal(
          (await actions.fulfillEmailServiceAction(fulfill())).ok,
          false,
        );
        assert.equal(
          (await actions.verifyEmailDomainAction(asset.id)).ok,
          false,
        );
        txt = [["jktl-email-verify=" + asset.ownership_token]];
        assert.equal(
          (await actions.verifyEmailDomainAction(asset.id)).ok,
          true,
        );
        asset = (await q("SELECT * FROM email_services"))[0];
        assert.equal(
          (
            await actions.fulfillEmailServiceAction({
              ...fulfill(),
              licenseType: "LEGACY_FREE",
            })
          ).ok,
          false,
        );
        assert.equal(
          (
            await actions.fulfillEmailServiceAction({
              ...fulfill(),
              sendReceiveConfirmed: false,
            })
          ).ok,
          false,
        );
        assert.equal(
          (await actions.fulfillEmailServiceAction(fulfill())).ok,
          true,
        );
        asset = (await q("SELECT * FROM email_services"))[0];
        assert.equal(asset.status, "ACTIVE");
        assert.equal(Number(asset.period_price_kobo), 2500000);
        assert.equal(
          (await actions.fulfillEmailServiceAction(fulfill())).ok,
          false,
        );
      },
    );
    await t.test(
      "existing free services link without payments, duplicates, migration or hidden fees",
      async () => {
        const before = payCalls;
        const input = {
          organizationId: other,
          domain: "legacy.example",
          mailboxes: "info support",
          mailboxLimit: 2,
          storageGb: 5,
          providerPlan: "Existing free 5GB service",
          providerReference: "legacy-ref",
          licenseType: "LEGACY_FREE",
          status: "ACTIVE",
          managementFeeKobo: 0,
          ownershipConfirmed: true,
        };
        assert.equal((await actions.linkExistingEmailAction(input)).ok, true);
        assert.equal((await actions.linkExistingEmailAction(input)).ok, false);
        assert.equal(payCalls, before);
        const s = (
          await q("SELECT * FROM email_services WHERE domain='legacy.example'")
        )[0];
        assert.equal(s.period_price_kobo, null);
        assert.equal(s.plan_id, null);
        assert.equal(s.license_type, "LEGACY_FREE");
      },
    );
    await t.test(
      "custom prices and new public prices do not rewrite paid periods; renewal uses current reviewed price",
      async () => {
        assert.equal(
          (
            await actions.saveEmailOverrideAction(
              org,
              "starter",
              2200000,
              "Negotiated test renewal price.",
            )
          ).ok,
          true,
        );
        const plans = await service.emailPlans(org);
        assert.equal(Number(plans[0].price_kobo), 2200000);
        assert.equal(plans[0].pricing_note, "Negotiated test renewal price.");
        assert.equal(
          Number((await service.emailPlans())[0].price_kobo),
          2500000,
        );
        assert.equal(
          Number(
            (await q("SELECT * FROM email_services WHERE id=$1", [asset.id]))[0]
              .period_price_kobo,
          ),
          2500000,
        );
        await q(
          "UPDATE email_services SET renews_at=now()+interval '20 days' WHERE id=$1",
          [asset.id],
        );
        const r = await actions.orderBusinessEmailAction({
          ...request(),
          planRevision: 2,
          overrideRevision: 1,
          serviceId: asset.id,
          mailboxes: "hello@pilot.example",
        });
        assert.equal(r.ok, true, r.error);
        const renewal = (
          await q("SELECT * FROM email_orders WHERE kind='RENEW'")
        )[0];
        assert.equal(Number(renewal.amount_kobo), 2200000);
        const previous = (
          await q("SELECT renews_at FROM email_services WHERE id=$1", [
            asset.id,
          ])
        )[0].renews_at;
        payment = { ...charge(renewal), id: 900002 };
        await service.verifyEmailReference(renewal.reference);
        assert.equal(
          String(
            (
              await q("SELECT renews_at FROM email_services WHERE id=$1", [
                asset.id,
              ])
            )[0].renews_at,
          ),
          String(previous),
        );
      },
    );
    await t.test(
      "tenant and role isolation protects mailboxes, support, pricing and admin data",
      async () => {
        const workspace = await actions.emailWorkspaceAction();
        assert.equal(workspace.ok, true);
        assert.equal(workspace.data.services.length, 1);
        assert.equal(workspace.data.services[0].provider_plan, undefined);
        assert.equal(workspace.data.services[0].provider_reference, undefined);
        assert.equal(
          (
            await actions.requestEmailHelpAction(
              asset.id,
              "PASSWORD_RESET",
              "Please send secure password reset assistance.",
            )
          ).ok,
          true,
        );
        assert.equal(
          (
            await actions.requestEmailHelpAction(
              (
                await q(
                  "SELECT id FROM email_services WHERE domain='legacy.example'",
                )
              )[0].id,
              "SUPPORT",
              "Cross tenant request",
            )
          ).ok,
          false,
        );
        role = "editor";
        assert.equal((await actions.adminEmailAction()).ok, false);
        assert.equal(
          (
            await actions.saveEmailOverrideAction(
              org,
              "starter",
              1,
              "Unauthorized price",
            )
          ).ok,
          false,
        );
        role = "owner";
      },
    );
    await t.test(
      "badge activation, expiration, scheduling, revision conflicts and history stay independent of feature availability",
      async () => {
        assert.ok(
          (await q("SELECT * FROM feature_registry")).every(
            (f) => f.is_new === false,
          ),
        );
        const f = (
          await q("SELECT * FROM feature_registry WHERE slug='business-email'")
        )[0];
        role = "editor";
        assert.equal(
          (
            await features.saveFeatureBadgeAction({
              slug: f.slug,
              revision: 1,
              isNew: true,
              startsAt: "",
              endsAt: "",
            })
          ).ok,
          true,
        );
        assert.equal(
          (
            await features.saveFeatureBadgeAction({
              slug: f.slug,
              revision: 1,
              isNew: false,
              startsAt: "",
              endsAt: "",
            })
          ).ok,
          false,
        );
        const visible = async () =>
          (
            await q(
              "SELECT is_new AND(starts_at IS NULL OR starts_at<=now())AND(ends_at IS NULL OR ends_at>now()) AS visible FROM feature_registry WHERE slug='business-email'",
            )
          )[0].visible;
        assert.equal(await visible(), true);
        assert.equal(
          (
            await features.saveFeatureBadgeAction({
              slug: f.slug,
              revision: 2,
              isNew: true,
              startsAt: "",
              endsAt: "2020-01-01T00:00",
            })
          ).ok,
          true,
        );
        assert.equal(await visible(), false);
        assert.equal(
          (
            await features.saveFeatureBadgeAction({
              slug: f.slug,
              revision: 3,
              isNew: false,
              startsAt: "",
              endsAt: "",
            })
          ).ok,
          true,
        );
        assert.equal(await visible(), false);
        assert.equal(
          (
            await q(
              "SELECT * FROM feature_badge_audit WHERE feature_slug='business-email'",
            )
          ).length,
          3,
        );
        assert.equal(
          (await q("SELECT enabled FROM email_plans WHERE id='starter'"))[0]
            .enabled,
          true,
        );
        role = "analyst";
        await assert.rejects(() => features.featureAdminAction());
        role = "owner";
      },
    );
    await t.test(
      "confirmed mailbox changes are revision-safe, respect limits and can record removal of the last mailbox",
      async () => {
        const current = (
          await q("SELECT * FROM email_services WHERE id=$1", [asset.id])
        )[0];
        assert.equal(
          (
            await actions.recordEmailMailboxesAction(
              asset.id,
              Number(current.revision),
              "sales support",
              "Provider confirmed action.",
            )
          ).ok,
          false,
        );
        assert.equal(
          (
            await actions.recordEmailMailboxesAction(
              asset.id,
              Number(current.revision),
              "sales",
              "Provider confirmed mailbox replacement.",
            )
          ).ok,
          true,
        );
        assert.equal(
          (
            await actions.recordEmailMailboxesAction(
              asset.id,
              Number(current.revision),
              "another",
              "Stale edit should fail.",
            )
          ).ok,
          false,
        );
        const rows = await q(
          "SELECT address FROM email_mailboxes WHERE service_id=$1 AND status='ALLOCATED'",
          [asset.id],
        );
        assert.deepEqual(
          rows.map((r) => r.address),
          ["sales@pilot.example"],
        );
        const updated = (
          await q("SELECT revision FROM email_services WHERE id=$1", [asset.id])
        )[0];
        assert.equal(
          (
            await actions.recordEmailMailboxesAction(
              asset.id,
              Number(updated.revision),
              "",
              "Provider confirmed removal; no automatic billing change.",
            )
          ).ok,
          true,
        );
        assert.equal(
          (
            await q(
              "SELECT * FROM email_mailboxes WHERE service_id=$1 AND status='ALLOCATED'",
              [asset.id],
            )
          ).length,
          0,
        );
      },
    );
    await t.test(
      "late cancelled payments enter review and actual email webhooks retry before any legacy receipt gate",
      async () => {
        await q("DELETE FROM domain_rate_limits");
        const input = {
          ...request(),
          domain: "late.example",
          planRevision: 2,
          overrideRevision: 1,
        };
        assert.equal((await actions.orderBusinessEmailAction(input)).ok, true);
        const first = (
          await q("SELECT * FROM email_orders WHERE domain='late.example'")
        )[0];
        payment = { reference: first.reference, status: "abandoned" };
        assert.equal((await actions.cancelEmailOrderAction(first.id)).ok, true);
        assert.equal((await actions.orderBusinessEmailAction(input)).ok, true);
        const second = (
          await q(
            "SELECT * FROM email_orders WHERE domain='late.example' AND status='PENDING_PAYMENT'",
          )
        )[0];
        payment = { ...charge(first), id: 900003 };
        await service.verifyEmailReference(first.reference);
        assert.equal(
          (
            await q("SELECT status FROM email_orders WHERE id=$1", [first.id])
          )[0].status,
          "PAYMENT_REVIEW",
        );
        assert.equal(
          (await q("SELECT * FROM email_services WHERE domain='late.example'"))
            .length,
          0,
        );
        let legacy = 0;
        const route = load("../src/app/api/webhooks/paystack/route.ts", {
          "next/server": {
            NextResponse: { json: (b, o) => Response.json(b, o) },
          },
          "@/lib/business-email/service": service,
          "@/lib/domains/service": { handleDomainEvent: async () => false },
          "@/lib/custom/service": { handleCustomEvent: async () => false },
          "@/lib/website-billing-webhooks": {
            handleWebsiteBillingEvent: async () => {
              legacy++;
              return false;
            },
          },
          "@/lib/db/organizations": {},
          "@/lib/paystack": {
            verifyWebhookSignature: (_b, s) => s === "valid",
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
        const req = (sig = "valid") =>
          new Request("https://business.jktl.com.ng/api/webhooks/paystack", {
            method: "POST",
            headers: { "x-paystack-signature": sig },
            body: JSON.stringify({
              event: "charge.success",
              data: { reference: second.reference },
            }),
          });
        payment = { ...charge(second), id: 900004 };
        assert.equal((await route.POST(req("bad"))).status, 401);
        providerError = true;
        assert.equal((await route.POST(req())).status, 503);
        providerError = false;
        assert.equal((await route.POST(req())).status, 200);
        assert.equal((await route.POST(req())).status, 200);
        assert.equal(legacy, 0);
        assert.equal(
          (await q("SELECT * FROM email_services WHERE domain='late.example'"))
            .length,
          1,
        );
      },
    );
    await t.test(
      "custom quotes remain unpriced publicly while an approved organization can review its own purchase price",
      async () => {
        const custom = (
          await q("SELECT * FROM email_plans WHERE id='custom'")
        )[0];
        assert.equal(
          (
            await actions.saveEmailPlanAction({
              ...custom,
              purchasable: true,
              procurement_cost_kobo: 5000000,
              resale_confirmed: true,
              paid_license_confirmed: true,
              features_confirmed: true,
            })
          ).ok,
          true,
        );
        assert.equal(
          (
            await actions.saveEmailOverrideAction(
              org,
              "custom",
              15000000,
              "Agreed 10 mailboxes, licensed storage and setup.",
            )
          ).ok,
          true,
        );
        const pub = (await service.emailPlans()).find((p) => p.id === "custom");
        assert.equal(pub.price_kobo, null);
        assert.equal(pub.checkout_available, false);
        const own = (await service.emailPlans(org)).find(
          (p) => p.id === "custom",
        );
        assert.equal(Number(own.price_kobo), 15000000);
        assert.equal(own.checkout_available, true);
        const different = (await service.emailPlans(other)).find(
          (p) => p.id === "custom",
        );
        assert.equal(different.checkout_available, false);
      },
    );
  } finally {
    await db.close();
  }
});
test("partner accounts share programme auth, remain pending until negotiated terms, and cannot approve themselves", async () => {
  const db = new PGlite(),
    q = async (s, a = []) => (await db.query(s, a)).rows;
  await db.exec(
    `CREATE TABLE affiliates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text,email text UNIQUE,password_hash text,referral_code text UNIQUE,commission_bps int,status text,application_note text,programme text,commission_model text,signup_bonus_kobo bigint,subscription_bonus_kobo bigint,recurring_monthly_kobo bigint,recurring_months_cap int,partner_terms_confirmed boolean DEFAULT false,partner_agreement text DEFAULT '');CREATE TABLE domain_rate_limits(bucket text PRIMARY KEY,hits integer,expires_at timestamptz);`,
  );
  const rate = load("../src/lib/domains/store.ts", {
    "./model": load("../src/lib/domains/model.ts", {}),
  }).rateLimit;
  let role = "owner",
    sessions = 0;
  const bcrypt = require("bcryptjs");
  const actions = load("../src/lib/actions/partner-actions.ts", {
    "next/headers": {
      headers: async () => new Headers({ "x-forwarded-for": "192.0.2.10" }),
    },
    "@/lib/db/auth": { hashPassword: (p) => bcrypt.hash(p, 4) },
    "@/lib/db/affiliate-auth": {
      verifyAffiliateLogin: async (email, password) => {
        const row = (
          await q("SELECT * FROM affiliates WHERE email=$1", [email])
        )[0];
        if (!row) return { ok: false, reason: "not_found" };
        if (row.status !== "active") return { ok: false, reason: row.status };
        return (await bcrypt.compare(password, row.password_hash))
          ? { ok: true, affiliate: row }
          : { ok: false, reason: "wrong_password" };
      },
    },
    "@/lib/affiliate-session": {
      startAffiliateSession: async () => {
        sessions++;
      },
    },
    "@/lib/admin-session": {
      requireAdminCapability: async (c) => {
        if (!can(role, c)) throw Error("Forbidden");
        return { id: admin };
      },
    },
    "@/lib/actions/admin-actions": {
      approveAffiliateApplicationAction: async (id) => {
        const r = await q(
          "UPDATE affiliates SET status='active' WHERE id=$1 AND status='pending' AND partner_terms_confirmed RETURNING id",
          [id],
        );
        return { ok: r.length === 1 };
      },
    },
    "@/lib/custom/service": { query: q },
    "@/lib/domains/store": { rateLimit: rate },
  });
  try {
    const input = {
      name: "Partner Owner",
      email: "partner@example.test",
      password: "long-secure-partner-password",
      company: "Example Agency",
      specialism: "Business consultant",
      clients: 20,
      message: "We help businesses register and launch online.",
      consent: true,
    };
    assert.equal((await actions.applyPartnerAction(input)).ok, true);
    const row = (await q("SELECT * FROM affiliates"))[0];
    assert.equal(row.programme, "partner");
    assert.equal(row.status, "pending");
    assert.notEqual(row.password_hash, input.password);
    assert.equal(Number(row.commission_bps), 0);
    assert.equal((await actions.applyPartnerAction(input)).ok, false);
    assert.equal(
      (await actions.partnerLoginAction(input.email, input.password)).ok,
      false,
    );
    assert.equal(sessions, 0);
    role = "analyst";
    assert.equal(
      (
        await actions.approvePartnerAction(
          row.id,
          1000,
          "Agreed 10% on qualifying website payments.",
        )
      ).ok,
      false,
    );
    role = "owner";
    assert.equal(
      (await actions.approvePartnerAction(row.id, 1000, "short")).ok,
      false,
    );
    assert.equal(
      (
        await actions.approvePartnerAction(
          row.id,
          1000,
          "Agreed 10% on qualifying website payments.",
        )
      ).ok,
      true,
    );
    assert.equal(
      (await actions.partnerLoginAction(input.email, input.password)).ok,
      true,
    );
    assert.equal(sessions, 1);
    assert.equal(
      (
        await actions.approvePartnerAction(
          row.id,
          5000,
          "Duplicate approval should not change rates.",
        )
      ).ok,
      false,
    );
    assert.equal(
      Number(
        (await q("SELECT commission_bps FROM affiliates"))[0].commission_bps,
      ),
      1000,
    );
    await q("UPDATE affiliates SET status='suspended'");
    assert.equal(
      (await actions.partnerLoginAction(input.email, input.password)).ok,
      false,
    );
  } finally {
    await db.close();
  }
});
test("email reminders queue once at 30/14/7/0 days and retry email failures without touching mailbox status", async () => {
  const db = new PGlite(),
    q = async (s, a = []) => (await db.query(s, a)).rows;
  await db.exec(
    `CREATE TABLE email_services(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid,domain text,renews_at timestamptz,status text,plan_id text);CREATE TABLE email_plans(id text,reminder_days jsonb);CREATE TABLE organization_members(organization_id uuid,email text,role text,active boolean,created_at timestamptz DEFAULT now());CREATE TABLE email_outbox(id bigserial PRIMARY KEY,event_key text UNIQUE,organization_id uuid,subject text,detail text,sent_at timestamptz,lease_until timestamptz,attempts int DEFAULT 0);INSERT INTO organization_members(organization_id,email,role,active)VALUES('${org}','owner@example.test','owner',true);`,
  );
  for (const d of [30, 14, 7, 0, 2])
    await q(
      "INSERT INTO email_services(organization_id,domain,renews_at,status) VALUES($1,$2,now()+($3::int*interval '1 day'),'ACTIVE')",
      [org, `reminder${d}.example`, d],
    );
  let success = false,
    sends = [];
  const n = load("../src/lib/business-email/notifications.ts", {
    "server-only": {},
    "./service": { query: q },
    "@/lib/email": {
      sendCustomNoticeEmail: async (p) => {
        sends.push(p);
        return { ok: success };
      },
    },
  });
  try {
    assert.deepEqual(await n.runEmailMaintenance(), { sent: 0, failed: 4 });
    assert.deepEqual(await n.runEmailMaintenance(), { sent: 0, failed: 0 });
    await q("UPDATE email_outbox SET lease_until=now()-interval '1 second'");
    success = true;
    assert.deepEqual(await n.runEmailMaintenance(), { sent: 4, failed: 0 });
    assert.deepEqual(await n.runEmailMaintenance(), { sent: 0, failed: 0 });
    assert.equal(new Set(sends.map((s) => s.key)).size, 4);
    assert.ok(sends.every((s) => s.path === "/business/email"));
    assert.ok(
      (await q("SELECT status FROM email_services")).every(
        (s) => s.status === "ACTIVE",
      ),
    );
  } finally {
    await db.close();
  }
});
test("email selection survives signup/onboarding without accepting an arbitrary redirect", async () => {
  const { emailIntent, emailDestination } =
    await import("../src/lib/product-intent.ts");
  const p = new URLSearchParams("next=email&emailPlan=team");
  assert.equal(emailIntent(p), "?next=email&emailPlan=team");
  assert.equal(
    emailDestination(new URLSearchParams(emailIntent(p))),
    "/business/email?plan=team",
  );
  assert.equal(
    emailDestination(new URLSearchParams("next=https://evil.test")),
    null,
  );
  assert.equal(
    emailDestination(new URLSearchParams("next=email&emailPlan=../../admin")),
    "/business/email",
  );
});
test("legacy partner enquiries are private, consent-scoped and imported pending without copying or emailing a password", async () => {
  const db = new PGlite(),
    q = async (s, a = []) => (await db.query(s, a)).rows;
  await db.exec(
    `CREATE TABLE affiliates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text,email text UNIQUE,password_hash text,referral_code text UNIQUE,commission_bps int,status text,application_note text,programme text,commission_model text,signup_bonus_kobo bigint,subscription_bonus_kobo bigint,recurring_monthly_kobo bigint,recurring_months_cap int,partner_source_id text UNIQUE);`,
  );
  const oldFetch = globalThis.fetch,
    oldKey = process.env.JKTL_PARTNER_BRIDGE_SECRET;
  let role = "analyst",
    calls = 0;
  process.env.JKTL_PARTNER_BRIDGE_SECRET =
    "test-bridge-secret-that-is-not-used-in-production";
  const item = {
    id: "42",
    name: "Earlier Applicant",
    email: "earlier@example.test",
    business_name: "Example Agency",
    message: "Consented partner application.",
  };
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url, "https://jktl.com.ng/api/internal/partner-applications");
    assert.equal(options.redirect, "error");
    assert.equal(options.cache, "no-store");
    assert.equal(
      options.headers.Authorization,
      "Bearer " + process.env.JKTL_PARTNER_BRIDGE_SECRET,
    );
    return Response.json({ applications: [item] });
  };
  const a = load("../src/lib/actions/legacy-partner-actions.ts", {
    "@/lib/admin-session": {
      requireAdminCapability: async (c) => {
        if (!can(role, c)) throw Error("Denied");
      },
    },
    "@/lib/db/auth": { hashPassword: async (p) => "hashed-" + p },
    "@/lib/custom/service": { query: q },
  });
  try {
    await assert.rejects(() => a.legacyPartnerApplicationsAction());
    assert.equal(calls, 0);
    role = "owner";
    assert.equal(
      (await a.legacyPartnerApplicationsAction()).applications.length,
      1,
    );
    assert.equal(
      (await a.importLegacyPartnerAction("not-in-source")).ok,
      false,
    );
    assert.equal((await a.importLegacyPartnerAction("42")).ok, true);
    const row = (await q("SELECT * FROM affiliates"))[0];
    assert.equal(row.status, "pending");
    assert.equal(row.programme, "partner");
    assert.equal(row.partner_source_id, "42");
    assert.equal(row.password_hash.startsWith("hashed-"), true);
    assert.equal(Number(row.commission_bps), 0);
    assert.equal((await a.importLegacyPartnerAction("42")).ok, false);
    assert.equal((await q("SELECT * FROM affiliates")).length, 1);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.JKTL_PARTNER_BRIDGE_SECRET;
    else process.env.JKTL_PARTNER_BRIDGE_SECRET = oldKey;
    await db.close();
  }
});
test(
  "Main partner inquiry bridge rejects missing/wrong credentials before reading private applications",
  {
    skip: !existsSync(
      new URL(
        "../../jktl-main/app/api/internal/partner-applications/route.ts",
        import.meta.url,
      ),
    ),
  },
  async () => {
    const old = process.env.JKTL_PARTNER_BRIDGE_SECRET;
    const key = "test-bridge-secret-that-is-not-used-in-production";
    let reads = 0;
    const route = load(
      "../../jktl-main/app/api/internal/partner-applications/route.ts",
      {
        "next/server": {
          NextResponse: { json: (b, o) => Response.json(b, o) },
        },
        "@/lib/db": {
          sql: async (strings) => {
            reads++;
            assert.ok(strings.join("").includes("meta->>'consent'='true'"));
            return [{ id: "42", name: "Earlier Applicant" }];
          },
        },
      },
    );
    try {
      delete process.env.JKTL_PARTNER_BRIDGE_SECRET;
      assert.equal(
        (
          await route.GET(
            new Request(
              "https://jktl.com.ng/api/internal/partner-applications",
            ),
          )
        ).status,
        503,
      );
      process.env.JKTL_PARTNER_BRIDGE_SECRET = key;
      assert.equal(
        (
          await route.GET(
            new Request(
              "https://jktl.com.ng/api/internal/partner-applications",
              {
                headers: { Authorization: "Bearer wrong" },
              },
            ),
          )
        ).status,
        401,
      );
      assert.equal(reads, 0);
      const r = await route.GET(
        new Request("https://jktl.com.ng/api/internal/partner-applications", {
          headers: { Authorization: "Bearer " + key },
        }),
      );
      assert.equal(r.status, 200);
      assert.equal(r.headers.get("cache-control"), "no-store");
      assert.equal(reads, 1);
      assert.equal(JSON.stringify(await r.json()).includes(key), false);
    } finally {
      if (old === undefined) delete process.env.JKTL_PARTNER_BRIDGE_SECRET;
      else process.env.JKTL_PARTNER_BRIDGE_SECRET = old;
    }
  },
);
