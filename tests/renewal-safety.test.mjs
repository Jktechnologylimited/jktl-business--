import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import { reminderBucket, renewalMessage } from "../src/lib/renewals/model.ts";
const require = createRequire(import.meta.url);
function load(file, deps) {
  const m = { exports: {} };
  new Function(
    "require",
    "module",
    "exports",
    ts.transpileModule(
      readFileSync(new URL("../" + file, import.meta.url), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
  )((n) => (n in deps ? deps[n] : require(n)), m, m.exports);
  return m.exports;
}
test("catch-up selects one reminder window, never all missed messages or fabricated amounts", () => {
  for (const [days, bucket] of [
    [31, null],
    [30, "30"],
    [29, "30"],
    [15, "30"],
    [14, "14"],
    [8, "14"],
    [7, "7"],
    [2, "7"],
    [1, "1"],
    [0, "due"],
    [-1, "due"],
    [-7, "overdue-7"],
    [-30, "overdue-7"],
    [-31, null],
  ])
    assert.equal(reminderBucket(days), bucket);
  assert.equal(reminderBucket(null), null);
  const mail = renewalMessage({
    kind: "DOMAIN",
    name: "example.test",
    due_on: "2026-12-01",
    days_left: 7,
    business_name: "Example",
    path: "/business/domains",
  });
  assert.doesNotMatch(mail.detail, /Recorded amount/);
  assert.match(mail.detail, /before paying again/);
});
test("register, owner contacts, duplicate protection, missed runs, stale dates, retries and ambiguous submissions use real SQL", async () => {
  const db = new PGlite();
  try {
    const query = async (s, p = []) => (await db.query(s, p)).rows,
      org = crypto.randomUUID(),
      user = crypto.randomUUID();
    await db.exec(
      `CREATE TABLE organizations(id uuid PRIMARY KEY,name text);CREATE TABLE users(id uuid PRIMARY KEY,email text);CREATE TABLE business_profiles(organization_id uuid,display_name text);CREATE TABLE organization_members(id uuid DEFAULT gen_random_uuid(),organization_id uuid,user_id uuid,email text,role text,active boolean,created_at timestamptz DEFAULT now());CREATE TABLE domain_assets(id uuid DEFAULT gen_random_uuid(),organization_id uuid,domain text,expires_at timestamptz);CREATE TABLE website_plan_subscriptions(organization_id uuid,plan_id text,period_end timestamptz,status text,cancel_at_period_end boolean DEFAULT false);CREATE TABLE infrastructure_accounts(id uuid DEFAULT gen_random_uuid(),organization_id uuid,plan_name text,renewal_date date,price_kobo_per_year bigint,subscription_status text);CREATE TABLE email_services(id uuid DEFAULT gen_random_uuid(),organization_id uuid,domain text,renews_at timestamptz,period_price_kobo bigint,license_type text,status text);CREATE TABLE custom_projects(id uuid PRIMARY KEY,organization_id uuid,status text);CREATE TABLE custom_services(id uuid DEFAULT gen_random_uuid(),organization_id uuid,project_id uuid,category text,name text,next_due_on date,amount_kobo bigint,discount_kobo bigint,status text,accepted_at timestamptz,interval text);CREATE TABLE domain_outbox(id serial,organization_id uuid,domain text,sent_at timestamptz,event text);CREATE TABLE email_outbox(id serial,organization_id uuid,sent_at timestamptz,event_key text);CREATE TABLE custom_outbox(id serial,sent_at timestamptz,event_key text);CREATE TABLE custom_invoices(id uuid,service_id uuid,due_on date);CREATE TABLE email_send_history(attempt_key text,provider_state text,provider_message_id text);`,
    );
    const sql = readFileSync(
      new URL("../migrations/068_renewal_safety.sql", import.meta.url),
      "utf8",
    );
    await db.exec(sql);
    await db.exec(sql);
    await query("INSERT INTO organizations VALUES($1,'Example')", [org]);
    await query("INSERT INTO users VALUES($1,'current@example.test')", [user]);
    await query(
      "INSERT INTO organization_members(organization_id,user_id,email,role,active) VALUES($1,$2,'stale@example.test','owner',true)",
      [org, user],
    );
    await query("INSERT INTO business_profiles VALUES($1,'Example')", [org]);
    await query(
      "INSERT INTO infrastructure_accounts(organization_id,plan_name,renewal_date,price_kobo_per_year,subscription_status) VALUES($1,'Free defaults',CURRENT_DATE+14,5000000,'inactive')",
      [org],
    );
    assert.equal((await query("SELECT * FROM renewal_items")).length, 0);
    const asset = (
      await query(
        "INSERT INTO domain_assets(organization_id,domain,expires_at) VALUES($1,'example.test',now()+interval '29 days') RETURNING id",
        [org],
      )
    )[0].id;
    await query(
      "INSERT INTO email_services(organization_id,domain,license_type,status) VALUES($1,'example.test','PAID','ACTIVE'),($1,'free.example.test','LEGACY_FREE','ACTIVE')",
      [org],
    );
    let items = await query("SELECT * FROM renewal_items");
    assert.equal(items.length, 2);
    assert.ok(items.every((i) => i.recipient === "current@example.test"));
    assert.equal(items.filter((i) => !i.due_on).length, 1);
    let submissions = 0,
      mode = "accepted",
      captured = [];
    const service = load("src/lib/renewals/service.ts", {
      "server-only": {},
      "@/lib/db/push": {
        getNotificationPrefs: async () => ({ pushEnabled: false }),
      },
      "@/lib/push": { sendPush: async () => {} },
      "@/lib/custom/service": { query },
      "@/lib/mail/addresses": {
        mailAddress: (v) =>
          typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
            ? v.toLowerCase()
            : "",
      },
      "@/lib/email": {
        sendCustomNoticeEmail: async (p) => {
          submissions++;
          captured.push(p);
          return mode === "accepted"
            ? { ok: true, providerId: "fixture-id" }
            : mode === "unknown"
              ? { ok: false, uncertain: true }
              : { ok: false };
        },
      },
      "./model": { reminderBucket, renewalMessage },
    });
    assert.equal(await service.centralRenewalsEnabled(), false);
    assert.equal(await service.runCentralRenewals(), null);
    assert.equal(submissions, 0);
    const key = "domain:" + asset;
    await assert.rejects(
      service.queueRenewal(items.find((i) => !i.due_on).item_key, true),
      /renewal date/,
    );
    const ids = await Promise.all([
      service.queueRenewal(key, true),
      service.queueRenewal(key, true),
    ]);
    assert.equal(ids.filter(Boolean).length, 1);
    await service.dispatchRenewals();
    await service.dispatchRenewals();
    assert.equal(submissions, 1);
    assert.equal(
      (await query("SELECT state FROM renewal_reminders"))[0].state,
      "ACCEPTED",
    );
    assert.equal(await service.queueRenewal(key, true), null);
    // A verified renewal changing the source date cancels a queued reminder.
    await query("UPDATE renewal_reminders SET state='CANCELLED'");
    await query(
      "UPDATE domain_assets SET expires_at=expires_at+interval '1 year'",
    );
    await service.queueRenewal(key, true);
    await query(
      "UPDATE domain_assets SET expires_at=expires_at+interval '1 year'",
    );
    await service.dispatchRenewals();
    assert.equal(submissions, 1);
    assert.equal(
      (
        await query(
          "SELECT count(*)::int n FROM renewal_reminders WHERE state='CANCELLED'",
        )
      )[0].n,
      2,
    );
    // Missed-day catch-up is atomic and sends one current-window message.
    await query("UPDATE domain_assets SET expires_at=now()+interval '8 days'");
    await query("UPDATE renewal_settings SET enabled=true");
    let result = await service.runCentralRenewals();
    assert.equal(result.queued, 1);
    assert.equal(result.accepted, 1);
    assert.equal(
      (
        await query(
          "SELECT bucket FROM renewal_reminders WHERE state='ACCEPTED' ORDER BY created_at DESC LIMIT 1",
        )
      )[0].bucket,
      "14",
    );
    await service.runCentralRenewals();
    assert.equal(submissions, 2);
    // Ambiguous provider submission is held and cannot be blindly re-sent.
    await query("UPDATE domain_assets SET expires_at=now()+interval '6 days'");
    mode = "unknown";
    await service.queueRenewal(key, true);
    await service.dispatchRenewals();
    assert.equal(submissions, 3);
    assert.equal(
      (
        await query(
          "SELECT count(*)::int n FROM renewal_reminders WHERE state='UNKNOWN'",
        )
      )[0].n,
      1,
    );
    await service.dispatchRenewals();
    assert.equal(submissions, 3);
    // Crash after the provider accepted is reconciled from existing send history.
    const unknown = (
      await query("SELECT id FROM renewal_reminders WHERE state='UNKNOWN'")
    )[0].id;
    await query(
      "UPDATE renewal_reminders SET state='SUBMITTING',lease_until=now()-interval '1 minute' WHERE id=$1",
      [unknown],
    );
    await query(
      "INSERT INTO email_send_history VALUES($1,'ACCEPTED','provider-confirmed')",
      ["renewal-" + unknown],
    );
    await service.reconcileRenewals();
    assert.equal(
      (
        await query("SELECT state FROM renewal_reminders WHERE id=$1", [
          unknown,
        ])
      )[0].state,
      "ACCEPTED",
    );
    // Known failures stop after three attempts; payload and idempotency key stay stable.
    await query("UPDATE domain_assets SET expires_at=now()+interval '5 days'");
    mode = "failed";
    await service.queueRenewal(key, true);
    for (let i = 0; i < 4; i++) {
      await query(
        "UPDATE renewal_reminders SET next_attempt_at=now()-interval '1 second' WHERE state='FAILED'",
      );
      await service.dispatchRenewals();
    }
    assert.equal(submissions, 6);
    const failed = (
      await query("SELECT * FROM renewal_reminders WHERE state='FAILED'")
    )[0];
    assert.equal(failed.attempts, 3);
    assert.equal(captured.at(-1).key, captured.at(-2).key);
    assert.equal(captured.at(-1).detail, captured.at(-2).detail);
    // Legacy receipts survive while old renewal jobs are explicitly superseded.
    await query(
      "INSERT INTO domain_outbox(event) VALUES('Domain renewal reminder'),('Domain registered')",
    );
    const gate = await service.legacyRenewalGate("domain_outbox");
    assert.equal(gate.enabled, true);
    await query("UPDATE renewal_settings SET enabled=false");
    await query(
      "INSERT INTO domain_outbox(organization_id,domain,event) VALUES($1,'example.test','Domain renewal reminder')",
      [org],
    );
    const manualGate = await service.legacyRenewalGate("domain_outbox");
    assert.equal(manualGate.enabled, false);

    assert.equal(
      (
        await query(
          "SELECT count(*)::int n FROM domain_outbox WHERE renewal_superseded_at IS NOT NULL",
        )
      )[0].n,
      2,
    );
  } finally {
    await db.close();
  }
});

test("renewal controls reject unauthorized operators before reading records or sending mail", async () => {
  let calls = 0;
  const actions = load("src/lib/actions/renewal-actions.ts", {
    "next/server": {
      after: () => {
        throw Error("must not schedule mail");
      },
    },
    "next/cache": { revalidatePath: () => {} },
    "@/lib/admin-session": {
      requireAdminCapability: async (cap) => {
        assert.equal(cap, "manage_communications");
        throw Error("Denied");
      },
    },
    "@/lib/custom/service": {
      query: async () => {
        calls++;
        return [];
      },
    },
    "@/lib/mail/addresses": { mailAddress: () => "" },
    "@/lib/renewals/service": {
      queueRenewal: async () => {
        calls++;
      },
      dispatchRenewals: async () => {
        calls++;
      },
      reconcileRenewals: async () => {
        calls++;
      },
    },
  });
  for (const name of [
    "configureRenewalsAction",
    "sendRenewalAction",
    "processRenewalsAction",
    "retryRenewalAction",
    "saveTrackedRenewalAction",
    "confirmRenewalAcceptanceAction",
    "runRenewalCheckAction",
  ])
    await assert.rejects(actions[name](new FormData()), /Denied/);
  assert.equal(calls, 0);
});
