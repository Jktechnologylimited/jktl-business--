import { randomBytes, createHash } from "node:crypto";
import { sendPartnerNoticeEmail } from "@/lib/email";
import "server-only";
import { query } from "@/lib/custom/service";
/** Qualified activity is persisted before expiring referral visits are cleaned up.
 * No deletions, financial changes or Business account changes are performed here. */
export async function monitorAffiliateActivity() {
  const rows = await query(
    `WITH candidates AS(SELECT x.affiliate_id,x.last_qualified_at,CASE WHEN s.automatic_suspension AND x.contract_reviewed AND x.state='DORMANT' AND x.dormant_at IS NOT NULL AND now()>x.dormant_at+make_interval(days=>s.suspend_after_days) THEN 'SUSPENDED' WHEN now()>x.last_qualified_at+make_interval(days=>s.dormant_days) THEN 'DORMANT' WHEN now()>x.last_qualified_at+make_interval(days=>s.warning_days) THEN 'WARNED' ELSE 'ACTIVE' END new_state FROM affiliate_activity x CROSS JOIN affiliate_activity_settings s JOIN affiliates a ON true WHERE a.id=x.affiliate_id AND a.programme='affiliate' AND a.status='active' AND x.exempt=false AND x.state<>'SUSPENDED'),changed AS(UPDATE affiliate_activity x SET warned_at=CASE WHEN c.new_state='WARNED' AND x.state<>'WARNED' THEN now() ELSE x.warned_at END,dormant_at=CASE WHEN c.new_state='DORMANT' AND x.state<>'DORMANT' THEN now() ELSE x.dormant_at END,state=c.new_state,updated_at=now() FROM candidates c WHERE c.affiliate_id=x.affiliate_id AND c.new_state<>x.state RETURNING x.*),suspended AS(UPDATE affiliates a SET status='suspended' FROM changed c WHERE a.id=c.affiliate_id AND c.state='SUSPENDED' RETURNING a.id),notices AS(INSERT INTO distribution_program_notices(event_key,affiliate_id,subject,detail,path,category) SELECT 'activity-'||affiliate_id||'-'||state||'-'||extract(epoch FROM last_qualified_at)::text,affiliate_id,'JKTL Affiliate activity update',CASE state WHEN 'WARNED' THEN 'Your Affiliate account has not recorded recent qualified promotional activity. Valid referral visits, signups and verified conversions count. Your earned financial obligations remain intact.' WHEN 'DORMANT' THEN 'Your Affiliate privileges are marked dormant. Contact the JKTL Team for help restarting promotion. Existing earned commissions and payout obligations are preserved.' WHEN 'SUSPENDED' THEN 'Your Affiliate privileges have been suspended under the reviewed inactivity provisions. Contact the JKTL Team to request a review. Your Business account, customer subscriptions and earned financial obligations are preserved.' ELSE 'Qualified activity recorded. Your Affiliate account is active.' END,'/affiliates','affiliate' FROM changed ON CONFLICT DO NOTHING RETURNING id) INSERT INTO distribution_audit(actor_id,event,affiliate_id,detail) SELECT 'system','AFFILIATE_ACTIVITY_CHANGED',affiliate_id,jsonb_build_object('state',state,'lastQualifiedAt',last_qualified_at) FROM changed RETURNING id`,
  );
  return { processed: rows.length, failed: 0 };
}

export async function remindAffiliateInvitations() {
  if (!process.env.RESEND_API_KEY)
    return { configured: false, processed: 0, failed: 0 };
  let processed = 0,
    failed = 0;
  const invitations = await query(
    `SELECT i.id FROM affiliate_invitations i CROSS JOIN affiliate_activity_settings s WHERE i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.reminded_at IS NULL AND i.expires_at>now() AND i.created_at<now()-make_interval(days=>s.invitation_reminder_days) ORDER BY i.created_at LIMIT 10`,
  );
  for (const i of invitations) {
    const token = randomBytes(32).toString("hex"),
      hash = createHash("sha256").update(token).digest("hex");
    const r = (
      await query(
        `UPDATE affiliate_invitations SET reminded_at=now(),token_hash=$2 WHERE id=$1 AND accepted_at IS NULL AND revoked_at IS NULL AND reminded_at IS NULL AND expires_at>now() RETURNING id,name,email,program`,
        [i.id, hash],
      )
    )[0];
    if (!r) continue;
    try {
      const sent = await sendPartnerNoticeEmail({
        to: String(r.email),
        subject: "Your JKTL Affiliate invitation is waiting",
        detail: `Hello ${r.name}, your JKTL Affiliate invitation is ready. Review the terms and activate using your existing Business account or ordinary signup. This is a replacement secure link; older invitation links no longer work.`,
        path: "/affiliates/invitation?token=" + token,
        key: "affiliate-first-reminder-" + r.id + "-" + hash.slice(0, 12),
        category: "security",
        replyCategory: r.program as "affiliate" | "partner",
      });
      if (!sent.ok) throw Error("Retry");
      await query(
        `INSERT INTO distribution_audit(actor_id,event,detail) VALUES('system','AFFILIATE_INVITATION_REMINDER',jsonb_build_object('invitation',$1::uuid))`,
        [r.id],
      );
      processed++;
    } catch {
      await query(
        "UPDATE affiliate_invitations SET reminded_at=NULL WHERE id=$1 AND token_hash=$2",
        [r.id, hash],
      );
      failed++;
    }
  }
  return { configured: true, processed, failed };
}
