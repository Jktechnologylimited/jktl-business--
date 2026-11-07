import test from "node:test";
import assert from "node:assert/strict";
import { fixture, load } from "./fixtures/lifecycle-db.mjs";
import {
  lifecycleStep,
  lifecycleSettings,
  lifecycleMessage,
} from "../src/lib/lifecycle/model.ts";
const cfg = {
  enabled: true,
  first_days: 3,
  second_days: 7,
  human_days: 14,
  gap_days: 3,
};
const form = (values) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, String(v));
  return f;
};
test("stage timing catches up once, uses editable valid days and never changes customer designs or invents domain prices", () => {
  assert.equal(lifecycleStep(2.9, cfg), null);
  assert.equal(lifecycleStep(3, cfg), 1);
  assert.equal(lifecycleStep(8, cfg), 2);
  assert.equal(lifecycleStep(14, cfg), null);
  assert.throws(() =>
    lifecycleSettings(form({ ...cfg, enabled: "on", second_days: 2 })),
  );
  assert.deepEqual(lifecycleSettings(form({ ...cfg, enabled: "on" })), cfg);
  assert.match(
    lifecycleMessage("DRAFT", 2, "Example", false).detail,
    /do not need to choose a template again/,
  );
  assert.equal(
    lifecycleMessage("FREE_DOMAIN", 1, "Example", false).category,
    "marketing",
  );
  assert.equal(
    lifecycleMessage("CONNECT_DOMAIN", 1, "Example", true).category,
    "service",
  );
  assert.throws(() => lifecycleMessage("MANAGED", 1, "Example", false));
  for (const stage of ["NO_SITE", "DRAFT", "FREE_DOMAIN", "CONNECT_DOMAIN"]) {
    const message = lifecycleMessage(
      stage,
      1,
      "Example",
      stage === "CONNECT_DOMAIN",
      true,
    );
    assert.equal(message.path, "/business/plans");
    assert.equal(message.actionLabel, "Choose my website plan");
    assert.equal(message.category, "marketing");
    assert.ok(message.secondaryPath.startsWith("/business/"));
    assert.match(message.detail, /payment requires your confirmation/);
  }
  assert.equal(
    lifecycleMessage("DRAFT", 1, "Example", false).actionLabel,
    "Finish publishing my website",
  );
});
test("consented subscription follow-ups render the plan CTA and retain the current website editor", async () => {
  const f = await fixture();
  try {
    const a = await f.account("DRAFT");
    await f.q(
      "UPDATE email_preferences SET marketing_opt_in=true WHERE email=$1",
      [a.email],
    );
    await f.svc.reconcileLifecycle();
    await f.age(a.id, 4);
    await f.svc.reconcileLifecycle();
    assert.equal((await f.svc.dispatchLifecycle()).accepted, 1);
    assert.equal(f.sent[0].category, "marketing");
    assert.match(f.sent[0].bodyHtml, /Choose my website plan/);
    assert.match(
      f.sent[0].bodyHtml,
      /https:\/\/business.jktl.com.ng\/business\/plans/,
    );
    assert.match(f.sent[0].bodyHtml, /Finish publishing my website/);
    assert.match(f.sent[0].text, /\/business\/website\/template/);
  } finally {
    await f.db.close();
  }
});
test("all customers join prospectively, each progress stage resets its clock, stale queues cancel, and custom projects are excluded from start-over prompts", async () => {
  const f = await fixture();
  try {
    const prospect = crypto.randomUUID();
    await f.q(
      "INSERT INTO organizations(id,name,slug) VALUES($1,'Unclaimed prospect','prospect')",
      [prospect],
    );
    const a = await f.account(),
      b = await f.account("DRAFT"),
      c = await f.account("FREE_DOMAIN"),
      d = await f.account("COMPLETE"),
      e = await f.account("MANAGED"),
      g = await f.account("CONNECT_DOMAIN");
    await f.svc.reconcileLifecycle();
    assert.equal(
      (await f.q("SELECT count(*)::int n FROM lifecycle_accounts"))[0].n,
      6,
    );
    assert.equal(
      (await f.q("SELECT count(*)::int n FROM lifecycle_events"))[0].n,
      0,
    );
    const before = (
      await f.q("SELECT * FROM lifecycle_accounts WHERE organization_id=$1", [
        a.id,
      ])
    )[0];
    assert.ok(new Date(before.stage_started_at) > new Date(Date.now() - 60000));
    await f.age(a.id, 3);
    await f.svc.reconcileLifecycle();
    assert.equal(
      (await f.q("SELECT count(*)::int n FROM lifecycle_events"))[0].n,
      1,
    );
    await f.q(
      "UPDATE business_profiles SET website_template_id='law-firm' WHERE organization_id=$1",
      [a.id],
    );
    await f.svc.reconcileLifecycle();
    const after = (
      await f.q("SELECT * FROM lifecycle_accounts WHERE organization_id=$1", [
        a.id,
      ])
    )[0];
    assert.equal(after.stage, "DRAFT");
    assert.notEqual(after.cycle, before.cycle);
    assert.equal(
      (await f.q("SELECT state FROM lifecycle_events"))[0].state,
      "CANCELLED",
    );
    await f.age(b.id, 3);
    await f.svc.reconcileLifecycle();
    await f.q(
      "UPDATE business_profiles SET published=true WHERE organization_id=$1",
      [b.id],
    );
    assert.equal((await f.svc.dispatchLifecycle()).accepted, 0);
    const fresh = await f.account();
    await f.svc.reconcileLifecycle();
    assert.ok(
      (
        await f.q("SELECT 1 FROM lifecycle_accounts WHERE organization_id=$1", [
          fresh.id,
        ])
      ).length,
    );
    assert.equal(
      (
        await f.q(
          "SELECT stage FROM lifecycle_accounts WHERE organization_id=$1",
          [e.id],
        )
      )[0].stage,
      "MANAGED",
    );
    assert.equal(
      (
        await f.q(
          "SELECT stage FROM lifecycle_accounts WHERE organization_id=$1",
          [g.id],
        )
      )[0].stage,
      "CONNECT_DOMAIN",
    );
  } finally {
    await f.db.close();
  }
});
test("once-per-step sending, shared owner cooldown, opt-outs, domain consent, and human fallback use real isolated PostgreSQL", async () => {
  const f = await fixture();
  try {
    const a = await f.account(),
      b = await f.account("DRAFT", a.email),
      c = await f.account("FREE_DOMAIN"),
      d = await f.account("CONNECT_DOMAIN"),
      e = await f.account();
    await f.q(
      "UPDATE email_preferences SET marketing_suppressed=true WHERE email=$1",
      [e.email],
    );
    await f.svc.reconcileLifecycle();
    for (const v of [a, b, c, d, e]) await f.age(v.id, 3);
    await f.svc.reconcileLifecycle();
    assert.equal(
      (await f.q("SELECT count(*)::int n FROM lifecycle_events"))[0].n,
      3,
    );
    let result = await f.svc.dispatchLifecycle();
    assert.equal(result.accepted, 2);
    assert.equal(f.sent.length, 2);
    assert.ok(f.sent.every((m) => !m.bodyHtml.includes("<Business>")));
    assert.equal((await f.svc.dispatchLifecycle()).accepted, 0);
    await f.q(
      "UPDATE lifecycle_events SET updated_at=now()-interval '4 days' WHERE state='ACCEPTED'",
    );
    assert.equal((await f.svc.dispatchLifecycle()).accepted, 1);
    await f.q(
      "UPDATE email_preferences SET marketing_opt_in=true WHERE email=$1",
      [c.email],
    );
    await f.svc.reconcileLifecycle();
    assert.equal((await f.svc.dispatchLifecycle()).accepted, 1);
    assert.equal(f.sent.at(-1).category, "marketing");
    await f.age(a.id, 8);
    await f.svc.reconcileLifecycle();
    await f.svc.reconcileLifecycle();
    assert.equal(
      (
        await f.q(
          "SELECT count(*)::int n FROM lifecycle_events WHERE organization_id=$1 AND step=2",
          [a.id],
        )
      )[0].n,
      1,
    );
    await f.age(a.id, 14);
    await f.svc.reconcileLifecycle();
    await f.svc.reconcileLifecycle();
    assert.equal(
      (
        await f.q(
          "SELECT count(*)::int n FROM lifecycle_handoffs WHERE organization_id=$1 AND cycle_key LIKE 'stage:%'",
          [a.id],
        )
      )[0].n,
      1,
    );
    await f.q(
      "UPDATE business_profiles SET published=true,custom_domain='example.test',custom_domain_verified=true WHERE organization_id=$1",
      [a.id],
    );
    await f.svc.reconcileLifecycle();
    assert.equal(
      (
        await f.q(
          "SELECT status FROM lifecycle_handoffs WHERE organization_id=$1",
          [a.id],
        )
      )[0].status,
      "DONE",
    );
  } finally {
    await f.db.close();
  }
});
test("missed-day catch-up, pauses, changed owners and settings revalidation prevent stale or premature emails", async () => {
  const f = await fixture();
  try {
    const a = await f.account();
    await f.svc.reconcileLifecycle();
    await f.age(a.id, 3);
    await f.svc.reconcileLifecycle();
    await f.age(a.id, 9);
    await f.svc.reconcileLifecycle();
    assert.deepEqual(
      (await f.q("SELECT step,state FROM lifecycle_events ORDER BY step")).map(
        (v) => [v.step, v.state],
      ),
      [
        [1, "CANCELLED"],
        [2, "QUEUED"],
      ],
    );
    await f.actions.pauseLifecycleAction(
      form({ organization: a.id, until: "2099-01-01" }),
    );
    assert.equal((await f.svc.dispatchLifecycle()).accepted, 0);
    assert.equal(f.sent.length, 0);
    await f.actions.pauseLifecycleAction(
      form({ organization: a.id, until: "" }),
    );
    await f.q("UPDATE users SET email=$2 WHERE id=$1", [
      a.user,
      "changed@example.test",
    ]);
    assert.equal((await f.svc.dispatchLifecycle()).accepted, 0);
    await f.svc.reconcileLifecycle();
    const b = await f.account();
    await f.svc.reconcileLifecycle();
    await f.age(b.id, 3);
    await f.svc.reconcileLifecycle();
    await f.q("UPDATE lifecycle_settings SET first_days=4 WHERE id=true");
    assert.equal((await f.svc.dispatchLifecycle()).accepted, 0);
    assert.equal(
      (
        await f.q(
          "SELECT attempts FROM lifecycle_events WHERE organization_id=$1",
          [b.id],
        )
      )[0].attempts,
      0,
    );
    await f.q("UPDATE lifecycle_settings SET enabled=false WHERE id=true");
    assert.equal((await f.svc.dispatchLifecycle()).accepted, 0);
  } finally {
    await f.db.close();
  }
});
test("ambiguous acceptance is held for human review, confirmed failures have bounded retries, and lost leases reconcile from provider history", async () => {
  const f = await fixture();
  try {
    const a = await f.account();
    await f.svc.reconcileLifecycle();
    await f.age(a.id, 3);
    await f.svc.reconcileLifecycle();
    f.transport.outcome = "unknown";
    assert.equal((await f.svc.dispatchLifecycle()).unknown, 1);
    assert.equal((await f.svc.dispatchLifecycle()).accepted, 0);
    assert.equal(f.sent.length, 1);
    assert.equal(
      (await f.q("SELECT count(*)::int n FROM lifecycle_handoffs"))[0].n,
      1,
    );
    const event = (await f.q("SELECT id FROM lifecycle_events"))[0];
    await assert.rejects(() =>
      f.actions.reviewLifecycleMailAction(
        form({
          id: event.id,
          decision: "RETRY",
          reason: "Checked provider records.",
        }),
      ),
    );
    await f.actions.reviewLifecycleMailAction(
      form({
        id: event.id,
        decision: "RETRY",
        reason: "Provider confirmed not submitted.",
        notAccepted: "on",
      }),
    );
    f.transport.outcome = "failed";
    await f.svc.dispatchLifecycle();
    await f.q(
      "UPDATE lifecycle_events SET attempts=2,next_attempt_at=now() WHERE id=$1",
      [event.id],
    );
    await f.svc.dispatchLifecycle();
    assert.equal(
      (await f.q("SELECT attempts FROM lifecycle_events"))[0].attempts,
      3,
    );
    assert.equal((await f.svc.dispatchLifecycle()).failed, 0);
    await f.q(
      "UPDATE lifecycle_events SET state='SUBMITTING',lease_until=now()-interval '1 minute' WHERE id=$1",
      [event.id],
    );
    await f.q(
      "INSERT INTO email_send_history VALUES($1,'ACCEPTED','confirmed-provider')",
      ["lifecycle-" + event.id],
    );
    await f.svc.reconcileLifecycleMail();
    assert.equal(
      (await f.q("SELECT state FROM lifecycle_events"))[0].state,
      "ACCEPTED",
    );
  } finally {
    await f.db.close();
  }
});
test("renewal fallback closes on the next paid cycle; role checks, assignment and revision checks protect team actions", async () => {
  const f = await fixture();
  try {
    const a = await f.account();
    await f.svc.reconcileLifecycle();
    await f.q(
      "INSERT INTO renewal_items VALUES('domain:fixture',$1,$2,current_date-8,-8,'Example domain')",
      [a.id, a.email],
    );
    await f.svc.reconcileLifecycle();
    let h = (await f.q("SELECT * FROM lifecycle_handoffs"))[0];
    await f.actions.saveLifecycleHandoffAction(
      form({
        id: h.id,
        revision: h.revision,
        status: "IN_PROGRESS",
        assigned: f.actor.id,
        notes: "Reviewing with the customer.",
      }),
    );
    await assert.rejects(() =>
      f.actions.saveLifecycleHandoffAction(
        form({ id: h.id, revision: h.revision, status: "DONE" }),
      ),
    );
    await f.q("UPDATE renewal_items SET due_on=current_date+365,days_left=365");
    await f.svc.reconcileLifecycle();
    assert.equal(
      (await f.q("SELECT status FROM lifecycle_handoffs"))[0].status,
      "DONE",
    );
    await f.q("UPDATE renewal_items SET due_on=NULL,days_left=NULL");
    await f.svc.reconcileLifecycle();
    assert.equal(
      (
        await f.q(
          "SELECT status FROM lifecycle_handoffs WHERE cycle_key LIKE 'renewal-date:%'",
        )
      )[0].status,
      "OPEN",
    );
    await f.q("UPDATE renewal_items SET due_on=current_date+365,days_left=365");
    await f.svc.reconcileLifecycle();
    assert.equal(
      (
        await f.q(
          "SELECT status FROM lifecycle_handoffs WHERE cycle_key LIKE 'renewal-date:%'",
        )
      )[0].status,
      "DONE",
    );
    f.permissions.deny = true;
    await assert.rejects(() => f.actions.scanLifecycleAction());
    await assert.rejects(() =>
      f.actions.pauseLifecycleAction(form({ organization: a.id, until: "" })),
    );
    await assert.rejects(() =>
      f.actions.configureLifecycleAction(form({ ...cfg, enabled: "on" })),
    );
    assert.equal(
      (await f.q("SELECT count(*)::int n FROM lifecycle_audit"))[0].n,
      1,
    );
  } finally {
    await f.db.close();
  }
});
test("lifecycle cron refuses missing/invalid secrets and does not run a sender without authorization", async () => {
  let calls = 0;
  const route = load("src/app/api/cron/customer-lifecycle/route.ts", {
      "@/lib/lifecycle/service": {
        runLifecycle: async () => {
          calls++;
          return { failed: 0, unknown: 0 };
        },
      },
    }),
    old = process.env.CRON_SECRET;
  try {
    delete process.env.CRON_SECRET;
    assert.equal(
      (await route.GET(new Request("https://example.test"))).status,
      503,
    );
    process.env.CRON_SECRET = "fixture-secret";
    assert.equal(
      (await route.GET(new Request("https://example.test"))).status,
      401,
    );
    assert.equal(calls, 0);
    assert.equal(
      (
        await route.GET(
          new Request("https://example.test", {
            headers: { authorization: "Bearer fixture-secret" },
          }),
        )
      ).status,
      200,
    );
    assert.equal(calls, 1);
  } finally {
    if (old === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = old;
  }
});
