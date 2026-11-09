import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import * as model from "../../src/lib/lifecycle/model.ts";
const require = createRequire(import.meta.url);
export function load(file, deps = {}) {
  const m = { exports: {} };
  new Function(
    "require",
    "module",
    "exports",
    ts.transpileModule(
      readFileSync(new URL("../../" + file, import.meta.url), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
        },
      },
    ).outputText,
   )((n) => {
    if(n in deps)return deps[n];
    // Pure SQL modules only: never auto-resolve server adapters into live bindings.
    if(n==='./receipt-sql'||n==='@/lib/investor/receipt-sql')return load('src/lib/investor/receipt-sql.ts');
    if(n==='@/lib/company-finance/queries')return load('src/lib/company-finance/queries.ts');
    return require(n);
  }, m, m.exports);
  return m.exports;
}
export async function fixture() {
  const db = new PGlite(),
    q = async (s, p = []) => (await db.query(s, p)).rows;
  await db.exec(
    `CREATE TABLE organizations(id uuid PRIMARY KEY,name text,slug text,created_at timestamptz DEFAULT now());CREATE TABLE users(id uuid PRIMARY KEY,email text);CREATE TABLE organization_members(id uuid DEFAULT gen_random_uuid(),organization_id uuid,user_id uuid,role text,active boolean,email text,created_at timestamptz DEFAULT now());CREATE TABLE business_profiles(organization_id uuid PRIMARY KEY,display_name text,published boolean DEFAULT false,custom_domain text DEFAULT '',custom_domain_verified boolean DEFAULT false,website_template_id text DEFAULT '',website_document jsonb DEFAULT '{}');CREATE TABLE custom_clients(organization_id uuid PRIMARY KEY);CREATE TABLE domain_assets(id uuid DEFAULT gen_random_uuid(),organization_id uuid,expires_at timestamptz);CREATE TABLE admin_users(id uuid PRIMARY KEY,name text,role text,disabled_at timestamptz,staff_revoked_at timestamptz);CREATE TABLE email_preferences(email text PRIMARY KEY,marketing_suppressed boolean DEFAULT false,marketing_opt_in boolean DEFAULT false);CREATE TABLE prospects(email text,suppressed boolean,status text);CREATE TABLE email_send_history(attempt_key text PRIMARY KEY,provider_state text,provider_message_id text);CREATE TABLE renewal_settings(id boolean PRIMARY KEY,enabled boolean,last_scan_at timestamptz,updated_at timestamptz DEFAULT now());INSERT INTO renewal_settings VALUES(true,false,NULL,now());CREATE TABLE renewal_items(item_key text,organization_id uuid,recipient text,due_on date,days_left integer,name text);CREATE TABLE renewal_reminders(id uuid DEFAULT gen_random_uuid(),item_key text,organization_id uuid,recipient text,due_on date,state text,attempts integer DEFAULT 0,updated_at timestamptz DEFAULT now());CREATE TABLE support_cases(id uuid DEFAULT gen_random_uuid(),organization_id uuid,status text);`,
  );
  await db.exec(
    readFileSync(
      new URL("../../migrations/070_customer_lifecycle.sql", import.meta.url),
      "utf8",
    ),
  );
  const sent = [],
    transport = { outcome: "accepted", postal: "Verified business address" },
    actor = { id: crypto.randomUUID(), role: "owner", permissions: [] },
    permissions = { deny: false };
  await q("INSERT INTO admin_users(id,name,role) VALUES($1,'Owner','owner')", [
    actor.id,
  ]);
  const svc = load("src/lib/lifecycle/service.ts", {
    "server-only": {},
    "@/lib/custom/service": { query: q },
    "@/lib/mail/addresses": {
      mailAddress: (value) =>
        typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
          ? value.toLowerCase()
          : "",
    },
    "@/lib/mail/service": {
      currentBranding: async () => ({ postalAddress: transport.postal }),
    },
    "@/lib/email": {
      sendAdminComposedEmail: async (message) => {
        sent.push(message);
        if (transport.outcome === "throw") throw Error("timeout");
        if (transport.outcome === "failed")
          return { ok: false, error: "Provider rejected" };
        if (transport.outcome === "unknown")
          return { ok: false, uncertain: true };
        await q(
          "INSERT INTO email_send_history VALUES($1,'ACCEPTED','mock-provider') ON CONFLICT DO NOTHING",
          [message.key],
        );
        return { ok: true, providerId: "mock-provider" };
      },
    },
    "@/lib/mail/layout": {
      escapeHtml: (s) =>
        String(s).replace(
          /[&<>"']/g,
          (c) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#39;",
            })[c],
        ),
      mailAction: (label, url) => `<a href="${url}">${label}</a>`,
    },
    "./model": model,
  });
  const caps = {
    requireAdminCapability: async () => {
      if (permissions.deny) throw Error("Unauthorized");
      return actor;
    },
    requireAdminSession: async () => {
      if (permissions.deny) throw Error("Unauthorized");
      return actor;
    },
  };
  const actions = load("src/lib/actions/lifecycle-actions.ts", {
    "next/cache": { revalidatePath: () => {} },
    "next/server": { after: () => {} },
    "@/lib/admin-session": caps,
    "@/lib/admin-permissions": { can: () => !permissions.deny },
    "@/lib/custom/service": { query: q },
    "@/lib/support/model": { redact: (s) => s },
    "@/lib/lifecycle/model": model,
    "@/lib/lifecycle/service": svc,
  });
  async function account(
    stage = "NO_SITE",
    email = "owner-" + crypto.randomUUID() + "@example.test",
  ) {
    const id = crypto.randomUUID(),
      user = crypto.randomUUID();
    await q(
      "INSERT INTO organizations(id,name,slug,created_at) VALUES($1,'Fixture business',$2,now()-interval '90 days')",
      [id, "business-" + id],
    );
    await q("INSERT INTO users VALUES($1,$2)", [user, email]);
    await q(
      "INSERT INTO organization_members(organization_id,user_id,role,active,email) VALUES($1,$2,'owner',true,$3)",
      [id, user, email],
    );
    await q(
      "INSERT INTO business_profiles(organization_id,display_name,published,website_template_id,custom_domain,custom_domain_verified) VALUES($1,$2,$3,$4,$5,$6)",
      [
        id,
        "Fixture <Business>",
        ["FREE_DOMAIN", "CONNECT_DOMAIN", "COMPLETE"].includes(stage),
        stage === "NO_SITE" ? "" : "law-firm",
        stage === "COMPLETE" ? "example.test" : "",
        stage === "COMPLETE",
      ],
    );
    if (stage === "MANAGED")
      await q("INSERT INTO custom_clients VALUES($1)", [id]);
    if (stage === "CONNECT_DOMAIN")
      await q(
        "INSERT INTO domain_assets(organization_id,expires_at) VALUES($1,now()+interval '1 year')",
        [id],
      );
    await q(
      "INSERT INTO email_preferences(email) VALUES($1) ON CONFLICT DO NOTHING",
      [email],
    );
    return { id, user, email };
  }
  const age = async (id, days) =>
    q(
      "UPDATE lifecycle_accounts SET stage_started_at=now()-$2*interval '1 day'-interval '1 minute' WHERE organization_id=$1",
      [id, days],
    );
  return {
    db,
    q,
    svc,
    actions,
    account,
    age,
    sent,
    transport,
    actor,
    permissions,
  };
}
