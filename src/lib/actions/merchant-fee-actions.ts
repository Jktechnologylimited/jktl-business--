"use server";
import { randomUUID } from "node:crypto";
import { requireAdminCapability } from "@/lib/admin-session";
import { authRateLimit } from "@/lib/security/auth-rate-limit";
import { query } from "@/lib/custom/service";
import { revalidatePath, revalidateTag } from "next/cache";
import { validateBands } from "@/lib/merchant-fees/model";
import { activationGate } from "@/lib/merchant-fees/service";
async function owner() {
  const a = await requireAdminCapability("manage_company_finance");
  await authRateLimit(a.id, "merchant-fee-policy", 20, 3600);
  return a;
}
const evidence = (v: unknown) => {
  const s = String(v || "").trim();
  if (s.length < 10 || s.length > 1000)
    throw Error("Provide the provider validation and approval evidence.");
  return s;
};
function invalidate() {
  revalidatePath("/admin/insights");
  revalidateTag("company-insights", { expire: 0 });
}
export async function saveBuyerFeePolicyAction(form: FormData) {
  const a = await owner();
  const label = String(form.get("label") || "").trim();
  if (label.length < 3 || label.length > 100)
    throw Error("Use a descriptive policy name.");
  const raw = String(form.get("bands") || "");
  if (raw.length > 5000) throw Error("Use at most twelve fee bands.");
  const bands = validateBands(JSON.parse(raw));
  const sources = form.getAll("sources").map(String);
  if (
    sources.some((s) => !["INVOICE", "WEBSITE"].includes(s)) ||
    new Set(sources).size !== sources.length
  )
    throw Error("Choose supported merchant payment sources only.");
  const exemptions = form.getAll("exemptions").map(String);
  if (
    exemptions.length > 200 ||
    new Set(exemptions).size !== exemptions.length ||
    exemptions.some(
      (s) => !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(s),
    )
  )
    throw Error("Choose valid business exemptions.");
  if (exemptions.length) {
    const present = await query(
      "SELECT id FROM organizations WHERE id=ANY($1::uuid[])",
      [exemptions],
    );
    if (present.length !== new Set(exemptions).size)
      throw Error("Choose existing business accounts for exemptions.");
  }
  const id = randomUUID();
  await query(
    `WITH saved AS(INSERT INTO merchant_fee_policies(id,label,enabled,bands,sources,exempt_organizations,created_by) VALUES($1,$2,$3,$4::jsonb,$5::text[],$6::uuid[],$7) RETURNING id,version) INSERT INTO company_finance_audit(actor_id,event,detail) SELECT $7,'BUYER_FEE_POLICY_DRAFTED',jsonb_build_object('policy',id,'version',version,'enabled',$3::boolean) FROM saved`,
    [
      id,
      label,
      form.get("enabled") === "on",
      JSON.stringify(bands),
      sources,
      exemptions,
      a.id,
    ],
  );
  invalidate();
}
export async function activateBuyerFeePolicyAction(form: FormData) {
  const a = await owner(),
    gate = activationGate();
  if (!gate)
    throw Error(
      "Activation is locked. Provider testing and explicit production approval must be configured first.",
    );
  const id = String(form.get("policy_id") || ""),
    rev = Number(form.get("rev"));
  if (!/^[a-f0-9-]{36}$/i.test(id) || !Number.isSafeInteger(rev) || rev < 0)
    throw Error("Read the current policy configuration before approving it.");
  if (form.get("confirmed") !== "on")
    throw Error(
      "Confirm the tested split, buyer disclosure, permitted surcharges and explicit activation approval.",
    );
  const provider = evidence(form.get("provider_evidence")),
    requirements = evidence(form.get("requirements_evidence"));
  const rows = await query(
    `WITH changed AS(UPDATE merchant_fee_configuration SET active_policy_id=$1,rev=rev+1,approved_by=$2,approved_at=now(),provider_evidence=$3,requirements_evidence=$4 WHERE id=true AND rev=$5 AND EXISTS(SELECT 1 FROM merchant_fee_policies WHERE id=$1) RETURNING rev) INSERT INTO company_finance_audit(actor_id,event,detail) SELECT $2,'BUYER_FEE_POLICY_ACTIVATED',jsonb_build_object('policy',$1::uuid,'rev',rev,'providerEvidence',$3::text,'requirementsEvidence',$4::text,'mode',$6::text) FROM changed RETURNING id`,
    [id, a.id, provider, requirements, rev, gate],
  );
  if (!rows.length)
    throw Error("Read the latest policy revision and retry your approval.");
  invalidate();
}
/** An operational rollback restores the pre-existing arrangement for new quotes only. */
export async function rollbackBuyerFeePolicyAction(form: FormData) {
  const a = await owner(),
    rev = Number(form.get("rev")),
    reason = evidence(form.get("reason"));
  if (!Number.isSafeInteger(rev) || rev < 0 || form.get("confirmed") !== "on")
    throw Error(
      "Confirm that new checkouts should return to the existing fixed invoice arrangement.",
    );
  const rows = await query(
    `WITH changed AS(UPDATE merchant_fee_configuration SET active_policy_id=NULL,rev=rev+1,approved_by=NULL,approved_at=NULL WHERE id=true AND rev=$1 RETURNING rev) INSERT INTO company_finance_audit(actor_id,event,detail) SELECT $2,'BUYER_FEE_POLICY_ROLLED_BACK',jsonb_build_object('rev',rev,'reason',$3::text) FROM changed RETURNING id`,
    [rev, a.id, reason],
  );
  if (!rows.length)
    throw Error("Read the latest policy revision before rolling back.");
  invalidate();
}
