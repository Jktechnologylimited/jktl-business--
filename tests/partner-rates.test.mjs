import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { load } from "./fixtures/lifecycle-db.mjs";
const id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  contract = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
async function fixture() {
  const db = new PGlite(),
    query = async (s, p = []) => (await db.query(s, p)).rows;
  await db.exec(
    `CREATE TABLE affiliates(id uuid PRIMARY KEY,programme text,status text,commission_model text,commission_bps int);CREATE TABLE distribution_contracts(id uuid PRIMARY KEY,affiliate_id uuid,status text,model text,terms jsonb);CREATE TABLE distribution_audit(id bigserial,actor_id text,event text,affiliate_id uuid,detail jsonb);INSERT INTO affiliates VALUES('${id}','partner','active','percentage',2000);`,
  );
  await db.exec(
    readFileSync("migrations/072_partner_commission_changes.sql", "utf8"),
  );
  let allowed = true;
  const rates = load("src/lib/distribution/partner-rates.ts", {
    "server-only": {},
    "@/lib/custom/service": { query },
  });
  const actions = load("src/lib/actions/partner-rate-actions.ts", {
    "@/lib/admin-session": {
      requireAdminCapability: async (cap) => {
        assert.equal(cap, "manage_affiliates");
        if (!allowed) throw Error("Denied");
        return { id: "owner" };
      },
    },
    "@/lib/custom/service": { query },
    "next/cache": { revalidatePath() {} },
    "@/lib/distribution/partner-rates": rates,
  });
  return { db, query, rates, actions, deny: () => (allowed = false) };
}
const input = () => ({
  id,
  percentage: "22.50",
  expectedBps: 2000,
  reason: "Agreed revised commission with partner.",
  agreed: true,
});
test("partner percentage update is validated, audited and guarded against stale writes", async () => {
  const f = await fixture();
  try {
    for (const p of ["", "-1", "101", "20.001", "NaN", "1e2"])
      assert.equal(
        (await f.actions.updatePartnerRateAction({ ...input(), percentage: p }))
          .ok,
        false,
      );
    assert.equal(
      (await f.actions.updatePartnerRateAction({ ...input(), agreed: false }))
        .ok,
      false,
    );
    let r = await f.actions.updatePartnerRateAction(input());
    assert.equal(r.ok, true);
    assert.equal(r.rateBps, 2250);
    assert.equal(
      (await f.query("SELECT commission_bps FROM affiliates"))[0]
        .commission_bps,
      2250,
    );
    assert.equal(
      (await f.query("SELECT count(*) n FROM distribution_audit"))[0].n,
      1,
    );
    assert.equal(
      (
        await f.actions.updatePartnerRateAction({
          ...input(),
          percentage: "30",
        })
      ).ok,
      false,
    );
    await assert.rejects(
      () => f.query("DELETE FROM partner_commission_changes"),
      /immutable/,
    );
    f.deny();
    assert.equal(
      (
        await f.actions.updatePartnerRateAction({
          ...input(),
          expectedBps: 2250,
          percentage: "30",
        })
      ).ok,
      false,
    );
  } finally {
    await f.db.close();
  }
});
test("policy website changes resolve by payment date and preserve contract terms and earlier rates", async () => {
  const f = await fixture();
  try {
    await f.query("UPDATE affiliates SET commission_model='policy'");
    await f.query(
      "INSERT INTO distribution_contracts VALUES($1,$2,'ACTIVE','REFERRAL','{\"rateBps\":2000}')",
      [contract, id],
    );
    assert.equal(
      (
        await f.actions.updatePartnerRateAction({
          ...input(),
          percentage: "60",
        })
      ).ok,
      false,
    );
    const before = new Date(Date.now() - 60000).toISOString();
    const r = await f.actions.updatePartnerRateAction(input());
    assert.equal(r.ok, true);
    assert.equal(
      await f.rates.partnerWebsiteRate(id, contract, before, 2000),
      2000,
    );
    assert.equal(
      await f.rates.partnerWebsiteRate(
        id,
        contract,
        new Date(Date.now() + 60000).toISOString(),
        2000,
      ),
      2250,
    );
    assert.equal(
      (await f.query("SELECT terms FROM distribution_contracts"))[0].terms
        .rateBps,
      2000,
    );
    await f.query("UPDATE distribution_contracts SET model='RESELLER'");
    assert.equal(
      (
        await f.actions.updatePartnerRateAction({
          ...input(),
          percentage: "25",
          expectedBps: 2250,
        })
      ).ok,
      false,
    );
  } finally {
    await f.db.close();
  }
});

test("policy partners without an issued contract can configure a proposal without activating earnings", async () => {
  const f = await fixture();
  try {
    await f.query("UPDATE affiliates SET commission_model='policy'");
    const r = await f.actions.updatePartnerRateAction(input());
    assert.equal(r.ok, true);
    assert.equal(r.proposal, true);
    assert.equal(
      (await f.query("SELECT count(*) n FROM distribution_contracts"))[0].n,
      0,
    );
    assert.equal(
      (await f.query("SELECT commission_model FROM affiliates"))[0]
        .commission_model,
      "policy",
    );
    assert.equal(
      (await f.query("SELECT detail FROM distribution_audit"))[0].detail.scope,
      "proposal_requires_contract",
    );
  } finally {
    await f.db.close();
  }
});
