import "server-only";
import { handleMissedCall, type InterceptOutcome } from "./missed-call";
import { verifyWebhookSignature } from "@/lib/twilio";

/**
 * HTTP entry point for the Twilio voice webhook, shared by the two URLs it is
 * reachable at:
 *
 *   POST /v1/missed-call                     (the blueprint's admin endpoint)
 *   POST /api/webhooks/termii/missed-call    (the conventional webhook path)
 *
 * Both exist because the blueprint specifies the first and every other
 * integration in this app lives under the second; aliasing one handler means
 * a clinic can register either without the two drifting apart.
 */

/**
 * Verifies Twilio's request signature.
 *
 * Twilio signs every webhook with HMAC-SHA1 over the URL and the POST
 * parameters, using the account's auth token. That is a real improvement over
 * what this replaces: a shared secret in the query string leaks through access
 * logs, proxies and referrers, whereas a signature over the body proves the
 * request came from Twilio *and* that it arrived unmodified.
 *
 * In production a missing or invalid signature is a hard failure — this endpoint
 * spends a clinic's money and texts real patients, so "nobody configured the
 * token" must never mean "anyone may call it". In development it is allowed, so
 * the pipeline can be exercised locally.
 */
export function verifyWebhookKey(req: Request, body: Record<string, string> = {}): { ok: boolean; reason?: string } {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, reason: "TWILIO_AUTH_TOKEN is not set; refusing unauthenticated webhooks in production." };
    }
    return { ok: true };
  }

  const signature = req.headers.get("x-twilio-signature");
  // Behind a load balancer the URL Twilio signed is the public one.
  const publicUrl = process.env.TWILIO_WEBHOOK_BASE_URL
    ? `${process.env.TWILIO_WEBHOOK_BASE_URL.replace(/\/+$/, "")}${new URL(req.url).pathname}`
    : req.url;

  return verifyWebhookSignature({ signature, url: publicUrl, body })
    ? { ok: true }
    : { ok: false, reason: "Invalid Twilio signature." };
}

/** Reads JSON, form-encoded, or (unexpectedly) query-string bodies — Twilio's
 * voice product uses more than one across its event types, and a call that
 * silently fails to parse is a call a clinic never gets back. */
export async function readVoiceBody(req: Request): Promise<unknown> {
  const contentType = (req.headers.get("content-type") || "").toLowerCase();
  try {
    if (contentType.includes("application/json")) return await req.json();
    if (contentType.includes("form")) return Object.fromEntries((await req.formData()).entries());
    const raw = await req.text();
    if (!raw) return {};
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return Object.fromEntries(new URLSearchParams(raw).entries());
    }
  } catch {
    return {};
  }
}

/**
 * Which HTTP status each outcome returns.
 *
 * The distinction that matters: a *transient* failure (Twilio errored, the
 * key is missing) is worth the provider's own retry, so it answers 503 — and
 * the pipeline is safe to retry because a call whose message never left is
 * explicitly retryable. A *terminal* outcome (already sent, switched off,
 * quiet hours, an unknown line) answers 200 so Twilio stops replaying it.
 */
const STATUS_BY_OUTCOME: Record<InterceptOutcome, number> = {
  // An answered call is not a missed call and nothing is sent. 200 so Twilio
  // stops retrying — there is nothing here to retry.
  not_missed: 200,
  sms_sent: 200,
  duplicate: 200,
  disabled: 200,
  quiet_hours: 200,
  unknown_number: 200,
  sms_blocked: 200,
  sms_failed: 503,
  not_configured: 503,
  invalid: 400,
};

/** Every value as a string, which is what Twilio's signature is computed over. */
export function toParamMap(payload: unknown): Record<string, string> {
  if (!payload || typeof payload !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (value === null || value === undefined) continue;
    out[key] = typeof value === "string" ? value : String(value);
  }
  return out;
}

export async function handleVoiceWebhookRequest(req: Request): Promise<Response> {
  // The body has to be read before the signature can be checked: Twilio signs
  // the parameters, not just the URL.
  const payload = await readVoiceBody(req);
  const params = toParamMap(payload);

  const auth = verifyWebhookKey(req, params);
  if (!auth.ok) {
    return Response.json({ ok: false, outcome: "invalid", detail: auth.reason ?? "Unauthorized." }, { status: 401 });
  }

  let result;
  try {
    result = await handleMissedCall(payload);
  } catch (err) {
    // A thrown error here is a bug or a database outage — log it loudly and
    // ask the provider to try again.
    console.error("[missed-call] pipeline error", err);
    return Response.json({ ok: false, outcome: "invalid", detail: "Internal error handling the missed call." }, { status: 500 });
  }

  console.log(`[missed-call] ${result.outcome}: ${result.detail}`);

  return Response.json(
    {
      ok: result.ok,
      outcome: result.outcome,
      detail: result.detail,
      missedCallId: result.missedCallId ?? null,
      sessionId: result.sessionId ?? null,
      segments: result.segments ?? null,
      costKobo: result.costKobo ?? null,
      walletBalanceKobo: result.walletBalanceKobo ?? null,
    },
    { status: STATUS_BY_OUTCOME[result.outcome] ?? 200 },
  );
}

/**
 * Health probe, for a human or an uptime check. Deliberately says whether the
 * pieces are configured without revealing any of their values — the question
 * "why did no patient get a text" should be answerable from a browser without
 * opening the logs.
 */
export function describeEndpoint(): Response {
  return Response.json({
    ok: true,
    endpoint: "missed-call",
    method: "POST",
    configured: {
      twilio: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
      signatureVerification: Boolean(process.env.TWILIO_AUTH_TOKEN),
      deepseek: Boolean(process.env.DEEPSEEK_API_KEY),
    },
    detail: "POST a Twilio voice event here to trigger the missed-call recovery pipeline. GET only reports configuration.",
  });
}
