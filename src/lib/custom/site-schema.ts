export type SiteField = {
  group: string;
  label: string;
  kind: "text" | "image" | "link";
  default: string;
  max: number;
  source?: string;
};
export type SiteManifest = Record<string, SiteField>;
export function siteManifest(value: unknown): SiteManifest {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    new TextEncoder().encode(JSON.stringify(value)).length > 450000
  )
    throw Error("Invalid website field manifest");
  const entries = Object.entries(value);
  if (!entries.length || entries.length > 1000)
    throw Error("Invalid website field manifest");
  const result: SiteManifest = {};
  for (const [key, f] of entries) {
    if (
      !/^[a-zA-Z][a-zA-Z0-9_.-]{0,119}$/.test(key) ||
      !f ||
      typeof f !== "object" ||
      Array.isArray(f)
    )
      throw Error("Invalid website field manifest");
    const v = f as Record<string, unknown>;
    if (
      typeof v.group !== "string" ||
      !v.group ||
      v.group.length > 160 ||
      typeof v.label !== "string" ||
      !v.label ||
      v.label.length > 200 ||
      !["text", "image", "link"].includes(String(v.kind)) ||
      typeof v.default !== "string" ||
      !Number.isSafeInteger(v.max) ||
      Number(v.max) < 1 ||
      Number(v.max) > 10000
    )
      throw Error("Invalid website field manifest");
    result[key] = {
      group: v.group,
      label: v.label,
      kind: v.kind as SiteField["kind"],
      default: v.default,
      max: Number(v.max),
    };
  }
  managedFields(
    Object.fromEntries(Object.entries(result).map(([k, f]) => [k, f.default])),
    result,
  );
  return result;
}
export function managedFields(value: unknown, manifest: SiteManifest) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Invalid website content");
  const input = value as Record<string, unknown>,
    entries = Object.entries(manifest),
    result: Record<string, string> = {};
  if (
    Object.keys(input).length !== entries.length ||
    Object.keys(input).some((k) => !Object.hasOwn(manifest, k))
  )
    throw Error("Only registered website fields can be edited");
  for (const [key, f] of entries) {
    const v = input[key];
    if (
      typeof v !== "string" ||
      !v.trim() ||
      v.length > f.max ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)
    )
      throw Error("Check the website field lengths");
    if (f.kind === "image" && !validImage(v))
      throw Error("Use an approved image URL");
    if (f.kind === "link" && !validLink(v))
      throw Error("Use a safe website link");
    result[key] = v;
  }
  if (new TextEncoder().encode(JSON.stringify(result)).length > 200000)
    throw Error("Website content is too large");
  return result;
}
export function validImage(v: string) {
  if (/[\s\\<>"'()]/.test(v) || v.includes("..")) return false;
  if (v.startsWith("/api/") && !v.startsWith("/api/jktl/media/")) return false;
  if (/^\/(?!\/)/.test(v))
    return (
      /^\/(?:[a-z0-9_&.%!+\/-])+\.(?:png|jpe?g|webp|gif|avif)$/i.test(v) ||
      /^\/api\/jktl\/media\/[a-f0-9-]{36}\.(?:png|jpg|webp)$/.test(v)
    );
  try {
    const u = new URL(v);
    return (
      u.protocol === "https:" &&
      u.hostname === "images.unsplash.com" &&
      !u.username &&
      !u.password &&
      !u.port
    );
  } catch {
    return false;
  }
}
export function validLink(v: string) {
  if (/[\u0000-\u0020\\<>"']/.test(v) || v.startsWith("//")) return false;
  if (v.startsWith("/") && !v.startsWith("/api/") && !v.includes(".."))
    return true;
  if (
    /^#[a-z0-9_-]+$/i.test(v) ||
    /^mailto:[^?\s@]+@[^?\s@]+\.[^?\s@]+$/.test(v) ||
    /^tel:\+?[\d()-]+$/.test(v)
  )
    return true;
  try {
    const u = new URL(v);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      u.hostname.includes(".") &&
      !/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname) &&
      !u.hostname.endsWith(".local") &&
      !u.hostname.endsWith(".localhost")
    );
  } catch {
    return false;
  }
}
