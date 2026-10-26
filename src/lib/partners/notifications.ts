import "server-only";
import webpush from "web-push";
import { query } from "@/lib/custom/service";
import { sendPartnerNoticeEmail } from "@/lib/email";
export async function processPartnerNotices() {
  const email = Boolean(process.env.RESEND_API_KEY),
    push = Boolean(
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
    );
  if (!email && !push) return { configured: false, delivered: 0, failed: 0 };
  if (push)
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:support@jktl.com.ng",
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
  await query(
    `INSERT INTO partner_notice_outbox(event_key,ticket_id,audience) SELECT 'overdue-'||t.id||'-'||extract(epoch FROM t.updated_at)::text,t.id,'STAFF' FROM partner_tickets t CROSS JOIN partner_support_settings s WHERE t.status IN('OPEN','ASSIGNED','IN_PROGRESS') AND t.updated_at<now()-make_interval(hours=>s.response_hours) ON CONFLICT DO NOTHING`,
  );
  const events = await query(
    `WITH picked AS(SELECT id FROM partner_notice_outbox WHERE delivered_at IS NULL AND attempts<10 AND($1 OR audience='PARTNER') AND(lease_until IS NULL OR lease_until<now()) ORDER BY id LIMIT 15 FOR UPDATE SKIP LOCKED) UPDATE partner_notice_outbox o SET attempts=attempts+1,lease_until=now()+interval '5 minutes' FROM picked WHERE o.id=picked.id RETURNING o.*`,
    [push],
  );
  let delivered = 0,
    failed = 0;
  for (const e of events)
    try {
      const t = (
        await query(
          "SELECT t.*,p.email,p.status AS partner_status FROM partner_tickets t JOIN affiliates p ON p.id=t.partner_id WHERE t.id=$1",
          [e.ticket_id],
        )
      )[0];
      if (!t) throw Error("Ticket unavailable");
      if (e.audience === "PARTNER" && t.partner_status === "active" && email) {
        const reply = !t.sensitive
          ? (
              await query(
                "SELECT m.body,COALESCE(a.name,'JKTL Support Team') AS agent FROM partner_ticket_messages m LEFT JOIN admin_users a ON a.id::text=m.actor_id WHERE m.ticket_id=$1 AND 'message-'||m.id=$2 AND m.kind='STAFF'",
                [t.id, e.event_key],
              )
            )[0]
          : null;
        const r = await sendPartnerNoticeEmail({
          to: String(t.email),
          key: "partner-ticket-" + e.id,
          path: "/partners/support#ticket-" + t.id,
          category: "support",
          ...(reply
            ? {
                ticket: {
                  subject: String(t.subject),
                  agent: String(reply.agent),
                  reply: String(reply.body),
                  reference: String(t.id),
                },
              }
            : {}),
          subject: "JKTL Partner support update",
          detail:
            "There is an update in your JKTL Partner support conversation. Sign in to review it securely.",
        });
        if (!r.ok) throw Error("Email retry required");
      }
      if (push) {
        const subscriptions =
          e.audience === "PARTNER"
            ? await query(
                `SELECT s.endpoint,s.p256dh,s.auth FROM partner_push_subscriptions s JOIN affiliate_sessions a ON a.id=s.session_id JOIN affiliates p ON p.id=s.affiliate_id WHERE p.id=$1 AND a.affiliate_id=p.id AND a.expires_at>now() AND p.status='active' AND p.programme='partner' AND p.partner_terms_confirmed=true`,
                [t.partner_id],
              )
            : await query(
                `SELECT s.endpoint,s.p256dh,s.auth FROM support_push_subscriptions s JOIN admin_sessions x ON x.id=s.session_id AND x.admin_user_id=s.admin_id JOIN admin_users a ON a.id=s.admin_id WHERE x.expires_at>now() AND a.disabled_at IS NULL AND(a.role='owner' OR(a.role='support' AND $1=false AND($2::uuid IS NULL OR a.id=$2)))`,
                [t.sensitive, t.assigned_to],
              );
        for (const s of subscriptions)
          try {
            await webpush.sendNotification(
              {
                endpoint: String(s.endpoint),
                keys: { p256dh: String(s.p256dh), auth: String(s.auth) },
              },
              JSON.stringify({
                title: "JKTL Partners",
                body: "A support conversation needs attention.",
                icon: "/icon-192.png",
                url:
                  e.audience === "PARTNER"
                    ? "/partners/support"
                    : "/admin/partner-support",
              }),
            );
          } catch (err) {
            if (
              [404, 410].includes(
                Number((err as { statusCode?: number }).statusCode),
              )
            )
              await query(
                "DELETE FROM " +
                  (e.audience === "PARTNER"
                    ? "partner_push_subscriptions"
                    : "support_push_subscriptions") +
                  " WHERE endpoint=$1",
                [s.endpoint],
              );
            else throw err;
          }
      }
      // Staff-only events require push configuration; do not discard them when only email is set.
      if (e.audience === "STAFF" && !push) continue;
      await query(
        "UPDATE partner_notice_outbox SET delivered_at=now(),lease_until=NULL WHERE id=$1",
        [e.id],
      );
      delivered++;
    } catch {
      failed++;
    }
  return { configured: true, delivered, failed };
}
