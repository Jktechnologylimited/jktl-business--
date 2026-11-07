import "server-only";
import { query } from "@/lib/custom/service";
import { mailAddress } from "@/lib/mail/addresses";
import { currentBranding } from "@/lib/mail/service";
import { sendAdminComposedEmail } from "@/lib/email";
import { escapeHtml, mailAction } from "@/lib/mail/layout";
import {
  lifecycleMessage,
  lifecycleStep,
  type LifecycleStage,
  type LifecycleSettings,
} from "./model";
export async function lifecycleInstalled() {
  return Boolean(
    (await query("SELECT to_regclass('public.lifecycle_settings') present"))[0]
      ?.present,
  );
}
export async function lifecycleConfig() {
  return (
    await query("SELECT * FROM lifecycle_settings WHERE id=true")
  )[0] as unknown as LifecycleSettings;
}
export async function contactAllowed(email: string, marketing: boolean) {
  if (!mailAddress(email)) return false;
  const flags = (
    await query(
      `SELECT COALESCE(p.marketing_suppressed,false) suppressed,COALESCE(p.marketing_opt_in,false) opted_in,EXISTS(SELECT 1 FROM prospects x WHERE lower(x.email)=lower($1) AND(x.suppressed=true OR x.status='suppressed')) legacy FROM (SELECT 1) one LEFT JOIN email_preferences p ON lower(p.email)=lower($1)`,
      [email],
    )
  )[0];
  return (
    !flags.suppressed &&
    !flags.legacy &&
    (!marketing ||
      (flags.opted_in && Boolean((await currentBranding()).postalAddress)))
  );
}
export async function reconcileLifecycle() {
  if (!(await lifecycleInstalled())) return { tracked: 0, queued: 0 };
  const settings = await lifecycleConfig();
  await query(
    `INSERT INTO lifecycle_accounts(organization_id,stage,recipient) SELECT organization_id,stage,recipient FROM lifecycle_current ON CONFLICT(organization_id) DO UPDATE SET stage=excluded.stage,recipient=excluded.recipient,cycle=gen_random_uuid(),stage_started_at=now(),updated_at=now() WHERE lifecycle_accounts.stage IS DISTINCT FROM excluded.stage OR lifecycle_accounts.recipient IS DISTINCT FROM excluded.recipient`,
  );
  await query(
    `UPDATE lifecycle_events e SET state='CANCELLED',last_error='ACCOUNT_PROGRESS_CHANGED',updated_at=now() WHERE e.state IN('QUEUED','FAILED') AND NOT EXISTS(SELECT 1 FROM lifecycle_current c JOIN lifecycle_accounts a USING(organization_id) WHERE c.organization_id=e.organization_id AND a.cycle=e.cycle AND c.stage=e.stage AND c.recipient=e.recipient)`,
  );
  await query(
    `UPDATE lifecycle_handoffs h SET status='DONE',revision=revision+1,updated_at=now() WHERE status<>'DONE' AND h.cycle_key LIKE 'stage:%' AND NOT EXISTS(SELECT 1 FROM lifecycle_accounts a JOIN lifecycle_current c USING(organization_id) WHERE a.organization_id=h.organization_id AND h.cycle_key='stage:'||a.cycle::text AND a.stage=c.stage AND c.stage IN('NO_SITE','DRAFT','FREE_DOMAIN','CONNECT_DOMAIN'))`,
  );
  await query(
    `UPDATE lifecycle_events e SET state='CANCELLED',last_error='LATER_STEP_DUE',updated_at=now() FROM lifecycle_accounts a WHERE e.organization_id=a.organization_id AND e.cycle=a.cycle AND e.step=1 AND e.state IN('QUEUED','FAILED') AND a.stage_started_at<=now()-$1*interval '1 day'`,
    [settings.second_days],
  );
  const accounts = await query(
    `SELECT a.*,c.business_name,c.has_domain,EXTRACT(EPOCH FROM(now()-a.stage_started_at))/86400 days,COALESCE(p.marketing_suppressed,false) suppressed,COALESCE(p.marketing_opt_in,false) opted_in,EXISTS(SELECT 1 FROM prospects x WHERE lower(x.email)=a.recipient AND(x.suppressed=true OR x.status='suppressed')) legacy FROM lifecycle_accounts a JOIN lifecycle_current c USING(organization_id) LEFT JOIN email_preferences p ON p.email=a.recipient WHERE a.stage=c.stage AND a.stage IN('NO_SITE','DRAFT','FREE_DOMAIN','CONNECT_DOMAIN') AND a.stage_started_at<=now()-$1*interval '1 day' ORDER BY a.stage_started_at,a.organization_id`,
    [settings.first_days],
  );
  const postal = accounts.some((a) => a.stage === "FREE_DOMAIN")
    ? Boolean((await currentBranding()).postalAddress)
    : false;
  const planned: Record<string, unknown>[] = [],
    humans: Record<string, unknown>[] = [];
  if (settings.enabled)
    for (const a of accounts) {
      if (a.paused_until && new Date(String(a.paused_until)) > new Date())
        continue;
      if (!mailAddress(a.recipient)) {
        humans.push({
          organization_id: a.organization_id,
          cycle_key: "stage:" + a.cycle,
          reason:
            "No valid active owner email. Review the account before contacting anyone.",
        });
        continue;
      }
      if (
        a.suppressed ||
        a.legacy ||
        (a.stage === "FREE_DOMAIN" && (!a.opted_in || !postal))
      )
        continue;
      if (Number(a.days) >= settings.human_days) {
        humans.push({
          organization_id: a.organization_id,
          cycle_key: "stage:" + a.cycle,
          reason:
            "Account remains at " +
            a.stage +
            " after automated follow-up. Check their needs and coordinate support before making changes.",
        });
        continue;
      }
      const step = lifecycleStep(Number(a.days), settings);
      if (step)
        planned.push({
          organization_id: a.organization_id,
          cycle: a.cycle,
          stage: a.stage,
          step,
          recipient: a.recipient,
        });
    }
  const queued = planned.length
    ? (
        await query(
          `INSERT INTO lifecycle_events(organization_id,cycle,stage,step,recipient) SELECT plan.organization_id,plan.cycle,plan.stage,plan.step,plan.recipient FROM jsonb_to_recordset($1::jsonb) AS plan(organization_id uuid,cycle uuid,stage text,step integer,recipient text) WHERE NOT EXISTS(SELECT 1 FROM lifecycle_events e WHERE e.organization_id=plan.organization_id AND e.cycle=plan.cycle AND(e.step>=plan.step OR e.state IN('QUEUED','FAILED','SUBMITTING','UNKNOWN'))) ON CONFLICT DO NOTHING RETURNING id`,
          [JSON.stringify(planned)],
        )
      ).length
    : 0;
  if (humans.length)
    await query(
      `INSERT INTO lifecycle_handoffs(organization_id,cycle_key,reason) SELECT organization_id,cycle_key,reason FROM jsonb_to_recordset($1::jsonb) AS plan(organization_id uuid,cycle_key text,reason text) ON CONFLICT DO NOTHING`,
      [JSON.stringify(humans)],
    );
  // Renewals keep their existing due-date engine; this only creates human tasks.
  if (
    (await query("SELECT to_regclass('public.renewal_items') present"))[0]
      ?.present
  ) {
    await query(
      `INSERT INTO lifecycle_handoffs(organization_id,cycle_key,reason) SELECT organization_id,'renewal-date:'||item_key,'Renewal date is missing: '||name||'. Confirm the service date before sending a reminder.' FROM renewal_items WHERE due_on IS NULL ON CONFLICT(organization_id,cycle_key) DO UPDATE SET status='OPEN',revision=lifecycle_handoffs.revision+1,updated_at=now() WHERE lifecycle_handoffs.status='DONE'`,
    );
    await query(
      `UPDATE lifecycle_handoffs h SET status='DONE',revision=revision+1,updated_at=now() WHERE status<>'DONE' AND h.cycle_key LIKE 'renewal-date:%' AND NOT EXISTS(SELECT 1 FROM renewal_items i WHERE h.cycle_key='renewal-date:'||i.item_key AND i.due_on IS NULL)`,
    );
    await query(
      `INSERT INTO lifecycle_handoffs(organization_id,cycle_key,reason) SELECT i.organization_id,'renewal:'||i.item_key||':'||i.due_on::text,CASE WHEN i.days_left<=-7 THEN 'Renewal overdue: '||i.name ELSE 'Renewal email needs provider review: '||i.name END FROM renewal_items i WHERE i.due_on IS NOT NULL AND(i.days_left<=-7 OR EXISTS(SELECT 1 FROM renewal_reminders r WHERE r.item_key=i.item_key AND r.due_on=i.due_on AND(r.state='UNKNOWN' OR(r.state='FAILED' AND r.attempts>=3)))) ON CONFLICT DO NOTHING`,
    );
    await query(
      `UPDATE lifecycle_handoffs h SET status='DONE',revision=revision+1,updated_at=now() WHERE status<>'DONE' AND h.cycle_key LIKE 'renewal:%' AND NOT EXISTS(SELECT 1 FROM renewal_items i WHERE h.cycle_key='renewal:'||i.item_key||':'||i.due_on::text AND(i.days_left<=-7 OR EXISTS(SELECT 1 FROM renewal_reminders r WHERE r.item_key=i.item_key AND r.due_on=i.due_on AND(r.state='UNKNOWN' OR(r.state='FAILED' AND r.attempts>=3)))))`,
    );
  }
  await query("UPDATE lifecycle_settings SET last_scan_at=now() WHERE id=true");
  return { tracked: accounts.length, queued };
}
export async function reconcileLifecycleMail() {
  await query(
    `UPDATE lifecycle_events e SET state=CASE WHEN h.provider_state='ACCEPTED' THEN 'ACCEPTED' ELSE 'UNKNOWN' END,provider_id=COALESCE(e.provider_id,h.provider_message_id),lease_until=NULL,last_error=CASE WHEN h.provider_state='ACCEPTED' THEN NULL ELSE 'SUBMISSION_UNCONFIRMED' END,updated_at=now() FROM(SELECT e.id,h.provider_state,h.provider_message_id FROM lifecycle_events e LEFT JOIN email_send_history h ON h.attempt_key='lifecycle-'||e.id::text WHERE e.state='SUBMITTING' AND e.lease_until<now())h WHERE e.id=h.id`,
  );
  await query(
    `INSERT INTO lifecycle_handoffs(organization_id,cycle_key,reason) SELECT organization_id,'mail:'||id::text,'Automatic follow-up email needs provider review. Confirm acceptance before retrying; do not send a duplicate.' FROM lifecycle_events WHERE state='UNKNOWN' OR(state='FAILED' AND attempts>=3) ON CONFLICT(organization_id,cycle_key) DO UPDATE SET status='OPEN',reason=excluded.reason,revision=lifecycle_handoffs.revision+1,updated_at=now() WHERE lifecycle_handoffs.status='DONE'`,
  );
}
export async function dispatchLifecycle(limit = 10, budgetMs = 7000) {
  if (!(await lifecycleInstalled()) || !(await lifecycleConfig()).enabled)
    return { accepted: 0, failed: 0, unknown: 0 };
  await reconcileLifecycleMail();
  let settings = await lifecycleConfig();
  const end = Date.now() + budgetMs;
  let accepted = 0,
    failed = 0,
    unknown = 0;
  for (let n = 0; n < Math.min(25, limit) && Date.now() < end; n++) {
    settings = await lifecycleConfig();
    if (!settings.enabled) break;
    let event;
    try {
      event = (
        await query(
          `UPDATE lifecycle_events e SET state='SUBMITTING',attempts=attempts+1,lease_until=now()+interval '5 minutes',updated_at=now() WHERE e.id=(SELECT id FROM lifecycle_events candidate WHERE state IN('QUEUED','FAILED') AND attempts<3 AND next_attempt_at<=now() AND NOT EXISTS(SELECT 1 FROM renewal_reminders r WHERE r.recipient=candidate.recipient AND r.state='ACCEPTED' AND r.updated_at>now()-interval '1 day') AND NOT EXISTS(SELECT 1 FROM lifecycle_events other WHERE other.recipient=candidate.recipient AND other.id<>candidate.id AND(other.state IN('SUBMITTING','UNKNOWN') OR(other.state='ACCEPTED' AND other.updated_at>now()-$1*interval '1 day'))) ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING e.*`,
          [settings.gap_days],
        )
      )[0];
    } catch (error) {
      if ((error as { code?: string }).code === "23505") break;
      throw error;
    }
    if (!event) break;
    const account = (
      await query(
        `SELECT a.*,c.business_name,c.has_domain,c.stage current_stage,c.recipient current_recipient,EXTRACT(EPOCH FROM(now()-a.stage_started_at))/86400 days FROM lifecycle_accounts a JOIN lifecycle_current c USING(organization_id) WHERE a.organization_id=$1`,
        [event.organization_id],
      )
    )[0];
    if (
      account?.paused_until &&
      new Date(String(account.paused_until)) > new Date()
    ) {
      await query(
        "UPDATE lifecycle_events SET state='QUEUED',attempts=attempts-1,lease_until=NULL,next_attempt_at=$2,updated_at=now() WHERE id=$1",
        [event.id, account.paused_until],
      );
      continue;
    }
    if (
      account &&
      Number(account.days) <
        (Number(event.step) === 2 ? settings.second_days : settings.first_days)
    ) {
      const due = new Date(
        new Date(String(account.stage_started_at)).getTime() +
          (Number(event.step) === 2
            ? settings.second_days
            : settings.first_days) *
            86400000,
      );
      await query(
        "UPDATE lifecycle_events SET state='QUEUED',attempts=attempts-1,lease_until=NULL,next_attempt_at=$2,updated_at=now() WHERE id=$1",
        [event.id, due.toISOString()],
      );
      continue;
    }
    const valid =
      account &&
      account.cycle === event.cycle &&
      account.stage === event.stage &&
      account.current_stage === event.stage &&
      account.current_recipient === event.recipient &&
      (!account.paused_until ||
        new Date(String(account.paused_until)) <= new Date()) &&
      Number(account.days) < settings.human_days;
    if (!valid) {
      await query(
        "UPDATE lifecycle_events SET state='CANCELLED',lease_until=NULL,last_error='PROGRESS_OR_PAUSE_CHANGED',updated_at=now() WHERE id=$1",
        [event.id],
      );
      continue;
    }
    if (
      !(await contactAllowed(
        String(event.recipient),
        event.stage === "FREE_DOMAIN",
      ))
    ) {
      await query(
        "UPDATE lifecycle_events SET state='SUPPRESSED',lease_until=NULL,updated_at=now() WHERE id=$1",
        [event.id],
      );
      continue;
    }
    const message =
      event.payload ||
      lifecycleMessage(
        event.stage as LifecycleStage,
        Number(event.step),
        String(account.business_name),
        Boolean(account.has_domain),
      );
    if (!event.payload)
      await query("UPDATE lifecycle_events SET payload=$2::jsonb WHERE id=$1", [
        event.id,
        JSON.stringify(message),
      ]);
    const url = "https://business.jktl.com.ng" + message.path;
    let result;
    try {
      result = await sendAdminComposedEmail({
        to: String(event.recipient),
        subject: message.subject,
        category: message.category,
        key: "lifecycle-" + event.id,
        bodyHtml:
          message.detail
            .split("\n\n")
            .map((p: string) => `<p>${escapeHtml(p)}</p>`)
            .join("") +
          mailAction("Continue in JKTL Business", url) +
          mailAction(
            "Get help from the team",
            "https://business.jktl.com.ng/business/help",
          ),
        text:
          message.detail +
          "\n\n" +
          url +
          "\nHelp: https://business.jktl.com.ng/business/help",
      });
    } catch {
      result = { ok: false, uncertain: true };
    }
    const state = result.ok
      ? "ACCEPTED"
      : result.uncertain
        ? "UNKNOWN"
        : result.error?.includes("Marketing preferences")
          ? "SUPPRESSED"
          : "FAILED";
    await query(
      "UPDATE lifecycle_events SET state=$2,provider_id=$3,lease_until=NULL,next_attempt_at=now()+interval '1 day',last_error=$4,updated_at=now() WHERE id=$1",
      [
        event.id,
        state,
        result.ok ? result.providerId || null : null,
        result.ok
          ? null
          : state === "UNKNOWN"
            ? "SUBMISSION_UNCONFIRMED"
            : state === "SUPPRESSED"
              ? "PREFERENCES"
              : "PROVIDER_REJECTED",
      ],
    );
    if (result.ok) accepted++;
    else if (state === "UNKNOWN") unknown++;
    else if (state === "FAILED") failed++;
  }
  await reconcileLifecycleMail();
  await query(
    "UPDATE lifecycle_settings SET last_dispatch_at=now() WHERE id=true",
  );
  return { accepted, failed, unknown };
}
export async function runLifecycle(budgetMs = 7000) {
  if (!(await lifecycleInstalled())) return { installed: false };
  await reconcileLifecycleMail();
  const scan = await reconcileLifecycle();
  const delivery = await dispatchLifecycle(10, budgetMs);
  return { installed: true, ...scan, ...delivery };
}
