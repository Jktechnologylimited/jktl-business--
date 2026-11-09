import { INVOICE_PLATFORM_FEE_KOBO } from "@/lib/invoicing/policy";
export type MerchantSource = "INVOICE" | "WEBSITE";
export type FeeBand = { minKobo: number; feeKobo: number };
export type BuyerFeePolicy = {
  id: string;
  version: number;
  label: string;
  enabled: boolean;
  bands: FeeBand[];
  sources: MerchantSource[];
  exemptOrganizations: string[];
};
export const PROPOSED_BANDS: FeeBand[] = [
  { minKobo: 0, feeKobo: 0 },
  { minKobo: 500000, feeKobo: 10000 },
  { minKobo: 5000000, feeKobo: 20000 },
];
const integer = (n: unknown): n is number =>
  Number.isSafeInteger(n) && Number(n) >= 0 && Number(n) <= 200000000000;
export function validateBands(input: unknown): FeeBand[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > 12)
    throw Error("Use between one and twelve fee bands.");
  let previous = -1;
  return input.map((raw, i) => {
    if (
      !raw ||
      !integer(raw.minKobo) ||
      !integer(raw.feeKobo) ||
      (i === 0 && raw.minKobo !== 0) ||
      raw.minKobo <= previous
    )
      throw Error(
        "Use increasing fee band thresholds starting at zero, in integer kobo.",
      );
    previous = raw.minKobo;
    return { minKobo: raw.minKobo, feeKobo: raw.feeKobo };
  });
}
/** The band is selected once from merchant principal, never from principal plus fee. */
export function buyerFee(
  principalKobo: number,
  source: string,
  organizationId: string,
  policy: BuyerFeePolicy | null,
): number {
  if (!integer(principalKobo) || principalKobo === 0)
    throw Error("Use a valid positive payment amount.");
  if (source !== "INVOICE" && source !== "WEBSITE") return 0; // JKTL's own billing is always excluded.
  if (!policy) return source === "INVOICE" ? INVOICE_PLATFORM_FEE_KOBO : 0; // Preserve the existing invoice arrangement until explicit activation.
  if (
    !policy.enabled ||
    !policy.sources.includes(source) ||
    policy.exemptOrganizations.includes(organizationId)
  )
    return 0;
  const bands = validateBands(policy.bands);
  return [...bands].reverse().find((b) => principalKobo >= b.minKobo)!.feeKobo;
}
export function minorInput(value: string, allowZero = false) {
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(value))
    throw Error("Use an amount with up to two decimal places.");
  const [a, b = ""] = value.split("."),
    n = Number(a) * 100 + Number(b.padEnd(2, "0"));
  if (!integer(n) || (!allowZero && n === 0))
    throw Error("Use a valid payment amount.");
  return n;
}
export type InvoiceQuote = {
  invoiceId: string;
  principalKobo: number;
  invoiceTotalKobo: number;
  receivedKobo: number;
  balanceKobo: number;
  feeKobo: number;
  processorFeeKobo: 0;
  buyerTotalKobo: number;
  currency: "NGN";
  policyId: string | null;
  policyVersion: string;
  token: string;
  locked: boolean;
};
export type FrozenInvoiceQuote = InvoiceQuote & {
  snapshot: Record<string, unknown>;
};
export function outstanding(invoice: {
  status: string;
  totalKobo: number;
  onlineReceivedKobo?: number;
}) {
  return invoice.status === "paid"
    ? 0
    : Math.max(0, invoice.totalKobo - (invoice.onlineReceivedKobo || 0));
}
