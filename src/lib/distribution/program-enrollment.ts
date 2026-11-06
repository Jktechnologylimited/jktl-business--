import "server-only";
import { DEFAULT_TERMS } from "@/lib/affiliate-commission";
import { randomBytes } from "node:crypto";
import { query } from "@/lib/custom/service";
import { hashPassword } from "@/lib/db/auth";
import { rate } from "@/lib/support/service";
/** Authenticated caller identities only; never exported as a browser server action. */
export async function submitLinkedProgram(
  s: { userId: string },
  f: FormData,
  source: { projectId?: string } = {},
) {
  await rate("program-apply:" + s.userId, 3);
  const program = String(f.get("program"));
  if (!["affiliate", "partner"].includes(program) || f.get("consent") !== "on")
    throw Error("Choose a programme and accept its current terms");
  const user = (
    await query("SELECT name,email FROM users WHERE id=$1", [s.userId])
  )[0];
  if (!user) throw Error("Business account required");
  const fields = [
    "phone",
    "country",
    "platform",
    "url",
    "audience",
    "promotion",
    "company",
    "category",
    "services",
    "clients",
    "products",
    "monthlyReferrals",
    "partnership",
    "verification",
  ];
  const data: Record<string, string> = {};
  for (const field of fields) {
    const value = String(f.get(field) || "").trim();
    if (value.length > 2000) throw Error("Please shorten " + field);
    data[field] = value;
  }
  data.accountSource = source.projectId ? "CUSTOM_PROJECT" : "BUSINESS";
  if (source.projectId) data.customProjectId = source.projectId;
  if (
    !data.phone ||
    !data.country ||
    (program === "affiliate" && (!data.platform || !data.promotion)) ||
    (program === "partner" &&
      (!data.company || !data.category || !data.partnership))
  )
    throw Error("Complete the required programme fields");
  if (data.url && !/^https:\/\/[^\s]+$/.test(data.url))
    throw Error("Use an HTTPS website or social profile URL");
  const existing = await query(
    "SELECT a.id,a.programme,EXISTS(SELECT 1 FROM distribution_account_links l WHERE l.affiliate_id=a.id AND l.user_id=$2) AS owned FROM affiliates a WHERE lower(a.email)=lower($1)",
    [user.email, s.userId],
  );
  if (existing.some((a) => a.programme === program))
    throw Error(
      "An application or account already exists for this program. Open or connect it instead.",
    );
  if (existing.some((a) => !a.owned))
    throw Error(
      "Connect your existing approved program account before applying for another program. Matching email alone does not prove ownership.",
    );
  const password = await hashPassword(randomBytes(40).toString("hex"));
  const r = await query(
    `WITH added AS(INSERT INTO affiliates(name,email,password_hash,referral_code,status,programme,application_note,application_data,application_stage,commission_bps,commission_model,signup_bonus_kobo,subscription_bonus_kobo,recurring_monthly_kobo) VALUES($1,$2,$3,$4,'pending',$5,$6,$7::jsonb,'PENDING',CASE WHEN $5='partner' THEN 0 ELSE 2000 END,CASE WHEN $5='partner' THEN 'percentage' ELSE 'tiered' END,CASE WHEN $5='partner' THEN 0 ELSE ${DEFAULT_TERMS.signupBonusKobo} END,CASE WHEN $5='partner' THEN 0 ELSE ${DEFAULT_TERMS.subscriptionBonusKobo} END,CASE WHEN $5='partner' THEN 0 ELSE ${DEFAULT_TERMS.recurringMonthlyKobo} END) RETURNING id),linked AS(INSERT INTO distribution_account_links(user_id,affiliate_id,program) SELECT $8,id,$5 FROM added RETURNING affiliate_id) INSERT INTO distribution_audit(actor_id,event,affiliate_id,detail) SELECT $8,'BUSINESS_PROGRAM_APPLICATION',affiliate_id,jsonb_build_object('program',$5::text,'terms','current-public-offer','acceptedAt',now()) FROM linked RETURNING id`,
    [
      user.name,
      String(user.email).toLowerCase(),
      password,
      randomBytes(6).toString("hex").toUpperCase(),
      program,
      data.promotion || data.partnership,
      JSON.stringify(data),
      s.userId,
    ],
  );
  if (!r.length) throw Error("Could not save application");
}
