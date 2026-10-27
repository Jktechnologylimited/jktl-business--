export const COMMISSION_PRODUCTS = [
  "business_email",
  "domain_registration",
  "custom_project",
] as const;
export type ProductRule = {
  product: (typeof COMMISSION_PRODUCTS)[number];
  kind: "PERCENTAGE" | "FIXED";
  rateBps: number;
  fixedKobo: number;
  recurring: boolean;
  paidMonths: number;
  taxBps: number;
  marginReserveKobo: number;
  capKobo: number;
};
export function productRules(input: unknown): ProductRule[] {
  if (input == null || input === "") return [];
  const values = typeof input === "string" ? JSON.parse(input) : input;
  if (!Array.isArray(values) || values.length > 3)
    throw Error("Choose up to three product commission rules");
  const seen = new Set();
  return values.map((v) => {
    if (
      !v ||
      typeof v !== "object" ||
      !COMMISSION_PRODUCTS.includes(v.product) ||
      seen.has(v.product) ||
      !["PERCENTAGE", "FIXED"].includes(v.kind) ||
      typeof v.recurring !== "boolean"
    )
      throw Error("Check product, calculation kind and recurring eligibility");
    seen.add(v.product);
    const r: ProductRule = {
      product: v.product,
      kind: v.kind,
      rateBps: v.kind === "FIXED" ? 0 : Number(v.rateBps || 0),
      fixedKobo: v.kind === "FIXED" ? Number(v.fixedKobo || 0) : 0,
      recurring: v.recurring,
      paidMonths: Number(v.paidMonths ?? 12),
      taxBps: Number(v.taxBps ?? 0),
      marginReserveKobo: Number(v.marginReserveKobo ?? 0),
      capKobo: Number(v.capKobo),
    };
    if (
      ![
        r.rateBps,
        r.fixedKobo,
        r.paidMonths,
        r.taxBps,
        r.marginReserveKobo,
        r.capKobo,
      ].every(Number.isSafeInteger) ||
      r.rateBps < 0 ||
      r.rateBps > 5000 ||
      r.fixedKobo < 0 ||
      r.fixedKobo > 2000000000 ||
      r.paidMonths < 1 ||
      r.paidMonths > 12 ||
      r.taxBps < 0 ||
      r.taxBps > 10000 ||
      r.marginReserveKobo < 0 ||
      r.marginReserveKobo > 2000000000 ||
      r.capKobo < 1 ||
      r.capKobo > 2000000000 ||
      (r.product === "domain_registration" && r.recurring) ||
      (r.kind === "FIXED" && r.fixedKobo === 0)
    )
      throw Error("Check commission amounts, margins and eligibility periods");
    return r;
  });
}
export function nativeCommission(
  r: ProductRule,
  amount: number,
  fees: number,
  costs: number,
  months: number,
  allocated: number,
) {
  if (
    ![amount, fees, costs, months, allocated].every(Number.isSafeInteger) ||
    amount < 1 ||
    fees < 0 ||
    costs < 0 ||
    months < 1 ||
    months > 36 ||
    allocated < 0 ||
    allocated > months
  )
    throw Error("Invalid verified commission inputs");
  const captured = BigInt(amount),
    tax = (captured * BigInt(r.taxBps)) / BigInt(10000 + r.taxBps),
    raw = captured - BigInt(fees) - BigInt(costs) - tax,
    net = raw > BigInt(0) ? raw : BigInt(0),
    eligibleBase = (net * BigInt(allocated)) / BigInt(months),
    desired =
      r.kind === "FIXED"
        ? (BigInt(r.fixedKobo) * BigInt(allocated)) / BigInt(months)
        : (eligibleBase * BigInt(r.rateBps)) / BigInt(10000),
    margin =
      net > BigInt(r.marginReserveKobo)
        ? net - BigInt(r.marginReserveKobo)
        : BigInt(0),
    commission =
      allocated === 0
        ? BigInt(0)
        : [desired, margin, BigInt(r.capKobo)].reduce((a, b) =>
            a < b ? a : b,
          );
  return {
    netKobo: Number(net),
    taxKobo: Number(tax),
    commissionKobo: Number(commission),
  };
}
