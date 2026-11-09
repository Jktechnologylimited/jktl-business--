import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { query } from "@/lib/custom/service";
import { getInvoice } from "@/lib/db/invoices";
import { INVOICE_PLATFORM_FEE_KOBO } from "@/lib/paystack";
import { finalizeInvoicePaid } from "@/lib/invoice-finalize";
import { verifiedMerchantPayment } from "./model";
import type { FrozenInvoiceQuote } from "@/lib/merchant-fees/model";
export async function merchantLedgerInstalled() {
  return Boolean(
    (await query("SELECT to_regclass('public.merchant_payments') present"))[0]
      ?.present,
  );
}
export async function reserveMerchantCheckout(
  invoice: { id: string; organizationId: string; totalKobo: number },
  subaccount: string,
  quote?: FrozenInvoiceQuote,
) {
  const ref = "jktl_inv_" + randomUUID().replaceAll("-", "");
  const created = await query(
    `INSERT INTO merchant_payment_attempts(reference,organization_id,invoice_id,principal_kobo,fee_kobo,subaccount_code,invoice_total_kobo,balance_before_kobo,fee_policy_id,fee_snapshot) SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb WHERE EXISTS(SELECT 1 FROM invoices WHERE id=$3 AND organization_id=$2 AND status IN('pending','overdue') AND total_kobo=$7 AND total_kobo-online_received_kobo=$8 AND $4<=total_kobo-online_received_kobo) ON CONFLICT DO NOTHING RETURNING *`,
    [
      ref,
      invoice.organizationId,
      invoice.id,
      quote?.principalKobo ?? invoice.totalKobo,
      quote?.feeKobo ?? INVOICE_PLATFORM_FEE_KOBO,
      subaccount,
      quote?.invoiceTotalKobo ?? invoice.totalKobo,
      quote?.balanceKobo ?? invoice.totalKobo,
      quote?.policyId ?? null,
      JSON.stringify(
        quote?.snapshot ?? {
          version: "legacy-fixed-v1",
          feeKobo: INVOICE_PLATFORM_FEE_KOBO,
        },
      ),
    ],
  );
  if (created[0]) return { created: true, row: created[0] };
  const rows = await query(
    "SELECT * FROM merchant_payment_attempts WHERE invoice_id=$1 AND organization_id=$2 AND state IN('INITIALIZING','READY','UNKNOWN') ORDER BY created_at DESC LIMIT 1",
    [invoice.id, invoice.organizationId],
  );
  if (!rows[0]) throw Error("Check the invoice status before trying to pay.");
  return { created: false, row: rows[0] };
}
/** Internal only: callers must have verified the provider signature or performed server-side verification. */
export async function recordVerifiedMerchantPayment(
  data: Record<string, unknown>,
) {
  const m =
    data.metadata && typeof data.metadata === "object"
      ? (data.metadata as Record<string, unknown>)
      : {};
  const org = String(m.organizationId || ""),
    id = String(m.invoiceId || "");
  const invoice = await getInvoice(org, id);
  if (!invoice) throw Error("Verify the invoice belongs to the payment.");
  const attempt = (
    await query(
      "SELECT * FROM merchant_payment_attempts WHERE reference=$1 AND organization_id=$2 AND invoice_id=$3",
      [String(data.reference || ""), org, id],
    )
  )[0];
  if(String(data.reference||'').startsWith('jktl_inv_')&&!attempt)throw Error('Verify the original server checkout quote for this payment.');
  const p = verifiedMerchantPayment(
    data,
    attempt
      ? {
          ...invoice,
          totalKobo: Number(attempt.principal_kobo),
          status: "pending",
        }
      : invoice,
    attempt ? Number(attempt.fee_kobo) : INVOICE_PLATFORM_FEE_KOBO,
  );
  const rows = await query(
    `WITH locked AS(SELECT * FROM invoices WHERE id=$1 AND organization_id=$2 AND (status<>'draft' OR $10::boolean) FOR UPDATE),payment AS(
 INSERT INTO merchant_payments(reference,provider_transaction,organization_id,invoice_id,source,currency,mode,principal_kobo,charged_kobo,gross_fee_kobo,processor_kobo,split_evidenced,applied_to_invoice,paid_at,fee_policy_id,fee_snapshot)
 SELECT $4,$5,$2,$1,'INVOICE','NGN',$6,$3,$7,$8,$9,$10,(status IN('pending','overdue') AND total_kobo=$12 AND online_received_kobo=$13 AND online_received_kobo+$3<=total_kobo) OR (status='paid' AND payment_reference=$4 AND paid_via='online'),$11,$14,$15::jsonb FROM locked ON CONFLICT DO NOTHING RETURNING *
 ),changed AS(UPDATE invoices i SET online_received_kobo=i.online_received_kobo+p.principal_kobo,status=CASE WHEN i.online_received_kobo+p.principal_kobo=i.total_kobo THEN 'paid' ELSE i.status END,paid_at=CASE WHEN i.online_received_kobo+p.principal_kobo=i.total_kobo THEN p.paid_at ELSE i.paid_at END,paid_via='online',payment_reference=p.reference,platform_fee_kobo=i.platform_fee_kobo+p.gross_fee_kobo FROM payment p WHERE i.id=p.invoice_id AND i.organization_id=p.organization_id AND p.applied_to_invoice AND i.status IN('pending','overdue') AND i.total_kobo=$12 AND i.online_received_kobo=$13 RETURNING i.id),attempt AS(UPDATE merchant_payment_attempts SET state='SUCCESS',updated_at=now() WHERE reference=$4 AND EXISTS(SELECT 1 FROM payment) RETURNING reference)
 SELECT p.*,EXISTS(SELECT 1 FROM changed) changed FROM payment p`,
    [
      id,
      org,
      p.principal,
      p.reference,
      p.providerId,
      p.mode,
      p.amount,
      p.fee,
      p.processor,
      Boolean(attempt),
      p.paidAt,
      Number(
        attempt?.invoice_total_kobo ??
          attempt?.principal_kobo ??
          invoice.totalKobo,
      ),
      attempt
        ? Number(attempt.invoice_total_kobo ?? attempt.principal_kobo) -
          Number(attempt.balance_before_kobo ?? attempt.principal_kobo)
        : 0,
      attempt?.fee_policy_id ?? null,
      JSON.stringify(
        attempt?.fee_snapshot ?? { version: "legacy-fixed-v1", feeKobo: p.fee },
      ),
    ],
  );
  if (!rows.length) {
    const old = (
      await query(
        "SELECT * FROM merchant_payments WHERE reference=$1 OR provider_transaction=$2",
        [p.reference, p.providerId],
      )
    )[0];
    if (
      !old ||
      old.reference !== p.reference ||
      old.provider_transaction !== p.providerId ||
      old.organization_id !== org ||
      old.invoice_id !== id ||
      Number(old.charged_kobo) !== p.amount
    )
      throw Error("Verify conflicting provider transaction evidence.");
    if (old.mode !== "unknown" && p.mode !== "unknown" && old.mode !== p.mode)
      throw Error("Verify conflicting provider mode evidence.");
    if (old.mode === "unknown" && p.mode === "live")
      await query(
        "INSERT INTO merchant_payment_events(event_key,reference,kind,evidence,actor_id) VALUES($1,$2,'LIVE_MODE_CONFIRMED','Server-verified live provider mode','provider-verification') ON CONFLICT DO NOTHING",
        ["mode:" + p.reference, p.reference],
      );
    if (old.processor_kobo === null && p.processor !== null)
      await query(
        "INSERT INTO merchant_payment_events(event_key,reference,kind,amount_kobo,evidence,actor_id) VALUES($1,$2,'PROCESSOR_COST',$3,'Paystack verified processor charge','provider-verification') ON CONFLICT DO NOTHING",
        ["processor:" + p.reference, p.reference, p.processor],
      );
    return { applied: Boolean(old.applied_to_invoice) };
  }
  if (rows[0].changed) {
    const updated = await getInvoice(org, id);
    if (updated)
      await finalizeInvoicePaid(org, updated, {
        reference: p.reference,
        method: "Paystack",
        paymentAmountKobo: p.principal,
        platformFeeKobo: p.fee,
        remainingKobo: Math.max(
          0,
          updated.totalKobo - (updated.onlineReceivedKobo || 0),
        ),
        paidAt: p.paidAt,
      });
  }
  return { applied: Boolean(rows[0].applied_to_invoice) };
}
export async function handleMerchantPaymentEvent(
  event: string,
  data: Record<string, unknown>,
) {
  if (!(await merchantLedgerInstalled())) return false;
  const m =
    data.metadata && typeof data.metadata === "object"
      ? (data.metadata as Record<string, unknown>)
      : {};
  if (event === "charge.success" && m.type === "invoice_payment") {
    try {
      await recordVerifiedMerchantPayment(data);
      await query(
        "UPDATE merchant_reconciliation_issues SET resolved_at=now() WHERE reference=$1",
        [String(data.reference || "")],
      );
    } catch (e) {
      if (!(e instanceof Error) || !e.message.startsWith("Verify")) throw e;
      const ref = String(data.reference || "");
      if (!/^[a-zA-Z0-9_-]{4,160}$/.test(ref)) throw e;
      await query(
        "INSERT INTO merchant_reconciliation_issues(reference,provider_transaction,reason) VALUES($1,$2,'SIGNED_PAYMENT_MISMATCH') ON CONFLICT DO NOTHING",
        [ref, String(data.id || "").slice(0, 128)],
      );
    }
    return true;
  }
  if (event !== "refund.processed" && !event.startsWith("charge.dispute."))
    return false;
  const tx =
    data.transaction && typeof data.transaction === "object"
      ? (data.transaction as Record<string, unknown>)
      : {};
  const reference = typeof tx.reference === "string" ? tx.reference : "";
  if (!reference) return false;
  const payment = (
    await query(
      "SELECT reference,currency FROM merchant_payments WHERE reference=$1",
      [reference],
    )
  )[0];
  if (!payment) {
    const known =
      reference.startsWith("jktl_inv_") ||
      (
        await query(
          "SELECT reference FROM merchant_payment_attempts WHERE reference=$1 UNION SELECT payment_reference reference FROM invoices WHERE payment_reference=$1 AND paid_via='online'",
          [reference],
        )
      )[0];
    if (known)
      throw Error(
        "Verify the original merchant payment before applying its refund or dispute.",
      );
    return false;
  }
  if (!data.id || String(data.id).length > 128)
    throw Error("Verify the provider refund or dispute identifier.");
  const amount = data.amount;
  if (
    !Number.isSafeInteger(amount) ||
    Number(amount) <= 0 ||
    (data.currency && data.currency !== payment.currency)
  )
    throw Error("Verify refund or dispute amount and currency.");
  const eventKey = createHash("sha256")
    .update(
      JSON.stringify([
        event,
        String(data.id || ""),
        reference,
        amount,
        String(data.currency || payment.currency),
      ]),
    )
    .digest("hex");
  await query(
    "INSERT INTO merchant_payment_events(event_key,reference,kind,amount_kobo,evidence,actor_id) VALUES($1,$2,$3,$4,$5,'paystack-signed-webhook') ON CONFLICT DO NOTHING",
    [
      eventKey,
      reference,
      event === "refund.processed" ? "REFUND" : "DISPUTE",
      amount,
      "Signed Paystack " + event + "; fee allocation requires reconciliation.",
    ],
  );
  return true;
}
