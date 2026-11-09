"use server";
import { randomUUID } from "node:crypto";
import { authRateLimit } from "@/lib/security/auth-rate-limit";
import { requireAdminCapability } from "@/lib/admin-session";
import { query } from "@/lib/custom/service";
import { revalidatePath, revalidateTag } from "next/cache";
import {
  moneyInput,
  financialDay,
  convertMinor,
} from "@/lib/company-finance/model";
import { verifyTransaction } from "@/lib/paystack";
import { recordVerifiedMerchantPayment } from "@/lib/company-finance/payments";
function invalidate() {
  revalidatePath("/admin/insights");
  revalidateTag("company-insights", { expire: 0 });
}
async function actor() {
  const a = await requireAdminCapability("manage_company_finance");
  await authRateLimit(a.id, "company-finance", 60, 3600);
  return a;
}
function text(v: unknown, min = 5, max = 1000) {
  const s = String(v || "").trim();
  if (s.length < min || s.length > max)
    throw Error("Provide a valid evidence reference or description.");
  return s;
}
function uuid(v: unknown) {
  const s = String(v || "");
  if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(s))
    throw Error("Choose a valid financial record.");
  return s;
}
export async function recordCompanyCostsAction(form: FormData) {
  const a = await actor();
  const raw = String(form.get("rows") || "");
  if (raw.length > 200000) throw Error("Use an import of at most 200 rows.");
  const input = raw ? JSON.parse(raw) : [Object.fromEntries(form.entries())];
  if (!Array.isArray(input) || !input.length || input.length > 200)
    throw Error("Use between 1 and 200 cost rows.");
  const rows = input.map((r: Record<string, unknown>) => {
    const amount = moneyInput(String(r.amount || "")),
      currency = String(r.currency || "NGN").toUpperCase(),
      rate = String(r.fx_rate || "");
    if (!["NGN", "USD", "GBP", "EUR"].includes(currency))
      throw Error("Use a supported currency: NGN, USD, GBP or EUR.");
    if (
      currency !== "NGN" &&
      (!/^\d{1,10}(?:\.\d{1,8})?$/.test(rate) || Number(rate) <= 0)
    )
      throw Error("Provide an explicit NGN exchange rate for foreign costs.");
    const kobo = currency === "NGN" ? amount : convertMinor(amount, rate);
    if (!Number.isSafeInteger(kobo) || kobo <= 0 || kobo > 200000000000)
      throw Error("Use a valid converted cost amount.");
    const category = String(r.category_id || "");
    if (!/^[a-z][a-z0-9_-]{1,49}$/.test(category))
      throw Error("Choose a valid company cost category.");
    return {
      id: randomUUID(),
      category_id: category,
      incurred_on: financialDay(r.incurred_on),
      amount_minor: amount,
      currency,
      ngn_kobo: kobo,
      fx_rate: currency === "NGN" ? null : rate,
      economic_key: text(r.economic_key, 5, 200),
      evidence: text(r.evidence),
    };
  });
  if (new Set(rows.map((r) => r.economic_key)).size !== rows.length)
    throw Error("Check duplicate supplier references in this import.");
  const inserted = await query(
    `WITH incoming AS(SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(id uuid,category_id text,incurred_on date,amount_minor bigint,currency text,ngn_kobo bigint,fx_rate numeric,economic_key text,evidence text)),valid AS(
 SELECT x.*,c.classification FROM incoming x JOIN company_cost_categories c ON c.id=x.category_id AND c.enabled
 WHERE NOT EXISTS(SELECT 1 FROM growth_acquisition_costs g WHERE g.voided_at IS NULL AND g.evidence=x.economic_key)
 AND NOT EXISTS(SELECT 1 FROM distribution_payouts p WHERE p.status='PAID' AND p.bank_reference=x.economic_key)
 AND NOT EXISTS(SELECT 1 FROM distribution_product_costs k WHERE k.supplier_reference=x.economic_key)
 AND NOT EXISTS(SELECT 1 FROM merchant_payments m WHERE x.category_id='processor' AND x.economic_key IN(m.reference,m.provider_transaction,'processor:'||m.reference))
 ),added AS(INSERT INTO company_cost_entries(id,category_id,incurred_on,amount_minor,currency,ngn_kobo,fx_rate,economic_key,evidence,created_by,classification)
 SELECT id,category_id,incurred_on,amount_minor,currency,ngn_kobo,fx_rate,economic_key,evidence,$2,classification FROM valid WHERE (SELECT count(*) FROM valid)=(SELECT count(*) FROM incoming) ON CONFLICT(economic_key) DO NOTHING RETURNING *)
 INSERT INTO company_finance_audit(actor_id,event,detail) SELECT $2,'COMPANY_COST_RECORDED',jsonb_build_object('cost',id,'economicKey',economic_key,'ngnKobo',ngn_kobo) FROM added RETURNING id`,
    [JSON.stringify(rows), a.id],
  );
  if (!inserted.length)
    throw Error(
      "Check categories and supplier references. These costs may already be recorded or use a reserved provider reference.",
    );
  invalidate();
}
export async function reverseCompanyCostAction(form: FormData) {
  const a = await actor(),
    id = uuid(form.get("id")),
    reason = text(form.get("reason"), 10);
  await query(
    `WITH reversed AS(INSERT INTO company_cost_entries(category_id,incurred_on,amount_minor,currency,ngn_kobo,fx_rate,economic_key,evidence,reverses_id,created_by,classification)
 SELECT category_id,incurred_on,-amount_minor,currency,-ngn_kobo,fx_rate,'reversal:'||id::text,$2,id,$3,classification FROM company_cost_entries WHERE id=$1 AND reverses_id IS NULL ON CONFLICT DO NOTHING RETURNING id)
 INSERT INTO company_finance_audit(actor_id,event,detail) SELECT $3,'COMPANY_COST_REVERSED',jsonb_build_object('cost',$1::uuid,'reversal',id,'reason',$2::text) FROM reversed`,
    [id, reason, a.id],
  );
  invalidate();
}
export async function saveCostCategoryAction(form: FormData) {
  const a = await actor(),
    id = String(form.get("id") || ""),
    name = text(form.get("name"), 2, 100),
    classification = String(form.get("classification") || "");
  if (
    !/^[a-z][a-z0-9_-]{1,49}$/.test(id) ||
    !["DIRECT", "OPEX", "TAX"].includes(classification)
  )
    throw Error("Choose a valid category identifier and classification.");
  await query(
    `WITH saved AS(INSERT INTO company_cost_categories(id,name,classification,enabled) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET name=excluded.name,classification=excluded.classification,enabled=excluded.enabled RETURNING id) INSERT INTO company_finance_audit(actor_id,event,detail) SELECT $5,'COMPANY_COST_CATEGORY_SAVED',jsonb_build_object('category',id,'classification',$3::text) FROM saved`,
    [id, name, classification, form.get("enabled") === "on", a.id],
  );
  invalidate();
}
export async function attestFinancePeriodAction(form: FormData) {
  const a = await actor(),
    from = financialDay(form.get("from")),
    to = financialDay(form.get("to")),
    evidence = text(form.get("evidence"), 10),
    rev = Number(form.get("rev") || 0);
  if (
    from > to ||
    to >
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Lagos",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()) ||
    !Number.isSafeInteger(rev) ||
    rev < 0
  )
    throw Error("Choose a valid completed reporting range.");
  const saved = await query(
    `WITH saved AS(INSERT INTO company_finance_periods(from_day,to_day,revenue_complete,direct_complete,opex_complete,tax_complete,evidence,verified_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(from_day,to_day) DO UPDATE SET revenue_complete=excluded.revenue_complete,direct_complete=excluded.direct_complete,opex_complete=excluded.opex_complete,tax_complete=excluded.tax_complete,evidence=excluded.evidence,verified_by=excluded.verified_by,verified_at=now(),rev=company_finance_periods.rev+1 WHERE company_finance_periods.rev=$9 RETURNING rev) INSERT INTO company_finance_audit(actor_id,event,detail) SELECT $8,'PERIOD_COVERAGE_VERIFIED',jsonb_build_object('from',$1::date,'to',$2::date,'rev',rev,'evidence',$7::text) FROM saved RETURNING id`,
    [
      from,
      to,
      form.get("revenue_complete") === "on",
      form.get("direct_complete") === "on",
      form.get("opex_complete") === "on",
      form.get("tax_complete") === "on",
      evidence,
      a.id,
      rev,
    ],
  );
  if (!saved.length)
    throw Error(
      "Read the latest period status before saving; another financial change requires review.",
    );
  invalidate();
}
export async function reconcileMerchantPaymentAction(form: FormData) {
  const a = await actor(),
    ref = text(form.get("reference"), 4, 160);
  if (!/^[a-z0-9_-]+$/i.test(ref))
    throw Error("Verify the provider reference.");
  const payment = (
    await query(
      "SELECT reference FROM merchant_payment_attempts WHERE reference=$1 UNION SELECT reference FROM merchant_payments WHERE reference=$1 UNION SELECT payment_reference reference FROM invoices WHERE payment_reference=$1 AND paid_via='online' UNION SELECT reference FROM merchant_reconciliation_issues WHERE reference=$1",
      [ref],
    )
  )[0];
  if (!payment) throw Error("Verify a recorded merchant payment reference.");
  const d = await verifyTransaction(ref);
  if (d.reference !== ref) throw Error("Verify the exact provider reference.");
  if (d.status === "success") {
    await recordVerifiedMerchantPayment(
      d as unknown as Record<string, unknown>,
    );
    await query(
      "UPDATE merchant_reconciliation_issues SET resolved_at=now() WHERE reference=$1",
      [ref],
    );
  } else if (d.status === "failed")
    await query(
      "UPDATE merchant_payment_attempts SET state='FAILED',updated_at=now() WHERE reference=$1 AND state<>'SUCCESS'",
      [ref],
    );
  else throw Error("Payment is still uncertain. Do not start another charge.");
  await query(
    "INSERT INTO company_finance_audit(actor_id,event,detail) VALUES($1,'MERCHANT_PAYMENT_REVERIFIED',jsonb_build_object('reference',$2::text))",
    [a.id, ref],
  );
  invalidate();
}
export async function reconcileMerchantFeeAction(form: FormData) {
  const a = await actor(),
    ref = text(form.get("reference"), 4, 160),
    evidence = text(form.get("evidence"), 10),
    reversed = String(form.get("reversal") || "0");
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(reversed))
    throw Error(
      "Use the confirmed fee reversal amount, including zero only when supported by evidence.",
    );
  const kobo = Math.round(Number(reversed) * 100),
    key = uuid(form.get("request_id"));
  await query(
    `WITH locked AS(SELECT * FROM merchant_payments WHERE reference=$1 FOR UPDATE),adjust AS(INSERT INTO merchant_payment_events(event_key,reference,kind,fee_delta_kobo,evidence,actor_id) SELECT $2||':adjust',reference,'FEE_ADJUSTMENT',-$3,$4,$5 FROM locked WHERE $3>0 ON CONFLICT DO NOTHING RETURNING event_key),split_proof AS(INSERT INTO merchant_payment_events(event_key,reference,kind,evidence,actor_id) SELECT $2||':split',reference,'SPLIT_CONFIRMED',$4,$5 FROM locked WHERE $6::boolean ON CONFLICT DO NOTHING RETURNING event_key),done AS(INSERT INTO merchant_payment_events(event_key,reference,kind,evidence,actor_id) SELECT $2,reference,'RECONCILED',$4,$5 FROM locked ON CONFLICT DO NOTHING RETURNING event_key) INSERT INTO company_finance_audit(actor_id,event,detail) SELECT $5,'MERCHANT_FEE_RECONCILED',jsonb_build_object('reference',$1::text,'event',event_key,'feeReversalKobo',$3::bigint) FROM done`,
    [ref, key, kobo, evidence, a.id, form.get("split_confirmed") === "on"],
  );
  invalidate();
}

export async function configureFinanceAnalystAction(form: FormData) {
  const a = await actor(),
    id = uuid(form.get("id")),
    enabled = form.get("enabled") === "on";
  await query(
    `WITH changed AS(UPDATE admin_users SET permission_overrides=COALESCE(permission_overrides,'{}'::jsonb)||jsonb_build_object('view_company_finance',$2::boolean) WHERE id=$1 AND role='analyst' AND disabled_at IS NULL RETURNING id) INSERT INTO company_finance_audit(actor_id,event,detail) SELECT $3,'FINANCE_ANALYST_ACCESS_CHANGED',jsonb_build_object('member',id,'enabled',$2::boolean) FROM changed`,
    [id, enabled, a.id],
  );
  revalidatePath("/admin/team");
  invalidate();
}
export async function saveGrowthCampaignAction(form: FormData) {
  const a = await actor(),
    id = String(form.get("id") || ""),
    name = text(form.get("name"), 2, 100),
    source = String(form.get("utm_source") || ""),
    medium = String(form.get("utm_medium") || ""),
    campaign = String(form.get("utm_campaign") || "");
  if (
    !/^[a-z0-9][a-z0-9_-]{1,79}$/.test(id) ||
    [source, medium, campaign].some((v) => !/^[a-zA-Z0-9_. -]{1,80}$/.test(v))
  )
    throw Error("Use approved campaign labels without personal information.");
  await query(
    `WITH saved AS(INSERT INTO growth_campaigns(id,name,utm_source,utm_medium,utm_campaign,enabled) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET name=excluded.name,enabled=excluded.enabled WHERE growth_campaigns.utm_source=excluded.utm_source AND growth_campaigns.utm_medium=excluded.utm_medium AND growth_campaigns.utm_campaign=excluded.utm_campaign RETURNING id) INSERT INTO company_finance_audit(actor_id,event,detail) SELECT $7,'GROWTH_CAMPAIGN_CONFIGURED',jsonb_build_object('campaign',id) FROM saved`,
    [id, name, source, medium, campaign, form.get("enabled") === "on", a.id],
  );
  invalidate();
}

/** Draft only: does not alter invoice pricing or enable a website checkout. */
export async function saveWebsiteFeeDraftAction(form: FormData) {
  const a = await actor();
  const type = String(form.get("fee_type") || ""),
    bearer = String(form.get("fee_bearer") || ""),
    raw = String(form.get("amount") || "");
  if (
    !["FIXED", "PERCENTAGE"].includes(type) ||
    !["PAYER", "MERCHANT"].includes(bearer)
  )
    throw Error("Choose a proposed fee method and payer.");
  const value = moneyInput(raw);
  if (type === "PERCENTAGE" && value > 10000)
    throw Error("Use a proposed percentage no higher than 100.");
  const evidence = text(form.get("evidence"), 10);
  await query(
    `WITH saved AS(INSERT INTO company_fee_policy_drafts(source,fee_type,fee_value,fee_bearer,evidence,updated_by) VALUES('WEBSITE',$1,$2,$3,$4,$5) ON CONFLICT(source) DO UPDATE SET fee_type=excluded.fee_type,fee_value=excluded.fee_value,fee_bearer=excluded.fee_bearer,evidence=excluded.evidence,updated_by=excluded.updated_by,updated_at=now() RETURNING source) INSERT INTO company_finance_audit(actor_id,event,detail) SELECT $5,'INACTIVE_WEBSITE_FEE_DRAFT_SAVED',jsonb_build_object('source',source,'feeType',$1::text,'value',$2::bigint,'bearer',$3::text,'enabled',false) FROM saved`,
    [type, value, bearer, evidence, a.id],
  );
  invalidate();
}
