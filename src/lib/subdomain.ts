/**
 * Shared subdomain rules — imported by both the client-side settings form
 * (instant feedback while typing) and the server action (the actual
 * authority; the client check is just a courtesy, never trusted on its own).
 */

export const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "business",
  "accounts",
  "mail",
  "ftp",
  "cdn",
  "static",
  "assets",
  "blog",
  "help",
  "support",
  "docs",
  "status",
  "dashboard",
]);

const FORMAT_RE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/;

/** Returns an error message if the subdomain is invalid, or null if it's fine
 * to try (uniqueness is checked separately, server-side only). */
export function subdomainFormatError(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (v.length < 3 || v.length > 30) return "Must be 3–30 characters.";
  if (!FORMAT_RE.test(v)) return "Lowercase letters, numbers and hyphens only — no leading, trailing or double hyphen at the ends.";
  if (RESERVED_SUBDOMAINS.has(v)) return "That name is reserved — please choose another.";
  return null;
}
