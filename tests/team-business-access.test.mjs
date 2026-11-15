import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PGlite } from "@electric-sql/pglite";
import { create } from "zustand";
import * as permissions from "../src/lib/admin-permissions.ts";
import { load } from "./fixtures/lifecycle-db.mjs";

async function fixture() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text,email text UNIQUE,password_hash text,phone text,avatar_url text);
    CREATE TABLE organizations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text,slug text UNIQUE);
    CREATE TABLE organization_members(id uuid DEFAULT gen_random_uuid(),organization_id uuid,user_id uuid,name text,email text,role text,title text,active boolean,created_at timestamptz DEFAULT now());
    CREATE TABLE business_profiles(organization_id uuid,business_type text,display_name text,subdomain text UNIQUE);
    CREATE TABLE infrastructure_accounts(organization_id uuid,renewal_date date);
    CREATE TABLE admin_users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text,email text UNIQUE,password_hash text,role text,business_user_id uuid UNIQUE REFERENCES users(id),disabled_at timestamptz,staff_revoked_at timestamptz,last_login_at timestamptz,permission_overrides jsonb DEFAULT '{}');
    CREATE TABLE admin_sessions(id uuid DEFAULT gen_random_uuid(),admin_user_id uuid,expires_at timestamptz);
    CREATE TABLE sessions(id uuid DEFAULT gen_random_uuid(),user_id uuid,organization_id uuid,expires_at timestamptz);
    CREATE TABLE password_reset_tokens(id uuid DEFAULT gen_random_uuid(),user_id uuid,token_hash text,used_at timestamptz,expires_at timestamptz);
    CREATE TABLE distribution_audit(actor_id uuid,event text,detail jsonb);`);
  const q = async (text, params = []) => (await db.query(text, params)).rows;
  const sql = async (parts, ...params) =>
    q(
      parts.reduce(
        (text, part, i) =>
          text + part + (i < params.length ? "$" + (i + 1) : ""),
        "",
      ),
      params,
    );
  sql.query = q;
  const auth = load("src/lib/db/auth.ts", {
    bcryptjs: bcrypt,
    "./client": { getSql: () => sql },
    "@/lib/security/auth-rate-limit": { authRateLimit: async () => {} },
  });
  const teamAuth = load("src/lib/db/admin-auth.ts", {
    "server-only": {},
    bcryptjs: bcrypt,
    "./client": { getSql: () => sql },
    "@/lib/admin-permissions": permissions,
  });
  const bridge = load("src/lib/team-business-access.ts", { "server-only": {} });
  const password = "a-real-fixture-password";
  const hash = await bcrypt.hash(password, 4);
  const addTeam = async (
    role = "growth_gaming_lead",
    email = randomUUID() + "@example.test",
  ) => {
    const id = randomUUID();
    await q(
      "INSERT INTO admin_users(id,name,email,password_hash,role) VALUES($1,'Team Member',$2,$3,$4)",
      [id, email, hash, role],
    );
    return { id, email };
  };
  return { db, q, sql, auth, teamAuth, bridge, password, hash, addTeam };
}

test("all Team roles receive one isolated ordinary workspace, preserve their password and keep exact Team permissions", async () => {
  const f = await fixture();
  try {
    const foreignOrg = randomUUID();
    await f.q(
      "INSERT INTO organizations(id,name,slug) VALUES($1,'Private customer','customer')",
      [foreignOrg],
    );
    for (const role of Object.keys(permissions.ROLE_LABEL)) {
      const team = await f.addTeam(role);
      const native = await f.teamAuth.verifyAdminLogin(team.email, f.password);
      assert.equal(native.id, team.id);
      await f.q(
        "INSERT INTO admin_sessions(admin_user_id,expires_at) VALUES($1,now()+interval '7 days')",
        [team.id],
      );
      const first = await f.bridge.ensureTeamBusinessAccess(f.q, native.id);
      const again = await f.bridge.ensureTeamBusinessAccess(f.q, native.id);
      assert.deepEqual(first, again);
      assert.notEqual(first.organizationId, foreignOrg);
      assert.equal(
        (
          await f.q("SELECT role FROM organization_members WHERE user_id=$1", [
            first.user.id,
          ])
        )[0].role,
        "owner",
      );
      assert.equal(
        (
          await f.q(
            "SELECT business_type FROM business_profiles WHERE organization_id=$1",
            [first.organizationId],
          )
        )[0].business_type,
        "general",
      );
      assert.equal(
        (
          await f.q(
            "SELECT * FROM infrastructure_accounts WHERE organization_id=$1",
            [first.organizationId],
          )
        ).length,
        1,
      );
      const row = (
        await f.q("SELECT * FROM admin_users WHERE id=$1", [team.id])
      )[0];
      assert.equal(row.password_hash, "!business-account-only");
      assert.equal(row.role, role);
      assert.equal(row.business_user_id, first.user.id);
      assert.equal(
        await f.teamAuth.verifyAdminLogin(team.email, f.password),
        null,
      );
      assert.equal(
        (await f.auth.verifyLogin(team.email, f.password)).organizationId,
        first.organizationId,
      );
      assert.equal(
        (await f.teamAuth.linkedBusinessStaff(first.user.id)).id,
        team.id,
      );
      assert.equal(
        (
          await f.q("SELECT * FROM admin_sessions WHERE admin_user_id=$1", [
            team.id,
          ])
        ).length,
        0,
      );
      const session = await f.auth.createSession(first.user.id, foreignOrg);
      assert.equal(
        await f.auth.validateSession(session),
        null,
        "no implicit access to an unrelated customer tenant",
      );
    }
    const count = Object.keys(permissions.ROLE_LABEL).length;
    assert.equal((await f.q("SELECT * FROM users")).length, count);
    assert.equal((await f.q("SELECT * FROM organizations")).length, count + 1);
    assert.equal(
      (
        await f.q(
          "SELECT * FROM distribution_audit WHERE event='TEAM_BUSINESS_ACCESS_ENABLED'",
        )
      ).length,
      count,
    );
  } finally {
    await f.db.close();
  }
});

test("existing Business identity needs both proofs; email matching never merges data or replaces a password", async () => {
  const f = await fixture();
  try {
    const team = await f.addTeam();
    const business = randomUUID();
    const originalHash = await bcrypt.hash("different-business-password", 4);
    await f.q(
      "INSERT INTO users(id,name,email,password_hash) VALUES($1,'Existing Business',$2,$3)",
      [business, team.email, originalHash],
    );
    await assert.rejects(
      f.bridge.ensureTeamBusinessAccess(f.q, team.id),
      f.bridge.TeamBusinessConflict,
    );
    assert.equal(
      (await f.q("SELECT password_hash FROM users WHERE id=$1", [business]))[0]
        .password_hash,
      originalHash,
    );
    assert.equal(
      (
        await f.q("SELECT business_user_id FROM admin_users WHERE id=$1", [
          team.id,
        ])
      )[0].business_user_id,
      null,
    );
    assert.equal((await f.q("SELECT * FROM organizations")).length, 0);
    const stranger = randomUUID();
    await f.q(
      "INSERT INTO users(id,name,email,password_hash) VALUES($1,'Stranger','stranger@example.test',$2)",
      [stranger, originalHash],
    );
    await assert.rejects(
      f.bridge.connectExistingTeamBusiness(f.q, team.id, stranger),
      /matching Business account/,
    );
    // The action first verifies this password; the service receives its user ID.
    const org = randomUUID();
    await f.q(
      "INSERT INTO organizations(id,name,slug) VALUES($1,'Existing organization','existing')",
      [org],
    );
    await f.q(
      "INSERT INTO organization_members(organization_id,user_id,active,role) VALUES($1,$2,true,'owner')",
      [org, business],
    );
    assert.equal(await f.auth.verifyLogin(team.email, f.password), null);
    const proof = await f.auth.verifyLogin(
      team.email,
      "different-business-password",
    );
    await f.bridge.connectExistingTeamBusiness(f.q, team.id, proof.user.id);
    assert.equal(
      (await f.bridge.ensureTeamBusinessAccess(f.q, team.id)).organizationId,
      org,
    );
    assert.equal(
      (await f.q("SELECT password_hash FROM users WHERE id=$1", [business]))[0]
        .password_hash,
      originalHash,
    );
    await assert.rejects(
      f.bridge.connectExistingTeamBusiness(f.q, team.id, business),
    );
  } finally {
    await f.db.close();
  }
});

test("inactive identities cannot provision, failed audit rolls back, and password reset keeps a single authority", async () => {
  const f = await fixture();
  try {
    const team = await f.addTeam();
    await f.q("UPDATE admin_users SET disabled_at=now() WHERE id=$1", [
      team.id,
    ]);
    await assert.rejects(
      f.bridge.ensureTeamBusinessAccess(f.q, team.id),
      /unavailable/,
    );
    assert.equal(
      await f.teamAuth.verifyAdminLogin(team.email, f.password),
      null,
    );
    assert.equal((await f.q("SELECT * FROM users")).length, 0);
    await f.q("UPDATE admin_users SET disabled_at=NULL WHERE id=$1", [team.id]);
    await f.db.exec(
      "CREATE FUNCTION fail_team_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture audit failure'; END $$;CREATE TRIGGER fail_team_audit BEFORE INSERT ON distribution_audit FOR EACH ROW EXECUTE FUNCTION fail_team_audit()",
    );
    await assert.rejects(
      f.bridge.ensureTeamBusinessAccess(f.q, team.id),
      /audit failure/,
    );
    assert.equal((await f.q("SELECT * FROM users")).length, 0);
    assert.equal((await f.q("SELECT * FROM organizations")).length, 0);
    assert.equal(
      (
        await f.q("SELECT password_hash FROM admin_users WHERE id=$1", [
          team.id,
        ])
      )[0].password_hash,
      f.hash,
    );
    await f.db.exec("DROP TRIGGER fail_team_audit ON distribution_audit");
    const login = await f.bridge.ensureTeamBusinessAccess(f.q, team.id);
    const session = await f.auth.createSession(
      login.user.id,
      login.organizationId,
    );
    const reset = await f.auth.createPasswordResetToken(login.user.id);
    assert.equal(
      await f.auth.consumePasswordResetToken(reset, "new-shared-password"),
      true,
    );
    assert.equal(await f.auth.validateSession(session), null);
    assert.equal(await f.auth.verifyLogin(team.email, f.password), null);
    assert.equal(
      (await f.auth.verifyLogin(team.email, "new-shared-password")).user.id,
      login.user.id,
    );
    assert.equal(
      (await f.teamAuth.linkedBusinessStaff(login.user.id)).id,
      team.id,
    );
    await f.q("UPDATE admin_users SET staff_revoked_at=now() WHERE id=$1", [
      team.id,
    ]);
    assert.equal(await f.teamAuth.linkedBusinessStaff(login.user.id), null);
    await assert.rejects(
      f.bridge.ensureTeamBusinessAccess(f.q, team.id),
      /unavailable/,
    );
    // Revoking a Team job does not transfer or delete this person's own Business data.
    assert.equal(
      (await f.auth.verifyLogin(team.email, "new-shared-password"))
        .organizationId,
      login.organizationId,
    );
  } finally {
    await f.db.close();
  }
});

test("main Business login accepts existing Team credentials and wrong credentials never provision a workspace", async () => {
  const f = await fixture();
  try {
    const team = await f.addTeam();
    let signedIn;
    const actions = load("src/lib/actions/auth-actions.ts", {
      "@/lib/distribution/referrals": { consumeReferralVisit: async () => {} },
      "next/headers": { headers: async () => new Headers() },
      "@/lib/db/auth": f.auth,
      "@/lib/db/admin-auth": f.teamAuth,
      "@/lib/team-business-access": f.bridge,
      "@/lib/custom/service": { query: f.q },
      "@/lib/db/organizations": {},
      "@/lib/email": {},
      "@/lib/session": {
        startSession: async (userId, organizationId) => {
          signedIn = { userId, organizationId };
        },
      },
      "@/lib/security/auth-rate-limit": { authRateLimit: async () => {} },
    });
    assert.equal(
      (await actions.loginAction(team.email, "wrong-password")).ok,
      false,
    );
    assert.equal((await f.q("SELECT * FROM users")).length, 0);
    const login = await actions.loginAction(team.email, f.password);
    assert.equal(login.ok, true);
    assert.equal(signedIn.organizationId, login.data.organizationId);
    assert.equal((await actions.loginAction(team.email, f.password)).ok, true);
    assert.equal((await f.q("SELECT * FROM users")).length, 1);
  } finally {
    await f.db.close();
  }
});

test("browser handoff adopts authenticated server data without reading an old tenant cache or replaying another workspace's outbox", async () => {
  const oldWindow = globalThis.window;
  let stored = JSON.stringify({
      authenticated: true,
      mode: "live",
      organizationId: "old-org",
    }),
    pending = 1,
    cached = 0,
    replayed = 0;
  const fresh = {
    organization: { id: "new-org" },
    profile: { businessType: "general", displayName: "My workspace" },
    user: { id: "member", avatarUrl: null },
  };
  globalThis.window = {
    localStorage: {
      getItem: () => stored,
      setItem: (_, value) => {
        stored = value;
      },
    },
  };
  try {
    const store = load("src/lib/store.ts", {
      zustand: { create },
      "@/lib/mock": {
        buildTenantData: () => ({ ...fresh, organization: { id: "initial" } }),
      },
      "@/lib/industry": {},
      "@/lib/ids": {},
      "@/lib/offline/idb": {
        outboxCount: async () => pending,
        getCachedTenant: async () => {
          cached++;
        },
        putCachedTenant: async () => {},
      },
      "@/lib/offline/sync": {
        processOutbox: async () => {
          replayed++;
        },
        onSyncProgress: () => {},
      },
      "@/lib/actions/auth-actions": {},
      "@/lib/actions/invoice-actions": {},
      "@/lib/actions/sync-actions": {
        pullAllAction: async () => ({ ok: true, data: fresh }),
      },
    }).useBusinessStore;
    assert.equal((await store.getState().resumeServerSession()).ok, false);
    assert.equal(JSON.parse(stored).organizationId, "old-org");
    assert.equal(store.getState().data.organization.id, "initial");
    pending = 0;
    assert.equal((await store.getState().resumeServerSession()).ok, true);
    assert.equal(store.getState().data.organization.id, "new-org");
    assert.equal(JSON.parse(stored).organizationId, "new-org");
    assert.equal(store.getState().authenticated, true);
    assert.equal(cached, 0);
    assert.equal(replayed, 0);
    pending = 1;
    assert.equal((await store.getState().resumeServerSession()).ok, true);
    assert.equal(
      replayed,
      1,
      "only the already authenticated same workspace may sync pending changes",
    );
  } finally {
    if (oldWindow === undefined) delete globalThis.window;
    else globalThis.window = oldWindow;
  }
});

test("workspace switching derives the Team identity from the session and confirms the existing Business password", async () => {
  const f = await fixture();
  try {
    const team = await f.addTeam();
    const user = randomUUID(),
      org = randomUUID();
    const ownBusinessPassword = "existing-personal-password";
    await f.q(
      "INSERT INTO users(id,name,email,password_hash) VALUES($1,'Own account',$2,$3)",
      [user, team.email, await bcrypt.hash(ownBusinessPassword, 4)],
    );
    await f.q(
      "INSERT INTO organizations(id,name,slug) VALUES($1,'Own business','own')",
      [org],
    );
    await f.q(
      "INSERT INTO organization_members(organization_id,user_id,active,role) VALUES($1,$2,true,'owner')",
      [org, user],
    );
    let active = true,
      signedIn;
    const actions = load("src/lib/actions/team-business-actions.ts", {
      "next/navigation": {
        redirect: (path) => {
          throw Error("REDIRECT:" + path);
        },
      },
      "@/lib/admin-session": {
        requireAdminSession: async () => {
          if (!active) throw Error("Not signed in");
          return await f.teamAuth.verifyAdminLogin(team.email, f.password);
        },
      },
      "@/lib/session": {
        getSession: async () => null,
        startSession: async (userId, organizationId) => {
          signedIn = { userId, organizationId };
        },
      },
      "@/lib/db/auth": f.auth,
      "@/lib/custom/service": { query: f.q },
      "@/lib/security/auth-rate-limit": { authRateLimit: async () => {} },
      "@/lib/team-business-access": f.bridge,
    });
    await assert.rejects(
      actions.openTeamBusinessAction(),
      /REDIRECT:\/admin\/business/,
    );
    const form = new FormData();
    form.set("userId", randomUUID());
    form.set("teamId", randomUUID());
    form.set("password", "wrong-password");
    await assert.rejects(
      actions.connectTeamBusinessAction(form),
      /Check the password/,
    );
    active = false;
    form.set("password", ownBusinessPassword);
    await assert.rejects(
      actions.connectTeamBusinessAction(form),
      /Not signed in/,
    );
    active = true;
    await assert.rejects(
      actions.connectTeamBusinessAction(form),
      /REDIRECT:\/account\/continue/,
    );
    assert.deepEqual(signedIn, { userId: user, organizationId: org });
    assert.equal((await f.teamAuth.linkedBusinessStaff(user)).id, team.id);
    assert.equal((await f.q("SELECT * FROM users")).length, 1);
  } finally {
    await f.db.close();
  }
});

test("shared Team login retains the shorter session lifetime and removes an old native Team identity", async () => {
  const f = await fixture();
  try {
    const team = await f.addTeam();
    const login = await f.bridge.ensureTeamBusinessAccess(f.q, team.id);
    const oldNative = randomUUID();
    await f.q(
      "INSERT INTO admin_sessions(id,admin_user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",
      [oldNative, team.id],
    );
    const setCookies = [];
    const jar = new Map([["jktl_admin_session", oldNative]]);
    const session = load("src/lib/session.ts", {
      "server-only": {},
      "@/lib/db/auth": f.auth,
      "@/lib/db/admin-auth": f.teamAuth,
      "next/headers": {
        cookies: async () => ({
          get: (name) => (jar.has(name) ? { value: jar.get(name) } : undefined),
          set: (...args) => {
            setCookies.push(args);
            if (args[2].maxAge === 0) jar.delete(args[0]);
            else jar.set(args[0], args[1]);
          },
        }),
      },
    });
    await session.startSession(login.user.id, login.organizationId);
    assert.equal(
      (await f.q("SELECT * FROM admin_sessions WHERE id=$1", [oldNative]))
        .length,
      0,
    );
    assert.ok(
      setCookies.some(
        ([name, , options]) =>
          name === "jktl_admin_session" &&
          options.path === "/admin" &&
          options.maxAge === 0,
      ),
    );
    const cookie = setCookies.find(([name]) => name === "jktl_session");
    assert.equal(cookie[2].httpOnly, true);
    assert.equal(cookie[2].sameSite, "lax");
    assert.equal(cookie[2].path, "/");
    assert.equal(cookie[2].maxAge, 604800);
    assert.equal(cookie[2].domain, undefined);
    const expiry = (
      await f.q("SELECT expires_at FROM sessions WHERE id=$1", [cookie[1]])
    )[0].expires_at;
    assert.ok(new Date(expiry).getTime() - Date.now() <= 7 * 86400000);
    assert.equal((await session.getSession()).userId, login.user.id);
  } finally {
    await f.db.close();
  }
});

test("opening Business reuses an authenticated shared session without extending its lifetime", async () => {
  const f = await fixture();
  try {
    const team = await f.addTeam();
    const login = await f.bridge.ensureTeamBusinessAccess(f.q, team.id);
    const actions = load("src/lib/actions/team-business-actions.ts", {
      "next/navigation": {
        redirect: (path) => {
          throw Error("REDIRECT:" + path);
        },
      },
      "@/lib/admin-session": {
        requireAdminSession: async () =>
          await f.teamAuth.linkedBusinessStaff(login.user.id),
      },
      "@/lib/session": {
        getSession: async () => ({
          userId: login.user.id,
          organizationId: login.organizationId,
        }),
        startSession: async () => {
          throw Error("Must not refresh session");
        },
      },
      "@/lib/db/auth": f.auth,
      "@/lib/custom/service": { query: f.q },
      "@/lib/security/auth-rate-limit": { authRateLimit: async () => {} },
      "@/lib/team-business-access": f.bridge,
    });
    await assert.rejects(
      actions.openTeamBusinessAction(),
      /REDIRECT:\/account\/continue/,
    );
  } finally {
    await f.db.close();
  }
});

test("new Team invitation acceptance prepares Business access and starts the same identity without customer signup", async () => {
  const f = await fixture();
  try {
    const team = await f.addTeam();
    const chosenPassword = "my-invited-account-password";
    let session;
    const actions = load("src/lib/actions/team-invitation-actions.ts", {
      "@/lib/mail/invitation-rate": { limitInvitationRequest: async () => {} },
      "@/lib/admin-session": { getAdminSession: async () => null },
      "@/lib/session": {
        getSession: async () => null,
        startSession: async (userId, organizationId) => {
          session = { userId, organizationId };
        },
      },
      "@/lib/custom/service": { query: f.q },
      "@/lib/support/service": { rate: async () => {} },
      "@/lib/mail/invitations": {
        inviteHash: () => "fixture-hash",
        inspectTeamInvitation: async () => ({
          accept_mode: "NEW_TEAM",
          business_exists: false,
        }),
        acceptTeamInvitation: async (q, token, identity) => {
          assert.equal(
            await bcrypt.compare(chosenPassword, identity.passwordHash),
            true,
          );
          await q("UPDATE admin_users SET password_hash=$2 WHERE id=$1", [
            team.id,
            identity.passwordHash,
          ]);
          return { id: team.id, role: "growth_gaming_lead" };
        },
      },
      "@/lib/team-business-access": f.bridge,
      "@/lib/email": {},
      "@/lib/admin-permissions": permissions,
      bcryptjs: bcrypt,
      "next/navigation": {
        redirect: (path) => {
          throw Error("REDIRECT:" + path);
        },
      },
      "next/cache": {},
    });
    const form = new FormData();
    form.set("token", "a".repeat(64));
    form.set("consent", "on");
    form.set("password", chosenPassword);
    await assert.rejects(
      actions.acceptTeamUserInvitationAction(form),
      /REDIRECT:\/admin\/growth/,
    );
    assert.equal(
      (await f.auth.verifyLogin(team.email, chosenPassword)).user.id,
      session.userId,
    );
    assert.equal(
      (await f.teamAuth.linkedBusinessStaff(session.userId)).id,
      team.id,
    );
    assert.equal((await f.q("SELECT * FROM users")).length, 1);
  } finally {
    await f.db.close();
  }
});
