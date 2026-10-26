import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import bcrypt from "bcryptjs";
import { applyMigrationBatch } from "../scripts/sql-statements.mjs";
import * as permissions from "../src/lib/admin-permissions.ts";
import * as publications from "../src/lib/publications.ts";
import * as supportModel from "../src/lib/support/model.ts";
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
      if (!(n in deps)) throw Error("Missing fixture dependency " + n);
      return deps[n];
    },
    m,
    m.exports,
  );
  return m.exports;
}
const ownerId = "10000000-0000-4000-8000-000000000001",
  userId = "10000000-0000-4000-8000-000000000002",
  otherUser = "10000000-0000-4000-8000-000000000003";
test("Growth staff use existing identity, least privilege, approved publishing, scoped leads, recommendations and immediate revocation", async () => {
  const db = new PGlite();
  try {
    const query = async (s, p = []) => (await db.query(s, p)).rows;
    const adapter = {
      query: (s, p) => ({ s, p }),
      transaction: async (rs) => {
        await db.exec("BEGIN");
        try {
          for (const r of rs) await db.query(r.s, r.p);
          await db.exec("COMMIT");
        } catch (e) {
          await db.exec("ROLLBACK");
          throw e;
        }
      },
    };
    const files = readdirSync(new URL("../migrations/", import.meta.url))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of files)
      await applyMigrationBatch(adapter, [
        readFileSync(
          new URL("../migrations/" + file, import.meta.url),
          "utf8",
        ).replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/g, ""),
      ]);
    await query(
      "INSERT INTO admin_users(id,name,email,password_hash,role) VALUES($1,'Owner','owner@example.test','fixture','owner')",
      [ownerId],
    );
    await query(
      "INSERT INTO users(id,name,email,password_hash) VALUES($1,'Growth Person','growth@example.test',$2),($3,'Another Person','other@example.test','unusable')",
      [userId, await bcrypt.hash("fixture-normal-password", 4), otherUser],
    );
    const sql = (strings, ...values) =>
      query(
        strings.reduce(
          (s, v, i) => s + v + (i < values.length ? "$" + (i + 1) : ""),
          "",
        ),
        values,
      );
    sql.query = query;
    await query(
      "INSERT INTO organizations(name,slug) VALUES('Growth organization','growth-test') RETURNING id",
    ).then(async (rows) => {
      await query(
        "INSERT INTO organization_members(organization_id,user_id,name,role) VALUES($1,$2,'Growth Person','owner')",
        [rows[0].id, userId],
      );
    });
    const businessAuth = load("../src/lib/db/auth.ts", {
      bcryptjs: { default: bcrypt },
      "node:crypto": await import("node:crypto"),
      "./client": { getSql: () => sql },
    });
    const auth = load("../src/lib/db/admin-auth.ts", {
      "server-only": {},
      bcryptjs: { default: bcrypt },
      "@/lib/admin-permissions": permissions,
      "./client": { getSql: () => sql },
    });
    let businessUser = null,
      adminCookie = null;
    const cookieStore = {
      get: (name) =>
        name === "jktl_admin_session" && adminCookie
          ? { value: adminCookie }
          : undefined,
      delete: () => {},
      set: () => {},
    };
    const adminSession = load("../src/lib/admin-session.ts", {
      "server-only": {},
      "next/headers": { cookies: async () => cookieStore },
      "@/lib/db/admin-auth": auth,
      "@/lib/session": {
        getSession: async () =>
          businessUser ? { userId: businessUser } : null,
        endSession: async () => {},
      },
      "@/lib/db/client": { getSql: () => sql },
      "@/lib/admin-permissions": permissions,
    });
    await query(
      "INSERT INTO admin_sessions(admin_user_id,expires_at) VALUES($1,now()+interval '1 day') RETURNING id",
      [ownerId],
    ).then((r) => (adminCookie = r[0].id));
    const service = load("../src/lib/growth/service.ts", {
      "server-only": {},
      "@/lib/custom/service": { query },
      "@/lib/admin-permissions": permissions,
      "@/lib/admin-session": adminSession,
    });
    const cache = { "next/cache": { revalidatePath: () => {} } };
    const staff = load("../src/lib/actions/growth-staff-actions.ts", {
      "@/lib/growth/service": service,
      "@/lib/admin-permissions": permissions,
      ...cache,
    });
    const actions = load("../src/lib/actions/growth-actions.ts", {
      "@/lib/growth/service": service,
      "@/lib/publications": publications,
      "@/lib/support/model": supportModel,
      "next/server": { after: () => {} },
      "@/lib/distribution/notifications": {
        flushProgramNotices: async () => ({}),
      },
      ...cache,
    });
    const assign = new FormData();
    assign.set("userId", userId);
    await staff.assignGrowthRoleAction(assign);
    const profile = (
      await query(
        "SELECT id,role,business_user_id,password_hash FROM admin_users WHERE business_user_id=$1",
        [userId],
      )
    )[0];
    assert.equal(profile.role, "growth_gaming_lead");
    const native = await auth.createAdminUser({
      name: "Native Growth",
      email: "native-growth@example.test",
      password: "native-staff-password",
      role: "growth_gaming_lead",
      createdBy: ownerId,
    });
    assert.equal(
      (
        await auth.verifyAdminLogin(
          "native-growth@example.test",
          "native-staff-password",
        )
      ).role,
      "growth_gaming_lead",
    );
    const nativeSession = await auth.createAdminSession(native.id);
    assert.equal(
      (await auth.validateAdminSession(nativeSession)).id,
      native.id,
    );
    let signedIn = null;
    const staffSignIn = load("../src/lib/growth/auth.ts", {
      "server-only": {},
      "@/lib/db/auth": businessAuth,
      "@/lib/db/admin-auth": auth,
      "@/lib/session": {
        startSession: async (user, org) => {
          signedIn = { user, org };
        },
      },
      "@/lib/custom/service": { query },
    });
    assert.equal(
      await staffSignIn.signInGrowthStaff(
        "growth@example.test",
        "wrong-password",
      ),
      null,
    );
    assert.equal(
      await staffSignIn.signInGrowthStaff(
        "growth@example.test",
        "fixture-normal-password",
      ),
      "/admin/growth",
    );
    assert.equal(signedIn.user, userId);
    assert.equal(profile.password_hash, "!business-account-only");
    assert.equal((await query("SELECT count(*)::int n FROM users"))[0].n, 2);
    assert.equal(
      await auth.verifyAdminLogin(
        "growth@example.test",
        "fixture-normal-password",
      ),
      null,
      "linked staff never authenticate through a duplicate admin password",
    );
    // Future prebuild replays must retain assigned Growth profiles.
    for (const file of [
      "033_editorial.sql",
      "037_support_reviews.sql",
      "047_growth_gaming_staff.sql",
    ])
      await applyMigrationBatch(adapter, [
        readFileSync(new URL("../migrations/" + file, import.meta.url), "utf8"),
      ]);
    adminCookie = null;
    businessUser = otherUser;
    assert.equal(
      await adminSession.getAdminSession(),
      null,
      "unassigned Business users receive no admin role",
    );
    businessUser = userId;
    const session = await adminSession.getAdminSession();
    assert.equal(session.id, profile.id);
    assert.equal(session.businessUserId, userId);
    assert.equal(
      session.permissions && Object.keys(session.permissions).length,
      0,
    );
    const nav = permissions.navFor(session.role, session.permissions);
    assert.deepEqual(
      nav.map((n) => n.href),
      ["/admin/growth"],
    );
    for (const cap of [
      "record_payouts",
      "manage_team",
      "manage_domains",
      "manage_email",
      "manage_features",
      "manage_affiliates",
      "manage_content",
      "view_businesses",
      "run_daily_job",
      "send_broadcasts",
    ])
      await assert.rejects(adminSession.requireAdminCapability(cap));
    await assert.rejects(staff.assignGrowthRoleAction(assign));
    assert.ok(
      (
        await query(
          "SELECT id FROM distribution_audit WHERE event='STAFF_ACCESS_DENIED'",
        )
      ).length >= 10,
    );
    const lead = new FormData();
    lead.set("name", "Assigned shop");
    lead.set("email", "shop@example.test");
    await actions.createGrowthLeadAction(lead);
    const ownLead = (await query("SELECT * FROM prospects"))[0];
    assert.equal(ownLead.assigned_staff_id, profile.id);
    await query(
      "INSERT INTO prospects(business_name) VALUES('Unrelated company')",
    );
    const otherLead = (
      await query("SELECT id FROM prospects WHERE assigned_staff_id IS NULL")
    )[0];
    const update = new FormData();
    update.set("id", otherLead.id);
    update.set("status", "contacted");
    update.set("note", "Discussed website options");
    await assert.rejects(actions.updateGrowthLeadAction(update));
    update.set("id", ownLead.id);
    await actions.updateGrowthLeadAction(update);
    update.set("status", "converted");
    await assert.rejects(actions.updateGrowthLeadAction(update));
    assert.equal(
      (await query("SELECT status FROM prospects WHERE id=$1", [ownLead.id]))[0]
        .status,
      "contacted",
    );
    const draft = new FormData();
    for (const [k, v] of Object.entries({
      category: "games",
      kind: "release",
      slug: "tycoon-community-event",
      title: "Try the JKTL Tycoon community event",
      excerpt: "A demo event announcement.",
      body: "Join our fictional business-building demo and share feedback with the JKTL team. No real money or financial rewards.",
      link: "https://jktl.com.ng/games",
    }))
      draft.set(k, v);
    await actions.saveGrowthDraftAction(draft);
    let publication = (await query("SELECT * FROM jktl_publications"))[0];
    assert.ok(
      publication.growth_link.includes("utm_campaign=tycoon-community-event"),
    );
    const publish = new FormData();
    publish.set("id", publication.id);
    publish.set("revision", "1");
    await assert.rejects(actions.publishGrowthDraftAction(publish));
    const approve = new FormData();
    approve.set("id", publication.id);
    approve.set("revision", "1");
    approve.set("approved", "on");
    await assert.rejects(actions.approveGrowthDraftAction(approve));
    businessUser = null;
    adminCookie = (
      await query("SELECT id FROM admin_sessions WHERE admin_user_id=$1", [
        ownerId,
      ])
    )[0].id;
    await actions.approveGrowthDraftAction(approve);
    adminCookie = null;
    businessUser = userId;
    draft.set("id", publication.id);
    draft.set("revision", "1");
    draft.set("title", "Updated event title");
    await actions.saveGrowthDraftAction(draft);
    publish.set("revision", "2");
    await assert.rejects(
      actions.publishGrowthDraftAction(publish),
      "editing clears approval",
    );
    businessUser = null;
    adminCookie = (
      await query("SELECT id FROM admin_sessions WHERE admin_user_id=$1", [
        ownerId,
      ])
    )[0].id;
    approve.set("revision", "2");
    await actions.approveGrowthDraftAction(approve);
    adminCookie = null;
    businessUser = userId;
    await actions.publishGrowthDraftAction(publish);
    assert.equal(
      (await query("SELECT status FROM jktl_publications"))[0].status,
      "published",
    );
    await assert.rejects(actions.publishGrowthDraftAction(publish));
    await query(
      "INSERT INTO affiliates(name,email,password_hash,referral_code,programme,status) VALUES('Applicant','applicant@example.test','fixture','APP','partner','pending')",
    );
    const applicant = (
      await query(
        "SELECT id,commission_bps FROM affiliates WHERE referral_code='APP'",
      )
    )[0];
    const review = new FormData();
    review.set("id", applicant.id);
    review.set("recommendation", "APPROVE");
    review.set("note", "Suitable agency for owner review");
    review.set(
      "message",
      "Please provide your business profile to complete review.",
    );
    await actions.reviewGrowthApplicationAction(review);
    assert.equal(
      (
        await query("SELECT status FROM affiliates WHERE id=$1", [applicant.id])
      )[0].status,
      "pending",
    );
    assert.ok(
      (
        await query(
          "SELECT id FROM distribution_program_notices WHERE event_key LIKE 'growth-review-%'",
        )
      ).length > 0,
    );
    const resource = new FormData();
    resource.set("title", "Approved brand draft");
    resource.set(
      "description",
      "Company-approved claims awaiting formal publication",
    );
    resource.set("url", "https://business.jktl.com.ng/jktl-logo.png");
    resource.set("audience", "BOTH");
    await actions.saveGrowthResourceAction(resource);
    assert.equal(
      (
        await query(
          "SELECT enabled FROM distribution_assets WHERE title='Approved brand draft'",
        )
      )[0].enabled,
      false,
    );
    businessUser = null;
    adminCookie = (
      await query("SELECT id FROM admin_sessions WHERE admin_user_id=$1", [
        ownerId,
      ])
    )[0].id;
    const configure = new FormData();
    configure.set("id", profile.id);
    configure.set("mode", "PERMISSIONS");
    configure.append("permissions", "record_payouts");
    await assert.rejects(staff.configureGrowthStaffAction(configure));
    configure.delete("permissions");
    configure.append("permissions", "growth_games");
    await staff.configureGrowthStaffAction(configure);
    adminCookie = null;
    businessUser = userId;
    await assert.rejects(
      actions.createGrowthLeadAction(lead),
      "permission changes affect current sessions",
    );
    assert.equal(
      permissions.can(
        (await adminSession.getAdminSession()).role,
        "growth_games",
        (await adminSession.getAdminSession()).permissions,
      ),
      true,
    );
    businessUser = null;
    adminCookie = (
      await query("SELECT id FROM admin_sessions WHERE admin_user_id=$1", [
        ownerId,
      ])
    )[0].id;
    configure.set("mode", "SUSPEND");
    await staff.configureGrowthStaffAction(configure);
    adminCookie = null;
    businessUser = userId;
    assert.equal(await adminSession.getAdminSession(), null);
    businessUser = null;
    adminCookie = (
      await query("SELECT id FROM admin_sessions WHERE admin_user_id=$1", [
        ownerId,
      ])
    )[0].id;
    configure.set("mode", "ENABLE");
    await staff.configureGrowthStaffAction(configure);
    assert.ok(await auth.linkedBusinessStaff(userId));
    configure.set("mode", "REVOKE");
    await staff.configureGrowthStaffAction(configure);
    adminCookie = null;
    businessUser = userId;
    assert.equal(await adminSession.getAdminSession(), null);
    await assert.rejects(actions.saveGrowthDraftAction(draft));
    assert.ok(
      (
        await query(
          "SELECT id FROM distribution_audit WHERE event='STAFF_REVOKE'",
        )
      ).length > 0,
    );
  } finally {
    await db.close();
  }
});
