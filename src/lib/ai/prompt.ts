import type { IndustryPack } from "./industry-packs";
import type { ToolDefinition } from "@/lib/deepseek";

/**
 * Builds the system prompt and tool definitions for one conversation.
 *
 * Pure and dependency-free (type-only imports) for two reasons: it is the
 * most safety-sensitive text in the product, so it is unit tested — the
 * tests assert that a men's health prompt actually contains the guardrails
 * and the escalation number rather than trusting that it does — and it must
 * be deterministic, because DeepSeek's context cache only pays off when the
 * same prompt prefix is re-sent byte-for-byte across the turns of a
 * conversation. Every volatile value (the current time) is placed at the
 * very end, after the stable block, so caching still hits on the bulk of it.
 */

export interface PromptService {
  name: string;
  priceKobo: number;
  durationMin: number;
}

export interface PromptContext {
  businessName: string;
  pack: IndustryPack;
  services: PromptService[];
  phone: string;
  address: string;
  city: string;
  state: string;
  /** Resolved greeting already shown to the patient, so the model doesn't
   * greet a second time. */
  openingLine: string;
  patientName: string;
  visitingBefore: boolean;
  escalationPhone: string;
  autoBook: boolean;
  /** Where the link came from: a missed call, or the website widget. */
  channel: "missed_call_sms" | "website_widget" | "whatsapp";
  now: Date;
}

const CURRENCY = (koboValue: number) =>
  `NGN ${(koboValue / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;

/**
 * Resolves the line the patient actually sees first.
 *
 * A returning patient gets the context-preservation line from the blueprint
 * — "Welcome back, Chioma." — because the whole promise of the pipeline is
 * that the clinic already knows who is messaging it, and a clinic that
 * greets a regular like a stranger has wasted the one piece of context the
 * SMS link carried.
 */
export function buildGreeting(params: {
  customGreeting: string;
  pack: IndustryPack;
  businessName: string;
  patientName: string;
}): string {
  const first = (params.patientName || "").trim().split(/\s+/)[0] ?? "";
  const render = (template: string) =>
    template
      .split("{business}")
      .join(params.businessName || "us")
      .split("{name}")
      .join(first ? ` ${first}` : "")
      .replace(/[ \t]{2,}/g, " ")
      .trim();

  if (params.customGreeting.trim()) return render(params.customGreeting);
  if (first) return `Welcome back, ${first}. ${params.pack.returningGreeting}`;
  return render(params.pack.defaultGreeting);
}

/** The function-calling surface. Small on purpose: three tools, each with a
 * consequence a clinic would recognise — write a booking, hand to a human,
 * or close out with a note. */
export function buildTools(pack: IndustryPack, opts: { autoBook: boolean }): ToolDefinition[] {
  const tools: ToolDefinition[] = [];

  if (opts.autoBook) {
    tools.push({
      type: "function",
      function: {
        name: "book_appointment",
        description:
          "Write a confirmed appointment into the clinic's booking system. Only call this once you have a service and an exact date and time the patient has agreed to.",
        parameters: {
          type: "object",
          properties: {
            service_name: {
              type: "string",
              description: "The service being booked, using the clinic's own service name from the list in your instructions.",
            },
            starts_at: {
              type: "string",
              description:
                "Appointment start in ISO 8601 with the clinic's local offset, e.g. 2026-03-04T10:30:00+01:00. Resolve relative words like 'tomorrow morning' against the current date and time given in your instructions.",
            },
            patient_name: { type: "string", description: "The patient's full name." },
            phone: { type: "string", description: "Best phone number for the clinic to confirm on." },
            notes: { type: "string", description: "Anything the clinician must know before the visit, in the patient's own words." },
          },
          required: ["service_name", "starts_at", "patient_name"],
        },
      },
    });
  }

  tools.push({
    type: "function",
    function: {
      name: "handoff_to_human",
      description:
        "Stop the automated conversation and have a member of the clinic's team take over. Use this whenever the patient is distressed, asks for a person, describes a medical emergency, or asks something you are not permitted to answer.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Why a human needs to take over, in one sentence." },
          urgency: { type: "string", enum: ["immediate", "today", "routine"] },
        },
        required: ["reason"],
      },
    },
  });

  tools.push({
    type: "function",
    function: {
      name: "finish_conversation",
      description: "Close the conversation when the patient's need is handled or they have said goodbye.",
      parameters: {
        type: "object",
        properties: {
          intent: {
            type: "string",
            description: "One short phrase describing what the patient wanted, for the clinic's records.",
          },
          summary: { type: "string", description: "One or two sentences the clinic can read instead of the transcript." },
        },
        required: ["intent"],
      },
    },
  });

  return tools;
}

/**
 * The system prompt. Structure, in order:
 *   1. identity and tone            (stable — cacheable)
 *   2. the clinic's real facts      (stable)
 *   3. what it may and may not say  (stable)
 *   4. how to book                  (stable)
 *   5. live context                 (volatile, last)
 */
export function buildSystemPrompt(ctx: PromptContext): string {
  const { pack } = ctx;
  const location = [ctx.address, ctx.city, ctx.state].filter(Boolean).join(", ");

  const serviceLines = ctx.services.length
    ? ctx.services
        .map((s) => `- ${s.name} — ${CURRENCY(s.priceKobo)}${s.durationMin ? ` (${s.durationMin} min)` : ""}`)
        .join("\n")
    : "- (No services are listed yet. Do not invent any; ask what the patient needs and hand off to a person.)";

  const redFlags = pack.triageRules
    .filter((r) => r.severity === "emergency" || r.severity === "urgent")
    .map((r) => `- ${r.label} → ${r.action === "call_emergency" ? "tell them to seek emergency care now" : "hand off to a human immediately"}`)
    .join("\n");

  const lines: string[] = [];

  lines.push(
    `You are ${pack.persona}`,
    `You are messaging a patient who was sent a link after the clinic could not pick up their call, or who opened the clinic's website chat.`,
    ``,
    `## Tone`,
    ...pack.tone.map((t) => `- ${t}`),
    `- Plain conversational text only. No markdown, no headings, no bullet lists, no emoji.`,
    `- Keep every message under about 60 words. Never send more than one question at a time.`,
    ``,
    `## The clinic`,
    `- Name: ${ctx.businessName}`,
    ...(location ? [`- Address: ${location}`] : []),
    ...(ctx.phone ? [`- Phone: ${ctx.phone}`] : []),
    `- Services and prices:`,
    serviceLines,
    `- If you are not told the clinic's opening hours, do not state them. Offer to have someone confirm timing instead.`,
    ``,
    `## Confidentiality`,
    `- ${pack.privacy}`,
    ``,
    `## What you must never do`,
    ...pack.neverSay.map((rule) => `- ${rule}`),
    `- Never claim to be a clinician, a nurse or a doctor. You are the booking assistant.`,
    `- Never give medical advice, interpret a symptom, or say a symptom is not serious.`,
    `- Never invent a price, a service, a staff member or a time slot that is not in this message.`,
    ``,
    `## Emergencies and handover`,
    `If the patient describes any of the following, stop the booking conversation immediately and follow the instruction on that line:`,
    redFlags,
    `- In an emergency, tell them clearly to seek emergency care now and give them 112. Do not ask more questions first.`,
    `- Never tell a patient with an emergency to wait for a callback.`,
    ...(ctx.escalationPhone
      ? [`- The clinic's urgent line for the team is ${ctx.escalationPhone}; staff will follow up, but the patient must not be told to wait for it.`]
      : []),
    ``,
    `## Booking`,
    `- ${pack.bookingPolicy}`,
    `- Before booking, you need: ${pack.intakeFields.join("; ")}.`,
    ...(ctx.autoBook
      ? [`- Call the book_appointment tool only when you have a service and an exact date and time the patient has agreed to.`, `- After it succeeds, confirm the service, the date and the time, and say the clinic will send a confirmation.`]
      : [`- You cannot write bookings in this conversation. Collect the details and call handoff_to_human so the team can confirm.`]),
    `- If the patient asks for a person, or seems upset, call handoff_to_human instead of trying to recover the conversation.`,
    `- If the conversation is finished, call finish_conversation with a one-line summary.`,
    ``,
    `## How this conversation started`,
    ctx.channel === "missed_call_sms"
      ? `The patient called the clinic and the call was missed. They were sent a text with this link and have now opened it.`
      : `The patient opened the clinic's website chat directly.`,
    `Your first line to them was: "${ctx.openingLine}"`,
    ...(ctx.patientName
      ? [`This is a returning patient: ${ctx.patientName}. Treat them as known — do not ask them to introduce themselves.`]
      : [`You do not have this patient's name yet. Ask for it naturally when it is needed.`]),
    ``,
    `## Right now`,
    `Current date and time at the clinic: ${ctx.now.toISOString()} (Africa/Lagos).`,
    `Resolve any relative date the patient gives you against that.`,
  );

  return lines.join("\n");
}
