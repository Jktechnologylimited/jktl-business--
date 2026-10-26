"use server";
import { query, growth, audit, field, uuid } from "@/lib/growth/service";
import { parsePublication } from "@/lib/publications";
import { redact } from "@/lib/support/model";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { flushProgramNotices } from "@/lib/distribution/notifications";
function categoryPermission(category: string) {
  if (category === "games") return "growth_games" as const;
  if (category === "community") return "growth_community" as const;
  return "growth_marketing" as const;
}
export async function saveGrowthDraftAction(f: FormData) {
  const category = field(f, "category", 20);
  if (
    !["marketing", "social", "games", "community", "landing"].includes(category)
  )
    throw Error("Choose a content category");
  const a = await growth(categoryPermission(category));
  const p = parsePublication({
    id: String(f.get("id") || ""),
    revision: Number(f.get("revision") || 0),
    slug: field(f, "slug", 100),
    kind: field(f, "kind", 20),
    title: field(f, "title", 180),
    excerpt: field(f, "excerpt", 400),
    body: field(f, "body", 60000),
    coverImage: String(f.get("coverImage") || ""),
    author: "JKTL",
    status: "draft",
  });
  if (p.id) {
    const old = (
      await query(
        "SELECT growth_category FROM jktl_publications WHERE id=$1 AND created_by=$2",
        [p.id, a.id],
      )
    )[0];
    if (!old) throw Error("Only your own drafts can be edited");
    await growth(categoryPermission(String(old.growth_category)));
  }
  let link = String(f.get("link") || "").trim();
  if (link) {
    const url = new URL(link);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      ![
        "jktl.com.ng",
        "www.jktl.com.ng",
        "business.jktl.com.ng",
        "games.jktl.com.ng",
        "fantasy.jktl.com.ng",
      ].includes(url.hostname)
    )
      throw Error("Use an approved JKTL HTTPS destination");
    url.searchParams.set("utm_source", "jktl-growth");
    url.searchParams.set("utm_medium", category);
    url.searchParams.set("utm_campaign", p.slug);
    link = url.href;
    if (link.length > 2000) throw Error("Check link");
  }
  const values = [
    p.slug,
    p.kind,
    p.title,
    p.excerpt,
    p.body,
    p.coverImage,
    a.id,
    category,
    link,
  ];
  const rows = p.id
    ? await query(
        `UPDATE jktl_publications SET title=$3,excerpt=$4,body=$5,cover_image=$6,updated_by=$7,growth_category=$8,growth_link=$9,growth_approved_revision=NULL,growth_approved_by=NULL,revision=revision+1,updated_at=now() WHERE id=$10 AND created_by=$7 AND status='draft' AND revision=$11 AND slug=$1 AND kind=$2 RETURNING id`,
        [...values, p.id, p.revision],
      )
    : await query(
        `INSERT INTO jktl_publications(slug,kind,title,excerpt,body,cover_image,author,status,created_by,updated_by,growth_category,growth_link) VALUES($1,$2,$3,$4,$5,$6,'JKTL','draft',$7,$7,$8,$9) ON CONFLICT(slug) DO NOTHING RETURNING id`,
        values,
      );
  if (!rows.length)
    throw Error(
      "Only your current unpublished draft can be edited; reload or use another slug",
    );
  await audit(a.id, "GROWTH_DRAFT_SAVED", String(rows[0].id), { category });
  revalidatePath("/admin/growth/content");
}
export async function approveGrowthDraftAction(f: FormData) {
  const a = await growth("manage_team");
  if (f.get("approved") !== "on")
    throw Error("Confirm review of the exact content");
  const rows = await query(
    `UPDATE jktl_publications SET growth_approved_revision=revision,growth_approved_by=$2 WHERE id=$1 AND status='draft' AND growth_category IS NOT NULL AND revision=$3 AND body IS NOT NULL AND length(body)>=50 RETURNING id,revision`,
    [uuid(f.get("id")), a.id, Number(f.get("revision"))],
  );
  if (!rows.length) throw Error("Check the current draft revision and content");
  await audit(a.id, "GROWTH_PUBLICATION_APPROVED", String(rows[0].id), {
    revision: rows[0].revision,
  });
  revalidatePath("/admin/growth/content");
}
export async function publishGrowthDraftAction(f: FormData) {
  const a = await growth("growth_publish_approved");
  const candidate = (
    await query("SELECT growth_category FROM jktl_publications WHERE id=$1", [
      uuid(f.get("id")),
    ])
  )[0];
  if (!candidate) throw Error("Invalid draft");
  await growth(categoryPermission(String(candidate.growth_category)));
  const rows = await query(
    `UPDATE jktl_publications SET status='published',published_at=now(),updated_at=now(),updated_by=$2,revision=revision+1 WHERE id=$1 AND created_by=$2 AND status='draft' AND revision=$3 AND growth_approved_revision=revision AND growth_approved_by IS NOT NULL AND length(body)>=50 RETURNING id,slug,kind`,
    [String(f.get("id")), a.id, Number(f.get("revision"))],
  );
  if (!rows.length)
    throw Error(
      "Only your exact Owner-approved current draft can be published",
    );
  await audit(a.id, "GROWTH_PUBLICATION_PUBLISHED", String(rows[0].id));
  revalidatePath("/admin/growth/content");
  revalidatePath("/api/publications");
}
export async function createGrowthLeadAction(f: FormData) {
  const a = await growth("growth_leads");
  const email = String(f.get("email") || "").trim(),
    phone = String(f.get("phone") || "").trim();
  if (
    email.length > 254 ||
    (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
    phone.length > 40
  )
    throw Error("Check contact details");
  const rows = await query(
    `INSERT INTO prospects(source,business_name,email,phone,city,assigned_staff_id) VALUES('manual',$1,$2,$3,$4,$5) RETURNING id`,
    [
      field(f, "name", 160),
      email,
      phone,
      String(f.get("city") || "").slice(0, 100),
      a.id,
    ],
  );
  await audit(a.id, "GROWTH_LEAD_CREATED", String(rows[0].id));
  revalidatePath("/admin/growth/leads");
}
export async function updateGrowthLeadAction(f: FormData) {
  const a = await growth("growth_leads"),
    status = field(f, "status", 20);
  if (
    !["new", "qualified", "rejected", "contacted", "replied"].includes(status)
  )
    throw Error(
      "Choose a supported outreach status. Paid conversions come from verified payments.",
    );
  const note = redact(field(f, "note"));
  const rows = await query(
    `WITH changed AS(UPDATE prospects SET status=$3 WHERE id=$1 AND(assigned_staff_id=$2 OR $4=true) AND suppressed=false RETURNING id) INSERT INTO distribution_audit(actor_id,event,detail) SELECT $2,'GROWTH_OUTREACH_RECORDED',jsonb_build_object('target',id,'status',$3::text,'note',$5::text) FROM changed RETURNING id`,
    [uuid(f.get("id")), a.id, status, a.role === "owner", note],
  );
  if (!rows.length)
    throw Error("Only an assigned, unsuppressed lead can be updated");
  revalidatePath("/admin/growth/leads");
}
export async function reviewGrowthApplicationAction(f: FormData) {
  const a = await growth("growth_applications"),
    recommendation = field(f, "recommendation", 10);
  if (!["REVIEW", "APPROVE", "REJECT"].includes(recommendation))
    throw Error("Choose a recommendation");
  const message = redact(String(f.get("message") || "").trim());
  if (message.length > 2000) throw Error("Check applicant message");
  const id = uuid(f.get("id")),
    note = redact(field(f, "note"));
  const r = await query(
    `WITH reviewed AS(INSERT INTO growth_application_reviews(affiliate_id,reviewer_id,recommendation,note,applicant_message) SELECT id,$2,$3,$4,$5 FROM affiliates WHERE id=$1 AND status='pending' RETURNING id,affiliate_id),notice AS(INSERT INTO distribution_program_notices(event_key,affiliate_id,subject,detail,path) SELECT 'growth-review-'||r.id,r.affiliate_id,'JKTL application message',$5,CASE WHEN a.programme='partner' THEN '/partners' ELSE '/affiliates' END FROM reviewed r JOIN affiliates a ON a.id=r.affiliate_id WHERE length($5)>0 RETURNING id) INSERT INTO distribution_audit(actor_id,event,affiliate_id,detail) SELECT $2,'GROWTH_APPLICANT_REVIEW',affiliate_id,jsonb_build_object('recommendation',$3::text,'review',id) FROM reviewed RETURNING id`,
    [id, a.id, recommendation, note, message],
  );
  if (!r.length) throw Error("Application is no longer pending");
  after(async () => {
    try {
      await flushProgramNotices();
    } catch {}
  });
  revalidatePath("/admin/growth/applications");
}
export async function saveGrowthResourceAction(f: FormData) {
  const a = await growth("growth_resources");
  const url = new URL(field(f, "url", 2000));
  if (url.protocol !== "https:" || url.username || url.password)
    throw Error("Use an HTTPS resource URL");
  const audience = field(f, "audience", 10);
  if (!["AFFILIATE", "PARTNER", "BOTH"].includes(audience))
    throw Error("Choose visibility");
  const rows = await query(
    `INSERT INTO distribution_assets(title,description,url,audience,created_by,enabled) VALUES($1,$2,$3,$4,$5,false) RETURNING id`,
    [field(f, "title", 160), field(f, "description"), url.href, audience, a.id],
  );
  await audit(a.id, "GROWTH_RESOURCE_SUBMITTED", String(rows[0].id));
  revalidatePath("/admin/growth/resources");
}
