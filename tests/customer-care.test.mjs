import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { careInput, CARE_STEPS } from "../src/lib/customer-care/model.ts";
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
function form(values = {}) {
  const f = new FormData();
  for (const [k, v] of Object.entries({
    status: "IN_PROGRESS",
    revision: "0",
    ...values,
  })) {
    for (const value of Array.isArray(v) ? v : [v]) f.append(k, value);
  }
  return f;
}
test("handover requires verified setup and customer signoff; reviews are optional", () => {
  assert.throws(
    () => careInput(form({ status: "COMPLETE" })),
    /Complete the setup/,
  );
  const required = Object.keys(CARE_STEPS).filter((k) => k !== "feedback");
  assert.equal(
    careInput(form({ status: "COMPLETE", steps: required })).status,
    "COMPLETE",
  );
  assert.throws(() => careInput(form({ status: "constructor" })));
  assert.throws(() => careInput(form({ steps: ["__proto__"] })));
  assert.throws(() => careInput(form({ follow: "2026-02-31" })));
  assert.throws(() => careInput(form({ revision: "-1" })));
});
test("care progress is authorized, assigned to active support, revision guarded, audited and does not change customer websites", async () => {
  const db = new PGlite();
  try {
    const query = async (s, p = []) => (await db.query(s, p)).rows,
      org = crypto.randomUUID(),
      other = crypto.randomUUID(),
      owner = crypto.randomUUID(),
      staff = crypto.randomUUID();
    await db.exec(
      `CREATE TABLE organizations(id uuid PRIMARY KEY,name text);CREATE TABLE admin_users(id uuid PRIMARY KEY,name text,role text,disabled_at timestamptz,staff_revoked_at timestamptz);CREATE TABLE support_cases(id uuid DEFAULT gen_random_uuid(),organization_id uuid,subject text,status text,sensitive boolean,assigned_to uuid,updated_at timestamptz DEFAULT now(),custom_project_id uuid);`,
    );
    await db.exec(
      readFileSync(
        new URL(
          "../migrations/069_founding_customer_care.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await query(
      "INSERT INTO organizations VALUES($1,'Founding business'),($2,'Other business')",
      [org, other],
    );
    await query(
      "INSERT INTO admin_users(id,name,role) VALUES($1,'Owner','owner'),($2,'Support','support')",
      [owner, staff],
    );
    await query("INSERT INTO customer_care(organization_id) VALUES($1)", [org]);
    let allowed = true;
    const actions = load("src/lib/actions/customer-care-actions.ts", {
      "@/lib/admin-session": {
        requireAdminCapability: async (c) => {
          assert.equal(c, "manage_support");
          if (!allowed) throw Error("Denied");
          return { id: owner };
        },
      },
      "@/lib/custom/service": { query },
      "@/lib/customer-care/model": { careInput },
      "@/lib/support/model": {
        redact: (s) => s.replace("TEST_SECRET", "[redacted]"),
      },
      "next/cache": { revalidatePath() {} },
    });
    const f = form({
      organization: org,
      assigned: staff,
      notes: "Brief confirmed; TEST_SECRET removed.",
    });
    await actions.saveCustomerCareAction(f);
    const row = (await query("SELECT * FROM customer_care"))[0];
    assert.equal(row.assigned_to, staff);
    assert.equal(row.status, "IN_PROGRESS");
    assert.equal(row.revision, 1);
    assert.doesNotMatch(row.notes, /TEST_SECRET/);
    assert.equal(
      (await query("SELECT count(*)::int n FROM customer_care_audit"))[0].n,
      1,
    );
    await assert.rejects(
      actions.saveCustomerCareAction(f),
      /changed in another session/,
    );
    allowed = false;
    await assert.rejects(
      actions.saveCustomerCareAction(
        form({ organization: org, revision: "1" }),
      ),
      /Denied/,
    );
    allowed = true;
    await query("UPDATE admin_users SET disabled_at=now() WHERE id=$1", [
      staff,
    ]);
    await assert.rejects(
      actions.saveCustomerCareAction(
        form({ organization: org, revision: "1", assigned: staff }),
      ),
      /active support/,
    );
    // Founder status prioritises ordinary work without exposing sensitive cases or outranking escalation.
    await query(
      "INSERT INTO support_cases(organization_id,subject,status,sensitive) VALUES($1,'Founding setup','WAITING',false),($2,'Other setup','WAITING',false),($2,'Urgent escalation','ESCALATED',true),($1,'Resolved private','RESOLVED',true)",
      [org, other],
    );
    let role = "owner";
    const support = load("src/lib/actions/support-actions.ts", {
      "next/server": { after() {} },
      "next/cache": { revalidatePath() {} },
      "next/headers": { cookies: async () => ({}) },
      "@/lib/support/service": { query },
      "@/lib/admin-session": {
        requireAdminCapability: async () => ({ role, id: owner }),
      },
      "@/lib/support/model": {},
      "@/lib/website-templates": {},
      "@/lib/support/notifications": {},
    });
    let queue = (await support.supportQueueAction()).cases;
    assert.equal(queue[0].subject, "Urgent escalation");
    assert.equal(queue[1].subject, "Founding setup");
    assert.equal(queue[1].care_priority, true);
    assert.equal(queue.at(-1).status, "RESOLVED");
    role = "support";
    queue = (await support.supportQueueAction()).cases;
    assert.equal(
      queue.some((c) => c.sensitive),
      false,
    );
    assert.equal(queue[0].subject, "Founding setup");
    assert.equal(queue.length, 2);
  } finally {
    await db.close();
  }
});
