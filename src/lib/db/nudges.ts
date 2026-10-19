import "server-only";
import { getSql } from "./client";
import { getNotificationPrefs } from "./push";
import { conditionHolds, evaluateNudges, type NudgeContext, type NudgeState } from "@/lib/ai/nudges";
import { sendNudgePush } from "@/lib/notify";
import { getConfig, getContract, getWalletSettings } from "./receptionist";

/**
 * The database half of the nudge engine: work out what is genuinely missing for
 * one business, decide whether interrupting them is warranted, send at most one
 * notification, and record it.
 *
 * Everything here is read-only until the final send, so evaluating a business
 * that has nothing missing costs four cheap queries and no writes.
 */

/** What is missing for this organization, from data the app already has. */
async function loadNudgeContext(orgId: string): Promise<NudgeContext> {
  const sql = getSql();

  const [contract, config, wallet, services, site, bookings, payments, overdue] = await Promise.all([
    getContract(orgId),
    getConfig(orgId),
    getWalletSettings(orgId),
    sql`SELECT COUNT(*)::int AS n FROM services WHERE organization_id = ${orgId} AND active = true`,
    sql`SELECT published FROM business_profiles WHERE organization_id = ${orgId}`,
    sql`SELECT COUNT(*)::int AS n FROM bookings WHERE organization_id = ${orgId}`,
    sql`SELECT COUNT(*)::int AS n FROM payment_settings WHERE organization_id = ${orgId} AND paystack_subaccount_code <> ''`,
    sql`
      SELECT COUNT(*)::int AS n FROM invoices
      WHERE organization_id = ${orgId} AND status IN ('pending', 'overdue') AND due_date < CURRENT_DATE - INTERVAL '30 days'
    `,
  ]);

  const activeServices = Number((services[0] as Record<string, unknown>)?.n ?? 0);
  const published = Boolean((site[0] as Record<string, unknown>)?.published);
  const bookingCount = Number((bookings[0] as Record<string, unknown>)?.n ?? 0);
  const hasPayments = Number((payments[0] as Record<string, unknown>)?.n ?? 0) > 0;

  // The receptionist is "on" when a contract is running. Without one, none of
  // the receptionist-specific nudges apply — telling somebody to add a card for
  // a product they don't have would be nonsense.
  const receptionistOn = Boolean(contract && contract.status !== "cancelled");

  return {
    hasContract: receptionistOn,
    needsCard: receptionistOn && !contract?.hasCard,
    needsNumber: receptionistOn && !(config?.voiceNumber ?? ""),
    needsWalletTopUp: receptionistOn && wallet.freeExhausted && wallet.paidKobo <= 0,
    needsServices: activeServices === 0,
    needsPayments: !hasPayments,
    noBookingsYet: published && bookingCount === 0,
    hasOverdueInvoice: Number((overdue[0] as Record<string, unknown>)?.n ?? 0) > 0,
  };
}

async function loadNudgeState(orgId: string): Promise<NudgeState> {
  const sql = getSql();
  const rows = await sql`SELECT nudge_id, sent_count, last_sent_at, resolved_at FROM org_nudges WHERE organization_id = ${orgId}`;
  const sent: NudgeState["sent"] = {};
  for (const row of rows) {
    sent[row.nudge_id as string] = {
      sentCount: Number(row.sent_count ?? 0),
      lastSentAt: row.last_sent_at ? new Date(row.last_sent_at as string).toISOString() : null,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at as string).toISOString() : null,
    };
  }
  return { sent };
}

async function recordNudgeSent(orgId: string, nudgeId: string): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO org_nudges (organization_id, nudge_id, sent_count, first_sent_at, last_sent_at)
    VALUES (${orgId}, ${nudgeId}, 1, now(), now())
    ON CONFLICT (organization_id, nudge_id) DO UPDATE SET
      sent_count = org_nudges.sent_count + 1,
      last_sent_at = now()
  `;
}

/**
 * Marks nudges whose condition no longer holds as resolved.
 *
 * This is what lets a repeatable nudge come back the next time it is true,
 * rather than being silenced forever by its first send. Called for every
 * organization in the run, whether or not anything is sent.
 */
async function resolveClearedNudges(orgId: string, ctx: NudgeContext): Promise<void> {
  const sql = getSql();
  // Re-using the pure condition function keeps "resolved" and "applies" from
  // ever disagreeing — the thing that had no card on Monday must be the same
  // thing that is resolved on Friday.
  const cleared = (["add_card", "add_number", "add_services", "top_up_wallet", "connect_payments", "share_booking_link", "chase_overdue_invoice"] as const).filter(
    (id) => !conditionHolds(id, ctx),
  );
  // One statement per id rather than an array parameter: a handful of tiny
  // updates is cheaper than getting array binding right, and this runs weekly.
  for (const nudgeId of cleared) {
    await sql`
      UPDATE org_nudges SET resolved_at = now()
      WHERE organization_id = ${orgId} AND nudge_id = ${nudgeId} AND resolved_at IS NULL
    `;
  }
}

export interface NudgeRunResult {
  evaluated: number;
  sent: number;
  skipped: number;
  details: Array<{ organizationId: string; nudgeId: string | null; reason: string }>;
}

/**
 * Evaluates and (at most) sends one nudge per organization.
 *
 * Bounded by the caller's limit. Cheap to run daily: the context is four
 * aggregate queries, and nothing is written unless a notification actually
 * goes out.
 */
export async function runNudges(orgIds: string[]): Promise<NudgeRunResult> {
  const details: NudgeRunResult["details"] = [];
  let sent = 0;

  for (const organizationId of orgIds) {
    try {
      // Respect the global switch before doing any work: a business that turned
      // notifications off should not be evaluated at all.
      const prefs = await getNotificationPrefs(organizationId);
      if (!prefs.pushEnabled || !prefs.payoutAlerts) {
        details.push({ organizationId, nudgeId: null, reason: "notifications off" });
        continue;
      }

      const [ctx, state] = await Promise.all([loadNudgeContext(organizationId), loadNudgeState(organizationId)]);
      await resolveClearedNudges(organizationId, ctx);

      const now = new Date();
      const decision = evaluateNudges(ctx, state, now);
      if (!decision) {
        details.push({ organizationId, nudgeId: null, reason: "nothing missing" });
        continue;
      }

      const delivered = await sendNudgePush(organizationId, {
        title: decision.nudge.title,
        body: decision.nudge.body,
        url: decision.nudge.url,
      });

      if (delivered) {
        await recordNudgeSent(organizationId, decision.nudge.id);
        sent += 1;
        details.push({ organizationId, nudgeId: decision.nudge.id, reason: decision.reason });
      } else {
        details.push({ organizationId, nudgeId: decision.nudge.id, reason: "no device subscribed" });
      }
    } catch (err) {
      console.error("nudge run failed for org", organizationId, err);
      details.push({ organizationId, nudgeId: null, reason: "error" });
    }
  }

  return { evaluated: orgIds.length, sent, skipped: orgIds.length - sent, details };
}

/** Every organization with a device subscribed — the nudge run's work list.
 * No point evaluating a business that cannot receive a notification. */
export async function listNudgeCandidates(limit = 200): Promise<string[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT DISTINCT s.organization_id
    FROM push_subscriptions s
    JOIN notification_preferences p ON p.organization_id = s.organization_id
    WHERE p.push_enabled = true AND p.payout_alerts = true
    LIMIT ${limit}
  `;
  return rows.map((row) => row.organization_id as string);
}
