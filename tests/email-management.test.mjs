// All delivery/provider responses are test fixtures. No real emails are sent.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import * as crypto from "node:crypto";
import ts from "typescript";
import bcrypt from "bcryptjs";
import { unified } from "unified";
import remarkParse from "remark-parse";
import * as addresses from "../src/lib/mail/addresses.ts";
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
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText,
  )(
    (n) => {
      if (!(n in deps)) throw Error("Missing fixture dependency " + n);
      return deps[n];
    },
    m,
    m.exports,
  );
  return m.exports;
}
const layout = load("../src/lib/mail/layout.ts", { "./addresses": addresses });
const invitations = load("../src/lib/mail/invitations.ts", {
  "server-only": {},
  "node:crypto": crypto,
  "@/lib/admin-permissions": permissions,
  "./addresses": addresses,
});
const compose = load("../src/lib/mail/compose.tsx", {
  "server-only": {},
  unified: { unified },
  "remark-parse": { __esModule: true, default: remarkParse },
  "./layout": layout,
  "@/lib/admin-permissions": permissions,
  "./addresses": addresses,
});
const delivery = load("../src/lib/mail/composed-delivery.ts", {
  "server-only": {},
  "./compose": compose,
  "./service": { currentBranding: async () => configured() },
  "@/lib/admin-permissions": permissions,
});
async function fixture() {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  for (const f of readdirSync(new URL("../migrations/", import.meta.url))
    .filter((s) => s.endsWith(".sql"))
    .sort())
    await db.exec(
      readFileSync(
        new URL("../migrations/" + f, import.meta.url),
        "utf8",
      ).replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/g, ""),
    );
  const q = async (sql, args = []) => (await db.query(sql, args)).rows;
  const owner = (
    await q(
      "INSERT INTO admin_users(name,email,password_hash,role) VALUES('Owner','owner@example.test','existing-owner-hash','owner') RETURNING *",
    )
  )[0];
  return { db, q, owner };
}
const form = (data) => {
  const f = new FormData();
  for (const [key, value] of Object.entries(data)) f.set(key, String(value));
  return f;
};
const configured = () =>
  layout.brandingSettings({
    defaultReplyTo: "info@jktl.com.ng",
    categoryReplyTo: {
      affiliate: "affiliate-help@example.test",
      partner: "partner-help@example.test",
      administration: "team-help@example.test",
      editorial: "editorial-help@example.test",
      security: "security-help@example.test",
      support: "support-help@example.test",
    },
    verifiedReplyTo: [
      "info@jktl.com.ng",
      "affiliate-help@example.test",
      "partner-help@example.test",
      "team-help@example.test",
      "editorial-help@example.test",
      "security-help@example.test",
      "support-help@example.test",
    ],
    postalAddress: "Company-provided real address",
  });

test("Reply-To is header safe, verified, category aware and independent of sender-domain authentication", () => {
  for (const value of [
    "a@example.test\r\nBcc:victim@example.test",
    "a@example.test,b@example.test",
    "Name <a@example.test>",
    "a..b@example.test",
    "a@example.test\n",
    "mailto:a@example.test",
  ])
    assert.equal(addresses.mailAddress(value), "");
  const empty = layout.brandingSettings({ defaultReplyTo: "info@jktl.com.ng" });
  assert.equal(empty.defaultReplyTo, "");
  assert.equal(addresses.deliveryHeaders(empty).replyTo, undefined);
  const b = configured();
  assert.equal(addresses.deliveryHeaders(b).replyTo, "info@jktl.com.ng");
  assert.equal(
    addresses.deliveryHeaders(b, { replyCategory: "affiliate" }).replyTo,
    "affiliate-help@example.test",
  );
  assert.equal(
    addresses.deliveryHeaders(b, { replyCategory: "editorial" }).replyTo,
    "editorial-help@example.test",
  );
  assert.equal(
    addresses.deliveryHeaders(b, { replyTo: "partner-help@example.test" })
      .replyTo,
    "partner-help@example.test",
  );
  assert.throws(
    () => addresses.deliveryHeaders(b, { replyTo: "stranger@example.test" }),
    /verified/,
  );
  assert.throws(
    () =>
      addresses.deliveryHeaders({
        ...b,
        senderEmail: "not-verified@example.test",
      }),
    /verification/,
  );
  const html = compose.composeBody(
    "**Hello** <script>bad()</script>\n\n[unsafe](javascript:alert(1))\n\n[Safe](https://jktl.com.ng)",
  );
  assert.match(html.html, /<strong>Hello<\/strong>/);
  assert.doesNotMatch(html.html, /<script|javascript:|onerror=/i);
});

test("central team invitations are hashed, single-use, expiring, revocable, and reuse existing identities", async (t) => {
  const f = await fixture();
  try {
    const create = (email, role = "writer") =>
      invitations.createTeamInvitation(f.q, f.owner.id, {
        name: "Invited Person",
        email,
        role,
        message: "Welcome to the team",
        hours: 48,
      });
    await t.test(
      "new recipient sets own password, exact expiry, no bearer secret in stored record, replay denied",
      async () => {
        const invite = await create("new-team@example.test");
        const row = (
          await f.q("SELECT * FROM editorial_invitations WHERE id=$1", [
            invite.id,
          ])
        )[0];
        assert.equal(row.token_hash, invitations.inviteHash(invite.token));
        assert.notEqual(row.token_hash, invite.token);
        assert.ok(+new Date(row.expires_at) - Date.now() > 47 * 3600000);
        assert.doesNotMatch(JSON.stringify(row), new RegExp(invite.token));
        const passwordHash = await bcrypt.hash("new-own-password-123", 4);
        const result = await invitations.acceptTeamInvitation(
          f.q,
          invite.token,
          { passwordHash },
        );
        assert.equal(result.role, "writer");
        const user = (
          await f.q("SELECT * FROM admin_users WHERE id=$1", [result.id])
        )[0];
        assert.equal(
          await bcrypt.compare("new-own-password-123", user.password_hash),
          true,
        );
        assert.equal(user.disabled_at, null);
        await assert.rejects(
          invitations.acceptTeamInvitation(f.q, invite.token, { passwordHash }),
        );
      },
    );
    await t.test(
      "existing Business identity must authenticate with matching account and retains its password",
      async () => {
        const user = (
          await f.q(
            "INSERT INTO users(name,email,password_hash) VALUES('Business User','business-role@example.test','original-business-hash') RETURNING id",
          )
        )[0];
        const wrong = (
          await f.q(
            "INSERT INTO users(name,email,password_hash) VALUES('Wrong','wrong@example.test','wrong-hash') RETURNING id",
          )
        )[0];
        const invite = await create("business-role@example.test", "support");
        await assert.rejects(
          invitations.acceptTeamInvitation(f.q, invite.token, {
            businessId: wrong.id,
            passwordHash: "do-not-use",
          }),
        );
        const granted = await invitations.acceptTeamInvitation(
          f.q,
          invite.token,
          { businessId: user.id },
        );
        assert.equal(granted.business_user_id, user.id);
        assert.equal(
          (
            await f.q("SELECT password_hash FROM users WHERE id=$1", [user.id])
          )[0].password_hash,
          "original-business-hash",
        );
        assert.equal(
          (
            await f.q(
              "SELECT count(*)::int n FROM users WHERE email='business-role@example.test'",
            )
          )[0].n,
          1,
        );
      },
    );
    await t.test(
      "a new-team token cannot attach an unrelated signed-in Business account",
      async () => {
        const wrong = (
          await f.q("SELECT id FROM users WHERE email='wrong@example.test'")
        )[0];
        const invite = await create("different-person@example.test");
        const result = await invitations.acceptTeamInvitation(
          f.q,
          invite.token,
          { businessId: wrong.id, passwordHash: "synthetic-new-team-hash" },
        );
        assert.equal(result.business_user_id, null);
      },
    );
    await t.test(
      "existing team account requires current identity, keeps password, and role only changes at acceptance",
      async () => {
        const account = (
          await f.q(
            "INSERT INTO admin_users(name,email,password_hash,role) VALUES('Existing','existing-team@example.test','unchanged-team-hash','analyst') RETURNING id",
          )
        )[0];
        const invite = await create("existing-team@example.test", "editor");
        assert.equal(
          (
            await f.q("SELECT role FROM admin_users WHERE id=$1", [account.id])
          )[0].role,
          "analyst",
        );
        await assert.rejects(
          invitations.acceptTeamInvitation(f.q, invite.token, {
            teamId: f.owner.id,
          }),
        );
        await invitations.acceptTeamInvitation(f.q, invite.token, {
          teamId: account.id,
        });
        assert.equal(
          (
            await f.q("SELECT password_hash FROM admin_users WHERE id=$1", [
              account.id,
            ])
          )[0].password_hash,
          "unchanged-team-hash",
        );
      },
    );
    await t.test(
      "expired, revoked and superseded tokens fail; last owner and invalid roles are protected",
      async () => {
        const expired = await create("expired-team@example.test");
        await f.q(
          "UPDATE editorial_invitations SET expires_at=now()-interval '1 minute' WHERE id=$1",
          [expired.id],
        );
        await assert.rejects(
          invitations.acceptTeamInvitation(f.q, expired.token, {
            passwordHash: "unused",
          }),
        );
        const revoked = await create("revoked-team@example.test");
        await f.q(
          "UPDATE editorial_invitations SET revoked_at=now() WHERE id=$1",
          [revoked.id],
        );
        await assert.rejects(
          invitations.acceptTeamInvitation(f.q, revoked.token, {
            passwordHash: "unused",
          }),
        );
        const old = await create("superseded-team@example.test");
        await create("superseded-team@example.test", "editor");
        await assert.rejects(
          invitations.acceptTeamInvitation(f.q, old.token, {
            passwordHash: "unused",
          }),
        );
        const ownerInvite = await create("owner@example.test", "analyst");
        await assert.rejects(
          invitations.acceptTeamInvitation(f.q, ownerInvite.token, {
            teamId: f.owner.id,
          }),
        );
        assert.throws(() => invitations.invitationRole("__proto__"));
        assert.throws(() => invitations.invitationRole("invented_superadmin"));
      },
    );
  } finally {
    await f.db.close();
  }
});

test("recipient selection deduplicates actual records, enforces scope and consent, and rendering excludes unsafe HTML", async () => {
  const f = await fixture();
  try {
    const user = (
      await f.q(
        "INSERT INTO users(name,email,password_hash) VALUES('Customer','shared@example.test','unchanged') RETURNING id",
      )
    )[0];
    const org = (
      await f.q(
        "INSERT INTO organizations(name,slug) VALUES('Mail Business','mail-test') RETURNING id",
      )
    )[0];
    await f.q(
      "INSERT INTO organization_members(organization_id,user_id,name,email,role) VALUES($1,$2,'Customer','shared@example.test','owner')",
      [org.id, user.id],
    );
    await f.q(
      "INSERT INTO affiliates(name,email,password_hash,referral_code,programme,status,partner_terms_confirmed) VALUES('Dual','shared@example.test','unused','EMAIL-DUAL','affiliate','active',false),('Partner','partner@example.test','unused','EMAIL-PARTNER','partner','active',true),('Suppressed','suppressed@example.test','unused','EMAIL-SUPPRESSED','affiliate','active',false)",
    );
    await f.q(
      "INSERT INTO email_preferences(email,marketing_opt_in,marketing_suppressed) VALUES('shared@example.test',true,false),('partner@example.test',false,false),('suppressed@example.test',true,true)",
    );
    assert.deepEqual(
      await compose.mailRecipients(f.q, "owner", "SELECTED", [
        "shared@example.test",
        "shared@example.test",
        "suppressed@example.test",
      ]),
      ["shared@example.test"],
    );
    assert.deepEqual(
      await compose.mailRecipients(f.q, "affiliate_manager", "SELECTED", [
        "owner@example.test",
      ]),
      [],
    );
    assert.throws(() =>
      compose.authorizeEmailAudience("affiliate_manager", "CUSTOMERS"),
    );
    assert.deepEqual(
      await compose.mailRecipients(
        f.q,
        "affiliate_manager",
        "APPROVED_PARTNERS",
        [],
        undefined,
        "operational",
      ),
      ["partner@example.test"],
    );
    assert.deepEqual(
      await compose.mailRecipients(
        f.q,
        "owner",
        "CUSTOMERS",
        [],
        undefined,
        "operational",
      ),
      ["shared@example.test"],
    );
    await f.db.exec(
      readFileSync(
        new URL("../migrations/060_email_management.sql", import.meta.url),
        "utf8",
      ),
    );
    assert.equal(
      (await f.q("SELECT password_hash FROM users WHERE id=$1", [user.id]))[0]
        .password_hash,
      "unchanged",
    );
  } finally {
    await f.db.close();
  }
});

test("compose confirmation queues once; provider rejections, ambiguous submissions and suppressed recipients stay separate", async () => {
  const f = await fixture();
  try {
    await f.q(
      "INSERT INTO affiliates(name,email,password_hash,referral_code,programme,status) VALUES('Recipient','composed@example.test','unused','COMPOSED-ONE','affiliate','active')",
    );
    await f.q(
      "INSERT INTO email_preferences(email,marketing_opt_in) VALUES('composed@example.test',true)",
    );
    await f.q("UPDATE email_branding SET settings=$1::jsonb", [
      JSON.stringify(configured()),
    ]);
    let actor = { ...f.owner, permissions: {} },
      callbacks = [];
    const actions = load("../src/lib/actions/email-compose-actions.ts", {
      "next/server": { after: (callback) => callbacks.push(callback) },
      "@/lib/admin-session": {
        requireAdminCapability: async (capability) => {
          if (!permissions.can(actor.role, capability)) throw Error("denied");
          return actor;
        },
      },
      "@/lib/custom/service": { query: f.q },
      "@/lib/support/service": { rate: async () => {} },
      "@/lib/mail/compose": compose,
      "@/lib/mail/service": { currentBranding: async () => configured() },
      "@/lib/mail/addresses": addresses,
      "@/lib/mail/layout": layout,
      "@/lib/distribution/notifications": {
        flushProgramNotices: async () => {},
      },
    });
    const raw = {
      audience: "AFFILIATES",
      selected: "",
      subject: "An approved update",
      body: "**Hello** to your business.",
      replyTo: "info@jktl.com.ng",
      kind: "marketing",
    };
    const preview = await actions.previewComposedEmailAction(raw);
    assert.equal(preview.count, 1);
    assert.match(preview.html, /<strong>Hello<\/strong>/);
    await assert.rejects(
      actions.sendComposedEmailAction({
        id: preview.id,
        count: 2,
        confirmed: true,
        operationalConfirmed: false,
      }),
    );
    await assert.rejects(
      actions.sendComposedEmailAction({
        id: preview.id,
        count: 1,
        confirmed: false,
        operationalConfirmed: false,
      }),
    );
    await actions.sendComposedEmailAction({
      id: preview.id,
      count: 1,
      confirmed: true,
      operationalConfirmed: false,
    });
    await assert.rejects(
      actions.sendComposedEmailAction({
        id: preview.id,
        count: 1,
        confirmed: true,
        operationalConfirmed: false,
      }),
    );
    assert.equal(
      (
        await f.q(
          "SELECT * FROM distribution_program_notices WHERE composed_id=$1",
          [preview.id],
        )
      ).length,
      1,
    );
    let sends = 0;
    let notice = (
      await f.q(
        "SELECT * FROM distribution_program_notices WHERE composed_id=$1",
        [preview.id],
      )
    )[0];
    const accepted = await delivery.deliverComposedNotice(
      f.q,
      notice,
      async (p) => {
        sends++;
        assert.equal(p.replyTo, "info@jktl.com.ng");
        assert.ok(!("cc" in p));
        return { ok: true, providerId: "SYNTHETIC-PROVIDER-ID" };
      },
    );
    assert.equal(accepted.accepted, true);
    await delivery.deliverComposedNotice(f.q, notice, async () => {
      sends++;
      return { ok: true };
    });
    assert.equal(sends, 1);
    const queue = async () => {
      const p = await actions.previewComposedEmailAction(raw);
      await actions.sendComposedEmailAction({
        id: p.id,
        count: 1,
        confirmed: true,
        operationalConfirmed: false,
      });
      return {
        draft: p,
        notice: (
          await f.q(
            "SELECT * FROM distribution_program_notices WHERE composed_id=$1",
            [p.id],
          )
        )[0],
      };
    };
    const rejected = await queue();
    await delivery.deliverComposedNotice(f.q, rejected.notice, async () => ({
      ok: false,
      error: "synthetic rejection",
      uncertain: false,
    }));
    assert.equal(
      (
        await f.q(
          "SELECT send_state FROM distribution_program_notices WHERE id=$1",
          [rejected.notice.id],
        )
      )[0].send_state,
      "FAILED",
    );
    await actions.retryComposedEmailAction(rejected.draft.id);
    assert.equal(
      (
        await f.q(
          "SELECT send_state FROM distribution_program_notices WHERE id=$1",
          [rejected.notice.id],
        )
      )[0].send_state,
      "QUEUED",
    );
    const uncertain = await queue();
    await delivery.deliverComposedNotice(f.q, uncertain.notice, async () => ({
      ok: false,
      error: "synthetic timeout",
      uncertain: true,
    }));
    await actions.retryComposedEmailAction(uncertain.draft.id);
    assert.equal(
      (
        await f.q(
          "SELECT send_state FROM distribution_program_notices WHERE id=$1",
          [uncertain.notice.id],
        )
      )[0].send_state,
      "UNKNOWN",
    );
    const suppressed = await queue();
    await f.q(
      "UPDATE email_preferences SET marketing_suppressed=true WHERE email='composed@example.test'",
    );
    let attempted = false;
    await delivery.deliverComposedNotice(f.q, suppressed.notice, async () => {
      attempted = true;
      return { ok: true };
    });
    assert.equal(attempted, false);
    assert.ok(
      (
        await f.q(
          "SELECT suppressed_at FROM distribution_program_notices WHERE id=$1",
          [suppressed.notice.id],
        )
      )[0].suppressed_at,
    );
    actor.role = "support";
    await assert.rejects(actions.previewComposedEmailAction(raw));
    assert.ok(callbacks.length > 0);
  } finally {
    await f.db.close();
  }
});

test("branding edits require authority and mailbox verification; invalid sender and stale revisions are rejected", async () => {
  const f = await fixture();
  try {
    let role = "owner";
    const preview = load("../src/lib/mail/preview.ts", {
      "./layout": layout,
      "@/lib/admin-permissions": permissions,
    });
    const actions = load("../src/lib/actions/mail-admin-actions.ts", {
      "@/lib/admin-session": {
        requireAdminCapability: async (cap) => {
          if (!permissions.can(role, cap)) throw Error("Denied");
          return f.owner;
        },
      },
      "@/lib/custom/service": { query: f.q },
      "@/lib/mail/layout": layout,
      "@/lib/mail/addresses": addresses,
      "@/lib/mail/preview": preview,
      "@/lib/support/service": { rate: async () => {} },
      "@/lib/email": { sendMailPreview: async () => ({ ok: true }) },
      "next/cache": { revalidatePath: () => {} },
    });
    const b = layout.DEFAULT_BRANDING;
    const data = {
      ...b,
      socialLinks: undefined,
      categoryReplyTo: undefined,
      verifiedReplyTo: undefined,
      defaultReplyTo: "info@jktl.com.ng",
      maxPromotions: 3,
      revision: 1,
      invitationHours: 48,
      senderEmail: addresses.verifiedSenders()[0],
      senderDisplayName: "JKTL Business",
    };
    const fields = form(
      Object.fromEntries(
        Object.entries(data).filter(
          ([, v]) => typeof v === "string" || typeof v === "number",
        ),
      ),
    );
    role = "support";
    await assert.rejects(actions.saveMailBrandingAction(fields), /Denied/);
    role = "owner";
    await assert.rejects(actions.saveMailBrandingAction(fields), /Verify/);
    fields.set("mailboxesVerified", "on");
    fields.set("senderEmail", "unverified-sender@example.test");
    await assert.rejects(
      actions.saveMailBrandingAction(fields),
      /verified sender/,
    );
    fields.set("senderEmail", addresses.verifiedSenders()[0]);
    await actions.saveMailBrandingAction(fields);
    const row = (await f.q("SELECT * FROM email_branding"))[0];
    assert.equal(row.settings.defaultReplyTo, "info@jktl.com.ng");
    assert.deepEqual(row.settings.verifiedReplyTo, ["info@jktl.com.ng"]);
    await assert.rejects(actions.saveMailBrandingAction(fields), /changed/);
    fields.set("revision", 2);
    fields.set("defaultReplyTo", "a@example.test\r\nBcc:victim@example.test");
    await assert.rejects(actions.saveMailBrandingAction(fields), /valid email/);
  } finally {
    await f.db.close();
  }
});

test("shared Resend sender applies verified Reply-To to real event helpers and records metadata without invitation/reset secrets", async () => {
  const f = await fixture();
  const old = process.env.RESEND_API_KEY;
  try {
    await f.q("UPDATE email_branding SET settings=$1::jsonb", [
      JSON.stringify(configured()),
    ]);
    const service = load("../src/lib/mail/service.ts", {
      "server-only": {},
      "@/lib/custom/service": { query: f.q },
      "./layout": layout,
      "./addresses": addresses,
    });
    const history = load("../src/lib/mail/history.ts", {
      "server-only": {},
      "@/lib/custom/service": { query: f.q },
    });
    const outcome = load("../src/lib/mail/provider-outcome.ts", {});
    const sent = [];
    let status = 200;
    class FakeResend {
      emails = {
        send: async (payload, options) => {
          sent.push({ payload, options });
          return status === 200
            ? { data: { id: "SYNTHETIC-" + sent.length }, error: null }
            : {
                data: null,
                error: {
                  message: "Synthetic rejection",
                  name: "synthetic_error",
                  statusCode: status,
                },
              };
        },
      };
    }
    process.env.RESEND_API_KEY = "synthetic-not-a-provider-key";
    const email = load("../src/lib/email.ts", {
      resend: { Resend: FakeResend },
      "@/lib/mail/service": service,
      "@/lib/mail/layout": layout,
      "@/lib/mail/addresses": addresses,
      "@/lib/mail/history": history,
      "@/lib/mail/provider-outcome": outcome,
      "@/lib/format": {
        formatKobo: (n) => String(n),
        formatShortDate: (s) => s,
        formatTime: (s) => s,
      },
    });
    await email.sendWelcomeEmail(
      "welcome@example.test",
      "New Owner",
      "My Business",
    );
    assert.equal(sent.at(-1).payload.replyTo, "info@jktl.com.ng");
    await email.sendPasswordResetEmail({
      to: "reset@example.test",
      name: "Owner",
      resetUrl:
        "https://business.jktl.com.ng/reset-password?token=SECRET-RESET-FIXTURE",
    });
    assert.equal(sent.at(-1).payload.replyTo, "security-help@example.test");
    assert.doesNotMatch(sent.at(-1).payload.html, /More ways to grow/);
    await email.sendRoleInvitationEmail({
      to: "team@example.test",
      name: "Teammate",
      role: "Writer",
      message: "Welcome",
      url: "https://business.jktl.com.ng/admin/invitation?token=SECRET-INVITE-FIXTURE",
      expiresAt: new Date().toISOString(),
      key: "role-fixture",
      editorial: true,
    });
    assert.equal(sent.at(-1).payload.replyTo, "editorial-help@example.test");
    await email.sendPartnerNoticeEmail({
      to: "program@example.test",
      subject: "Your invitation",
      detail: "A secure invitation",
      path: "/affiliates/invitation?token=SECRET-PROGRAM-FIXTURE",
      key: "affiliate-fixture",
      category: "security",
      replyCategory: "affiliate",
    });
    assert.equal(sent.at(-1).payload.replyTo, "affiliate-help@example.test");
    await email.sendPartnerNoticeEmail({
      to: "support@example.test",
      subject: "Ticket update",
      detail: "Your case update",
      path: "/business/support",
      key: "support-fixture",
      category: "support",
    });
    assert.equal(sent.at(-1).payload.replyTo, "support-help@example.test");
    await f.q(
      "INSERT INTO email_preferences(email,marketing_opt_in) VALUES('operational@example.test',true)",
    );
    await f.q(
      "INSERT INTO email_promotions(title,description,url,product_id,enabled,priority,categories) VALUES('OPERATIONAL-PROMO-FIXTURE','Should never appear here','https://jktl.com.ng/templates','templates',true,0,ARRAY['service'])",
    );
    await email.sendAdminComposedEmail({
      to: "operational@example.test",
      subject: "Necessary operational information",
      bodyHtml: "<p>Account information only.</p>",
      text: "Account information only.",
      category: "service",
      key: "operational-fixture",
    });
    assert.doesNotMatch(
      sent.at(-1).payload.html,
      /OPERATIONAL-PROMO-FIXTURE|More ways to grow/,
    );
    for (const { payload } of sent) {
      assert.match(
        payload.html,
        /https:\/\/business.jktl.com.ng\/jktl-logo.png/,
      );
      assert.equal(payload.cc, undefined);
      assert.equal(payload.bcc, undefined);
      assert.equal(payload.reply_to, undefined);
    }
    status = 500;
    assert.equal(
      (
        await email.sendAdminComposedEmail({
          to: "uncertain@example.test",
          subject: "A message",
          bodyHtml: "<p>Body</p>",
          text: "Body",
          category: "service",
          key: "unknown-fixture",
        })
      ).uncertain,
      true,
    );
    status = 422;
    assert.equal(
      (
        await email.sendAdminComposedEmail({
          to: "rejected@example.test",
          subject: "A message",
          bodyHtml: "<p>Body</p>",
          text: "Body",
          category: "service",
          key: "reject-fixture",
        })
      ).uncertain,
      false,
    );
    const log = await f.q("SELECT * FROM email_send_history");
    assert.doesNotMatch(
      JSON.stringify(log),
      /SECRET-RESET|SECRET-INVITE|SECRET-PROGRAM/,
    );
    assert.ok(
      log.some((r) => r.provider_state === "ACCEPTED" && r.provider_message_id),
    );
    assert.ok(log.some((r) => r.provider_state === "UNKNOWN"));
    assert.ok(log.some((r) => r.provider_state === "FAILED"));
  } finally {
    if (old === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = old;
    await f.db.close();
  }
});

test("new programme invitations retain approval gates and secure resend rotates expired links", async () => {
  const f = await fixture();
  try {
    const user = (
      await f.q(
        "INSERT INTO users(name,email,password_hash) VALUES('Partner User','partner-invite@example.test','original-business-password') RETURNING id",
      )
    )[0];
    let context = { ...f.owner, permissions: {} },
      sent = [];
    const program = load("../src/lib/actions/affiliate-invitation-actions.ts", {
      "next/server": { after: () => {} },
      "@/lib/distribution/notifications": {
        flushProgramNotices: async () => {},
      },
      "node:crypto": crypto,
      "@/lib/custom/service": { query: f.q },
      "@/lib/admin-session": {
        requireAdminCapability: async (cap) => {
          if (!permissions.can(context.role, cap)) throw Error("Denied");
          return context;
        },
      },
      "@/lib/session": { requireSession: async () => ({ userId: user.id }) },
      "@/lib/affiliate-session": {
        startAffiliateSession: async () => {
          throw Error(
            "Pending partners cannot receive an active programme session",
          );
        },
      },
      "@/lib/db/auth": {
        hashPassword: async () => "unusable-generated-program-hash",
      },
      "@/lib/email": {
        sendPartnerNoticeEmail: async (p) => {
          sent.push(p);
          return { ok: true };
        },
      },
      "@/lib/support/service": { rate: async () => {} },
      "next/cache": { revalidatePath: () => {} },
      "next/navigation": {
        redirect: (url) => {
          throw Error("REDIRECT:" + url);
        },
      },
      "@/lib/mail/addresses": addresses,
    });
    const policy = (
      await f.q(
        "SELECT id FROM distribution_policies WHERE program='PARTNER' AND state='DRAFT' LIMIT 1",
      )
    )[0];
    assert.ok(policy);
    await program.inviteAffiliateAction(
      form({
        name: "Partner User",
        email: "partner-invite@example.test",
        program: "partner",
        policy: policy.id,
        hours: 48,
      }),
    );
    const token = new URL(
      "https://example.test" + sent[0].path,
    ).searchParams.get("token");
    assert.equal(sent[0].replyCategory, "partner");
    const invitation = (
      await f.q(
        "SELECT * FROM affiliate_invitations WHERE email='partner-invite@example.test'",
      )
    )[0];
    await f.q(
      "UPDATE affiliate_invitations SET expires_at=now()-interval '1 minute' WHERE id=$1",
      [invitation.id],
    );
    await program.resendAffiliateInviteAction(
      form({ id: invitation.id, hours: 48 }),
    );
    const replacement = new URL(
      "https://example.test" + sent.at(-1).path,
    ).searchParams.get("token");
    assert.notEqual(replacement, token);
    await assert.rejects(
      program.acceptAffiliateInvitationAction(form({ token, consent: "on" })),
    );
    await assert.rejects(
      program.acceptAffiliateInvitationAction(
        form({ token: replacement, consent: "on" }),
      ),
      /REDIRECT:\/business\/distribution/,
    );
    const partner = (
      await f.q(
        "SELECT * FROM affiliates WHERE email='partner-invite@example.test' AND programme='partner'",
      )
    )[0];
    assert.equal(partner.status, "pending");
    assert.equal(partner.partner_terms_confirmed, false);
    assert.equal(
      (await f.q("SELECT count(*)::int n FROM distribution_contracts"))[0].n,
      0,
    );
    assert.equal(
      (await f.q("SELECT password_hash FROM users WHERE id=$1", [user.id]))[0]
        .password_hash,
      "original-business-password",
    );
    const teams = load("../src/lib/actions/team-invitation-actions.ts", {
      "@/lib/admin-session": {
        requireAdminCapability: async (cap) => {
          if (!permissions.can(context.role, cap)) throw Error("Denied");
          return context;
        },
        getAdminSession: async () => null,
      },
      "@/lib/session": { getSession: async () => null },
      "@/lib/custom/service": { query: f.q },
      "@/lib/support/service": { rate: async () => {} },
      "@/lib/mail/invitations": invitations,
      "@/lib/mail/invitation-rate": { limitInvitationRequest: async () => {} },
      "@/lib/email": {
        sendRoleInvitationEmail: async (p) => {
          sent.push(p);
          return { ok: true };
        },
      },
      "@/lib/admin-permissions": permissions,
      "node:crypto": crypto,
      bcryptjs: { __esModule: true, default: bcrypt },
      "next/navigation": { redirect: () => {} },
      "next/cache": { revalidatePath: () => {} },
    });
    context.role = "affiliate_manager";
    await assert.rejects(
      teams.inviteTeamUserAction(
        form({
          role: "owner",
          name: "No escalation",
          email: "escalation@example.test",
        }),
      ),
      /Denied/,
    );
    context.role = "owner";
    await teams.inviteTeamUserAction(
      form({
        role: "support",
        name: "Support Person",
        email: "resend-team@example.test",
        hours: 48,
      }),
    );
    const before = sent.at(-1);
    const record = (
      await f.q(
        "SELECT i.* FROM editorial_invitations i JOIN admin_users a ON a.id=i.user_id WHERE a.email='resend-team@example.test'",
      )
    )[0];
    await f.q(
      "UPDATE editorial_invitations SET expires_at=now()-interval '1 minute' WHERE id=$1",
      [record.id],
    );
    await teams.manageTeamInvitationAction(
      form({ id: record.id, mode: "RESEND", hours: 48 }),
    );
    assert.notEqual(sent.at(-1).url, before.url);
    await teams.manageTeamInvitationAction(
      form({ id: record.id, mode: "REVOKE" }),
    );
    assert.equal(
      await invitations.inspectTeamInvitation(
        f.q,
        new URL(sent.at(-1).url).searchParams.get("token"),
      ),
      null,
    );
  } finally {
    await f.db.close();
  }
});

test("email branding, invitation list and history server pages render their real database queries", async () => {
  const f = await fixture();
  try {
    const jsx = await import("react/jsx-runtime");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const ActionForm = ({ children }) => jsx.jsx("form", { children });
    let allowed = true;
    const branding = load(
      "../src/app/admin/(command)/emails/branding/page.tsx",
      {
        "react/jsx-runtime": jsx,
        "@/lib/admin-page-guard": {
          guardAdminPage: async () => {
            if (!allowed) throw Error("Denied");
          },
        },
        "@/lib/mail/addresses": addresses,
        "@/components/mail/promotion-settings": {
          __esModule: true,
          default: () => null,
        },
        "@/components/mail/mail-preview": { MailPreview: () => null },
        "@/lib/custom/service": { query: f.q },
        "@/lib/mail/layout": layout,
        "@/components/distribution/action-form": { ActionForm },
        "@/lib/actions/mail-admin-actions": {
          saveMailBrandingAction: async () => {},
        },
      },
    );
    allowed = false;
    await assert.rejects(branding.default(), /Denied/);
    allowed = true;
    const html = renderToStaticMarkup(await branding.default());
    for (const label of [
      "Sender Display Name",
      "Sender Email Address",
      "Default Reply-To Email Address",
      "mailboxesVerified",
      "info@jktl.com.ng",
    ])
      assert.ok(html.includes(label));
    await invitations.createTeamInvitation(f.q, f.owner.id, {
      name: "New Teammate",
      email: "ssr-team@example.test",
      role: "writer",
      message: "Welcome",
      hours: 48,
    });
    const invitePage = load(
      "../src/app/admin/(command)/emails/invite/page.tsx",
      {
        "react/jsx-runtime": jsx,
        "@/lib/admin-session": { requireAdminCapability: async () => f.owner },
        "@/lib/admin-permissions": permissions,
        "@/lib/custom/service": { query: f.q },
        "@/lib/admin-page-guard": { guardAdminPage: async () => {} },
        "@/components/mail/invite-user": { InviteUser: () => null },
        "@/components/distribution/action-form": { ActionForm },
        "@/lib/actions/team-invitation-actions": {
          manageTeamInvitationAction: async () => {},
        },
        "@/lib/actions/affiliate-invitation-actions": {
          resendAffiliateInviteAction: async () => {},
          revokeProgramInvitationAction: async () => {},
        },
      },
    );
    assert.match(renderToStaticMarkup(await invitePage.default()), /PENDING/);
    await f.q(
      "INSERT INTO affiliate_campaigns(subject,body,audience,recipients,created_by) VALUES('Retained legacy draft','**Legacy draft**','ACTIVE','[]'::jsonb,$1)",
      [f.owner.id],
    );
    const historyPage = load(
      "../src/app/admin/(command)/emails/history/page.tsx",
      {
        "react/jsx-runtime": jsx,
        "@/lib/admin-page-guard":{guardAdminPage:async()=>{}},
        "@/lib/admin-session": { requireAdminCapability: async () => f.owner },
        "@/lib/admin-permissions": permissions,
        "@/lib/custom/service": { query: f.q },
        "@/components/distribution/action-form": { ActionForm },
        "@/lib/actions/email-compose-actions": {
          retryComposedEmailFormAction: async () => {},
        },
      },
    );
    const history = renderToStaticMarkup(await historyPage.default());
    assert.match(history, /Retained legacy draft/);
    assert.match(history, /Provider accepted/);
  } finally {
    await f.db.close();
  }
});
