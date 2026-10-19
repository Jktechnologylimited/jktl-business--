import "server-only";
import { getSql } from "./client";
import { isoDate, kobo } from "./rows";
import { aiUsageCostKobo, typicalSessionCostKobo } from "@/lib/ai/pricing";
import type { PackId } from "@/lib/ai/industry-packs";
import type {
  AiReceptionistConfig,
  ChatChannel,
  ChatMessageRole,
  ChatSession,
  ChatSessionStatus,
  MissedCall,
  MissedCallStatus,
  ReceptionistContract,
  ReceptionistMessage,
  ReceptionistStats,
  WalletSnapshot,
  WalletTransaction,
  WalletTransactionKind,
} from "@/lib/ai/types";

/**
 * Every database read and write for the AI receptionist, in one module — the
 * intercept pipeline (missed calls), the conversation (sessions and
 * messages), the money (wallet ledger) and the contract.
 *
 * Two rules hold throughout, both inherited from the rest of `src/lib/db/`:
 *
 *   1. **Money is integer kobo**, converted at the boundary by `kobo()`.
 *   2. **The wallet balance is never stored.** It is `SUM(amount_kobo)` over
 *      `comm_wallet_transactions`, and `chargeWallet` is a single atomic
 *      statement that both checks sufficiency and inserts the debit, so two
 *      simultaneous sends cannot both pass a check that only one of them can
 *      afford.
 *
 * Public/unauthenticated callers (the chat page and the `getChatSession`
 * path) resolve a tenant *from* a session id; they never pass one in. Every
 * staff-facing function takes an `orgId` that came from `requireSession()`.
 */

/* -------------------------------------------------------------------------- */
/* Mappers                                                                    */
/* -------------------------------------------------------------------------- */

function mapConfig(row: Record<string, unknown>): AiReceptionistConfig {
  return {
    organizationId: row.organization_id as string,
    enabled: Boolean(row.enabled),
    packId: (row.pack_id as PackId) ?? "general",
    voiceNumber: (row.voice_number as string) ?? "",
    smsSenderId: (row.sms_sender_id as string) ?? "",
    greeting: (row.greeting as string) ?? "",
    escalationPhone: (row.escalation_phone as string) ?? "",
    escalationEmail: (row.escalation_email as string) ?? "",
    triageEnabled: row.triage_enabled === undefined ? true : Boolean(row.triage_enabled),
    autoBook: row.auto_book === undefined ? true : Boolean(row.auto_book),
    averageConsultValueKobo: kobo((row.average_consult_value_kobo as string) ?? 0),
    quietHoursStart: (row.quiet_hours_start as string) ?? "",
    quietHoursEnd: (row.quiet_hours_end as string) ?? "",
  };
}

function mapMissedCall(row: Record<string, unknown>): MissedCall {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    callerPhone: row.caller_phone as string,
    calledNumber: (row.called_number as string) ?? "",
    provider: (row.provider as string) ?? "termii",
    providerCallId: (row.provider_call_id as string) ?? "",
    receivedAt: isoDate(row.received_at as string),
    status: row.status as MissedCallStatus,
    customerId: (row.customer_id as string) ?? null,
    chatSessionId: (row.chat_session_id as string) ?? null,
    smsBody: (row.sms_body as string) ?? "",
    smsUnits: Number(row.sms_units ?? 0),
    smsCostKobo: kobo((row.sms_cost_kobo as string) ?? 0),
    smsSentAt: row.sms_sent_at ? isoDate(row.sms_sent_at as string) : null,
    smsError: (row.sms_error as string) ?? "",
    recoveredBookingId: (row.recovered_booking_id as string) ?? null,
    recoveredValueKobo: kobo((row.recovered_value_kobo as string) ?? 0),
    notes: (row.notes as string) ?? "",
    createdAt: isoDate(row.created_at as string),
  };
}

function mapSession(row: Record<string, unknown>): ChatSession {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    missedCallId: (row.missed_call_id as string) ?? null,
    channel: (row.channel as ChatChannel) ?? "missed_call_sms",
    visitorPhone: (row.visitor_phone as string) ?? "",
    visitorKey: (row.visitor_key as string) ?? "",
    visitorName: (row.visitor_name as string) ?? "",
    customerId: (row.customer_id as string) ?? null,
    status: (row.status as ChatSessionStatus) ?? "active",
    escalated: Boolean(row.escalated),
    escalationRuleId: (row.escalation_rule_id as string) ?? "",
    escalationReason: (row.escalation_reason as string) ?? "",
    escalatedAt: row.escalated_at ? isoDate(row.escalated_at as string) : null,
    intent: (row.intent as string) ?? "",
    bookingId: (row.booking_id as string) ?? null,
    packId: (row.pack_id as PackId) ?? "general",
    model: (row.model as string) ?? "",
    tokensIn: Number(row.tokens_in ?? 0),
    tokensOut: Number(row.tokens_out ?? 0),
    cachedTokensIn: Number(row.cached_tokens_in ?? 0),
    aiCostKobo: kobo((row.ai_cost_kobo as string) ?? 0),
    startedAt: isoDate(row.started_at as string),
    lastMessageAt: isoDate(row.last_message_at as string),
    endedAt: row.ended_at ? isoDate(row.ended_at as string) : null,
  };
}

function mapMessage(row: Record<string, unknown>): ReceptionistMessage {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    role: row.role as ChatMessageRole,
    content: row.content as string,
    toolName: (row.tool_name as string) ?? "",
    createdAt: isoDate(row.created_at as string),
  };
}

function mapTransaction(row: Record<string, unknown>): WalletTransaction {
  return {
    id: row.id as string,
    kind: row.kind as WalletTransactionKind,
    amountKobo: kobo(row.amount_kobo as string),
    freeAmountKobo: kobo((row.free_amount_kobo as string) ?? 0),
    paidAmountKobo: kobo((row.paid_amount_kobo as string) ?? 0),
    quantity: Number(row.quantity ?? 1),
    unitCostKobo: kobo((row.unit_cost_kobo as string) ?? 0),
    balanceAfterKobo: kobo((row.balance_after_kobo as string) ?? 0),
    provider: (row.provider as string) ?? "",
    providerRef: (row.provider_ref as string) ?? "",
    description: (row.description as string) ?? "",
    missedCallId: (row.missed_call_id as string) ?? null,
    sessionId: (row.session_id as string) ?? null,
    createdAt: isoDate(row.created_at as string),
  };
}

function mapContract(row: Record<string, unknown>): ReceptionistContract {
  return {
    organizationId: row.organization_id as string,
    setupFeeKobo: kobo((row.setup_fee_kobo as string) ?? 0),
    setupMonths: Number(row.setup_months ?? 6),
    setupMonthlyKobo: kobo((row.setup_monthly_kobo as string) ?? 0),
    monthlyFeeKobo: kobo((row.monthly_fee_kobo as string) ?? 0),
    startedAt: row.started_at ? isoDate(row.started_at as string) : null,
    setupPaymentRef: (row.setup_payment_ref as string) ?? "",
    includedTokenCreditKobo: kobo((row.included_token_credit_kobo as string) ?? 0),
    billingStartsAt: row.billing_starts_at ? isoDate(row.billing_starts_at as string) : null,
    nextChargeAt: row.next_charge_at ? isoDate(row.next_charge_at as string) : null,
    lastChargeAt: row.last_charge_at ? isoDate(row.last_charge_at as string) : null,
    chargesPaid: Number(row.charges_paid ?? 0),
    hasCard: ((row.paystack_authorization_code as string) ?? "") !== "",
    cardBrand: (row.card_brand as string) ?? "",
    cardLast4: (row.card_last4 as string) ?? "",
    cardExpMonth: (row.card_exp_month as string) ?? "",
    cardExpYear: (row.card_exp_year as string) ?? "",
    autoChargeEnabled: row.auto_charge_enabled === undefined ? true : Boolean(row.auto_charge_enabled),
    lastChargeError: (row.last_charge_error as string) ?? "",
    lastChargeAttemptAt: row.last_charge_attempt_at ? isoDate(row.last_charge_attempt_at as string) : null,
    status: (row.status as ReceptionistContract["status"]) ?? "pending",
    cancelledAt: row.cancelled_at ? isoDate(row.cancelled_at as string) : null,
    cancelReason: (row.cancel_reason as string) ?? "",
    notes: (row.notes as string) ?? "",
  };
}

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

export async function getConfig(orgId: string): Promise<AiReceptionistConfig | null> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM ai_receptionist_config WHERE organization_id = ${orgId}`;
  return rows[0] ? mapConfig(rows[0]) : null;
}

/**
 * Idempotently creates the config, wallet settings and (pending) contract
 * rows for an organization. Called when a business first opens the console
 * and at the end of the setup-fee flow, so neither path needs to know
 * whether the other already ran.
 *
 * `defaults` comes from the business profile, which is what makes a
 * `mens_health` business open with the men's health pack and the clinic's
 * escalation number already in place.
 */
export async function ensureSetup(
  orgId: string,
  defaults: { packId: PackId; escalationPhone?: string; escalationEmail?: string },
): Promise<void> {
  const sql = getSql();
  await Promise.all([
    sql`
      INSERT INTO ai_receptionist_config (organization_id, pack_id, escalation_phone, escalation_email)
      VALUES (${orgId}, ${defaults.packId}, ${defaults.escalationPhone ?? ""}, ${defaults.escalationEmail ?? ""})
      ON CONFLICT (organization_id) DO NOTHING
    `,
    sql`
      INSERT INTO comm_wallet_settings (organization_id) VALUES (${orgId})
      ON CONFLICT (organization_id) DO NOTHING
    `,
    sql`
      INSERT INTO ai_receptionist_contracts (organization_id) VALUES (${orgId})
      ON CONFLICT (organization_id) DO NOTHING
    `,
  ]);
}

export interface ConfigInput {
  enabled: boolean;
  packId: PackId;
  voiceNumber: string;
  smsSenderId: string;
  greeting: string;
  escalationPhone: string;
  escalationEmail: string;
  triageEnabled: boolean;
  autoBook: boolean;
  averageConsultValueKobo: number;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export async function updateConfig(orgId: string, input: ConfigInput): Promise<AiReceptionistConfig> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO ai_receptionist_config (
      organization_id, enabled, pack_id, voice_number, sms_sender_id, greeting,
      escalation_phone, escalation_email, triage_enabled, auto_book,
      average_consult_value_kobo, quiet_hours_start, quiet_hours_end, updated_at
    )
    VALUES (
      ${orgId}, ${input.enabled}, ${input.packId}, ${input.voiceNumber}, ${input.smsSenderId}, ${input.greeting},
      ${input.escalationPhone}, ${input.escalationEmail}, ${input.triageEnabled}, ${input.autoBook},
      ${input.averageConsultValueKobo}, ${input.quietHoursStart}, ${input.quietHoursEnd}, now()
    )
    ON CONFLICT (organization_id) DO UPDATE SET
      enabled = excluded.enabled,
      pack_id = excluded.pack_id,
      voice_number = excluded.voice_number,
      sms_sender_id = excluded.sms_sender_id,
      greeting = excluded.greeting,
      escalation_phone = excluded.escalation_phone,
      escalation_email = excluded.escalation_email,
      triage_enabled = excluded.triage_enabled,
      auto_book = excluded.auto_book,
      average_consult_value_kobo = excluded.average_consult_value_kobo,
      quiet_hours_start = excluded.quiet_hours_start,
      quiet_hours_end = excluded.quiet_hours_end,
      updated_at = now()
    RETURNING *
  `;
  return mapConfig(rows[0]);
}

/**
 * Resolves an inbound call to its tenant. This is the one lookup in the
 * pipeline that runs before any session exists, so it is also the one place an
 * unknown dialled number must fail *closed* — no match means no SMS, and
 * therefore no chance of texting a patient on behalf of the wrong clinic.
 *
 * Matches on the stored `voice_number_key` (the last nine digits, a generated
 * column) so a stored "0803 441 2291" and a webhook's "+2348034412291" resolve
 * to the same row — and so two businesses cannot register the same line
 * written differently. The unique index on that column is what makes at most
 * one row able to match.
 */
export async function findConfigByVoiceNumber(number: string): Promise<AiReceptionistConfig | null> {
  const digits = (number || "").replace(/\D/g, "");
  if (!digits) return null;
  const key = digits.slice(-9);
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM ai_receptionist_config
    WHERE voice_number_key = ${key} AND voice_number_key <> ''
    LIMIT 1
  `;
  return rows[0] ? mapConfig(rows[0]) : null;
}

/* -------------------------------------------------------------------------- */
/* Missed calls                                                               */
/* -------------------------------------------------------------------------- */

export interface CreateMissedCallInput {
  organizationId: string;
  callerPhone: string;
  calledNumber: string;
  providerCallId: string;
  receivedAt: Date;
  provider?: string;
}

/**
 * Records the inbound missed call.
 *
 * `ON CONFLICT DO NOTHING` with no conflict target deliberately covers both
 * replay guards declared in migration 016 (the provider's call id, and the
 * org+caller+timestamp triple), because a retried webhook must be harmless
 * whichever one catches it. A duplicate returns the existing row with
 * `duplicate: true` so the caller can log it and stop — critically, *without*
 * sending a second SMS or charging the wallet twice.
 */
export async function createMissedCall(
  input: CreateMissedCallInput,
): Promise<{ call: MissedCall; duplicate: boolean } | null> {
  const sql = getSql();
  const inserted = await sql`
    INSERT INTO missed_calls (organization_id, caller_phone, called_number, provider, provider_call_id, received_at)
    VALUES (
      ${input.organizationId}, ${input.callerPhone}, ${input.calledNumber},
      ${input.provider ?? "termii"}, ${input.providerCallId}, ${input.receivedAt.toISOString()}
    )
    ON CONFLICT DO NOTHING
    RETURNING *
  `;
  if (inserted[0]) return { call: mapMissedCall(inserted[0]), duplicate: false };

  // Nothing inserted: find which guard fired so the caller has the row.
  const existing = input.providerCallId
    ? await sql`
        SELECT * FROM missed_calls
        WHERE provider = ${input.provider ?? "termii"} AND provider_call_id = ${input.providerCallId}
        LIMIT 1
      `
    : [];
  const fallback =
    existing[0] ??
    (
      await sql`
        SELECT * FROM missed_calls
        WHERE organization_id = ${input.organizationId}
          AND caller_phone = ${input.callerPhone}
          AND received_at = ${input.receivedAt.toISOString()}
        LIMIT 1
      `
    )[0];
  return fallback ? { call: mapMissedCall(fallback), duplicate: true } : null;
}

export async function getMissedCall(orgId: string, id: string): Promise<MissedCall | null> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM missed_calls WHERE id = ${id} AND organization_id = ${orgId}`;
  return rows[0] ? mapMissedCall(rows[0]) : null;
}

export async function listMissedCalls(orgId: string, limit = 50): Promise<MissedCall[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM missed_calls WHERE organization_id = ${orgId} ORDER BY received_at DESC LIMIT ${limit}
  `;
  return rows.map(mapMissedCall);
}

export interface MissedCallPatch {
  status?: MissedCallStatus;
  customerId?: string | null;
  chatSessionId?: string | null;
  smsBody?: string;
  smsUnits?: number;
  smsCostKobo?: number;
  smsProviderRef?: string;
  smsSentAt?: string | null;
  smsError?: string;
  recoveredBookingId?: string | null;
  recoveredValueKobo?: number;
  notes?: string;
}

/**
 * Partial update via COALESCE: an undefined field in the patch leaves the
 * column untouched. That keeps the pipeline's many small transitions (attach
 * a session, record the send, mark recovered) as separate single-purpose
 * writes instead of one wide row that has to be read, mutated and written
 * back — which is how a concurrent webhook ends up clobbering a booking.
 */
export async function updateMissedCall(orgId: string, id: string, patch: MissedCallPatch): Promise<MissedCall | null> {
  const sql = getSql();
  const rows = await sql`
    UPDATE missed_calls SET
      status = COALESCE(${patch.status ?? null}, status),
      customer_id = COALESCE(${patch.customerId ?? null}, customer_id),
      chat_session_id = COALESCE(${patch.chatSessionId ?? null}, chat_session_id),
      sms_body = COALESCE(${patch.smsBody ?? null}, sms_body),
      sms_units = COALESCE(${patch.smsUnits ?? null}, sms_units),
      sms_cost_kobo = COALESCE(${patch.smsCostKobo ?? null}, sms_cost_kobo),
      sms_provider_ref = COALESCE(${patch.smsProviderRef ?? null}, sms_provider_ref),
      sms_sent_at = COALESCE(${patch.smsSentAt ?? null}, sms_sent_at),
      sms_error = COALESCE(${patch.smsError ?? null}, sms_error),
      recovered_booking_id = COALESCE(${patch.recoveredBookingId ?? null}, recovered_booking_id),
      recovered_value_kobo = COALESCE(${patch.recoveredValueKobo ?? null}, recovered_value_kobo),
      notes = COALESCE(${patch.notes ?? null}, notes)
    WHERE id = ${id} AND organization_id = ${orgId}
    RETURNING *
  `;
  return rows[0] ? mapMissedCall(rows[0]) : null;
}

/**
 * Snapshot of the intercept funnel over a window — the numbers behind the
 * ROI panel. Counted from `missed_calls` rather than recomputed from chat
 * sessions, so a patient who never taps the link still shows up as a missed
 * call that was texted and didn't convert (which is the honest denominator).
 */
export async function getStats(orgId: string, windowDays = 30): Promise<ReceptionistStats> {
  const sql = getSql();
  const [callRows, costRows] = await Promise.all([
    sql`
      SELECT
        COUNT(*)::int AS missed_calls,
        COUNT(*) FILTER (WHERE status IN ('sms_sent', 'chat_opened', 'booked', 'recovered'))::int AS sms_sent,
        COUNT(*) FILTER (WHERE status = 'sms_failed')::int AS sms_failed,
        COUNT(*) FILTER (WHERE status = 'sms_blocked')::int AS sms_blocked,
        COUNT(*) FILTER (WHERE status IN ('chat_opened', 'booked', 'recovered'))::int AS chats_opened,
        COUNT(*) FILTER (WHERE status IN ('booked', 'recovered'))::int AS bookings,
        COALESCE(SUM(recovered_value_kobo), 0)::bigint AS recovered_value_kobo,
        COALESCE(SUM(sms_cost_kobo), 0)::bigint AS sms_cost_kobo
      FROM missed_calls
      WHERE organization_id = ${orgId} AND received_at >= now() - ${windowDays} * interval '1 day'
    `,
    sql`
      SELECT COALESCE(SUM(ai_cost_kobo), 0)::bigint AS ai_cost_kobo
      FROM ai_chat_sessions
      WHERE organization_id = ${orgId} AND started_at >= now() - ${windowDays} * interval '1 day'
    `,
  ]);

  const row = (callRows[0] ?? {}) as Record<string, unknown>;
  const costRow = (costRows[0] ?? {}) as Record<string, unknown>;
  const missedCalls = Number(row.missed_calls ?? 0);
  const bookings = Number(row.bookings ?? 0);
  return {
    windowDays,
    missedCalls,
    smsSent: Number(row.sms_sent ?? 0),
    smsFailed: Number(row.sms_failed ?? 0),
    smsBlocked: Number(row.sms_blocked ?? 0),
    chatsOpened: Number(row.chats_opened ?? 0),
    bookings,
    recoveredValueKobo: kobo((row.recovered_value_kobo as string) ?? 0),
    smsCostKobo: kobo((row.sms_cost_kobo as string) ?? 0),
    aiCostKobo: kobo((costRow.ai_cost_kobo as string) ?? 0),
    recoveryRate: missedCalls > 0 ? bookings / missedCalls : 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Chat sessions and messages                                                 */
/* -------------------------------------------------------------------------- */

export interface CreateSessionInput {
  organizationId: string;
  missedCallId?: string | null;
  channel: ChatChannel;
  visitorPhone: string;
  /** Browser-held continuity token — only the website widget sends one. */
  visitorKey?: string;
  visitorName?: string;
  customerId?: string | null;
  packId: PackId;
}

export async function createChatSession(orgId: string, id: string, input: CreateSessionInput): Promise<ChatSession> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO ai_chat_sessions (
      id, organization_id, missed_call_id, channel, visitor_phone, visitor_key, visitor_name, customer_id, pack_id
    )
    VALUES (
      ${id}, ${orgId}, ${input.missedCallId ?? null}, ${input.channel},
      ${input.visitorPhone}, ${input.visitorKey ?? ""}, ${input.visitorName ?? ""}, ${input.customerId ?? null}, ${input.packId}
    )
    ON CONFLICT (id) DO UPDATE SET
      visitor_phone = excluded.visitor_phone,
      visitor_key = excluded.visitor_key,
      visitor_name = excluded.visitor_name,
      customer_id = excluded.customer_id
    RETURNING *
  `;
  return mapSession(rows[0]);
}

/**
 * Loads a session by its own id, with no organization filter — the public
 * chat page's entry point. Safe because the id is a random UUID that only
 * ever travels inside the SMS link, and because the caller receives the
 * session's *own* organization id rather than supplying one; nothing can be
 * read across tenants by guessing, and there is nothing to guess.
 */
export async function getChatSession(id: string): Promise<ChatSession | null> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM ai_chat_sessions WHERE id = ${id}`;
  return rows[0] ? mapSession(rows[0]) : null;
}

export async function getSessionByMissedCallId(missedCallId: string): Promise<ChatSession | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM ai_chat_sessions WHERE missed_call_id = ${missedCallId} ORDER BY started_at DESC LIMIT 1
  `;
  return rows[0] ? mapSession(rows[0]) : null;
}

/** The most recent open chat for a phone number within one tenant — how the
 * website widget resumes a conversation a patient started from an SMS. */
export async function findOpenSessionByPhone(orgId: string, phone: string): Promise<ChatSession | null> {
  if (!phone.trim()) return null;
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM ai_chat_sessions
    WHERE organization_id = ${orgId} AND visitor_phone = ${phone} AND status = 'active'
    ORDER BY started_at DESC LIMIT 1
  `;
  return rows[0] ? mapSession(rows[0]) : null;
}

/**
 * Resumes a website visitor's conversation from the continuity token their
 * browser is holding, so a page reload or a return visit continues the same
 * thread instead of spawning a new session (and a new prompt) every time.
 *
 * Only ever matches a session that is still active: a booked or handed-off
 * conversation must not be silently reopened by a stale token.
 */
export async function findWidgetSessionByVisitorKey(orgId: string, visitorKey: string): Promise<ChatSession | null> {
  if (!visitorKey.trim()) return null;
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM ai_chat_sessions
    WHERE organization_id = ${orgId} AND visitor_key = ${visitorKey} AND status = 'active'
    ORDER BY started_at DESC LIMIT 1
  `;
  return rows[0] ? mapSession(rows[0]) : null;
}

/**
 * Rate-limits session creation per visitor token. Without this, a public,
 * unauthenticated endpoint that mints a session per call is a free way to run
 * up inference cost: one session, then a handful of turns each, forever.
 * A visitor gets one new conversation per hour; after that they resume the
 * one they already have.
 */
export async function countRecentWidgetSessions(orgId: string, visitorKey: string, sinceMinutes = 60): Promise<number> {
  if (!visitorKey.trim()) return 0;
  const sql = getSql();
  const rows = await sql`
    SELECT COUNT(*)::int AS n FROM ai_chat_sessions
    WHERE organization_id = ${orgId}
      AND visitor_key = ${visitorKey}
      AND started_at >= now() - ${sinceMinutes} * interval '1 minute'
  `;
  return Number(((rows[0] ?? {}) as Record<string, unknown>).n ?? 0);
}

export async function listChatSessions(orgId: string, limit = 25): Promise<ChatSession[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM ai_chat_sessions WHERE organization_id = ${orgId} ORDER BY started_at DESC LIMIT ${limit}
  `;
  return rows.map(mapSession);
}

export interface SessionPatch {
  visitorName?: string;
  visitorPhone?: string;
  customerId?: string | null;
  status?: ChatSessionStatus;
  escalated?: boolean;
  escalationRuleId?: string;
  escalationReason?: string;
  escalatedAt?: string | null;
  intent?: string;
  bookingId?: string | null;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  cachedTokensIn?: number;
  aiCostKobo?: number;
  endedAt?: string | null;
}

export async function updateChatSession(id: string, patch: SessionPatch): Promise<ChatSession | null> {
  const sql = getSql();
  const rows = await sql`
    UPDATE ai_chat_sessions SET
      visitor_name = COALESCE(${patch.visitorName ?? null}, visitor_name),
      visitor_phone = COALESCE(${patch.visitorPhone ?? null}, visitor_phone),
      customer_id = COALESCE(${patch.customerId ?? null}, customer_id),
      status = COALESCE(${patch.status ?? null}, status),
      escalated = COALESCE(${patch.escalated ?? null}, escalated),
      escalation_rule_id = COALESCE(${patch.escalationRuleId ?? null}, escalation_rule_id),
      escalation_reason = COALESCE(${patch.escalationReason ?? null}, escalation_reason),
      escalated_at = COALESCE(${patch.escalatedAt ?? null}, escalated_at),
      intent = COALESCE(${patch.intent ?? null}, intent),
      booking_id = COALESCE(${patch.bookingId ?? null}, booking_id),
      model = COALESCE(${patch.model ?? null}, model),
      tokens_in = COALESCE(${patch.tokensIn ?? null}, tokens_in),
      tokens_out = COALESCE(${patch.tokensOut ?? null}, tokens_out),
      cached_tokens_in = COALESCE(${patch.cachedTokensIn ?? null}, cached_tokens_in),
      ai_cost_kobo = COALESCE(${patch.aiCostKobo ?? null}, ai_cost_kobo),
      ended_at = COALESCE(${patch.endedAt ?? null}, ended_at),
      last_message_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] ? mapSession(rows[0]) : null;
}

export interface AppendMessageInput {
  sessionId: string;
  organizationId: string;
  role: ChatMessageRole;
  content: string;
  toolName?: string;
  toolPayload?: unknown;
  tokensIn?: number;
  tokensOut?: number;
}

export async function appendChatMessage(input: AppendMessageInput): Promise<ReceptionistMessage> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO ai_chat_messages (session_id, organization_id, role, content, tool_name, tool_payload, tokens_in, tokens_out)
    VALUES (
      ${input.sessionId}, ${input.organizationId}, ${input.role}, ${input.content},
      ${input.toolName ?? ""}, ${input.toolPayload ? JSON.stringify(input.toolPayload) : null},
      ${input.tokensIn ?? 0}, ${input.tokensOut ?? 0}
    )
    RETURNING *
  `;
  return mapMessage(rows[0]);
}

/** The replayable transcript, oldest first. `limit` is applied to the most
 * recent messages and then reversed, so a long conversation keeps its recent
 * context rather than its opening pleasantries. */
export async function listChatMessages(sessionId: string, limit = 60): Promise<ReceptionistMessage[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM (
      SELECT * FROM ai_chat_messages WHERE session_id = ${sessionId} ORDER BY created_at DESC LIMIT ${limit}
    ) recent ORDER BY created_at ASC
  `;
  return rows.map(mapMessage);
}

/* -------------------------------------------------------------------------- */
/* The communication wallet                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The wallet as the console shows it: total, plus the free/paid split.
 *
 * The split is what makes the "free credits first" offer legible — a clinic
 * needs to see that it is spending the allocation it was given, and know the
 * moment that changes. `freeExhausted` and `hasToppedUp` are the two flags the
 * UI switches its messaging on, so the tone changes exactly once rather than
 * flickering between states.
 */
export async function getWalletSettings(orgId: string): Promise<WalletSnapshot> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM comm_wallet_settings WHERE organization_id = ${orgId}`;
  const row = (rows[0] ?? {}) as Record<string, unknown>;
  const settings = {
    lowBalanceThresholdKobo: kobo((row.low_balance_threshold_kobo as string) ?? 225_000),
    smsUnitCostKobo: kobo((row.sms_unit_cost_kobo as string) ?? 450),
    whatsappUnitCostKobo: kobo((row.whatsapp_unit_cost_kobo as string) ?? 700),
  };

  const buckets = await sql`
    SELECT
      COALESCE(SUM(amount_kobo), 0)::bigint AS balance,
      COALESCE(SUM(free_amount_kobo), 0)::bigint AS free,
      COALESCE(SUM(paid_amount_kobo), 0)::bigint AS paid,
      COALESCE(SUM(amount_kobo) FILTER (WHERE kind = 'grant'), 0)::bigint AS granted,
      COALESCE(SUM(amount_kobo) FILTER (WHERE kind = 'topup'), 0)::bigint AS topped_up
    FROM comm_wallet_transactions WHERE organization_id = ${orgId}
  `;
  const b = (buckets[0] ?? {}) as Record<string, unknown>;
  const balanceKobo = kobo((b.balance as string) ?? 0);
  const freeKobo = kobo((b.free as string) ?? 0);
  const paidKobo = kobo((b.paid as string) ?? 0);
  const unit = settings.smsUnitCostKobo;

  return {
    balanceKobo,
    freeKobo,
    paidKobo,
    // "Exhausted" means the allocation was actually granted and has been
    // spent — a business that was never granted any free credit is not
    // "exhausted", it simply started on paid balance.
    freeExhausted: kobo((b.granted as string) ?? 0) > 0 && freeKobo <= 0,
    hasToppedUp: kobo((b.topped_up as string) ?? 0) > 0,
    ...settings,
    isLow: balanceKobo < settings.lowBalanceThresholdKobo,
    smsRemaining: unit > 0 ? Math.floor(Math.max(0, balanceKobo) / unit) : 0,
    freeSmsRemaining: unit > 0 ? Math.floor(Math.max(0, freeKobo) / unit) : 0,
  };
}

/**
 * Clinics with a dedicated line to bill this month: an active line, a rental
 * amount, and either no charge recorded for the current period or one that
 * could not be paid.
 */
export async function listLineRentalCandidates(): Promise<string[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT c.organization_id
    FROM ai_receptionist_config c
    WHERE c.line_rental_kobo_per_month > 0
      AND c.line_status IN ('active', 'requested')
      AND NOT EXISTS (
        SELECT 1 FROM line_rental_charges l
        WHERE l.organization_id = c.organization_id
          AND l.period_key = to_char(now() AT TIME ZONE 'Africa/Lagos', 'YYYY-MM')
          AND l.status IN ('charged', 'waived')
      )
  `;
  return rows.map((row) => row.organization_id as string);
}

/** The balance, straight from the ledger. Never a stored counter. */
export async function walletBalance(orgId: string): Promise<number> {
  const sql = getSql();
  const rows = await sql`
    SELECT COALESCE(SUM(amount_kobo), 0)::bigint AS balance
    FROM comm_wallet_transactions WHERE organization_id = ${orgId}
  `;
  const row = (rows[0] ?? {}) as Record<string, unknown>;
  return kobo((row.balance as string) ?? 0);
}

export async function listWalletTransactions(orgId: string, limit = 40): Promise<WalletTransaction[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM comm_wallet_transactions
    WHERE organization_id = ${orgId}
    ORDER BY created_at DESC LIMIT ${limit}
  `;
  return rows.map(mapTransaction);
}

export type ChargeResult =
  | { ok: true; transaction: WalletTransaction; duplicate: boolean }
  | { ok: false; reason: "insufficient"; balanceKobo: number; neededKobo: number };

export interface ChargeWalletInput {
  organizationId: string;
  /** Communication spend. Inference cost is never charged here — see the
   * comment on `comm_wallet_transactions` in migration 016. */
  kind: "sms" | "whatsapp" | "voice";
  amountKobo: number;
  quantity?: number;
  unitCostKobo?: number;
  provider?: string;
  providerRef?: string;
  description?: string;
  missedCallId?: string | null;
  sessionId?: string | null;
}

/**
 * Debits the wallet — **the** margin guardrail, and the reason this is one
 * statement rather than a read followed by a write.
 *
 * Two things happen inside that statement:
 *
 *   1. **The sufficiency check.** `WHERE balance >= amount` is evaluated
 *      against the ledger sum in a CTE in the same statement as the insert, so
 *      two webhooks arriving together cannot both see enough money and both
 *      send. If it fails, nothing is inserted and the caller records the
 *      missed call as `sms_blocked`.
 *
 *   2. **Free credit is spent first.** The row is split across two buckets —
 *      `free_amount_kobo` drawn from the free allocation, `paid_amount_kobo`
 *      from money the clinic actually paid — with whatever free credit remains
 *      consumed before a single kobo of paid balance is touched. That is what
 *      makes "here are free credits, top up when they run out" true rather
 *      than decorative, and because the two buckets always sum to
 *      `amount_kobo`, the balance invariant is unchanged.
 *
 * A repeated `providerRef` is treated as a replay: the existing charge is
 * returned rather than a second debit created.
 */
export async function chargeWallet(input: ChargeWalletInput): Promise<ChargeResult> {
  const sql = getSql();
  const amount = Math.max(0, Math.round(input.amountKobo));
  const quantity = input.quantity ?? 1;

  const inserted = await sql`
    WITH buckets AS (
      SELECT
        COALESCE(SUM(amount_kobo), 0) AS total,
        COALESCE(SUM(free_amount_kobo), 0) AS free
      FROM comm_wallet_transactions WHERE organization_id = ${input.organizationId}
    ),
    split AS (
      -- Spend the free allocation first, then paid balance.
      SELECT
        LEAST(GREATEST(buckets.free, 0), ${amount})::bigint AS from_free,
        (${amount} - LEAST(GREATEST(buckets.free, 0), ${amount}))::bigint AS from_paid,
        buckets.total
      FROM buckets
    )
    INSERT INTO comm_wallet_transactions (
      organization_id, kind, amount_kobo, free_amount_kobo, paid_amount_kobo,
      quantity, unit_cost_kobo, balance_after_kobo,
      provider, provider_ref, description, missed_call_id, session_id
    )
    SELECT
      ${input.organizationId}, ${input.kind}, (- (${amount})::bigint),
      (- split.from_free), (- split.from_paid),
      ${quantity}, ${input.unitCostKobo ?? 0}, split.total - (${amount})::bigint,
      ${input.provider ?? ""}, ${input.providerRef ?? ""}, ${input.description ?? ""},
      ${input.missedCallId ?? null}, ${input.sessionId ?? null}
    FROM split
    WHERE split.total >= (${amount})::bigint
    ON CONFLICT DO NOTHING
    RETURNING *
  `;

  if (inserted[0]) return { ok: true, transaction: mapTransaction(inserted[0]), duplicate: false };

  // No row: either a replay (provider ref already charged) or no money.
  if (input.providerRef) {
    const existing = await sql`
      SELECT * FROM comm_wallet_transactions
      WHERE provider = ${input.provider ?? ""} AND provider_ref = ${input.providerRef}
      LIMIT 1
    `;
    if (existing[0]) return { ok: true, transaction: mapTransaction(existing[0]), duplicate: true };
  }

  const balanceKobo = await walletBalance(input.organizationId);
  return { ok: false, reason: "insufficient", balanceKobo, neededKobo: amount };
}

export interface CreditWalletInput {
  organizationId: string;
  /** Only positive-value kinds; a correction in the other direction should be
   * a `chargeWallet` call or an explicit negative adjustment. */
  kind: "topup" | "grant" | "refund";
  amountKobo: number;
  provider?: string;
  providerRef?: string;
  description?: string;
  /** Which bucket the credit lands in. Defaults to paid, so an unlabelled
   * credit is money the clinic is owed rather than free credit we invented. */
  bucket?: "free" | "paid";
}

/**
 * Credits the wallet — a top-up, a refund, or a free grant.
 *
 * The bucket matters: a `grant` lands in the free allocation and is spent
 * first, while a `topup` lands in paid balance. Idempotent on `providerRef`,
 * so a Paystack webhook redelivery (or a repeated free-credit grant) cannot
 * credit twice.
 */
export async function creditWallet(input: CreditWalletInput): Promise<{ transaction: WalletTransaction; duplicate: boolean }> {
  const sql = getSql();
  const amount = Math.max(0, Math.round(input.amountKobo));
  // A grant is free credit by definition; everything else is paid balance.
  const freeKobo = (input.bucket ?? (input.kind === "grant" ? "free" : "paid")) === "free" ? amount : 0;
  const paidKobo = amount - freeKobo;

  const inserted = await sql`
    WITH balance AS (
      SELECT COALESCE(SUM(amount_kobo), 0) AS current
      FROM comm_wallet_transactions WHERE organization_id = ${input.organizationId}
    )
    INSERT INTO comm_wallet_transactions (
      organization_id, kind, amount_kobo, free_amount_kobo, paid_amount_kobo,
      quantity, unit_cost_kobo, balance_after_kobo, provider, provider_ref, description
    )
    SELECT
      ${input.organizationId}, ${input.kind},
      (${amount})::bigint, (${freeKobo})::bigint, (${paidKobo})::bigint,
      1, 0, balance.current + (${amount})::bigint,
      ${input.provider ?? ""}, ${input.providerRef ?? ""}, ${input.description ?? ""}
    FROM balance
    ON CONFLICT DO NOTHING
    RETURNING *
  `;
  if (inserted[0]) return { transaction: mapTransaction(inserted[0]), duplicate: false };

  if (input.providerRef) {
    const existing = await sql`
      SELECT * FROM comm_wallet_transactions
      WHERE provider = ${input.provider ?? ""} AND provider_ref = ${input.providerRef}
      LIMIT 1
    `;
    if (existing[0]) return { transaction: mapTransaction(existing[0]), duplicate: true };
  }
  // Only reachable if the insert failed for a reason other than the replay
  // guard — re-run the read once so the caller still gets a row.
  const rows = await sql`
    SELECT * FROM comm_wallet_transactions WHERE organization_id = ${input.organizationId}
    ORDER BY created_at DESC LIMIT 1
  `;
  return { transaction: mapTransaction(rows[0]), duplicate: false };
}

/**
 * Grants free communication credit, exactly once per key.
 *
 * Keyed on `providerRef` (the ledger's uniqueness constraint does the
 * enforcing), so calling this on every console load or every webhook
 * redelivery grants one allocation, not many.
 */
export async function grantFreeCredits(params: {
  organizationId: string;
  amountKobo: number;
  providerRef: string;
  description?: string;
}): Promise<{ transaction: WalletTransaction; duplicate: boolean }> {
  return creditWallet({
    organizationId: params.organizationId,
    kind: "grant",
    amountKobo: params.amountKobo,
    bucket: "free",
    provider: "jktl",
    providerRef: params.providerRef,
    description: params.description ?? "Free communication credit",
  });
}

/* -------------------------------------------------------------------------- */
/* Contract                                                                   */
/* -------------------------------------------------------------------------- */

export async function getContract(orgId: string): Promise<ReceptionistContract | null> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM ai_receptionist_contracts WHERE organization_id = ${orgId}`;
  return rows[0] ? mapContract(rows[0]) : null;
}

/**
 * Starts the contract.
 *
 * Nothing is paid upfront in this model: the ₦650,000 package is billed as six
 * monthly instalments, so month 1 falls due on `startedAt` and the platform
 * tier takes over at month 7. `billingStartsAt` is computed by
 * `platformPhaseStart()` and passed in, so the schedule rule has exactly one
 * testable definition.
 *
 * Idempotent on an already-started contract: a re-delivered activation cannot
 * move the start date and hand out a second launch credit.
 */
export async function startContract(
  orgId: string,
  params: {
    startedAt: Date;
    billingStartsAt: Date;
    paymentRef: string;
    includedCreditKobo: number;
    monthlyFeeKobo: number;
    setupMonths: number;
    setupMonthlyKobo: number;
  },
): Promise<ReceptionistContract | null> {
  const sql = getSql();
  const rows = await sql`
    UPDATE ai_receptionist_contracts SET
      started_at = COALESCE(started_at, ${params.startedAt.toISOString()}),
      setup_payment_ref = CASE WHEN setup_payment_ref = '' THEN ${params.paymentRef} ELSE setup_payment_ref END,
      included_token_credit_kobo = ${params.includedCreditKobo},
      monthly_fee_kobo = ${params.monthlyFeeKobo},
      setup_months = ${params.setupMonths},
      setup_monthly_kobo = ${params.setupMonthlyKobo},
      billing_starts_at = ${params.billingStartsAt.toISOString()},
      next_charge_at = COALESCE(next_charge_at, ${params.startedAt.toISOString()}),
      status = CASE WHEN status = 'cancelled' THEN status ELSE 'active' END,
      updated_at = now()
    WHERE organization_id = ${orgId}
    RETURNING *
  `;
  return rows[0] ? mapContract(rows[0]) : null;
}

/**
 * Records one collected monthly payment and advances the next due date.
 *
 * `expectedMonth` guards against a double credit: if the contract has already
 * recorded this month's payment, the update matches nothing and the caller can
 * tell the clinic nothing was charged twice. Everything in one statement, so
 * two webhooks arriving together cannot both advance the counter.
 */
export async function recordContractPayment(
  orgId: string,
  params: { paidAt: Date; nextChargeAt: Date; reference: string; expectedMonth: number },
): Promise<{ recorded: boolean; contract: ReceptionistContract | null }> {
  const sql = getSql();
  const rows = await sql`
    UPDATE ai_receptionist_contracts SET
      charges_paid = charges_paid + 1,
      last_charge_at = ${params.paidAt.toISOString()},
      next_charge_at = ${params.nextChargeAt.toISOString()},
      setup_payment_ref = CASE WHEN setup_payment_ref = '' THEN ${params.reference} ELSE setup_payment_ref END,
      status = 'active',
      updated_at = now()
    WHERE organization_id = ${orgId}
      AND status <> 'cancelled'
      AND charges_paid = ${params.expectedMonth}
    RETURNING *
  `;
  if (rows[0]) return { recorded: true, contract: mapContract(rows[0]) };
  return { recorded: false, contract: await getContract(orgId) };
}

/**
 * Cancels the contract — allowed from month 1, with no minimum term and no
 * early-exit fee. Unbilled instalments are simply never billed.
 *
 * What that writes off is not hidden: `cancellationSummary()` in
 * `src/lib/ai/pricing.ts` reports how much of the ₦650,000 package was
 * actually collected, and the console shows it, because the no-lock-in
 * promise is a real cost and someone should be watching it.
 */
export async function cancelContract(
  orgId: string,
  params: { cancelledAt: Date; reason: string },
): Promise<ReceptionistContract | null> {
  const sql = getSql();
  const rows = await sql`
    UPDATE ai_receptionist_contracts SET
      status = 'cancelled',
      cancelled_at = ${params.cancelledAt.toISOString()},
      cancel_reason = ${params.reason},
      -- No further charges are due once cancelled.
      next_charge_at = NULL,
      updated_at = now()
    WHERE organization_id = ${orgId} AND status <> 'cancelled'
    RETURNING *
  `;
  if (rows[0]) return mapContract(rows[0]);
  return getContract(orgId);
}

/** Marks a contract past due after a failed collection, without cancelling
 * it — Paystack retries on its own schedule and the clinic usually just needs
 * to see the invoice. */
export async function markContractPastDue(orgId: string): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE ai_receptionist_contracts SET status = 'past_due', updated_at = now()
    WHERE organization_id = ${orgId} AND status = 'active'
  `;
}

export async function updateContract(
  orgId: string,
  patch: { status?: ReceptionistContract["status"]; nextChargeAt?: string; notes?: string },
): Promise<ReceptionistContract | null> {
  const sql = getSql();
  const rows = await sql`
    UPDATE ai_receptionist_contracts SET
      status = COALESCE(${patch.status ?? null}, status),
      next_charge_at = COALESCE(${patch.nextChargeAt ?? null}, next_charge_at),
      notes = COALESCE(${patch.notes ?? null}, notes),
      updated_at = now()
    WHERE organization_id = ${orgId}
    RETURNING *
  `;
  return rows[0] ? mapContract(rows[0]) : null;
}

/** Active contracts whose next payment has come due — the weekly billing
 * reminder's work list. Cancelled contracts are excluded by definition. */
export async function listContractsDue(limit = 100): Promise<ReceptionistContract[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM ai_receptionist_contracts
    WHERE status IN ('active', 'past_due')
      AND next_charge_at IS NOT NULL
      AND next_charge_at <= now()
    ORDER BY next_charge_at ASC LIMIT ${limit}
  `;
  return rows.map(mapContract);
}

/** Organizations whose comms wallet has dropped below their threshold and
 * who are therefore one send away from the guardrail blocking a callback.
 * Backs the low-balance reminder cron. */
export async function listLowBalanceWallets(limit = 100): Promise<Array<{ organizationId: string; balanceKobo: number; thresholdKobo: number }>> {
  const sql = getSql();
  const rows = await sql`
    SELECT organization_id, balance_kobo, low_balance_threshold_kobo
    FROM comm_wallet_balances
    WHERE is_low = true
    ORDER BY balance_kobo ASC LIMIT ${limit}
  `;
  return rows.map((row) => ({
    organizationId: row.organization_id as string,
    balanceKobo: kobo(row.balance_kobo as string),
    thresholdKobo: kobo(row.low_balance_threshold_kobo as string),
  }));
}

/**
 * What the platform estimates a month of this business's conversations
 * costs, for the console's margin line. Uses observed session usage when
 * there is any, and the documented typical session when there isn't.
 */
export async function estimatedMonthlyAiCostKobo(orgId: string, sessions: number): Promise<number> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      COALESCE(AVG(NULLIF(tokens_in, 0)), 0)::float AS avg_in,
      COALESCE(AVG(NULLIF(cached_tokens_in, 0)), 0)::float AS avg_cached,
      COALESCE(AVG(NULLIF(tokens_out, 0)), 0)::float AS avg_out,
      COUNT(*)::int AS total
    FROM ai_chat_sessions WHERE organization_id = ${orgId}
  `;
  const row = (rows[0] ?? {}) as Record<string, unknown>;
  if (Number(row.total ?? 0) === 0) return 0;
  const perSession = aiUsageCostKobo({
    inputTokens: Number(row.avg_in ?? 0) || 0,
    cachedInputTokens: Number(row.avg_cached ?? 0) || 0,
    outputTokens: Number(row.avg_out ?? 0) || 0,
  });
  return Math.round(perSession * Math.max(0, sessions));
}

/** Re-exported for callers that want the documented figure without
 * importing the pricing module directly. */
export const TYPICAL_SESSION_COST_KOBO = typicalSessionCostKobo();
