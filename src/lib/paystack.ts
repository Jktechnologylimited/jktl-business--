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
    signal: init?.signal || AbortSignal.timeout(20000),
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

/**
 * One month of the AI receptionist contract, as a hosted checkout.
 *
 * The contract is billed monthly rather than upfront — six instalments of
 * ₦108,333.33 covering the ₦650,000 package, then ₦59,000 from month 7 — so
 * this is called once per month with the amount the schedule says is due.
 * `monthIndex` travels in the metadata and is what the webhook uses to record
 * the right month; the amount is passed in from
 * `src/lib/ai/pricing.ts#amountForMonth` so the schedule stays in one place.
 *
 * Like the wallet top-up it is JKTL's own revenue: no plan, no subaccount.
 */
export async function initializeContractPayment(params: {
  email: string;
  amountKobo: number;
  monthIndex: number;
  callbackUrl: string;
  organizationId: string;
}): Promise<InitializeTransactionResult> {
  const data = await paystackFetch<{ authorization_url: string; reference: string; access_code: string }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      callback_url: params.callbackUrl,
      metadata: { type: "receptionist_month", organizationId: params.organizationId, monthIndex: params.monthIndex },
    }),
  });
  return { authorizationUrl: data.authorization_url, reference: data.reference, accessCode: data.access_code };
}

export interface VerifyTransactionData {
  currency?: string;
  status: "success" | "failed" | "abandoned" | string;
  reference: string;
  amount: number;
  paid_at: string | null;
  customer: { customer_code: string; email: string };
  metadata: Record<string, unknown> | null;
  /** Present on a successful charge: the reusable card, when there is one.
   * Declared rather than cast at the call site, because the receptionist's
   * subscription depends on reading `reusable` correctly. */
  authorization?: {
    authorization_code?: string;
    reusable?: boolean;
    brand?: string;
    last4?: string;
    exp_month?: string;
    exp_year?: string;
  };
}

export async function verifyTransaction(reference: string): Promise<VerifyTransactionData> {
  return paystackFetch<VerifyTransactionData>(`/transaction/verify/${encodeURIComponent(reference)}`, { method: "GET" });
}

/**
 * A one-off charge that funds a clinic's communication wallet — no plan (it
 * doesn't recur) and no subaccount split (this is JKTL's own revenue, not
 * money passing through to a business).
 *
 * `metadata.type = "wallet_topup"` is what the Paystack webhook uses to tell
 * this apart from a subscription or an invoice payment; `metadata.reference`
 * is the ledger's idempotency key, so a redelivered webhook credits once.
 */
export async function initializeWalletTopUp(params: {
  email: string;
  amountKobo: number;
  callbackUrl: string;
  organizationId: string;
}): Promise<InitializeTransactionResult> {
  const data = await paystackFetch<{ authorization_url: string; reference: string; access_code: string }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      callback_url: params.callbackUrl,
      metadata: { type: "wallet_topup", organizationId: params.organizationId },
    }),
  });
  return { authorizationUrl: data.authorization_url, reference: data.reference, accessCode: data.access_code };
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

export interface ChargeAuthorizationResult {
  reference: string;
  status: "success" | "failed" | string;
}

/**
 * Charges a previously-seen *reusable* authorization directly — no hosted
 * checkout, no new card entry. This is what makes storage-overage billing
 * possible at all: Paystack has no native usage-based/metered price the
 * way Stripe does, so overage is instead charged as its own one-off amount
 * against the same card token that's already paying the flat subscription
 * (see `handleChargeSuccess` in the webhook route for where that token is
 * captured, and `src/lib/db/storage-overage.ts` for the caller). Throws if
 * Paystack reports failure — a declined or revoked authorization is a
 * normal outcome here, not a bug, so callers catch this rather than
 * letting it propagate. */
export async function chargeAuthorization(params: {
  authorizationCode: string;
  email: string;
  amountKobo: number;
  metadata: Record<string, unknown>;
}): Promise<ChargeAuthorizationResult> {
  const data = await paystackFetch<{ reference: string; status: string }>("/transaction/charge_authorization", {
    method: "POST",
    body: JSON.stringify({
      authorization_code: params.authorizationCode,
      email: params.email,
      amount: params.amountKobo,
      metadata: params.metadata,
    }),
  });
  if (data.status !== "success") {
    throw new Error(`Paystack declined the charge (status: ${data.status})`);
  }
  return { reference: data.reference, status: data.status };
}

// ---- Invoice payment links (split payments via Subaccounts) ----
//
// A customer pays an invoice through a hosted Paystack checkout that
// splits automatically at the moment of payment: the invoice amount goes
// straight to the business's own bank account (their Subaccount), and a
// flat platform fee goes to JKTL's main account — nobody has to move
// money by hand afterward. See src/lib/db/payments.ts for the settlement
// details a business enters once, and src/app/pay/[id] for the public
// checkout page this all supports.

/** Flat fee, in kobo, added on top of every invoice paid through the
 * online link — the payer bears it, so the business always receives the
 * full invoice amount. ₦50. */
export const INVOICE_PLATFORM_FEE_KOBO = 5000;

export interface PaystackBank {
  code: string;
  name: string;
}

/** Nigerian banks Paystack can settle a Subaccount to, for the bank-picker
 * in Settings → Payments. Free, no special approval needed per Paystack's
 * docs — same secret key as everything else in this file. */
export async function listBanks(): Promise<PaystackBank[]> {
  const data = await paystackFetch<Array<{ name: string; code: string; active: boolean }>>(
    "/bank?country=nigeria&currency=NGN&perPage=100",
    { method: "GET" },
  );
  return data.filter((b) => b.active).map((b) => ({ code: b.code, name: b.name }));
}

export interface ResolvedAccount {
  accountNumber: string;
  accountName: string;
}

/** Looks up the real name on a Nigerian bank account — used right before
 * saving payment settings so a mistyped account number is caught
 * immediately rather than silently sending a business's customers' money
 * to the wrong place. Free endpoint, per Paystack's docs. */
export async function resolveAccountNumber(accountNumber: string, bankCode: string): Promise<ResolvedAccount> {
  const data = await paystackFetch<{ account_number: string; account_name: string }>(
    `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
    { method: "GET" },
  );
  return { accountNumber: data.account_number, accountName: data.account_name };
}

/** Creates the Paystack Subaccount a business's invoice payments settle
 * into. `percentage_charge: 0` is deliberately a no-op default — every
 * real invoice charge overrides the split per-transaction with a flat
 * `transaction_charge` (see initializeInvoicePayment below), so this
 * default only matters as a safety net: if a charge were ever made
 * without that override, the business keeps 100% rather than losing a
 * cut to a stale percentage. */
export async function createSubaccount(params: { businessName: string; bankCode: string; accountNumber: string }): Promise<{ subaccountCode: string }> {
  const data = await paystackFetch<{ subaccount_code: string }>("/subaccount", {
    method: "POST",
    body: JSON.stringify({
      business_name: params.businessName,
      bank_code: params.bankCode,
      account_number: params.accountNumber,
      percentage_charge: 0,
    }),
  });
  return { subaccountCode: data.subaccount_code };
}

/** Updates an existing Subaccount's settlement bank — used when a business
 * changes their bank details after already having one. */
export async function updateSubaccountBank(subaccountCode: string, params: { bankCode: string; accountNumber: string }): Promise<void> {
  await paystackFetch(`/subaccount/${encodeURIComponent(subaccountCode)}`, {
    method: "PUT",
    body: JSON.stringify({ settlement_bank: params.bankCode, account_number: params.accountNumber }),
  });
}

/** Starts a hosted Paystack checkout for a single invoice, splitting the
 * charge at the moment it's paid: `amountKobo` (invoice total + the flat
 * platform fee) is what the payer is charged, `transactionChargeKobo`
 * (JKTL's cut) goes to the main account, and the remainder settles to the
 * business's Subaccount automatically. `bearer: "account"` — Paystack's
 * own default — means JKTL's main account absorbs Paystack's processing
 * fee out of that cut, never the business's side of the split, since the
 * whole point of the surcharge is that the business receives the full
 * invoice amount. */
export async function initializeInvoicePayment(params: {
  email: string;
  amountKobo: number;
  subaccountCode: string;
  transactionChargeKobo: number;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}): Promise<InitializeTransactionResult> {
  const data = await paystackFetch<{ authorization_url: string; reference: string; access_code: string }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      subaccount: params.subaccountCode,
      transaction_charge: params.transactionChargeKobo,
      bearer: "account",
      callback_url: params.callbackUrl,
      metadata: params.metadata,
    }),
  });
  return { authorizationUrl: data.authorization_url, reference: data.reference, accessCode: data.access_code };
}

/** Versioned website products never reuse or mutate legacy plans. */
export async function findWebsiteProviderPlan(name:string){
 for(let page=1;page<=20;page++){
  const rows=await paystackFetch<Array<{name:string;plan_code:string;amount:number;currency:string;interval:string}>>(`/plan?perPage=100&page=${page}`);
  const match=rows.find(row=>row.name===name);if(match)return match;if(rows.length<100)break;
 }
 return null;
}
export async function initializeWebsitePlanCheckout(params:{email:string;amountKobo:number;planCode:string;reference:string;callbackUrl:string;metadata:Record<string,unknown>}):Promise<InitializeTransactionResult>{
 const data=await paystackFetch<{authorization_url:string;reference:string;access_code:string}>("/transaction/initialize",{method:"POST",body:JSON.stringify({email:params.email,amount:params.amountKobo,currency:"NGN",plan:params.planCode,reference:params.reference,callback_url:params.callbackUrl,metadata:params.metadata})});
 return {authorizationUrl:data.authorization_url,reference:data.reference,accessCode:data.access_code};
}
export async function stopWebsiteProviderSubscription(code:string,token:string){
 await paystackFetch('/subscription/disable',{method:'POST',body:JSON.stringify({code,token})});
}
