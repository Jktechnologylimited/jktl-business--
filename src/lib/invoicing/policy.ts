/** A bank has been resolved and attached to the provider's settlement account. */
export function payoutReady(s: {
  bankCode: string;
  accountNumber: string;
  accountName: string;
  subaccountCode: string;
}) {
  return Boolean(
    s.bankCode &&
    /^\d{10}$/.test(s.accountNumber) &&
    s.accountName.trim() &&
    /^ACCT_[a-z0-9]+$/i.test(s.subaccountCode),
  );
}
export const BANK_REQUIRED =
  "Add and verify your receiving bank account in Settings → Payments before creating or sending an invoice.";
export function businessInvoiceSender(name: string) {
  const safe =
    name
      .replace(/[<>\x00-\x1f\x7f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 75) || "Your business";
  return `${JSON.stringify(safe + " via JKTL Business")} <notifications@mail.jktl.com.ng>`;
}
/** Signed provider events still need to match the actual invoice amount/currency. */
export function validInvoicePayment(
  data: Record<string, unknown>,
  totalKobo: number,
  feeKobo: number,
) {
  return (
    data.status === "success" &&
    data.currency === "NGN" &&
    typeof data.reference === "string" &&
    data.reference.length > 0 &&
    Number.isSafeInteger(data.amount) &&
    data.amount === totalKobo + feeKobo &&
    Number.isSafeInteger(totalKobo) &&
    totalKobo > 0
  );
}
