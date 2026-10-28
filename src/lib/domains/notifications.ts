import "server-only";
import { getSql } from "@/lib/db/client";
import { sendDomainOrderEmail, sendPartnerNoticeEmail } from "@/lib/email";
import { flushRegistrarAlerts } from "./registrar-admin";
import { getNotificationPrefs } from "@/lib/db/push";
import { sendPush } from "@/lib/push";
export async function enqueueDomainReminders() {
  const sql = getSql();
  const rows = await sql.query(
    `INSERT INTO domain_outbox(event_key,organization_id,domain,event,detail)
SELECT a.id::text||':'||a.expires_at::text||':'||d.days,a.organization_id,a.domain,'Domain renewal reminder','Your domain expires in '||d.days||' day(s). Review the current renewal price in My Domains. Renewal is not automatic.' FROM domain_assets a CROSS JOIN(VALUES(30),(14),(7),(1)) AS d(days)
WHERE ((a.expires_at AT TIME ZONE 'Africa/Lagos')::date-(now() AT TIME ZONE 'Africa/Lagos')::date)=d.days ON CONFLICT DO NOTHING RETURNING id`,
    [],
  );
  return rows.length;
}
export async function flushDomainNotifications(limit = 10) {
  const sql = getSql();
  const ready = await sql.query(
    `UPDATE domain_outbox SET lease_until=now()+interval '5 minutes',attempts=attempts+1 WHERE id IN(SELECT id FROM domain_outbox WHERE sent_at IS NULL AND (lease_until IS NULL OR lease_until<now()) ORDER BY id FOR UPDATE SKIP LOCKED LIMIT $1) RETURNING *`,
    [Math.max(1, Math.min(limit, 50))],
  );
  let sent = 0,
    failed = 0;
  for (const row of ready) {
    const owners =
      await sql`SELECT email FROM organization_members WHERE organization_id=${row.organization_id} AND role='owner' AND active=true ORDER BY id LIMIT 1`;
    const email = String(owners[0]?.email || "");
    const result = await sendDomainOrderEmail({
      to: email,
      domain: String(row.domain),
      event: String(row.event),
      detail: String(row.detail),
      key: `domain-outbox-${row.id}`,
    });
    if (result.ok) {
      await sql`UPDATE domain_outbox SET sent_at=now(),lease_until=NULL WHERE id=${row.id}`;
      sent++;
      try {
        const prefs = await getNotificationPrefs(String(row.organization_id));
        if (prefs.pushEnabled)
          await sendPush(String(row.organization_id), {
            title: String(row.event),
            body: String(row.domain),
            url: "/business/domains",
          });
      } catch {}
    } else {
      failed++;
      await sql`UPDATE domain_outbox SET lease_until=now()+interval '5 minutes' WHERE id=${row.id}`;
    }
  }
  return { sent, failed };
}
export async function runDomainMaintenance() {
  const sql = getSql();
  const present =
    await sql`SELECT to_regclass('public.domain_orders') AS present`;
  if (!present[0]?.present) return "Domain schema not installed";
  const reminders = await enqueueDomainReminders();
  const notices = await flushDomainNotifications(15);
  const registrarInstalled = (
    await sql`SELECT to_regclass('public.domain_registrar_alerts') AS present`
  )[0]?.present;
  const registrarAlerts = registrarInstalled
    ? await flushRegistrarAlerts(
        (text, params) => sql.query(text, params),
        sendPartnerNoticeEmail,
      )
    : { sent: 0, failed: 0 };
  await sql`DELETE FROM domain_rate_limits WHERE expires_at<now()`;
  if (
    (
      await sql`SELECT to_regclass('public.domain_public_searches') AS present`
    )[0]?.present
  )
    await sql`DELETE FROM domain_public_searches WHERE updated_at<now()-interval '1 day' AND(lease_until IS NULL OR lease_until<now())`;
  if (notices.failed || registrarAlerts.failed)
    throw Error(
      `${notices.failed + registrarAlerts.failed} domain notices will retry. Check transactional email configuration.`,
    );
  return `${reminders} renewal reminders queued; ${notices.sent} notices sent`;
}
