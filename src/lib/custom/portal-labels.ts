export const PORTAL_SCOPES = [
  "billing:read",
  "invoices:read",
  "invoices:pay",
  "support:read",
  "support:write",
  "earn:read",
  "earn:write",
] as const;
export function portalScopes(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.some((s) => !(PORTAL_SCOPES as readonly unknown[]).includes(s))
  )
    throw Error("Select valid project permissions.");
  return [...new Set(value)] as string[];
}
export function invoiceStatus(
  invoice: Record<string, unknown>,
  today = new Date().toISOString().slice(0, 10),
) {
  if (
    invoice.status === "DRAFT" ||
    invoice.status === "VOID" ||
    invoice.status === "PAID"
  )
    return invoice.status;
  if (String(invoice.due_on).slice(0, 10) < today) return "OVERDUE";
  return Number(invoice.paid_kobo) > 0 ? "PARTIALLY_PAID" : "ISSUED";
}

export function nextInvoicePayment(invoice: Record<string, unknown>) {
  const paid = Number(invoice.paid_kobo),
    total = Number(invoice.amount_kobo);
  let cumulative = 0;
  if (Array.isArray(invoice.instalments))
    for (const row of invoice.instalments) {
      cumulative += Number(row.amountKobo);
      if (cumulative > paid) return Math.min(total - paid, cumulative - paid);
    }
  return Math.max(0, total - paid);
}
