/** Proposed policy calculator only. Not connected to payment accrual until launch. */
export type CommissionQuote = {
  captured: number;
  tax: number;
  processing: number;
  discounts: number;
  refunds: number;
  chargebacks: number;
  thirdPartyCosts: number;
  rateBps: number;
  paidMonthsBefore: number;
  serviceMonths: number;
  termMonths: number;
  minimumNet: number;
  maximumCommission: number;
  marginReserve: number;
  resellerDiscount: number;
  stackingApproved: boolean;
  capturedSuccessfully: boolean;
  testPayment: boolean;
  selfReferral: boolean;
  currency: string;
  eligibleCurrencies: string[];
};
function integer(n: number) {
  if (!Number.isSafeInteger(n) || n < 0)
    throw Error("Amounts and periods must be nonnegative safe integers");
  return BigInt(n);
}
export function calculateCommission(q: CommissionQuote) {
  const amounts = [
    q.captured,
    q.tax,
    q.processing,
    q.discounts,
    q.refunds,
    q.chargebacks,
    q.thirdPartyCosts,
    q.minimumNet,
    q.maximumCommission,
    q.marginReserve,
    q.resellerDiscount,
    q.paidMonthsBefore,
    q.serviceMonths,
    q.termMonths,
    q.rateBps,
  ];
  amounts.forEach(integer);
  if (
    q.rateBps > 10000 ||
    q.serviceMonths < 1 ||
    q.serviceMonths > 36 ||
    q.termMonths < 1 ||
    q.termMonths > 120
  )
    throw Error("Invalid policy duration or rate");
  // Discounts are recorded for audit. Captured already excludes the discount;
  // subtracting it again would understate net revenue.
  const deductions = [
    q.tax,
    q.processing,
    q.refunds,
    q.chargebacks,
    q.thirdPartyCosts,
  ].reduce((a, v) => a + integer(v), BigInt(0));
  const net =
    integer(q.captured) > deductions
      ? integer(q.captured) - deductions
      : BigInt(0);
  const months = Math.max(
    0,
    Math.min(q.serviceMonths, q.termMonths - q.paidMonthsBefore),
  );
  const eligible =
    q.capturedSuccessfully &&
    q.refunds === 0 &&
    q.chargebacks === 0 &&
    !q.testPayment &&
    !q.selfReferral &&
    q.eligibleCurrencies.includes(q.currency) &&
    (!q.resellerDiscount || q.stackingApproved) &&
    months > 0 &&
    net >= integer(q.minimumNet);
  const base = eligible
    ? (net * BigInt(months)) / BigInt(q.serviceMonths)
    : BigInt(0);
  const percentage = (base * BigInt(q.rateBps)) / BigInt(10000);
  const margin =
    net > integer(q.marginReserve) ? net - integer(q.marginReserve) : BigInt(0);
  const capped =
    percentage < integer(q.maximumCommission)
      ? percentage
      : integer(q.maximumCommission);
  return {
    net: Number(net),
    eligibleMonths: months,
    commission: Number(capped < margin ? capped : margin),
  };
}
