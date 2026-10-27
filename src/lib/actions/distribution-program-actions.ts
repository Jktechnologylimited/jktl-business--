"use server";
import { after } from "next/server";
import { flushProgramNotices } from "@/lib/distribution/notifications";
import { DEFAULT_TERMS } from "@/lib/affiliate-commission";
import { randomBytes } from "node:crypto";
import { requireSession } from "@/lib/session";
import { query, owner } from "@/lib/custom/service";
import { hashPassword } from "@/lib/db/auth";
import { rate } from "@/lib/support/service";
import { requireAdminCapability } from "@/lib/admin-session";
import { revalidatePath } from "next/cache";
export async function applyBusinessProgramAction(f: FormData) {
  const s = await requireSession();
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
  data.accountSource = "BUSINESS";
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
  after(async () => {
    try {
      await flushProgramNotices();
    } catch {}
  });
  revalidatePath("/business/distribution");
}
export async function manageProgramApplicationAction(f: FormData) {
  const a = await requireAdminCapability("manage_affiliates");
  const stage = String(f.get("stage")),
    note = String(f.get("note") || "").trim();
  if (
    !["UNDER_REVIEW", "REJECTED", "SUSPENDED", "TERMINATED"].includes(stage) ||
    note.length < 10 ||
    note.length > 2000
  )
    throw Error("Choose a stage and record a review reason");
  const r = await query(
    `WITH changed AS(UPDATE affiliates SET application_stage=$2,applicant_message=$5,status=CASE WHEN $2='UNDER_REVIEW' THEN 'pending' ELSE 'suspended' END WHERE id=$1 AND($2<>'UNDER_REVIEW' OR status='pending') RETURNING id) INSERT INTO distribution_audit(actor_id,event,affiliate_id,detail) SELECT $3,'APPLICATION_REVIEW',id,jsonb_build_object('stage',$2::text,'note',$4::text) FROM changed RETURNING id`,
    [
      String(f.get("id")),
      stage,
      a.id,
      note,
      String(f.get("applicantMessage") || "").slice(0, 2000),
    ],
  );
  if (!r.length) throw Error("Application unavailable");
  after(async () => {
    try {
      await flushProgramNotices();
    } catch {}
  });
  revalidatePath("/admin/distribution/applications");
}
export async function saveDistributionAssetAction(f: FormData) {
  const a = await requireAdminCapability("manage_team");
  await rate("resource-save:" + a.id, 30);
  const title = String(f.get("title") || "").trim(),
    description = String(f.get("description") || "").trim(),
    url = new URL(String(f.get("url"))),
    audience = String(f.get("audience")),
    kind = String(f.get("kind") || "LINK"),
    product = String(f.get("product") || "general"),
    copy = String(f.get("copy") || "").trim(),
    id = String(f.get("id") || "");
  if (
    title.length < 3 ||
    title.length > 160 ||
    description.length > 2000 ||
    url.href.length > 2000 ||
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !["AFFILIATE", "PARTNER", "BOTH"].includes(audience) ||
    !["LINK", "GRAPHIC", "SOCIAL", "DM", "EMAIL", "FOLLOW_UP"].includes(kind) ||
    ![
      "general",
      "website-builder",
      "templates",
      "domains",
      "business-email",
      "business-tools",
    ].includes(product) ||
    copy.length > 10000 ||
    f.get("approved") !== "on"
  )
    throw Error(
      "Provide an approved HTTPS resource, accurate copy and visibility",
    );
  const rows = id
    ? await query(
        `WITH changed AS(UPDATE distribution_assets SET title=$2,description=$3,url=$4,audience=$5,kind=$6,product=$7,copy=$8,featured=$9,archived=$10,enabled=CASE WHEN $10 THEN false ELSE enabled END WHERE id=$1 RETURNING id) INSERT INTO distribution_audit(actor_id,event,detail) SELECT $11,'MARKETING_ASSET_EDITED',jsonb_build_object('asset',id,'archived',$10::boolean) FROM changed RETURNING id`,
        [
          id,
          title,
          description,
          url.href,
          audience,
          kind,
          product,
          copy,
          f.get("featured") === "on",
          f.get("archived") === "on",
          a.id,
        ],
      )
    : await query(
        `WITH added AS(INSERT INTO distribution_assets(title,description,url,audience,created_by,kind,product,copy,featured) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id) INSERT INTO distribution_audit(actor_id,event,detail) SELECT $5,'MARKETING_ASSET_APPROVED',jsonb_build_object('asset',id,'url',$3::text) FROM added RETURNING id`,
        [
          title,
          description,
          url.href,
          audience,
          a.id,
          kind,
          product,
          copy,
          f.get("featured") === "on",
        ],
      );
  if (!rows.length) throw Error("Current approved resource required");
  revalidatePath("/admin/distribution/resources");
  revalidatePath("/affiliates/resources");
  revalidatePath("/partners/resources");
}
export async function createPartnerQuoteAction(f: FormData) {
  const a = await requireAdminCapability("manage_team");
  const amount = Number(f.get("amount")),
    scope = String(f.get("scope") || "").trim(),
    party = String(f.get("billingParty"));
  if (
    !Number.isSafeInteger(amount) ||
    amount < 1 ||
    amount > 2000000000 ||
    scope.length < 20 ||
    scope.length > 5000 ||
    !["CUSTOMER", "PARTNER"].includes(party) ||
    f.get("reviewed") !== "on"
  )
    throw Error("Review scope, licensing, pricing and billing responsibility");
  const result = await query(
    `WITH added AS(INSERT INTO partner_commercial_quotes(request_id,contract_id,amount_kobo,billing_party,scope,expires_at,created_by) SELECT r.id,c.id,$2,$3,$4,now()+interval '14 days',$5 FROM partner_service_requests r JOIN partner_client_access x ON x.id=r.relationship_id JOIN distribution_contracts c ON c.affiliate_id=x.partner_id WHERE r.id=$1 AND c.status='ACTIVE' AND c.model='RESELLER' AND EXISTS(SELECT 1 FROM affiliates a WHERE a.id=c.affiliate_id AND a.status='active' AND a.programme='partner' AND a.partner_terms_confirmed=true) AND x.revoked_at IS NULL RETURNING id) INSERT INTO distribution_audit(actor_id,event,detail) SELECT $5,'RESELLER_QUOTE_ISSUED',jsonb_build_object('quote',id,'amountKobo',$2::bigint,'billingParty',$3::text) FROM added RETURNING id`,
    [String(f.get("request")), amount, party, scope, a.id],
  );
  if (!result.length)
    throw Error(
      "Current approved reseller agreement and client permission required",
    );
  revalidatePath("/admin/distribution/quotes");
}
export async function acceptPartnerQuoteAction(f: FormData) {
  const s = await owner();
  if (f.get("consent") !== "on")
    throw Error("Accept the quote and billing responsibility");
  const r = await query(
    `WITH accepted AS(UPDATE partner_commercial_quotes q SET status='ACCEPTED',accepted_by=$2,billing_organization_id=$3,accepted_at=now() FROM partner_service_requests r,partner_client_access x,distribution_contracts c WHERE q.id=$1 AND q.status='OFFERED' AND q.expires_at>now() AND r.id=q.request_id AND x.id=r.relationship_id AND x.revoked_at IS NULL AND c.id=q.contract_id AND c.status='ACTIVE' AND c.model='RESELLER' AND EXISTS(SELECT 1 FROM affiliates a WHERE a.id=c.affiliate_id AND a.status='active' AND a.partner_terms_confirmed=true) AND(q.billing_party='CUSTOMER' AND x.organization_id=$3 OR q.billing_party='PARTNER' AND x.organization_id<>$3 AND EXISTS(SELECT 1 FROM distribution_account_links l WHERE l.user_id=$2 AND l.affiliate_id=x.partner_id)) RETURNING q.id) INSERT INTO distribution_audit(actor_id,event,detail) SELECT $2,'QUOTE_ACCEPTED',jsonb_build_object('quote',id,'billingOrganization',$3::uuid) FROM accepted RETURNING id`,
    [String(f.get("id")), s.userId, s.organizationId],
  );
  if (!r.length)
    throw Error(
      "Only the authorized billing business owner can accept a current quote",
    );
  after(async () => {
    try {
      await flushProgramNotices();
    } catch {}
  });
  revalidatePath("/business/distribution");
}
export async function completePartnerQuoteAction(f: FormData) {
  const a = await requireAdminCapability("manage_team");
  const proof = String(f.get("proof") || "").trim(),
    reference = String(f.get("paymentReference") || "").trim(),
    supplier = String(f.get("supplierReference") || "").trim(),
    raw = f.get("supplierCost"),
    cost = Number(raw);
  if (
    proof.length < 10 ||
    proof.length > 1000 ||
    reference.length < 5 ||
    reference.length > 200 ||
    supplier.length < 3 ||
    supplier.length > 200 ||
    raw === null ||
    String(raw).trim() === "" ||
    !Number.isSafeInteger(cost) ||
    cost < 0 ||
    f.get("confirmed") !== "on"
  )
    throw Error(
      "Record the actual verified JKTL payment, supplier cost and fulfillment reference",
    );
  const result = await query(
    `WITH proof AS(SELECT organization_id,amount_kobo,reference FROM domain_orders WHERE reference=$2 AND paid_at IS NOT NULL AND status IN('PAID','PROCESSING','ACTIVE') AND currency='NGN' AND refunded_kobo=0 UNION ALL SELECT organization_id,amount_kobo,reference FROM email_orders WHERE reference=$2 AND paid_at IS NOT NULL AND status IN('PAYMENT_CONFIRMED','AWAITING_DOMAIN_VERIFICATION','PENDING_SETUP','CONFIGURING','ACTIVE') UNION ALL SELECT organization_id,amount_kobo,reference FROM custom_invoices WHERE reference=$2 AND paid_at IS NOT NULL AND status='PAID'),completed AS(UPDATE partner_commercial_quotes q SET status='FULFILLED',fulfillment_reference=$3,payment_reference=$2,supplier_reference=$4,actual_supplier_cost_kobo=$5 FROM proof p WHERE q.id=$1 AND q.status='ACCEPTED' AND p.organization_id=q.billing_organization_id AND p.amount_kobo=q.amount_kobo AND $5<=q.amount_kobo AND NOT EXISTS(SELECT 1 FROM distribution_risk_state rs WHERE rs.reference=$2 AND rs.state<>'CLEARED') RETURNING q.id,q.amount_kobo) INSERT INTO distribution_audit(actor_id,event,detail) SELECT $6,'VERIFIED_RESELLER_QUOTE_FULFILLED',jsonb_build_object('quote',id,'payment',$2::text,'supplierReference',$4::text,'supplierCostKobo',$5::bigint,'marginKobo',amount_kobo-$5::bigint,'evidence',$3::text) FROM completed RETURNING id`,
    [String(f.get("id")), reference, proof, supplier, cost, a.id],
  );
  if (!result.length)
    throw Error(
      "A verified paid JKTL order or invoice for the exact billing business and quote amount is required. Use the existing approved product checkout/invoice workflow first.",
    );
  revalidatePath("/admin/distribution/quotes");
}

export async function toggleDistributionAssetAction(f: FormData) {
  const a = await requireAdminCapability("manage_team");
  await query(
    `WITH changed AS(UPDATE distribution_assets SET enabled=$2 WHERE id=$1 RETURNING id,enabled) INSERT INTO distribution_audit(actor_id,event,detail) SELECT $3,'MARKETING_ASSET_VISIBILITY',jsonb_build_object('asset',id,'enabled',enabled) FROM changed`,
    [String(f.get("id")), f.get("enabled") === "true", a.id],
  );
  revalidatePath("/admin/distribution/resources");
  revalidatePath("/partners/resources");
  revalidatePath("/affiliates/resources");
}

/** Real reseller checkout using the existing verified custom-invoice payment engine. */
export async function payPartnerQuoteAction(f: FormData) {
  const s = await owner();
  await rate("reseller-checkout:" + s.userId, 10);
  const id = String(f.get("id"));
  const rows = await query(
    `WITH eligible AS(SELECT q.* FROM partner_commercial_quotes q JOIN distribution_contracts c ON c.id=q.contract_id JOIN affiliates a ON a.id=c.affiliate_id JOIN partner_service_requests r ON r.id=q.request_id JOIN partner_client_access x ON x.id=r.relationship_id WHERE q.id=$1 AND q.status='ACCEPTED' AND q.billing_organization_id=$2 AND c.status='ACTIVE' AND c.model='RESELLER' AND a.status='active' AND a.partner_terms_confirmed=true AND x.revoked_at IS NULL FOR UPDATE OF q),client AS(INSERT INTO custom_clients(organization_id,user_id,pilot_ready) SELECT billing_organization_id,$3,true FROM eligible WHERE invoice_id IS NULL ON CONFLICT(organization_id) DO UPDATE SET organization_id=excluded.organization_id RETURNING organization_id),project AS(INSERT INTO custom_projects(organization_id,name,website_url,description,billing_only) SELECT c.organization_id,'Reseller service order','',e.scope,true FROM client c CROSS JOIN eligible e RETURNING id,organization_id),service AS(INSERT INTO custom_services(project_id,organization_id,name,category,description,amount_kobo,interval,starts_on,next_due_on,status,accepted_by,accepted_at) SELECT p.id,p.organization_id,'Accepted reseller quote','OTHER',e.scope,e.amount_kobo,'ONCE',(now() AT TIME ZONE 'Africa/Lagos')::date,(now() AT TIME ZONE 'Africa/Lagos')::date,'ACTIVE',$3,e.accepted_at FROM project p CROSS JOIN eligible e RETURNING *),invoice AS(INSERT INTO custom_invoices(service_id,organization_id,project_id,due_on,description,amount_kobo) SELECT id,organization_id,project_id,next_due_on,description,amount_kobo FROM service RETURNING id),attached AS(UPDATE partner_commercial_quotes q SET invoice_id=i.id FROM invoice i WHERE q.id=$1 RETURNING q.invoice_id),logged AS(INSERT INTO distribution_audit(actor_id,event,detail) SELECT $3,'RESELLER_INVOICE_CREATED',jsonb_build_object('quote',$1::uuid,'invoice',invoice_id) FROM attached RETURNING id) SELECT invoice_id FROM attached UNION ALL SELECT invoice_id FROM eligible WHERE invoice_id IS NOT NULL`,
    [id, s.organizationId, s.userId],
  );
  if (!rows.length)
    throw Error(
      "Current billing owner, accepted quote and client authorization required",
    );
  const { initializeInvoice } = await import("@/lib/custom/service");
  const url = await initializeInvoice(
    String(rows[0].invoice_id),
    s.organizationId,
    s.userId,
  );
  const { redirect } = await import("next/navigation");
  redirect(url);
}
export async function verifyPartnerQuotePaymentAction(f: FormData) {
  const s = await owner();
  await rate("reseller-verify:" + s.userId, 10);
  const rows = await query(
    `SELECT i.reference FROM partner_commercial_quotes q JOIN custom_invoices i ON i.id=q.invoice_id WHERE q.id=$1 AND q.billing_organization_id=$2 AND i.organization_id=$2`,
    [String(f.get("id")), s.organizationId],
  );
  if (!rows[0]?.reference)
    throw Error("No checkout reference is available for this quote");
  const { verifyInvoice } = await import("@/lib/custom/service");
  await verifyInvoice(String(rows[0].reference));
  revalidatePath("/business/distribution");
}
