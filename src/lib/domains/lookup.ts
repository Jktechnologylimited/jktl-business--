import "server-only";
export type DomainLookup = {
  status: "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN";
  costKobo: number | null;
  source: "provider" | "none";
};
/** Adapter for the already configured read-only lookup contract. This is not a guessed Go54 API. */
export async function lookupDomain(
  domain: string,
  price: Record<string, unknown>,
): Promise<DomainLookup> {
  const unknown: DomainLookup = {
    status: "UNKNOWN",
    costKobo: null,
    source: "none",
  };
  if (
    !process.env.DOMAIN_AVAILABILITY_URL ||
    !process.env.DOMAIN_AVAILABILITY_API_KEY
  )
    return unknown;
  try {
    const url = new URL(process.env.DOMAIN_AVAILABILITY_URL);
    if (url.protocol !== "https:" || url.username || url.password)
      return unknown;
    url.searchParams.set("domain", domain);
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.DOMAIN_AVAILABILITY_API_KEY}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    });
    if (!response.ok) return unknown;
    const data = await response.json();
    if (data.domain !== domain || typeof data.available !== "boolean")
      return unknown;
    if (data.available === false || data.reserved === true)
      return { status: "UNAVAILABLE", costKobo: null, source: "provider" };
    const actual = data.registrationPriceKobo,
      budget = Number(price.registration_cost);
    // DNS absence, a bare `available` boolean, or a catalogue price do not prove purchase eligibility.
    if (
      data.premium !== false ||
      data.reserved !== false ||
      data.eligible !== true ||
      data.currency !== "NGN" ||
      !Number.isSafeInteger(actual) ||
      actual < 1 ||
      !Number.isSafeInteger(budget) ||
      budget < 1 ||
      actual > budget ||
      actual > Number(price.registration_price)
    )
      return unknown;
    return { status: "AVAILABLE", costKobo: actual, source: "provider" };
  } catch {
    return unknown;
  }
}
