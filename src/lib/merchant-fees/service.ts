import "server-only";
import { createHash } from "node:crypto";
import { query } from "@/lib/custom/service";
import { getPublicInvoice } from "@/lib/db/invoices";
import { getPaymentSettings } from "@/lib/db/payments";
import { payoutReady } from "@/lib/invoicing/policy";
import {
  buyerFee,
  outstanding,
  validateBands,
  type BuyerFeePolicy,
  type FrozenInvoiceQuote,
  type InvoiceQuote,
} from "./model";
export function activationGate(): "live" | "test" | null {
  const key = process.env.PAYSTACK_SECRET_KEY || "";
  if (
    key.startsWith("sk_live_") &&
    process.env.JKTL_BUYER_PAID_FEES_APPROVED === "true"
  )
    return "live";
  if (
    key.startsWith("sk_test_") &&
    process.env.JKTL_BUYER_FEES_TEST_MODE === "true"
  )
    return "test";
  return null;
}
export async function feeSchemaInstalled() {
  return Boolean(
    (
      await query("SELECT to_regclass('public.merchant_fee_policies') present")
    )[0]?.present,
  );
}
export async function activeFeePolicy(): Promise<BuyerFeePolicy | null> {
  if (!activationGate() || !(await feeSchemaInstalled())) return null;
  const r = (
    await query(
      "SELECT p.* FROM merchant_fee_configuration c JOIN merchant_fee_policies p ON p.id=c.active_policy_id WHERE c.id=true AND c.approved_at IS NOT NULL AND length(c.provider_evidence)>=10 AND length(c.requirements_evidence)>=10",
    )
  )[0];
  if (!r) return null;
  return {
    id: String(r.id),
    version: Number(r.version),
    label: String(r.label),
    enabled: Boolean(r.enabled),
    bands: validateBands(r.bands),
    sources: r.sources as BuyerFeePolicy["sources"],
    exemptOrganizations: r.exempt_organizations as string[],
  };
}
function fingerprint(
  q: Omit<InvoiceQuote, "token" | "locked">,
  subaccount: string,
) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        q.invoiceId,
        q.invoiceTotalKobo,
        q.receivedKobo,
        q.principalKobo,
        q.feeKobo,
        q.policyVersion,
        subaccount,
      ]),
    )
    .digest("hex");
}
/** Reads authoritative balances, the current reviewed policy or the immutable issued quote. No writes on preview. */
export async function invoiceCheckoutContext(
  invoiceId: string,
  requestedKobo?: number,
) {
  const invoice = await getPublicInvoice(invoiceId);
  if (!invoice || invoice.status === "draft")
    throw Error("This invoice is not available for online payment.");
  const balance = outstanding(invoice);
  if (balance <= 0) throw Error("This invoice has already been paid.");
  const settings = await getPaymentSettings(invoice.organizationId);
  if (!invoice.payoutReady || !payoutReady(settings))
    throw Error("This business has not finished setting up online payments.");
  let principal = requestedKobo ?? balance;
  if (!Number.isSafeInteger(principal) || principal <= 0 || principal > balance)
    throw Error(
      "Choose a positive payment no greater than the outstanding invoice balance.",
    );
  const attempt = (
    await query(
      "SELECT * FROM merchant_payment_attempts WHERE invoice_id=$1 AND organization_id=$2 AND state IN('INITIALIZING','READY','UNKNOWN') ORDER BY created_at DESC LIMIT 1",
      [invoiceId, invoice.organizationId],
    )
  )[0];
  let fee: number,
    policyId: string | null,
    policyVersion: string,
    snapshot: Record<string, unknown>;
  if (attempt) {
    const originalTotal = Number(
        attempt.invoice_total_kobo ?? attempt.principal_kobo,
      ),
      originalBalance = Number(
        attempt.balance_before_kobo ?? attempt.principal_kobo,
      );
    if (
      originalTotal !== invoice.totalKobo ||
      originalBalance !== balance ||
      attempt.subaccount_code !== settings.subaccountCode
    )
      throw Error(
        "This invoice or receiving account changed after checkout. Contact support before paying.",
      );
    principal = Number(attempt.principal_kobo);
    fee = Number(attempt.fee_kobo);
    policyId = attempt.fee_policy_id ? String(attempt.fee_policy_id) : null;
    snapshot =
      attempt.fee_snapshot && typeof attempt.fee_snapshot === "object"
        ? (attempt.fee_snapshot as Record<string, unknown>)
        : {};
    policyVersion = String(snapshot.version || "legacy-fixed-v1");
  } else {
    const policy = await activeFeePolicy();
    fee = buyerFee(principal, "INVOICE", invoice.organizationId, policy);
    policyId = policy?.id || null;
    policyVersion = policy ? String(policy.version) : "legacy-fixed-v1";
    snapshot = {
      version: policyVersion,
      policyId,
      currency: "NGN",
      source: "INVOICE",
      principalKobo: principal,
      feeKobo: fee,
      processorFeeKobo: 0,
      feeBearer: "PAYER",
      processorBearer: "account",
      refundRule: "PROVIDER_EVIDENCE",
    };
  }
  const fields = {
    invoiceId,
    principalKobo: principal,
    invoiceTotalKobo: invoice.totalKobo,
    receivedKobo: invoice.onlineReceivedKobo || 0,
    balanceKobo: balance,
    feeKobo: fee,
    processorFeeKobo: 0 as const,
    buyerTotalKobo: principal + fee,
    currency: "NGN" as const,
    policyId,
    policyVersion,
  };
  if (
    !Number.isSafeInteger(fields.buyerTotalKobo) ||
    fields.buyerTotalKobo > 200000000000
  )
    throw Error("Choose a valid checkout amount.");
  const quote: FrozenInvoiceQuote = {
    ...fields,
    token: fingerprint(fields, settings.subaccountCode),
    locked: Boolean(attempt),
    snapshot,
  };
  return { invoice, settings, quote, attempt };
}
export function publicQuote(quote: FrozenInvoiceQuote): InvoiceQuote {
  const { snapshot: _, ...safe } = quote;
  void _;
  return safe;
}
