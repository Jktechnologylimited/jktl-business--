import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const BASE_URL = "https://api.paystack.co";

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  return key;
}

async function paystackFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  let body: { status?: boolean; message?: string; data?: T } = {};
  try {
    body = await res.json();
  } catch {
    // Non-JSON error body — fall through to the status-based error below.
  }

  if (!res.ok || body.status === false) {
    throw new Error(body.message || `Paystack request to ${path} failed (${res.status})`);
  }
  return body.data as T;
}

/** Verifies Paystack's `x-paystack-signature` header: HMAC-SHA512 of the
 * *raw* request body using the secret key, hex-encoded. Must be checked
 * against the raw bytes before the body is parsed as JSON — Paystack's
 * signature won't match a re-serialized copy of the payload. */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = createHmac("sha512", secretKey()).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Creates a recurring billing Plan. Amount is in kobo — Paystack's
 * `amount` field for NGN is already the smallest unit, same as this app's
 * own kobo storage, so no conversion is needed. */
export async function createPlan(params: {
  name: string;
  amountKobo: number;
  interval: "monthly" | "quarterly" | "biannually" | "annually";
}): Promise<{ planCode: string }> {
  const data = await paystackFetch<{ plan_code: string }>("/plan", {
    method: "POST",
    body: JSON.stringify({ name: params.name, amount: params.amountKobo, interval: params.interval, currency: "NGN" }),
  });
  return { planCode: data.plan_code };
}

/** Looks for an existing Plan by exact name — used so `ensurePlanCode` in
 * db/billing.ts doesn't create a duplicate Plan if the local cache table
 * was ever cleared but the Plan still exists on Paystack's side. */
export async function findPlanByName(name: string): Promise<{ planCode: string } | null> {
  const data = await paystackFetch<Array<{ name: string; plan_code: string }>>(`/plan?perPage=100`, { method: "GET" });
  const match = data.find((p) => p.name === name);
  return match ? { planCode: match.plan_code } : null;
}

export interface InitializeTransactionResult {
  authorizationUrl: string;
  reference: string;
  accessCode: string;
}

/** Starts a hosted Paystack checkout tied to a Plan — a successful charge
 * here creates the recurring subscription automatically. `metadata` is
 * echoed back on the `charge.success` webhook and transaction-verify
 * response, which is how the very first charge gets mapped back to an
 * organization (later, Paystack-initiated renewal charges have no
 * metadata, so those are matched by customer code instead). */
export async function initializeTransaction(params: {
  email: string;
  amountKobo: number;
  planCode: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}): Promise<InitializeTransactionResult> {
  const data = await paystackFetch<{ authorization_url: string; reference: string; access_code: string }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      plan: params.planCode,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
    }),
  });
  return { authorizationUrl: data.authorization_url, reference: data.reference, accessCode: data.access_code };
}

export interface VerifyTransactionData {
  status: "success" | "failed" | "abandoned" | string;
  reference: string;
  amount: number;
  paid_at: string | null;
  customer: { customer_code: string; email: string };
  metadata: Record<string, unknown> | null;
}

export async function verifyTransaction(reference: string): Promise<VerifyTransactionData> {
  return paystackFetch<VerifyTransactionData>(`/transaction/verify/${encodeURIComponent(reference)}`, { method: "GET" });
}

/** Paystack's hosted "manage subscription" page — lets the owner update
 * their card or cancel, without JKTL Business needing its own card-storage
 * or cancellation UI. */
export async function getSubscriptionManageLink(subscriptionCode: string): Promise<string> {
  const data = await paystackFetch<{ link: string }>(`/subscription/${encodeURIComponent(subscriptionCode)}/manage/link`, {
    method: "GET",
  });
  return data.link;
}
