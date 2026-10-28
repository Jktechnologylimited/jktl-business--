import "server-only";

export type RegistryResult = {
  status: "REGISTERED" | "NOT_FOUND" | "UNKNOWN";
  source: "rdap" | "none";
};
const unknown: RegistryResult = { status: "UNKNOWN", source: "none" };
const BOOTSTRAP = "https://data.iana.org/rdap/dns.json";
let bootstrap: { until: number; services: unknown[] } | null = null;
const results = new Map<string, { until: number; result: RegistryResult }>();

/** A registry absence is a discovery signal, never proof of registrar eligibility or price. */
export async function registryLookup(domain: string): Promise<RegistryResult> {
  if (
    process.env.DOMAIN_RDAP_ENABLED !== "true" ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain) ||
    domain.length > 253
  )
    return unknown;
  const tld = domain.split(".").at(-1)!;
  // Operators must review each registry's terms/access policy first. No
  // guessed NiRA endpoint or unreviewed WHOIS scraping fallback is used.
  if (
    !(process.env.DOMAIN_RDAP_ALLOWED_TLDS || "")
      .split(",")
      .map((s) => s.trim())
      .includes(tld)
  )
    return unknown;
  const cached = results.get(domain);
  if (cached && cached.until > Date.now()) return cached.result;
  let result = unknown;
  try {
    if (!bootstrap || bootstrap.until < Date.now()) {
      const response = await fetch(BOOTSTRAP, {
        signal: AbortSignal.timeout(5000),
        redirect: "error",
        cache: "no-store",
      });
      if (!response.ok) return unknown;
      const body = await boundedJson(response);
      if (!Array.isArray(body.services)) return unknown;
      bootstrap = { until: Date.now() + 86400000, services: body.services };
    }
    const service = bootstrap.services.find(
      (row) =>
        Array.isArray(row) && Array.isArray(row[0]) && row[0].includes(tld),
    ) as unknown[] | undefined;
    const bases = service?.[1];
    if (!Array.isArray(bases)) return unknown; // No authoritative RDAP service in the bootstrap.
    const base = bases.find((value) => {
      if (typeof value !== "string") return false;
      try {
        const url = new URL(value);
        return (
          url.protocol === "https:" &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash &&
          !url.port &&
          /^[a-z0-9.-]+\.[a-z]{2,}$/.test(url.hostname) &&
          !/\.(?:localhost|local|internal)$/.test(url.hostname)
        );
      } catch {
        return false;
      }
    });
    if (!base) return unknown;
    // RFC 9082 domain lookup; the authoritative base comes exclusively from IANA.
    const url = new URL(
      "domain/" + encodeURIComponent(domain),
      String(base).replace(/\/?$/, "/"),
    );
    const response = await fetch(url, {
      headers: { Accept: "application/rdap+json, application/json" },
      signal: AbortSignal.timeout(5000),
      redirect: "error",
      cache: "no-store",
    });
    const body = await boundedJson(response);
    if (response.status === 404 && body.errorCode === 404)
      result = { status: "NOT_FOUND", source: "rdap" };
    else if (
      response.ok &&
      body.objectClassName === "domain" &&
      typeof body.ldhName === "string" &&
      body.ldhName.toLowerCase() === domain
    )
      result = { status: "REGISTERED", source: "rdap" };
    // Auth failures, throttling, missing services, redirects and malformed bodies
    // remain UNKNOWN. Do not retain registrant entities or raw registry payloads.
  } catch {
    /* registry access is optional and fail-closed */
  }
  if (results.size >= 1000) results.delete(results.keys().next().value!);
  results.set(domain, {
    result,
    until: Date.now() + (result.status === "UNKNOWN" ? 15000 : 60000),
  });
  return result;
}

async function boundedJson(
  response: Response,
): Promise<Record<string, unknown>> {
  const reader = response.body?.getReader();
  if (!reader) throw Error("Empty registry response");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 262144) {
        await reader.cancel();
        throw Error("Registry response too large");
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
  const parsed = JSON.parse(new TextDecoder().decode(bytes));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw Error("Invalid registry response");
  return parsed;
}
