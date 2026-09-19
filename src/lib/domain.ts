/**
 * Shared custom-domain rules — imported by both the client-side Website
 * settings form (instant feedback while typing) and the server action (the
 * actual authority; the client check is just a courtesy, same pattern as
 * `src/lib/subdomain.ts`).
 */

const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;
const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

/** Returns an error message if the domain is invalid, or null if it's fine
 * to try (ownership is verified separately, and uniqueness is checked
 * server-side only). `rootDomain` is JKTL's own domain (e.g.
 * "jktl.com.ng") — a business can't "custom domain" onto the very
 * namespace their free subdomain already lives under. */
export function customDomainFormatError(value: string, rootDomain: string): string | null {
  const v = value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!v) return "Enter a domain.";
  if (v.length > 253) return "That domain is too long.";
  if (IPV4_RE.test(v)) return "Enter a domain name, not an IP address.";
  if (v === "localhost" || v.endsWith(".localhost")) return "That's not a real domain.";
  if (!DOMAIN_RE.test(v)) return "Enter a valid domain, like www.yourbusiness.com.";
  if (v === rootDomain.toLowerCase() || v.endsWith(`.${rootDomain.toLowerCase()}`)) {
    return `That's a ${rootDomain} address — those are already free, no need to verify one.`;
  }
  return null;
}

/** Normalizes a domain the same way `customDomainFormatError` validates it
 * (lowercase, strips a protocol/path if someone pastes a full URL) — used
 * so what's stored always matches what was validated. */
export function normalizeDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
}

/** The DNS TXT record name a business adds to prove ownership of a domain
 * before JKTL Business will route traffic for it. */
export function verificationRecordName(domain: string): string {
  return `_jktl-verify.${domain}`;
}

export function verificationRecordValue(token: string): string {
  return `jktl-domain-verify=${token}`;
}
