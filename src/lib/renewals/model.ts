export function renewalDay(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const day = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : "";
}
export function reminderBucket(days: unknown, interval?: unknown): string | null {
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
  if (interval === "MONTHLY") {
    if (days <= 3) return "3";
    return days <= 7 ? "7" : null;
  }
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
    day = renewalDay(item.due_on),
    date = day ? new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "long", year: "numeric" }).format(new Date(day + "T00:00:00Z")) : "a date that needs confirmation",
    label = item.billing_interval === "ANNUAL" ? "Annual renewal" : item.billing_interval === "MONTHLY" ? "Monthly renewal" : renewalKinds[String(item.kind)] || "Subscription",
    scope = String(item.service_scope || item.name),
    money = (kobo: unknown) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(Number(kobo) / 100),
    history = item.last_paid_on ? `\n\nPrevious payment recorded: ${renewalDay(item.last_paid_on)}${item.last_paid_kobo != null ? " — " + money(item.last_paid_kobo) : ""}.` : "";
  return {
    subject: `${String(item.business_name)} — ${label.toLowerCase()} ${overdue ? "overdue" : "reminder"}`,
    detail: `Hello, ${String(item.business_name)}.\n\n${String(item.name)} ${overdue ? "was due for renewal" : "is due for renewal"} on ${date}.\n\nServices covered:\n${scope}\n\n${item.amount_kobo != null ? "Renewal amount: " + money(item.amount_kobo) + ". Please review the current renewal amount before paying.\n\n" : ""}Review this renewal in JKTL Business to check the service, invoice and payment status.${history}\n\nIf you have already paid or arranged automatic renewal, check the latest account status before paying again. Reply to this email if you need help with renewal or confirming the services covered.`,
    path: String(item.path),
    actionLabel: "Review renewal",
  };
}
