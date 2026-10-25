export const EMAIL_TERMS = "email-service-2026-01";
export function emailDomain(v: unknown) {
  if (typeof v !== "string") throw Error("Enter a valid domain.");
  const d = v.trim().toLowerCase();
  if (
    d.length > 253 ||
    !d.includes(".") ||
    d
      .split(".")
      .some((p) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(p)) ||
    d === "jktl.com.ng" ||
    d.endsWith(".jktl.com.ng")
  )
    throw Error("Enter a domain you own, without a website address or path.");
  return d;
}
export function mailboxAddresses(v: unknown, domain: string, limit: number) {
  if (typeof v !== "string" || v.length > 10000)
    throw Error("Enter the requested mailbox addresses.");
  const a = v
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map((s) =>
      s.toLowerCase().includes("@")
        ? s.toLowerCase()
        : `${s.toLowerCase()}@${domain}`,
    );
  if (
    !a.length ||
    a.length > limit ||
    new Set(a).size !== a.length ||
    a.some(
      (s) =>
        s.split("@").length !== 2 ||
        s.split("@")[1] !== domain ||
        !/^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/.test(s.split("@")[0]),
    )
  )
    throw Error(
      "Enter unique mailbox names on the selected domain, within the plan allowance.",
    );
  return a;
}
export function launchReady(p: Record<string, unknown>) {
  return (
    p.enabled === true &&
    p.purchasable === true &&
    p.resale_confirmed === true &&
    p.paid_license_confirmed === true &&
    p.features_confirmed === true &&
    p.procurement_cost_kobo !== null &&
    Number(p.procurement_cost_kobo) >= 0 &&
    Number(p.price_kobo) > 0
  );
}
export function dnsRecords(v: unknown) {
  if (!Array.isArray(v) || v.length > 25)
    throw Error("Enter a valid DNS record list.");
  return v.map((r) => {
    if (
      !r ||
      typeof r !== "object" ||
      !["MX", "SPF", "DKIM", "DMARC", "TXT"].includes(r.type) ||
      typeof r.name !== "string" ||
      !r.name.trim() ||
      r.name.length > 253 ||
      typeof r.value !== "string" ||
      !r.value.trim() ||
      r.value.length > 3000 ||
      /[\r\n\x00]/.test(r.name + r.value)
    )
      throw Error("Enter valid DNS record names and values.");
    if (
      r.type === "MX" &&
      (!Number.isInteger(Number(r.priority)) ||
        Number(r.priority) < 0 ||
        Number(r.priority) > 65535)
    )
      throw Error("Enter an MX priority.");
    return {
      type: r.type,
      name: r.name.trim(),
      value: r.value.trim(),
      ...(r.type === "MX" ? { priority: Number(r.priority) } : {}),
    };
  });
}
export function addMonths(date: Date, months: number) {
  const y = date.getUTCFullYear(),
    m = date.getUTCMonth() + months,
    d = date.getUTCDate();
  const out = new Date(date);
  out.setUTCDate(1);
  out.setUTCFullYear(y, m);
  out.setUTCDate(
    Math.min(
      d,
      new Date(
        Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0),
      ).getUTCDate(),
    ),
  );
  return out;
}

export function nigeriaDate(value: string) {
  return new Date(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
      ? value + "+01:00"
      : /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? value + "T00:00:00+01:00"
        : value,
  );
}
