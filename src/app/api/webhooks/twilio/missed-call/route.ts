import { describeEndpoint, handleVoiceWebhookRequest } from "@/lib/ai/voice-webhook";

/**
 * Alias for `/v1/missed-call`, matching the `/api/webhooks/*` convention
 * every other provider integration in this app follows (Paystack is at
 * `/api/webhooks/paystack`). Same handler, so the two can never diverge.
 *
 * Twilio's console asks for one URL per number; either this or
 * `/v1/missed-call` works identically.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return handleVoiceWebhookRequest(req);
}

export async function GET(): Promise<Response> {
  return describeEndpoint();
}
