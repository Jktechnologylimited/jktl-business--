import * as promotionDefaults from "../src/lib/mail/promotion-defaults.ts";
import { invitationExpiry } from "../src/lib/mail/invitation-date.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import { applyMigrationBatch } from "../scripts/sql-statements.mjs";
import { uncertainProviderRejection } from "../src/lib/mail/provider-outcome.ts";
import * as permissions from "../src/lib/admin-permissions.ts";
import * as addresses from "../src/lib/mail/addresses.ts";
const promotions = load("../src/lib/mail/promotions.ts", {
  "server-only": {},
  "./promotion-defaults": promotionDefaults,
});
const layout = load("../src/lib/mail/layout.ts", { "./addresses": addresses });
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
      if (!(n in deps)) throw Error("Missing dependency " + n);
      return deps[n];
    },
    m,
    m.exports,
  );
  return m.exports;
}
test("layout escapes configurable content, forbids security promotions, caps and filters relevant products", () => {
  const b = layout.brandingSettings({
    companyName: "JKTL <script>alert(1)</script>",
    postalAddress: "Real configured office",
    socialLinks: [{ label: "Social", url: "javascript:alert(1)" }],
    maxPromotions: 999,
    headerColor: "#ffffff",
  });
  assert.equal(b.maxPromotions, 4);
  assert.equal(b.headerColor, "#060e2a");
  assert.equal(b.socialLinks.length, 0);
  const promos = ["domains", "business-email", "templates", "plans"].map(
    (productId, i) => ({
      id: String(i),
      title: productId,
      description: "Safe text",
      url: [
        "https://jktl.com.ng/domains",
        "https://jktl.com.ng/products/business-email",
        "https://jktl.com.ng/templates",
        "https://jktl.com.ng/pricing",
      ][i],
      productId,
      priority: i,
      categories: ["security", "website", "support"],
      enabled: true,
    }),
  );
  assert.equal(
    layout.selectPromotions(promos, b, "security", { consented: true }).length,
    0,
  );
  assert.equal(layout.selectPromotions(promos, b, "website", {}).length, 4);
  assert.equal(
    layout.selectPromotions(promos, b, "support", { consented: true }).length,
    4,
  );
  assert.equal(
    layout.selectPromotions(promos, b, "website", { consented: true }).length,
    4,
  );
  assert.deepEqual(
    layout
      .selectPromotions(promos, b, "website", {
        consented: true,
        ownedProducts: ["domains", "templates"],
      })
      .map((p) => p.productId),
    ["business-email", "plans"],
  );
  const rendered = layout.mailLayout({
    title: "Reset password",
    bodyHtml: "<p>Essential security content</p>",
    text: "Essential security content",
    category: "security",
    branding: b,
    promotions: promos,
  });
  assert.ok(rendered.html.includes("JKTL logo"));
  assert.ok(!rendered.html.includes("<script>"));
  assert.ok(!rendered.html.includes("Explore More from JKTL"));
  assert.ok(!rendered.text.includes("Explore More from JKTL"));
  assert.ok(
    rendered.html.includes("https://business.jktl.com.ng/jktl-logo.png"),
  );
  assert.equal(
    layout.httpsUrl("https://jktl.com.ng/login?token=secret", true),
    "",
  );
  assert.equal(layout.httpsUrl("https://evil.example/path", true), "");
});
test("real schema, admin configuration, opt-out, product ownership, event queues and provider deduplication", async () => {
  const db = new PGlite();
  try {
    const query = async (s, p = []) => (await db.query(s, p)).rows;
    const adapter = {
      query: (s, p) => ({ s, p }),
      transaction: async (rs) => {
        await db.exec("BEGIN");
        try {
          for (const r of rs) await db.query(r.s, r.p);
          await db.exec("COMMIT");
        } catch (e) {
          await db.exec("ROLLBACK");
          throw e;
        }
      },
    };
    for (const file of readdirSync(new URL("../migrations", import.meta.url))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await applyMigrationBatch(adapter, [
        readFileSync(
          new URL("../migrations/" + file, import.meta.url),
          "utf8",
        ).replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/g, ""),
      ]);
    await applyMigrationBatch(adapter, [
      readFileSync(
        new URL("../migrations/049_email_branding.sql", import.meta.url),
        "utf8",
      ),
    ]);
    const org = (
      await query(
        "INSERT INTO organizations(name,slug) VALUES('Preview Business','preview-business') RETURNING id",
      )
    )[0].id;
    await query(
      "INSERT INTO business_profiles(organization_id,display_name,subdomain) VALUES($1,'Preview Business','mail-preview-business')",
      [org],
    );
    await query(
      "INSERT INTO organization_members(organization_id,name,email,role) VALUES($1,'Customer','customer@example.test','owner')",
      [org],
    );
    await query(
      "UPDATE business_profiles SET published=true WHERE organization_id=$1",
      [org],
    );
    await query(
      "UPDATE business_profiles SET published=true WHERE organization_id=$1",
      [org],
    );
    assert.equal(
      (
        await query(
          "SELECT count(*)::int n FROM email_outbox WHERE category='website'",
        )
      )[0].n,
      1,
    );
    await query(
      "INSERT INTO website_plan_payments(reference,organization_id,plan_id,interval,amount_kobo,currency,paid_at,period_end,provider_transaction_id) VALUES('test-paid-email',$1,'growth','monthly',500000,'NGN',now(),now()+interval '1 month','mock-provider-proof') ON CONFLICT DO NOTHING",
      [org],
    );
    assert.equal(
      (
        await query(
          "SELECT count(*)::int n FROM email_outbox WHERE event_key='website-payment:test-paid-email'",
        )
      )[0].n,
      1,
    );
    assert.ok(
      (
        await query(
          "SELECT detail FROM email_outbox WHERE event_key='website-payment:test-paid-email'",
        )
      )[0].detail.includes("5000.00"),
    );
    const service = load("../src/lib/mail/service.ts", {
      "server-only": {},
      "@/lib/custom/service": { query },
      "./layout": layout,
      "./addresses": addresses,
      "./promotions": promotions,
    });
    let rendered = await service.brandEmail(
      "customer@example.test",
      "Service update",
      "<p>Actual update</p>",
      "Actual update",
      { category: "website" },
    );
    assert.ok(rendered.html.includes("Explore More from JKTL"));
    const cfg = layout.brandingSettings({
      postalAddress: "Actual office supplied by company",
    });
    await query("UPDATE email_branding SET settings=$1::jsonb", [
      JSON.stringify(cfg),
    ]);
    await query(
      "UPDATE email_preferences SET marketing_opt_in=true WHERE email='customer@example.test'",
    );
    rendered = await service.brandEmail(
      "customer@example.test",
      "Website update",
      "<p>Actual update</p>",
      "Actual update",
      { category: "website" },
    );
    assert.ok(rendered.html.includes("Explore More from JKTL"));
    assert.ok(rendered.html.includes("Explore More from JKTL"));
    const pref = (
      await query(
        "SELECT preference_token FROM email_preferences WHERE email='customer@example.test'",
      )
    )[0].preference_token;
    assert.ok(rendered.text.includes(String(pref)));
    await query(
      "UPDATE email_preferences SET marketing_suppressed=true WHERE email='customer@example.test'",
    );
    rendered = await service.brandEmail(
      "customer@example.test",
      "Service update",
      "<p>Actual update</p>",
      "Actual update",
      { category: "website" },
    );
    assert.ok(!rendered.html.includes("Explore More from JKTL"));
    assert.equal(
      (
        await service.brandEmail(
          "customer@example.test",
          "Marketing",
          "<p>Ad</p>",
          "Ad",
          { category: "marketing", outreachAuthorized: true },
        )
      ).permitted,
      false,
    );
    let role = "owner",
      sends = [];
    const preview = load("../src/lib/mail/preview.ts", {
      "./layout": layout,
      "@/lib/admin-permissions": permissions,
    });
    const deps = {
      "@/lib/admin-session": {
        requireAdminCapability: async (cap) => {
          if (role !== "owner") throw Error("Denied");
          return { id: "owner", email: "owner@example.test" };
        },
      },
      "@/lib/custom/service": { query },
      "@/lib/mail/layout": layout,
      "@/lib/mail/addresses": addresses,
      "@/lib/mail/preview": preview,
      "@/lib/mail/promotions": promotions,
      "@/lib/mail/promotion-defaults": promotionDefaults,
      "@/lib/support/service": { rate: async () => {} },
      "@/lib/email": {
        sendMailPreview: async (...args) => {
          sends.push(args);
          return { ok: true };
        },
      },
      "next/cache": { revalidatePath: () => {} },
    };
    const actions = load("../src/lib/actions/mail-admin-actions.ts", deps);
    role = "growth";
    await assert.rejects(actions.previewMailAction("security"));
    await assert.rejects(actions.sendTestMailAction("security"));
    role = "owner";
    const sample = await actions.previewMailAction("security");
    assert.ok(!sample.html.includes("Explore More from JKTL"));
    await actions.sendTestMailAction("payment");
    assert.equal(sends[0][0], "owner@example.test");
    assert.ok(sends[0][1].text.includes("TEST PREVIEW ONLY"));
    const promo = new FormData();
    for (const [k, v] of Object.entries({
      title: "Domain reminder",
      description: "Choose a domain for your business.",
      url: "https://evil.example/path",
      productId: "domains",
      priority: "2",
      enabled: "on",
    }))
      promo.set(k, v);
    promo.append("categories", "website");
    await assert.rejects(actions.saveMailPromotionAction(promo));
    promo.set("url", "https://jktl.com.ng/products/domains");
    await actions.saveMailPromotionAction(promo);
    promo.append("categories", "security");
    await assert.rejects(actions.saveMailPromotionAction(promo));
    const staffId = (
      await query(
        "INSERT INTO admin_users(name,email,password_hash,role) VALUES('Support Agent','support@example.test','unusable','owner') RETURNING id",
      )
    )[0].id;
    const partner = (
      await query(
        "INSERT INTO affiliates(name,email,password_hash,referral_code,programme,status,partner_terms_confirmed) VALUES('Partner','partner@example.test','unusable','MAIL-PARTNER','partner','active',true) RETURNING id",
      )
    )[0].id;
    const ticket = (
      await query(
        "INSERT INTO partner_tickets(partner_id,subject,category) VALUES($1,'Website setup question','General Assistance') RETURNING id",
        [partner],
      )
    )[0].id;
    await query(
      "INSERT INTO partner_ticket_messages(ticket_id,actor_id,kind,body) VALUES($1,$2,'STAFF','Please review your contact details.'),($1,$2,'NOTE','Private staff-only note')",
      [ticket, staffId],
    );
    const noticed = [];
    const notices = load("../src/lib/partners/notifications.ts", {
      "server-only": {},
      "web-push": {
        default: {
          setVapidDetails: () => {},
          sendNotification: async () => {},
        },
      },
      "@/lib/custom/service": { query },
      "@/lib/email": {
        sendPartnerNoticeEmail: async (p) => {
          noticed.push(p);
          return { ok: true };
        },
      },
    });
    const originalEmailKey = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = "mock-only";
    try {
      await notices.processPartnerNotices();
      assert.equal(noticed.length, 1);
      assert.equal(
        noticed[0].ticket.reply,
        "Please review your contact details.",
      );
      assert.equal(noticed[0].ticket.agent, "Support Agent");
      assert.ok(!JSON.stringify(noticed).includes("Private staff-only note"));
      assert.ok(noticed[0].path.endsWith("#ticket-" + ticket));
      await notices.processPartnerNotices();
      assert.equal(noticed.length, 1);
    } finally {
      if (originalEmailKey === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = originalEmailKey;
    }
    let delivered = [];
    class Resend {
      constructor() {}
      emails = {
        send: async (payload, options) => {
          delivered.push({ payload, options });
          return { error: null };
        },
      };
    }
    const old = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = "mock-only";
    try {
      const email = load("../src/lib/email.ts", {
        resend: { Resend },
        "@/lib/mail/service": service,
        "@/lib/mail/addresses": addresses,
        "@/lib/mail/provider-outcome": { uncertainProviderRejection },
        "@/lib/mail/invitation-date": { invitationExpiry },
        "@/lib/mail/history": { recordMailAttempt: async () => {} },
        "@/lib/mail/layout": layout,
        "@/lib/format": {
          formatKobo: (n) => "NGN " + n / 100,
          formatShortDate: (s) => s,
          formatTime: (s) => s,
        },
      });
      await email.sendPasswordResetEmail({
        to: "customer@example.test",
        name: "<img src=x>",
        resetUrl: "https://business.jktl.com.ng/reset-password?token=opaque",
      });
      assert.ok(delivered[0].payload.html.includes("&lt;img src=x&gt;"));
      assert.ok(delivered[0].payload.html.includes("token=opaque"));
      assert.ok(!delivered[0].payload.html.includes("Explore More from JKTL"));
      await email.sendDomainOrderEmail({
        to: "customer@example.test",
        domain: "example.com.ng",
        event: "Order update",
        detail: "Awaiting supplier confirmation",
        key: "existing-event-key",
      });
      assert.equal(delivered[1].options.idempotencyKey, "existing-event-key");
      assert.ok(
        delivered[1].payload.text.includes("Awaiting supplier confirmation"),
      );
      assert.ok(delivered[1].payload.html.includes("JKTL logo"));
    } finally {
      if (old === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = old;
    }
  } finally {
    await db.close();
  }
});
