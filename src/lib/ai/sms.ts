/**
 * SMS composition for the missed-call callback.
 *
 * Three separate concerns, kept apart on purpose:
 *   - what the message says (a template from the vertical's pack),
 *   - how it renders (one small substitution function),
 *   - what it costs (segment counting, which is what the wallet is charged
 *     for — networks bill per 160-character segment, not per message).
 *
 * Self-contained apart from type-only imports, so `smsSegments` and
 * `renderSms` are directly unit-testable and the billing side can never
 * disagree with what was actually sent.
 */

export type SmsEncoding = "gsm7" | "ucs2";

export interface SmsMeasurement {
  encoding: SmsEncoding;
  /** Characters as the network counts them (GSM-7 escape pairs count as 2). */
  length: number;
  /** Number of billable segments. */
  segments: number;
  /** Characters still available in the final segment. */
  remaining: number;
}

/** GSM 03.38 basic character set — 1 septet each. */
const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";

/** GSM 03.38 extension table — each of these occupies 2 septets. */
const GSM7_EXTENDED = "^{}\\[~]|€";

const GSM7_SINGLE = 160;
const GSM7_MULTI = 153;
const UCS2_SINGLE = 70;
const UCS2_MULTI = 67;

/**
 * Measures a message the way an SMSC does. Nigerian numbers are frequently
 * outside the GSM-7 alphabet (the naira sign ₦ is not in it), at which point
 * the whole message drops to UCS-2 and the per-segment budget falls from 160
 * to 70 characters — which is exactly how a "short" callback text silently
 * becomes three billable segments. Counting it here makes that visible in
 * the console before it shows up as wallet spend.
 */
export function smsSegments(body: string): SmsMeasurement {
  let gsmLength = 0;
  let gsm7 = true;
  for (const char of body) {
    if (GSM7_BASIC.includes(char)) gsmLength += 1;
    else if (GSM7_EXTENDED.includes(char)) gsmLength += 2;
    else {
      gsm7 = false;
      break;
    }
  }

  if (gsm7) {
    const segments = gsmLength <= GSM7_SINGLE ? 1 : Math.ceil(gsmLength / GSM7_MULTI);
    const perSegment = segments === 1 ? GSM7_SINGLE : GSM7_MULTI;
    return { encoding: "gsm7", length: gsmLength, segments, remaining: perSegment * segments - gsmLength };
  }

  // UTF-16 code units, matching how a UCS-2 SMSC counts (an emoji is 2).
  const length = body.length;
  const segments = length <= UCS2_SINGLE ? 1 : Math.ceil(length / UCS2_MULTI);
  const perSegment = segments === 1 ? UCS2_SINGLE : UCS2_MULTI;
  return { encoding: "ucs2", length, segments, remaining: perSegment * segments - length };
}

/** What one send costs the clinic's wallet: per-segment, not per-send. */
export function smsCostKobo(segments: number, unitCostKobo: number): number {
  return Math.max(0, segments) * Math.max(0, unitCostKobo);
}

/**
 * Fills a pack's SMS template.
 *
 * `{name}` is special: it renders as `" Chioma"` when the patient's name is
 * known and as `""` when it isn't, which is what lets a single template read
 * naturally both ways — `Hi{name}, sorry we missed your call` becomes
 * "Hi Chioma, sorry…" or "Hi, sorry…" with no second template to maintain.
 *
 * Unknown placeholders are left in place rather than blanked, so a typo in a
 * template is visible in the console's preview instead of silently
 * producing a message with a hole in it.
 */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{${key}}`).join(value);
  }
  return out.replace(/[ \t]{2,}/g, " ").trim();
}

export interface RenderSmsInput {
  template: string;
  businessName: string;
  patientName?: string;
  link: string;
}

/** The exact body that goes to Twilio. */
export function renderSms(input: RenderSmsInput): string {
  const first = (input.patientName ?? "").trim().split(/\s+/)[0] ?? "";
  return renderTemplate(input.template, {
    business: input.businessName.trim() || "us",
    name: first ? ` ${first}` : "",
    link: input.link,
  });
}

/**
 * The tracking link the patient taps. `id` is the chat session; `phone` rides
 * along so the widget can open with the patient's record already loaded
 * ("Welcome back, Chioma") without asking them to identify themselves. It is
 * a convenience parameter, never an authorisation: the chat API re-derives
 * the session's own organization and phone server-side and ignores anything
 * that disagrees.
 */
export function buildChatLink(baseUrl: string, sessionId: string, phone: string): string {
  const base = (baseUrl || "https://jktl.com.ng").replace(/\/+$/, "");
  const params = new URLSearchParams({ id: sessionId });
  if (phone.trim()) params.set("phone", phone.trim());
  return `${base}/chat?${params.toString()}`;
}

/** Public base URL for links in outbound messages. Prefers an explicit
 * public URL, falls back to the root domain, then to localhost in dev. */
export function chatBaseUrl(env: { NEXT_PUBLIC_APP_URL?: string; NEXT_PUBLIC_ROOT_DOMAIN?: string } = {}): string {
  if (env.NEXT_PUBLIC_APP_URL) return env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  if (env.NEXT_PUBLIC_ROOT_DOMAIN) return `https://${env.NEXT_PUBLIC_ROOT_DOMAIN.replace(/\/+$/, "")}`;
  return "https://jktl.com.ng";
}
