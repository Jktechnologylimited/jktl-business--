import { mailAddress } from "@/lib/mail/addresses";

const value = (form: FormData, key: string, max: number) => {
  const text = String(form.get(key) || "").trim();
  if (text.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text))
    throw Error("Check the length and format of the business details.");
  return text;
};
export function renewalDate(raw: string): string | null {
  if (!raw) return null;
  const date = new Date(raw + "T00:00:00Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== raw)
    throw Error("Provide a valid calendar date.");
  return raw;
}
export function renewalAmount(raw: string): number | null {
  if (!raw) return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) throw Error("Provide an amount in naira with at most two decimal places.");
  const amount = Math.round(Number(raw) * 100);
  if (!Number.isSafeInteger(amount) || amount > 2000000000) throw Error("Provide an amount within the supported limit.");
  return amount;
}
export function communicationInput(form: FormData) {
  const billing = value(form, "billingEmail", 254),
    additional = value(form, "additionalEmails", 1300).split(/[\n,]/).map(s => s.trim()).filter(Boolean),
    status = value(form, "clientStatus", 10),
    revision = Number(form.get("revision"));
  if ((billing && !mailAddress(billing)) || additional.length > 5 || additional.some(e => !mailAddress(e)))
    throw Error("Provide valid individual contact email addresses (at most five additional contacts).");
  if (!["ACTIVE", "PAUSED", "CLOSED"].includes(status) || !Number.isSafeInteger(revision) || revision < 0)
    throw Error("Check the client status and current revision.");
  return {
    businessName: value(form, "businessName", 200), contactName: value(form, "contactName", 200),
    billingEmail: billing ? mailAddress(billing) : "", phone: value(form, "phone", 50),
    additionalEmails: [...new Set(additional.map(mailAddress))], clientStatus: status,
    notes: value(form, "notes", 2000), revision,
  };
}
export function trackedDetailsInput(form: FormData) {
  const interval = value(form, "interval", 10), revision = Number(form.get("revision") || 0);
  if (interval && !["ANNUAL", "MONTHLY", "ONCE"].includes(interval)) throw Error("Choose a supported billing interval.");
  if (!Number.isSafeInteger(revision) || revision < 0) throw Error("Check the latest renewal revision.");
  return {
    billingInterval: interval || null, serviceScope: value(form, "scope", 2000),
    lastPaidOn: renewalDate(value(form, "lastPaidOn", 10)), lastPaidKobo: renewalAmount(value(form, "lastPaidAmount", 30)),
    paymentNote: value(form, "paymentNote", 1000), remindersEnabled: form.get("remindersEnabled") === "on", revision,
  };
}
