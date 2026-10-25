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
