import type { IndustryPack } from "./industry-packs";
import type { PromptService } from "./prompt";

/**
 * The scripted agent: what the receptionist says when there is no language
 * model available — no `DEEPSEEK_API_KEY` in development, an outage, or a
 * clinic that has deliberately run it in scripted mode.
 *
 * It exists because "the AI is down" must never mean "the missed call goes
 * unanswered". This replies from the clinic's real services, prices, address
 * and phone, offers the booking path, and hands anything it does not
 * understand to a human instead of improvising. It cannot diagnose, cannot
 * price work, and cannot invent a slot — which, being a fixed decision tree
 * over real data, is also the honest description of the original chat widget
 * this replaces.
 *
 * Pure and dependency-free so the fallback path is unit tested rather than
 * assumed to work.
 */

export interface ScriptedContext {
  pack: IndustryPack;
  businessName: string;
  services: PromptService[];
  phone: string;
  address: string;
  city: string;
  state: string;
}

export interface ScriptedReply {
  reply: string;
  quickReplies: string[];
  /** The caller (engine) should escalate this session to a human. */
  handoff: boolean;
  intent: string;
}

function naira(kobo: number): string {
  return `₦${Math.round(kobo / 100).toLocaleString("en-NG")}`;
}

function includesAny(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

function serviceList(services: PromptService[], withPrices: boolean): string {
  return services
    .slice(0, 6)
    .map((s) => (withPrices ? `• ${s.name} — ${naira(s.priceKobo)}` : `• ${s.name}`))
    .join("\n");
}

const BOOK_WORDS = ["book", "appointment", "schedule", "slot", "available", "reserve", "come in", "see the doctor", "see a doctor", "consult"];
const PRICE_WORDS = ["price", "prices", "how much", "cost", "fee", "fees", "charge", "charges", "rate"];
const SERVICE_WORDS = ["what do you offer", "services", "service", "treatments", "treatment", "options", "what can you do", "packages"];
const LOCATION_WORDS = ["where are you", "where is", "address", "located", "location", "directions", "how do i get"];
const HOURS_WORDS = ["opening", "open", "close", "closing", "hours", "what time"];
const CONTACT_WORDS = ["phone number", "call you", "your number", "email", "contact"];
const HUMAN_WORDS = ["human", "real person", "speak to someone", "talk to someone", "talk to a person", "agent", "manager", "complaint"];
/** Deliberately not a bare "stop": "should we stop the medication" is a
 * clinical question, not an opt-out, and answering it with an unsubscribe
 * confirmation would be the worst possible failure of this file. */
const STOP_WORDS = ["stop texting", "stop messaging", "stop sending", "unsubscribe", "don't text", "do not text", "remove me", "opt out"];
const THANKS_WORDS = ["thank", "thanks", "appreciate"];

/**
 * One scripted turn. Order matters: a message that says "stop texting me" and
 * also contains "book" must be treated as a stop, and anything asking for a
 * person wins over everything except an opt-out.
 */
export function scriptedReply(rawText: string, ctx: ScriptedContext): ScriptedReply {
  const text = (rawText || "").toLowerCase().trim();
  const canBook = ctx.services.length > 0;

  const bookReplies = canBook
    ? ctx.services.slice(0, 3).map((s) => `Book ${s.name}`).concat(["Talk to a person"])
    : ["Talk to a person"];

  if (!text) {
    return {
      reply: `Sorry, I didn't catch that. Could you type your question again, or I can have someone from ${ctx.businessName} call you back?`,
      quickReplies: bookReplies,
      handoff: false,
      intent: "empty",
    };
  }

  if (includesAny(text, STOP_WORDS)) {
    return {
      reply: `Understood — I won't message you again. If you ever need us, ${ctx.businessName}'s number is ${ctx.phone || "on our website"}.`,
      quickReplies: [],
      handoff: false,
      intent: "opt_out",
    };
  }

  if (includesAny(text, HUMAN_WORDS)) {
    return {
      reply: `Of course — I'm passing this to a member of the ${ctx.businessName} team now so a person can help you directly.`,
      quickReplies: [],
      handoff: true,
      intent: "human_handoff",
    };
  }

  if (includesAny(text, THANKS_WORDS)) {
    return {
      reply: `You're very welcome. Is there anything else I can help you with?`,
      quickReplies: canBook ? ["Book an appointment", "Talk to a person"] : ["Talk to a person"],
      handoff: false,
      intent: "thanks",
    };
  }

  if (includesAny(text, PRICE_WORDS)) {
    if (!canBook) {
      return {
        reply: `I don't have our price list in front of me — let me have someone from ${ctx.businessName} send it to you.`,
        quickReplies: ["Talk to a person"],
        handoff: true,
        intent: "prices",
      };
    }
    return {
      reply: `Here's what we offer:\n${serviceList(ctx.services, true)}\n\nWould you like me to book one of these?`,
      quickReplies: bookReplies,
      handoff: false,
      intent: "prices",
    };
  }

  if (includesAny(text, SERVICE_WORDS)) {
    if (!canBook) {
      return {
        reply: `Let me have someone from ${ctx.businessName} talk you through what we offer.`,
        quickReplies: ["Talk to a person"],
        handoff: true,
        intent: "services",
      };
    }
    return {
      reply: `We offer:\n${serviceList(ctx.services, false)}\n\nWhich one would you like?`,
      quickReplies: bookReplies,
      handoff: false,
      intent: "services",
    };
  }

  if (includesAny(text, LOCATION_WORDS)) {
    const where = [ctx.address, ctx.city, ctx.state].filter(Boolean).join(", ");
    return {
      reply: where
        ? `We're at ${where}. Would you like me to book you an appointment?`
        : `Let me have someone from ${ctx.businessName} send you directions.`,
      quickReplies: canBook ? ["Book an appointment", "Talk to a person"] : ["Talk to a person"],
      handoff: !where,
      intent: "location",
    };
  }

  if (includesAny(text, HOURS_WORDS)) {
    return {
      reply: `I'll have someone from ${ctx.businessName} confirm the exact times with you — I don't want to give you the wrong ones. What day suits you?`,
      quickReplies: ["Talk to a person"],
      handoff: false,
      intent: "hours",
    };
  }

  if (includesAny(text, CONTACT_WORDS)) {
    return {
      reply: ctx.phone
        ? `You can reach us on ${ctx.phone}. Would you like me to book an appointment as well?`
        : `Let me have someone from ${ctx.businessName} get in touch with your contact details.`,
      quickReplies: canBook ? ["Book an appointment"] : [],
      handoff: !ctx.phone,
      intent: "contact",
    };
  }

  if (includesAny(text, BOOK_WORDS)) {
    if (!canBook) {
      return {
        reply: `I don't have our service list loaded, so let me pass this to a person at ${ctx.businessName} who can book you in.`,
        quickReplies: ["Talk to a person"],
        handoff: true,
        intent: "book",
      };
    }
    return {
      reply: `Happy to help. Which service would you like?\n${serviceList(ctx.services, false)}\n\nOnce you pick one, tell me the day and time that suit you.`,
      quickReplies: bookReplies,
      handoff: false,
      intent: "book",
    };
  }

  // Anything else — including a symptom described in a way the triage screen
  // did not recognise — goes to a person. The scripted agent does not
  // improvise about health.
  return {
    reply: `Thanks for your message. I want to make sure you get the right answer, so I'm passing this to a member of the ${ctx.businessName} team.`,
    quickReplies: [],
    handoff: true,
    intent: "unrecognised",
  };
}
