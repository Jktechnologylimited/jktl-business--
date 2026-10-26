import { applyMigrationBatch } from "../scripts/sql-statements.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { calculateCommission } from "../src/lib/distribution/calculation.ts";
const quote = {
  captured: 500000,
  tax: 0,
  processing: 0,
  discounts: 0,
  refunds: 0,
  chargebacks: 0,
  thirdPartyCosts: 0,
  rateBps: 1500,
  paidMonthsBefore: 0,
  serviceMonths: 1,
  termMonths: 12,
  minimumNet: 0,
  maximumCommission: 100000000,
  marginReserve: 0,
  resellerDiscount: 0,
  stackingApproved: false,
  capturedSuccessfully: true,
  testPayment: false,
  selfReferral: false,
  currency: "NGN",
  eligibleCurrencies: ["NGN"],
};
test("proposed percentage calculations use actual captured amounts and service months", () => {
  assert.equal(calculateCommission(quote).commission, 75000);
  assert.equal(
    calculateCommission({ ...quote, captured: 5000000, serviceMonths: 12 })
      .commission,
    750000,
  );
  assert.equal(
    calculateCommission({ ...quote, paidMonthsBefore: 12 }).commission,
    0,
  );
  assert.equal(
    calculateCommission({
      ...quote,
      captured: 12000000,
      serviceMonths: 12,
      paidMonthsBefore: 11,
    }).commission,
    150000,
  );
  assert.equal(
    calculateCommission({ ...quote, discounts: 100000 }).commission,
    75000,
  );
  assert.equal(
    calculateCommission({
      ...quote,
      thirdPartyCosts: 100000,
      tax: 10000,
      processing: 10000,
    }).commission,
    57000,
  );
  assert.equal(
    calculateCommission({ ...quote, marginReserve: 480000 }).commission,
    20000,
  );
  assert.equal(
    calculateCommission({ ...quote, maximumCommission: 5000 }).commission,
    5000,
  );
  for (const change of [
    { selfReferral: true },
    { testPayment: true },
    { capturedSuccessfully: false },
    { currency: "USD" },
    { resellerDiscount: 1 },
    { refunds: 500000 },
  ])
    assert.equal(calculateCommission({ ...quote, ...change }).commission, 0);
  assert.equal(
    calculateCommission({
      ...quote,
      resellerDiscount: 1,
      stackingApproved: true,
    }).commission,
    75000,
  );
  for (const change of [
    { captured: -1 },
    { captured: 1.5 },
    { captured: Number.MAX_SAFE_INTEGER + 1 },
    { rateBps: 10001 },
    { serviceMonths: 0 },
  ])
    assert.throws(() => calculateCommission({ ...quote, ...change }));
});
test("migration is rerunnable, preserves financial rows and locks legacy snapshots", async () => {
  const db = new PGlite();
  const adapter = {
    query: (statement, params) => ({ statement, params }),
    transaction: async (statements) => {
      await db.exec("BEGIN");
      try {
        for (const s of statements) await db.query(s.statement, s.params);
        await db.exec("COMMIT");
      } catch (e) {
        await db.exec("ROLLBACK");
        throw e;
      }
    },
  };
  try {
    await db.exec(
      `CREATE TABLE affiliates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text,programme text,commission_model text,commission_bps int,signup_bonus_kobo bigint,subscription_bonus_kobo bigint,recurring_monthly_kobo bigint,recurring_months_cap int,partner_agreement text,partner_terms_confirmed boolean,status text); CREATE TABLE feature_registry(slug text PRIMARY KEY,name text,category text,route text UNIQUE,description text); CREATE TABLE affiliate_earnings(amount bigint); INSERT INTO affiliate_earnings VALUES(123456); INSERT INTO affiliates(name,programme,commission_model,commission_bps,status) VALUES('Original','affiliate','tiered',2000,'active'),('Agency','partner','percentage',1700,'active');`,
    );
    const sql = readFileSync(
      new URL("../migrations/038_distribution_policies.sql", import.meta.url),
      "utf8",
    );
    await applyMigrationBatch(adapter, [sql]);
    await applyMigrationBatch(adapter, [sql]);
    assert.equal(
      (await db.query("SELECT * FROM distribution_policies")).rows.length,
      4,
    );
    const snapshot = (
      await db.query(
        "SELECT * FROM distribution_enrollments ORDER BY affiliate_id",
      )
    ).rows;
    assert.equal(snapshot.length, 2);
    assert.ok(snapshot.every((r) => r.review_required));
    assert.equal(
      (await db.query("SELECT amount FROM affiliate_earnings")).rows[0].amount,
      123456,
    );
    await db.exec("UPDATE affiliates SET commission_bps=4000");
    await applyMigrationBatch(adapter, [sql]);
    assert.deepEqual(
      (
        await db.query(
          "SELECT * FROM distribution_enrollments ORDER BY affiliate_id",
        )
      ).rows,
      snapshot,
    );
    await assert.rejects(
      db.exec(
        "UPDATE distribution_policies SET name='rewrite' WHERE state='LEGACY_SNAPSHOT'",
      ),
    );
    await assert.rejects(
      db.exec("UPDATE distribution_enrollments SET legacy_terms='{}'"),
    );
    await db.exec(
      "INSERT INTO affiliates(name,programme,commission_model,commission_bps,status) VALUES('New applicant','affiliate','tiered',2000,'pending')",
    );
    assert.equal(
      (await db.query("SELECT * FROM distribution_enrollments")).rows.length,
      3,
    );
    await db.exec("UPDATE distribution_enrollments SET review_required=false");
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int n FROM distribution_policies WHERE state='DRAFT'",
        )
      ).rows[0].n,
      2,
    );
  } finally {
    await db.close();
  }
});
