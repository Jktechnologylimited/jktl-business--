import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { redact } from "../src/lib/support/model.ts";
const p = "10000000-0000-4000-8000-000000000001",
  org = "10000000-0000-4000-8000-000000000002",
  w = "10000000-0000-4000-8000-000000000003",
  asset = "10000000-0000-4000-8000-000000000004",
  other = "10000000-0000-4000-8000-000000000005";
test("partner product operations use native service queues and enforce client, product and scope boundaries", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `CREATE TABLE affiliates(id uuid,status text,programme text,partner_terms_confirmed boolean);INSERT INTO affiliates VALUES('${p}','active','partner',true);CREATE TABLE partner_client_access(id uuid DEFAULT gen_random_uuid(),partner_id uuid,organization_id uuid,scopes text[],revoked_at timestamptz);INSERT INTO partner_client_access(partner_id,organization_id,scopes) VALUES('${p}','${org}',ARRAY['VIEW_ALLOWED_SERVICES','REQUEST_SERVICE_CHANGES']);CREATE TABLE feature_registry(slug text,partner_mode text,partner_actions text[]);INSERT INTO feature_registry VALUES('domains','ASSISTED',ARRAY['REQUEST_SETUP']),('business-email','ASSISTED',ARRAY['REQUEST_SETUP']);CREATE TABLE domain_assets(id uuid,organization_id uuid);INSERT INTO domain_assets VALUES('${asset}','${org}'),('${other}','${other}');CREATE TABLE email_services(id uuid,organization_id uuid);INSERT INTO email_services VALUES('${asset}','${org}');CREATE TABLE domain_tasks(id uuid DEFAULT gen_random_uuid(),organization_id uuid,asset_id uuid,kind text,message text);CREATE TABLE email_requests(id uuid DEFAULT gen_random_uuid(),organization_id uuid,service_id uuid,kind text,message text);CREATE TABLE partner_tickets(id uuid DEFAULT gen_random_uuid(),partner_id uuid,workspace_id uuid,category text,subject text);CREATE TABLE partner_ticket_messages(id bigserial,ticket_id uuid,actor_id text,kind text,body text);CREATE TABLE distribution_audit(id bigserial,actor_id text,event text,affiliate_id uuid,detail jsonb);`,
    );
    const query = async (s, args = []) => (await db.query(s, args)).rows;
    const deps = {
      "@/lib/custom/service": { query },
      "@/lib/partners/access": {
        workspace: async (id) => {
          if (id !== w) throw Error("Unavailable");
          return { p: { id: p }, w: { id: w, organization_id: org } };
        },
        product: async () => {},
      },
      "@/lib/domains/service": {
        checkAvailability: async () => ({ check: { status: "UNKNOWN" } }),
      },
      "@/lib/business-email/service": { emailPlans: async () => [] },
      "@/lib/support/service": { rate: async () => {} },
      "@/lib/support/model": { redact },
      "next/server": { after: () => {} },
      "@/lib/partners/notifications": {
        processPartnerNotices: async () => ({}),
      },
    };
    const m = { exports: {} };
    new Function(
      "require",
      "module",
      "exports",
      ts.transpileModule(
        readFileSync(
          new URL(
            "../src/lib/actions/partner-product-actions.ts",
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
      workspaceId: w,
      serviceId: asset,
      product: "domains",
      kind: "DNS",
      message: "Please review the approved DNS configuration",
    };
    await a.partnerNativeServiceRequestAction(input);
    assert.equal((await query("SELECT * FROM domain_tasks")).length, 1);
    await a.partnerNativeServiceRequestAction({
      ...input,
      product: "business-email",
      kind: "ALIAS",
      message: "Please request a support alias for this business",
    });
    assert.equal((await query("SELECT * FROM email_requests")).length, 1);
    assert.equal((await query("SELECT * FROM partner_tickets")).length, 2);
    await assert.rejects(
      a.partnerNativeServiceRequestAction({ ...input, serviceId: other }),
    );
    await assert.rejects(
      a.partnerNativeServiceRequestAction({ ...input, product: "custom" }),
    );
    await query(
      "UPDATE feature_registry SET partner_mode='UNAVAILABLE' WHERE slug='domains'",
    );
    await assert.rejects(a.partnerNativeServiceRequestAction(input));
    await query(
      "UPDATE feature_registry SET partner_mode='ASSISTED' WHERE slug='domains'",
    );
    await query("UPDATE partner_client_access SET revoked_at=now()");
    await assert.rejects(a.partnerNativeServiceRequestAction(input));
    assert.equal((await query("SELECT * FROM domain_tasks")).length, 1);
    assert.equal((await query("SELECT * FROM distribution_audit")).length, 2);
  } finally {
    await db.close();
  }
});
