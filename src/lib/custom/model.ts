import { createHash, randomBytes } from "node:crypto";
export function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function token() {
  return randomBytes(32).toString("hex");
}
export function id(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)
  )
    throw Error("Invalid record.");
  return value;
}
export function text(value: unknown, max = 200) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw Error("Enter a valid value.");
  return value.trim();
}
export function secureUrl(value: unknown, optional = false) {
  if (optional && !value) return "";
  const u = new URL(text(value, 1000));
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.hash ||
    u.hostname === "localhost" ||
    !u.hostname.includes(".") ||
    /^(\d+\.){3}\d+$/.test(u.hostname) ||
    u.hostname.includes(":")
  )
    throw Error("Use a public HTTPS website URL.");
  return u.toString();
}
export function amount(value: unknown) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1 || n > 2000000000)
    throw Error("Enter a whole kobo amount within the allowed limit.");
  return n;
}
export function date(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw Error("Enter a valid date.");
  return value;
}

export const CMS_SCOPES = [
  "content:read",
  "content:write",
  "content:publish",
] as const;
export function cmsScopes(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.some(
      (v) =>
        typeof v !== "string" || !(CMS_SCOPES as readonly string[]).includes(v),
    ) ||
    !value.includes("content:read") ||
    (value.includes("content:publish") && !value.includes("content:write"))
  )
    throw Error(
      "Select valid CMS permissions; publishing also requires editing.",
    );
  return [...new Set(value)] as string[];
}
export function cmsFields(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.length > 30 ||
    value.some(
      (v) => typeof v !== "string" || !/^[a-zA-Z][a-zA-Z0-9_.-]{0,79}$/.test(v),
    )
  )
    throw Error("Enter valid CMS field identifiers.");
  return [...new Set(value)] as string[];
}
export function configurationText(value: unknown, max = 2000): string {
  const result = value === undefined || value === "" ? "" : text(value, max);
  if (
    /(?:postgres(?:ql)?:\/\/|sk_live_|gh[pousr]_|Bearer\s+[a-z0-9_.-]{12,}|(?:api[_ -]?key|password|token|secret)\s*[:=]\s*\S+)/i.test(
      result,
    )
  )
    throw Error("Keep deployment credentials in secure environment settings.");
  return result;
}
export function repositoryReference(value: unknown): string {
  const raw = configurationText(value, 250);
  if (!raw) return "";
  const ref = raw
    .replace(/^https:\/\/github\.com\//i, "")
    .replace(/\.git$/, "")
    .replace(/\/$/, "");
  if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(ref))
    throw Error("Enter a GitHub owner/repository reference.");
  return ref;
}
export const PROJECT_CATEGORIES = [
  "WEBSITE_CONTENT",
  "WEBSITE_TECHNICAL",
  "DOMAIN",
  "EMAIL",
  "BILLING",
  "MAINTENANCE",
  "FEATURE_REQUEST",
] as const;
