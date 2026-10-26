import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { sensitive } from "../src/lib/support/model.ts";
const partner = "10000000-0000-4000-8000-000000000001",
  agent = "10000000-0000-4000-8000-000000000002",
  other = "10000000-0000-4000-8000-000000000003";
test("partner ticket history enforces assignment and owner escalation, including sensitive follow-up replies", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `CREATE TABLE partner_tickets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),partner_id uuid,workspace_id uuid,subject text,category text,priority text,sensitive boolean,status text DEFAULT 'OPEN',assigned_to uuid,updated_at timestamptz DEFAULT now());CREATE TABLE partner_ticket_messages(id bigserial,ticket_id uuid,actor_id text,kind text,body text);`,
    );
    let admin = { id: agent, role: "support" };
    const query = async (s, p = []) => (await db.query(s, p)).rows;
    const deps = {
      "@/lib/custom/service": { query },
      "@/lib/partners/access": {
        approvedPartner: async () => ({ id: partner }),
        workspace: async () => {},
      },
      "@/lib/admin-session": { requireAdminCapability: async () => admin },
      "@/lib/support/model": { sensitive },
      "@/lib/support/service": { rate: async () => {} },
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
            "../src/lib/actions/partner-ticket-actions.ts",
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
    )((n) => deps[n], m, m.exports);
    const a = m.exports;
    const f = new FormData();
    f.set("subject", "Website assistance");
    f.set("body", "Please help with this website");
    f.set("category", "Website Setup");
    f.set("priority", "NORMAL");
    await a.createPartnerTicketAction(f);
    const t = (await query("SELECT * FROM partner_tickets"))[0];
    const r = new FormData();
    r.set("id", t.id);
    r.set("status", "IN_PROGRESS");
    r.set("body", "We are investigating");
    await a.staffPartnerTicketAction(r);
    admin = { id: other, role: "support" };
    await assert.rejects(a.staffPartnerTicketAction(r));
    const reply = new FormData();
    reply.set("id", t.id);
    reply.set("body", "I need a refund for this payment");
    await a.partnerTicketReplyAction(reply);
    assert.equal(
      (await query("SELECT sensitive FROM partner_tickets"))[0].sensitive,
      true,
    );
    admin = { id: agent, role: "support" };
    await assert.rejects(a.staffPartnerTicketAction(r));
    admin = { id: other, role: "owner" };
    r.set("internal", "on");
    await a.staffPartnerTicketAction(r);
    assert.equal(
      (
        await query(
          "SELECT count(*)::int n FROM partner_ticket_messages WHERE kind='NOTE'",
        )
      )[0].n,
      1,
    );
    const visible = await query(
      "SELECT * FROM partner_ticket_messages WHERE kind<>'NOTE'",
    );
    assert.ok(visible.every((v) => v.kind !== "NOTE"));
    f.set("category", "Billing");
    await a.createPartnerTicketAction(f);
    assert.ok(
      (await query("SELECT * FROM partner_tickets WHERE category='Billing'"))[0]
        .sensitive,
    );
  } finally {
    await db.close();
  }
});
