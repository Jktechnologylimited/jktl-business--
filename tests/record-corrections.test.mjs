import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const owner = "60000000-0000-4000-8000-000000000001",
  manager = "60000000-0000-4000-8000-000000000002",
  team = "60000000-0000-4000-8000-000000000003",
  user = "60000000-0000-4000-8000-000000000004",
  affiliate = "60000000-0000-4000-8000-000000000005",
  partner = "60000000-0000-4000-8000-000000000006",
  org = "60000000-0000-4000-8000-000000000007",
  other = "60000000-0000-4000-8000-000000000008";
test("corrections preserve identities and financial data; sensitive edits synchronize linked logins atomically", async () => {
  const db = new PGlite(),
    q = async (s, p = []) => (await db.query(s, p)).rows;
  try {
    await db.exec(
      `CREATE TABLE users(id uuid PRIMARY KEY,name text,email text UNIQUE,phone text,password_hash text);CREATE TABLE organizations(id uuid PRIMARY KEY,name text);CREATE TABLE organization_members(user_id uuid,name text,email text);CREATE TABLE business_profiles(organization_id uuid PRIMARY KEY,display_name text);CREATE TABLE admin_users(id uuid PRIMARY KEY,name text,email text UNIQUE,role text,disabled_at timestamptz,staff_revoked_at timestamptz,business_user_id uuid,permission_overrides jsonb DEFAULT '{}');CREATE TABLE affiliates(id uuid PRIMARY KEY,name text,email text,programme text,application_note text DEFAULT '',commission_bps integer DEFAULT 2000,bank_account text DEFAULT 'unchanged',referral_code text DEFAULT 'REF',UNIQUE(email,programme));CREATE TABLE distribution_account_links(user_id uuid,affiliate_id uuid,program text);CREATE TABLE custom_clients(organization_id uuid PRIMARY KEY,user_id uuid,activated_at timestamptz);CREATE TABLE sessions(user_id uuid);CREATE TABLE admin_sessions(admin_user_id uuid);CREATE TABLE affiliate_sessions(affiliate_id uuid);CREATE TABLE editorial_invitations(user_id uuid,accepted_at timestamptz,revoked_at timestamptz);CREATE TABLE password_reset_tokens(user_id uuid,used_at timestamptz);CREATE TABLE affiliate_password_resets(affiliate_id uuid,used_at timestamptz);CREATE TABLE custom_invitations(user_id uuid,used_at timestamptz,revoked_at timestamptz);CREATE TABLE affiliate_invitations(affiliate_id uuid,email text,program text DEFAULT 'affiliate',accepted_at timestamptz,revoked_at timestamptz);CREATE TABLE distribution_audit(actor_id text,event text,affiliate_id uuid,detail jsonb);CREATE TABLE custom_audit(organization_id uuid,actor_id text,event text,detail jsonb);INSERT INTO users VALUES('${user}','Original Person','old@example.test','0800','never-change'),('${other}','Other Person','taken@example.test','','other-hash');INSERT INTO admin_users(id,name,email,role,business_user_id) VALUES('${owner}','Owner','owner@example.test','owner',NULL),('${manager}','Manager','manager@example.test','affiliate_manager',NULL),('${team}','Team display','old@example.test','support','${user}');INSERT INTO organizations VALUES('${org}','Original Company');INSERT INTO organization_members VALUES('${user}','Original Person','old@example.test');INSERT INTO business_profiles VALUES('${org}','Original Company');INSERT INTO custom_clients VALUES('${org}','${user}',now());INSERT INTO affiliates(id,name,email,programme) VALUES('${affiliate}','Creator','old@example.test','affiliate'),('${partner}','Agency','old@example.test','partner');INSERT INTO distribution_account_links VALUES('${user}','${affiliate}','affiliate'),('${user}','${partner}','partner');INSERT INTO sessions VALUES('${user}');INSERT INTO admin_sessions VALUES('${team}');INSERT INTO affiliate_sessions VALUES('${affiliate}'),('${partner}');INSERT INTO editorial_invitations(user_id) VALUES('${team}');INSERT INTO password_reset_tokens(user_id) VALUES('${user}');INSERT INTO affiliate_password_resets(affiliate_id) VALUES('${affiliate}');INSERT INTO custom_invitations(user_id) VALUES('${user}');INSERT INTO affiliate_invitations(affiliate_id,email) VALUES('${affiliate}','old@example.test');`,
    );
    const migration = readFileSync(
      new URL("../migrations/065_record_corrections.sql", import.meta.url),
      "utf8",
    );
    await db.exec(migration);
    await db.exec(migration);
    const correct = async (k, id, old, changes, actor = owner) =>
      (
        await q(
          "SELECT correct_jktl_record($1,$2,$3::jsonb,$4::jsonb,$5) AS result",
          [k, id, JSON.stringify(old), JSON.stringify(changes), actor],
        )
      )[0].result;
    let previous = { name: "Creator", email: "old@example.test", note: "" };
    const changed = {
      ...previous,
      name: "Corrected Creator",
      note: "Correct note",
    };
    await correct("affiliate", affiliate, previous, changed, manager);
    assert.equal((await q("SELECT count(*)::int AS n FROM sessions"))[0].n, 1);
    await assert.rejects(
      () => correct("affiliate", affiliate, previous, changed),
      /Record changed/,
    );
    await assert.rejects(
      () => correct("partner", affiliate, changed, changed),
      /Record not found/,
    );
    await assert.rejects(
      () =>
        correct(
          "affiliate",
          affiliate,
          changed,
          { ...changed, email: "new@example.test" },
          manager,
        ),
      /Only an owner/,
    );
    await assert.rejects(
      () =>
        correct("affiliate", affiliate, changed, {
          ...changed,
          email: "taken@example.test",
        }),
      /another Business account/,
    );
    assert.equal(
      (await q("SELECT email FROM users WHERE id=$1", [user]))[0].email,
      "old@example.test",
    );
    const result = await correct("affiliate", affiliate, changed, {
      ...changed,
      email: "correct@example.test",
    });
    assert.equal(result.sessionsRevoked, true);
    assert.equal(
      (await q("SELECT email FROM users WHERE id=$1", [user]))[0].email,
      "correct@example.test",
    );
    assert.equal(
      (await q("SELECT email FROM admin_users WHERE id=$1", [team]))[0].email,
      "correct@example.test",
    );
    assert.ok(
      (await q("SELECT email FROM affiliates")).every(
        (r) => r.email === "correct@example.test",
      ),
    );
    for (const table of ["sessions", "admin_sessions", "affiliate_sessions"])
      assert.equal(
        (await q(`SELECT count(*)::int AS n FROM ${table}`))[0].n,
        0,
      );
    for (const table of [
      "editorial_invitations",
      "custom_invitations",
      "affiliate_invitations",
    ])
      assert.ok((await q(`SELECT revoked_at FROM ${table}`))[0].revoked_at);
    assert.equal(
      (await q("SELECT password_hash FROM users WHERE id=$1", [user]))[0]
        .password_hash,
      "never-change",
    );
    assert.ok(
      (
        await q(
          "SELECT commission_bps,bank_account,referral_code FROM affiliates",
        )
      ).every(
        (r) =>
          r.commission_bps === 2000 &&
          r.bank_account === "unchanged" &&
          r.referral_code === "REF",
      ),
    );
    await assert.rejects(()=>correct('team',team,{name:'Team display',email:'correct@example.test',role:'support'},{name:'Escalated',email:'correct@example.test',role:'owner'},manager),/Access denied/);
    assert.equal((await q('SELECT email FROM organization_members'))[0].email,'correct@example.test');
    const oldTeam = {
      name: "Team display",
      email: "correct@example.test",
      role: "support",
    };
    await correct("team", team, oldTeam, {
      ...oldTeam,
      name: "Correct Team",
      role: "analyst",
    });
    assert.equal(
      (await q("SELECT role FROM admin_users WHERE id=$1", [team]))[0].role,
      "analyst",
    );
    const self = { name: "Owner", email: "owner@example.test", role: "owner" };
    await assert.rejects(
      () => correct("team", owner, self, { ...self, role: "analyst" }),
      /own team role/,
    );
    const client = {
      businessName: "Original Company",
      name: "Original Person",
      email: "correct@example.test",
      phone: "0800",
    };
    await correct("customClient", org, client, {
      ...client,
      businessName: "Correct Company",
      name: "Correct Person",
      phone: "0900",
    });
    assert.equal(
      (await q("SELECT display_name FROM business_profiles"))[0].display_name,
      "Correct Company",
    );
    assert.equal(
      (await q("SELECT name FROM users WHERE id=$1", [user]))[0].name,
      "Correct Person",
    );
    assert.ok(
      (await q("SELECT detail FROM distribution_audit")).every(
        (r) => r.detail.before && r.detail.after,
      ),
    );
    assert.equal(
      (await q("SELECT count(*)::int AS n FROM custom_clients"))[0].n,
      1,
    );
    const latest = { ...changed, email: "correct@example.test" };
    const parallel = await Promise.allSettled([
      correct("affiliate", affiliate, latest, { ...latest, name: "Version A" }),
      correct("affiliate", affiliate, latest, { ...latest, name: "Version B" }),
    ]);
    assert.equal(parallel.filter((r) => r.status === "fulfilled").length, 1);
    await assert.rejects(
      () =>
        correct("affiliate", affiliate, latest, {
          ...latest,
          password_hash: "injected",
        }),
      /Record changed|Invalid profile fields/,
    );
    const currentProfile=(await q("SELECT jsonb_build_object('name',name,'email',email,'note',application_note) AS details FROM affiliates WHERE id=$1",[affiliate]))[0].details;
    await assert.rejects(()=>correct('affiliate',affiliate,currentProfile,{...currentProfile,commission_bps:'9999'}),/Invalid profile fields/);
    await q("INSERT INTO affiliates(id,name,email,programme) VALUES($1,'Independent','independent@example.test','affiliate')",[other]);
    await q("INSERT INTO affiliate_invitations(email,program) VALUES('independent@example.test','affiliate'),('independent@example.test','partner')");
    await correct('affiliate',other,{name:'Independent',email:'independent@example.test',note:''},{name:'Independent',email:'fixed-independent@example.test',note:''});
    assert.ok((await q("SELECT revoked_at FROM affiliate_invitations WHERE email='independent@example.test' AND program='affiliate'"))[0].revoked_at);
    assert.equal((await q("SELECT revoked_at FROM affiliate_invitations WHERE email='independent@example.test' AND program='partner'"))[0].revoked_at,null);
  } finally {
    await db.close();
  }
});
