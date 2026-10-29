import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import * as model from "../src/lib/custom/model.ts";
const require = createRequire(import.meta.url);
function load(file, deps) {
  const code = ts.transpileModule(
      readFileSync(new URL(file, import.meta.url), "utf8"),
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
const project = "40000000-0000-4000-8000-000000000001",
  org = "40000000-0000-4000-8000-000000000002",
  user = "40000000-0000-4000-8000-000000000003",
  foreign = "40000000-0000-4000-8000-000000000004",
  staff = "40000000-0000-4000-8000-000000000005";
const manifest = {
  title: {
    group: "Home",
    label: "Hero title",
    kind: "text",
    default: "Original law firm",
    max: 160,
  },
  image: {
    group: "Home",
    label: "Image",
    kind: "image",
    default: "/hero/justice.jpg",
    max: 1000,
  },
  contact: {
    group: "Contact",
    label: "Contact link",
    kind: "link",
    default: "/contact",
    max: 1000,
  },
};
const schema = load("../src/lib/custom/site-schema.ts", {});
test("manifest is explicit and rejects unsafe defaults, oversized data and unknown fields", () => {
  assert.equal(Object.keys(schema.siteManifest(manifest)).length, 3);
  assert.throws(() =>
    schema.siteManifest({
      ...manifest,
      image: { ...manifest.image, default: "javascript:evil" },
    }),
  );
  assert.throws(() =>
    schema.siteManifest({ title: { ...manifest.title, max: 1000000 } }),
  );
  assert.throws(() =>
    schema.managedFields(
      {
        title: "x",
        image: "/hero/justice.jpg",
        contact: "/contact",
        code: "injected",
      },
      manifest,
    ),
  );
  assert.throws(() =>
    schema.managedFields(
      { title: "x", image: "//evil.example", contact: "/contact" },
      manifest,
    ),
  );
});
test("normal Business sessions govern managed editing, publication, images and public reads", async () => {
  const db = new PGlite(),
    query = async (s, p = []) => (await db.query(s, p)).rows;
  let session = { userId: user, organizationId: org },
    admin = false;
  try {
    await db.exec(
      `CREATE TABLE users(id uuid PRIMARY KEY);CREATE TABLE organization_members(user_id uuid,organization_id uuid,active boolean,role text);CREATE TABLE custom_clients(organization_id uuid PRIMARY KEY,user_id uuid,pilot_ready boolean,activated_at timestamptz);CREATE TABLE custom_projects(id uuid PRIMARY KEY,organization_id uuid,name text,website_url text,status text,billing_only boolean DEFAULT false,cms_scopes text[],cms_fields text[],revision integer DEFAULT 1,updated_at timestamptz DEFAULT now(),UNIQUE(id,organization_id));INSERT INTO users VALUES('${user}'),('${foreign}'),('${staff}');INSERT INTO organization_members VALUES('${user}','${org}',true,'owner'),('${foreign}','${foreign}',true,'owner'),('${staff}','${org}',true,'staff');INSERT INTO custom_clients VALUES('${org}','${user}',true,now());INSERT INTO custom_projects(id,organization_id,name,website_url,status,cms_scopes) VALUES('${project}','${org}','Pilot law','https://law.example','LIVE',ARRAY['content:read','content:write','content:publish']);`,
    );
    for (const file of [
      "063_custom_site_content.sql",
      "064_managed_client_editor.sql",
    ])
      await db.exec(
        readFileSync(new URL("../migrations/" + file, import.meta.url), "utf8"),
      );
    await query(
      "UPDATE custom_projects SET managed_cms=true,cms_manifest=$1::jsonb",
      [JSON.stringify(manifest)],
    );
    const owner = async () => {
      if (
        !session ||
        !(
          await query(
            "SELECT 1 FROM organization_members WHERE user_id=$1 AND organization_id=$2 AND active=true AND role='owner'",
            [session.userId, session.organizationId],
          )
        ).length
      )
        throw Error("Not owner");
      return session;
    };
    const service = {
      query,
      owner,
      audit: async () => {},
      validateCmsSession: async () => null,
    };
    const store = load("../src/lib/custom/site-store.ts", {
      "server-only": {},
      "./service": service,
      "./model": model,
      "@/lib/domains/store": { rateLimit: async () => {} },
    });
    const managed = load("../src/lib/custom/managed-site.ts", {
      "server-only": {},
      "./service": service,
      "./model": model,
      "./site-store": store,
      "./site-schema": schema,
    });
    const actions = load("../src/lib/actions/managed-site-actions.ts", {
      "@/lib/custom/managed-site": managed,
      "@/lib/custom/site-store": store,
      "@/lib/custom/site-schema": schema,
      "@/lib/custom/service": service,
      "@/lib/custom/model": model,
      "@/lib/admin-session": {
        requireAdminCapability: async () => {
          if (!admin) throw Error("Forbidden");
          return { id: user };
        },
      },
      "@/lib/domains/store": { rateLimit: async () => {} },
    });
    const opened = await actions.managedEditorAction(project);
    assert.equal(opened.ok, true);
    assert.equal(opened.data.revision, 0);
    assert.equal(opened.data.draft.title, "Original law firm");
    assert.equal(opened.data.apiKey, undefined);
    const fields = {
      title: "Draft title",
      image: "/hero/justice.jpg",
      contact: "/contact",
    };
    assert.equal(
      (await actions.saveManagedSiteAction(project, fields, 0, false)).ok,
      true,
    );
    const publicAccess = await managed.publicManagedSite(project);
    assert.deepEqual(await store.loadSiteContent(publicAccess, "published"), {
      published: null,
    });
    assert.equal(
      (
        await actions.saveManagedSiteAction(
          project,
          { ...fields, title: "Published title" },
          1,
          true,
        )
      ).ok,
      true,
    );
    assert.deepEqual(await store.loadSiteContent(publicAccess, "published"), {
      published: { ...fields, title: "Published title" },
    });
    assert.equal(
      (await actions.saveManagedSiteAction(project, fields, 1, true)).ok,
      false,
    );
    const image = new FormData();
    image.set(
      "image",
      new File(
        [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array(20).fill(0)])],
        "test.png",
        { type: "image/png" },
      ),
    );
    assert.equal(
      (await actions.uploadManagedImageAction(project, image)).ok,
      true,
    );
    assert.equal(
      (
        await actions.saveManagedCmsConfigAction(project, 1, true, manifest, [
          "content:read",
        ])
      ).ok,
      false,
    );
    session = { userId: foreign, organizationId: foreign };
    assert.equal((await actions.managedEditorAction(project)).ok, false);
    assert.equal(
      (await actions.saveManagedSiteAction(project, fields, 2, true)).ok,
      false,
    );
    session = { userId: staff, organizationId: org };
    assert.equal((await actions.managedEditorAction(project)).ok, false);
    await query("UPDATE organization_members SET role='owner' WHERE user_id=$1",[staff]);
    assert.equal((await actions.managedEditorAction(project)).ok,false);
    await query("UPDATE organization_members SET role='staff' WHERE user_id=$1",[staff]);
    session = null;
    assert.equal((await actions.managedEditorAction(project)).ok, false);
    session = { userId: user, organizationId: org };
    await query(
      "UPDATE organization_members SET active=false WHERE user_id=$1",
      [user],
    );
    assert.equal(
      (await actions.saveManagedSiteAction(project, fields, 2, true)).ok,
      false,
    );
    await query(
      "UPDATE organization_members SET active=true WHERE user_id=$1",
      [user],
    );
    await query("UPDATE custom_projects SET cms_scopes=ARRAY['content:read']");
    assert.equal((await actions.managedEditorAction(project)).ok, true);
    assert.equal(
      (await actions.saveManagedSiteAction(project, fields, 2, false)).ok,
      false,
    );
    assert.equal(
      (await actions.uploadManagedImageAction(project, image)).ok,
      false,
    );
    await query("UPDATE custom_clients SET activated_at=NULL");
    assert.equal((await actions.managedEditorAction(project)).ok, false);
    await query("UPDATE custom_clients SET activated_at=now()");
    admin = true;
    assert.equal(
      (
        await actions.saveManagedCmsConfigAction(project, 1, false, manifest, [
          "content:read",
        ])
      ).ok,
      true,
    );
    await assert.rejects(() => managed.publicManagedSite(project));
    assert.equal((await actions.managedEditorAction(project)).ok, false);
    assert.equal(
      (await query("SELECT revision FROM custom_site_content"))[0].revision,
      2,
    );
    assert.equal(
      (await query("SELECT count(*)::int AS n FROM custom_site_media"))[0].n,
      1,
    );
  } finally {
    await db.close();
  }
});
