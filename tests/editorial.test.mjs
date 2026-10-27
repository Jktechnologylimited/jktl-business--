import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import {
  parsePublication,
  mapPublication,
  PUBLICATION_KINDS,
} from "../src/lib/publications.ts";
import { can, navFor, normaliseRole } from "../src/lib/admin-permissions.ts";

function load(file, deps) {
  const code = ts.transpileModule(
    readFileSync(new URL(file, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", code)(
    (n) => {
      if (!(n in deps)) throw Error(n);
      return deps[n];
    },
    mod,
    mod.exports,
  );
  return mod.exports;
}
const { checkEditorialChange, canPublish, official } = load(
  "../src/lib/editorial-policy.ts",
  { "./admin-permissions": { can } },
);
const base = {
  slug: "a-better-business",
  kind: "blog",
  title: "A better business",
  excerpt: "A practical guide from the JKTL team.",
  body: "## Your next chapter\n\nA practical explanation with enough detail to help a business owner.",
  coverImage: "",
  author: "Writer One",
  status: "draft",
  revision: 0,
};
const owner = { id: "00000000-0000-4000-8000-000000000001", role: "owner" },
  writer = { id: "00000000-0000-4000-8000-000000000002", role: "writer" },
  editor = { id: "00000000-0000-4000-8000-000000000003", role: "editor" },
  other = { id: "00000000-0000-4000-8000-000000000004", role: "editor" };
async function fixture() {
  const db = new PGlite();
  await db.exec(
    `CREATE TABLE admin_users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text,email text UNIQUE,password_hash text,role text,created_by uuid,disabled_at timestamptz,staff_revoked_at timestamptz,permission_overrides jsonb NOT NULL DEFAULT '{}');CREATE TABLE admin_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),admin_user_id uuid);CREATE TABLE distribution_audit(id uuid DEFAULT gen_random_uuid(),actor_id uuid,event text,detail jsonb);`,
  );
  for (const a of [owner, writer, editor, other])
    await db.query(
      "INSERT INTO admin_users(id,role,name,email)VALUES($1,$2,$3,$4)",
      [
        a.id,
        a.role,
        a.role === "writer" ? "Writer One" : a.role,
        `${a.role}${a.id.slice(-1)}@example.test`,
      ],
    );
  for (const f of ["033_editorial.sql", "055_editorial_team.sql"])
    await db.exec(
      readFileSync(new URL("../migrations/" + f, import.meta.url), "utf8"),
    );
  const sql = async (parts, ...v) =>
    (
      await db.query(
        parts.reduce(
          (q, p, i) => q + p + (i < v.length ? "$" + (i + 1) : ""),
          "",
        ),
        v,
      )
    ).rows;
  sql.query = async (q, p = []) => (await db.query(q, p)).rows;
  const store = load("../src/lib/db/publications.ts", {
    "server-only": {},
    "./client": { getSql: () => sql },
    "@/lib/publications": { mapPublication },
    "@/lib/editorial-policy": { checkEditorialChange, official },
    "@/lib/admin-permissions": { can },
  });
  return { db, sql, store };
}
const input = (p) => parsePublication(p);
test("Writer and Editor roles are least privileged; official publishing is opt-in", () => {
  assert.equal(normaliseRole("writer"), "writer");
  assert.equal(can("writer", "manage_content"), true);
  assert.deepEqual(
    navFor("writer").map((n) => n.href),
    ["/admin/content"],
  );
  assert.equal(can("writer", "review_content"), false);
  assert.equal(canPublish(editor, { kind: "blog" }), true);
  assert.equal(canPublish(editor, { kind: "release" }), false);
  assert.equal(
    canPublish(
      { ...editor, permissions: { publish_releases: true } },
      { kind: "release" },
    ),
    true,
  );
  assert.equal(
    canPublish(editor, { kind: "update", category: "security" }),
    false,
  );
  assert.equal(canPublish(editor, { kind: "update", sensitive: true }), false);
  for (const cap of [
    "view_businesses",
    "manage_team",
    "record_payouts",
    "run_daily_job",
    "manage_affiliates",
    "send_broadcasts",
  ])
    for (const role of ["writer", "editor"])
      assert.equal(can(role, cap), false);
});
test("content parsing supports all destinations and rejects unsafe or malformed input", () => {
  for (const kind of PUBLICATION_KINDS)
    assert.equal(input({ ...base, kind }).kind, kind);
  for (const change of [
    { slug: "../private" },
    { coverImage: "javascript:alert(1)" },
    { coverImage: "https://a:b@example.test/image.jpg" },
    { revision: -1 },
    { revision: 2 },
    { status: "deleted" },
    { kind: "unknown" },
    { status: "submitted", body: "short" },
    { tags: ["x".repeat(101)] },
    { chapter: 1 },
    { sensitive: "false" },
    { scheduledAt: "invalid" },
    { status: "scheduled", scheduledAt: "2020-01-01T00:00:00Z" },
  ])
    assert.throws(() => input({ ...base, ...change }));
});
test("one shared model enforces ownership, review, immutable approval, privacy, withdrawal and migration replay", async () => {
  const { db, store } = await fixture();
  try {
    let p = await store.saveEditorial(input(base), writer);
    assert.equal(p.createdBy, writer.id);
    assert.deepEqual(await store.publishedArticles("blog"), []);
    assert.equal((await store.listEditorial(other)).length, 0);
    await assert.rejects(
      store.saveEditorial(input({ ...p, status: "published" }), writer),
      /Your role/,
    );
    await assert.rejects(
      store.saveEditorial(input({ ...p, title: "Steal this draft" }), other),
      /own or assigned/,
    );
    assert.throws(() => input({ ...p, revision: 0 }), /revision/);
    p = await store.saveEditorial(input({ ...p, status: "submitted" }), writer);
    await assert.rejects(
      store.saveEditorial(
        input({ ...p, title: "Edit submitted draft" }),
        writer,
      ),
      /drafts/,
    );
    p = await store.saveEditorial(
      input({ ...p, status: "in_review", assignedTo: editor.id }),
      owner,
    );
    p = await store.saveEditorial(
      input({
        ...p,
        status: "revision_requested",
        comment: "Please add the practical steps.",
      }),
      editor,
    );
    p = await store.saveEditorial(
      input({
        ...p,
        status: "draft",
        body: base.body + "\n\nFirst, choose a template.",
      }),
      writer,
    );
    assert.equal(p.assignedTo, editor.id);
    p = await store.saveEditorial(input({ ...p, status: "submitted" }), writer);
    p = await store.saveEditorial(input({ ...p, status: "approved" }), editor);
    await assert.rejects(
      store.saveEditorial(
        input({
          ...p,
          status: "published",
          body: p.body + "changed after approval",
        }),
        editor,
      ),
      /changed after approval/,
    );
    p = await store.saveEditorial(input({ ...p, status: "published" }), editor);
    assert.equal((await store.publishedArticles("blog"))[0].body, "");
    assert.equal(
      (await store.publishedArticles("blog", p.slug))[0].body,
      p.body,
    );
    assert.equal(
      (await store.publishedArticles("blog", p.slug))[0].createdBy,
      null,
    );
    const history = (
      await db.query("SELECT * FROM editorial_revisions ORDER BY revision")
    ).rows;
    assert.equal(history.length, p.revision);
    assert.ok(history.some((h) => h.comment.includes("practical steps")));
    assert.ok(
      (await db.query("SELECT * FROM editorial_notices")).rows.length > 0,
    );
    p = await store.saveEditorial(
      input({ ...p, status: "unpublished" }),
      editor,
    );
    assert.deepEqual(await store.publishedArticles("blog", p.slug), []);
    await db.exec(
      readFileSync(
        new URL("../migrations/033_editorial.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec(
      readFileSync(
        new URL("../migrations/055_editorial_team.sql", import.meta.url),
        "utf8",
      ),
    );
    assert.equal(
      (await db.query("SELECT * FROM editorial_revisions")).rows.length,
      p.revision,
    );
    const summary = await store.editorialWorkspace(writer);
    assert.equal(summary.articles.length, 1);
    assert.equal(summary.history.length, p.revision);
  } finally {
    await db.close();
  }
});
test("official releases need Owner approval and explicit Editor publication permission; role revocation takes effect", async () => {
  const { db, store } = await fixture();
  try {
    let p = await store.saveEditorial(
      input({
        ...base,
        kind: "release",
        slug: "product-launch",
        product: "JKTL Business",
        versionLabel: "2026.10",
      }),
      writer,
    );
    p = await store.saveEditorial(input({ ...p, status: "submitted" }), writer);
    p = await store.saveEditorial(
      input({ ...p, status: "in_review", assignedTo: editor.id }),
      owner,
    );
    await assert.rejects(
      store.saveEditorial(input({ ...p, status: "approved" }), editor),
      /Owner approval/,
    );
    p = await store.saveEditorial(input({ ...p, status: "approved" }), owner);
    await assert.rejects(
      store.saveEditorial(input({ ...p, status: "published" }), editor),
      /publication permission/,
    );
    await db.query(
      `UPDATE admin_users SET permission_overrides='{"publish_releases":true}' WHERE id=$1`,
      [editor.id],
    );
    p = await store.saveEditorial(
      input({
        ...p,
        status: "scheduled",
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      }),
      editor,
    );
    await db.query(`UPDATE admin_users SET disabled_at=now() WHERE id=$1`, [
      editor.id,
    ]);
    await assert.rejects(
      store.saveEditorial(input({ ...p, status: "published" }), editor),
      /Not signed in/,
    );
  } finally {
    await db.close();
  }
});
test("public endpoint validates destinations and hides database errors", async () => {
  let failing = false;
  const api = load("../src/app/api/publications/route.ts", {
    "next/server": { NextResponse: { json: (b, o) => Response.json(b, o) } },
    "@/lib/publications": { PUBLICATION_KINDS },
    "@/lib/db/publications": {
      publishedArticles: async () => {
        if (failing) throw Error("secret database");
        return [];
      },
    },
  });
  const req = (q) => ({
    nextUrl: new URL("https://business.jktl.com.ng/api/publications?" + q),
  });
  assert.equal((await api.GET(req("kind=private"))).status, 400);
  for (const k of PUBLICATION_KINDS)
    assert.equal((await api.GET(req("kind=" + k))).status, 200);
  assert.equal((await api.GET(req("kind=blog&slug=missing"))).status, 404);
  failing = true;
  const r = await api.GET(req("kind=blog"));
  assert.equal(r.status, 503);
  assert.doesNotMatch(JSON.stringify(await r.json()), /secret/);
});
test("PWA service worker never caches API data, RSC payloads or private navigation HTML", async () => {
  const handlers = {};
  let writes = 0,
    offline = false;
  const cache = {
    match: async (key) =>
      key === "/offline" ? new Response("Offline screen") : undefined,
    put: async () => {
      writes++;
    },
    addAll: async () => {},
  };
  const self = {
    location: { origin: "https://business.jktl.com.ng" },
    addEventListener: (name, fn) => (handlers[name] = fn),
  };
  new Function(
    "self",
    "caches",
    "fetch",
    readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"),
  )(self, { open: async () => cache }, async () => {
    if (offline) throw Error("offline");
    return new Response("Private content", { status: 200 });
  });
  const dispatch = (path, headers = {}, mode = "cors") => {
    let result;
    handlers.fetch({
      request: {
        method: "GET",
        url: "https://business.jktl.com.ng" + path,
        mode,
        headers: new Headers(headers),
      },
      respondWith: (p) => {
        result = p;
      },
    });
    return result;
  };
  assert.equal(dispatch("/api/tycoon"), undefined);
  assert.equal(dispatch("/api/publications?kind=blog"), undefined);
  assert.equal(dispatch("/business?_rsc=123"), undefined);
  assert.equal(dispatch("/admin/content", { RSC: "1" }), undefined);
  assert.equal(
    await (await dispatch("/admin/content", {}, "navigate")).text(),
    "Private content",
  );
  assert.equal(writes, 0);
  offline = true;
  assert.equal(
    await (await dispatch("/business", {}, "navigate")).text(),
    "Offline screen",
  );
  assert.equal(writes, 0);
});
test("scheduled publication rechecks current permissions and sends retryable branded notices", async () => {
  const { db, store, sql } = await fixture();
  try {
    let p = await store.saveEditorial(input(base), writer);
    p = await store.saveEditorial(
      input({ ...p, status: "submitted", assignedTo: editor.id }),
      owner,
    );
    p = await store.saveEditorial(input({ ...p, status: "approved" }), owner);
    p = await store.saveEditorial(
      input({
        ...p,
        status: "scheduled",
        scheduledAt: new Date(Date.now() + 3600000).toISOString(),
      }),
      editor,
    );
    await db.query(
      "UPDATE jktl_publications SET scheduled_at=now()-interval '1 minute' WHERE id=$1",
      [p.id],
    );
    let failMail = true;
    const deliveries = [];
    const ops = load("../src/lib/editorial-operations.ts", {
      "server-only": {},
      "@/lib/db/client": { getSql: () => sql },
      "@/lib/editorial-policy": { canPublish },
      "@/lib/publications": { mapPublication },
      "@/lib/email": {
        sendEditorialNotice: async (...args) => {
          deliveries.push(args);
          return { ok: !failMail };
        },
      },
    });
    let result = await ops.runEditorialMaintenance();
    assert.equal(result.published, 1);
    assert.ok(result.failed > 0);
    assert.equal((await store.publishedArticles("blog")).length, 1);
    await db.exec(
      "UPDATE editorial_notices SET next_attempt_at=now()-interval '1 minute'",
    );
    failMail = false;
    result = await ops.runEditorialMaintenance();
    assert.ok(result.sent > 0);
    const count = deliveries.length;
    await ops.runEditorialMaintenance();
    assert.equal(deliveries.length, count);
    let release = await store.saveEditorial(
      input({ ...base, slug: "release-scheduled", kind: "release" }),
      writer,
    );
    release = await store.saveEditorial(
      input({ ...release, status: "submitted", assignedTo: editor.id }),
      owner,
    );
    release = await store.saveEditorial(
      input({ ...release, status: "approved" }),
      owner,
    );
    await db.query(
      `UPDATE admin_users SET permission_overrides='{"publish_releases":true}' WHERE id=$1`,
      [editor.id],
    );
    release = await store.saveEditorial(
      input({
        ...release,
        status: "scheduled",
        scheduledAt: new Date(Date.now() + 3600000).toISOString(),
      }),
      editor,
    );
    await db.query(
      `UPDATE admin_users SET permission_overrides='{}' WHERE id=$1`,
      [editor.id],
    );
    await db.query(
      "UPDATE jktl_publications SET scheduled_at=now()-interval '1 minute' WHERE id=$1",
      [release.id],
    );
    result = await ops.runEditorialMaintenance();
    assert.ok(result.failed > 0);
    assert.deepEqual(await store.publishedArticles("release"), []);
    assert.equal(
      (
        await db.query("SELECT status FROM jktl_publications WHERE id=$1", [
          release.id,
        ])
      ).rows[0].status,
      "approved",
    );
    assert.ok(
      (
        await db.query(
          "SELECT * FROM editorial_notices WHERE event='schedule_failed'",
        )
      ).rows.length > 0,
    );
  } finally {
    await db.close();
  }
});
test("editorial invitations reuse Team accounts with hashed, expiring, single-use acceptance and no password email", async () => {
  const { db, sql } = await fixture();
  try {
    const { default: bcrypt } = await import("bcryptjs");
    let allowed = true,
      mail;
    const actions = load("../src/lib/actions/editorial-invitation-actions.ts", {
      "node:crypto": await import("node:crypto"),
      bcryptjs: { default: bcrypt },
      "@/lib/admin-session": {
        requireAdminCapability: async (cap) => {
          assert.equal(cap, "manage_team");
          if (!allowed) throw Error("Your role cannot manage team");
          return owner;
        },
      },
      "@/lib/db/client": { getSql: () => sql },
      "@/lib/email": {
        sendEditorialInvitation: async (...a) => {
          mail = a;
          return { ok: true };
        },
      },
      "@/lib/support/service": { rate: async () => {} },
      "next/cache": { revalidatePath: () => {} },
      "next/navigation": {
        redirect: (p) => {
          throw Error("REDIRECT:" + p);
        },
      },
    });
    const form = (data) => {
      const f = new FormData();
      for (const [k, v] of Object.entries(data)) f.set(k, v);
      return f;
    };
    allowed = false;
    await assert.rejects(
      actions.inviteEditorialAction(
        form({ name: "New Writer", email: "new@example.test", role: "writer" }),
      ),
      /cannot/,
    );
    allowed = true;
    const result = await actions.inviteEditorialAction(
      form({ name: "New Writer", email: "new@example.test", role: "writer" }),
    );
    assert.equal(result.emailSent, true);
    const token = new URL(result.url).searchParams.get("token");
    const invite = (await db.query("SELECT * FROM editorial_invitations"))
      .rows[0];
    assert.notEqual(invite.token_hash, token);
    assert.equal(mail[2], result.url);
    assert.doesNotMatch(JSON.stringify(mail), /correct-horse/);
    await assert.rejects(
      actions.inviteEditorialAction(
        form({ name: "Again", email: "new@example.test", role: "editor" }),
      ),
      /already has/,
    );
    const accept = form({ token, password: "correct-horse-battery-123" });
    await assert.rejects(
      actions.acceptEditorialInvitationAction(accept),
      /REDIRECT:\/admin\/login/,
    );
    const user = (
      await db.query("SELECT * FROM admin_users WHERE email='new@example.test'")
    ).rows[0];
    assert.equal(user.role, "writer");
    assert.equal(user.disabled_at, null);
    assert.equal(
      await bcrypt.compare("correct-horse-battery-123", user.password_hash),
      true,
    );
    await assert.rejects(
      actions.acceptEditorialInvitationAction(accept),
      /expired or was already used/,
    );
  } finally {
    await db.close();
  }
});
test("revoking official publishing also prevents unauthorized withdrawal or demotion of a sensitive publication", () => {
  const p = {
    ...parsePublication({ ...base, kind: "release" }),
    id: "00000000-0000-4000-8000-000000000010",
    createdBy: editor.id,
    assignedTo: editor.id,
    approvedBy: owner.id,
    status: "published",
    revision: 4,
  };
  assert.throws(
    () => checkEditorialChange(editor, { ...p, status: "submitted" }, p),
    /cannot withdraw/,
  );
  const flagged = {
    ...p,
    kind: "update",
    sensitive: true,
    status: "submitted",
  };
  assert.throws(
    () =>
      checkEditorialChange(
        editor,
        { ...flagged, sensitive: false, status: "approved" },
        flagged,
      ),
    /only be removed by an Owner/,
  );
});
test("published feed pagination enumerates existing articles beyond the first 200 without exposing draft bodies", async () => {
  const { db, store } = await fixture();
  try {
    await db.query(
      `INSERT INTO jktl_publications(slug,kind,title,excerpt,body,author,status,published_at,created_by) SELECT 'published-'||n,'blog','Published article '||n,'Useful business advice.','A detailed public article body.','JKTL Team','published',now()-n*interval '1 minute',$1::uuid FROM generate_series(1,201)n`,
      [owner.id],
    );
    const first = await store.publishedArticles("blog"),
      next = await store.publishedArticles("blog", undefined, 200);
    assert.equal(first.length, 200);
    assert.equal(next.length, 1);
    assert.equal(new Set([...first, ...next].map((p) => p.id)).size, 201);
    assert.equal(next[0].body, "");
    assert.ok(
      (await store.publishedArticles("blog", next[0].slug, 200))[0].body,
    );
  } finally {
    await db.close();
  }
});
