import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
const require = createRequire(import.meta.url);
function load(file, deps) {
  const code = ts.transpileModule(
      readFileSync(new URL("../" + file, import.meta.url), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    m = { exports: {} };
  new Function("require", "module", "exports", code)(
    (n) => (n in deps ? deps[n] : require(n)),
    m,
    m.exports,
  );
  return m.exports;
}
test("custom Earn isolates owners, reuses programmes and preserves approval, terms and verified earnings", async () => {
  const db = new PGlite();
  try {
    const query = async (sql, p = []) => (await db.query(sql, p)).rows;
    const org = crypto.randomUUID(),
      project = crypto.randomUUID(),
      user = crypto.randomUUID(),
      stranger = crypto.randomUUID();
    await db.exec(
      `CREATE TABLE users(id uuid PRIMARY KEY,name text,email text);CREATE TABLE organization_members(organization_id uuid,user_id uuid,role text,active boolean);CREATE TABLE custom_projects(id uuid,organization_id uuid);CREATE TABLE affiliates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text,email text,password_hash text,referral_code text UNIQUE,status text,programme text,application_note text,application_data jsonb,application_stage text,applicant_message text,commission_bps int,commission_model text,signup_bonus_kobo int,subscription_bonus_kobo int,recurring_monthly_kobo int,partner_terms_confirmed boolean DEFAULT false,UNIQUE(email,programme),UNIQUE(id,programme));CREATE TABLE distribution_account_links(user_id uuid,affiliate_id uuid UNIQUE,program text,PRIMARY KEY(user_id,program),FOREIGN KEY(affiliate_id,program) REFERENCES affiliates(id,programme));CREATE TABLE distribution_audit(id uuid DEFAULT gen_random_uuid(),actor_id text,event text,affiliate_id uuid,detail jsonb);CREATE TABLE affiliate_activity(affiliate_id uuid,state text);CREATE TABLE distribution_contracts(id uuid DEFAULT gen_random_uuid(),affiliate_id uuid,status text,model text,activated_at timestamptz,created_at timestamptz DEFAULT now());CREATE TABLE distribution_ledger(affiliate_id uuid,amount_kobo int,status text);CREATE TABLE distribution_adjustments(affiliate_id uuid,amount_kobo int,payout_id uuid);CREATE TABLE distribution_payouts(affiliate_id uuid,amount_kobo int,status text);CREATE TABLE affiliate_referrals(affiliate_id uuid,organization_id uuid);`,
    );
    await query("INSERT INTO users VALUES($1,$2,$3)", [
      user,
      "Client Owner",
      "owner@example.test",
    ]);
    await query(
      "INSERT INTO organization_members VALUES($1,$2,'owner',true),($1,$3,'member',true)",
      [org, user, stranger],
    );
    await query("INSERT INTO custom_projects VALUES($1,$2)", [project, org]);
    let hashed = "",
      legacyCalls = 0,
      proof = false;
    const enrollment = load("src/lib/distribution/program-enrollment.ts", {
      "server-only": {},
      "@/lib/affiliate-commission": {
        DEFAULT_TERMS: {
          signupBonusKobo: 0,
          subscriptionBonusKobo: 0,
          recurringMonthlyKobo: 0,
        },
      },
      "@/lib/custom/service": { query },
      "@/lib/db/auth": {
        hashPassword: async (p) => {
          hashed = p;
          return "unusable-random-hash";
        },
      },
      "@/lib/support/service": { rate: async () => {} },
    });
    let account;
    const earn = load("src/lib/custom/portal-earn.ts", {
      "server-only": {},
      "./service": { query },
      "@/lib/distribution/program-enrollment": enrollment,
      "@/lib/db/affiliate-auth": {
        verifyAffiliateLogin: async () =>
          proof ? { ok: true, affiliate: account } : { ok: false },
      },
      "@/lib/db/affiliates": {
        getAffiliateBalance: async () => {
          legacyCalls++;
          return {
            pendingKobo: 1200,
            balanceKobo: 2300,
            totalPaidOutKobo: 4500,
          };
        },
      },
      "@/lib/support/service": { rate: async () => {} },
    });
    const actor = {
      projectId: project,
      organizationId: org,
      userId: user,
      scopes: ["earn:read", "earn:write"],
    };
    await assert.rejects(
      earn.projectEarn({ ...actor, userId: stranger }),
      /Only the current business owner/,
    );
    await assert.rejects(
      earn.projectEarn({ ...actor, projectId: crypto.randomUUID() }),
      /Only/,
    );
    await assert.rejects(
      earn.applyProjectPartner(actor, { consent: false }),
      /accept/,
    );
    assert.equal((await earn.projectEarn(actor)).canApplyPartner, true);
    await earn.applyProjectPartner(actor, {
      consent: true,
      company: "Client Company",
      phone: "08000000000",
      country: "Nigeria",
      category: "Consultancy",
      partnership: "Recommend services to clients",
      commission_bps: "9999",
      userId: stranger,
    });
    let a = (await query("SELECT * FROM affiliates"))[0];
    assert.equal(a.status, "pending");
    assert.equal(a.commission_bps, 0);
    assert.equal(a.partner_terms_confirmed, false);
    assert.equal(a.application_data.accountSource, "CUSTOM_PROJECT");
    assert.equal(a.application_data.customProjectId, project);
    assert.ok(hashed.length >= 64);
    let view = await earn.projectEarn(actor);
    assert.equal(view.canApplyPartner, false);
    assert.equal(view.profiles[0].ready, false);
    assert.equal(view.profiles[0].referralUrl, null);
    assert.equal(JSON.stringify(view).includes("password_hash"), false);
    await assert.rejects(
      earn.applyProjectPartner(actor, {
        consent: true,
        company: "Again",
        phone: "1",
        country: "Nigeria",
        category: "consultant",
        partnership: "Again",
      }),
      /already exists/,
    );
    assert.equal(
      (await query("SELECT count(*)::int n FROM affiliates"))[0].n,
      1,
    );
    await query(
      "UPDATE affiliates SET status='active',application_stage='APPROVED',commission_bps=1000 WHERE id=$1",
      [a.id],
    );
    assert.equal((await earn.projectEarn(actor)).profiles[0].ready, false);
    await query(
      "UPDATE affiliates SET partner_terms_confirmed=true WHERE id=$1",
      [a.id],
    );
    view = await earn.projectEarn(actor);
    assert.equal(view.profiles[0].ready, true);
    assert.equal(
      view.profiles[0].referralUrl,
      "https://jktl.com.ng/?ref=" + a.referral_code,
    );
    assert.equal(view.profiles[0].availableKobo, 2300);
    assert.ok(legacyCalls > 0);
    await query("UPDATE affiliates SET commission_model='policy' WHERE id=$1", [
      a.id,
    ]);
    assert.equal((await earn.projectEarn(actor)).profiles[0].ready, false);
    await query(
      "INSERT INTO distribution_contracts(affiliate_id,status,model) VALUES($1,'ACTIVE','RESELLER')",
      [a.id],
    );
    assert.equal((await earn.projectEarn(actor)).profiles[0].ready, false);
    await query(
      "UPDATE distribution_contracts SET model='REFERRAL' WHERE affiliate_id=$1",
      [a.id],
    );
    await query(
      "INSERT INTO distribution_ledger VALUES($1,10000,'AVAILABLE'),($1,5000,'UNDER_REVIEW'),($1,2000,'REVERSED')",
      [a.id],
    );
    await query("INSERT INTO distribution_adjustments VALUES($1,-1500,NULL)", [
      a.id,
    ]);
    await query(
      "INSERT INTO distribution_payouts VALUES($1,2000,'PAID'),($1,9000,'FAILED')",
      [a.id],
    );
    view = await earn.projectEarn(actor);
    assert.equal(view.profiles[0].ready, true);
    assert.equal(view.profiles[0].availableKobo, 8500);
    assert.equal(view.profiles[0].pendingKobo, 5000);
    assert.equal(view.profiles[0].paidKobo, 2000);
    // A matching email is not permission to read a programme or its balances.
    await query("DELETE FROM distribution_account_links");
    view = await earn.projectEarn(actor);
    assert.equal(view.profiles.length, 0);
    assert.equal(view.needsLink, true);
    assert.equal(view.canApplyPartner, false);
    account = { id: a.id, programme: "partner" };
    await assert.rejects(
      earn.connectProjectProgramme(actor, {
        program: "partner",
        email: a.email,
        password: "bad",
      }),
      /credentials/,
    );
    assert.equal(
      (await query("SELECT count(*)::int n FROM distribution_account_links"))[0]
        .n,
      0,
    );
    proof = true;
    await earn.connectProjectProgramme(actor, {
      program: "partner",
      email: a.email,
      password: "verified-test-fixture",
    });
    assert.equal((await earn.projectEarn(actor)).profiles.length, 1);
    await earn.connectProjectProgramme(actor, {
      program: "partner",
      email: a.email,
      password: "verified-test-fixture",
    });
    assert.equal(
      (await query("SELECT count(*)::int n FROM distribution_account_links"))[0]
        .n,
      1,
    );
    await query("UPDATE distribution_account_links SET user_id=$1", [stranger]);
    await assert.rejects(
      earn.connectProjectProgramme(actor, {
        program: "partner",
        email: a.email,
        password: "verified-test-fixture",
      }),
      /another Business identity/,
    );
  } finally {
    await db.close();
  }
});
