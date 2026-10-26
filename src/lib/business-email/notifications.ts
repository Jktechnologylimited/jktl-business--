import "server-only";
import { query } from "./service";
import { sendCustomNoticeEmail } from "@/lib/email";
export async function runEmailMaintenance() {
  if (
    !(await query("SELECT to_regclass('public.email_outbox') AS present"))[0]
      ?.present
  )
    return { sent: 0, failed: 0 };
  await query(
    `INSERT INTO email_outbox(event_key,organization_id,subject,detail) SELECT 'renewal:'||s.id::text||':'||s.renews_at::text||':'||d.days,s.organization_id,'Business Email renewal reminder','Your email service for '||s.domain||' renews on '||(s.renews_at AT TIME ZONE 'Africa/Lagos')::date::text||'. Review current renewal options in Business Email. Automatic charging is disabled.' FROM email_services s LEFT JOIN email_plans p ON p.id=s.plan_id CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(p.reminder_days,'[30,14,7,0]'::jsonb)) AS d(days) WHERE s.renews_at IS NOT NULL AND ((s.renews_at AT TIME ZONE 'Africa/Lagos')::date-(now() AT TIME ZONE 'Africa/Lagos')::date)=d.days::int ON CONFLICT DO NOTHING`,
  );
  const rows = await query(
    `UPDATE email_outbox SET lease_until=now()+interval '5 minutes',attempts=attempts+1 WHERE id IN(SELECT id FROM email_outbox WHERE sent_at IS NULL AND(lease_until IS NULL OR lease_until<now()) ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 10) RETURNING *`,
  );
  let sent = 0,
    failed = 0;
  for (const r of rows) {
    const o = (
      await query(
        "SELECT email FROM organization_members WHERE organization_id=$1 AND role='owner' AND active=true ORDER BY created_at LIMIT 1",
        [r.organization_id],
      )
    )[0];
    const result = await sendCustomNoticeEmail({
      to: String(o?.email || ""),
      subject: String(r.subject),
      detail: String(r.detail),
      key: `email-notice-${r.id}`,
      path: String(r.path || "/business/email"),
      category: (["website", "payment", "business_email"].includes(
        String(r.category),
      )
        ? r.category
        : "business_email") as "website" | "payment" | "business_email",
    });
    if (result.ok) {
      await query(
        "UPDATE email_outbox SET sent_at=now(),lease_until=NULL WHERE id=$1",
        [r.id],
      );
      sent++;
    } else failed++;
  }
  return { sent, failed };
}
