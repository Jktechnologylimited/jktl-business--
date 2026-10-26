import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { applyMigrationBatch } from "../scripts/sql-statements.mjs";
const user = "10000000-0000-4000-8000-000000000001",
  org = "10000000-0000-4000-8000-000000000002",
  pid = "10000000-0000-4000-8000-000000000003",
  other = "10000000-0000-4000-8000-000000000004";
test("partner invites require current agreement, owner acceptance, single use and revocable scoped access", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `CREATE TABLE admin_users(id uuid PRIMARY KEY);CREATE TABLE users(id uuid PRIMARY KEY);CREATE TABLE organizations(id uuid PRIMARY KEY);CREATE TABLE affiliates(id uuid PRIMARY KEY,programme text,status text,partner_terms_confirmed boolean);CREATE TABLE distribution_audit(id bigserial,actor_id text,event text,affiliate_id uuid,detail jsonb);CREATE TABLE feature_registry(slug text PRIMARY KEY,name text,category text,route text UNIQUE,description text);INSERT INTO users VALUES('${user}');INSERT INTO organizations VALUES('${org}');INSERT INTO affiliates VALUES('${pid}','partner','active',true),('${other}','partner','active',true);`,
    );
    await db.exec(
      `ALTER TABLE affiliates ADD COLUMN commission_model text DEFAULT 'tiered';ALTER TABLE affiliates ADD COLUMN email text;ALTER TABLE users ADD COLUMN email text;ALTER TABLE organizations ADD COLUMN created_at timestamptz DEFAULT now();CREATE TABLE distribution_contracts(affiliate_id uuid,status text,model text);CREATE TABLE affiliate_referrals(affiliate_id uuid,organization_id uuid UNIQUE);CREATE TABLE website_plan_payments(organization_id uuid);CREATE TABLE domain_orders(organization_id uuid,paid_at timestamptz);CREATE TABLE email_orders(organization_id uuid,paid_at timestamptz);CREATE TABLE infrastructure_accounts(organization_id uuid,subscription_status text);CREATE TABLE organization_members(organization_id uuid,user_id uuid);UPDATE affiliates SET commission_model='policy';INSERT INTO distribution_contracts VALUES('${pid}','ACTIVE','REFERRAL');`,
    );
    const query = async (s, p = []) => (await db.query(s, p)).rows;
    await applyMigrationBatch(
      {
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
      },
      [
        readFileSync(
          new URL(
            "../migrations/039_distribution_clients.sql",
            import.meta.url,
          ),
          "utf8",
        ),
        readFileSync(
          new URL("../migrations/040_partner_workspace.sql", import.meta.url),
          "utf8",
        ),
      ],
    );
    await db.exec(
      "INSERT INTO feature_registry(slug,name,category,route,description,partner_mode,partner_actions) VALUES('website-builder','Website','Product','/business/website','Website','SELF_SERVICE',ARRAY['REQUEST_SETUP'])",
    );
    let partnerId = pid,
      isOwner = true;
    const deps = {
      "node:crypto": await import("node:crypto"),
      "@/lib/custom/service": {
        query,
        owner: async () => {
          if (!isOwner) throw Error("owner required");
          return { userId: user, organizationId: org };
        },
      },
      "@/lib/session": {
        requireSession: async () => ({ userId: user, organizationId: org }),
      },
      "@/lib/affiliate-session": {
        requireAffiliateSession: async () => ({ id: partnerId }),
        startAffiliateSession: async () => {},
      },
      "@/lib/db/affiliate-auth": {
        verifyAffiliateLogin: async () => ({ ok: false }),
      },
      "@/lib/support/service": { rate: async () => {} },
      "@/lib/distribution/access":
        await import("../src/lib/distribution/access.ts"),
      "next/navigation": { redirect: () => {} },
      "next/cache": { revalidatePath: () => {} },
    };
    const m = { exports: {} };
    new Function(
      "require",
      "module",
      "exports",
      ts.transpileModule(
        readFileSync(
          new URL(
            "../src/lib/actions/partner-client-actions.ts",
            import.meta.url,
          ),
          "utf8",
        ),
        {
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
          },
        },
      ).outputText,
    )(
      (n) => {
        if (!(n in deps)) throw Error(n);
        return deps[n];
      },
      m,
      m.exports,
    );
    const a = m.exports;
    const invite = await a.invitePartnerClientAction("Test client");
    const token = new URL(invite.url).searchParams.get("invite");
    assert.equal(token.length, 64);
    assert.ok(
      !(
        await query("SELECT token_hash FROM partner_client_invitations")
      )[0].token_hash.includes(token),
    );
    const f = new FormData();
    f.set("token", token);
    f.set("consent", "on");
    f.append("scopes", "REQUEST_SERVICE_CHANGES");
    isOwner = false;
    await assert.rejects(a.acceptPartnerInviteAction(f));
    isOwner = true;
    await a.acceptPartnerInviteAction(f);
    await assert.rejects(a.acceptPartnerInviteAction(f));
    assert.equal(
      (await query("SELECT affiliate_id FROM affiliate_referrals"))[0]
        .affiliate_id,
      pid,
    );
    const relationship = (
      await query("SELECT * FROM partner_client_access")
    )[0];
    const request = new FormData();
    request.set("relationship", relationship.id);
    request.set("product", "website");
    request.set("message", "Please help with website onboarding");
    partnerId = other;
    await assert.rejects(a.requestPartnerServiceAction(request));
    partnerId = pid;
    await a.requestPartnerServiceAction(request);
    assert.equal(
      (await query("SELECT * FROM partner_service_requests")).length,
      1,
    );
    const revoke = new FormData();
    revoke.set("id", relationship.id);
    await a.revokePartnerAccessAction(revoke);
    await assert.rejects(a.requestPartnerServiceAction(request));
    await query("UPDATE affiliates SET status='suspended' WHERE id=$1", [pid]);
    await assert.rejects(a.invitePartnerClientAction("Blocked"));
    assert.ok((await query("SELECT * FROM distribution_audit")).length >= 4);
  } finally {
    await db.close();
  }
});

test("invitation intent survives authentication without accepting arbitrary redirects", async () => {
  const { emailIntent, emailDestination } =
    await import("../src/lib/product-intent.ts");
  const token = "a".repeat(64);
  const p = new URLSearchParams({ next: "distribution", invite: token });
  assert.equal(emailIntent(p), "?next=distribution&invite=" + token);
  assert.equal(emailDestination(p), "/business/distribution?invite=" + token);
  assert.equal(
    emailDestination(
      new URLSearchParams({
        next: "distribution",
        invite: "https://evil.example",
      }),
    ),
    "/business/distribution",
  );
  assert.equal(
    emailDestination(new URLSearchParams({ next: "https://evil.example" })),
    null,
  );
});

test("program application intent preserves only supported programme choices", async () => {
  const { emailIntent, emailDestination } =
    await import("../src/lib/product-intent.ts");
  for (const program of ["affiliate", "partner"]) {
    const p = new URLSearchParams({ next: "programs", program });
    assert.equal(emailIntent(p), "?next=programs&program=" + program);
    assert.equal(
      emailDestination(p),
      "/business/programs/apply?program=" + program,
    );
  }
  assert.equal(
    emailDestination(
      new URLSearchParams({
        next: "programs",
        program: "https://evil.example",
      }),
    ),
    "/business/programs/apply",
  );
});
