import "server-only";
import { query } from "./store";
import { getOwnerEmail } from "@/lib/db/organizations";
import { sendChatbotLeadEmail } from "@/lib/email";
import { sendBroadcastPush } from "@/lib/push";
import { getNotificationPrefs, listSubscriptions } from "@/lib/db/push";
export async function processChatbotNotices() {
  const email = Boolean(process.env.RESEND_API_KEY),
    push = Boolean(
      process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    );
  if (!email && !push) return { configured: false };
  const events = await query(
    `WITH picked AS(SELECT id FROM chatbot_notice_outbox WHERE attempts<10 AND(lease_until IS NULL OR lease_until<now()) AND(($1 AND email_sent_at IS NULL) OR($2 AND push_sent_at IS NULL)) LIMIT 10 FOR UPDATE SKIP LOCKED) UPDATE chatbot_notice_outbox o SET attempts=attempts+1,lease_until=now()+interval '5 minutes' FROM picked WHERE o.id=picked.id RETURNING o.*`,
    [email, push],
  );
  for (const event of events)
    try {
      const lead = (
        await query(
          "SELECT * FROM chatbot_leads WHERE id=$1 AND organization_id=$2",
          [event.lead_id, event.organization_id],
        )
      )[0];
      if (!lead) continue;
      if (email && !event.email_sent_at) {
        const owner = await getOwnerEmail(String(event.organization_id));
        if (owner) {
          const result = await sendChatbotLeadEmail({
            to: owner,
            name: String(lead.name),
            detail: `${lead.kind}\n${lead.email}\n${lead.phone}\n${lead.enquiry}`,
          });
          if (!result.ok) throw Error("MAIL_RETRY");
        }
        await query(
          "UPDATE chatbot_notice_outbox SET email_sent_at=now() WHERE id=$1",
          [event.id],
        );
      }
      if (push && !event.push_sent_at) {
        if (
          (await getNotificationPrefs(String(event.organization_id)))
            .pushEnabled
        ) {
          const subscriptions = await listSubscriptions(
            String(event.organization_id),
          );
          const sent = await sendBroadcastPush(subscriptions, {
            title: "New chatbot enquiry",
            body: "A visitor has requested business follow-up.",
            url: "/business/chatbot",
          });
          if (subscriptions.length > 0 && sent === 0) throw Error("PUSH_RETRY");
        }
        await query(
          "UPDATE chatbot_notice_outbox SET push_sent_at=now() WHERE id=$1",
          [event.id],
        );
      }
      await query(
        "UPDATE chatbot_notice_outbox SET lease_until=NULL WHERE id=$1",
        [event.id],
      );
    } catch {
      /* Durable lease retries through the existing daily sweep. */
    }
  return { configured: true, processed: events.length };
}
export async function maintainChatbots() {
  // Enforce current plan retention immediately, including after downgrades.
  await query(
    `DELETE FROM chatbot_sessions s WHERE s.delete_at<=now() OR s.created_at<now()-make_interval(days=>(SELECT retention_days FROM chatbot_limits(s.organization_id)))`,
  );
  await query("DELETE FROM chatbot_tickets WHERE expires_at<now();");
  await query("DELETE FROM chatbot_rates WHERE expires_at<now()");
  await query(
    "UPDATE chatbot_turns SET state='uncertain',error_code='LEASE_EXPIRED',finished_at=now() WHERE state='pending' AND created_at<now()-interval '2 minutes'",
  );
  return processChatbotNotices();
}
