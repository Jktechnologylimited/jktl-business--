import "server-only";
import webpush from "web-push";
import { query } from "./service";
import {
  listSubscriptions,
  removeSubscription,
  getNotificationPrefs,
} from "@/lib/db/push";
export async function processSupportNotifications() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey)
    return { configured: false, delivered: 0, failed: 0 };
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:support@jktl.com.ng",
    publicKey,
    privateKey,
  );
  const batch = await query(
    `WITH picked AS(SELECT id FROM support_outbox WHERE delivered_at IS NULL AND attempts<10 AND(lease_until IS NULL OR lease_until<now()) ORDER BY created_at LIMIT 20 FOR UPDATE SKIP LOCKED) UPDATE support_outbox o SET lease_until=now()+interval '5 minutes',attempts=attempts+1 FROM picked WHERE o.id=picked.id RETURNING o.*`,
    [],
  );
  let delivered = 0,
    failed = 0;
  for (const event of batch)
    try {
      if (event.audience === "customer") {
        const c = (
          await query("SELECT organization_id FROM support_cases WHERE id=$1", [
            event.case_id,
          ])
        )[0];
        if (
          c &&
          (await getNotificationPrefs(String(c.organization_id))).pushEnabled
        ) {
          const subscriptions = await listSubscriptions(
            String(c.organization_id),
          );
          const results = await Promise.allSettled(
            subscriptions.map(async (sub) => {
              try {
                await webpush.sendNotification(
                  {
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.p256dh, auth: sub.auth },
                  },
                  JSON.stringify({
                    title: "JKTL support update",
                    body: "There is an update in your support conversation.",
                    url: "/business/help?case=" + event.case_id,
                  }),
                );
              } catch (e) {
                const code = (e as { statusCode?: number }).statusCode;
                if (code === 404 || code === 410)
                  await removeSubscription(sub.endpoint);
                else throw e;
              }
            }),
          );
          if (results.some((r) => r.status === "rejected"))
            throw Error("Push delivery needs retry.");
        }
      } else {
        const subscriptions = await query(
          `SELECT p.endpoint,p.p256dh,p.auth FROM support_push_subscriptions p JOIN support_cases c ON c.id=$2 JOIN admin_users a ON a.id=p.admin_id JOIN admin_sessions s ON s.id=p.session_id AND s.admin_user_id=a.id WHERE a.disabled_at IS NULL AND s.expires_at>now() AND c.status<>'RESOLVED' AND(a.role='owner' OR a.role='support' AND $1='staff' AND c.sensitive=false AND(c.assigned_to IS NULL OR c.assigned_to=a.id))`,
          [event.audience, event.case_id],
        );
        const results = await Promise.allSettled(
          subscriptions.map(async (sub) => {
            try {
              await webpush.sendNotification(
                {
                  endpoint: String(sub.endpoint),
                  keys: { p256dh: String(sub.p256dh), auth: String(sub.auth) },
                },
                JSON.stringify({
                  title: "JKTL support inbox",
                  body:
                    event.audience === "owner"
                      ? "A request needs team review."
                      : "A customer needs support. Open the inbox to review.",
                  url: "/admin/support?case=" + event.case_id,
                }),
              );
            } catch (e) {
              const code = (e as { statusCode?: number }).statusCode;
              if (code === 404 || code === 410)
                await query(
                  "DELETE FROM support_push_subscriptions WHERE endpoint=$1",
                  [sub.endpoint],
                );
              else throw e;
            }
          }),
        );
        if (results.some((r) => r.status === "rejected"))
          throw Error("Push delivery needs retry.");
      }
      await query(
        "UPDATE support_outbox SET delivered_at=now(),lease_until=NULL WHERE id=$1",
        [event.id],
      );
      delivered++;
    } catch {
      failed++;
      await query(
        `UPDATE support_outbox SET lease_until=now()+interval '5 minutes' WHERE id=$1`,
        [event.id],
      );
    }
  return { configured: true, delivered, failed };
}
