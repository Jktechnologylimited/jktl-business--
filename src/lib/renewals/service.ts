import "server-only";
import { getNotificationPrefs } from "@/lib/db/push";
import { sendPush } from "@/lib/push";
import { query } from "@/lib/custom/service";
import { mailAddress } from "@/lib/mail/addresses";
import { sendCustomNoticeEmail } from "@/lib/email";
import { reminderBucket, renewalMessage } from "./model";
export async function renewalInstalled() {
  return Boolean(
    (await query("SELECT to_regclass('public.renewal_settings') present"))[0]
      ?.present,
  );
}
export async function centralRenewalsEnabled() {
  return (
    (await renewalInstalled()) &&
    Boolean(
      (await query("SELECT enabled FROM renewal_settings WHERE id=true"))[0]
        ?.enabled,
    )
  );
}
export async function renewalItem(key: string, org?: string) {
  return (
    await query(
      "SELECT * FROM renewal_items WHERE item_key=$1 AND ($2::uuid IS NULL OR organization_id=$2::uuid)",
      [key, org || null],
    )
  )[0];
}
export async function queueRenewal(key: string, manual = false) {
  const item = await renewalItem(key);
  if (!item) throw Error("Current subscription required.");
  if (!item.due_on)
    throw Error("Provide the renewal date before sending a reminder.");
  const email = mailAddress(item.recipient);
  if (!email) throw Error("Provide a valid billing contact on this account.");
  if (
    item.legacy_reminded_at &&
    Date.now() - new Date(String(item.legacy_reminded_at)).getTime() < 86400000
  )
    return null;
  const bucket = manual
    ? "manual:" +
      new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(
        new Date(),
      )
    : reminderBucket(Number(item.days_left));
  if (!bucket) return null;
  const rows = await query(
    `INSERT INTO renewal_reminders(item_key,organization_id,due_on,bucket,recipient) SELECT $1,$2,$3,$4,$5 WHERE NOT EXISTS(SELECT 1 FROM renewal_reminders WHERE item_key=$1 AND due_on=$3::date AND recipient=$5 AND ((state IN('QUEUED','SUBMITTING','UNKNOWN','FAILED')) OR(state='ACCEPTED' AND updated_at>now()-interval '24 hours'))) ON CONFLICT DO NOTHING RETURNING id`,
    [key, item.organization_id, item.due_on, bucket, email],
  );
  return rows[0]?.id || null;
}
export async function reconcileRenewals() {
  await query(
    `UPDATE renewal_reminders r SET state=CASE WHEN h.provider_state='ACCEPTED' THEN 'ACCEPTED' ELSE 'UNKNOWN' END,provider_id=COALESCE(r.provider_id,h.provider_message_id),lease_until=NULL,last_error=CASE WHEN h.provider_state='ACCEPTED' THEN NULL ELSE 'SUBMISSION_UNCONFIRMED' END,updated_at=now() FROM(SELECT r.id,h.provider_state,h.provider_message_id FROM renewal_reminders r LEFT JOIN email_send_history h ON h.attempt_key='renewal-'||r.id::text WHERE r.state='SUBMITTING' AND r.lease_until<now())h WHERE r.id=h.id`,
  );
}
export async function dispatchRenewals(limit = 10, budgetMs = 20000) {
  await reconcileRenewals();
  const end = Date.now() + budgetMs;
  let accepted = 0,
    failed = 0,
    unknown = 0;
  for (let i = 0; i < Math.min(50, limit) && Date.now() < end; i++) {
    const row = (
      await query(
        `UPDATE renewal_reminders SET state='SUBMITTING',lease_until=now()+interval '5 minutes',attempts=attempts+1,updated_at=now() WHERE id=(SELECT id FROM renewal_reminders WHERE state IN('QUEUED','FAILED') AND attempts<3 AND next_attempt_at<=now() ORDER BY due_on,created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,
      )
    )[0];
    if (!row) break;
    const item = await renewalItem(String(row.item_key));
    if (
      !item ||
      String(item.due_on).slice(0, 10) !== String(row.due_on).slice(0, 10) ||
      mailAddress(item.recipient) !== row.recipient
    ) {
      await query(
        "UPDATE renewal_reminders SET state='CANCELLED',lease_until=NULL,last_error='SERVICE_OR_CONTACT_CHANGED',updated_at=now() WHERE id=$1",
        [row.id],
      );
      continue;
    }
    const payload = row.payload || renewalMessage(item);
    if (!row.payload)
      await query(
        "UPDATE renewal_reminders SET payload=$2::jsonb WHERE id=$1",
        [row.id, JSON.stringify(payload)],
      );
    let result: { ok: boolean; providerId?: string; uncertain?: boolean };
    try {
      result = await sendCustomNoticeEmail({
        to: String(row.recipient),
        ...payload,
        key: "renewal-" + row.id,
        category: "service",
      });
    } catch {
      result = { ok: false, uncertain: true };
    }
    const state = result.ok
      ? "ACCEPTED"
      : result.uncertain
        ? "UNKNOWN"
        : "FAILED";
    await query(
      "UPDATE renewal_reminders SET state=$2,provider_id=COALESCE($3,provider_id),lease_until=NULL,next_attempt_at=now()+interval '1 hour',last_error=$4,updated_at=now() WHERE id=$1",
      [
        row.id,
        state,
        result.providerId || null,
        result.ok
          ? null
          : result.uncertain
            ? "SUBMISSION_UNCONFIRMED"
            : "PROVIDER_REJECTED",
      ],
    );
    if (result.ok) {
      try {
        const prefs = await getNotificationPrefs(String(row.organization_id));
        if (prefs.pushEnabled)
          await sendPush(String(row.organization_id), {
            title: payload.subject,
            body:
              String(item.name) +
              " · Renewal " +
              String(item.due_on).slice(0, 10),
            url: String(item.path),
          });
      } catch {
        /* Email acceptance remains authoritative; push is best effort. */
      }
    }
    if (result.ok) accepted++;
    else if (result.uncertain) unknown++;
    else failed++;
  }
  await query(
    "UPDATE renewal_settings SET last_dispatch_at=now() WHERE id=true",
  );
  return { accepted, failed, unknown };
}
export async function runCentralRenewals() {
  if (!(await centralRenewalsEnabled())) return null;
  try {
    const queued = (
      await query(
        `WITH candidates AS(SELECT i.*,CASE WHEN days_left<=-7 THEN 'overdue-7' WHEN days_left<=0 THEN 'due' WHEN days_left<=1 THEN '1' WHEN days_left<=7 THEN '7' WHEN days_left<=14 THEN '14' ELSE '30' END bucket FROM renewal_items i WHERE due_on IS NOT NULL AND recipient LIKE '%@%' AND days_left BETWEEN -30 AND 30 AND(legacy_reminded_at IS NULL OR legacy_reminded_at<now()-interval '24 hours')) INSERT INTO renewal_reminders(item_key,organization_id,due_on,bucket,recipient) SELECT i.item_key,i.organization_id,i.due_on,i.bucket,lower(i.recipient) FROM candidates i WHERE NOT EXISTS(SELECT 1 FROM renewal_reminders r WHERE r.item_key=i.item_key AND r.due_on=i.due_on AND lower(r.recipient)=lower(i.recipient) AND(r.state IN('QUEUED','SUBMITTING','UNKNOWN','FAILED') OR(r.state='ACCEPTED' AND r.updated_at>now()-interval '24 hours'))) AND NOT EXISTS(SELECT 1 FROM renewal_reminders done WHERE done.item_key=i.item_key AND done.due_on=i.due_on AND lower(done.recipient)=lower(i.recipient) AND done.bucket=i.bucket) ORDER BY i.due_on LIMIT 300 ON CONFLICT DO NOTHING RETURNING id`,
      )
    ).length;
    const delivery = await dispatchRenewals(10, 12000);
    await query(
      "UPDATE renewal_settings SET last_scan_at=now(),last_error=$1 WHERE id=true",
      [
        delivery.failed || delivery.unknown
          ? "Some reminders need review"
          : null,
      ],
    );
    return { queued, ...delivery };
  } catch (error) {
    await query(
      "UPDATE renewal_settings SET last_error='Renewal check did not complete',updated_at=now() WHERE id=true",
    );
    throw error;
  }
}
/** Suppress only superseded renewal emails; keep receipts, setup and instalment notices. */
export async function legacyRenewalGate(
  table: "domain_outbox" | "email_outbox" | "custom_outbox",
) {
  if (!(await renewalInstalled())) return { enabled: false, filter: "" };
  const enabled = await centralRenewalsEnabled();
  const predicate =
    table === "domain_outbox"
      ? "event='Domain renewal reminder'"
      : table === "email_outbox"
        ? "event_key LIKE 'renewal:%'"
        : "event_key LIKE 'reminder:%'";
  const match =
    table === "domain_outbox"
      ? "i.item_key LIKE 'domain:%' AND i.name=domain_outbox.domain"
      : table === "email_outbox"
        ? "i.item_key LIKE 'email:%' AND email_outbox.event_key LIKE 'renewal:'||split_part(i.item_key,':',2)||':%'"
        : "EXISTS(SELECT 1 FROM custom_invoices ix WHERE i.item_key='custom:'||ix.service_id::text AND ix.due_on=i.due_on AND custom_outbox.event_key LIKE 'reminder:'||ix.id::text||':%')";
  const guarded = enabled
    ? ""
    : ` AND EXISTS(SELECT 1 FROM renewal_reminders r JOIN renewal_items i ON i.item_key=r.item_key AND i.due_on=r.due_on AND i.recipient=r.recipient WHERE r.organization_id=${table}.organization_id AND ${match} AND(r.state IN('QUEUED','SUBMITTING','UNKNOWN','FAILED') OR(r.state='ACCEPTED' AND r.updated_at>now()-interval '24 hours')))`;
  await query(
    `UPDATE ${table} SET renewal_superseded_at=now() WHERE sent_at IS NULL AND renewal_superseded_at IS NULL AND ${predicate}${guarded}`,
  );
  return { enabled, filter: " AND renewal_superseded_at IS NULL" };
}
