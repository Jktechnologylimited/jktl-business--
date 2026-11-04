import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";
import * as model from "../src/lib/chatbot/model.ts";
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
const sha = (s) => createHash("sha256").update(s).digest("hex");
test("chatbot: real PostgreSQL schema, organization isolation, plans, atomic quotas, fail-safe spend, streaming and consent", async (t) => {
  const db = new PGlite(),
    query = async (s, p = []) => (await db.query(s, p)).rows;
  try {
    // Exercise complete migration history, not an invented schema.
    for (const file of readdirSync(new URL("../migrations/", import.meta.url))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.exec(
        readFileSync(
          new URL("../migrations/" + file, import.meta.url),
          "utf8",
        ).replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/g, ""),
      );
    const org = randomUUID(),
      other = randomUUID();
    await query(
      "INSERT INTO organizations(id,name,slug) VALUES($1,'Chatbot test','chatbot-test'),($2,'Other org','chatbot-other')",
      [org, other],
    );
    const bot = (
      await query(
        "SELECT * FROM chatbot_create($1,'test-mika','Mika','test')",
        [org],
      )
    )[0];
    const otherBot = (
      await query(
        "SELECT * FROM chatbot_create($1,'test-bella','Bella','test')",
        [other],
      )
    )[0];
    await query(
      "SELECT chatbot_save_knowledge($1,$2,NULL,'Opening hours','OTHER BUSINESS PRIVATE FACT')",
      [other, otherBot.id],
    );
    const newSession = async (b = bot) => {
      const token = randomUUID().replaceAll("-", "").repeat(2);
      return {
        token,
        hash: sha(token),
        ...(
          await query(
            "INSERT INTO chatbot_sessions(bot_id,organization_id,token_hash,origin,expires_at,delete_at) VALUES($1,$2,$3,'https://example.org',now()+interval '1 day',now()+interval '7 days') RETURNING *",
            [b.id, b.organization_id, sha(token)],
          )
        )[0],
      };
    };
    const begin = async (s, ai = true, cost = 20, id = randomUUID()) =>
      (
        await query("SELECT chatbot_begin($1,$2,$3,$4,$5) AS result", [
          s.hash,
          id,
          "Tell me about opening hours",
          ai,
          cost,
        ])
      )[0].result;
    const finish = async (id, state = "completed", cost = 10) =>
      query(
        "SELECT chatbot_finish($1,$2,'Approved answer',12,8,$3,'mock-verified-model',NULL)",
        [id, state, cost],
      );
    await t.test(
      "free bot limit; paid periods and expiry; knowledge ownership and limit",
      async () => {
        assert.equal(
          (await query("SELECT * FROM chatbot_limits($1)", [org]))[0].responses,
          100,
        );
        await assert.rejects(
          query("SELECT chatbot_create($1,'another-bot','Other','test')", [
            org,
          ]),
          /CHATBOT_LIMIT/,
        );
        await query(
          "INSERT INTO website_plan_subscriptions(organization_id,plan_id,interval,status,period_end,first_paid_at,last_paid_at,provider_plan_code) VALUES($1,'starter','monthly','active',now()+interval '30 days',now(),now(),'mock')",
          [org],
        );
        assert.equal(
          (await query("SELECT * FROM chatbot_limits($1)", [org]))[0].responses,
          500,
        );
        await query(
          "UPDATE website_plan_subscriptions SET period_end=now()-interval '1 day' WHERE organization_id=$1",
          [org],
        );
        assert.equal(
          (await query("SELECT * FROM chatbot_limits($1)", [org]))[0].plan_id,
          "free",
        );
        await query(
          "UPDATE chatbot_entitlements SET knowledge=1 WHERE plan_id='free'",
        );
        const kb = (
          await query(
            "SELECT chatbot_save_knowledge($1,$2,NULL,'Opening hours','We open Monday to Friday, 9 AM to 5 PM WAT.') AS id",
            [org, bot.id],
          )
        )[0].id;
        await assert.rejects(
          query(
            "SELECT chatbot_save_knowledge($1,$2,NULL,'Overflow','Not allowed')",
            [org, bot.id],
          ),
          /KNOWLEDGE_LIMIT/,
        );
        await assert.rejects(
          query(
            "SELECT chatbot_save_knowledge($1,$2,$3,'Changed','Cross-org attack')",
            [other, bot.id, kb],
          ),
          /CHATBOT_NOT_FOUND/,
        );
        await assert.rejects(
          query(
            "INSERT INTO chatbot_knowledge(bot_id,organization_id,title,content) VALUES($1,$2,'Attack','Cross-org')",
            [bot.id, other],
          ),
          /foreign key/i,
        );
      },
    );
    await query(
      "UPDATE chatbot_settings SET ai_enabled=true,model_verified=true,model='mock-verified-model',input_usd_per_million=1,output_usd_per_million=2,daily_cap_micro_usd=1000000",
    );
    await t.test(
      "simultaneous turns reserve allowance; request replay and finish idempotency",
      async () => {
        await query(
          "UPDATE chatbot_entitlements SET responses=1 WHERE plan_id='free'",
        );
        const a = await newSession(),
          b = await newSession(),
          key = randomUUID();
        const [first, second] = await Promise.all([
          begin(a, true, 20, key),
          begin(b),
        ]);
        assert.equal([first, second].filter((r) => r.ai).length, 1);
        assert.equal((await begin(a, true, 20, key)).id, first.id);
        await assert.rejects(begin(a), /CHAT_BUSY/);
        await finish(first.id);
        await finish(first.id);
        await finish(second.id, "fallback", null);
        assert.equal(
          (
            await query(
              "SELECT completed FROM chatbot_usage WHERE organization_id=$1",
              [org],
            )
          )[0].completed,
          1,
        );
        const fallback = await begin(b);
        assert.equal(fallback.ai, false);
        await finish(fallback.id, "fallback", null);
      },
    );
    await t.test(
      "actual costs plus ambiguous reservations enforce caps; deletion cannot reset billing",
      async () => {
        await query(
          "UPDATE chatbot_entitlements SET responses=100,monthly_cap_micro_usd=40 WHERE plan_id='free'",
        );
        const s = await newSession(),
          r = await begin(s, true, 25);
        assert.equal(r.ai, true);
        await finish(r.id, "uncertain", null);
        await query("DELETE FROM chatbot_sessions WHERE id=$1", [s.id]);
        assert.equal(
          (
            await query(
              "SELECT session_id,state FROM chatbot_turns WHERE id=$1",
              [r.id],
            )
          )[0].session_id,
          null,
        );
        const next = await newSession();
        assert.equal((await begin(next, true, 20)).ai, false);
        await query("INSERT INTO chatbot_org_caps VALUES($1,1000000)", [org]);
        assert.equal(
          (await query("SELECT * FROM chatbot_limits($1)", [org]))[0]
            .monthly_cap_micro_usd,
          1000000,
        );
      },
    );
    await t.test(
      "suspension and expired sessions block new inference",
      async () => {
        const s = await newSession();
        await query("UPDATE chatbots SET suspended=true WHERE id=$1", [bot.id]);
        await assert.rejects(begin(s), /CHATBOT_DISABLED/);
        await query("UPDATE chatbots SET suspended=false WHERE id=$1", [
          bot.id,
        ]);
        await query(
          "UPDATE chatbot_sessions SET expires_at=now()-interval '1 second' WHERE id=$1",
          [s.id],
        );
        await assert.rejects(begin(s), /CHAT_SESSION_EXPIRED/);
      },
    );
    const engine = load("../src/lib/chatbot/engine.ts", { "./model": model });
    let called = 0;
    const events = [],
      emit = (type, data) => events.push({ type, data });
    const engineTurn = async (
      provider,
      question = "What are your opening hours?",
      configured = true,
    ) => {
      const s = await newSession();
      return engine.turn(
        { query, provider, configured },
        {
          session: s,
          bot: { ...bot, limits: { knowledge: 20 } },
          tokenHash: s.hash,
          request: randomUUID(),
          question,
          emit,
        },
      );
    };
    await t.test(
      "mocked streaming stores actual tokens; exact FAQs bypass AI; no key never calls provider",
      async () => {
        await engineTurn(async function* (request) {
          assert.equal(
            JSON.stringify(request.messages).includes(
              "OTHER BUSINESS PRIVATE FACT",
            ),
            false,
          );
          called++;
          yield { delta: "We open " };
          yield { delta: "at 9 AM." };
          yield { usage: { input: 30, output: 8 }, done: true };
        });
        assert.equal(called, 1);
        assert.equal(
          events
            .filter((e) => e.type === "delta")
            .map((e) => e.data.text)
            .join(""),
          "We open at 9 AM.",
        );
        const usage = (
          await query(
            "SELECT completed,cost_micro_usd FROM chatbot_usage WHERE organization_id=$1",
            [org],
          )
        )[0];
        assert.equal(usage.completed, 2);
        assert.equal(usage.cost_micro_usd, 56);
        await engineTurn(async function* () {
          throw Error("Must never call");
        }, "Opening hours");
        await engineTurn(
          async function* () {
            throw Error("No key");
          },
          "What are your opening hours?",
          false,
        );
        assert.equal(
          (
            await query(
              "SELECT completed FROM chatbot_usage WHERE organization_id=$1",
              [org],
            )
          )[0].completed,
          2,
        );
      },
    );
    await t.test(
      "provider timeout is uncertain, never a blind retry; unknown usage holds worst-case reservation",
      async () => {
        await engineTurn(async function* () {
          yield { delta: "Partial" };
          throw Error("Timeout with possible charge");
        });
        assert.ok(
          (
            await query(
              "SELECT * FROM chatbot_turns WHERE error_code='PROVIDER_INCOMPLETE'",
            )
          ).length,
        );
        await engineTurn(async function* () {
          yield { delta: "Approved hours." };
          yield { done: true };
        });
        assert.ok(
          (
            await query(
              "SELECT * FROM chatbot_turns WHERE state='completed' AND actual_micro_usd IS NULL AND reserved_micro_usd>0",
            )
          ).length,
        );
      },
    );
    await t.test(
      "public flow uses one-use proof, server enforced consent, scoped leads and pending booking workflow",
      async () => {
        let callbacks = [];
        const publicBot = async (id) => {
          const b = (
            await query("SELECT * FROM chatbots WHERE id=$1", [id])
          )[0];
          return {
            ...b,
            settings: model.settings(b.settings),
            limits: (
              await query("SELECT * FROM chatbot_limits($1)", [
                b.organization_id,
              ])
            )[0],
          };
        };
        const publicApi = load("../src/lib/chatbot/public.ts", {
          "server-only": {},
          "next/server": { after: (f) => callbacks.push(f) },
          "./store": {
            query,
            publicBot,
            session: async (token) =>
              (
                await query(
                  "SELECT * FROM chatbot_sessions WHERE token_hash=$1",
                  [sha(token)],
                )
              )[0],
            hash: sha,
            secret: () => randomUUID().replaceAll("-", "").repeat(2),
            requestRate: async () => {},
            history: async () => [],
            allowedOrigin: async () => false,
          },
          "./model": model,
          "@/lib/deepseek": { isDeepSeekConfigured: () => false },
          "./engine": engine,
        });
        const req = (data) =>
          new Request("https://business.jktl.com.ng/api/chatbots/session", {
            method: "POST",
            headers: {
              Origin: "https://business.jktl.com.ng",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
          });
        const proof = "a".repeat(64);
        await query(
          "INSERT INTO chatbot_tickets VALUES($1,$2,'https://example.org','embed',now()+interval '10 minutes')",
          [sha(proof), bot.id],
        );
        const started = await (
          await publicApi.startSession(req({ botId: bot.id, ticket: proof }))
        ).json();
        await assert.rejects(
          publicApi.startSession(req({ botId: bot.id, ticket: proof })),
          /TICKET_EXPIRED/,
        );
        const input = {
          token: started.token,
          kind: "handoff",
          name: "Test visitor",
          enquiry: "Please help",
          requestId: randomUUID(),
        };
        await assert.rejects(publicApi.lead(req(input)), /INVALID_REQUEST/);
        await publicApi.lead(req({ ...input, consent: true }));
        await publicApi.lead(req({ ...input, consent: true }));
        assert.equal(
          (await query("SELECT * FROM chatbot_leads WHERE bot_id=$1", [bot.id]))
            .length,
          1,
        );
        assert.equal(
          (await query("SELECT * FROM chatbot_notice_outbox")).length,
          1,
        );
        assert.equal(
          (
            await query(
              "SELECT leads_count,handoffs_count FROM chatbots WHERE id=$1",
              [bot.id],
            )
          )[0].leads_count,
          1,
        );
        await query(
          "UPDATE website_plan_subscriptions SET plan_id='starter',period_end=now()+interval '30 days' WHERE organization_id=$1",
          [org],
        );
        const service = (
          await query(
            "INSERT INTO services(organization_id,name,price_kobo,duration_min) VALUES($1,'Consultation',500000,30) RETURNING id",
            [org],
          )
        )[0];
        const future = new Date(Date.now() + 86400000 * 5)
          .toISOString()
          .slice(0, 10);
        await publicApi.lead(
          req({
            ...input,
            kind: "appointment",
            consent: true,
            email: "visitor@example.invalid",
            phone: "+2348000000000",
            serviceId: service.id,
            date: future,
            time: "11:30",
            requestId: randomUUID(),
          }),
        );
        const booking = (
          await query("SELECT * FROM bookings WHERE organization_id=$1", [org])
        )[0];
        assert.equal(booking.status, "pending");
        assert.equal(booking.source, "public_site");
        assert.equal(booking.price_kobo, 500000);
        await assert.rejects(
          publicApi.lead(
            req({
              ...input,
              kind: "appointment",
              consent: true,
              email: "visitor@example.invalid",
              phone: "+2348000000000",
              serviceId: randomUUID(),
              date: future,
              time: "11:30",
              requestId: randomUUID(),
            }),
          ),
          /INVALID_REQUEST/,
        );
        assert.equal(
          (
            await query(
              "SELECT * FROM chatbot_leads WHERE organization_id=$1",
              [other],
            )
          ).length,
          0,
        );
        // Do not execute notification callbacks; no real mail/push during tests.
        assert.equal(callbacks.length, 2);
      },
    );
    await t.test(
      "authorized domains are exact, expiring and revocable; session privacy follows current retention",
      async () => {
        const store = load("../src/lib/chatbot/store.ts", {
          "server-only": {},
          "node:crypto": await import("node:crypto"),
          "@/lib/db/client": { getSql: () => ({ query }) },
          "@/lib/session": { getSession: async () => null },
          "@/lib/partners/access": {},
          "./model": model,
        });
        await query(
          "INSERT INTO chatbot_domains(bot_id,organization_id,hostname,verification_token,verified_at) VALUES($1,$2,'example.org','test',now())",
          [bot.id, org],
        );
        assert.equal(
          await store.allowedOrigin(bot, "https://example.org"),
          true,
        );
        assert.equal(
          await store.allowedOrigin(bot, "https://evil.example.org"),
          false,
        );
        const s = await newSession();
        await query("UPDATE chatbot_sessions SET kind='embed' WHERE id=$1", [
          s.id,
        ]);
        await store.session(s.token);
        await query("DELETE FROM chatbot_domains WHERE bot_id=$1", [bot.id]);
        await assert.rejects(store.session(s.token), /ORIGIN_DENIED/);
        await query(
          "UPDATE chatbot_sessions SET kind='standalone',created_at=now()-interval '40 days' WHERE id=$1",
          [s.id],
        );
        await assert.rejects(store.session(s.token), /CHAT_SESSION_EXPIRED/);
        await store.rate("test", 1);
        await assert.rejects(store.rate("test", 1), /RATE_LIMIT/);
      },
    );
    await t.test(
      "partner must be approved and explicitly granted this client scope; public id cannot manage data",
      async () => {
        const partner = randomUUID();
        let current = null,
          approved = false;
        const store = load("../src/lib/chatbot/store.ts", {
          "server-only": {},
          "node:crypto": await import("node:crypto"),
          "@/lib/db/client": { getSql: () => ({ query }) },
          "@/lib/session": { getSession: async () => current },
          "@/lib/partners/access": {
            approvedPartner: async () => {
              if (!approved) throw Error("Not approved");
              return { id: partner };
            },
          },
          "./model": model,
        });
        await assert.rejects(store.actor(), /Sign in/);
        await assert.rejects(store.actor(org), /Not approved/);
        approved = true;
        await assert.rejects(store.actor(org), /not authorized/);
        const grantor = randomUUID(),
          invitation = randomUUID();
        await query(
          "INSERT INTO users(id,name,email,password_hash) VALUES($1,'Grantor','grantor@example.invalid','disabled')",
          [grantor],
        );
        await query(
          "INSERT INTO affiliates(id,name,email,password_hash,referral_code,programme,partner_terms_confirmed) VALUES($1,'Partner','partner@example.invalid','disabled','chatbot-partner','partner',true)",
          [partner],
        );
        await query(
          "INSERT INTO partner_client_invitations(id,partner_id,token_hash,label) VALUES($1,$2,'chatbot-test-proof','Test client')",
          [invitation, partner],
        );
        await query(
          "INSERT INTO partner_client_access(partner_id,organization_id,invitation_id,granted_by,scopes) VALUES($1,$2,$3,$4,ARRAY['MANAGE_CHATBOT'])",
          [partner, org, invitation, grantor],
        );
        assert.equal((await store.actor(org)).org, org);
        await query(
          "UPDATE partner_client_access SET revoked_at=now() WHERE partner_id=$1",
          [partner],
        );
        await assert.rejects(store.actor(org), /not authorized/);
        await assert.rejects(store.botFor(other, bot.id), /not found/);
      },
    );
    await t.test(
      "paid bot count and deterministic builder selection honor downgrades",
      async () => {
        await query(
          "UPDATE website_plan_subscriptions SET plan_id='growth',period_end=now()+interval '1 day' WHERE organization_id=$1",
          [org],
        );
        const extra = (
          await query(
            "SELECT * FROM chatbot_create($1,'paid-second','Second','test')",
            [org],
          )
        )[0];
        await query("SELECT chatbot_select_builder($1,$2,true)", [org, bot.id]);
        await query("SELECT chatbot_select_builder($1,$2,true)", [
          org,
          extra.id,
        ]);
        assert.equal(
          (
            await query(
              "SELECT * FROM chatbots WHERE organization_id=$1 AND install_on_builder",
              [org],
            )
          )[0].id,
          extra.id,
        );
        assert.equal(
          (await query("SELECT chatbot_eligible($1) AS ok", [extra.id]))[0].ok,
          true,
        );
        await query(
          "UPDATE website_plan_subscriptions SET period_end=now()-interval '1 day' WHERE organization_id=$1",
          [org],
        );
        assert.equal(
          (await query("SELECT chatbot_eligible($1) AS ok", [extra.id]))[0].ok,
          false,
        );
        await query("UPDATE chatbots SET enabled=false WHERE id=$1", [bot.id]);
        assert.equal(
          (await query("SELECT chatbot_eligible($1) AS ok", [extra.id]))[0].ok,
          true,
        );
      },
    );
    await t.test(
      "notification outbox retries failed push without resending accepted email",
      async () => {
        const keys = [
            "RESEND_API_KEY",
            "VAPID_PRIVATE_KEY",
            "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
          ],
          saved = keys.map((k) => process.env[k]);
        let emails = 0,
          pushReady = false;
        for (const key of keys) process.env[key] = "mock-test-value";
        const notices = load("../src/lib/chatbot/notifications.ts", {
          "server-only": {},
          "./store": { query },
          "@/lib/db/organizations": {
            getOwnerEmail: async () => "owner@example.invalid",
          },
          "@/lib/email": {
            sendChatbotLeadEmail: async () => {
              emails++;
              return { ok: true };
            },
          },
          "@/lib/push": { sendBroadcastPush: async () => (pushReady ? 1 : 0) },
          "@/lib/db/push": {
            getNotificationPrefs: async () => ({ pushEnabled: true }),
            listSubscriptions: async () => [
              { endpoint: "mock://subscription" },
            ],
          },
        });
        try {
          await notices.processChatbotNotices();
          assert.equal(emails, 2);
          assert.equal(
            (
              await query(
                "SELECT count(*)::int AS n FROM chatbot_notice_outbox WHERE push_sent_at IS NULL",
              )
            )[0].n,
            2,
          );
          await query("UPDATE chatbot_notice_outbox SET lease_until=NULL");
          pushReady = true;
          await notices.processChatbotNotices();
          assert.equal(emails, 2);
          assert.equal(
            (
              await query(
                "SELECT count(*)::int AS n FROM chatbot_notice_outbox WHERE push_sent_at IS NOT NULL",
              )
            )[0].n,
            2,
          );
        } finally {
          keys.forEach((key, index) => {
            if (saved[index] === undefined) delete process.env[key];
            else process.env[key] = saved[index];
          });
        }
      },
    );
    // Fresh migration defaults do not overwrite deliberate administrator choices on replay.
    await query(
      "UPDATE chatbot_entitlements SET responses=123 WHERE plan_id='free'",
    );
    await db.exec(
      readFileSync(
        new URL("../migrations/066_ai_chatbot.sql", import.meta.url),
        "utf8",
      ),
    );
    assert.equal(
      (
        await query(
          "SELECT responses FROM chatbot_entitlements WHERE plan_id='free'",
        )
      )[0].responses,
      123,
    );
  } finally {
    await db.close();
  }
});
test("input/origin validation and knowledge retrieval reject dangerous inputs without HTML rendering", () => {
  assert.equal(model.origin("https://example.org/path"), null);
  assert.equal(model.origin("javascript:alert(1)"), null);
  assert.equal(model.origin("https://user:pass@example.org"), null);
  assert.throws(() => model.hostname("127.0.0.1"));
  assert.throws(() => model.hostname("localhost"));
  assert.throws(() => model.settings({ avatar: "javascript:alert(1)" }));
  assert.equal(
    model.exactFAQ("OPENING HOURS?", [
      { title: "Opening hours", content: "9–5" },
    ]),
    "9–5",
  );
  assert.deepEqual(
    model
      .retrieve("hours", [
        { title: "Opening hours", content: "9–5" },
        { title: "Secret unrelated", content: "other" },
      ])
      .map((x) => x.title),
    ["Opening hours"],
  );
});

test("provider SSE adapter handles split chunks and verified usage; broken JSON or incomplete streams fail closed", async () => {
  const provider = load("../src/lib/deepseek.ts", { "server-only": {} }),
    savedFetch = globalThis.fetch,
    savedKey = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = "mock-test-key-not-a-credential";
  const invoke = async (raw) => {
    globalThis.fetch = async (url, init) => {
      const request = JSON.parse(init.body);
      assert.equal(request.model, "verified-test-model");
      assert.equal(request.stream, true);
      return new Response(
        new ReadableStream({
          start(controller) {
            const bytes = new TextEncoder().encode(raw);
            for (let offset = 0; offset < bytes.length; offset += 7)
              controller.enqueue(bytes.slice(offset, offset + 7));
            controller.close();
          },
        }),
      );
    };
    const events = [];
    for await (const event of provider.chatStream({
      model: "verified-test-model",
      maxTokens: 128,
      messages: [{ role: "user", content: "Test" }],
    }))
      events.push(event);
    return events;
  };
  try {
    // Artificial fixtures, not responses represented as provider-verified examples.
    const events = await invoke(
      'data: {"choices":[{"delta":{"content":"Hello 🌍"}}]}\n\ndata: {"usage":{"prompt_tokens":18,"completion_tokens":4}}\n\ndata: [DONE]\n\n',
    );
    assert.deepEqual(events, [
      { delta: "Hello 🌍" },
      { usage: { input: 18, output: 4 } },
      { done: true },
    ]);
    await assert.rejects(invoke("data: not-json\n\n"));
    await assert.rejects(
      invoke('data: {"choices":[{"delta":{"content":"Partial"}}]}\n\n'),
      /AI_INCOMPLETE_STREAM/,
    );
  } finally {
    globalThis.fetch = savedFetch;
    if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = savedKey;
  }
});
