"use server";
import { member, query, rate } from "@/lib/support/service";
import { requireAdminCapability } from "@/lib/admin-session";
import { id, text, publicError } from "@/lib/support/model";
export async function reviewHomeAction() {
  const s = await member(true);
  const eligibility = (
    await query(
      `SELECT p.published,(o.created_at<now()-interval '7 days') AS established,EXISTS(SELECT 1 FROM domain_orders d WHERE d.organization_id=$1 AND d.kind='REGISTER' AND d.status='ACTIVE' AND d.paid_at IS NOT NULL) AS domain,NOT EXISTS(SELECT 1 FROM business_reviews r WHERE r.organization_id=$1 AND r.user_id=$2 AND r.created_at>now()-interval '90 days') AS submission_due,NOT EXISTS(SELECT 1 FROM review_prompt_state q WHERE q.organization_id=$1 AND q.user_id=$2 AND(q.last_prompted_at>now()-interval '45 days' OR q.dismissed_until>now())) AS prompt_due FROM business_profiles p JOIN organizations o ON o.id=p.organization_id WHERE p.organization_id=$1`,
      [s.organizationId, s.userId],
    )
  )[0];
  return {
    eligible: Boolean(
      eligibility &&
      (eligibility.published ||
        eligibility.domain ||
        eligibility.established) &&
      eligibility.submission_due &&
      eligibility.prompt_due,
    ),
    milestone: eligibility?.domain
      ? "domain"
      : eligibility?.published
        ? "website"
        : "customer",
    reviews: await query(
      "SELECT id,rating,quote,public_consent,status,created_at FROM business_reviews WHERE organization_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 20",
      [s.organizationId, s.userId],
    ),
  };
}
async function reviewPromptActionCore(dismiss = false) {
  const s = await member(true);
  await query(
    `INSERT INTO review_prompt_state(organization_id,user_id,last_prompted_at,dismissed_until) VALUES($1,$2,now(),CASE WHEN $3 THEN now()+interval '45 days' ELSE NULL END) ON CONFLICT(organization_id,user_id) DO UPDATE SET last_prompted_at=now(),dismissed_until=CASE WHEN $3 THEN now()+interval '45 days' ELSE review_prompt_state.dismissed_until END`,
    [s.organizationId, s.userId, dismiss],
  );
  return { ok: true as const };
}
async function submitBusinessReviewActionCore(input: {
  rating: number;
  quote: string;
  displayName: string;
  publicConsent: boolean;
}) {
  const s = await member(true);
  await rate("review:" + s.userId, 5);
  if (
    !Number.isInteger(input.rating) ||
    input.rating < 1 ||
    input.rating > 5 ||
    typeof input.publicConsent !== "boolean"
  )
    throw Error("Choose a rating and publication preference.");
  const quote = text(input.quote, 1500, 20),
    display = text(input.displayName, 100, 2);
  const row = await query(
    `WITH guard AS(INSERT INTO review_submission_windows(organization_id,user_id,next_allowed_at) VALUES($1,$2,now()+interval '90 days') ON CONFLICT(organization_id,user_id) DO UPDATE SET next_allowed_at=excluded.next_allowed_at WHERE review_submission_windows.next_allowed_at<=now() RETURNING organization_id),eligible AS(SELECT p.display_name,EXISTS(SELECT 1 FROM domain_orders WHERE organization_id=$1 AND kind='REGISTER' AND status='ACTIVE' AND paid_at IS NOT NULL) AS domain,p.published FROM business_profiles p CROSS JOIN guard WHERE p.organization_id=$1 AND NOT EXISTS(SELECT 1 FROM business_reviews WHERE organization_id=$1 AND user_id=$2 AND created_at>now()-interval '90 days')),inserted AS(INSERT INTO business_reviews(organization_id,user_id,rating,quote,display_name,company,public_consent,milestone) SELECT $1,$2,$3,$4,$5,display_name,$6,CASE WHEN domain THEN 'domain' WHEN published THEN 'website' ELSE 'customer' END FROM eligible RETURNING *) INSERT INTO review_audit(review_id,actor_id,event) SELECT id,$2,'SUBMITTED' FROM inserted RETURNING id`,
    [
      s.organizationId,
      s.userId,
      input.rating,
      quote,
      display,
      input.publicConsent,
    ],
  );
  if (!row.length)
    throw Error(
      "Your feedback is already saved. You can submit another review after 90 days.",
    );
  return { ok: true as const };
}
async function withdrawBusinessReviewActionCore(reviewId: string) {
  const s = await member(true);
  const r = await query(
    `WITH changed AS(UPDATE business_reviews SET public_consent=false,status='WITHDRAWN' WHERE id=$1 AND organization_id=$2 AND user_id=$3 RETURNING *) INSERT INTO review_audit(review_id,actor_id,event) SELECT id,$3,'WITHDRAWN' FROM changed RETURNING id`,
    [id(reviewId), s.organizationId, s.userId],
  );
  if (!r.length) throw Error("Review unavailable.");
  return { ok: true as const };
}
export async function adminReviewsAction() {
  await requireAdminCapability("publish_reviews");
  return await query(
    "SELECT id,quote,rating,display_name,company,public_consent,milestone,status,created_at FROM business_reviews ORDER BY created_at DESC LIMIT 150",
    [],
  );
}
async function moderateReviewActionCore(reviewId: string, publish: boolean) {
  const a = await requireAdminCapability("publish_reviews");
  if (typeof publish !== "boolean") throw Error("Invalid moderation action.");
  const r = await query(
    `WITH changed AS(UPDATE business_reviews SET status=CASE WHEN $2 THEN 'PUBLISHED' ELSE 'REJECTED' END,moderated_by=$3,moderated_at=now() WHERE id=$1 AND status<>'WITHDRAWN' AND(NOT $2 OR public_consent=true) RETURNING *) INSERT INTO review_audit(review_id,actor_id,event) SELECT id,$3,CASE WHEN $2 THEN 'PUBLISHED' ELSE 'REJECTED' END FROM changed RETURNING id`,
    [id(reviewId), publish, a.id],
  );
  if (!r.length)
    throw Error(
      "Publication requires current customer consent. Withdrawn reviews cannot be republished.",
    );
  return { ok: true as const };
}

export async function reviewPromptAction(
  ...args: Parameters<typeof reviewPromptActionCore>
) {
  try {
    return await reviewPromptActionCore(...args);
  } catch (error) {
    return { ok: false as const, error: publicError(error) };
  }
}

export async function submitBusinessReviewAction(
  ...args: Parameters<typeof submitBusinessReviewActionCore>
) {
  try {
    return await submitBusinessReviewActionCore(...args);
  } catch (error) {
    return { ok: false as const, error: publicError(error) };
  }
}

export async function withdrawBusinessReviewAction(
  ...args: Parameters<typeof withdrawBusinessReviewActionCore>
) {
  try {
    return await withdrawBusinessReviewActionCore(...args);
  } catch (error) {
    return { ok: false as const, error: publicError(error) };
  }
}

export async function moderateReviewAction(
  ...args: Parameters<typeof moderateReviewActionCore>
) {
  try {
    return await moderateReviewActionCore(...args);
  } catch (error) {
    return { ok: false as const, error: publicError(error) };
  }
}
