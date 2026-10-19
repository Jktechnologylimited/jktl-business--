/**
 * Markets and currencies.
 *
 * JKTL Business stores money as **kobo** — 1/100th of a naira. That is correct
 * for Nigeria and Ghana (the cedi has pesewas) and **wrong for the CFA franc**,
 * which has no subunit in use. Storing XOF the way naira is stored would send a
 * payment provider 100× the intended amount, and the mistake would look like a
 * normal number in the database.
 *
 * So this module exists to make the distinction explicit and impossible to
 * forget: every currency declares how many minor units it actually has, and
 * every conversion goes through `toMinorUnits`, which will not round a
 * zero-decimal currency into fractions of a unit.
 *
 * Dependency-free (no runtime imports) so it is unit tested directly — this is
 * the last code in the product that should be trusted without a test.
 */

export type CurrencyCode = "NGN" | "GHS" | "XOF";
export type LanguageCode = "en" | "fr";

export interface CurrencyDef {
  code: CurrencyCode;
  name: string;
  symbol: string;
  /**
   * How many minor units make one major unit.
   *   100 — naira/kobo, cedi/pesewa.
   *     1 — CFA franc. There is no centime in circulation; the franc *is* the
   *         smallest unit. Treating it as 100 would multiply every amount by a
   *         hundred the moment it reached a payment provider.
   */
  minorUnits: number;
  /** Decimal places to show a human. XOF shows none, ever. */
  decimals: number;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyDef> = {
  NGN: { code: "NGN", name: "Nigerian naira", symbol: "₦", minorUnits: 100, decimals: 2 },
  GHS: { code: "GHS", name: "Ghanaian cedi", symbol: "GH₵", minorUnits: 100, decimals: 2 },
  XOF: { code: "XOF", name: "West African CFA franc", symbol: "CFA", minorUnits: 1, decimals: 0 },
};

export interface Market {
  countryCode: string;
  country: string;
  currency: CurrencyCode;
  dialCode: string;
  primaryLanguage: LanguageCode;
  /** Whether the incumbent processor covers this country. Paystack stops at
   * Ghana, so Côte d'Ivoire and Senegal need another rail before they can take
   * a single payment. */
  paystack: boolean;
  /** What people actually pay with. Cards are a minority in Francophone West
   * Africa; mobile money is the default, and a card-first checkout would lose
   * most customers. */
  rails: string[];
  /** The data-protection position, so a market cannot be opened by accident. */
  legalNote: string;
  /** True once someone has confirmed the pricing for this market. Until then it
   * has no price points and cannot be quoted. */
  priced: boolean;
}

/**
 * Nigeria is the home market and the only one priced today. Ghana, Côte
 * d'Ivoire and Senegal are the next three, in that order, and are deliberately
 * **unpriced**: converting ₦650,000 at today's rate and calling it a price is a
 * decision, not a calculation, and it is the client's to make.
 */
export const MARKETS: Market[] = [
  {
    countryCode: "NG",
    country: "Nigeria",
    currency: "NGN",
    dialCode: "234",
    primaryLanguage: "en",
    paystack: true,
    rails: ["Card", "Bank transfer", "USSD"],
    legalNote: "NDPA 2023. B2B outreach on the legitimate-interest basis with an opt-out.",
    priced: true,
  },
  {
    countryCode: "GH",
    country: "Ghana",
    currency: "GHS",
    dialCode: "233",
    primaryLanguage: "en",
    paystack: true,
    rails: ["Mobile money (MTN MoMo, Vodafone Cash, AirtelTigo)", "Card"],
    legalNote: "Data Protection Act 2012 (Act 843): controller registration and consent for marketing.",
    priced: false,
  },
  {
    countryCode: "CI",
    country: "Côte d'Ivoire",
    currency: "XOF",
    dialCode: "225",
    primaryLanguage: "fr",
    // Paystack does not operate here; a second processor is a prerequisite,
    // not a nice-to-have.
    paystack: false,
    rails: ["Wave", "Orange Money", "MTN MoMo", "Moov Money"],
    legalNote: "Law 2013-450 on personal data protection. Requires local advice before outreach.",
    priced: false,
  },
  {
    countryCode: "SN",
    country: "Senegal",
    currency: "XOF",
    dialCode: "221",
    primaryLanguage: "fr",
    paystack: false,
    rails: ["Wave", "Orange Money", "Free Money"],
    legalNote: "Law 2008-12 on personal data protection. Requires local advice before outreach.",
    priced: false,
  },
];

const BY_COUNTRY = new Map(MARKETS.map((m) => [m.countryCode, m]));

export function getMarket(countryCode: string | null | undefined): Market | null {
  if (!countryCode) return null;
  return BY_COUNTRY.get(countryCode.toUpperCase()) ?? null;
}

export function getCurrency(code: CurrencyCode): CurrencyDef {
  return CURRENCIES[code];
}

/** Markets with a non-English primary language — what the translation layer has
 * to cover before those countries can be served. */
export function marketsNeedingTranslation(): Market[] {
  return MARKETS.filter((m) => m.primaryLanguage !== "en");
}

/** Markets that cannot take a card payment yet, and why. */
export function marketsWithoutPayments(): Market[] {
  return MARKETS.filter((m) => !m.paystack);
}

/**
 * Converts a naira amount (in kobo) into a target currency's minor units.
 *
 * `minorUnitsPerNaira` is how many units of the target currency one naira buys
 * — supplied by the caller, never guessed here, because an invented FX rate is
 * how a customer gets charged the wrong amount.
 *
 * The rounding rule is the important part:
 *   - a currency **with** subunits rounds to the nearest one (100 kobo = GH₵1);
 *   - a currency **without** them rounds to a whole unit, because
 *     `12_345.67` CFA francs is not a number that can be charged.
 */
export function convertFromNairaKobo(nairaKobo: number, target: CurrencyCode, minorUnitsPerNaira: number): number {
  if (!Number.isFinite(nairaKobo) || !Number.isFinite(minorUnitsPerNaira) || minorUnitsPerNaira <= 0) return 0;
  const naira = nairaKobo / 100;
  const raw = naira * minorUnitsPerNaira * CURRENCIES[target].minorUnits;
  return CURRENCIES[target].minorUnits === 1 ? Math.round(raw) : Math.round(raw);
}

/**
 * Verifies a candidate price point is chargeable in its currency.
 *
 * For a zero-decimal currency, "₦650,000 converts to 412,345.5 francs" is not a
 * price — it is a rounding error waiting to appear on an invoice. This is the
 * check the pricing decision has to pass.
 */
export function isChargeableAmount(amountMinor: number, currency: CurrencyCode): boolean {
  if (!Number.isFinite(amountMinor) || amountMinor < 0) return false;
  if (CURRENCIES[currency].minorUnits === 1) return Number.isInteger(amountMinor);
  return Number.isInteger(amountMinor);
}

/** A price someone has actually set for a market, in that currency's minor
 * units. Nothing here is derived at runtime. */
export interface MarketPricePoints {
  countryCode: string;
  currency: CurrencyCode;
  setupFeeMinor: number;
  setupMonths: number;
  setupInstalmentMinor: number;
  monthlyFeeMinor: number;
}

const PRICE_POINTS = new Map<string, MarketPricePoints>();

/**
 * Registers the agreed price points for a market.
 *
 * Called with values a human decided. Refuses to accept a fractional amount in
 * a zero-decimal currency rather than silently rounding somebody's price.
 */
export function setPricePoints(points: MarketPricePoints): { ok: true } | { ok: false; error: string } {
  const market = getMarket(points.countryCode);
  if (!market) return { ok: false, error: `Unknown market ${points.countryCode}.` };
  if (market.currency !== points.currency) {
    return { ok: false, error: `${points.countryCode} uses ${market.currency}, not ${points.currency}.` };
  }
  if (points.setupMonths <= 0) return { ok: false, error: "Setup must be split over at least one month." };

  for (const amount of [points.setupFeeMinor, points.setupInstalmentMinor, points.monthlyFeeMinor]) {
    if (!isChargeableAmount(amount, points.currency)) {
      return {
        ok: false,
        error: `${points.currency} has no fractional unit — ${amount} cannot be charged.`,
      };
    }
  }

  // The instalments must cover the package exactly, for the same reason the
  // naira schedule does: it is the contract.
  if (points.setupInstalmentMinor * points.setupMonths !== points.setupFeeMinor) {
    return {
      ok: false,
      error: `Instalments (${points.setupInstalmentMinor} × ${points.setupMonths}) do not equal the package (${points.setupFeeMinor}).`,
    };
  }

  PRICE_POINTS.set(points.countryCode.toUpperCase(), points);
  return { ok: true };
}

export function getPricePoints(countryCode: string | null | undefined): MarketPricePoints | null {
  if (!countryCode) return null;
  return PRICE_POINTS.get(countryCode.toUpperCase()) ?? null;
}

/** Display form, respecting each currency's own decimals — XOF never shows a
 * decimal point, because a CFA franc has no centime. */
export function formatMoney(amountMinor: number, currency: CurrencyCode): string {
  const def = CURRENCIES[currency];
  const major = amountMinor / def.minorUnits;
  const formatted = major.toLocaleString("en-NG", {
    minimumFractionDigits: def.decimals,
    maximumFractionDigits: def.decimals,
  });
  return `${def.symbol}${formatted}`;
}

/** What a market still needs before it can go live, in the order it blocks. */
export function marketReadiness(countryCode: string): Array<{ requirement: string; met: boolean; blocker: boolean }> {
  const market = getMarket(countryCode);
  if (!market) return [{ requirement: "Known market", met: false, blocker: true }];
  return [
    { requirement: "Payment rail available", met: market.paystack, blocker: true },
    { requirement: "Price points agreed", met: market.priced, blocker: true },
    { requirement: "Customer-facing copy translated", met: market.primaryLanguage === "en", blocker: false },
  ];
}
