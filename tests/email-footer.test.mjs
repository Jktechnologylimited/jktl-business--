// Provider responses and addresses are fixtures. No SMTP/Resend/Gmail send occurs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import * as addresses from "../src/lib/mail/addresses.ts";
import * as defaults from "../src/lib/mail/promotion-defaults.ts";
import { invitationExpiry } from "../src/lib/mail/invitation-date.ts";
import * as permissions from "../src/lib/admin-permissions.ts";
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
      if (!(n in deps)) throw Error("Missing " + n);
      return deps[n];
    },
    m,
    m.exports,
  );
  return m.exports;
}
const layout = load("../src/lib/mail/layout.ts", { "./addresses": addresses });
const promotions = load("../src/lib/mail/promotions.ts", {
  "server-only": {},
  "./promotion-defaults": defaults,
});
const preview = load("../src/lib/mail/preview.ts", {
  "./layout": layout,
  "@/lib/admin-permissions": permissions,
});
const form = (data) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(data)) f.set(k, String(v));
  return f;
};
async function fixture() {
  const db = new PGlite();
  for (const f of readdirSync(new URL("../migrations/", import.meta.url))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(
      readFileSync(
        new URL("../migrations/" + f, import.meta.url),
        "utf8",
      ).replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/g, ""),
    );
  const q = async (sql, params = []) => (await db.query(sql, params)).rows;
  const owner = (
    await q(
      "INSERT INTO admin_users(name,email,password_hash,role) VALUES('Owner','owner@example.test','unusable','owner') RETURNING *",
    )
  )[0];
  await q(
    "UPDATE email_branding SET settings=jsonb_build_object('postalAddress','Company-provided test office')",
  );
  await q(
    "INSERT INTO email_preferences(email,marketing_opt_in) VALUES('footer@example.test',true)",
  );
  let role = "owner";
  const actions = load("../src/lib/actions/mail-admin-actions.ts", {
    "@/lib/admin-session": {
      requireAdminCapability: async (cap) => {
        if (!permissions.can(role, cap)) throw Error("Denied");
        return owner;
      },
    },
    "@/lib/custom/service": { query: q },
    "@/lib/mail/addresses": addresses,
    "@/lib/mail/layout": layout,
    "@/lib/mail/promotions": promotions,
    "@/lib/mail/promotion-defaults": defaults,
    "@/lib/mail/preview": preview,
    "@/lib/support/service": { rate: async () => {} },
    "@/lib/email": { sendMailPreview: async () => ({ ok: true }) },
    "next/cache": { revalidatePath: () => {} },
  });
  const service = load("../src/lib/mail/service.ts", {
    "server-only": {},
    "@/lib/custom/service": { query: q },
    "./layout": layout,
    "./addresses": addresses,
    "./promotions": promotions,
  });
  return {
    db,
    q,
    owner,
    actions,
    service,
    role: (value) => {
      role = value;
    },
    render: () =>
      service.brandEmail(
        "footer@example.test",
        "Invitation",
        "<p>Message</p>",
        "Message",
        { category: "invitation" },
      ),
  };
}

test("expiry is readable and correct in WAT, including UTC date rollover", () => {
  assert.equal(
    invitationExpiry("2026-10-30T20:09:57.000Z"),
    "Your invitation expires on 30 October 2026 at 9:09 PM (WAT).",
  );
  assert.equal(
    invitationExpiry("2026-10-30T23:30:00Z"),
    "Your invitation expires on 31 October 2026 at 12:30 AM (WAT).",
  );
  assert.throws(() => invitationExpiry("invalid"));
});
test("the final provider payload includes one shared invitation footer and readable date; reset payloads never include promotions", async () => {
  const f = await fixture();
  const old = process.env.RESEND_API_KEY;
  try {
    const payloads = [];
    class Resend {
      emails = {
        send: async (payload) => {
          payloads.push(payload);
          return {
            data: { id: "SYNTHETIC-ID-" + payloads.length },
            error: null,
          };
        },
      };
    }
    const email = load("../src/lib/email.ts", {
      resend: { Resend },
      "@/lib/mail/service": f.service,
      "@/lib/mail/layout": layout,
      "@/lib/mail/addresses": addresses,
      "@/lib/mail/history": { recordMailAttempt: async () => {} },
      "@/lib/mail/provider-outcome": { uncertainProviderRejection: () => true },
      "@/lib/mail/invitation-date": { invitationExpiry },
      "@/lib/format": {
        formatKobo: String,
        formatShortDate: String,
        formatTime: String,
      },
    });
    process.env.RESEND_API_KEY = "synthetic-key";
    await email.sendRoleInvitationEmail({
      to: "footer@example.test",
      name: "Test Recipient",
      role: "Writer",
      message: "Welcome to the team.",
      url: "https://business.jktl.com.ng/admin/invitation?token=FIXTURE-ONLY",
      expiresAt: "2026-10-30T20:09:57.000Z",
      key: "test-role-invitation",
      editorial: true,
    });
    const invitation = payloads[0];
    assert.equal(invitation.to, "footer@example.test");
    assert.equal(
      (invitation.html.match(/Explore More from JKTL/g) || []).length,
      1,
    );
    assert.equal(
      (invitation.text.match(/Explore More from JKTL/g) || []).length,
      1,
    );
    for (const url of [
      "https://jktl.com.ng/templates",
      "https://jktl.com.ng/domains",
      "https://jktl.com.ng/products/business-email",
    ]) {
      assert.ok(invitation.html.includes('href="' + url + '"'));
      assert.ok(invitation.text.includes(url));
    }
    assert.match(invitation.html, /30 October 2026 at 9:09 PM \(WAT\)/);
    assert.doesNotMatch(invitation.html, /2026-10-30T20:09:57/);
    assert.ok(
      invitation.html.indexOf("The JKTL Team") <
        invitation.html.indexOf("Explore More"),
    );
    assert.ok(
      invitation.html.indexOf("Explore More") <
        invitation.html.indexOf("Contact JKTL support"),
    );
    assert.match(invitation.html, /max-width:600px/);
    assert.match(invitation.html, /role="presentation"/);
    assert.match(invitation.html, /#060e2a/);
    assert.match(invitation.html, /#c9a84c/);
    assert.match(invitation.html, /#eee9da/);
    writeFileSync("/tmp/jktl-invitation-footer-provider.html", invitation.html);
    writeFileSync("/tmp/jktl-invitation-footer-provider.txt", invitation.text);
    await email.sendWelcomeEmail(
      "footer@example.test",
      "Test Recipient",
      "Example",
    );
    assert.match(payloads.at(-1).html, /Explore More from JKTL/);
    await email.sendPartnerNoticeEmail({
      to: "footer@example.test",
      subject: "Affiliate invitation fixture",
      detail: "Review your invitation.",
      path: "/affiliates/invitation?token=FIXTURE",
      key: "affiliate-fixture",
      category: "invitation",
      replyCategory: "affiliate",
    });
    assert.match(payloads.at(-1).html, /Explore More from JKTL/);
    await email.sendPasswordResetEmail({
      to: "footer@example.test",
      name: "Test Recipient",
      resetUrl: "https://business.jktl.com.ng/reset-password?token=FIXTURE",
    });
    assert.doesNotMatch(payloads.at(-1).html, /Explore More from JKTL/);
    assert.doesNotMatch(payloads.at(-1).text, /Explore More from JKTL/);
    const rows = await promotions.listPromotions(f.q);
    assert.equal(rows.length, 5);
    assert.deepEqual(
      rows.map((r) => r.title),
      defaults.DEFAULT_PROMOTIONS.map((r) => r.title),
    );
    assert.ok(
      (await f.q("SELECT promotions_initialized_at FROM email_branding"))[0]
        .promotions_initialized_at,
    );
  } finally {
    if (old === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = old;
    await f.db.close();
  }
});
test("existing footer CRUD, disabled items, ordering, unsaved previews and intentional empty lists persist across migration replay", async () => {
  const f = await fixture();
  try {
    await f.actions.footerManagerDataAction();
    await f.actions.saveMailPromotionAction(
      form({
        title: "Custom business guide",
        description: "Original guide description.",
        url: "https://jktl.com.ng/partners?guide=custom",
        enabled: "on",
        priority: 0,
      }),
    );
    let data = await f.actions.footerManagerDataAction(),
      item = data.items.find((i) => i.title === "Custom business guide");
    assert.equal(data.items[0].id, item.id);
    assert.match((await f.render()).html, /Custom business guide/);
    await f.actions.saveMailPromotionAction(
      form({
        id: item.id,
        revision: item.revision,
        title: item.title,
        description: "Updated guide description.",
        url: item.url,
        enabled: "on",
      }),
    );
    data = await f.actions.footerManagerDataAction();
    item = data.items.find((i) => i.id === item.id);
    assert.equal(item.priority, 0);
    assert.match((await f.render()).html, /Updated guide description/);
    await f.actions.setMailPromotionEnabledAction(
      form({ id: item.id, revision: item.revision, enabled: "off" }),
    );
    assert.doesNotMatch((await f.render()).html, /Custom business guide/);
    data = await f.actions.footerManagerDataAction();
    item = data.items.find((i) => i.id === item.id);
    await f.actions.setMailPromotionEnabledAction(
      form({ id: item.id, revision: item.revision, enabled: "on" }),
    );
    data = await f.actions.footerManagerDataAction();
    item = data.items.find((i) => i.id === item.id);
    await f.actions.reorderMailPromotionAction(
      form({ id: item.id, revision: item.revision, direction: "DOWN" }),
    );
    data = await f.actions.footerManagerDataAction();
    assert.equal(data.items[1].id, item.id);
    const sample = await f.actions.previewFooterDraftAction({
      sample: "invite-writer",
      enabled: true,
      max: 4,
      candidate: {
        id: item.id,
        title: "Unsaved preview guide",
        description: "Unsaved description.",
        url: item.url,
        enabled: true,
      },
    });
    assert.match(sample.html, /Unsaved preview guide/);
    assert.doesNotMatch((await f.render()).html, /Unsaved preview guide/);
    const security = await f.actions.previewFooterDraftAction({
      sample: "security",
      enabled: true,
      max: 4,
    });
    assert.doesNotMatch(security.html, /Explore More from JKTL/);
    await f.actions.saveFooterSettingsAction(
      form({ revision: data.revision, enabled: "", maxPromotions: 4 }),
    );
    assert.doesNotMatch((await f.render()).html, /Explore More from JKTL/);
    data = await f.actions.footerManagerDataAction();
    await f.actions.saveFooterSettingsAction(
      form({ revision: data.revision, enabled: "on", maxPromotions: 4 }),
    );
    assert.equal(
      ((await f.render()).text.match(/https:\/\/jktl.com.ng\//g) || [])
        .length >= 4,
      true,
    );
    data = await f.actions.footerManagerDataAction();
    await assert.rejects(
      f.actions.deleteMailPromotionAction(
        form({ id: data.items[0].id, revision: data.items[0].revision }),
      ),
      /Confirm/,
    );
    for (const row of data.items)
      await f.actions.deleteMailPromotionAction(
        form({ id: row.id, revision: row.revision, confirm: "on" }),
      );
    assert.equal((await f.actions.footerManagerDataAction()).items.length, 0);
    for (const name of [
      "049_email_branding.sql",
      "061_email_promotional_footer.sql",
    ])
      await f.db.exec(
        readFileSync(new URL("../migrations/" + name, import.meta.url), "utf8"),
      );
    assert.equal((await promotions.listPromotions(f.q)).length, 0);
    assert.doesNotMatch((await f.render()).html, /Explore More from JKTL/);
    // Even deliberate physical deletion cannot cause the legacy seed migration to
    // resurrect the catalogue after initialization has been recorded.
    await f.q("DELETE FROM email_promotions");
    await f.db.exec(
      readFileSync(
        new URL("../migrations/049_email_branding.sql", import.meta.url),
        "utf8",
      ),
    );
    assert.equal((await promotions.listPromotions(f.q)).length, 0);
    f.role("analyst");
    for (const call of [
      () => f.actions.footerManagerDataAction(),
      () =>
        f.actions.saveFooterSettingsAction(
          form({ enabled: "on", maxPromotions: 3 }),
        ),
      () => f.actions.deleteMailPromotionAction(form({ confirm: "on" })),
      () => f.actions.reorderMailPromotionAction(form({ direction: "UP" })),
      () =>
        f.actions.previewFooterDraftAction({
          sample: "invite-writer",
          enabled: true,
          max: 3,
        }),
    ])
      await assert.rejects(call(), /Denied/);
  } finally {
    await f.db.close();
  }
});
test("default initialization respects an explicit global disable and an intentional empty catalogue; consent is never invented", async () => {
  const f = await fixture();
  try {
    await f.q("DELETE FROM email_promotions");
    await f.q(
      "UPDATE email_branding SET settings=jsonb_set(settings,'{promotionsEnabled}','false'::jsonb)",
    );
    assert.equal((await promotions.listPromotions(f.q)).length, 0);
    assert.doesNotMatch((await f.render()).html, /Explore More from JKTL/);
    await f.q(
      "UPDATE email_preferences SET marketing_opt_in=false WHERE email='footer@example.test'",
    );
    const result = await f.render();
    assert.equal(result.permitted, true);
    assert.doesNotMatch(result.html, /Explore More from JKTL/);
    const b = layout.brandingSettings({
      postalAddress: "Configured office",
      promotionsEnabled: false,
    });
    assert.doesNotMatch(
      layout.mailLayout({
        title: "Body",
        bodyHtml: "<p>Body</p>",
        text: "Body",
        category: "invitation",
        branding: b,
        promotions: defaults.DEFAULT_PROMOTIONS,
      }).html,
      /Explore More from JKTL/,
    );
  } finally {
    await f.db.close();
  }
});
