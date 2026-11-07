export function reminderBucket(days: unknown): string | null {
  if (
    typeof days !== "number" ||
    !Number.isFinite(days) ||
    days > 30 ||
    days < -30
  )
    return null;
  if (days <= -7) return "overdue-7";
  if (days <= 0) return "due";
  if (days <= 1) return "1";
  if (days <= 7) return "7";
  if (days <= 14) return "14";
  return "30";
}
export const renewalKinds: Record<string, string> = {
  DOMAIN: "Domain",
  HOSTING: "Hosting",
  BUSINESS_EMAIL: "Business email",
  OTHER: "Other subscription",
};
export function renewalMessage(item: Record<string, unknown>) {
  const overdue = Number(item.days_left) < 0,
    date = String(item.due_on).slice(0, 10),
    label = renewalKinds[String(item.kind)] || "Subscription";
  return {
    subject: `${label} ${overdue ? "renewal overdue" : "renewal reminder"} — ${String(item.name)}`,
    detail: `Hello, ${String(item.business_name)}.\n\n${String(item.name)} ${overdue ? "was due for renewal" : "is due for renewal"} on ${date}.\n\n${item.amount_kobo != null ? "Recorded amount: " + new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(Number(item.amount_kobo) / 100) + ". Please review the current renewal amount before paying.\n\n" : ""}Open your JKTL Business account to review the service, renewal options and payment status. If you have already paid or arranged automatic renewal, check the latest account status before paying again. Contact JKTL if you need help.`,
    path: String(item.path),
  };
}
