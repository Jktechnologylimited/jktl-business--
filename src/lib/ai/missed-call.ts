import "server-only";
import { defaultSenderId, isMessagingConfigured, normalizePhoneFor, parseVoiceWebhook, sendSms } from "@/lib/twilio";
import { AFRICAN_COUNTRIES } from "@/lib/prospects/jurisdictions";
import { buildChatLink, chatBaseUrl, renderSms, smsSegments } from "./sms";
import { getPack, type PackId } from "./industry-packs";
import { createCustomer, findCustomerByPhone } from "@/lib/db/customers";
import { getBusinessProfile } from "@/lib/db/organizations";
import {
  chargeWallet,
  countRecentWidgetSessions,
  createChatSession,
  createMissedCall,
  creditWallet,
  ensureSetup,
  findConfigByVoiceNumber,
  findOpenSessionByPhone,
  findWidgetSessionByVisitorKey,
  getChatSession,
  getWalletSettings,
  updateMissedCall,
} from "@/lib/db/receptionist";

/**
 * The intercept pipeline: an unanswered call becomes a texted link becomes a
 * conversation.
 *
 *   1. read the webhook, tolerantly (Twilio's payload shape varies by call type)
 *   2. resolve the dialled number to a tenant — or fail closed
 *   3. record the missed call (idempotently, however many times it arrives)
 *   4. open a chat session so the link has something to point at
 *   5. render the callback SMS from the vertical's own template
 *   6. **debit the clinic's wallet before sending**, and refund if the send
 *      fails
 *   7. hand the message to Twilio
 *
 * Step 6's ordering is the whole commercial guardrail: the platform never
 * carries the cost of a clinic's traffic, so a clinic whose wallet is empty
 * gets `sms_blocked` recorded and a visible prompt to top up — never a
 * silent subsidy, and never a patient left waiting with no explanation on
 * the console.
 */

export type InterceptOutcome =
  | "not_missed"
  | "sms_sent"
  | "sms_blocked"
  | "sms_failed"
  | "quiet_hours"
  | "duplicate"
  | "unknown_number"
  | "disabled"
  | "not_configured"
  | "invalid";

export interface InterceptResult {
  ok: boolean;
  outcome: InterceptOutcome;
  missedCallId?: string;
  sessionId?: string;
  /** Short operator-facing explanation, safe to log. */
  detail: string;
  /** The exact text sent, for the console's audit trail. */
  sms?: string;
  segments?: number;
  costKobo?: number;
  walletBalanceKobo?: number;
}

function lagosHhMm(now = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}

/** True when `now` falls inside the clinic's configured quiet window
 * ("22:00"–"07:00", wrapping midnight). Unset or malformed values mean
 * "always on", which is the safe default for a revenue-recovery product. */
export function isQuietHours(config: { quietHoursStart: string; quietHoursEnd: string }, now = new Date()): boolean {
  const start = config.quietHoursStart.trim();
  const end = config.quietHoursEnd.trim();
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return false;
  const current = lagosHhMm(now);
  if (start === end) return false;
  return start < end ? current >= start && current < end : current >= start || current < end;
}

export async function handleMissedCall(payload: unknown): Promise<InterceptResult> {
  const event = parseVoiceWebhook(payload);

  if (!event.callerPhone) {
    return { ok: false, outcome: "invalid", detail: `Webhook had no caller number (missing: ${event.missing.join(", ") || "unknown"}).` };
  }
  /**
   * Twilio posts the voice webhook for *every* call status, including ones that
   * were answered. Texting "sorry we missed your call" to somebody the clinic
   * just spoke to would be both wrong and a waste of the clinic's credit, so an
   * answered call stops here.
   */
  if (!event.isMissed) {
    return {
      ok: true,
      outcome: "not_missed",
      detail: `Call status "${event.status}" is not a missed call — nothing sent.`,
    };
  }

  if (!event.calledNumber) {
    return {
      ok: false,
      outcome: "invalid",
      detail: "Webhook had no dialled number, so the call cannot be routed to a clinic. Check the Twilio number's Voice URL.",
    };
  }

  const config = await findConfigByVoiceNumber(event.calledNumber);
  if (!config) {
    // Fail closed: an unrecognised line means we do not know which clinic's
    // patient this is, and texting them on a guess would be worse than
    // doing nothing.
    return {
      ok: false,
      outcome: "unknown_number",
      detail: `No clinic is configured for the dialled number ${event.calledNumber}.`,
    };
  }

  const orgId = config.organizationId;

  await ensureSetup(orgId, { packId: config.packId });

  const profile = await getBusinessProfile(orgId);

  /**
   * Normalise the caller's number for **this clinic's** country, not Nigeria's.
   * Every number in this product used to be read as Nigerian, which would have
   * turned a Kenyan caller's 0712 345 678 into 234712345678 and texted a
   * stranger.
   */
  const dialCode = AFRICAN_COUNTRIES.find((c) => c.code === (profile?.countryCode || "NG"))?.dialCode || "234";
  const callerPhone = normalizePhoneFor(event.callerPhone, dialCode);

  const created = await createMissedCall({
    organizationId: orgId,
    callerPhone,
    calledNumber: event.calledNumber,
    providerCallId: event.providerCallId,
    receivedAt: event.receivedAt,
  });
  if (!created) {
    return { ok: false, outcome: "invalid", detail: "The missed call could not be recorded." };
  }
  const missedCall = created.call;

  /**
   * Idempotency has to mean "never text the same patient twice about the same
   * call", not "never try again". A provider retry after a transient Twilio
   * failure — or a repeat call once the wallet has been topped up — must be
   * allowed to send, or a clinic would have to wait for a *different* patient
   * to call before the agent worked again. A call that already has a message
   * out (`sms_sent` or beyond) is the case the guard is really protecting,
   * and that one returns early.
   */
  const retryable = missedCall.status === "sms_failed" || missedCall.status === "sms_blocked";
  if (created.duplicate && !retryable) {
    return {
      ok: true,
      outcome: "duplicate",
      missedCallId: missedCall.id,
      detail: "This call was already recorded — no second message sent.",
    };
  }

  if (!config.enabled) {
    // Recorded rather than discarded: the console can then show a clinic
    // exactly how many calls it is missing before it switches the agent on.
    await updateMissedCall(orgId, missedCall.id, {
      status: "received",
      notes: "AI receptionist is switched off for this business.",
    });
    return {
      ok: true,
      outcome: "disabled",
      missedCallId: missedCall.id,
      detail: "Recorded, but the AI receptionist is switched off so no message was sent.",
    };
  }

  if (isQuietHours(config)) {
    await updateMissedCall(orgId, missedCall.id, {
      status: "received",
      notes: `Quiet hours (${config.quietHoursStart}–${config.quietHoursEnd}) — held back.`,
    });
    return { ok: true, outcome: "quiet_hours", missedCallId: missedCall.id, detail: "Held back during the clinic's quiet hours." };
  }

  if (!isMessagingConfigured()) {
    await updateMissedCall(orgId, missedCall.id, {
      status: "sms_failed",
      smsError: "TWILIO_ACCOUNT_SID is not configured.",
    });
    return {
      ok: false,
      outcome: "not_configured",
      missedCallId: missedCall.id,
      detail: "Twilio credentials are not set, so no message could be sent.",
    };
  }

  const [existingCustomer, wallet] = await Promise.all([
    findCustomerByPhone(orgId, callerPhone),
    getWalletSettings(orgId),
  ]);

  const pack = getPack(config.packId);
  const businessName = profile?.displayName ?? "the clinic";
  const patientName = existingCustomer?.name ?? "";

  // The session is created before the SMS so the link in the text points at
  // a real conversation, and so an opened link can be attributed back to the
  // exact call that produced it. On a retry the original session is reused —
  // a failed first attempt must not mint a second link.
  const session =
    (missedCall.chatSessionId ? await getChatSession(missedCall.chatSessionId) : null) ??
    (await createChatSession(orgId, crypto.randomUUID(), {
      organizationId: orgId,
      missedCallId: missedCall.id,
      channel: "missed_call_sms",
      visitorPhone: callerPhone,
      visitorName: patientName,
      customerId: existingCustomer?.id ?? null,
      packId: config.packId,
    }));

  const link = buildChatLink(
    chatBaseUrl({ NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN }),
    session.id,
    callerPhone,
  );
  const sms = renderSms({ template: pack.smsTemplate, businessName, patientName, link });
  const measured = smsSegments(sms);
  const costKobo = measured.segments * wallet.smsUnitCostKobo;

  await updateMissedCall(orgId, missedCall.id, {
    chatSessionId: session.id,
    customerId: existingCustomer?.id ?? null,
    smsBody: sms,
    smsUnits: measured.segments,
  });

  // Debit first. If the clinic's wallet cannot cover this message, the call
  // is recorded as blocked and nothing is sent on the platform's credit.
  const charge = await chargeWallet({
    organizationId: orgId,
    kind: "sms",
    amountKobo: costKobo,
    quantity: measured.segments,
    unitCostKobo: wallet.smsUnitCostKobo,
    provider: "termii",
    description: `Missed-call callback to ${callerPhone} (${measured.segments} segment${measured.segments > 1 ? "s" : ""})`,
    missedCallId: missedCall.id,
    sessionId: session.id,
  });

  if (!charge.ok) {
    await updateMissedCall(orgId, missedCall.id, {
      status: "sms_blocked",
      smsCostKobo: 0,
      smsError: `Communication wallet too low (balance ${charge.balanceKobo} kobo, needed ${charge.neededKobo} kobo).`,
      notes: "Top up the communication wallet to resume automatic callbacks.",
    });
    return {
      ok: false,
      outcome: "sms_blocked",
      missedCallId: missedCall.id,
      sessionId: session.id,
      sms,
      segments: measured.segments,
      costKobo,
      walletBalanceKobo: charge.balanceKobo,
      detail: "The clinic's communication wallet is too low to send the callback.",
    };
  }

  const send = await sendSms({
    to: normalizePhoneFor(callerPhone, dialCode),
    sms,
    from: config.smsSenderId || defaultSenderId(),
    // A Messaging Service pools senders and handles Twilio's own routing; set
    // it once the platform runs more than a handful of clinics.
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID || undefined,
  });

  if (!send.ok) {
    // Refund the debit: the clinic was charged for a message that never left.
    await creditWallet({
      organizationId: orgId,
      kind: "refund",
      amountKobo: costKobo,
      provider: "termii",
      providerRef: `refund:${missedCall.id}`,
      description: `Refund — callback SMS failed (${send.error})`,
    });
    await updateMissedCall(orgId, missedCall.id, {
      status: "sms_failed",
      smsCostKobo: 0,
      smsError: send.error,
      notes: "Wallet was refunded automatically.",
    });
    return {
      ok: false,
      outcome: "sms_failed",
      missedCallId: missedCall.id,
      sessionId: session.id,
      sms,
      segments: measured.segments,
      detail: `Twilio rejected the message: ${send.error}`,
    };
  }

  await updateMissedCall(orgId, missedCall.id, {
    status: "sms_sent",
    smsCostKobo: costKobo,
    smsProviderRef: send.providerRef,
    smsSentAt: new Date().toISOString(),
  });

  return {
    ok: true,
    outcome: "sms_sent",
    missedCallId: missedCall.id,
    sessionId: session.id,
    sms,
    segments: measured.segments,
    costKobo,
    walletBalanceKobo: charge.transaction.balanceAfterKobo,
    detail: `Callback sent to ${callerPhone}.`,
  };
}

/**
 * Marks the session opened when the patient taps the link. Called from the
 * public chat page, not the webhook — the tap is the only reliable signal,
 * and it is also what makes the funnel's middle step measurable.
 */
export async function markChatOpened(session: {
  id: string;
  organizationId: string;
  missedCallId: string | null;
  status: string;
}): Promise<void> {
  if (!session.missedCallId) return;
  // Only ever moves the call forward: a call already marked `booked` must not
  // be demoted back to `chat_opened` by a late page load, so a call that has
  // already converted is left alone.
  if (session.status === "booked" || session.status === "recovered") return;
  await updateMissedCall(session.organizationId, session.missedCallId, { status: "chat_opened" });
}

/**
 * Opens (or resumes) a chat for a visitor on the business's public website.
 *
 * Two continuity signals, in priority order: the browser-held `visitorKey`
 * (so a reload or a return visit continues the same thread), then the phone
 * number (so someone who tapped an SMS link and then came back to the website
 * carries on the conversation they already started rather than beginning a
 * second one).
 *
 * A visitor gets one *new* conversation per hour. That cap is the only thing
 * standing between a public, unauthenticated endpoint and somebody minting
 * sessions to run up inference cost, so it is enforced here rather than left
 * to the caller.
 */
export async function ensureWidgetSession(params: {
  organizationId: string;
  packId: PackId;
  phone: string;
  visitorKey?: string;
  /** The business's country, so a visitor's number is read correctly. */
  countryCode?: string;
}): Promise<{ sessionId: string; reused: boolean }> {
  const visitorKey = (params.visitorKey ?? "").trim().slice(0, 64);
  const dialCode = AFRICAN_COUNTRIES.find((c) => c.code === (params.countryCode || "NG"))?.dialCode || "234";
  const normalized = normalizePhoneFor(params.phone, dialCode);

  const [byKey, byPhone] = await Promise.all([
    visitorKey ? findWidgetSessionByVisitorKey(params.organizationId, visitorKey) : Promise.resolve(null),
    normalized ? findOpenSessionByPhone(params.organizationId, normalized) : Promise.resolve(null),
  ]);
  const existingSession = byKey ?? byPhone;
  if (existingSession) return { sessionId: existingSession.id, reused: true };

  if (visitorKey) {
    const recent = await countRecentWidgetSessions(params.organizationId, visitorKey, 60);
    // One per hour. Returning the most recent session keeps the experience
    // continuous — the visitor simply continues talking to the same assistant.
    if (recent > 0) {
      const latest = await findWidgetSessionByVisitorKey(params.organizationId, visitorKey);
      if (latest) return { sessionId: latest.id, reused: true };
    }
  }

  const existingCustomer = normalized ? await findCustomerByPhone(params.organizationId, normalized) : null;
  const customer =
    existingCustomer ??
    (normalized
      ? await createCustomer(params.organizationId, crypto.randomUUID(), {
          name: "",
          phone: normalized,
          email: "",
          gender: "",
          notes: "Started a chat from the website widget.",
        })
      : null);

  const session = await createChatSession(params.organizationId, crypto.randomUUID(), {
    organizationId: params.organizationId,
    channel: "website_widget",
    visitorPhone: normalized,
    visitorKey,
    visitorName: existingCustomer?.name ?? "",
    customerId: customer?.id ?? null,
    packId: params.packId,
  });
  return { sessionId: session.id, reused: false };
}
