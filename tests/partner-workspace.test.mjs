import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {
  getWebsiteTemplate,
  templateDraft,
  parseWebsiteDocument,
} from "../src/lib/website-templates.ts";
import { saveTemplateDocument } from "../src/lib/website-template-store.ts";
const p = "10000000-0000-4000-8000-000000000001",
  org = "10000000-0000-4000-8000-000000000002",
  w = "10000000-0000-4000-8000-000000000003";
test("partner website operations reuse the customer save engine and enforce current grant, product, version and publication authority", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `CREATE TABLE affiliates(id uuid PRIMARY KEY,status text,programme text,partner_terms_confirmed boolean);INSERT INTO affiliates VALUES('${p}','active','partner',true);CREATE TABLE partner_client_access(id uuid DEFAULT gen_random_uuid(),partner_id uuid,organization_id uuid,revoked_at timestamptz,scopes text[]);INSERT INTO partner_client_access(partner_id,organization_id,scopes) VALUES('${p}','${org}',ARRAY['MANAGE_WEBSITE_CONTENT']);CREATE TABLE feature_registry(slug text,partner_mode text,partner_actions text[]);INSERT INTO feature_registry VALUES('website-builder','SELF_SERVICE',ARRAY['CONFIGURE']);CREATE TABLE business_profiles(organization_id uuid,website_template_id text,website_document jsonb,website_revision int,theme_color text,published boolean);INSERT INTO business_profiles VALUES('${org}','','{}',0,'#ffffff',false);CREATE TABLE distribution_audit(id bigserial,actor_id text,event text,affiliate_id uuid,detail jsonb);`,
    );
    await db.exec(
      `CREATE TABLE partner_workspaces(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),partner_id uuid,organization_id uuid,business_name text,business_category text,contact_name text,contact_email text,phone text,country text,preferred_domain text,requirements text,selected_services text[],template_id text DEFAULT '',document jsonb DEFAULT '{}',revision int DEFAULT 0);`,
    );
    const query = async (sql, args = []) => (await db.query(sql, args)).rows;
    let row = { id: w, partner_id: p, organization_id: org };
    const deps = {
      "node:crypto": await import("node:crypto"),
      "@/lib/custom/service": { query },
      "@/lib/partners/access": {
        approvedPartner: async () => ({ id: p }),
        workspace: async (id) => {
          if (id !== w) throw Error("Unavailable");
          return { p: { id: p }, w: row };
        },
        product: async () => {},
      },
      "@/lib/website-templates": { getWebsiteTemplate, parseWebsiteDocument },
      "@/lib/website-template-store": { saveTemplateDocument },
      "@/lib/support/service": { rate: async () => {} },
      "next/cache": { revalidatePath: () => {} },
      "next/navigation": { redirect: () => {} },
    };
    const m = { exports: {} };
    new Function(
      "require",
      "module",
      "exports",
      ts.transpileModule(
        readFileSync(
          new URL(
            "../src/lib/actions/partner-workspace-actions.ts",
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
    const input = {
      id: w,
      templateId: "law-firm",
      document: templateDraft("law-firm", "Client law firm"),
      revision: 0,
      publish: false,
    };
    assert.equal((await a.savePartnerWebsiteAction(input)).ok, true);
    assert.equal(
      (await a.savePartnerWebsiteAction(input)).ok,
      false,
      "stale version",
    );
    assert.equal(
      (
        await a.savePartnerWebsiteAction({
          ...input,
          revision: 1,
          publish: true,
        })
      ).ok,
      false,
      "publish scope required",
    );
    await db.exec(
      "UPDATE partner_client_access SET scopes=ARRAY['MANAGE_WEBSITE_CONTENT','PUBLISH_WEBSITE']",
    );
    assert.equal(
      (
        await a.savePartnerWebsiteAction({
          ...input,
          revision: 1,
          publish: true,
        })
      ).ok,
      true,
    );
    assert.equal(
      (await query("SELECT published FROM business_profiles"))[0].published,
      true,
    );
    assert.equal(
      (await a.savePartnerWebsiteAction({ ...input, revision: 2 })).ok,
      true,
    );
    assert.equal(
      (await query("SELECT published FROM business_profiles"))[0].published,
      true,
      "saving content must not unpublish",
    );
    await db.exec("UPDATE feature_registry SET partner_mode='UNAVAILABLE'");
    assert.equal(
      (await a.savePartnerWebsiteAction({ ...input, revision: 3 })).ok,
      false,
      "admin product disable",
    );
    await db.exec("UPDATE feature_registry SET partner_mode='SELF_SERVICE'");
    await db.exec("UPDATE partner_client_access SET revoked_at=now()");
    assert.equal(
      (await a.savePartnerWebsiteAction({ ...input, revision: 3 })).ok,
      false,
      "revocation",
    );
    assert.equal(
      (await a.savePartnerWebsiteAction({ ...input, id: "other" })).ok,
      false,
      "other workspace",
    );
    row = { ...row, organization_id: null };
    assert.equal(
      (await a.savePartnerWebsiteAction({ ...input, publish: true })).ok,
      false,
      "unclaimed draft cannot publish",
    );
    assert.equal((await query("SELECT * FROM distribution_audit")).length, 3);
    const form = new FormData();
    form.set("businessName", "Client draft one");
    form.set("contactEmail", "owner@example.test");
    form.set("contactName", "Owner");
    await a.createPartnerWorkspaceAction(form);
    form.set("businessName", "Client draft two");
    await a.createPartnerWorkspaceAction(form);
    assert.equal((await query("SELECT * FROM partner_workspaces")).length, 2);
  } finally {
    await db.close();
  }
});
