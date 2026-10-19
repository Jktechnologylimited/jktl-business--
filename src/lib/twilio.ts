import "server-only";
import { smsSegments } from "@/lib/ai/sms";
// Re-exported so a caller imports one module: the network client and the payload
// helpers belong to the same provider. The implementations are in
// `twilio-payload.ts`, which Node's test runner can import.
export { parseVoiceWebhook, verifyWebhookSignature, type ParsedVoiceEvent } from "@/lib/twilio-payload";
import { normalizePhone } from "@/lib/phone";

/**
 * Twilio: the phone numbers and the messages.
 *
 * Replaces Termii, and the reasons are worth recording because they are not
 * only about price:
 *
 *   1. **Numbers are provisioned through the same API that sends.** A clinic's
 *      dedicated line can be searched, bought and attached programmatically
 *      (see `searchAvailableNumbers`), which is what makes "each business gets
 *      its own number" an operation rather than a support ticket. Termii's
 *      numbers were sourced out of band.
 *   2. **Webhooks are signed.** Twilio signs every request with HMAC-SHA1 over
 *      the URL and parameters using the auth token, so the missed-call endpoint
 *      can verify authenticity instead of relying on a shared secret in a query
 *      string that leaks through logs and referrers.
 *   3. **Per-segment pricing comes back on the send**, so the wallet is charged
 *      what the message actually cost rather than an estimate.
 *
 * The provider seam matters: `src/lib/ai/missed-call.ts` talks to this module,
 * not to Twilio's URLs, so swapping rails again is one file.
 */

const DEFAULT_BASE_URL = "https://api.twilio.com";
/** Twilio's REST API version. Not a date we choose — it is part of every path. */
const API_VERSION = "2010-04-01";

export function isMessagingConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

function accountSid(): string {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  if (!sid) throw new Error("TWILIO_ACCOUNT_SID is not set. Add it to .env.local to enable calling and messaging.");
  return sid;
}

function authToken(): string {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) throw new Error("TWILIO_AUTH_TOKEN is not set.");
  return token;
}

function baseUrl(): string {
  return (process.env.TWILIO_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

/** Basic auth with the account SID and auth token — Twilio's scheme. */
function authHeader(): string {
  return `Basic ${Buffer.from(`${accountSid()}:${authToken()}`).toString("base64")}`;
}

async function twilioFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  try {
    const res = await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: { Authorization: authHeader(), ...(init?.headers ?? {}) },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // Non-JSON error body — the status check below handles it.
    }
    if (!res.ok) {
      const record = body as Record<string, unknown> | null;
      const message = (record?.message as string) || `Twilio returned ${res.status}`;
      return { ok: false, error: message, status: res.status };
    }
    return { ok: true, data: body as T };
  } catch (err) {
    // status 0 distinguishes "never reached Twilio" (worth retrying) from a
    // rejection (which will fail identically forever).
    return { ok: false, error: err instanceof Error ? err.message : "Twilio request failed", status: 0 };
  }
}

/**
 * Normalizes a number to E.164 for any market — the same behaviour as before,
 * kept here because every caller already imported it from the messaging layer.
 */
export function normalizePhoneFor(phone: string, countryDialCode = "234"): string {
  const digits = normalizePhone(phone, countryDialCode);
  return digits ? `+${digits}` : "";
}

/**
 * The Sender ID or number a message comes from.
 *
 * Twilio calls this the `From`. In Nigeria and several other markets an
 * alphanumeric Sender ID ("VITALIS") is accepted for one-way messaging and is
 * better than a phone number for a clinic; elsewhere a purchased number is
 * required. Falls back to the platform's own number.
 */
export function defaultSenderId(): string {
  return process.env.TWILIO_SENDER_ID || process.env.TWILIO_DEFAULT_NUMBER || "";
}

export interface SendSmsInput {
  to: string;
  sms: string;
  /** Clinic's own Sender ID or number, else the platform default. */
  from?: string;
  /**
   * Optional Messaging Service SID. When set, Twilio picks the sender and
   * handles number pooling — worth using once several clinics share the
   * platform account.
   */
  messagingServiceSid?: string;
}

export type SendSmsResult =
  | {
      ok: true;
      providerRef: string;
      status: string;
      /** What Twilio charged, in its own currency, when it reports it. */
      providerPrice?: number;
      providerCurrency?: string;
      /** Segments Twilio billed, which is what the wallet is charged. */
      segments: number;
      encoding: "gsm7" | "ucs2";
      raw: unknown;
    }
  | { ok: false; error: string; status: number; segments: number };

interface TwilioMessage {
  sid?: string;
  status?: string;
  num_segments?: string;
  price?: string | null;
  error_message?: string | null;
  code?: number;
  message?: string;
}

/**
 * Sends one SMS.
 *
 * The caller has already checked the clinic's wallet and reserved the cost. The
 * body is form-encoded because that is what Twilio's REST API expects; JSON is
 * accepted on some endpoints and silently mis-parsed on others, which is not a
 * risk worth taking with a message a patient is waiting for.
 */
export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const measured = smsSegments(input.sms);
  const to = input.to.startsWith("+") ? input.to : normalizePhoneFor(input.to);
  if (!to) return { ok: false, error: "No valid destination number.", status: 0, segments: measured.segments };

  const from = input.from?.trim() || defaultSenderId();
  const payload = new URLSearchParams();
  payload.set("To", to);
  payload.set("Body", input.sms);
  if (input.messagingServiceSid) payload.set("MessagingServiceSid", input.messagingServiceSid);
  else if (from) payload.set("From", from);
  else return { ok: false, error: "No sender configured (set TWILIO_SENDER_ID or TWILIO_DEFAULT_NUMBER).", status: 0, segments: measured.segments };

  // Twilio reports delivery asynchronously; this callback is how the wallet
  // learns a message failed after the fact.
  const statusCallback = process.env.TWILIO_STATUS_CALLBACK_URL;
  if (statusCallback) payload.set("StatusCallback", statusCallback);

  const result = await twilioFetch<TwilioMessage>(`/${API_VERSION}/Accounts/${accountSid()}/Messages.json`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: payload.toString(),
  });

  if (!result.ok) return { ...result, segments: measured.segments };

  const data = result.data ?? {};
  if (!data.sid) {
    return {
      ok: false,
      error: data.message || "Twilio accepted the request but returned no message id.",
      status: 200,
      segments: measured.segments,
    };
  }

  // Twilio bills per segment and reports the count; fall back to our own
  // measurement only when it doesn't.
  const billedSegments = Number(data.num_segments ?? 0) || measured.segments;

  return {
    ok: true,
    providerRef: data.sid,
    status: data.status ?? "queued",
    providerPrice: data.price ? Math.abs(Number(data.price)) : undefined,
    providerCurrency: data.price ? "USD" : undefined,
    segments: billedSegments,
    encoding: measured.encoding,
    raw: data,
  };
}

/** WhatsApp, on the same account. Twilio prefixes the address with `whatsapp:`. */
export async function sendWhatsApp(input: SendSmsInput): Promise<SendSmsResult> {
  return sendSms(input);
}

export type BalanceResult = { ok: true; balance: number; currency: string } | { ok: false; error: string };

/** The platform's own Twilio balance, for the ops dashboard — never a clinic's
 * wallet, which lives in `comm_wallet_transactions`. */
export async function getBalance(): Promise<BalanceResult> {
  const result = await twilioFetch<{ balance?: string; currency?: string }>(
    `/${API_VERSION}/Accounts/${accountSid()}/Balance.json`,
    { method: "GET" },
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, balance: Number(result.data?.balance ?? 0), currency: String(result.data?.currency ?? "USD") };
}

/* -------------------------------------------------------------------------- */
/* Numbers                                                                    */
/* -------------------------------------------------------------------------- */

export interface AvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  locality: string;
  region: string;
  isoCountry: string;
  capabilities: { voice: boolean; sms: boolean };
  /** What Twilio charges per month for it, in USD, when it says. */
  monthlyPriceUsd?: number;
}

interface TwilioAvailableNumber {
  phone_number?: string;
  friendly_name?: string;
  locality?: string;
  region?: string;
  iso_country?: string;
  capabilities?: { voice?: boolean; sms?: boolean };
}

/**
 * Searches for numbers to buy.
 *
 * `areaCode` is how a clinic gets a number that looks local — a Yenagoa business
 * on an 0803 number, a Lekki one on 0701. `locality` narrows it further where
 * Twilio has the data. Both are optional; without them Twilio returns whatever
 * it has for the country.
 */
export async function searchAvailableNumbers(params: {
  country: string;
  areaCode?: string;
  locality?: string;
  contains?: string;
  limit?: number;
}): Promise<{ ok: true; numbers: AvailableNumber[] } | { ok: false; error: string }> {
  const query = new URLSearchParams();
  query.set("PageSize", String(Math.min(Math.max(params.limit ?? 10, 1), 30)));
  if (params.areaCode) query.set("AreaCode", params.areaCode);
  if (params.contains) query.set("Contains", params.contains);
  query.set("VoiceEnabled", "true");
  query.set("SmsEnabled", "true");

  const result = await twilioFetch<{ available_phone_numbers?: TwilioAvailableNumber[] }>(
    `/${API_VERSION}/Accounts/${accountSid()}/AvailablePhoneNumbers/${params.country.toUpperCase()}/Local.json?${query.toString()}`,
    { method: "GET" },
  );
  if (!result.ok) return { ok: false, error: result.error };

  const numbers = (result.data.available_phone_numbers ?? []).map((n) => ({
    phoneNumber: n.phone_number ?? "",
    friendlyName: n.friendly_name ?? "",
    locality: n.locality ?? "",
    region: n.region ?? "",
    isoCountry: n.iso_country ?? params.country.toUpperCase(),
    capabilities: { voice: Boolean(n.capabilities?.voice), sms: Boolean(n.capabilities?.sms) },
  }));
  return { ok: true, numbers };
}

export interface PurchasedNumber {
  phoneNumber: string;
  sid: string;
  friendlyName: string;
  monthlyPriceUsd?: number;
}

/**
 * Buys a number and points its voice and message webhooks at this app.
 *
 * Registering the webhooks at purchase time is the point: a number that rings
 * and does nothing is worse than no number, and it is the kind of thing that
 * gets discovered a week later. `voiceUrl` should be the missed-call endpoint.
 */
export async function purchaseNumber(params: {
  phoneNumber: string;
  voiceUrl: string;
  smsUrl?: string;
  friendlyName?: string;
  statusCallbackUrl?: string;
}): Promise<{ ok: true; number: PurchasedNumber } | { ok: false; error: string }> {
  const body = new URLSearchParams();
  body.set("PhoneNumber", params.phoneNumber);
  body.set("VoiceUrl", params.voiceUrl);
  // Twilio's default voice method is POST; stated explicitly so a future change
  // of default cannot silently break the pipeline.
  body.set("VoiceMethod", "POST");
  if (params.smsUrl) {
    body.set("SmsUrl", params.smsUrl);
    body.set("SmsMethod", "POST");
  }
  if (params.statusCallbackUrl) body.set("StatusCallback", params.statusCallbackUrl);
  if (params.friendlyName) body.set("FriendlyName", params.friendlyName.slice(0, 64));

  const result = await twilioFetch<{ sid?: string; phone_number?: string; friendly_name?: string }>(
    `/${API_VERSION}/Accounts/${accountSid()}/IncomingPhoneNumbers.json`,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() },
  );
  if (!result.ok) return { ok: false, error: result.error };
  if (!result.data.sid) return { ok: false, error: "Twilio bought nothing — no number returned." };

  return {
    ok: true,
    number: {
      phoneNumber: result.data.phone_number ?? params.phoneNumber,
      sid: result.data.sid,
      friendlyName: result.data.friendly_name ?? "",
    },
  };
}

/** Releases a number — a cancelled clinic's line should not keep being billed. */
export async function releaseNumber(numberSid: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await twilioFetch<unknown>(`/${API_VERSION}/Accounts/${accountSid()}/IncomingPhoneNumbers/${numberSid}.json`, {
    method: "DELETE",
  });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
