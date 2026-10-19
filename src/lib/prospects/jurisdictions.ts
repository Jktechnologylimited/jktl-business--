/**
 * African jurisdiction rules for outreach.
 *
 * **This is engineering, not legal advice.** The defaults below are chosen to
 * fail safe: where a country has an explicit opt-in marketing statute, the rule
 * is `consent_required`; where we have no confident position, it is
 * `review_required`, which blocks sending until a human decides; and anywhere
 * outside Africa is `blocked`, because "Africa only for the next five years" is
 * a decision that should be enforced by the software rather than remembered.
 *
 * Every rule is stored in `outreach_country_rules` and can be overridden in the
 * admin without a deploy — which is the point. When counsel signs off on a
 * market, one row changes and the pipeline opens for it; until then the tool
 * refuses to be the reason a company gets fined.
 *
 * Self-contained (no runtime imports) so the decision logic is unit tested
 * rather than trusted.
 */

export type OutreachRule = "permitted" | "consent_required" | "review_required" | "blocked";

export interface CountryRule {
  /** ISO 3166-1 alpha-2, upper case. */
  code: string;
  name: string;
  /** International dialling code, digits only. */
  dialCode: string;
  currency: string;
  rule: OutreachRule;
  note: string;
  /** True once a human has confirmed it against local counsel. */
  reviewed?: boolean;
}

/**
 * The 54 African countries, their dialling codes and currencies.
 *
 * The rule is `review_required` for almost everything and `consent_required`
 * for the jurisdictions with explicit opt-in marketing statutes. Nigeria is
 * `permitted` because that is the basis this business already operates on —
 * flagged in the note so it is a recorded decision rather than an oversight.
 */
export const AFRICAN_COUNTRIES: CountryRule[] = [
  // --- The markets with explicit opt-in marketing statutes -----------------
  { code: "NG", name: "Nigeria", dialCode: "234", currency: "NGN", rule: "permitted", note: "NDPA 2023. Operates on the legitimate-interest basis for B2B outreach with a working opt-out. Confirm with counsel before scaling volume." },
  { code: "ZA", name: "South Africa", dialCode: "27", currency: "ZAR", rule: "consent_required", note: "POPIA s69: electronic direct marketing requires prior opt-in consent unless the recipient is an existing customer." },
  { code: "EG", name: "Egypt", dialCode: "20", currency: "EGP", rule: "consent_required", note: "PDPL 151/2020: prior consent for direct marketing, plus licensing and registration duties on the sender." },
  { code: "MA", name: "Morocco", dialCode: "212", currency: "MAD", rule: "consent_required", note: "Law 09-08: prior consent for direct prospecting, and prior declaration of the processing to the CNDP." },
  { code: "KE", name: "Kenya", dialCode: "254", currency: "KES", rule: "consent_required", note: "Data Protection Act 2019: consent or a documented legitimate interest, with ODPC registration for data controllers." },
  { code: "GH", name: "Ghana", dialCode: "233", currency: "GHS", rule: "consent_required", note: "Data Protection Act 2012 (Act 843): data-controller registration and consent for marketing." },

  // --- Reviewed as likely consent-based, still not signed off --------------
  { code: "TZ", name: "Tanzania", dialCode: "255", currency: "TZS", rule: "review_required", note: "Personal Data Protection Act 2022." },
  { code: "UG", name: "Uganda", dialCode: "256", currency: "UGX", rule: "review_required", note: "Data Protection and Privacy Act 2019." },
  { code: "RW", name: "Rwanda", dialCode: "250", currency: "RWF", rule: "review_required", note: "Law on personal data protection 2021." },
  { code: "ZW", name: "Zimbabwe", dialCode: "263", currency: "ZWG", rule: "review_required", note: "Cyber and Data Protection Act 2021." },
  { code: "ZM", name: "Zambia", dialCode: "260", currency: "ZMW", rule: "review_required", note: "Data Protection Act 2021." },
  { code: "BW", name: "Botswana", dialCode: "267", currency: "BWP", rule: "review_required", note: "Data Protection Act 2018." },
  { code: "NA", name: "Namibia", dialCode: "264", currency: "NAD", rule: "review_required", note: "Data Protection Act 2021." },
  { code: "MU", name: "Mauritius", dialCode: "230", currency: "MUR", rule: "review_required", note: "Data Protection Act 2017." },
  { code: "MW", name: "Malawi", dialCode: "265", currency: "MWK", rule: "review_required", note: "Data Protection Act 2024." },
  { code: "LS", name: "Lesotho", dialCode: "266", currency: "LSL", rule: "review_required", note: "Data Protection Act 2011." },
  { code: "SZ", name: "Eswatini", dialCode: "268", currency: "SZL", rule: "review_required", note: "Data Protection Act 2022." },
  { code: "SC", name: "Seychelles", dialCode: "248", currency: "SCR", rule: "review_required", note: "Data Protection Act 2023." },

  // --- Francophone and Lusophone Africa ------------------------------------
  { code: "CI", name: "Cote d'Ivoire", dialCode: "225", currency: "XOF", rule: "review_required", note: "Law 2013-450 on personal data protection." },
  { code: "SN", name: "Senegal", dialCode: "221", currency: "XOF", rule: "review_required", note: "Law 2008-12 on personal data protection." },
  { code: "CM", name: "Cameroon", dialCode: "237", currency: "XAF", rule: "review_required", note: "Law 2010/012 on cyber security and data protection." },
  { code: "TG", name: "Togo", dialCode: "228", currency: "XOF", rule: "review_required", note: "Law 2019-014 on personal data protection." },
  { code: "BJ", name: "Benin", dialCode: "229", currency: "XOF", rule: "review_required", note: "Digital Code 2017 (Code du numerique): consent-based marketing rules." },
  { code: "BF", name: "Burkina Faso", dialCode: "226", currency: "XOF", rule: "review_required", note: "Law 001-2013 on personal data protection." },
  { code: "ML", name: "Mali", dialCode: "223", currency: "XOF", rule: "review_required", note: "Law 2013-015 on personal data protection." },
  { code: "NE", name: "Niger", dialCode: "227", currency: "XOF", rule: "review_required", note: "Law 2017-28 on personal data protection." },
  { code: "GN", name: "Guinea", dialCode: "224", currency: "GNF", rule: "review_required", note: "Law L/2016/037 on data protection." },
  { code: "GW", name: "Guinea-Bissau", dialCode: "245", currency: "XOF", rule: "review_required", note: "No comprehensive regime confirmed." },
  { code: "CV", name: "Cabo Verde", dialCode: "238", currency: "CVE", rule: "review_required", note: "Law 133/V/2001 on data protection." },
  { code: "MR", name: "Mauritania", dialCode: "222", currency: "MRU", rule: "review_required", note: "Law 2017-020 on data protection." },
  { code: "GA", name: "Gabon", dialCode: "241", currency: "XAF", rule: "review_required", note: "Law 001-2018 on data protection." },
  { code: "CG", name: "Congo", dialCode: "242", currency: "XAF", rule: "review_required", note: "Law 29-2019 on data protection." },
  { code: "CD", name: "DR Congo", dialCode: "243", currency: "CDF", rule: "review_required", note: "Law 20/017 on data protection." },
  { code: "CF", name: "Central African Republic", dialCode: "236", currency: "XAF", rule: "review_required", note: "No comprehensive regime confirmed." },
  { code: "TD", name: "Chad", dialCode: "235", currency: "XAF", rule: "review_required", note: "Law 007/PR/2015 on data protection." },
  { code: "GQ", name: "Equatorial Guinea", dialCode: "240", currency: "XAF", rule: "review_required", note: "No comprehensive regime confirmed." },
  { code: "ST", name: "Sao Tome and Principe", dialCode: "239", currency: "STN", rule: "review_required", note: "No comprehensive regime confirmed." },
  { code: "AO", name: "Angola", dialCode: "244", currency: "AOA", rule: "review_required", note: "Law 22/11 on data protection." },
  { code: "MZ", name: "Mozambique", dialCode: "258", currency: "MZN", rule: "review_required", note: "Law 3/2017 on data protection." },
  { code: "MG", name: "Madagascar", dialCode: "261", currency: "MGA", rule: "review_required", note: "Law 2014-038 on data protection." },
  { code: "KM", name: "Comoros", dialCode: "269", currency: "KMF", rule: "review_required", note: "No comprehensive regime confirmed." },

  // --- North and East Africa ----------------------------------------------
  { code: "DZ", name: "Algeria", dialCode: "213", currency: "DZD", rule: "review_required", note: "Law 18-07 on data protection." },
  { code: "TN", name: "Tunisia", dialCode: "216", currency: "TND", rule: "review_required", note: "Organic Law 2004-63 on data protection." },
  { code: "LY", name: "Libya", dialCode: "218", currency: "LYD", rule: "review_required", note: "No comprehensive regime confirmed." },
  { code: "SD", name: "Sudan", dialCode: "249", currency: "SDG", rule: "review_required", note: "No comprehensive regime confirmed." },
  { code: "SS", name: "South Sudan", dialCode: "211", currency: "SSP", rule: "review_required", note: "No comprehensive regime confirmed." },
  { code: "ET", name: "Ethiopia", dialCode: "251", currency: "ETB", rule: "review_required", note: "Personal Data Protection Proclamation." },
  { code: "ER", name: "Eritrea", dialCode: "291", currency: "ERN", rule: "review_required", note: "No comprehensive regime confirmed." },
  { code: "DJ", name: "Djibouti", dialCode: "253", currency: "DJF", rule: "review_required", note: "No comprehensive regime confirmed." },
  { code: "SO", name: "Somalia", dialCode: "252", currency: "SOS", rule: "review_required", note: "No comprehensive regime confirmed." },
  { code: "BI", name: "Burundi", dialCode: "257", currency: "BIF", rule: "review_required", note: "Law 2019 on personal data protection." },
  { code: "GM", name: "Gambia", dialCode: "220", currency: "GMD", rule: "review_required", note: "Data protection provisions under development." },
  { code: "SL", name: "Sierra Leone", dialCode: "232", currency: "SLE", rule: "review_required", note: "No comprehensive regime confirmed." },
  { code: "LR", name: "Liberia", dialCode: "231", currency: "LRD", rule: "review_required", note: "No comprehensive regime confirmed." },
];

/** Common spellings that are not ISO codes, mapped to one. Google Maps and
 * the two scrapers between them produce all of these. */
const COUNTRY_ALIASES: Record<string, string> = {
  nigeria: "NG", naija: "NG",
  "south africa": "ZA", rsa: "ZA", "afrique du sud": "ZA",
  egypt: "EG", misr: "EG",
  morocco: "MA", maroc: "MA",
  kenya: "KE",
  ghana: "GH",
  "cote d'ivoire": "CI", "côte d'ivoire": "CI", "ivory coast": "CI",
  "dr congo": "CD", "democratic republic of the congo": "CD", "congo kinshasa": "CD",
  "republic of the congo": "CG", "congo brazzaville": "CG",
  tanzania: "TZ", "united republic of tanzania": "TZ",
  uganda: "UG", rwanda: "RW", zimbabwe: "ZW", zambia: "ZM", botswana: "BW", namibia: "NA",
  mauritius: "MU", malawi: "MW", lesotho: "LS", eswatini: "SZ", swaziland: "SZ",
  seychelles: "SC", senegal: "SN", cameroon: "CM", togo: "TG", benin: "BJ",
  "burkina faso": "BF", mali: "ML", niger: "NE", guinea: "GN", "guinea-bissau": "GW",
  "cabo verde": "CV", "cape verde": "CV", mauritania: "MR", gabon: "GA", chad: "TD",
  "equatorial guinea": "GQ", "sao tome and principe": "ST", angola: "AO", mozambique: "MZ",
  madagascar: "MG", comoros: "KM", algeria: "DZ", tunisia: "TN", libya: "LY",
  sudan: "SD", "south sudan": "SS", ethiopia: "ET", eritrea: "ER", djibouti: "DJ",
  somalia: "SO", burundi: "BI", gambia: "GM", "sierra leone": "SL", liberia: "LR",
  // A few non-African ones, mapped so they can be recognised and blocked rather
  // than silently treated as unknown.
  "united states": "US", usa: "US", "united kingdom": "GB", uk: "GB", england: "GB",
  canada: "CA", india: "IN", china: "CN", "united arab emirates": "AE", uae: "AE",
  france: "FR", germany: "DE", portugal: "PT", brazil: "BR", australia: "AU",
};

const BY_CODE = new Map(AFRICAN_COUNTRIES.map((c) => [c.code, c]));

/**
 * Resolves whatever a provider put in its country field to an ISO alpha-2 code.
 * Accepts alpha-2, alpha-3-lite and full names. Returns null when it cannot
 * tell — which the caller must treat as "review", never as "send".
 */
export function normalizeCountryCode(input: string): string | null {
  const raw = (input || "").trim();
  if (!raw) return null;
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  // Fold accents first. Stripping non-ASCII before folding turns
  // "Côte d'Ivoire" into "cte d'ivoire", which matches nothing.
  const lower = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z' -]/g, "")
    .trim();
  if (COUNTRY_ALIASES[lower]) return COUNTRY_ALIASES[lower];
  // Try a partial match on the official name ("Kenya " / "Nairobi, Kenya").
  const found = AFRICAN_COUNTRIES.find((c) => lower === c.name.toLowerCase());
  if (found) return found.code;
  // A provider might put a city in the country column; match on a name inside it.
  const contains = AFRICAN_COUNTRIES.find((c) => lower.includes(c.name.toLowerCase()));
  return contains ? contains.code : null;
}

export function isAfricanCountry(code: string | null): boolean {
  return Boolean(code && BY_CODE.has(code.toUpperCase()));
}

export function countryRule(code: string | null): CountryRule {
  const normalized = code ? code.toUpperCase() : "";
  const known = BY_CODE.get(normalized);
  if (known) return known;
  // Anything we cannot place is not emailed. This covers both non-African
  // countries and unresolvable values, and it is deliberately the same answer
  // for both: a target region of "Africa" means the list must not grow by
  // accident.
  return {
    code: normalized || "??",
    name: normalized || "Unknown",
    dialCode: "",
    currency: "",
    rule: normalized && !isAfricanCountry(normalized) ? "blocked" : "review_required",
    note: normalized && !isAfricanCountry(normalized)
      ? "Outside the target region (Africa)."
      : "Country could not be identified, so no marketing rule applies to it.",
  };
}

export function dialCodeForCountry(code: string | null): string {
  return countryRule(code).dialCode;
}

export interface OutreachDecision {
  allowed: boolean;
  rule: OutreachRule;
  /** Shown to the admin, and recorded on the prospect when a send is refused. */
  reason: string;
  requiresConsent: boolean;
}

/**
 * May this prospect be emailed?
 *
 * `consentAt` is the recorded moment they agreed to hear from us — the only
 * lawful route where the rule demands it, and the evidence we would have to
 * produce. A `permitted` country still requires the opt-out that every email
 * in this product carries.
 */
export function decideOutreach(params: {
  country: string | null;
  consentAt?: string | null;
  /** A per-country override from the database, once counsel has signed off. */
  overrideRule?: OutreachRule;
}): OutreachDecision {
  const rule = countryRule(params.country);
  const effective = params.overrideRule ?? rule.rule;
  const hasConsent = Boolean(params.consentAt);

  if (effective === "blocked") {
    return {
      allowed: false,
      rule: effective,
      reason: `${rule.name} is outside the target region. This tool only contacts businesses in Africa.`,
      requiresConsent: false,
    };
  }

  if (effective === "review_required") {
    return {
      allowed: false,
      rule: effective,
      reason: `No marketing position recorded for ${rule.name}. Confirm the local rules (${rule.note}) and set the country rule before emailing.`,
      requiresConsent: false,
    };
  }

  if (effective === "consent_required" && !hasConsent) {
    return {
      allowed: false,
      rule: effective,
      reason: `${rule.name} requires prior consent for electronic direct marketing. ${rule.note}`,
      requiresConsent: true,
    };
  }

  return {
    allowed: true,
    rule: effective,
    reason: hasConsent
      ? `Consent recorded on ${new Date(params.consentAt as string).toISOString().slice(0, 10)}.`
      : `${rule.name}: ${rule.note}`,
    requiresConsent: false,
  };
}

/** Countries represented in a set of prospects, with the rule that applies —
 * what the workbench shows so the shape of the list is visible at a glance. */
export function summarizeCountries(codes: string[]): Array<{ rule: CountryRule; count: number }> {
  const counts = new Map<string, number>();
  for (const code of codes) {
    const normalized = normalizeCountryCode(code) ?? "??";
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([code, count]) => ({ rule: countryRule(code), count }))
    .sort((a, b) => b.count - a.count);
}
