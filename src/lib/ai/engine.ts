import "server-only";
import { chatComplete, isDeepSeekConfigured, type ChatMessage, type ToolCall } from "@/lib/deepseek";
import { getPack, type TriageSeverity } from "./industry-packs";
import { requiresEmergencyServices, requiresHandoff, screenMessage } from "./triage";
import { buildGreeting, buildSystemPrompt, buildTools, type PromptService } from "./prompt";
import { scriptedReply } from "./fallback-engine";
import { aiUsageCostKobo } from "./pricing";
import { notifyEscalation } from "./escalation";
import { getBusinessProfile } from "@/lib/db/organizations";
import { listServices } from "@/lib/db/services";
import { createBooking } from "@/lib/db/bookings";
import { createCustomer, findCustomerByPhone, getCustomer } from "@/lib/db/customers";
import {
  appendChatMessage,
  getChatSession,
  getConfig,
  listChatMessages,
  updateChatSession,
  updateMissedCall,
} from "@/lib/db/receptionist";
import type { ChatSession } from "@/lib/ai/types";
import type { Service } from "@/lib/types";

/**
 * One turn of the conversation.
 *
 * The order of operations is the design:
 *
 *   1. **Triage the inbound message deterministically** (`screenMessage`).
 *      If it matches a red flag, the model is never called — the fixed
 *      clinical response is sent and the session is escalated. This is the
 *      only way a clinic can honestly claim the agent will always escalate a
 *      urological emergency or a filler-induced vascular occlusion.
 *   2. **A quick-reply booking** (the patient tapped a button) books
 *      directly, without a model, so the most common successful path cannot
 *      be broken by an API outage.
 *   3. **The model**, if configured, with tools for booking and handoff.
 *   4. **The scripted agent** if the model is unset or failing, so a missed
 *      call still gets a useful answer.
 *
 * Every turn records its token usage and cost on the session, which is what
 * turns the margin claim into a number this app can produce per clinic.
 */

export interface QuickReplyBooking {
  kind: "book";
  serviceId: string;
  startsAt: string;
  patientName?: string;
}

export interface ChatTurnInput {
  sessionId: string;
  text: string;
  quickReply?: QuickReplyBooking;
}

export type ChatTurnMode = "triage" | "booking" | "model" | "scripted" | "closed" | "unavailable";

export interface ChatTurnResult {
  ok: boolean;
  mode: ChatTurnMode;
  reply: string;
  escalated: boolean;
  severity: TriageSeverity | null;
  booking: { id: string; serviceName: string; startsAt: string; priceKobo: number } | null;
  quickReplies: string[];
  session: ChatSession | null;
  error?: string;
}

const MAX_TOOL_ROUNDS = 2;

/** Loads everything a turn needs, scoped to the session's own organization. */
async function loadContext(session: ChatSession) {
  const [config, profile, services] = await Promise.all([
    getConfig(session.organizationId),
    getBusinessProfile(session.organizationId),
    listServices(session.organizationId),
  ]);
  const activeServices: Service[] = services.filter((s) => s.active);
  const pack = getPack(config?.packId ?? session.packId);
  return { config, profile, services: activeServices, pack };
}

function toPromptServices(services: Service[]): PromptService[] {
  return services.map((s) => ({ name: s.name, priceKobo: s.priceKobo, durationMin: s.durationMin }));
}

/** Resolves the service a model or patient named, tolerating the near-misses
 * a chat produces ("consultation" for "Confidential consultation"). Falls
 * back to null rather than guessing a different service. */
export function matchService(services: Service[], nameOrId: string): Service | null {
  const needle = (nameOrId || "").trim().toLowerCase();
  if (!needle) return null;
  const byId = services.find((s) => s.id === nameOrId);
  if (byId) return byId;
  const exact = services.find((s) => s.name.toLowerCase() === needle);
  if (exact) return exact;
  const contains = services.find((s) => s.name.toLowerCase().includes(needle) || needle.includes(s.name.toLowerCase()));
  if (contains) return contains;
  // Last resort: a distinctive word overlap ("hormone panel" vs
  // "Testosterone & hormone panel"), which is how patients actually ask.
  const words = needle.split(/\s+/).filter((w) => w.length > 3);
  if (words.length) {
    const scored = services
      .map((s) => ({ s, score: words.filter((w) => s.name.toLowerCase().includes(w)).length }))
      .sort((a, b) => b.score - a.score)[0];
    if (scored && scored.score > 0) return scored.s;
  }
  return null;
}

function parseStart(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function escalate(params: {
  session: ChatSession;
  businessName: string;
  escalationEmail: string;
  reason: string;
  severity: TriageSeverity | "handoff";
  isEmergencyServices: boolean;
  patientName: string;
  patientPhone: string;
}): Promise<void> {
  await notifyEscalation({
    organizationId: params.session.organizationId,
    businessName: params.businessName,
    patientName: params.patientName,
    patientPhone: params.patientPhone,
    reason: params.reason,
    severity: params.severity,
    isEmergencyServices: params.isEmergencyServices,
    escalationEmail: params.escalationEmail,
  });
}

/**
 * Writes the booking, and attributes it. Also the single place that updates
 * the missed call's recovery value — so the ROI report and the booking
 * record can never disagree about what a recovered call was worth.
 */
async function bookFor(params: {
  session: ChatSession;
  service: Service;
  startsAt: Date;
  patientName: string;
  phone: string;
  notes: string;
  averageConsultValueKobo: number;
}): Promise<{ id: string } | null> {
  const { session, service } = params;

  const existing = params.phone ? await findCustomerByPhone(session.organizationId, params.phone) : null;
  const customer =
    existing ??
    (await createCustomer(session.organizationId, crypto.randomUUID(), {
      name: params.patientName || "Patient (via AI receptionist)",
      phone: params.phone,
      email: "",
      gender: "",
      notes: "Created by the AI receptionist from a missed call.",
    }));

  const booking = await createBooking(session.organizationId, crypto.randomUUID(), {
    customerId: customer.id,
    serviceId: service.id,
    staffId: "",
    startsAt: params.startsAt.toISOString(),
    status: "confirmed",
    notes: params.notes || "Booked by the AI receptionist.",
    priceKobo: service.priceKobo,
    source: "ai_receptionist",
  });

  const value = service.priceKobo > 0 ? service.priceKobo : params.averageConsultValueKobo;

  await updateChatSession(session.id, {
    bookingId: booking.id,
    status: "booked",
    customerId: customer.id,
    visitorName: params.patientName || session.visitorName,
  });

  if (session.missedCallId) {
    await updateMissedCall(session.organizationId, session.missedCallId, {
      status: "booked",
      recoveredBookingId: booking.id,
      recoveredValueKobo: value,
      customerId: customer.id,
    });
  }

  return { id: booking.id };
}

/** Executes one tool call from the model. Returns the JSON payload that goes
 * back to the model as the tool result. */
async function executeTool(
  call: ToolCall,
  ctx: {
    session: ChatSession;
    services: Service[];
    patientName: string;
    phone: string;
    businessName: string;
    escalationEmail: string;
    escalationPhone: string;
    averageConsultValueKobo: number;
    autoBook: boolean;
  },
): Promise<Record<string, unknown>> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
  } catch {
    return { ok: false, error: "Could not parse the arguments." };
  }

  const str = (key: string) => (typeof args[key] === "string" ? (args[key] as string).trim() : "");

  if (call.function.name === "book_appointment") {
    if (!ctx.autoBook) return { ok: false, error: "Booking is disabled for this clinic; hand off to a human instead." };
    const service = matchService(ctx.services, str("service_name"));
    if (!service) {
      return {
        ok: false,
        error: `No such service. Available services: ${ctx.services.map((s) => s.name).join(", ") || "none listed"}.`,
      };
    }
    const startsAt = parseStart(str("starts_at"));
    if (!startsAt) return { ok: false, error: "starts_at must be a valid ISO 8601 date and time." };

    const booking = await bookFor({
      session: ctx.session,
      service,
      startsAt,
      patientName: str("patient_name") || ctx.patientName,
      phone: str("phone") || ctx.phone,
      notes: str("notes"),
      averageConsultValueKobo: ctx.averageConsultValueKobo,
    });
    if (!booking) return { ok: false, error: "The booking could not be saved." };
    return { ok: true, booking_id: booking.id, service: service.name, starts_at: startsAt.toISOString() };
  }

  if (call.function.name === "handoff_to_human") {
    const reason = str("reason") || "The assistant asked for a person.";
    const urgency = str("urgency") || "today";
    await updateChatSession(ctx.session.id, {
      escalated: true,
      escalationReason: reason,
      escalatedAt: new Date().toISOString(),
      status: "handed_off",
    });
    await escalate({
      session: ctx.session,
      businessName: ctx.businessName,
      escalationEmail: ctx.escalationEmail,
      reason,
      severity: urgency === "immediate" ? "urgent" : "handoff",
      isEmergencyServices: false,
      patientName: ctx.patientName,
      patientPhone: ctx.phone,
    });
    return { ok: true, handed_off: true, note: "A member of the clinic team has been alerted." };
  }

  if (call.function.name === "finish_conversation") {
    await updateChatSession(ctx.session.id, {
      status: "closed",
      intent: str("intent") || "closed",
      endedAt: new Date().toISOString(),
    });
    return { ok: true, closed: true };
  }

  return { ok: false, error: `Unknown tool: ${call.function.name}` };
}

export async function runChatTurn(input: ChatTurnInput): Promise<ChatTurnResult> {
  const base: ChatTurnResult = {
    ok: false,
    mode: "unavailable",
    reply: "",
    escalated: false,
    severity: null,
    booking: null,
    quickReplies: [],
    session: null,
  };

  const session = await getChatSession(input.sessionId);
  if (!session) return { ...base, error: "This chat link has expired." };
  if (session.status === "closed" || session.status === "abandoned") {
    return { ...base, mode: "closed", session, error: "This conversation has ended." };
  }

  const { config, profile, services, pack } = await loadContext(session);
  const businessName = profile?.displayName ?? "the clinic";
  const autoBook = config?.autoBook ?? true;
  const triageEnabled = config?.triageEnabled ?? true;
  const patientName = session.visitorName;
  const phone = session.visitorPhone;
  const escalationEmail = config?.escalationEmail ?? "";
  const escalationPhone = config?.escalationPhone ?? "";
  const averageConsultValueKobo = config?.averageConsultValueKobo ?? 2_500_000;

  const userText = (input.text || "").trim();

  // Persist what the patient said. A quick-reply tap is stored as the label
  // the patient saw, so the transcript reads like the conversation they had.
  if (userText) {
    await appendChatMessage({
      sessionId: session.id,
      organizationId: session.organizationId,
      role: "user",
      content: userText,
    });
  }

  /* ---- 1. Deterministic clinical screening, before any model ---- */
  const screen = screenMessage(userText, pack.triageRules, { enabled: triageEnabled });
  if (screen.matched && screen.rule && requiresHandoff(screen.severity)) {
    await appendChatMessage({
      sessionId: session.id,
      organizationId: session.organizationId,
      role: "assistant",
      content: screen.response,
      toolName: `triage:${screen.rule.id}`,
    });
    // Inside this branch `requiresHandoff` guaranteed emergency or urgent —
    // narrow it once here rather than asserting at each use.
    const severity = screen.severity as TriageSeverity;
    const isEmergency = requiresEmergencyServices(severity);
    await updateChatSession(session.id, {
      escalated: true,
      escalationRuleId: screen.rule.id,
      escalationReason: screen.rule.label,
      escalatedAt: new Date().toISOString(),
      status: "handed_off",
      intent: screen.rule.id,
    });
    await escalate({
      session,
      businessName,
      escalationEmail,
      reason: screen.rule.label,
      severity,
      isEmergencyServices: isEmergency,
      patientName,
      patientPhone: phone,
    });
    const updated = await getChatSession(session.id);
    return {
      ok: true,
      mode: "triage",
      reply: screen.response,
      escalated: true,
      severity: screen.severity,
      booking: null,
      // No quick replies: the conversation is now with a human, and offering
      // "book an appointment" after a stroke warning would be grotesque.
      quickReplies: [],
      session: updated,
    };
  }

  // Caution rules still continue the chat, but the session is flagged so the
  // clinic reviews it even if the patient books successfully.
  if (screen.matched && screen.rule) {
    await updateChatSession(session.id, {
      escalationRuleId: screen.rule.id,
      escalationReason: `Flagged: ${screen.rule.label}`,
    });
    await escalate({
      session,
      businessName,
      escalationEmail,
      reason: screen.rule.label,
      severity: "caution",
      isEmergencyServices: false,
      patientName,
      patientPhone: phone,
    });
  }

  /* ---- 2. A tapped booking button books directly, no model involved ---- */
  if (input.quickReply?.kind === "book") {
    const service = services.find((s) => s.id === input.quickReply?.serviceId) ?? null;
    const startsAt = parseStart(input.quickReply.startsAt);
    if (!service || !startsAt) {
      const reply = service
        ? "Sorry, I didn't get that time. Could you tell me the day and time again?"
        : "I couldn't find that service. Could you tell me which one you'd like?";
      await appendChatMessage({ sessionId: session.id, organizationId: session.organizationId, role: "assistant", content: reply });
      return { ...base, ok: true, mode: "scripted", reply, session, quickReplies: services.slice(0, 3).map((s) => `Book ${s.name}`) };
    }
    const booking = await bookFor({
      session,
      service,
      startsAt,
      patientName: input.quickReply.patientName || patientName,
      phone,
      notes: "Booked in chat via quick reply.",
      averageConsultValueKobo,
    });
    const when = startsAt.toLocaleString("en-NG", { dateStyle: "full", timeStyle: "short" });
    const reply = booking
      ? `Done — you're booked for ${service.name} on ${when}. We'll send a confirmation, and the clinic will call if anything changes.`
      : "Sorry, I couldn't save that booking. Let me pass this to a person who can help.";
    await appendChatMessage({ sessionId: session.id, organizationId: session.organizationId, role: "assistant", content: reply });
    return {
      ok: true,
      mode: "booking",
      reply,
      escalated: false,
      severity: null,
      booking: booking ? { id: booking.id, serviceName: service.name, startsAt: startsAt.toISOString(), priceKobo: service.priceKobo } : null,
      quickReplies: [],
      session: await getChatSession(session.id),
    };
  }

  /* ---- 3. The model ---- */
  const history = await listChatMessages(session.id, 20);
  const openingLine = buildGreeting({
    customGreeting: config?.greeting ?? "",
    pack,
    businessName,
    patientName,
  });

  const scripted = scriptedReply(userText, {
    pack,
    businessName,
    services: toPromptServices(services),
    phone: profile?.phone ?? "",
    address: profile?.address ?? "",
    city: profile?.city ?? "",
    state: profile?.state ?? "",
  });

  const scriptedResult = async (mode: ChatTurnMode, error?: string): Promise<ChatTurnResult> => {
    await appendChatMessage({
      sessionId: session.id,
      organizationId: session.organizationId,
      role: "assistant",
      content: scripted.reply,
    });
    if (scripted.handoff) {
      await updateChatSession(session.id, {
        escalated: true,
        escalationReason: scripted.intent,
        escalatedAt: new Date().toISOString(),
        status: "handed_off",
        intent: scripted.intent,
      });
      await escalate({
        session,
        businessName,
        escalationEmail,
        reason: `Scripted assistant could not answer (${scripted.intent}).`,
        severity: "handoff",
        isEmergencyServices: false,
        patientName,
        patientPhone: phone,
      });
    } else if (scripted.intent) {
      await updateChatSession(session.id, { intent: scripted.intent });
    }
    return {
      ok: true,
      mode,
      reply: scripted.reply,
      escalated: scripted.handoff,
      severity: null,
      booking: null,
      quickReplies: scripted.quickReplies,
      session: await getChatSession(session.id),
      error,
    };
  };

  if (!isDeepSeekConfigured()) {
    return scriptedResult("scripted", "DEEPSEEK_API_KEY is not configured — replying from the scripted assistant.");
  }

  const systemPrompt = buildSystemPrompt({
    businessName,
    pack,
    services: toPromptServices(services),
    phone: profile?.phone ?? "",
    address: profile?.address ?? "",
    city: profile?.city ?? "",
    state: profile?.state ?? "",
    openingLine,
    patientName,
    visitingBefore: Boolean(session.customerId),
    escalationPhone,
    autoBook,
    channel: session.channel,
    now: new Date(),
  });

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  const tools = buildTools(pack, { autoBook });
  let usage = { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 };
  let model = "";
  let reply = "";
  let toolHandled = false;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const completion = await chatComplete({
      messages,
      tools,
      toolChoice: "auto",
      // Lower temperature than a general assistant: this is a booking desk
      // that must not get creative about prices or clinical matters.
      temperature: 0.3,
      maxTokens: 500,
    });

    if (!completion.ok) {
      // A failing model degrades to the scripted agent rather than leaving
      // the patient with silence. Recorded on the session so the console
      // shows why.
      return scriptedResult("scripted", `Model unavailable (${completion.error}).`);
    }

    usage = {
      inputTokens: usage.inputTokens + completion.usage.inputTokens,
      cachedInputTokens: usage.cachedInputTokens + completion.usage.cachedInputTokens,
      outputTokens: usage.outputTokens + completion.usage.outputTokens,
    };
    model = completion.model;

    if (completion.toolCalls.length === 0) {
      reply = completion.content;
      break;
    }

    toolHandled = true;
    messages.push({ role: "assistant", content: completion.content, tool_calls: completion.toolCalls });
    for (const call of completion.toolCalls) {
      const result = await executeTool(call, {
        session,
        services,
        patientName,
        phone,
        businessName,
        escalationEmail,
        escalationPhone,
        averageConsultValueKobo,
        autoBook,
      });
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        name: call.function.name,
        content: JSON.stringify(result),
      });
      await appendChatMessage({
        sessionId: session.id,
        organizationId: session.organizationId,
        role: "tool",
        content: JSON.stringify(result),
        toolName: call.function.name,
        toolPayload: result,
      });
    }
    // Loop once more so the model can phrase the outcome in its own words.
    reply = completion.content;
  }

  const costKobo = aiUsageCostKobo(usage);
  const refreshed = await getChatSession(session.id);
  await updateChatSession(session.id, {
    model,
    tokensIn: (refreshed?.tokensIn ?? 0) + usage.inputTokens,
    tokensOut: (refreshed?.tokensOut ?? 0) + usage.outputTokens,
    cachedTokensIn: (refreshed?.cachedTokensIn ?? 0) + usage.cachedInputTokens,
    aiCostKobo: (refreshed?.aiCostKobo ?? 0) + costKobo,
  });

  if (!reply.trim()) {
    // The model called a tool and produced no prose. Say something true
    // rather than sending an empty bubble.
    reply = scripted.reply;
  }

  await appendChatMessage({
    sessionId: session.id,
    organizationId: session.organizationId,
    role: "assistant",
    content: reply,
  });

  const finalSession = await getChatSession(session.id);
  return {
    ok: true,
    mode: "model",
    reply,
    escalated: Boolean(finalSession?.escalated),
    severity: null,
    booking: finalSession?.bookingId ? { id: finalSession.bookingId, serviceName: "", startsAt: "", priceKobo: 0 } : null,
    quickReplies: quickRepliesFor(services, toolHandled),
    session: finalSession,
  };
}

/** Follow-up buttons after a model turn. Kept short and always including the
 * escape hatch to a human. */
function quickRepliesFor(services: Service[], toolHandled: boolean): string[] {
  if (toolHandled) return [];
  const top = services.slice(0, 2).map((s) => `Book ${s.name}`);
  return [...top, "Talk to a person"];
}

/** A returning customer's name for the greeting, without leaking whether
 * they are a patient of this clinic to a wrong number. */
export async function resolveVisitorName(session: ChatSession, fallbackPhone: string): Promise<string> {
  if (session.visitorName) return session.visitorName;
  const phone = session.visitorPhone || fallbackPhone;
  if (!phone) return "";
  const existing = await findCustomerByPhone(session.organizationId, phone);
  if (existing) {
    await updateChatSession(session.id, { visitorName: existing.name, customerId: existing.id });
    return existing.name;
  }
  return "";
}

/** Used by the console's transcript viewer. */
export async function loadTranscript(sessionId: string) {
  return listChatMessages(sessionId, 100);
}

/** Used by the console to show a named patient rather than a phone number. */
export async function customerNameFor(orgId: string, customerId: string | null): Promise<string> {
  if (!customerId) return "";
  const customer = await getCustomer(orgId, customerId);
  return customer?.name ?? "";
}
