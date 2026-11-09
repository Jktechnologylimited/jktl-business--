export type MerchantInvoice = {
  id: string;
  organizationId: string;
  totalKobo: number;
  status: string;
  platformFeeKobo?: number;
};
export function verifiedMerchantPayment(
  data: Record<string, unknown>,
  invoice: MerchantInvoice,
  feeKobo: number,
) {
  const metadata =
    data.metadata && typeof data.metadata === "object"
      ? (data.metadata as Record<string, unknown>)
      : {};
  const amount = data.amount,
    ref = data.reference,
    id = data.id,
    paid = new Date(String(data.paid_at || ""));
  if (
    data.status !== "success" ||
    data.currency !== "NGN" ||
    !Number.isSafeInteger(amount) ||
    amount !== invoice.totalKobo + feeKobo ||
    !Number.isSafeInteger(invoice.totalKobo) ||
    invoice.totalKobo <= 0 ||
    !Number.isSafeInteger(feeKobo) ||
    feeKobo < 0 ||
    typeof ref !== "string" ||
    ref.length < 4 ||
    ref.length > 160 ||
    !id ||
    String(id).length > 128 ||
    !Number.isFinite(paid.getTime()) ||
    paid.getTime() > Date.now() + 300000 ||
    metadata.type !== "invoice_payment" ||
    metadata.invoiceId !== invoice.id ||
    metadata.organizationId !== invoice.organizationId ||
    invoice.status === "draft"
  )
    throw Error(
      "Verify the payment reference, invoice, amount and currency before reconciling.",
    );
  return {
    reference: ref,
    providerId: String(id),
    mode:
      data.domain === "live"
        ? "live"
        : data.domain === "test"
          ? "test"
          : "unknown",
    amount: Number(amount),
    principal: invoice.totalKobo,
    fee: feeKobo,
    processor:
      Number.isSafeInteger(data.fees) && Number(data.fees) >= 0
        ? Number(data.fees)
        : null,
    paidAt: paid.toISOString(),
  };
}
export function moneyInput(value: FormDataEntryValue | null) {
  const s = String(value || "");
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(s))
    throw Error("Use a positive amount with up to two decimal places.");
  const n = Math.round(Number(s) * 100);
  if (!Number.isSafeInteger(n) || n <= 0 || n > 200000000000)
    throw Error("Use a valid positive amount.");
  return n;
}
export function financialDay(value: unknown) {
  const s = String(value || "");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    !Number.isFinite(Date.parse(s)) ||
    new Date(s).toISOString().slice(0, 10) !== s
  )
    throw Error("Choose a valid calendar date.");
  return s;
}
/** Exact half-up conversion: supported original currencies all have 100 minor units. */
export function convertMinor(amount: number, rate: string) {
  if (
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    !/^\d{1,10}(?:\.\d{1,8})?$/.test(rate)
  ) {
    throw Error("Provide a valid original amount and explicit exchange rate.");
  }
  const [whole, fraction = ""] = rate.split(".");
  const scale = BigInt(10) ** BigInt(fraction.length);
  const multiplier = BigInt(whole + fraction);
  if (multiplier <= BigInt(0)) throw Error("Use a positive exchange rate.");
  const converted = (BigInt(amount) * multiplier + scale / BigInt(2)) / scale;
  if (converted <= BigInt(0) || converted > BigInt(200000000000)) {
    throw Error("Use a valid converted cost amount.");
  }
  return Number(converted);
}
