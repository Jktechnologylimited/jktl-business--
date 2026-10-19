import { describeEndpoint, handleVoiceWebhookRequest } from "@/lib/ai/voice-webhook";

/**
 * The intercept pipeline's admin endpoint, exactly as specified in the
 * blueprint: `POST /v1/missed-call`.
 *
 * Point Twilio's voice webhook here — the number's Voice URL, set when the
 * number is bought (see `purchaseNumber` in src/lib/twilio.ts) — and
 * every unanswered call to a clinic's virtual line becomes a texted booking
 * link within a second or two. The identical handler is also mounted at
 * `/api/webhooks/twilio/missed-call` for consistency with the rest of the
 * app's integrations.
 *
 * Node runtime: the pipeline uses `node:crypto` to verify Twilio's request
 * signature, and the Neon HTTP driver for database access.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return handleVoiceWebhookRequest(req);
}

export async function GET(): Promise<Response> {
  return describeEndpoint();
}
