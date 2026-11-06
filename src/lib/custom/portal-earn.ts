import "server-only";
import { query } from "./service";
import type { ProjectActor } from "./portal-access";
import { submitLinkedProgram } from "@/lib/distribution/program-enrollment";
import { verifyAffiliateLogin } from "@/lib/db/affiliate-auth";
import { getAffiliateBalance } from "@/lib/db/affiliates";
import { rate } from "@/lib/support/service";
async function owner(actor: ProjectActor) {
  if (
    !(
      await query(
        "SELECT 1 FROM organization_members m JOIN custom_projects p ON p.organization_id=m.organization_id WHERE p.id=$1 AND p.organization_id=$2 AND m.user_id=$3 AND m.role='owner' AND m.active=true",
        [actor.projectId, actor.organizationId, actor.userId],
      )
    ).length
  )
    throw Error("Only the current business owner can manage Earn.");
}
export async function projectEarn(actor: ProjectActor) {
  await owner(actor);
  const accounts = await query(
    `SELECT a.id,a.name,a.programme,a.status,a.application_stage,a.applicant_message,a.partner_terms_confirmed,a.commission_model,a.commission_bps,a.referral_code,COALESCE(x.state,'ACTIVE') AS activity_state FROM distribution_account_links l JOIN affiliates a ON a.id=l.affiliate_id AND a.programme=l.program LEFT JOIN affiliate_activity x ON x.affiliate_id=a.id WHERE l.user_id=$1 ORDER BY a.programme DESC`,
    [actor.userId],
  );
  const profiles = [];
  for (const a of accounts) {
    const contracts = await query(
      "SELECT id,status,model FROM distribution_contracts WHERE affiliate_id=$1 AND status IN('OFFERED','ACCEPTED','ACTIVE','SUSPENDED') ORDER BY activated_at DESC NULLS LAST,created_at DESC LIMIT 1",
      [a.id],
    );
    const contract = contracts[0];
    const ready =
      a.status === "active" &&
      (a.programme !== "partner" || a.partner_terms_confirmed === true) &&
      (a.programme !== "affiliate" || ["ACTIVE", "WARNED"].includes(String(a.activity_state))) &&
      (a.commission_model === "policy"
        ? contract?.status === "ACTIVE" && contract.model === "REFERRAL"
        : a.commission_model === "tiered" || (a.commission_model === "percentage" && Number(a.commission_bps) > 0));
    let balances;
    if (a.commission_model === "policy") {
      const totals = (
        await query(
          `SELECT (SELECT COALESCE(sum(amount_kobo),0) FROM distribution_ledger WHERE affiliate_id=$1 AND status IN('PENDING','UNDER_REVIEW','RESERVED')) AS pending_kobo,(SELECT GREATEST(0,COALESCE((SELECT sum(amount_kobo) FROM distribution_ledger WHERE affiliate_id=$1 AND status='AVAILABLE'),0)+COALESCE((SELECT sum(amount_kobo) FROM distribution_adjustments WHERE affiliate_id=$1 AND payout_id IS NULL),0))) AS available_kobo,(SELECT COALESCE(sum(amount_kobo),0) FROM distribution_payouts WHERE affiliate_id=$1 AND status='PAID') AS paid_kobo`,
          [a.id],
        )
      )[0];
      balances = {
        pendingKobo: Number(totals.pending_kobo),
        availableKobo: Number(totals.available_kobo),
        paidKobo: Number(totals.paid_kobo),
      };
    } else {
      const b = await getAffiliateBalance(String(a.id));
      balances = {
        pendingKobo: b.pendingKobo,
        availableKobo: b.balanceKobo,
        paidKobo: b.totalPaidOutKobo,
      };
    }
    const counts = (
      await query(
        "SELECT count(*)::int AS signups FROM affiliate_referrals WHERE affiliate_id=$1",
        [a.id],
      )
    )[0];
    profiles.push({
      program: a.programme,
      name: a.name,
      status: a.status,
      stage: a.application_stage,
      reviewMessage: a.applicant_message || "",
      ready,
      agreementStatus: contract?.status || null,
      referralUrl: ready
        ? "https://jktl.com.ng/?ref=" +
          encodeURIComponent(String(a.referral_code))
        : null,
      signups: Number(counts.signups),
      ...balances,
    });
  }
  const matching = await query(
    `SELECT a.programme,a.status FROM affiliates a JOIN users u ON lower(u.email)=lower(a.email) WHERE u.id=$1 AND NOT EXISTS(SELECT 1 FROM distribution_account_links l WHERE l.affiliate_id=a.id AND l.user_id=u.id)`,
    [actor.userId],
  );
  return {
    profiles,
    canApplyPartner:
      !accounts.some((a) => a.programme === "partner") &&
      !matching.some((a) => a.programme === "partner"),
    needsLink: matching.length > 0,
    projectId: actor.projectId,
  };
}
export async function applyProjectPartner(
  actor: ProjectActor,
  input: Record<string, unknown>,
) {
  await owner(actor);
  if (input.consent !== true)
    throw Error("Read and accept the programme application terms first.");
  const form = new FormData();
  form.set("program", "partner");
  form.set("consent", "on");
  for (const field of [
    "phone",
    "country",
    "company",
    "category",
    "services",
    "clients",
    "products",
    "monthlyReferrals",
    "partnership",
    "url",
  ]) {
    const value = input[field];
    if (value !== undefined && typeof value !== "string")
      throw Error("Enter valid partner application details.");
    form.set(field, String(value || ""));
  }
  await submitLinkedProgram(actor, form, { projectId: actor.projectId });
}
export async function connectProjectProgramme(
  actor: ProjectActor,
  input: { program: unknown; email: unknown; password: unknown },
) {
  await owner(actor);
  await rate("program-link:" + actor.userId, 10);
  if (
    !["partner", "affiliate"].includes(String(input.program)) ||
    typeof input.email !== "string" ||
    input.email.length > 254 ||
    typeof input.password !== "string" ||
    Buffer.byteLength(input.password) > 72
  )
    throw Error("Enter the existing programme account credentials.");
  const login = await verifyAffiliateLogin(
    input.email.trim().toLowerCase(),
    input.password,
    input.program as "partner" | "affiliate",
  );
  if (!login.ok)
    throw Error("Approved programme account credentials required.");
  const a = login.affiliate;
  const rows = await query(
    `WITH linked AS(INSERT INTO distribution_account_links(user_id,affiliate_id,program) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING *) INSERT INTO distribution_audit(actor_id,event,affiliate_id,detail) SELECT $1,'CUSTOM_PROJECT_PROGRAM_LINKED',affiliate_id,jsonb_build_object('projectId',$4::uuid,'program',program) FROM linked RETURNING id`,
    [actor.userId, a.id, a.programme || String(input.program), actor.projectId],
  );
  if (
    !rows.length &&
    !(
      await query(
        "SELECT 1 FROM distribution_account_links WHERE user_id=$1 AND affiliate_id=$2 AND program=$3",
        [actor.userId, a.id, a.programme || String(input.program)],
      )
    ).length
  )
    throw Error(
      "This programme account is already linked to another Business identity. Contact JKTL support.",
    );
}
