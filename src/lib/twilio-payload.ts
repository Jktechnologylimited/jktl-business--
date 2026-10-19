import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Twilio webhook payloads: authenticity and parsing.
 *
 * Separate from `src/lib/twilio.ts` on purpose. That module is `server-only`
 * (it holds the auth token and makes network calls), which means Node's test
 * runner cannot import it — and these two functions are exactly the ones that
 * should never ship unverified. Verifying a webhook signature *wrong* means
 * either rejecting real calls or accepting forged ones that spend a clinic's
 * money, so it lives where it can be tested directly.
 *
 * No imports beyond `node:crypto`, no environment reads at module scope.
 */

/* -------------------------------------------------------------------------- */
/* Webhook authenticity                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Verifies Twilio's `X-Twilio-Signature`.
 *
 * Twilio's scheme: take the full request URL, append every POST parameter
 * sorted by name as `name + value` concatenated, HMAC-SHA1 with the auth token,
 * base64. Covered here so the missed-call endpoint can prove a request really
 * came from Twilio rather than trusting a shared secret in a query string —
 * which is what the Termii integration had to do, and which leaks through logs,
 * proxies and referrers.
 *
 * `urlBehindProxy` matters: behind a load balancer the request URL Twilio signed
 * is the public one, not the internal one the app sees.
 */
export function verifyWebhookSignature(params: {
  signature: string | null;
  url: string;
  body: Record<string, string>;
  /** Explicit token, or the environment's. Passed explicitly in tests. */
  authToken?: string;
}): boolean {
  const token = params.authToken ?? process.env.TWILIO_AUTH_TOKEN;
  if (!params.signature || !token) return false;
  // Twilio appends `X-Twilio-Signature`; also accept the lowercase variant Node
  // gives us from a Headers object.
  const expected = (() => {
    const sorted = Object.keys(params.body).sort();
    let payload = params.url;
    for (const key of sorted) payload += key + params.body[key];
    return createHmac("sha1", token).update(Buffer.from(payload, "utf8")).digest("base64");
  })();

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(params.signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/* -------------------------------------------------------------------------- */
/* Voice webhook parsing                                                      */
/* -------------------------------------------------------------------------- */

export interface ParsedVoiceEvent {
  callerPhone: string;
  calledNumber: string;
  /** Twilio's `CallSid` — the idempotency key for a missed call. */
  providerCallId: string;
  receivedAt: Date;
  status: string;
  /** True when this event is worth treating as a missed call. */
  isMissed: boolean;
  missing: string[];
}

/**
 * Twilio's voice statuses that mean "the patient did not get through".
 *
 * `completed` is included because a call answered and dropped in under a few
 * seconds — a hang-up on hearing hold music — is a missed call in every sense
 * that matters to the clinic's revenue.
 */
const MISSED_STATUSES = new Set(["no-answer", "busy", "failed", "canceled", "cancelled"]);

export function parseVoiceWebhook(payload: unknown): ParsedVoiceEvent {
  const source: Record<string, unknown> =
    payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const nested = (source.data ?? source.call ?? source) as Record<string, unknown>;
  const merged = { ...source, ...nested };

  const str = (key: string): string => {
    const value = merged[key];
    if (typeof value === "string") return value.trim();
    if (typeof value === "number") return String(value);
    return "";
  };

  // Twilio's own field names first, then the aliases Termii used, so a
  // half-migrated account still routes rather than silently dropping calls.
  const callerPhone = str("From") || str("caller_id") || str("Caller") || str("from");
  const calledNumber = str("To") || str("Called") || str("to") || str("called_number");
  const providerCallId = str("CallSid") || str("call_id") || str("Sid") || str("id");
  const status = (str("CallStatus") || str("status") || str("event")).toLowerCase();
  const rawTime = str("Timestamp") || str("timestamp") || str("created_at");
  const durationSeconds = Number(str("CallDuration") || str("duration") || "0");

  const parsedTime = rawTime ? new Date(rawTime) : new Date();
  const receivedAt = Number.isNaN(parsedTime.getTime()) ? new Date() : parsedTime;

  const missing: string[] = [];
  if (!callerPhone) missing.push("caller phone");
  if (!calledNumber) missing.push("called number");

  // A `completed` call is only missed if it barely lasted. Three seconds is
  // long enough for a real conversation to have started and short enough that
  // an instant hang-up still counts.
  const isMissed = MISSED_STATUSES.has(status) || (status === "completed" && durationSeconds < 3);

  return { callerPhone, calledNumber, providerCallId, receivedAt, status, isMissed, missing };
}

