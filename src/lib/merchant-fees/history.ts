import "server-only";
import { query } from "@/lib/custom/service";
export type PaymentHistoryItem = {
  reference: string;
  principalKobo: number;
  feeKobo: number;
  buyerTotalKobo: number;
  refundKobo: number;
  paidAt: string;
  settlement: string;
  applied: boolean;
};
/** The invoice must already have been authorized by session or opaque public invoice lookup. */
export async function invoicePaymentHistory(
  organizationId: string,
  invoiceId: string,
): Promise<PaymentHistoryItem[]> {
  if (
    !(await query("SELECT to_regclass('public.merchant_payments') present"))[0]
      ?.present
  )
    return [];
  const rows = await query(
    `SELECT p.reference,p.principal_kobo,p.gross_fee_kobo,p.charged_kobo,p.paid_at,p.settlement_status,p.applied_to_invoice,COALESCE((SELECT sum(e.amount_kobo) FROM merchant_payment_events e WHERE e.reference=p.reference AND e.kind='REFUND'),0) refunded FROM merchant_payments p WHERE p.organization_id=$1 AND p.invoice_id=$2 ORDER BY p.paid_at DESC LIMIT 100`,
    [organizationId, invoiceId],
  );
  return rows.map((r) => ({
    reference: String(r.reference),
    principalKobo: Number(r.principal_kobo),
    feeKobo: Number(r.gross_fee_kobo),
    buyerTotalKobo: Number(r.charged_kobo),
    refundKobo: Number(r.refunded),
    paidAt: new Date(String(r.paid_at)).toISOString(),
    settlement: String(r.settlement_status),
    applied: Boolean(r.applied_to_invoice),
  }));
}
