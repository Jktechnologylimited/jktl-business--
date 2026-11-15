import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import { can } from "../src/lib/admin-permissions.ts";
const require = createRequire(import.meta.url);
const env = {
  TEAM_PAYMENT_DETAILS_ENCRYPTION_KEY: Buffer.alloc(32, 17).toString("base64"),
  PAYSTACK_SECRET_KEY: "sk_test_fixture_only",
};
function load(file, deps = {}) {
  const code = ts.transpileModule(
    readFileSync(new URL("../" + file, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const m = { exports: {} };
  new Function("require", "module", "exports", "process", code)(
    (n) => (n in deps ? deps[n] : require(n)),
    m,
    m.exports,
    { env },
  );
  return m.exports;
}
const model = load("src/lib/team-payments/model.ts", { "server-only": {} });
const service = load("src/lib/team-payments/service.ts", {
  "server-only": {},
  "./model": model,
});
const owner = { id: "91000000-0000-4000-8000-000000000001" },
  support = { id: "91000000-0000-4000-8000-000000000002" },
  writer = { id: "91000000-0000-4000-8000-000000000003" },
  analyst = { id: "91000000-0000-4000-8000-000000000004" };
const provider = {
  banks: async () => [{ code: "058", name: "Fixture Bank" }],
  resolve: async (number) => ({
    accountNumber: number,
    accountName: "BANK VERIFIED PERSON",
  }),
};
const input = (revision = 0, accountNumber = "0123456789") => ({
  bankCode: "058",
  accountNumber,
  revision,
  confirmed: true,
});
test("team bank details use authenticated encryption and purpose/member binding, without secret fallbacks", () => {
  const payload = { accountNumber: "0123456789", accountName: "A fixture" };
  const a = model.encryptDetails(support.id, payload),
    b = model.encryptDetails(support.id, payload);
  assert.notEqual(a, b);
  assert.doesNotMatch(a, /0123456789|A fixture/);
  assert.deepEqual(model.decryptDetails(support.id, a), payload);
  assert.throws(() => model.decryptDetails(writer.id, a));
  assert.throws(() =>
    model.decryptDetails(support.id, a.slice(0, -6) + "AAAAAA"),
  );
  const saved = env.TEAM_PAYMENT_DETAILS_ENCRYPTION_KEY;
  delete env.TEAM_PAYMENT_DETAILS_ENCRYPTION_KEY;
  assert.equal(model.paymentsConfigured(), false);
  assert.throws(
    () => model.encryptDetails(support.id, payload),
    /not configured/,
  );
  env.TEAM_PAYMENT_DETAILS_ENCRYPTION_KEY = saved;
});
test("all Team roles may manage only their own details; financial report access does not grant review power", () => {
  for (const role of [
    "owner",
    "executive_associate",
    "support",
    "affiliate_manager",
    "analyst",
    "writer",
    "editor",
    "growth_gaming_lead",
  ]) {
    assert.equal(can(role, "manage_own_payment_details"), true);
    assert.equal(
      can(role, "manage_team_payments", {
        manage_team_payments: true,
        view_company_finance: true,
      }),
      role === "owner",
    );
  }
  assert.equal(can("nonsense", "manage_own_payment_details"), false);
});
test("real PostgreSQL-compatible queries enforce private verification, fresh approval, revision checks and audited access", async (t) => {
  const db = new PGlite(),
    q = async (sql, p = []) => (await db.query(sql, p)).rows;
  try {
    await db.exec(
      `CREATE TABLE admin_users(id uuid PRIMARY KEY,name text,role text,disabled_at timestamptz,staff_revoked_at timestamptz);`,
    );
    for (const [actor, role] of [
      [owner, "owner"],
      [support, "support"],
      [writer, "writer"],
      [analyst, "analyst"],
    ])
      await q("INSERT INTO admin_users(id,name,role)VALUES($1,$2,$3)", [
        actor.id,
        role,
        role,
      ]);
    const migration = readFileSync(
      new URL("../migrations/079_team_payment_details.sql", import.meta.url),
      "utf8",
    );
    await db.exec(migration);
    await db.exec(migration);
    await t.test(
      "bank preview cannot be forged into saved names, bank labels or another user ID",
      async () => {
        const preview = await service.verifyBank(q, support, input(), provider);
        assert.equal(preview.accountName, "BANK VERIFIED PERSON");
        const saved = await service.submitDetails(
          q,
          support,
          {
            ...input(),
            accountName: "FAKE",
            bankName: "FAKE",
            adminId: writer.id,
          },
          provider,
        );
        assert.equal(saved.status, "PENDING");
        assert.equal(saved.revision, 1);
        assert.equal(saved.last4, "6789");
        assert.equal(saved.accountName, "BANK VERIFIED PERSON");
        assert.equal(saved.bankName, "Fixture Bank");
        assert.equal(saved.accountNumber, undefined);
        assert.equal(saved.encrypted_details, undefined);
        assert.equal(await service.ownDetails(q, writer), null);
        assert.equal(
          (await q("SELECT count(*)::int n FROM team_payment_details"))[0].n,
          1,
        );
        assert.doesNotMatch(
          JSON.stringify(await q("SELECT * FROM team_payment_details")),
          /0123456789|BANK VERIFIED PERSON/,
        );
        assert.doesNotMatch(
          JSON.stringify(await q("SELECT * FROM team_payment_details_audit")),
          /0123456789|BANK VERIFIED PERSON/,
        );
      },
    );
    await t.test(
      "non-owners and forged owner fields cannot review, list or reveal another member",
      async () => {
        await assert.rejects(service.reviewQueue(q, support), /Access denied/);
        await assert.rejects(service.reviewQueue(q, analyst), /Access denied/);
        await assert.rejects(
          service.reviewDetails(
            q,
            { ...support, role: "owner" },
            {
              adminId: support.id,
              revision: 1,
              decision: "APPROVED",
              note: "",
            },
          ),
          /Access denied/,
        );
        await assert.rejects(
          service.revealDetails(q, writer, {
            adminId: support.id,
            revision: 1,
            reason: "SELF_REVIEW",
          }),
          /cannot view/,
        );
        await assert.rejects(
          service.revealDetails(q, owner, {
            adminId: support.id,
            revision: 1,
            reason: "PAYMENT_PREPARATION",
          }),
          /cannot view/,
        );
        const own = await service.revealDetails(q, support, {
          adminId: support.id,
          revision: 1,
          reason: "SELF_REVIEW",
        });
        assert.equal(own.accountNumber, "0123456789");
      },
    );
    await t.test(
      "approval is for one verified version; changes revoke approval and stale actions fail",
      async () => {
        const approved = await service.reviewDetails(q, owner, {
          adminId: support.id,
          revision: 1,
          decision: "APPROVED",
          note: "Checked with the team member",
        });
        assert.equal(approved.revision, 2);
        const queue = await service.reviewQueue(q, owner, 0, "APPROVED");
        assert.equal(queue.rows[0].accountName, "BANK VERIFIED PERSON");
        assert.equal(queue.rows[0].accountNumber, undefined);
        assert.equal(
          (
            await service.revealDetails(q, owner, {
              adminId: support.id,
              revision: 2,
              reason: "PAYMENT_PREPARATION",
            })
          ).accountNumber,
          "0123456789",
        );
        const changed = await service.submitDetails(
          q,
          support,
          input(2, "1234567890"),
          provider,
        );
        assert.equal(changed.status, "PENDING");
        assert.equal(changed.revision, 3);
        assert.equal(changed.reviewedAt, null);
        await assert.rejects(
          service.revealDetails(q, owner, {
            adminId: support.id,
            revision: 2,
            reason: "PAYMENT_PREPARATION",
          }),
          /cannot view/,
        );
        await assert.rejects(
          service.reviewDetails(q, owner, {
            adminId: support.id,
            revision: 1,
            decision: "APPROVED",
            note: "",
          }),
          /changed/,
        );
        await assert.rejects(
          service.submitDetails(q, support, input(2), provider),
          /changed/,
        );
      },
    );
    await t.test(
      "provider errors and mismatches preserve the previous account; confirmation is required",
      async () => {
        await assert.rejects(
          service.submitDetails(
            q,
            support,
            { ...input(3), confirmed: false },
            provider,
          ),
          /Confirm/,
        );
        await assert.rejects(
          service.submitDetails(q, support, input(3), {
            ...provider,
            resolve: async () => {
              throw Error("provider raw sensitive message");
            },
          }),
          /could not verify/,
        );
        await assert.rejects(
          service.submitDetails(q, support, input(3), {
            ...provider,
            resolve: async () => ({
              accountNumber: "9999999999",
              accountName: "OTHER",
            }),
          }),
          /invalid account/,
        );
        await assert.rejects(
          service.submitDetails(
            q,
            support,
            { ...input(3), bankCode: "INVALID" },
            provider,
          ),
          /could not verify/,
        );
        assert.equal((await service.ownDetails(q, support)).revision, 3);
      },
    );
    await t.test(
      "rejection, resubmission and removal preserve audit, while removal erases bank data",
      async () => {
        await assert.rejects(
          service.reviewDetails(q, owner, {
            adminId: support.id,
            revision: 3,
            decision: "REJECTED",
            note: "",
          }),
          /explanation/,
        );
        const rejected = await service.reviewDetails(q, owner, {
          adminId: support.id,
          revision: 3,
          decision: "REJECTED",
          note: "Please confirm the account holder with me",
        });
        assert.equal(rejected.status, "REJECTED");
        const fresh = await service.submitDetails(
          q,
          support,
          input(4),
          provider,
        );
        assert.equal(fresh.revision, 5);
        assert.equal(fresh.status, "PENDING");
        const removed = await service.removeDetails(q, support, 5);
        assert.equal(removed.status, "REMOVED");
        assert.equal(removed.accountName, "");
        const raw = (
          await q("SELECT * FROM team_payment_details WHERE admin_id=$1", [
            support.id,
          ])
        )[0];
        assert.equal(raw.encrypted_details, null);
        assert.equal(raw.account_last4, null);
        assert.equal(raw.bank_name, null);
        await assert.rejects(
          service.revealDetails(q, support, {
            adminId: support.id,
            revision: 6,
            reason: "SELF_REVIEW",
          }),
          /cannot view/,
        );
        await assert.rejects(service.removeDetails(q, support, 5), /changed/);
        await service.submitDetails(q, support, input(6), provider);
        assert.equal((await service.ownDetails(q, support)).revision, 7);
        const events = (
          await q("SELECT event FROM team_payment_details_audit ORDER BY id")
        ).map((r) => r.event);
        assert.ok(
          events.includes("APPROVED") &&
            events.includes("REJECTED") &&
            events.includes("REMOVED") &&
            events.includes("REVEALED"),
        );
      },
    );
    await t.test(
      "an audit failure rolls back the associated bank update atomically",
      async () => {
        await db.exec(
          `CREATE FUNCTION fail_bank_audit()RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture audit failure'; END $$;CREATE TRIGGER fail_bank_audit BEFORE INSERT ON team_payment_details_audit FOR EACH ROW EXECUTE FUNCTION fail_bank_audit();`,
        );
        await assert.rejects(
          service.submitDetails(q, support, input(7, "2234567890"), provider),
          /fixture audit failure/,
        );
        assert.equal((await service.ownDetails(q, support)).revision, 7);
        await db.exec(
          "DROP TRIGGER fail_bank_audit ON team_payment_details_audit;",
        );
      },
    );
    await t.test(
      "disabled or revoked members cannot submit, be approved or use stored permissions",
      async () => {
        await q("UPDATE admin_users SET staff_revoked_at=now() WHERE id=$1", [
          support.id,
        ]);
        await assert.rejects(service.ownDetails(q, support), /Access denied/);
        await assert.rejects(
          service.reviewDetails(q, owner, {
            adminId: support.id,
            revision: 7,
            decision: "APPROVED",
            note: "",
          }),
          /changed/,
        );
        assert.equal((await service.reviewQueue(q, owner)).rows.length, 0);
        await q("UPDATE admin_users SET disabled_at=now() WHERE id=$1", [
          owner.id,
        ]);
        await assert.rejects(service.reviewQueue(q, owner), /Access denied/);
        await q("UPDATE admin_users SET disabled_at=NULL WHERE id=$1", [
          owner.id,
        ]);
      },
    );
    await t.test(
      "owner lists are bounded and pagination does not expose full numbers",
      async () => {
        for (let i = 0; i < 27; i++) {
          const id = randomUUID();
          await q(
            "INSERT INTO admin_users(id,name,role)VALUES($1,$2,'support')",
            [id, "Pagination fixture " + i],
          );
          await q(
            "INSERT INTO team_payment_details(admin_id,bank_code,bank_name,account_last4,encrypted_details,status,verified_at)VALUES($1,'058','Fixture Bank','6789',$2,'PENDING',now())",
            [
              id,
              model.encryptDetails(id, {
                accountNumber: "0123456789",
                accountName: "Fixture",
              }),
            ],
          );
        }
        const a = await service.reviewQueue(q, owner, 0, "PENDING"),
          b = await service.reviewQueue(q, owner, 1, "PENDING");
        assert.equal(a.rows.length, 25);
        assert.equal(a.more, true);
        assert.equal(b.rows.length, 2);
        assert.equal(b.more, false);
        assert.equal(
          new Set([...a.rows, ...b.rows].map((r) => r.adminId)).size,
          27,
        );
        assert.doesNotMatch(JSON.stringify(a), /0123456789|encrypted_details/);
        await assert.rejects(
          service.reviewQueue(q, owner, -1),
          /Invalid review/,
        );
      },
    );
  } finally {
    await db.close();
  }
});
