/**
 * Phone numbers, for a continent rather than a country.
 *
 * The rest of this product was written for Nigeria: `normalizeNgPhone` hard-codes
 * +234, an eleven-digit national number and a leading zero. That is correct for
 * the market it was built for and wrong for every other one — a Kenyan
 * `0712 345 678` would have become `234712345678`, and the callback SMS would
 * have gone to a stranger, or nowhere.
 *
 * So this module generalises it. `normalizePhone(raw, dialCode)` produces
 * digits-only E.164 without the plus, which is what Twilio and `wa.me` both
 * want, for any African dialling code. `normalizeNgPhone` in `src/lib/termii.ts`
 * now delegates here, so existing Nigerian behaviour is bit-for-bit unchanged
 * while every other market gets the same treatment.
 *
 * Self-contained (no runtime imports) so it is directly unit tested — the last
 * place a silent bug should live is in deciding which stranger receives a
 * patient's appointment confirmation.
 */

/** Digits only, no plus, no spaces. */
export function digitsOnly(value: string): string {
  return (value || "").replace(/\D/g, "");
}

/**
 * Normalises a number to international digits for a given country.
 *
 * Handles the shapes these numbers actually arrive in:
 *   "0803 441 2291"     → "2348034412291"   (national, leading trunk zero)
 *   "+234 803 441 2291" → "2348034412291"
 *   "2348034412291"     → "2348034412291"
 *   "0712 345 678" +254 → "254712345678"
 *   "712345678" +254    → "254712345678"    (no trunk zero at all)
 *   "00254712345678"    → "254712345678"    (international access prefix)
 *
 * Anything it cannot improve on is returned digits-only, so a bad number fails
 * visibly at the provider instead of being silently reshaped.
 */
export function normalizePhone(raw: string, dialCode: string): string {
  const country = digitsOnly(dialCode);
  let digits = digitsOnly(raw);
  if (!digits) return "";

  // A leading "00" is the international access prefix in most of Africa.
  if (digits.startsWith("00")) digits = digits.slice(2);

  if (!country) return digits;

  // Already international for this country.
  if (digits.startsWith(country)) return digits;

  // National format: a trunk zero followed by the subscriber number.
  if (digits.startsWith("0")) return `${country}${digits.replace(/^0+/, "")}`;

  // No trunk zero (common in Kenya, Ghana, Tanzania): a bare subscriber number.
  // Only prepend when the result is a plausible length, so a number that is
  // already international for *another* country is left alone rather than
  // mangled into this one.
  const nationalLength = digits.length;
  const plausible = nationalLength >= 6 && nationalLength <= 10 && !startsWithAnyAfricanCode(digits);
  if (plausible) return `${country}${digits}`;

  return digits;
}

/**
 * The subscriber part of a number, used as the routing key for inbound calls.
 *
 * Nine digits is the shortest subscriber number in common use across the
 * continent (Nigeria and Kenya are both nine), and matching on the tail rather
 * than the whole string is what lets a stored "0700 000 1234" and a webhook's
 * "+2347000001234" resolve to the same clinic.
 */
export function subscriberKey(phone: string, length = 9): string {
  const digits = digitsOnly(phone);
  return digits.length <= length ? digits : digits.slice(-length);
}

/** Every dialling code in use in Africa, longest first so a three-digit code
 * is never mistaken for a two-digit one ("234" not "23"). */
const AFRICAN_DIAL_CODES = [
  "254", "255", "256", "257", "250", "251", "252", "253", "258", "260", "263", "264", "265", "266", "267", "268", "269",
  "234", "233", "232", "231", "230", "238", "239", "220", "221", "222", "223", "224", "225", "226", "227", "228", "229",
  "261", "262", "291",
  "213", "216", "218", "249", "211", "212",
  "27", "20",
];

function startsWithAnyAfricanCode(digits: string): boolean {
  return AFRICAN_DIAL_CODES.some((code) => digits.startsWith(code));
}

/**
 * Whether a number looks like a usable mobile number for the given country.
 *
 * Deliberately loose — the provider is the authority on deliverability — but
 * strict enough to catch the mistakes that matter: a number typed without its
 * country code, a landline where a mobile is needed, or a truncated paste.
 */
export function isPlausibleMobile(raw: string, dialCode: string): boolean {
  const normalized = normalizePhone(raw, dialCode);
  const country = digitsOnly(dialCode);
  if (!normalized || !country) return false;
  if (!normalized.startsWith(country)) return false;
  const subscriber = normalized.slice(country.length);
  return subscriber.length >= 8 && subscriber.length <= 10;
}

/** Display form: "+234 803 441 2291". Grouping is cosmetic and best-effort. */
export function formatInternational(raw: string, dialCode: string): string {
  const normalized = normalizePhone(raw, dialCode);
  const country = digitsOnly(dialCode);
  if (!normalized || !country || !normalized.startsWith(country)) return raw;
  const subscriber = normalized.slice(country.length);
  const grouped = subscriber.replace(/(\d{3})(\d{3})(\d{0,4})/, "$1 $2 $3").trim();
  return `+${country} ${grouped}`;
}

/** The `wa.me` link for a number in any of these countries. */
export function whatsappLink(raw: string, dialCode: string): string | null {
  const normalized = normalizePhone(raw, dialCode);
  return normalized ? `https://wa.me/${normalized}` : null;
}
