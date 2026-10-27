import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pushSubscription } from "../src/lib/support/model.ts";
import { applyMigrationBatch } from "../scripts/sql-statements.mjs";
const require = createRequire(import.meta.url);
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
  )((n) => (n in deps ? deps[n] : require(n)), m, m.exports);
  return m.exports;
}
const p = "10000000-0000-4000-8000-000000000001",
  other = "10000000-0000-4000-8000-000000000002",
  ticket = "10000000-0000-4000-8000-000000000003",
  session = "10000000-0000-4000-8000-000000000004",
  agent = "10000000-0000-4000-8000-000000000005";
test("partner attachments stay protected and notices preserve history, opt-in and retry behavior", async () => {
  const db = new PGlite();
  const saved = {
    email: process.env.RESEND_API_KEY,
    pub: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    priv: process.env.VAPID_PRIVATE_KEY,
  };
  try {
    await db.exec(
      `CREATE TABLE affiliates(id uuid PRIMARY KEY,status text,programme text,partner_terms_confirmed boolean,email text);INSERT INTO affiliates VALUES('${p}','active','partner',true,'partner@example.test'),('${other}','active','partner',true,'other@example.test');CREATE TABLE affiliate_sessions(id uuid PRIMARY KEY,affiliate_id uuid,expires_at timestamptz);INSERT INTO affiliate_sessions VALUES('${session}','${p}',now()+interval '1 day');CREATE TABLE admin_users(id uuid PRIMARY KEY,email text DEFAULT 'support@example.test',role text,disabled_at timestamptz,permission_overrides jsonb DEFAULT '{}',business_user_id uuid,staff_revoked_at timestamptz);INSERT INTO admin_users(id,role,disabled_at) VALUES('${agent}','support',NULL);CREATE TABLE admin_sessions(id uuid PRIMARY KEY,admin_user_id uuid,expires_at timestamptz);CREATE TABLE sessions(id uuid PRIMARY KEY,user_id uuid,expires_at timestamptz);CREATE TABLE support_push_subscriptions(endpoint text PRIMARY KEY,p256dh text,auth text,admin_id uuid,session_id uuid,business_session_id uuid);CREATE TABLE partner_tickets(id uuid PRIMARY KEY,partner_id uuid,sensitive boolean DEFAULT false,status text DEFAULT 'OPEN',assigned_to uuid,updated_at timestamptz DEFAULT now());INSERT INTO partner_tickets(id,partner_id) VALUES('${ticket}','${p}');CREATE TABLE partner_ticket_messages(id bigserial PRIMARY KEY,ticket_id uuid,actor_id text,kind text,body text);CREATE TABLE distribution_audit(id bigserial,actor_id text,event text,detail jsonb);`,
    );
    const query = async (s, params = []) => (await db.query(s, params)).rows;
    const adapter = {
      query: (s, p) => ({ s, p }),
      transaction: async (rows) => {
        await db.exec("BEGIN");
        try {
          for (const r of rows) await db.query(r.s, r.p);
          await db.exec("COMMIT");
        } catch (e) {
          await db.exec("ROLLBACK");
          throw e;
        }
      },
    };
    const migration = readFileSync(
      new URL("../migrations/041_partner_operations.sql", import.meta.url),
      "utf8",
    );
    await applyMigrationBatch(adapter, [migration]);
    await applyMigrationBatch(adapter, [migration]);
    await db.exec(
      "ALTER TABLE partner_notice_outbox ADD COLUMN email_sent_at timestamptz;ALTER TABLE partner_notice_outbox ADD COLUMN push_sent_at timestamptz;",
    );
    let current = p,
      owner = false;
    const deps = {
      "@/lib/partners/support-access": {
        programmeSupportAgent: async () => ({ id: agent, role: "owner" }),
      },
      "@/lib/custom/service": { query },
      "@/lib/partners/access": {
        approvedProgramme: async () => ({ id: current }),
      },
      "@/lib/admin-session": {
        requireAdminCapability: async () => {
          if (!owner) throw Error("Owner required");
          return { id: agent, role: "owner" };
        },
      },
      "@/lib/support/model": { pushSubscription },
      "@/lib/support/service": { rate: async () => {} },
      "next/cache": { revalidatePath: () => {} },
      "next/headers": {
        cookies: async () => ({ get: () => ({ value: session }) }),
      },
    };
    const a = load("../src/lib/actions/partner-operations-actions.ts", deps);
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lGQAAAAASUVORK5CYII=",
      "base64",
    );
    const form = new FormData();
    form.set("id", ticket);
    form.set("file", new File([png], "proof.png", { type: "image/png" }));
    await a.uploadPartnerAttachmentAction(form);
    assert.equal(
      (await query("SELECT count(*)::int n FROM partner_ticket_attachments"))[0]
        .n,
      1,
    );
    assert.equal(
      (await query("SELECT attachment_bytes FROM partner_tickets"))[0]
        .attachment_bytes,
      png.length,
    );
    assert.equal(
      (await query("SELECT count(*)::int n FROM partner_notice_outbox"))[0].n,
      1,
    );
    current = other;
    await assert.rejects(a.uploadPartnerAttachmentAction(form));
    current = p;
    form.set("file", new File(["<svg/>"], "proof.png", { type: "image/png" }));
    await assert.rejects(a.uploadPartnerAttachmentAction(form));
    form.set(
      "file",
      new File([new Uint8Array(524289)], "large.png", { type: "image/png" }),
    );
    await assert.rejects(a.uploadPartnerAttachmentAction(form));
    await query(
      "INSERT INTO partner_ticket_messages(ticket_id,actor_id,kind,body) VALUES($1,$2,'NOTE','private note')",
      [ticket, agent],
    );
    assert.equal(
      (await query("SELECT count(*)::int n FROM partner_notice_outbox"))[0].n,
      1,
      "notes do not notify partners",
    );
    const target = new FormData();
    target.set("hours", "24");
    await assert.rejects(a.partnerResponseTargetAction(target));
    owner = true;
    await a.partnerResponseTargetAction(target);
    assert.equal(
      (await query("SELECT response_hours FROM partner_support_settings"))[0]
        .response_hours,
      24,
    );
    const route = load("../src/app/api/partners/attachments/[id]/route.ts", {
      "@/lib/custom/service": { query },
      "@/lib/affiliate-session": {
        getAffiliateSession: async () => ({ id: current }),
      },
      "@/lib/admin-session": { getAdminSession: async () => null },
    });
    const id = String(
      (await query("SELECT id FROM partner_ticket_attachments"))[0].id,
    );
    current = other;
    assert.equal(
      (
        await route.GET(new Request("https://example.test"), {
          params: Promise.resolve({ id }),
        })
      ).status,
      404,
    );
    current = p;
    const response = await route.GET(new Request("https://example.test"), {
      params: Promise.resolve({ id }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.match(response.headers.get("content-disposition"), /^attachment/);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
    delete process.env.RESEND_API_KEY;
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    let sent = 0,
      failEmail = false;
    const notices = load("../src/lib/partners/notifications.ts", {
      "server-only": {},
      "web-push": {
        default: {
          setVapidDetails: () => {},
          sendNotification: async () => {
            sent++;
          },
        },
      },
      "@/lib/custom/service": { query },
      "@/lib/email": {
        sendPartnerNoticeEmail: async () => ({ ok: !failEmail }),
      },
    });
    assert.equal((await notices.processPartnerNotices()).configured, false);
    assert.equal(
      (
        await query(
          "SELECT count(*)::int n FROM partner_notice_outbox WHERE delivered_at IS NULL",
        )
      )[0].n,
      1,
    );
    process.env.RESEND_API_KEY = "fixture";
    await notices.processPartnerNotices();
    assert.equal(
      (await query("SELECT attempts FROM partner_notice_outbox"))[0].attempts,
      1,
      "Team email is sent independently of push configuration",
    );
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "fixture";
    process.env.VAPID_PRIVATE_KEY = "fixture";
    const result = await notices.processPartnerNotices();
    assert.equal(result.failed, 0);
    assert.equal(sent, 0, "no staff devices means no fabricated push");
    const teamSession = "10000000-0000-4000-8000-000000000099";
    await query(
      "INSERT INTO admin_sessions(id,admin_user_id,expires_at) VALUES($1,$2,now()+interval '1 day')",
      [teamSession, agent],
    );
    await query(
      "INSERT INTO support_push_subscriptions(endpoint,p256dh,auth,admin_id,session_id) VALUES('https://fcm.googleapis.com/team','fixture','fixture',$1,$2)",
      [agent, teamSession],
    );
    await query(
      "INSERT INTO partner_ticket_messages(ticket_id,actor_id,kind,body) VALUES($1,$2,'PARTNER','Please help with my website')",
      [ticket, p],
    );
    failEmail = true;
    assert.equal((await notices.processPartnerNotices()).failed, 1);
    assert.equal(sent, 1, "Push succeeds during an email outage");
    const partial = (
      await query(
        "SELECT * FROM partner_notice_outbox ORDER BY id DESC LIMIT 1",
      )
    )[0];
    assert.ok(partial.push_sent_at);
    assert.equal(partial.email_sent_at, null);
    assert.equal(partial.delivered_at, null);
    failEmail = false;
    await query(
      "UPDATE partner_notice_outbox SET lease_until=now()-interval '1 minute' WHERE id=$1",
      [partial.id],
    );
    assert.equal((await notices.processPartnerNotices()).failed, 0);
    assert.equal(
      sent,
      1,
      "Email retries do not resend completed push delivery",
    );
    assert.ok(
      (
        await query(
          "SELECT delivered_at FROM partner_notice_outbox WHERE id=$1",
          [partial.id],
        )
      )[0].delivered_at,
    );
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      const name = {
        email: "RESEND_API_KEY",
        pub: "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
        priv: "VAPID_PRIVATE_KEY",
      }[k];
      if (v === undefined) delete process.env[name];
      else process.env[name] = v;
    }
    await db.close();
  }
});
