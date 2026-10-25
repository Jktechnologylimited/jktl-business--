import "server-only";
import { query, generateInvoices } from "./service";
import { sendCustomNoticeEmail } from "@/lib/email";
export async function runCustomMaintenance() {
  if (
    !(await query("SELECT to_regclass('public.custom_outbox') AS present"))[0]
      ?.present
  )
    return { sent: 0, failed: 0 };
  await generateInvoices();
  await query(
    `INSERT INTO custom_outbox(event_key,organization_id,subject,detail) SELECT 'invoice:'||id::text,organization_id,'Your JKTL Custom invoice is ready','A service invoice is ready for review. Amount: NGN '||(amount_kobo/100.0)::text||'. Due: '||due_on::text||'. Automatic charging is disabled.' FROM custom_invoices WHERE status='OPEN' ON CONFLICT DO NOTHING`,
  );
  await query(
    `INSERT INTO custom_outbox(event_key,organization_id,subject,detail) SELECT 'receipt:'||id::text,organization_id,'JKTL Custom payment receipt','Your payment of NGN '||(amount_kobo/100.0)::text||' has been verified. Receipt reference: '||reference||'. Thank you.' FROM custom_invoices WHERE status='PAID' ON CONFLICT DO NOTHING`,
  );
  await query(
    `INSERT INTO custom_outbox(event_key,organization_id,subject,detail) SELECT 'reminder:'||i.id::text||':'||d.days,i.organization_id,'JKTL Custom payment reminder','Your unpaid service invoice is due on '||i.due_on::text||'. Please review it in your workspace. Automatic charging is disabled.' FROM custom_invoices i CROSS JOIN(VALUES(7),(1),(-7)) AS d(days) WHERE i.status='OPEN' AND(i.due_on-(now() AT TIME ZONE 'Africa/Lagos')::date)=d.days ON CONFLICT DO NOTHING`,
  );
  const rows = await query(
    `UPDATE custom_outbox SET lease_until=now()+interval '5 minutes',attempts=attempts+1 WHERE id IN(SELECT id FROM custom_outbox WHERE sent_at IS NULL AND (lease_until IS NULL OR lease_until<now()) ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 10) RETURNING *`,
  );
  let sent = 0,
    failed = 0;
  for (const r of rows) {
    const c = (
      await query(
        "SELECT u.email FROM custom_clients c JOIN users u ON u.id=c.user_id WHERE c.organization_id=$1",
        [r.organization_id],
      )
    )[0];
    const result = await sendCustomNoticeEmail({
      to: String(c?.email || ""),
      subject: String(r.subject),
      detail: String(r.detail),
      key: `custom-notice-${r.id}`,
    });
    if (result.ok) {
      await query(
        "UPDATE custom_outbox SET sent_at=now(),lease_until=NULL WHERE id=$1",
        [r.id],
      );
      sent++;
    } else failed++;
  }
  await query(
    "DELETE FROM custom_cms_grants WHERE expires_at<now()-interval '1 day'",
  );
  return { sent, failed };
}
