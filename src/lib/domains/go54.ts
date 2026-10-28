import "server-only";
import { createHmac } from "node:crypto";

export const GO54_BASE_URL =
  "https://www.whogohost.com/host/modules/addons/DomainsReseller/api/index.php";
export const GO54_PRICING_PATH = "/tlds/pricing";
export const GO54_REQUEST_CONTRACTS_IMPLEMENTED = true;
// Request serialization alone is not a verified end-to-end write adapter.
export const GO54_WRITES_IMPLEMENTED = false;
export type Go54Credentials = { email: string; apiKey: string };
export type FormValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | FormValue[]
  | { [key: string]: FormValue };

/** Exact PHP: base64_encode(hash_hmac('sha256', API_KEY, EMAIL . ':' . gmdate('y-m-d H'))). */
export function go54Headers(credentials: Go54Credentials, at = new Date()) {
  if (
    !credentials.email ||
    credentials.email !== credentials.email.trim() ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(credentials.email) ||
    !credentials.apiKey ||
    /[\r\n]/.test(credentials.apiKey) ||
    !Number.isFinite(+at)
  )
    throw Error("Go54 credentials are not configured correctly.");
  const pad = (n: number) => String(n).padStart(2, "0");
  const hour = `${pad(at.getUTCFullYear() % 100)}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())} ${pad(at.getUTCHours())}`;
  // PHP's default hash_hmac output is hexadecimal TEXT. Base64 of the raw
  // digest, reversed key/message arguments, or a four-digit year is incorrect.
  const hex = createHmac("sha256", credentials.email + ":" + hour)
    .update(credentials.apiKey, "utf8")
    .digest("hex");
  return {
    username: credentials.email,
    token: Buffer.from(hex, "ascii").toString("base64"),
    Accept: "application/json",
  };
}

/** RFC1738/PHP http_build_query-compatible nested form encoding; never JSON. */
export function go54Form(input: Record<string, FormValue>): string {
  const params = new URLSearchParams();
  let entries = 0;
  function append(key: string, value: FormValue, depth: number) {
    if (depth > 8 || ++entries > 500)
      throw Error("Go54 form exceeds its supported bounds.");
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((v, i) => append(`${key}[${i}]`, v, depth + 1));
      return;
    }
    if (typeof value === "object") {
      for (const [child, v] of Object.entries(value)) {
        if (!/^[a-zA-Z0-9_-]{1,80}$/.test(child))
          throw Error("Invalid Go54 form key.");
        append(`${key}[${child}]`, v, depth + 1);
      }
      return;
    }
    if (typeof value === "number" && !Number.isSafeInteger(value))
      throw Error("Use exact strings for Go54 decimal values.");
    if (typeof value === "string" && value.length > 4000)
      throw Error("Go54 field is too long.");
    params.append(
      key,
      typeof value === "boolean" ? (value ? "1" : "0") : String(value),
    );
  }
  for (const [key, value] of Object.entries(input)) {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(key))
      throw Error("Invalid Go54 form key.");
    append(key, value, 0);
  }
  return params.toString();
}

export function configuredGo54Credentials(): Go54Credentials {
  const email = process.env.GO54_RESELLER_EMAIL || "";
  const apiKey = process.env.GO54_API_KEY || "";
  if (!email || !apiKey) throw Error("Go54 credentials are not configured.");
  return { email, apiKey };
}

let pricing: { until: number; value: unknown } | null = null;
let inFlight: Promise<unknown> | null = null;
/** Server-only raw pricing retrieval. Response-field mapping is deliberately
 * withheld until the actual official response example is available. This
 * function cannot update public selling prices or mark a quote validated. */
export async function fetchGo54WholesalePricing(
  force = false,
): Promise<unknown> {
  if (!force && pricing && pricing.until > Date.now())
    return structuredClone(pricing.value);
  if (inFlight) return structuredClone(await inFlight);
  inFlight = (async () => {
    const response = await fetch(GO54_BASE_URL + GO54_PRICING_PATH, {
      method: "GET",
      headers: go54Headers(configuredGo54Credentials()),
      signal: AbortSignal.timeout(10000),
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok)
      throw Error(
        "Go54 pricing request failed. Check the private integration configuration.",
      );
    const reader = response.body?.getReader();
    if (!reader) throw Error("Go54 pricing response is empty.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 1048576) {
          await reader.cancel();
          throw Error("Go54 pricing response is too large.");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    let value: unknown;
    try {
      value = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw Error("Go54 did not return valid pricing JSON.");
    }
    // A JSON response is transport success, NOT verified wholesale pricing.
    // Never infer undocumented success/error flags or currency/price units.
    if (!value || typeof value !== "object")
      throw Error("Go54 pricing response needs verification.");
    pricing = { until: Date.now() + 300000, value };
    return value;
  })();
  try {
    return structuredClone(await inFlight);
  } finally {
    inFlight = null;
  }
}
