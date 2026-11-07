export type InvitationTerm = { label: string; description: string };
const products: Record<string, string> = {
  website_subscription: "Website subscriptions",
  business_email: "Business email",
  domain_registration: "Domain registration",
  custom_project: "Custom projects",
};
/** Display only recognised policy fields. Never print stored objects or invent missing rates. */
export function invitationTerms(input: unknown): InvitationTerm[] {
  const t =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const rows: InvitationTerm[] = [];
  const number = (key: string) =>
    typeof t[key] === "number" && Number.isFinite(t[key])
      ? (t[key] as number)
      : null;
  const rate = number("rateBps"),
    months = number("paidMonths"),
    hold = number("holdDays");
  if (rate !== null)
    rows.push({
      label: "Proposed commission",
      description: `${rate / 100}% of eligible net revenue.`,
    });
  if (Array.isArray(t.products)) {
    const names = t.products
      .filter((p): p is string => typeof p === "string")
      .map((p) => products[p] || p.replaceAll("_", " "));
    if (names.length)
      rows.push({
        label: "Eligible products",
        description: names.join(", ") + ".",
      });
  }
  if (months !== null)
    rows.push({
      label: "Earning period",
      description: `The first ${months} paid service ${months === 1 ? "month" : "months"} per referred customer.`,
    });
  if (hold !== null)
    rows.push({
      label: "Earnings review",
      description: `Commissions are held for at least ${hold} ${hold === 1 ? "day" : "days"} before review.`,
    });
  if (
    t.netDefinition ===
    "captured_less_tax_processing_refunds_chargebacks_and_third_party_costs"
  )
    rows.push({
      label: "How net revenue is calculated",
      description:
        "Payments received, less taxes, processing fees, refunds, chargebacks and third-party costs.",
    });
  else if (typeof t.netDefinition === "string" && t.netDefinition.includes(" "))
    rows.push({
      label: "How net revenue is calculated",
      description: t.netDefinition,
    });
  if (t.discounts === "already_excluded_from_captured")
    rows.push({
      label: "Discounts",
      description:
        "Discounts are excluded from the payment amount used to calculate commission.",
    });
  if (typeof t.currency === "string")
    rows.push({
      label: "Currency",
      description: t.currency === "NGN" ? "Nigerian naira (NGN)." : t.currency,
    });
  if (t.automaticPayouts === false)
    rows.push({
      label: "Payouts",
      description:
        "Payouts require review and approval; they are not automatic.",
    });
  if (t.automaticPayouts === true)
    rows.push({
      label: "Payouts",
      description:
        "Automatic payouts are proposed, subject to the separately activated agreement.",
    });
  if (t.renewalsBeyondTerm === false)
    rows.push({
      label: "Later renewals",
      description: "Renewals beyond the stated earning period do not qualify.",
    });
  if (t.renewalsBeyondTerm === true)
    rows.push({
      label: "Later renewals",
      description:
        "Renewals beyond the stated earning period are included in this proposal.",
    });
  if (t.stackWithResellerDiscount === false)
    rows.push({
      label: "Reseller discounts",
      description:
        "Referral commissions cannot be combined with reseller discounts on the same purchase.",
    });
  if (t.stackWithResellerDiscount === true)
    rows.push({
      label: "Reseller discounts",
      description:
        "This proposal allows referral commissions alongside reseller discounts.",
    });
  return rows;
}
