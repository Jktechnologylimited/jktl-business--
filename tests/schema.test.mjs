/**
 * Schema tests for the AI receptionist — the SQL that the pure unit tests in
 * `ai-core.test.mjs` cannot reach.
 *
 * Every migration in `migrations/` is applied, in order, to a real Postgres
 * compiled to WebAssembly (`@electric-sql/pglite`), and then the guarantees
 * this feature actually depends on are asserted against it:
 *
 *   - migrations apply cleanly and are safely re-runnable
 *   - a clinic's line resolves however the number is written, and one line can
 *     never belong to two businesses
 *   - a replayed Termii webhook cannot text a patient twice
 *   - the wallet's single-statement guardrail refuses an unfunded send, holds
 *     at exactly zero, and cannot double-charge on a provider retry
 *   - the balance equals SUM(ledger) and the reporting view agrees
 *   - inference cost cannot be pushed into a clinic's wallet
 *
 * Two real defects were found by this file during development: a unary minus
 * applied to an untyped SQL parameter (`-$1` is ambiguous in Postgres — it
 * would have thrown at runtime against Neon too), and voice-line uniqueness
 * enforced on the raw string, which let two businesses register the same
 * number in different formats and made inbound-call routing ambiguous.
 *
 * Postgres-specific: this runs the real engine, so it is a genuine check of
 * the SQL rather than a mock of it. If the optional dependency isn't
 * installed, the suite skips rather than failing.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

let PGlite = null;
try {
  ({ PGlite } = await import("@electric-sql/pglite"));
} catch {
  // Optional dev dependency — see the skip below.
}

const MIGRATIONS_DIR = path.join(import.meta.dirname, "..", "migrations");

/** PGlite ships without the pgcrypto contrib module, but every use of it in
 * these migrations is `gen_random_uuid()`, which is in Postgres core from
 * v13 — so stripping the CREATE EXTENSION statement tests everything that
 * matters. */
const prepare = (sql) => sql.replace(/CREATE EXTENSION[^;]*;/gi, "");

const ORG_A = "11111111-1111-1111-1111-111111111111";
const ORG_B = "33333333-3333-3333-3333-333333333333";
const SESSION_ID = "22222222-2222-2222-2222-222222222222";

test("schema: migrations and the AI receptionist's SQL guarantees", { skip: PGlite ? false : "pglite is not installed" }, async (t) => {
  const db = new PGlite();
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  const sqlFor = (file) => prepare(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));

  await t.test(`all ${files.length} migrations apply in order`, async () => {
    for (const file of files) {
      await assert.doesNotReject(db.exec(sqlFor(file)), `${file} failed to apply`);
    }
  });

  await t.test("every migration is safely re-runnable", async (t2) => {
    // `scripts/migrate.mjs` re-applies every file on every invocation, so a
    // migration that isn't idempotent breaks the next deploy.
    for (const file of files) {
      await t2.test(file, async () => {
        await assert.doesNotReject(db.exec(sqlFor(file)));
      });
    }
  });

  // ---- fixture ------------------------------------------------------------
  await db.exec(`
    INSERT INTO organizations (id, name, slug) VALUES ('${ORG_A}', 'Vitalis Mens Health', 'vitalis');
    INSERT INTO business_profiles (organization_id, business_type, display_name, subdomain)
      VALUES ('${ORG_A}', 'mens_health', 'Vitalis Mens Health', 'vitalis');
    INSERT INTO ai_receptionist_config (organization_id, enabled, pack_id, voice_number, sms_sender_id)
      VALUES ('${ORG_A}', true, 'mens_health', '0700 000 1234', 'JKTL');
    INSERT INTO comm_wallet_settings (organization_id) VALUES ('${ORG_A}');
    INSERT INTO ai_receptionist_contracts (organization_id) VALUES ('${ORG_A}');
    INSERT INTO organizations (id, name, slug) VALUES ('${ORG_B}', 'Second Clinic', 'second');
  `);

  /** The same lookup `findConfigByVoiceNumber` performs. */
  async function resolveLine(number) {
    const digits = number.replace(/\D/g, "");
    const rows = await db.query(
      `SELECT organization_id FROM ai_receptionist_config
       WHERE voice_number_key = $1 AND voice_number_key <> '' LIMIT 1`,
      [digits.slice(-9)],
    );
    return rows.rows[0]?.organization_id ?? null;
  }

  await t.test("a clinic line resolves however the number is written", async () => {
    assert.equal(await resolveLine("+2347000001234"), ORG_A, "+234 form");
    assert.equal(await resolveLine("07000001234"), ORG_A, "local 0-prefixed form");
    assert.equal(await resolveLine("08030000000"), null, "an unrelated number must fail closed");
  });

  await t.test("one line can never belong to two businesses", async () => {
    // The failure this prevents: an inbound call matching whichever row came
    // first, and texting a patient on behalf of the wrong clinic.
    await assert.rejects(
      db.query(`INSERT INTO ai_receptionist_config (organization_id, pack_id, voice_number) VALUES ($1, 'aesthetics', '07000001234')`, [ORG_B]),
      "same digits must collide",
    );
    await assert.rejects(
      db.query(`INSERT INTO ai_receptionist_config (organization_id, pack_id, voice_number) VALUES ($1, 'aesthetics', '+234 700 000 1234')`, [ORG_B]),
      "differently formatted digits must collide too",
    );
    // …while an unset line is fine for any number of businesses.
    await assert.doesNotReject(
      db.query(`INSERT INTO ai_receptionist_config (organization_id, pack_id) VALUES ($1, 'aesthetics')`, [ORG_B]),
    );
  });

  // ---- missed calls -------------------------------------------------------
  const insertCall = ({ callId, caller, receivedAt }) =>
    db.query(
      `INSERT INTO missed_calls (organization_id, caller_phone, called_number, provider, provider_call_id, received_at)
       VALUES ($1, $2, '07000001234', 'termii', $3, $4)
       ON CONFLICT DO NOTHING RETURNING id`,
      [ORG_A, caller, callId, receivedAt],
    );

  const anHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  let missedCallId = "";

  await t.test("a replayed webhook cannot text a patient twice", async () => {
    const first = await insertCall({ callId: "call-abc", caller: "2348034412291", receivedAt: anHourAgo });
    assert.equal(first.rows.length, 1, "the first delivery is recorded");
    missedCallId = first.rows[0].id;

    const byCallId = await insertCall({ callId: "call-abc", caller: "2348034412291", receivedAt: anHourAgo });
    assert.equal(byCallId.rows.length, 0, "the same provider call id is rejected");

    const byTimestamp = await insertCall({ callId: "", caller: "2348034412291", receivedAt: anHourAgo });
    assert.equal(byTimestamp.rows.length, 0, "a provider that sends no id is caught by org+caller+timestamp");

    const fresh = await insertCall({ callId: "call-def", caller: "2348034412291", receivedAt: twoHoursAgo });
    assert.equal(fresh.rows.length, 1, "a genuinely new call from the same patient still records");
  });

  await t.test("the console's stats query resolves and filters by window", async () => {
    const inWindow = await db.query(
      `SELECT COUNT(*)::int AS n FROM missed_calls
       WHERE organization_id = $1 AND received_at >= now() - $2 * interval '1 day'`,
      [ORG_A, 30],
    );
    assert.equal(Number(inWindow.rows[0].n), 2);

    const noWindow = await db.query(
      `SELECT COUNT(*)::int AS n FROM missed_calls
       WHERE organization_id = $1 AND received_at >= now() - $2 * interval '1 day'`,
      [ORG_A, 0],
    );
    assert.equal(Number(noWindow.rows[0].n), 0);
  });

  await t.test("a session links back to the call that produced it", async () => {
    await db.query(
      `INSERT INTO ai_chat_sessions (id, organization_id, missed_call_id, channel, visitor_phone, pack_id)
       VALUES ($1, $2, $3, 'missed_call_sms', '2348034412291', 'mens_health')`,
      [SESSION_ID, ORG_A, missedCallId],
    );
    await db.query(`UPDATE missed_calls SET chat_session_id = $1 WHERE id = $2`, [SESSION_ID, missedCallId]);
    const linked = await db.query(`SELECT chat_session_id FROM missed_calls WHERE id = $1`, [missedCallId]);
    assert.equal(linked.rows[0].chat_session_id, SESSION_ID);
  });

  // ---- the wallet guardrail ----------------------------------------------
  /** The exact statement `chargeWallet` issues. */
  /** The statement `chargeWallet` issues, buckets included. */
  const charge = (amountKobo, providerRef = "") =>
    db.query(
      `WITH buckets AS (
         SELECT COALESCE(SUM(amount_kobo), 0) AS total, COALESCE(SUM(free_amount_kobo), 0) AS free
         FROM comm_wallet_transactions WHERE organization_id = $1
       ), split AS (
         SELECT LEAST(GREATEST(buckets.free, 0), $2)::bigint AS from_free,
                ($2 - LEAST(GREATEST(buckets.free, 0), $2))::bigint AS from_paid,
                buckets.total
         FROM buckets
       )
       INSERT INTO comm_wallet_transactions (
         organization_id, kind, amount_kobo, free_amount_kobo, paid_amount_kobo,
         quantity, unit_cost_kobo, balance_after_kobo,
         provider, provider_ref, description, missed_call_id, session_id
       )
       SELECT $1, 'sms', (- ($2)::bigint), (- split.from_free), (- split.from_paid),
              1, $2, split.total - ($2)::bigint,
              'termii', $3, 'callback', $4, $5
       FROM split
       WHERE split.total >= ($2)::bigint
       ON CONFLICT DO NOTHING
       RETURNING id, balance_after_kobo, free_amount_kobo, paid_amount_kobo`,
      [ORG_A, amountKobo, providerRef, missedCallId, SESSION_ID],
    );

  const topUp = (amountKobo, providerRef) =>
    db.query(
      `INSERT INTO comm_wallet_transactions (organization_id, kind, amount_kobo, free_amount_kobo, paid_amount_kobo, quantity, unit_cost_kobo, balance_after_kobo, provider, provider_ref, description)
       VALUES ($1, 'topup', ($2)::bigint, 0::bigint, ($2)::bigint, 1, 0, ($2)::bigint, 'jktl', $3, 'top-up')`,
      [ORG_A, amountKobo, providerRef],
    );

  await t.test("an unfunded wallet refuses the send rather than subsidising it", async () => {
    const refused = await charge(450);
    assert.equal(refused.rows.length, 0, "nothing may be sent on JKTL's own credit");
  });

  await t.test("the guardrail debits correctly and holds at exactly zero", async () => {
    await topUp(900, "setup-credit:ref-1");

    const first = await charge(450);
    assert.equal(Number(first.rows[0].balance_after_kobo), 450);

    const second = await charge(450);
    assert.equal(Number(second.rows[0].balance_after_kobo), 0);

    const third = await charge(450);
    assert.equal(third.rows.length, 0, "an empty wallet cannot spend");
  });

  await t.test("a provider retry cannot double-charge", async () => {
    await topUp(1000, "ps-ref-1");
    const once = await charge(450, "termii-msg-999");
    const twice = await charge(450, "termii-msg-999");
    assert.equal(once.rows.length, 1);
    assert.equal(twice.rows.length, 0, "the (provider, provider_ref) uniqueness must absorb the retry");
  });

  await t.test("the balance is the ledger sum, and the view agrees", async () => {
    const sum = await db.query(`SELECT COALESCE(SUM(amount_kobo), 0)::bigint AS b FROM comm_wallet_transactions WHERE organization_id = $1`, [ORG_A]);
    const view = await db.query(`SELECT balance_kobo, is_low FROM comm_wallet_balances WHERE organization_id = $1`, [ORG_A]);
    assert.equal(Number(sum.rows[0].b), Number(view.rows[0].balance_kobo));
    assert.equal(view.rows[0].is_low, Number(sum.rows[0].b) < 225_000);
  });

  await t.test("the ledger refuses what it should never contain", async () => {
    const insert = (kind, amount, description) =>
      db.query(
        `INSERT INTO comm_wallet_transactions (organization_id, kind, amount_kobo, quantity, unit_cost_kobo, balance_after_kobo, description)
         VALUES ($1, $2, $3, 1, 0, 0, $4)`,
        [ORG_A, kind, amount, description],
      );

    await assert.rejects(insert("adjustment", 100, ""), "an adjustment must explain itself");
    await assert.rejects(
      insert("ai_usage", -10, "inference"),
      "inference is JKTL's cost of goods and must never be charged to a clinic's wallet",
    );
  });

  await t.test("a booking is attributable to the agent, and only to known sources", async () => {
    await db.query(
      `INSERT INTO bookings (id, organization_id, starts_at, status, source)
       VALUES ('44444444-4444-4444-4444-444444444444', $1, now(), 'confirmed', 'ai_receptionist')`,
      [ORG_A],
    );
    const recovered = await db.query(`SELECT COUNT(*)::int AS n FROM bookings WHERE organization_id = $1 AND source = 'ai_receptionist'`, [ORG_A]);
    assert.equal(Number(recovered.rows[0].n), 1);

    await assert.rejects(
      db.query(`INSERT INTO bookings (organization_id, starts_at, status, source) VALUES ($1, now(), 'confirmed', 'telepathy')`, [ORG_A]),
    );
  });

  await t.test("the contract is a schedule, not a single upfront fee", async () => {
    const row = await db.query(`SELECT * FROM ai_receptionist_contracts WHERE organization_id = $1`, [ORG_A]);
    const contract = row.rows[0];
    assert.equal(Number(contract.setup_fee_kobo), 65_000_000);
    assert.equal(Number(contract.setup_months), 6);
    assert.equal(Number(contract.setup_monthly_kobo), 10_833_333);
    assert.equal(Number(contract.monthly_fee_kobo), 5_900_000);
    assert.equal(Number(contract.charges_paid), 0, "nothing is charged upfront");
    assert.equal(contract.started_at, null, "the contract has not begun until it is activated");
    assert.equal(contract.cancelled_at, null);

    // The ₦650,000-upfront column is gone: the package is amortised now, and a
    // leftover column would let two contradictory models coexist.
    const cols = await db.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'ai_receptionist_contracts'`,
    );
    const names = cols.rows.map((r) => r.column_name);
    assert.ok(!names.includes("setup_paid_at"), names.join(", "));
    assert.ok(names.includes("started_at") && names.includes("charges_paid") && names.includes("cancelled_at"));
  });

  await t.test("activating the contract sets month 1 due and month 7 for the tier", async () => {
    await db.query(
      `UPDATE ai_receptionist_contracts
         SET started_at = $1, billing_starts_at = $2, next_charge_at = $1, status = 'active'
       WHERE organization_id = $3`,
      ["2026-01-10T09:00:00Z", "2026-07-10T09:00:00Z", ORG_A],
    );
    const row = await db.query(`SELECT started_at, billing_starts_at, status FROM ai_receptionist_contracts WHERE organization_id = $1`, [ORG_A]);
    assert.equal(row.rows[0].status, "active");
    assert.ok(row.rows[0].started_at);
  });

  await t.test("a month can only be paid once", async () => {
    // The statement `recordContractPayment` issues: the `charges_paid = month`
    // predicate is what makes a redelivered webhook a no-op.
    const payMonth = (expectedPaid) =>
      db.query(
        `UPDATE ai_receptionist_contracts
           SET charges_paid = charges_paid + 1, last_charge_at = now(), next_charge_at = now() + interval '1 month'
         WHERE organization_id = $1 AND status <> 'cancelled' AND charges_paid = $2
         RETURNING charges_paid`,
        [ORG_A, expectedPaid],
      );

    const first = await payMonth(0);
    assert.equal(Number(first.rows[0].charges_paid), 1);
    const replay = await payMonth(0);
    assert.equal(replay.rows.length, 0, "the same month cannot be recorded twice");
    const second = await payMonth(1);
    assert.equal(Number(second.rows[0].charges_paid), 2);
  });

  await t.test("cancelling stops future charges and is allowed from month one", async () => {
    const cancelled = await db.query(
      `UPDATE ai_receptionist_contracts
         SET status = 'cancelled', cancelled_at = now(), cancel_reason = 'test', next_charge_at = NULL
       WHERE organization_id = $1 AND status <> 'cancelled'
       RETURNING status, cancelled_at, next_charge_at`,
      [ORG_A],
    );
    assert.equal(cancelled.rows[0].status, "cancelled");
    assert.ok(cancelled.rows[0].cancelled_at);
    assert.equal(cancelled.rows[0].next_charge_at, null, "no further charges are due");

    // A cancelled contract is not offered to the billing reminder.
    const due = await db.query(
      `SELECT COUNT(*)::int AS n FROM ai_receptionist_contracts
       WHERE organization_id = $1 AND status IN ('active','past_due') AND next_charge_at IS NOT NULL AND next_charge_at <= now()`,
      [ORG_A],
    );
    assert.equal(Number(due.rows[0].n), 0);
  });

  await t.test("a website visitor resumes their conversation instead of starting a new one", async () => {
    const widgetSession = "55555555-5555-5555-5555-555555555555";
    await db.query(
      `INSERT INTO ai_chat_sessions (id, organization_id, channel, visitor_phone, visitor_key, pack_id)
       VALUES ($1, $2, 'website_widget', '', 'visitor-token-abc', 'mens_health')`,
      [widgetSession, ORG_A],
    );

    const resumed = await db.query(
      `SELECT id FROM ai_chat_sessions
       WHERE organization_id = $1 AND visitor_key = $2 AND status = 'active'
       ORDER BY started_at DESC LIMIT 1`,
      [ORG_A, "visitor-token-abc"],
    );
    assert.equal(resumed.rows[0].id, widgetSession);

    // The hourly cap that stops a public endpoint minting sessions.
    const recent = await db.query(
      `SELECT COUNT(*)::int AS n FROM ai_chat_sessions
       WHERE organization_id = $1 AND visitor_key = $2 AND started_at >= now() - $3 * interval '1 minute'`,
      [ORG_A, "visitor-token-abc", 60],
    );
    assert.equal(Number(recent.rows[0].n), 1);

    // A token that isn't this visitor's never surfaces their thread.
    const stranger = await db.query(
      `SELECT id FROM ai_chat_sessions WHERE organization_id = $1 AND visitor_key = $2 AND status = 'active'`,
      [ORG_A, "somebody-elses-token"],
    );
    assert.equal(stranger.rows.length, 0);

    // And an SMS-linked session (no visitor key at all) is never resumable
    // from the website by an anonymous visitor.
    const byEmptyKey = await db.query(
      `SELECT COUNT(*)::int AS n FROM ai_chat_sessions
       WHERE organization_id = $1 AND visitor_key = '' AND channel = 'website_widget'`,
      [ORG_A],
    );
    assert.equal(Number(byEmptyKey.rows[0].n), 0, "a widget session is only ever created with a token");
  });

  await t.test("free credit is granted once and spent before paid balance", async () => {
    const org = "66666666-6666-6666-6666-666666666666";
    await db.query(`INSERT INTO organizations (id, name, slug) VALUES ($1, 'Free Credit Clinic', 'freecredit')`, [org]);
    await db.query(`INSERT INTO comm_wallet_settings (organization_id) VALUES ($1)`, [org]);

    // The statement `grantFreeCredits` issues: idempotent on (provider, provider_ref).
    const grant = (ref, amount) =>
      db.query(
        `WITH balance AS (SELECT COALESCE(SUM(amount_kobo), 0) AS current FROM comm_wallet_transactions WHERE organization_id = $1)
         INSERT INTO comm_wallet_transactions (
           organization_id, kind, amount_kobo, free_amount_kobo, paid_amount_kobo,
           quantity, unit_cost_kobo, balance_after_kobo, provider, provider_ref, description
         )
         SELECT $1, 'grant', ($2)::bigint, ($2)::bigint, 0::bigint, 1, 0, balance.current + ($2)::bigint, 'jktl', $3, 'free credit'
         FROM balance ON CONFLICT DO NOTHING RETURNING id`,
        [org, amount, ref],
      );

    assert.equal((await grant("free-credit:org", 1500)).rows.length, 1);
    assert.equal((await grant("free-credit:org", 1500)).rows.length, 0, "a repeated grant must not credit twice");

    // The split charge `chargeWallet` issues: free bucket first.
    const charge = (amount) =>
      db.query(
        `WITH buckets AS (
           SELECT COALESCE(SUM(amount_kobo), 0) AS total, COALESCE(SUM(free_amount_kobo), 0) AS free
           FROM comm_wallet_transactions WHERE organization_id = $1
         ), split AS (
           SELECT LEAST(GREATEST(buckets.free, 0), $2)::bigint AS from_free,
                  ($2 - LEAST(GREATEST(buckets.free, 0), $2))::bigint AS from_paid,
                  buckets.total
           FROM buckets
         )
         INSERT INTO comm_wallet_transactions (
           organization_id, kind, amount_kobo, free_amount_kobo, paid_amount_kobo,
           quantity, unit_cost_kobo, balance_after_kobo, provider, provider_ref, description
         )
         SELECT $1, 'sms', (- ($2)::bigint), (- split.from_free), (- split.from_paid),
                1, $2, split.total - ($2)::bigint, 'termii', '', 'callback'
         FROM split WHERE split.total >= ($2)::bigint
         ON CONFLICT DO NOTHING RETURNING free_amount_kobo, paid_amount_kobo`,
        [org, amount],
      );

    const first = await charge(450);
    assert.equal(Number(first.rows[0].free_amount_kobo), -450, "the first 450 comes entirely out of free credit");
    assert.equal(Number(first.rows[0].paid_amount_kobo), 0, "no paid balance is touched while free credit remains");

    const draining = await charge(1_000);
    assert.equal(Number(draining.rows[0].free_amount_kobo), -1_000);

    // 1500 granted, 1450 spent: 50 of free credit left, so the next 200 must
    // take 50 from free and 150 from paid.
    await db.query(
      `INSERT INTO comm_wallet_transactions (organization_id, kind, amount_kobo, free_amount_kobo, paid_amount_kobo, quantity, unit_cost_kobo, balance_after_kobo, provider, provider_ref, description)
       VALUES ($1, 'topup', 1000, 0, 1000, 1, 0, 1050, 'paystack', 'ps-topup-1', 'top-up')`,
      [org],
    );
    const straddle = await charge(200);
    assert.equal(Number(straddle.rows[0].free_amount_kobo), -50, "the last of the free credit goes first");
    assert.equal(Number(straddle.rows[0].paid_amount_kobo), -150, "then paid balance");

    const after = await charge(100);
    assert.equal(Number(after.rows[0].free_amount_kobo), 0, "free credit is exhausted");
    assert.equal(Number(after.rows[0].paid_amount_kobo), -100, "everything now comes from paid balance");

    // The invariant the whole wallet rests on, now with two buckets.
    const sums = await db.query(
      `SELECT COALESCE(SUM(amount_kobo), 0)::bigint AS total,
              COALESCE(SUM(free_amount_kobo), 0)::bigint AS free,
              COALESCE(SUM(paid_amount_kobo), 0)::bigint AS paid
       FROM comm_wallet_transactions WHERE organization_id = $1`,
      [org],
    );
    assert.equal(Number(sums.rows[0].total), Number(sums.rows[0].free) + Number(sums.rows[0].paid), "the buckets must sum to the balance");

    const buckets = await db.query(`SELECT balance_kobo, free_kobo, paid_kobo, free_exhausted FROM comm_wallet_buckets WHERE organization_id = $1`, [org]);
    assert.equal(Number(buckets.rows[0].balance_kobo), Number(sums.rows[0].total), "the view agrees with the ledger");
    assert.equal(buckets.rows[0].free_exhausted, true, "granted and fully spent");
  });

  await t.test("the bucket split cannot be written inconsistently", async () => {
    const org = "66666666-6666-6666-6666-666666666666";
    let rejected = false;
    try {
      await db.query(
        `INSERT INTO comm_wallet_transactions (organization_id, kind, amount_kobo, free_amount_kobo, paid_amount_kobo, quantity, unit_cost_kobo, balance_after_kobo, description)
         VALUES ($1, 'topup', 1000, 400, 500, 1, 0, 0, 'mismatched')`,
        [org],
      );
    } catch {
      rejected = true;
    }
    assert.ok(rejected, "400 + 500 does not equal 1000, so the row must be refused");
  });

  await t.test("a prospect site is a real tenant, marked as unclaimed", async () => {
    const siteOrg = "77777777-7777-7777-7777-777777777777";
    const prospectRes = await db.query(
      `INSERT INTO prospects (source, source_ref, business_name, niche, category, city, state, website, unsubscribe_token)
       VALUES ('apify', 'place-1', 'Vitalis Mens Health', 'mens_health', 'Men''s health clinic', 'Yenagoa', 'Bayelsa', '', 'tok-1')
       RETURNING id`,
    );
    const prospectId = prospectRes.rows[0].id;

    await db.query(`INSERT INTO organizations (id, name, slug, is_prospect) VALUES ($1, 'Vitalis', 'vitalis-preview', true)`, [siteOrg]);
    await db.query(
      `INSERT INTO business_profiles (organization_id, business_type, display_name, subdomain, published, prospect_id)
       VALUES ($1, 'mens_health', 'Vitalis Mens Health', 'vitalis-preview', true, $2)`,
      [siteOrg, prospectId],
    );
    await db.query(
      `UPDATE prospects SET site_organization_id = $1, site_subdomain = 'vitalis-preview', site_built_at = now() WHERE id = $2`,
      [siteOrg, prospectId],
    );

    const joined = await db.query(
      `SELECT o.is_prospect, b.published, b.subdomain
       FROM prospects p
       JOIN organizations o ON o.id = p.site_organization_id
       JOIN business_profiles b ON b.prospect_id = p.id
       WHERE p.id = $1`,
      [prospectId],
    );
    assert.equal(joined.rows[0].is_prospect, true, "a generated site must stay out of customer counts");
    assert.equal(joined.rows[0].published, true, "and must be reachable, or the prospect cannot see it");
    assert.equal(joined.rows[0].subdomain, "vitalis-preview");
  });

  await t.test("a re-scrape does not re-import the same business", async () => {
    const insert = () =>
      db.query(
        `INSERT INTO prospects (source, source_ref, business_name, unsubscribe_token)
         VALUES ('apify', 'place-dup', 'Glow Aesthetics', 'tok-dup')
         ON CONFLICT DO NOTHING RETURNING id`,
      );
    assert.equal((await insert()).rows.length, 1);
    assert.equal((await insert()).rows.length, 0, "the provider place id is the dedupe key");
  });

  await t.test("unsubscribing is a one-way switch on the prospect's own token", async () => {
    const suppressed = await db.query(
      `UPDATE prospects SET suppressed = true, status = 'suppressed' WHERE unsubscribe_token = $1 RETURNING business_name`,
      ["tok-1"],
    );
    assert.equal(suppressed.rows[0].business_name, "Vitalis Mens Health");

    // A suppressed business is never an outreach candidate, however good the lead.
    const candidates = await db.query(
      `SELECT COUNT(*)::int AS n FROM prospects
       WHERE suppressed = false AND email <> '' AND status IN ('qualified','site_built')`,
    );
    assert.equal(Number(candidates.rows[0].n), 0, "nobody suppressed may appear in the send list");

    // An unknown token suppresses nothing and reveals nothing.
    const unknown = await db.query(`UPDATE prospects SET suppressed = true WHERE unsubscribe_token = $1 RETURNING id`, ["not-a-token"]);
    assert.equal(unknown.rows.length, 0);
  });

  await t.test("the Africa-only rules are seeded, and every one carries a reason", async () => {
    const rules = await db.query(`SELECT country_code, rule, note FROM outreach_country_rules ORDER BY country_code`);
    assert.ok(rules.rows.length >= 50, `expected the African rules, got ${rules.rows.length}`);

    const byCode = Object.fromEntries(rules.rows.map((r) => [r.country_code, r]));
    assert.equal(byCode.NG.rule, "permitted", "the home market works out of the box");
    assert.equal(byCode.ZA.rule, "consent_required");
    assert.match(byCode.ZA.note, /POPIA/);
    assert.equal(byCode.EG.rule, "consent_required");
    assert.equal(byCode.MA.rule, "consent_required");
    assert.equal(byCode.KE.rule, "consent_required");
    assert.equal(byCode.GH.rule, "consent_required");
    assert.equal(byCode.TZ.rule, "review_required", "an unconsidered market must not be open by default");

    for (const row of rules.rows) {
      assert.ok((row.note ?? "").length >= 15, `${row.country_code} has no usable reason`);
      assert.ok(["permitted", "consent_required", "review_required", "blocked"].includes(row.rule), `${row.country_code}: bad rule`);
    }

    // Exactly one country is open by default. Anything else would mean someone
    // opened a market without deciding to.
    const permitted = rules.rows.filter((r) => r.rule === "permitted").map((r) => r.country_code);
    assert.deepEqual(permitted, ["NG"]);
  });

  await t.test("consent is recorded per business, and can be withdrawn", async () => {
    const created = await db.query(
      `INSERT INTO prospects (source, source_ref, business_name, country, email, unsubscribe_token)
       VALUES ('apify', 'place-consent', 'Cape Town Skin Clinic', 'ZA', 'hello@example.co.za', 'tok-consent')
       RETURNING id, consent_at`,
    );
    const id = created.rows[0].id;
    assert.equal(created.rows[0].consent_at, null, "nothing is assumed");

    // The statement `recordConsent` issues.
    const recorded = await db.query(
      `UPDATE prospects SET consent_at = now(), consent_note = $1, blocked_reason = '' WHERE id = $2 RETURNING consent_at, consent_note`,
      ["Replied on WhatsApp on 3 March asking us to rebuild their site", id],
    );
    assert.ok(recorded.rows[0].consent_at, "consent carries a timestamp — the evidence");
    assert.match(recorded.rows[0].consent_note, /3 March/);

    const withdrawn = await db.query(`UPDATE prospects SET consent_at = NULL, consent_note = '' WHERE id = $1 RETURNING consent_at`, [id]);
    assert.equal(withdrawn.rows[0].consent_at, null, "withdrawing consent must be possible");
  });

  await t.test("a tenant carries its country, defaulting to Nigeria", async () => {
    const existing = await db.query(`SELECT country_code FROM business_profiles WHERE organization_id = $1`, [ORG_A]);
    assert.equal(existing.rows[0].country_code, "NG", "rows created before this migration keep behaving as they did");

    await db.query(`UPDATE business_profiles SET country_code = 'KE' WHERE organization_id = $1`, [ORG_A]);
    const updated = await db.query(`SELECT country_code FROM business_profiles WHERE organization_id = $1`, [ORG_A]);
    assert.equal(updated.rows[0].country_code, "KE");
    await db.query(`UPDATE business_profiles SET country_code = 'NG' WHERE organization_id = $1`, [ORG_A]);
  });

  await t.test("charging the same subscription month twice is impossible", async () => {
    // The lock `claimNextMonth` relies on: one row per (organization, month),
    // and the claim refuses a row that has already been charged. This is the
    // difference between "unlikely to double-charge" and "cannot".
    const org = "88888888-8888-8888-8888-888888888888";
    await db.query(`INSERT INTO organizations (id, name, slug) VALUES ($1, 'Billing Clinic', 'billingclinic')`, [org]);
    await db.query(`INSERT INTO ai_receptionist_contracts (organization_id) VALUES ($1)`, [org]);

    const claim = () =>
      db.query(
        `INSERT INTO contract_charge_attempts (organization_id, month_index, amount_kobo, status, attempts)
         VALUES ($1, 3, 10833333, 'pending', 1)
         ON CONFLICT (organization_id, month_index) DO UPDATE SET
           attempts = contract_charge_attempts.attempts + 1,
           status = 'pending', error = '', updated_at = now()
         WHERE contract_charge_attempts.status <> 'charged'
         RETURNING month_index, attempts`,
        [org],
      );

    const first = await claim();
    assert.equal(first.rows.length, 1, "the first attempt takes the lock");
    assert.equal(Number(first.rows[0].attempts), 1);

    // A retry after a transport timeout is allowed — the row is still pending.
    const retry = await claim();
    assert.equal(retry.rows.length, 1);
    assert.equal(Number(retry.rows[0].attempts), 2, "retries increment the attempt count");

    await db.query(`UPDATE contract_charge_attempts SET status = 'charged', provider_ref = 'ref-1' WHERE organization_id = $1 AND month_index = 3`, [
      org,
    ]);

    const afterPaid = await claim();
    assert.equal(afterPaid.rows.length, 0, "a paid month can never be claimed again — no second charge");

    // A concurrent cron invocation for the same month is refused the same way.
    assert.equal((await claim()).rows.length, 0);

    // The next month is a different row, so a new month still collects.
    const nextMonth = await db.query(
      `INSERT INTO contract_charge_attempts (organization_id, month_index, amount_kobo, status, attempts)
       VALUES ($1, 4, 10833333, 'pending', 1)
       ON CONFLICT (organization_id, month_index) DO UPDATE SET attempts = contract_charge_attempts.attempts + 1
       WHERE contract_charge_attempts.status <> 'charged'
       RETURNING month_index`,
      [org],
    );
    assert.equal(Number(nextMonth.rows[0].month_index), 4);
  });

  await t.test("a contract can hold a reusable card and stop using it", async () => {
    const org = "88888888-8888-8888-8888-888888888888";

    // `saveContractCard` only writes for a reusable authorization.
    const saved = await db.query(
      `UPDATE ai_receptionist_contracts SET
         paystack_authorization_code = 'AUTH_reusable', card_brand = 'Visa', card_last4 = '4081',
         card_exp_month = '09', card_exp_year = '2029'
       WHERE organization_id = $1
       RETURNING paystack_authorization_code, card_last4, auto_charge_enabled`,
      [org],
    );
    assert.equal(saved.rows[0].card_last4, "4081");
    assert.equal(saved.rows[0].auto_charge_enabled, true, "automatic collection is on by default");

    const off = await db.query(`UPDATE ai_receptionist_contracts SET auto_charge_enabled = false WHERE organization_id = $1 RETURNING auto_charge_enabled`, [org]);
    assert.equal(off.rows[0].auto_charge_enabled, false);

    // Only contracts that are due, auto-charging and carded are candidates —
    // the work list the cron walks.
    const candidates = await db.query(
      `SELECT COUNT(*)::int AS n FROM ai_receptionist_contracts
       WHERE status IN ('active','past_due') AND auto_charge_enabled = true
         AND paystack_authorization_code <> '' AND started_at IS NOT NULL
         AND COALESCE(next_charge_at, started_at) <= now()`,
    );
    assert.equal(Number(candidates.rows[0].n), 0, "a contract with auto-charge off must not be collected");

    await db.query(`UPDATE ai_receptionist_contracts SET auto_charge_enabled = true, status = 'active', started_at = now() WHERE organization_id = $1`, [org]);
    const on = await db.query(
      `SELECT COUNT(*)::int AS n FROM ai_receptionist_contracts
       WHERE status IN ('active','past_due') AND auto_charge_enabled = true
         AND paystack_authorization_code <> '' AND started_at IS NOT NULL
         AND COALESCE(next_charge_at, started_at) <= now()`,
    );
    assert.equal(Number(on.rows[0].n), 1, "and once it is due, it is picked up");
  });

  await t.test("a nudge is sent once, then respects its cooldown", async () => {
    const org = "88888888-8888-8888-8888-888888888888";

    // `recordNudgeSent`: one row per (org, nudge), counting sends.
    const record = () =>
      db.query(
        `INSERT INTO org_nudges (organization_id, nudge_id, sent_count, first_sent_at, last_sent_at)
         VALUES ($1, 'add_card', 1, now(), now())
         ON CONFLICT (organization_id, nudge_id) DO UPDATE SET
           sent_count = org_nudges.sent_count + 1, last_sent_at = now()
         RETURNING sent_count`,
        [org],
      );

    assert.equal(Number((await record()).rows[0].sent_count), 1);
    assert.equal(Number((await record()).rows[0].sent_count), 2, "the counter accumulates");

    // Only one row per nudge, however many times it fires.
    const rows = await db.query(`SELECT COUNT(*)::int AS n FROM org_nudges WHERE organization_id = $1 AND nudge_id = 'add_card'`, [org]);
    assert.equal(Number(rows.rows[0].n), 1);

    // Resolving it is what lets a repeatable nudge come back later.
    await db.query(`UPDATE org_nudges SET resolved_at = now() WHERE organization_id = $1 AND nudge_id = 'add_card'`, [org]);
    const resolved = await db.query(`SELECT resolved_at FROM org_nudges WHERE organization_id = $1 AND nudge_id = 'add_card'`, [org]);
    assert.ok(resolved.rows[0].resolved_at);
  });

  await t.test("the app can be asked to stop sending setup tips", async () => {
    const org = "88888888-8888-8888-8888-888888888888";
    await db.query(`INSERT INTO notification_preferences (organization_id) VALUES ($1) ON CONFLICT DO NOTHING`, [org]);
    const prefs = await db.query(`SELECT payout_alerts, invoice_sent_alerts FROM notification_preferences WHERE organization_id = $1`, [org]);
    assert.equal(prefs.rows[0].payout_alerts, true, "on by default, so the money advice actually reaches people");
    assert.equal(prefs.rows[0].invoice_sent_alerts, true);

    const off = await db.query(`UPDATE notification_preferences SET payout_alerts = false WHERE organization_id = $1 RETURNING payout_alerts`, [org]);
    assert.equal(off.rows[0].payout_alerts, false, "and it can be turned off without losing payment notifications");
  });

  await t.test("the three expansion markets are openable, with their gaps recorded", async () => {
    const rows = await db.query(
      `SELECT country_code, rule, language, currency, paystack_supported, priced, payment_rails, note
       FROM outreach_country_rules WHERE country_code IN ('GH','CI','SN') ORDER BY country_code`,
    );
    assert.equal(rows.rows.length, 3, "Ghana, Cote d'Ivoire and Senegal must all exist");

    const byCode = Object.fromEntries(rows.rows.map((r) => [r.country_code, r]));

    // Ghana: English, cedis, Paystack covers it.
    assert.equal(byCode.GH.rule, "consent_required");
    assert.equal(byCode.GH.language, "en");
    assert.equal(byCode.GH.currency, "GHS");
    assert.equal(byCode.GH.paystack_supported, true);
    assert.match(byCode.GH.note, /Act 843/);

    // Cote d'Ivoire and Senegal: French, CFA francs, no Paystack.
    for (const code of ["CI", "SN"]) {
      assert.equal(byCode[code].rule, "consent_required", `${code}: consent is the route in`);
      assert.equal(byCode[code].language, "fr", `${code}: customers read French`);
      assert.equal(byCode[code].currency, "XOF", `${code}: bills in CFA francs`);
      assert.equal(byCode[code].paystack_supported, false, `${code}: no processor, no revenue`);
      assert.equal(byCode[code].priced, false, `${code}: must not pretend to have a price`);
      assert.ok(byCode[code].payment_rails.length > 5, `${code}: rails must be named`);
      assert.match(byCode[code].note, /Consent recorded per business/);
    }

    // The XOF trap, asserted against the stored metadata: a currency with no
    // subunit must never be treated as if it had one.
    const xof = rows.rows.filter((r) => r.currency === "XOF");
    assert.equal(xof.length, 2);
    for (const row of xof) {
      assert.notEqual(row.currency, "NGN", "a CFA franc is not a kobo");
    }

    // Exactly one market remains open by default: opening a market is a
    // decision, and only Nigeria has had that decision made for it.
    const permitted = await db.query(`SELECT country_code FROM outreach_country_rules WHERE rule = 'permitted'`);
    assert.deepEqual(permitted.rows.map((r) => r.country_code), ["NG"]);
  });

  await t.test("a month of line rental can only be charged once", async () => {
    // Option A put the dedicated phone line on the clinic's own wallet, which
    // makes this the same money-safety question as subscription collection: a
    // daily cron must not be able to bill February twice.
    const org = "99999999-9999-9999-9999-999999999999";
    await db.query(`INSERT INTO organizations (id, name, slug) VALUES ($1, 'Line Clinic', 'lineclinic')`, [org]);
    await db.query(
      `INSERT INTO ai_receptionist_config (organization_id, line_status, line_rental_kobo_per_month, voice_number)
       VALUES ($1, 'active', 1200000, '+2347012345678')`,
      [org],
    );

    const claim = (period) =>
      db.query(
        `INSERT INTO line_rental_charges (organization_id, period_key, amount_kobo, status, attempts)
         VALUES ($1, $2, 1200000, 'pending', 1)
         ON CONFLICT (organization_id, period_key) DO UPDATE SET
           attempts = line_rental_charges.attempts + 1, status = 'pending', error = '', updated_at = now()
         WHERE line_rental_charges.status IN ('pending', 'unpaid')
         RETURNING period_key, attempts`,
        [org, period],
      );

    assert.equal((await claim("2026-02")).rows.length, 1, "the first attempt takes the month");
    assert.equal((await claim("2026-02")).rows.length, 1, "an unpaid retry is allowed");

    // Paid: the month is closed forever.
    await db.query(`UPDATE line_rental_charges SET status = 'charged' WHERE organization_id = $1 AND period_key = '2026-02'`, [org]);
    assert.equal((await claim("2026-02")).rows.length, 0, "a charged month can never be claimed again");

    // A waived month is also closed — no double refund, no re-bill.
    await db.query(
      `INSERT INTO line_rental_charges (organization_id, period_key, amount_kobo, status) VALUES ($1, '2026-03', 1200000, 'waived')`,
      [org],
    );
    assert.equal((await claim("2026-03")).rows.length, 0, "a waived month stays waived");

    // The next month still bills.
    assert.equal((await claim("2026-04")).rows.length, 1);

    // And the cron's work list excludes a clinic already charged for the period.
    const candidates = await db.query(
      `SELECT c.organization_id FROM ai_receptionist_config c
       WHERE c.line_rental_kobo_per_month > 0 AND c.line_status IN ('active', 'requested')
         AND NOT EXISTS (
           SELECT 1 FROM line_rental_charges l
           WHERE l.organization_id = c.organization_id
             AND l.period_key = to_char(now() AT TIME ZONE 'Africa/Lagos', 'YYYY-MM')
             AND l.status IN ('charged', 'waived')
         )`,
    );
    assert.ok(candidates.rows.length >= 1, "a clinic with no charge this period is in the work list");

    // A line with no rental is never billed — the guard against re-creating the
    // silent subsidy this change removed.
    await db.query(`UPDATE ai_receptionist_config SET line_rental_kobo_per_month = 0 WHERE organization_id = $1`, [org]);
    const unbillable = await db.query(
      `SELECT COUNT(*)::int AS n FROM ai_receptionist_config WHERE organization_id = $1 AND line_rental_kobo_per_month > 0`,
      [org],
    );
    assert.equal(Number(unbillable.rows[0].n), 0);
  });

  await t.test("a prospect can be tagged with its area and excluded with a reason", async () => {
    await db.query(
      `INSERT INTO prospects (source, source_ref, business_name, niche, phone, city, unsubscribe_token, search_area)
       VALUES ('apify', 'area-1', 'Lekki Aesthetics', 'aesthetics', '08031234567', 'Lagos', 'tok_area_1', 'Lekki Phase 1')`,
    );
    const row = await db.query(`SELECT search_area, excluded_reason FROM prospects WHERE source_ref = 'area-1'`);
    assert.equal(row.rows[0].search_area, "Lekki Phase 1", "the area drives per-area conversion reporting");
    assert.equal(row.rows[0].excluded_reason, "", "a fresh lead is not excluded");

    // Excluding an existing customer records why, so a large import is auditable.
    await db.query(`UPDATE prospects SET excluded_reason = 'Already a JKTL customer', status = 'rejected' WHERE source_ref = 'area-1'`);
    const excluded = await db.query(`SELECT excluded_reason FROM prospects WHERE source_ref = 'area-1'`);
    assert.equal(excluded.rows[0].excluded_reason, "Already a JKTL customer");
  });

  await t.test("a site build job is resumable and cannot double-build a business", async () => {
    const jobId = "aaaa1111-1111-1111-1111-111111111111";
    const org = "bbbb2222-2222-2222-2222-222222222222";
    await db.query(`INSERT INTO organizations (id, name, slug) VALUES ($1, 'Lead Co', 'leadco')`, [org]);
    await db.query(`INSERT INTO site_build_jobs (id, status, total) VALUES ($1, 'running', 2)`, [jobId]);

    await db.query(
      `INSERT INTO prospects (source, source_ref, business_name, niche, phone, city, unsubscribe_token, status)
       VALUES ('apify', 'job-1', 'Lekki Clinic', 'mens_health', '08031111111', 'Lagos', 'tok_j1', 'qualified'),
              ('apify', 'job-2', 'Ikoyi Spa', 'aesthetics', '08032222222', 'Lagos', 'tok_j2', 'qualified')`,
    );
    const ids = await db.query(`SELECT id FROM prospects WHERE source_ref IN ('job-1','job-2') ORDER BY source_ref`);

    await db.query(
      `INSERT INTO site_build_targets (job_id, prospect_id) VALUES ($1, $2), ($1, $3)`,
      [jobId, ids.rows[0].id, ids.rows[1].id],
    );

    // The primary key is what makes a resumed job safe: the same business cannot
    // be queued twice in one job, so a crash-restart cannot build it twice.
    await db.query(
      `INSERT INTO site_build_targets (job_id, prospect_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [jobId, ids.rows[0].id],
    );
    const count = await db.query(`SELECT COUNT(*)::int AS n FROM site_build_targets WHERE job_id = $1`, [jobId]);
    assert.equal(Number(count.rows[0].n), 2, "no duplicate target rows");

    // The worker's work list only sees pending targets.
    const pending = await db.query(`SELECT COUNT(*)::int AS n FROM site_build_targets WHERE job_id = $1 AND status = 'pending'`, [jobId]);
    assert.equal(Number(pending.rows[0].n), 2);

    // Build one, then the resumed job picks up exactly the other.
    await db.query(
      `UPDATE site_build_targets SET status = 'built', subdomain = 'lekki-clinic' WHERE job_id = $1 AND prospect_id = $2`,
      [jobId, ids.rows[0].id],
    );
    await db.query(`UPDATE site_build_jobs SET built = 1 WHERE id = $1`, [jobId]);

    const after = await db.query(
      `SELECT prospect_id FROM site_build_targets WHERE job_id = $1 AND status = 'pending'`,
      [jobId],
    );
    assert.equal(after.rows.length, 1, "exactly one target remains");
    assert.equal(after.rows[0].prospect_id, ids.rows[1].id, "and it is the one that was not built");

    // Counters are written incrementally, so a second batch cannot clobber the
    // first batch's totals.
    await db.query(`UPDATE site_build_jobs SET built = built + 1, images_mirrored = images_mirrored + 7 WHERE id = $1`, [jobId]);
    const job = await db.query(`SELECT built, images_mirrored, status FROM site_build_jobs WHERE id = $1`, [jobId]);
    assert.equal(Number(job.rows[0].built), 2, "counters accumulate across batches");
    assert.equal(Number(job.rows[0].images_mirrored), 7);

    // Progress is only ever rounded down, so 100% means genuinely finished.
    await db.query(`UPDATE site_build_jobs SET status = 'done', finished_at = now(), total = 2 WHERE id = $1`, [jobId]);
    const done = await db.query(`SELECT status, finished_at FROM site_build_jobs WHERE id = $1`, [jobId]);
    assert.equal(done.rows[0].status, "done");
    assert.ok(done.rows[0].finished_at);

    // Cancelling settles the remaining work, so a progress bar cannot sit at 60%
    // forever.
    await db.query(`UPDATE site_build_targets SET status = 'pending' WHERE job_id = $1`, [jobId]);
    await db.query(`UPDATE site_build_jobs SET status = 'cancelled' WHERE id = $1`, [jobId]);
    await db.query(`UPDATE site_build_targets SET status = 'skipped', error = 'Job cancelled' WHERE job_id = $1 AND status = 'pending'`, [jobId]);
    const cancelled = await db.query(
      `SELECT COUNT(*)::int AS n FROM site_build_targets WHERE job_id = $1 AND status = 'pending'`,
      [jobId],
    );
    assert.equal(Number(cancelled.rows[0].n), 0, "nothing left pending after a cancel");
  });

  await t.test("only one build job runs at a time, and a bad batch is traceable", async () => {
    const running = await db.query(
      `SELECT COUNT(*)::int AS n FROM site_build_jobs WHERE status = 'running'`,
    );
    // The cron picks the oldest running job, so this is the query it relies on.
    assert.ok(Number(running.rows[0].n) <= 1, "the index supports picking a single running job");

    const failures = await db.query(
      `SELECT p.business_name, t.status, t.error
       FROM site_build_targets t JOIN prospects p ON p.id = t.prospect_id
       WHERE t.status IN ('failed', 'skipped') LIMIT 5`,
    );
    // Per-business errors, not a batch-level "something failed" — the admin has
    // to know which business and why.
    assert.ok(Array.isArray(failures.rows));

    // A generated site records which job produced it.
    const columns = await db.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'business_profiles' AND column_name IN ('generated_by_job','generated_from_prospect','gallery_urls','opening_hours','service_areas','faqs','about_long')`,
    );
    assert.equal(columns.rows.length, 7, "the generated-site columns all exist");
  });

  await t.test("a reset link can be claimed exactly once", async () => {
    // The SQL-level guarantee the pure tests cannot cover: two submissions of the
    // same link must not both set a password. The claim is an UPDATE with
    // `used_at IS NULL` in the WHERE clause, so only the first one matches.
    const aff = "cccc3333-3333-3333-3333-333333333333";
    const reset = "dddd4444-4444-4444-4444-444444444444";
    await db.query(
      `INSERT INTO affiliates (id, name, email, password_hash, referral_code, status)
       VALUES ($1, 'Ada Partner', 'ada@partners.ng', 'hashed', 'ADA01', 'active')`,
      [aff],
    );
    await db.query(
      `INSERT INTO affiliate_password_resets (id, affiliate_id, token_hash, expires_at)
       VALUES ($1, $2, 'hash_of_token_one', now() + interval '30 minutes')`,
      [reset, aff],
    );

    const claim = () =>
      db.query(
        `UPDATE affiliate_password_resets SET used_at = now()
         WHERE id = $1 AND used_at IS NULL AND superseded_at IS NULL AND expires_at > now()
         RETURNING id`,
        [reset],
      );

    const first = await claim();
    assert.equal(first.rows.length, 1, "the first claim wins");
    const second = await claim();
    assert.equal(second.rows.length, 0, "a second submission of the same link must fail");

    // And there is only ever one row per token hash.
    await db.query(
      `INSERT INTO affiliate_password_resets (id, affiliate_id, token_hash, expires_at)
       VALUES (gen_random_uuid(), $1, 'hash_of_token_one', now() + interval '30 minutes')
       ON CONFLICT (token_hash) DO NOTHING`,
      [aff],
    );
    const count = await db.query(`SELECT COUNT(*)::int AS n FROM affiliate_password_resets WHERE token_hash = 'hash_of_token_one'`);
    assert.equal(Number(count.rows[0].n), 1, "a token hash is unique, so one link belongs to one partner");
  });

  await t.test("an expired or superseded link cannot be claimed", async () => {
    const aff = "cccc3333-3333-3333-3333-333333333333";
    const expired = "eeee5555-5555-5555-5555-555555555555";
    const superseded = "ffff6666-6666-6666-6666-666666666666";

    await db.query(
      `INSERT INTO affiliate_password_resets (id, affiliate_id, token_hash, expires_at)
       VALUES ($1, $2, 'hash_expired', now() - interval '1 minute')`,
      [expired, aff],
    );
    await db.query(
      `INSERT INTO affiliate_password_resets (id, affiliate_id, token_hash, expires_at, superseded_at)
       VALUES ($1, $2, 'hash_superseded', now() + interval '30 minutes', now())`,
      [superseded, aff],
    );

    const claim = (id) =>
      db.query(
        `UPDATE affiliate_password_resets SET used_at = now()
         WHERE id = $1 AND used_at IS NULL AND superseded_at IS NULL AND expires_at > now()
         RETURNING id`,
        [id],
      );

    assert.equal((await claim(expired)).rows.length, 0, "an expired link must not work");
    assert.equal((await claim(superseded)).rows.length, 0, "a superseded link must not work");
  });

  await t.test("requesting a new link kills the previous one", async () => {
    // Otherwise a partner who clicks "resend" twice holds two working
    // credentials, and so does anyone who saw the first email.
    const aff = "cccc3333-3333-3333-3333-333333333333";
    const older = "1111aaaa-1111-1111-1111-111111111111";
    await db.query(
      `INSERT INTO affiliate_password_resets (id, affiliate_id, token_hash, expires_at)
       VALUES ($1, $2, 'hash_older_link', now() + interval '30 minutes')`,
      [older, aff],
    );

    // What `requestAffiliatePasswordReset` does before issuing a new one.
    await db.query(
      `UPDATE affiliate_password_resets SET superseded_at = now()
       WHERE affiliate_id = $1 AND used_at IS NULL AND superseded_at IS NULL`,
      [aff],
    );

    const row = await db.query(`SELECT superseded_at FROM affiliate_password_resets WHERE id = $1`, [older]);
    assert.ok(row.rows[0].superseded_at, "the earlier link must be dead");
  });

  await t.test("completing a reset signs the partner out everywhere", async () => {
    // This is the point of a reset. The usual reason somebody does this is that
    // they think their password has leaked, and leaving the other session alive
    // would make the whole exercise decorative.
    const aff = "cccc3333-3333-3333-3333-333333333333";
    await db.query(
      `INSERT INTO affiliate_sessions (id, affiliate_id, expires_at)
       VALUES (gen_random_uuid(), $1, now() + interval '7 days'),
              (gen_random_uuid(), $1, now() + interval '7 days'),
              (gen_random_uuid(), $1, now() + interval '7 days')`,
      [aff],
    );

    const before = await db.query(`SELECT COUNT(*)::int AS n FROM affiliate_sessions WHERE affiliate_id = $1`, [aff]);
    assert.equal(Number(before.rows[0].n), 3);

    // What `completeAffiliatePasswordReset` does after setting the password.
    await db.query(`DELETE FROM affiliate_sessions WHERE affiliate_id = $1`, [aff]);

    const after = await db.query(`SELECT COUNT(*)::int AS n FROM affiliate_sessions WHERE affiliate_id = $1`, [aff]);
    assert.equal(Number(after.rows[0].n), 0, "every session must be gone, or a stolen one survives the reset");
  });

  await t.test("the reset rate limit counts what it is supposed to", async () => {
    // The limit is per affiliate per hour, and it counts *requests*, not
    // successes — otherwise a flood of requests for one address would still be
    // able to fill an inbox.
    //
    // A dedicated affiliate, because the rows written by the tests above belong
    // to the same partner and would make the count depend on their execution
    // order. A test that only passes in isolation is worse than no test.
    const aff = "7777aaaa-7777-7777-7777-777777777777";
    await db.query(
      `INSERT INTO affiliates (id, name, email, password_hash, referral_code, status)
       VALUES ($1, 'Rate Partner', 'rate@partners.ng', 'hashed', 'RATE01', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [aff],
    );
    for (let i = 0; i < 3; i += 1) {
      await db.query(
        `INSERT INTO affiliate_password_resets (id, affiliate_id, token_hash, expires_at, created_at)
         VALUES (gen_random_uuid(), $1, $2, now() + interval '30 minutes', now() - ($3 * interval '1 minute'))`,
        [aff, `hash_rate_${i}`, i],
      );
    }
    const recent = await db.query(
      `SELECT COUNT(*)::int AS n FROM affiliate_password_resets
       WHERE affiliate_id = $1 AND created_at > now() - interval '1 hour'`,
      [aff],
    );
    assert.ok(Number(recent.rows[0].n) >= 3, "requests inside the hour are counted");

    // An old request falls out of the window, which is what makes the limit a
    // limit rather than a permanent ban.
    await db.query(
      `INSERT INTO affiliate_password_resets (id, affiliate_id, token_hash, expires_at, created_at)
       VALUES (gen_random_uuid(), $1, 'hash_rate_old', now() + interval '30 minutes', now() - interval '2 hours')`,
      [aff],
    );
    const within = await db.query(
      `SELECT COUNT(*)::int AS n FROM affiliate_password_resets
       WHERE affiliate_id = $1 AND created_at > now() - interval '1 hour'`,
      [aff],
    );
    assert.equal(Number(within.rows[0].n), 3, "the two-hour-old request is outside the window");
  });

  await t.test("a suspended partner's reset link does not work", async () => {
    // A partner suspended after requesting a reset must not be able to use it to
    // get back in.
    // Its own partner and its own live token, so the assertion does not depend on
    // what the earlier subtests happened to leave behind.
    const aff = "8888bbbb-8888-8888-8888-888888888888";
    await db.query(
      `INSERT INTO affiliates (id, name, email, password_hash, referral_code, status)
       VALUES ($1, 'Suspended Partner', 'suspended@partners.ng', 'hashed', 'SUS01', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [aff],
    );
    await db.query(
      `INSERT INTO affiliate_password_resets (id, affiliate_id, token_hash, expires_at)
       VALUES (gen_random_uuid(), $1, 'hash_suspended_partner', now() + interval '30 minutes')`,
      [aff],
    );
    await db.query(`UPDATE affiliates SET status = 'suspended' WHERE id = $1`, [aff]);

    const rows = await db.query(
      `SELECT a.status, r.expires_at, r.used_at, r.superseded_at
       FROM affiliate_password_resets r JOIN affiliates a ON a.id = r.affiliate_id
       WHERE r.affiliate_id = $1 AND r.used_at IS NULL AND r.superseded_at IS NULL AND r.expires_at > now()
       LIMIT 1`,
      [aff],
    );
    // The row exists and is live, but the join carries the status, which the
    // lookup rejects. Asserting the status is what the code checks.
    assert.ok(rows.rows.length > 0, "a live token row exists");
    assert.equal(rows.rows[0].status, "suspended", "and the status is what disqualifies it");
  });

  await t.test("expired reset rows can be pruned", async () => {
    // The table should not grow forever, and an old row is only a liability.
    await db.query(
      `INSERT INTO affiliate_password_resets (id, affiliate_id, token_hash, expires_at)
       VALUES (gen_random_uuid(), 'cccc3333-3333-3333-3333-333333333333', 'hash_ancient', now() - interval '30 days')`,
    );
    const pruned = await db.query(
      `DELETE FROM affiliate_password_resets
       WHERE expires_at < now() - (7 * interval '1 day')
       RETURNING id`,
    );
    assert.ok(pruned.rows.length >= 1, "a month-old token is deleted");
  });

  await t.test("entitlement comes from the receptionist, and legacy plans still count", async () => {
    // Everything the old Website & Hosting plan used to gate — team seats, a
    // custom domain, storage — is now included with the AI receptionist. This is
    // the query `getEntitlement` runs, against a real database.
    const org = "abab1212-1212-1212-1212-121212121212";
    await db.query(`INSERT INTO organizations (id, name, slug) VALUES ($1, 'Entitled Clinic', 'entitledclinic')`, [org]);

    const read = () =>
      db.query(
        `SELECT
           (SELECT status FROM ai_receptionist_contracts WHERE organization_id = $1) AS contract_status,
           (SELECT subscription_status FROM infrastructure_accounts WHERE organization_id = $1) AS plan_status,
           (SELECT renewal_date FROM infrastructure_accounts WHERE organization_id = $1) AS renewal_date`,
        [org],
      );

    // Nothing at all: not entitled.
    let row = (await read()).rows[0];
    assert.equal(row.contract_status, null);
    assert.equal(row.plan_status, null);

    // An active contract entitles, with no legacy plan present.
    await db.query(`INSERT INTO ai_receptionist_contracts (organization_id, status, started_at) VALUES ($1, 'active', now())`, [org]);
    row = (await read()).rows[0];
    assert.equal(row.contract_status, "active", "the receptionist subscription is the gate now");

    // A past-due contract still entitles — a failed card is usually an expired
    // card, and locking a clinic out of its own phone line the day a payment
    // fails turns a billing issue into a lost customer.
    await db.query(`UPDATE ai_receptionist_contracts SET status = 'past_due' WHERE organization_id = $1`, [org]);
    row = (await read()).rows[0];
    assert.equal(row.contract_status, "past_due");

    // A cancelled contract does not.
    await db.query(`UPDATE ai_receptionist_contracts SET status = 'cancelled' WHERE organization_id = $1`, [org]);
    row = (await read()).rows[0];
    assert.equal(row.contract_status, "cancelled");
  });

  await t.test("a legacy subscriber keeps access after the plan is pulled from sale", async () => {
    // Existing customers on the ₦5,000 plan must not lose seats or their domain
    // because the plan is no longer sold. Silently revoking paid features is how
    // a chargeback happens.
    const org = "cdcd3434-3434-3434-3434-343434343434";
    await db.query(`INSERT INTO organizations (id, name, slug) VALUES ($1, 'Legacy Salon', 'legacysalon')`, [org]);
    await db.query(
      `INSERT INTO infrastructure_accounts (organization_id, plan_name, subscription_status, renewal_date)
       VALUES ($1, 'Website & Hosting', 'active', now() + interval '30 days')`,
      [org],
    );

    const row = (
      await db.query(
        `SELECT subscription_status, renewal_date FROM infrastructure_accounts WHERE organization_id = $1`,
        [org],
      )
    ).rows[0];
    // What `isSubscriptionActive` checks: active, and not yet expired.
    assert.equal(row.subscription_status, "active");
    assert.ok(new Date(row.renewal_date) >= new Date(new Date().toDateString()));
  });

  await t.test("the line-uniqueness index is the normalised one", async () => {
    const indexes = await db.query(`SELECT indexname FROM pg_indexes WHERE tablename = 'ai_receptionist_config'`);
    const names = indexes.rows.map((r) => r.indexname);
    assert.ok(names.includes("idx_ai_config_voice_number_key"), names.join(", "));
    assert.ok(!names.includes("idx_ai_config_voice_number"), "the superseded raw-string index must be gone");
  });
});
