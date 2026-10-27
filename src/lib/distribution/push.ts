import "server-only";
import webpush from "web-push";
import { query } from "@/lib/custom/service";
export async function flushProgrammePush() {
  if (
    !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    !process.env.VAPID_PRIVATE_KEY
  )
    return { configured: false, delivered: 0, failed: 0 };
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:info@jktl.com.ng",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
  const events = await query(
    `WITH picked AS(SELECT id FROM distribution_program_notices WHERE push_delivered_at IS NULL AND push_attempts<10 AND(push_lease_until IS NULL OR push_lease_until<now()) ORDER BY id LIMIT 20 FOR UPDATE SKIP LOCKED) UPDATE distribution_program_notices n SET push_attempts=push_attempts+1,push_lease_until=now()+interval '5 minutes' FROM picked p WHERE n.id=p.id RETURNING n.*`,
  );
  let delivered = 0,
    failed = 0;
  for (const n of events)
    try {
      const team = n.audience === "STAFF";
      const subscriptions = team
        ? await query(
            `SELECT p.endpoint,p.p256dh,p.auth FROM support_push_subscriptions p JOIN admin_users a ON a.id=p.admin_id JOIN admin_sessions s ON s.id=p.session_id AND s.admin_user_id=a.id WHERE a.disabled_at IS NULL AND a.role IN('owner','affiliate_manager') AND s.expires_at>now()`,
          )
        : await query(
            `SELECT p.endpoint,p.p256dh,p.auth FROM partner_push_subscriptions p JOIN affiliate_sessions s ON s.id=p.session_id AND s.affiliate_id=p.affiliate_id JOIN affiliates a ON a.id=p.affiliate_id WHERE a.id=$1 AND a.status='active' AND(a.programme='affiliate' OR a.partner_terms_confirmed=true) AND s.expires_at>now()`,
            [n.affiliate_id],
          );
      for (const s of subscriptions)
        try {
          await webpush.sendNotification(
            {
              endpoint: String(s.endpoint),
              keys: { p256dh: String(s.p256dh), auth: String(s.auth) },
            },
            JSON.stringify({
              title: "JKTL programme update",
              body: "There is an update in your secure programme workspace.",
              icon: "/icon-192.png",
              url:
                String(n.path).startsWith("/") &&
                !String(n.path).startsWith("//")
                  ? String(n.path)
                  : "/business/distribution",
            }),
          );
        } catch (e) {
          if (
            [404, 410].includes(
              Number((e as { statusCode?: number }).statusCode),
            )
          )
            await query(
              "DELETE FROM " +
                (team
                  ? "support_push_subscriptions"
                  : "partner_push_subscriptions") +
                " WHERE endpoint=$1",
              [s.endpoint],
            );
          else throw e;
        }
      await query(
        "UPDATE distribution_program_notices SET push_delivered_at=now(),push_lease_until=NULL WHERE id=$1",
        [n.id],
      );
      delivered++;
    } catch {
      failed++;
    }
  return { configured: true, delivered, failed };
}
