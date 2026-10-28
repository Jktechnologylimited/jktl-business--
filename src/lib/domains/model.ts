export type Query = (
  text: string,
  params: unknown[],
) => Promise<Record<string, unknown>[]>;
export const DOMAIN_TERMS = "domain-order-2026-01";
export type Registrant = {
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};
export const orderStatuses = [
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
  "ACTIVE",
  "FAILED",
  "REFUND_PENDING",
  "REFUNDED",
  "CANCELLED",
] as const;
export function normalizeOrderDomain(
  input: unknown,
  extension: string,
): string {
  if (
    typeof input !== "string" ||
    typeof extension !== "string" ||
    input.length > 253 ||
    extension.length > 128
  )
    throw Error("Enter a domain name.");
  let s = input.trim().normalize("NFC").toLowerCase();
  // URL implements IDNA in both browser and server runtimes. Reject URL syntax
  // before conversion so ports, paths, credentials and percent escapes cannot
  // become a different domain than the customer entered.
  if (/[\s/:@?#%\\]/u.test(s)) throw Error("Use a domain name without a URL.");
  try {
    s = new URL("https://" + s).hostname;
  } catch {
    throw Error("Enter a valid internationalized domain name.");
  }
  if (s.endsWith(extension)) s = s.slice(0, -extension.length);
  if (
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(s) ||
    !/^\.[a-z]{2,63}(\.[a-z]{2,63})?$/.test(extension)
  )
    throw Error(
      "Use a name with letters, numbers and hyphens only, without a URL or subdomain.",
    );
  const domain = s + extension;
  if (domain.length > 253) throw Error("Use a shorter domain name.");
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "jktl.com.ng";
  if (domain === root || domain.endsWith("." + root))
    throw Error("JKTL platform addresses cannot be purchased.");
  return domain;
}
export function parseRegistrant(raw: unknown): Registrant {
  if (!raw || typeof raw !== "object")
    throw Error("Complete the registrant details.");
  const r = raw as Record<string, unknown>;
  const field = (key: string, max: number, optional = false) => {
    const value = r[key];
    if (
      typeof value !== "string" ||
      value.length > max ||
      (!optional && value.trim().length < 2)
    )
      throw Error(`Check registrant ${key}.`);
    return value.trim();
  };
  const contact = {
    name: field("name", 120),
    email: field("email", 200).toLowerCase(),
    phone: field("phone", 24),
    company: field("company", 180, true),
    address: field("address", 250),
    city: field("city", 100),
    state: field("state", 100),
    postalCode: field("postalCode", 20),
    country: field("country", 2).toUpperCase(),
  };
  if (
    !/^\S+@\S+\.\S+$/.test(contact.email) ||
    !/^\+?[0-9 ()-]{7,24}$/.test(contact.phone) ||
    !/^[A-Z]{2}$/.test(contact.country)
  )
    throw Error(
      "Check the registrant email, telephone and two-letter country code.",
    );
  return contact;
}
export function priceKobo(raw: unknown, allowZero = false): number {
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < (allowZero ? 0 : 1) || n > 1_000_000_000)
    throw Error("Enter a valid price in kobo.");
  return n;
}
export function orderTotal(unit: unknown, years: unknown, max: unknown) {
  const n = Number(years);
  if (!Number.isInteger(n) || n < 1 || n > Number(max) || n > 10)
    throw Error("Choose a supported registration period.");
  const total = priceKobo(unit) * n;
  if (!Number.isSafeInteger(total) || total > 2_000_000_000)
    throw Error("Order total is too large.");
  return total;
}
export function parseNameservers(input: unknown): string[] {
  if (typeof input !== "string" || input.length > 1000)
    throw Error("Enter the nameservers.");
  const values = [
    ...new Set(
      input
        .split(/[\s,]+/)
        .filter(Boolean)
        .map((v) => v.toLowerCase().replace(/\.$/, "")),
    ),
  ];
  if (
    values.length < 2 ||
    values.length > 6 ||
    values.some(
      (v) =>
        v.length > 253 ||
        !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(v),
    )
  )
    throw Error("Enter between two and six valid nameserver hostnames.");
  return values;
}
export function expectedExpiry(base: Date, years: number): Date {
  const d = new Date(base);
  const month = d.getUTCMonth();
  d.setUTCFullYear(d.getUTCFullYear() + years);
  if (d.getUTCMonth() !== month) d.setUTCDate(0);
  return d;
}
export function validateFulfilmentDates(
  registered: string,
  expiry: string,
  years: number,
  base?: string,
) {
  const start = new Date(registered),
    end = new Date(expiry),
    expected = expectedExpiry(new Date(base || registered), years);
  if (
    !Number.isFinite(+start) ||
    !Number.isFinite(+end) ||
    +start > Date.now() + 86400000 ||
    +end <= +start ||
    Math.abs(+end - +expected) > 7 * 86400000
  )
    throw Error(
      "Check the confirmed registration and expiry dates against the selected period.",
    );
  return { start: start.toISOString(), end: end.toISOString() };
}
export const money = (v: unknown) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(
    Number(v) / 100,
  );

/** Public discovery vocabulary; AVAILABLE remains an internal checkout proof. */
export function domainAvailabilityStatus(
  result: { status: string; registryStatus?: string },
  supported = true,
) {
  if (!supported) return "UNSUPPORTED";
  if (result.status === "UNAVAILABLE" || result.registryStatus === "REGISTERED")
    return "REGISTERED";
  if (result.status === "AVAILABLE" || result.registryStatus === "NOT_FOUND")
    return "APPEARS_AVAILABLE";
  return "UNKNOWN";
}
export function domainProgress(order: Record<string, unknown>): string {
  const stage = ["PAID", "PROCESSING"].includes(String(order.status))
    ? String(order.fulfillment_stage || order.status)
    : String(order.status);
  return (
    (
      {
        PENDING_PAYMENT: "Awaiting payment",
        PAID: "Payment confirmed",
        PROCESSING: "Preparing your domain",
        VERIFYING_AVAILABILITY: "Checking your domain",
        PENDING_REGISTRATION: "Preparing registration",
        REGISTERING: "Registration in progress",
        RECONCILIATION_REQUIRED:
          "Confirming the registrar result — no second payment is needed",
        MANUAL_REVIEW: "The JKTL team is reviewing your order",
        ACTIVE: "Domain active",
        FAILED:
          "We could not complete this order — contact support for your options",
        REFUND_PENDING: "Refund review in progress",
        REFUNDED: "Refund confirmed",
        CANCELLED: "Order cancelled",
      } as Record<string, string>
    )[stage] || "Order under review"
  );
}
