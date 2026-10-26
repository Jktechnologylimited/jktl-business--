import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";
import { readFileSync } from "node:fs";
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
      if (!(n in deps)) throw Error(n);
      return deps[n];
    },
    m,
    m.exports,
  );
  return m.exports;
}
const profile = "10000000-0000-4000-8000-000000000001",
  org = "10000000-0000-4000-8000-000000000002";
test("referrals require explicit consent and trusted origin, then consume an opaque eligible visit only once", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `CREATE TABLE affiliates(id uuid PRIMARY KEY,email text,referral_code text,status text,commission_model text,signup_bonus_kobo bigint);INSERT INTO affiliates VALUES('${profile}','agency@example.test','AGENCY','active','policy',0);CREATE TABLE organizations(id uuid PRIMARY KEY,created_at timestamptz DEFAULT now());INSERT INTO organizations(id) VALUES('${org}');CREATE TABLE affiliate_referrals(affiliate_id uuid,organization_id uuid UNIQUE);CREATE TABLE users(id uuid,email text);CREATE TABLE organization_members(organization_id uuid,user_id uuid);CREATE TABLE distribution_account_links(affiliate_id uuid,user_id uuid);CREATE TABLE website_plan_payments(organization_id uuid);CREATE TABLE domain_orders(organization_id uuid,paid_at timestamptz);CREATE TABLE email_orders(organization_id uuid,paid_at timestamptz);CREATE TABLE infrastructure_accounts(organization_id uuid,subscription_status text);CREATE TABLE affiliate_earnings(id bigserial,affiliate_id uuid,organization_id uuid,source_amount_kobo bigint,commission_kobo bigint,paystack_reference text,kind text,status text,period_key text,note text);CREATE TABLE distribution_audit(id bigserial,actor_id text,event text,affiliate_id uuid,detail jsonb);`,
    );
    await db.exec(
      readFileSync(
        new URL(
          "../migrations/045_distribution_referrals.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const query = async (s, p = []) => (await db.query(s, p)).rows;
    class Response {
      constructor(body, opts = {}) {
        this.body = body;
        this.status = opts.status || 200;
        this.headers = new Headers(opts.headers);
        this.saved = {};
        this.cookies = {
          set: (name, value, options) => {
            this.saved[name] = { value, options };
          },
        };
      }
      static json(body, opts) {
        return new Response(body, opts);
      }
    }
    const route = load("../src/app/api/referrals/capture/route.ts", {
      "next/server": { NextResponse: Response },
      "node:crypto": await import("node:crypto"),
      "@/lib/custom/service": { query },
      "@/lib/domains/store": { rateLimit: async () => {} },
    });
    let token;
    const req = (body, origin = "https://jktl.com.ng") => ({
      nextUrl: new URL("https://business.jktl.com.ng/api/referrals/capture"),
      headers: new Headers({ origin }),
      json: async () => body,
      cookies: { get: () => (token ? { value: token } : undefined) },
    });
    assert.equal(
      (
        await route.POST(
          req({ code: "AGENCY", consent: true }, "https://attacker.example"),
        )
      ).status,
      403,
    );
    assert.equal((await route.POST(req({ code: "AGENCY" }))).status, 400);
    assert.equal(
      (await query("SELECT * FROM distribution_referral_visits")).length,
      0,
    );
    const response = await route.POST(req({ code: "AGENCY", consent: true }));
    assert.equal(response.body.tracked, true);
    assert.equal(
      response.headers.get("Access-Control-Allow-Credentials"),
      "true",
    );
    const c = response.saved.jktl_referral_visit;
    assert.equal(c.options.httpOnly, true);
    assert.equal(c.options.secure, true);
    assert.equal(c.options.domain, "jktl.com.ng");
    assert.equal(c.options.maxAge, 30 * 86400);
    token = c.value;
    await route.POST(req({ code: "AGENCY", consent: true }));
    assert.equal(
      (await query("SELECT * FROM distribution_referral_visits")).length,
      1,
    );
    const consumer = load("../src/lib/distribution/referrals.ts", {
      "server-only": {},
      "next/headers": {
        cookies: async () => ({ get: () => ({ value: token }) }),
      },
      "@/lib/custom/service": { query },
    });
    const goodToken = token;
    token = "tampered";
    await consumer.consumeReferralVisit(org);
    assert.equal((await query("SELECT * FROM affiliate_referrals")).length, 0);
    token = goodToken;
    await consumer.consumeReferralVisit(org);
    await consumer.consumeReferralVisit(org);
    assert.equal((await query("SELECT * FROM affiliate_referrals")).length, 1);
    assert.equal((await query("SELECT * FROM distribution_audit")).length, 1);
    assert.equal((await query("SELECT * FROM affiliate_earnings")).length, 0);
    await query("DELETE FROM affiliate_referrals");
    await query(
      "UPDATE distribution_referral_visits SET consumed_organization_id=NULL,expires_at=now()-interval '1 day'",
    );
    await consumer.consumeReferralVisit(org);
    assert.equal((await query("SELECT * FROM affiliate_referrals")).length, 0);
    await query(
      "UPDATE distribution_referral_visits SET expires_at=now()+interval '1 day'",
    );
    await query("INSERT INTO website_plan_payments VALUES($1)", [org]);
    await consumer.consumeReferralVisit(org);
    assert.equal((await query("SELECT * FROM affiliate_referrals")).length, 0);
    await query("DELETE FROM website_plan_payments");
    await query(
      "INSERT INTO users VALUES(gen_random_uuid(),'agency@example.test')",
    );
    await query("INSERT INTO organization_members SELECT $1,id FROM users", [
      org,
    ]);
    await consumer.consumeReferralVisit(org);
    assert.equal((await query("SELECT * FROM affiliate_referrals")).length, 0);
    const decline = await route.POST(req({ decline: true }));
    assert.equal(decline.saved.jktl_referral_visit.options.maxAge, 0);
    assert.equal(decline.body.tracked, false);
  } finally {
    await db.close();
  }
});
