import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import * as model from "../src/lib/support/model.ts";
import * as knowledge from "../src/lib/support/knowledge.ts";
import { can, navFor, normaliseRole } from "../src/lib/admin-permissions.ts";
const require = createRequire(import.meta.url);
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
    (n) => (n in deps ? deps[n] : require(n)),
    m,
    m.exports,
  );
  return m.exports;
}
const org = "30000000-0000-4000-8000-000000000001",
  other = "30000000-0000-4000-8000-000000000002",
  user = "30000000-0000-4000-8000-000000000003",
  otherUser = "30000000-0000-4000-8000-000000000004",
  agent = "30000000-0000-4000-8000-000000000005",
  owner = "30000000-0000-4000-8000-000000000006",
  agentB = "30000000-0000-4000-8000-000000000007",
  sessionId = "30000000-0000-4000-8000-000000000008";
test("Support is a scoped role; guides cover real flows and refuse credential harvesting", () => {
  assert.equal(normaliseRole("support"), "support");
  assert.deepEqual(
    navFor("support").map((n) => n.href),
    ["/admin/partner-support", "/admin/support", "/admin/domains"],
  );
  for (const cap of [
    "manage_team",
    "manage_domains",
    "manage_email",
    "view_businesses",
    "record_payouts",
    "manage_content",
    "publish_reviews",
    "send_broadcasts",
  ])
    assert.equal(can("support", cap), false, cap);
  assert.equal(can("owner", "manage_support"), true);
  assert.equal(can("editor", "publish_reviews"), true);
  assert.ok(knowledge.HELP_GUIDES.length >= 18);
  assert.ok(knowledge.HELP_GUIDES.flatMap((g) => g.steps).length >= 140);
  assert.equal(
    knowledge.relevantGuides("domain availability com.ng")[0].id,
    "domains",
  );
  assert.equal(model.sensitive("refund my payment"), true);
  assert.equal(model.sensitive("help me pick a template"), false);
  assert.equal(model.wantsHuman("I want to speak to a human"), true);
  assert.equal(
    knowledge.relevantGuides("What does JKTL Business do?")[0].id,
    "daily-tools",
  );
  assert.equal(
    knowledge.relevantGuides("How much does it cost?")[0].id,
    "plans",
  );
  assert.equal(
    model.safeAssistantReply(
      "Never share your password. Open the secure reset link yourself.",
    ),
    true,
  );
  assert.match(
    model.redact("password=secret otp:123456 sk_live_abcd"),
    /removed/,
  );
  assert.equal(
    model.safeAssistantReply("Please send your password so I can help"),
    false,
  );
  assert.equal(model.safeAssistantReply("I have refunded your payment"), false);
  assert.equal(
    model.safeAssistantReply("Go to https://evil.example/checkout"),
    false,
  );
  assert.equal(
    model.safeAssistantReply(
      "Use your secure reset link. Never share passwords.",
    ),
    true,
  );
  for (const endpoint of [
    "http://localhost/push",
    "https://127.0.0.1/push",
    "https://fcm.googleapis.com.evil.example/push",
    "https://user:pass@fcm.googleapis.com/push",
  ])
    assert.throws(() =>
      model.pushSubscription({
        endpoint,
        p256dh: "a".repeat(87),
        auth: "b".repeat(22),
      }),
    );
});
test("Support permissions, handoff, customer consent, reviews and push use actual isolated PostgreSQL", async (t) => {
  const db = new PGlite(),
    q = async (s, p = []) => (await db.query(s, p)).rows;
  await db.exec(
    `CREATE TABLE organizations(id uuid PRIMARY KEY,name text,created_at timestamptz DEFAULT now());CREATE TABLE users(id uuid PRIMARY KEY,email text);CREATE TABLE organization_members(organization_id uuid,user_id uuid,role text,active boolean);CREATE TABLE admin_users(id uuid PRIMARY KEY,role text CHECK(role IN('owner','editor','support')),disabled_at timestamptz);CREATE TABLE admin_sessions(id uuid PRIMARY KEY,admin_user_id uuid REFERENCES admin_users(id),expires_at timestamptz);CREATE TABLE business_profiles(organization_id uuid PRIMARY KEY REFERENCES organizations(id),display_name text,subdomain text,published boolean DEFAULT false,website_template_id text DEFAULT '',website_document jsonb,website_revision integer DEFAULT 0,theme_color text);CREATE TABLE domain_orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid,kind text,status text,paid_at timestamptz);INSERT INTO organizations(id,name) VALUES('${org}','Pilot'),('${other}','Other');INSERT INTO users VALUES('${user}','owner@example.test'),('${otherUser}','other@example.test');INSERT INTO organization_members VALUES('${org}','${user}','owner',true),('${other}','${otherUser}','owner',true);INSERT INTO admin_users(id,role) VALUES('${agent}','support'),('${owner}','owner'),('${agentB}','support');INSERT INTO admin_sessions VALUES('${sessionId}','${agent}',now()+interval '1 day');INSERT INTO business_profiles(organization_id,display_name,subdomain) VALUES('${org}','Pilot','pilot'),('${other}','Other','other');`,
  );
  const migration = readFileSync(
    new URL("../migrations/037_support_reviews.sql", import.meta.url),
    "utf8",
  );
  await db.exec(migration);
  await db.exec(migration);
  await db.exec(
    "ALTER TABLE support_push_subscriptions ADD COLUMN business_session_id uuid",
  );
  await db.exec(
    "ALTER TABLE support_cases ADD COLUMN custom_project_id uuid, ADD COLUMN project_category text;CREATE TABLE custom_projects(id uuid PRIMARY KEY,organization_id uuid,name text,website_url text,status text,cms_tested_at timestamptz,cms_fields text[],billing_only boolean DEFAULT false)",
  );
  let session = { organizationId: org, userId: user },
    admin = { id: agent, role: "support" },
    ai = false,
    completion = async () => ({ ok: false }),
    pushError = false;
  const after = [];
  const cap = async (capability) => {
    if (!can(admin.role, capability)) throw Error("Forbidden");
    return admin;
  };
  const service = load("../src/lib/support/service.ts", {
    "server-only": {},
    "@/lib/custom/contracts": load("../src/lib/custom/contracts.ts", {}),
    "@/lib/custom/service": { query: q },
    "@/lib/session": { requireSession: async () => session },
    "@/lib/admin-session": { requireAdminCapability: cap },
    "@/lib/deepseek": {
      isDeepSeekConfigured: () => ai,
      chatComplete: (p) => completion(p),
    },
    "./knowledge": knowledge,
    "./model": model,
  });
  const templates = load("../src/lib/website-templates.ts", {});
  const actions = load("../src/lib/actions/support-actions.ts", {
    "next/cache": { revalidatePath: () => {} },
    "next/server": { after: (f) => after.push(f) },
    "next/headers": {
      cookies: async () => ({ get: () => ({ value: sessionId }) }),
    },
    "@/lib/support/service": service,
    "@/lib/admin-session": { requireAdminCapability: cap },
    "@/lib/support/model": model,
    "@/lib/website-templates": templates,
    "@/lib/support/notifications": {
      processSupportNotifications: async () => ({
        configured: false,
        failed: 0,
        delivered: 0,
      }),
    },
  });
  const reviews = load("../src/lib/actions/review-actions.ts", {
    "@/lib/support/service": service,
    "@/lib/admin-session": { requireAdminCapability: cap },
    "@/lib/support/model": model,
  });
  await t.test(
    "project support uses the shared inbox and excludes foreign/internal context",
    async () => {
      const project = "30000000-0000-4000-8000-000000000099";
      await q(
        "INSERT INTO custom_projects(id,organization_id,name,website_url,status,cms_fields) VALUES($1,$2,'Pilot law','https://law.example','LIVE',ARRAY['heroTitle'])",
        [project, org],
      );
      await assert.rejects(() =>
        service.createCase({
          subject: "Website help",
          message: "Please help with content",
          customProjectId: project,
          projectCategory: "UNKNOWN",
        }),
      );
      session = { organizationId: other, userId: otherUser };
      await assert.rejects(() =>
        service.createCase({
          subject: "Website help",
          message: "Please help with content",
          customProjectId: project,
          projectCategory: "WEBSITE_CONTENT",
        }),
      );
      session = { organizationId: org, userId: user };
      const created = await service.createCase({
        subject: "Website help",
        message: "Please help with content",
        customProjectId: project,
        projectCategory: "WEBSITE_CONTENT",
      });
      const row = (
        await q("SELECT * FROM support_cases WHERE id=$1", [created])
      )[0];
      assert.equal(row.custom_project_id, project);
      assert.equal(row.project_category, "WEBSITE_CONTENT");
      assert.equal(
        (await service.supportProjectContext(row)).name,
        "Pilot law",
      );
      assert.equal(
        await service.supportProjectContext({ ...row, organization_id: other }),
        null,
      );
      await q("DELETE FROM support_cases WHERE id=$1", [created]);
      await q("DELETE FROM support_rate_limits");
    },
  );
  let caseId;
  await t.test(
    "AI cases stay private until handoff; assignment is exclusive and customer scope is enforced",
    async () => {
      const opened = await actions.createSupportCaseAction({
        subject: "Publish my website",
        message: "How do I publish my free website template?",
      });
      assert.equal(opened.ok, true);
      caseId = opened.id;
      assert.equal(
        (await actions.supportCaseAction(caseId)).messages.length,
        2,
      );
      assert.equal((await actions.supportQueueAction()).cases.length, 0);
      session = { organizationId: other, userId: otherUser };
      await assert.rejects(actions.supportCaseAction(caseId));
      assert.equal(
        (await actions.grantSupportAction(caseId, ["website_draft"])).ok,
        false,
      );
      session = { organizationId: org, userId: user };
      assert.equal((await actions.requestHumanAction(caseId)).ok, true);
      assert.equal((await actions.claimSupportCaseAction(caseId)).ok, true);
      admin = { id: agentB, role: "support" };
      assert.equal((await actions.claimSupportCaseAction(caseId)).ok, false);
      await assert.rejects(actions.staffSupportCaseAction(caseId));
      admin = { id: agent, role: "support" };
      assert.equal(
        (await actions.staffSupportCaseAction(caseId)).website,
        null,
      );
      assert.equal(
        (await actions.grantSupportAction(caseId, ["billing"])).ok,
        false,
      );
      assert.equal(
        (await actions.grantSupportAction(caseId, ["website_draft"])).ok,
        true,
      );
      assert.ok((await actions.staffSupportCaseAction(caseId)).website);
    },
  );
  await t.test(
    "draft edits are atomic, retain the selected design, require fresh consent and preserve published sites",
    async () => {
      const document = templates.templateDraft("law-firm", "Pilot");
      await q(
        "UPDATE organization_members SET active=false WHERE organization_id=$1",
        [org],
      );
      assert.ok(!(await actions.staffSupportCaseAction(caseId)).website);
      assert.equal(
        (
          await actions.assistedWebsiteAction(caseId, {
            templateId: "law-firm",
            document,
            revision: 0,
            publish: false,
          })
        ).ok,
        false,
      );
      await q(
        "UPDATE organization_members SET active=true WHERE organization_id=$1",
        [org],
      );
      let input = {
        templateId: "law-firm",
        document,
        revision: 0,
        publish: false,
      };
      assert.equal(
        (await actions.assistedWebsiteAction(caseId, input)).ok,
        true,
      );
      assert.equal(
        (await actions.assistedWebsiteAction(caseId, input)).ok,
        false,
      );
      input = { ...input, revision: 1 };
      assert.equal(
        (
          await actions.assistedWebsiteAction(caseId, {
            ...input,
            templateId: "church",
            document: templates.templateDraft("church"),
          })
        ).ok,
        false,
      );
      assert.equal(
        (
          await actions.assistedWebsiteAction(caseId, {
            ...input,
            publish: true,
          })
        ).ok,
        false,
      );
      await actions.grantSupportAction(caseId, []);
      assert.equal(
        (await actions.assistedWebsiteAction(caseId, input)).ok,
        false,
      );
      assert.equal(
        (await actions.staffSupportCaseAction(caseId)).website,
        null,
      );
      const audit = (await actions.staffSupportCaseAction(caseId)).audit.find(
        (a) => a.event === "WEBSITE_DRAFT_SAVED",
      );
      assert.equal(audit.detail.before, undefined);
      assert.equal(audit.detail.after, undefined);
      await actions.grantSupportAction(caseId, ["website_draft"]);
      await q(
        "UPDATE support_cases SET consent_until=now()-interval '1 minute' WHERE id=$1",
        [caseId],
      );
      assert.equal(
        (await actions.assistedWebsiteAction(caseId, input)).ok,
        false,
      );
      await actions.grantSupportAction(caseId, [
        "website_draft",
        "website_publish",
      ]);
      assert.equal(
        (
          await actions.assistedWebsiteAction(caseId, {
            ...input,
            publish: true,
          })
        ).ok,
        true,
      );
      assert.equal(
        (await actions.assistedWebsiteAction(caseId, { ...input, revision: 2 }))
          .ok,
        false,
      );
      assert.equal(
        (
          await q(
            "SELECT website_revision,published FROM business_profiles WHERE organization_id=$1",
            [org],
          )
        )[0].website_revision,
        2,
      );
      assert.equal(
        (
          await q(
            "SELECT count(*)::int AS n FROM support_audit WHERE event='FIRST_WEBSITE_PUBLISHED'",
          )
        )[0].n,
        1,
      );
    },
  );
  await t.test(
    "internal notes stay private; sensitive cases go to owner and cannot be operated by Support",
    async () => {
      await actions.staffSupportReplyAction(
        caseId,
        "Internal investigation note",
        "note",
      );
      const customer = await actions.supportCaseAction(caseId);
      assert.equal(customer.notes, undefined);
      assert.equal(
        customer.messages.some((m) =>
          m.body.includes("Internal investigation"),
        ),
        false,
      );
      const created = await actions.createSupportCaseAction({
        subject: "Refund request",
        message: "Please refund my payment",
      });
      assert.equal(created.ok, true);
      assert.equal(
        (await actions.supportCaseAction(created.id)).case.status,
        "ESCALATED",
      );
      await assert.rejects(actions.staffSupportCaseAction(created.id));
      assert.equal(
        (await actions.claimSupportCaseAction(created.id)).ok,
        false,
      );
      admin = { id: owner, role: "owner" };
      assert.equal((await actions.claimSupportCaseAction(created.id)).ok, true);
      assert.equal(
        (
          await actions.staffSupportReplyAction(
            created.id,
            "Administrator will review the original payment.",
            "resolve",
          )
        ).ok,
        true,
      );
      assert.equal(
        (await actions.supportCaseAction(created.id)).case.status,
        "RESOLVED",
      );
      admin = { id: agent, role: "support" };
    },
  );
  await t.test(
    "a model result cannot speak after human handoff or create account actions",
    async () => {
      const created = await actions.createSupportCaseAction({
        subject: "Domain help",
        message: "How do I choose a domain?",
      });
      let release, started;
      const ready = new Promise((r) => (started = r));
      ai = true;
      completion = async (input) => {
        assert.equal(input.toolChoice, "none");
        assert.equal(input.tools, undefined);
        started();
        return new Promise(
          (r) =>
            (release = () =>
              r({
                ok: true,
                content: JSON.stringify({
                  reply: "Follow the domain guide.",
                  needsHuman: false,
                }),
              })),
        );
      };
      const pending = actions.sendSupportMessageAction(
        created.id,
        "How can I connect my domain?",
      );
      await ready;
      await actions.requestHumanAction(created.id);
      release();
      assert.equal((await pending).ok, true);
      const messages = (await actions.supportCaseAction(created.id)).messages;
      assert.equal(messages.filter((m) => m.sender === "assistant").length, 1);
      ai = false;
    },
  );
  await t.test(
    "An explicit human request hands off without a model; an owner takeover clears delegated access",
    async () => {
      const opened = await actions.createSupportCaseAction({
        subject: "Need a person",
        message: "I want to speak to a human",
      });
      assert.equal(opened.ok, true);
      assert.equal(
        (await actions.supportCaseAction(opened.id)).case.status,
        "WAITING",
      );
      await actions.claimSupportCaseAction(opened.id);
      await actions.grantSupportAction(opened.id, [
        "website_draft",
        "website_publish",
      ]);
      admin = { id: owner, role: "owner" };
      assert.equal((await actions.claimSupportCaseAction(opened.id)).ok, true);
      const c = (await actions.supportCaseAction(opened.id)).case;
      assert.deepEqual(c.consent_scopes, []);
      assert.equal(c.consent_until, null);
      admin = { id: agent, role: "support" };
      assert.equal((await actions.claimSupportCaseAction(opened.id)).ok, false);
    },
  );
  await t.test(
    "all feedback is retained; publication needs consent, the right role and original wording",
    async () => {
      assert.equal((await reviews.reviewHomeAction()).eligible, true);
      await reviews.reviewPromptAction();
      assert.equal((await reviews.reviewHomeAction()).eligible, false);
      const input = {
        rating: 1,
        quote: "The setup was confusing and I need clearer guidance.",
        displayName: "Owner",
        publicConsent: false,
      };
      const result = await reviews.submitBusinessReviewAction(input);
      assert.equal(result.ok, true);
      assert.equal((await reviews.submitBusinessReviewAction(input)).ok, false);
      const row = (await reviews.reviewHomeAction()).reviews[0];
      assert.equal(row.rating, 1);
      assert.equal(
        (await reviews.moderateReviewAction(row.id, true)).ok,
        false,
      );
      admin = { id: owner, role: "owner" };
      assert.equal(
        (await reviews.moderateReviewAction(row.id, true)).ok,
        false,
      );
      session = { organizationId: other, userId: otherUser };
      await q(
        "INSERT INTO domain_orders(organization_id,kind,status,paid_at) VALUES($1,'REGISTER','ACTIVE',now())",
        [other],
      );
      assert.equal((await reviews.reviewHomeAction()).milestone, "domain");
      const first = await Promise.all([
        reviews.submitBusinessReviewAction({
          ...input,
          rating: 5,
          quote:
            "Our first domain setup was explained clearly and the website looks good.",
          publicConsent: true,
        }),
        reviews.submitBusinessReviewAction({ ...input, publicConsent: true }),
      ]);
      assert.equal(first.filter((r) => r.ok).length, 1);
      const r = (await reviews.reviewHomeAction()).reviews[0];
      assert.equal((await reviews.moderateReviewAction(r.id, true)).ok, true);
      const published = (
        await q("SELECT * FROM business_reviews WHERE status='PUBLISHED'")
      )[0];
      assert.equal(published.quote, r.quote);
      const publicApi = load("../src/app/api/public/reviews/route.ts", {
        "@/lib/support/service": { query: q },
      });
      const feed = await (await publicApi.GET()).json();
      assert.deepEqual(Object.keys(feed.reviews[0]).sort(), [
        "company",
        "display_name",
        "id",
        "milestone",
        "quote",
        "rating",
      ]);
      session = { organizationId: org, userId: user };
      assert.equal(
        (await reviews.withdrawBusinessReviewAction(r.id)).ok,
        false,
      );
      session = { organizationId: other, userId: otherUser };
      assert.equal((await reviews.withdrawBusinessReviewAction(r.id)).ok, true);
      assert.equal((await reviews.moderateReviewAction(r.id, true)).ok, false);
      assert.equal(
        (
          await q(
            "SELECT count(*)::int AS n FROM business_reviews WHERE status='PUBLISHED'",
          )
        )[0].n,
        0,
      );
      session = { organizationId: org, userId: user };
      admin = { id: agent, role: "support" };
    },
  );
  await t.test(
    "notification subscriptions are staff-session bound, reject SSRF, and queue retries",
    async () => {
      const originalPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        originalPrivate = process.env.VAPID_PRIVATE_KEY;
      try {
        delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        delete process.env.VAPID_PRIVATE_KEY;
        const sent = [];
        const notifications = load("../src/lib/support/notifications.ts", {
          "server-only": {},
          "web-push": {
            default: {
              setVapidDetails: () => {},
              sendNotification: async (sub, body) => {
                if (pushError) throw Error("Temporary outage");
                sent.push({ sub, body: JSON.parse(body) });
              },
            },
          },
          "./service": service,
          "@/lib/db/push": {
            getNotificationPrefs: async () => ({ pushEnabled: false }),
            listSubscriptions: async () => [],
            removeSubscription: async () => {},
          },
        });
        assert.equal(
          (await notifications.processSupportNotifications()).configured,
          false,
        );
        const sub = {
          endpoint: "https://fcm.googleapis.com/fcm/send/isolated-test",
          p256dh: "a".repeat(87),
          auth: "b".repeat(22),
        };
        assert.equal((await actions.supportDeviceAction(sub)).ok, false);
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "mock-public";
        process.env.VAPID_PRIVATE_KEY = "mock-private";
        assert.equal(
          (
            await actions.supportDeviceAction({
              ...sub,
              endpoint: "https://127.0.0.1/private",
            })
          ).ok,
          false,
        );
        assert.equal((await actions.supportDeviceAction(sub)).ok, true);
        pushError = true;
        const failed = await notifications.processSupportNotifications();
        assert.ok(failed.failed > 0);
        assert.equal(sent.length, 0);
        await q(
          "UPDATE support_outbox SET lease_until=NULL WHERE delivered_at IS NULL",
        );
        pushError = false;
        await notifications.processSupportNotifications();
        assert.ok(sent.length > 0);
        assert.ok(
          sent.every(
            (r) =>
              !r.body.body.includes("refund my payment") &&
              !r.body.body.includes("Domain help"),
          ),
        );
        assert.ok(
          sent.every((r) => r.body.url.startsWith("/admin/support?case=")),
        );
        await q("DELETE FROM admin_sessions WHERE id=$1", [sessionId]);
        assert.equal(
          (
            await q("SELECT count(*)::int AS n FROM support_push_subscriptions")
          )[0].n,
          0,
        );
      } finally {
        if (originalPublic === undefined)
          delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        else process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = originalPublic;
        if (originalPrivate === undefined) delete process.env.VAPID_PRIVATE_KEY;
        else process.env.VAPID_PRIVATE_KEY = originalPrivate;
      }
    },
  );
  await t.test(
    "replaying editorial and support migrations retains existing support users",
    async () => {
      await db.exec(
        readFileSync(
          new URL("../migrations/033_editorial.sql", import.meta.url),
          "utf8",
        ),
      );
      await db.exec(migration);
      assert.equal(
        (await q("SELECT role FROM admin_users WHERE id=$1", [agent]))[0].role,
        "support",
      );
    },
  );
  await db.close();
});
