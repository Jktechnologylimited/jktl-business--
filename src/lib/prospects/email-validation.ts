/**
 * Is this email address worth sending to?
 *
 * This exists because the answer decides whether a sending domain survives. A
 * cold-email run at 12,000 addresses is only viable if the list has been cleaned
 * first: hard bounces above about 2% get a domain throttled, then blocklisted,
 * and that takes the transactional mail down with it — booking confirmations,
 * receipts, invoice notifications. The mail that must never be blocked.
 *
 * Three layers, cheapest first:
 *
 *   1. **Syntax and shape** — pure, instant, catches typos in the source data
 *      ("info@", "n/a", "08031234567").
 *   2. **Role and disposable detection** — pure, instant. `info@` gets delivered
 *      but is worth less and more likely to complain; a throwaway provider like
 *      mailinator.com is a guaranteed bounce later.
 *   3. **MX lookup** — a DNS query. Proves the domain can receive mail at all,
 *      which is the single highest-value check. It costs one lookup per domain,
 *      not per address, so a list of thousands is cheap.
 *
 * The layers are separated so the pure ones can be unit tested without a network,
 * and so a DNS failure degrades to "unknown" rather than "invalid" — never
 * discard a real lead because a resolver was briefly unreachable.
 *
 * Deliberately does NOT do SMTP handshake probing: it is slow, it leaks your
 * intent, and it gets your IP blocklisted by the providers you are probing.
 */

export type EmailStatus = "unknown" | "valid" | "risky" | "invalid";

export interface EmailCheck {
  status: EmailStatus;
  /** Human-readable, and short enough to show in a table cell. */
  note: string;
  /** The domain, when one could be extracted — exported so a caller can batch
   * MX lookups by domain instead of querying the same one a hundred times. */
  domain: string;
}

export function domainOf(email: string): string {
  const at = email.lastIndexOf("@");
  if (at === -1) return "";
  return email.slice(at + 1).trim().toLowerCase();
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Domains that are throwaway by design. Every one of these accepts a mailbox and
 * discards it, so a "successful" send to one is a lead that can never reply.
 */
export const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "sharklasers.com",
  "grr.la",
  "10minutemail.com",
  "10minutemail.net",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "yopmail.com",
  "yopmail.fr",
  "trashmail.com",
  "maildrop.cc",
  "getnada.com",
  "dispostable.com",
  "fakeinbox.com",
  "mytemp.email",
  "mailnesia.com",
  "spam4.me",
]);

/**
 * Local parts that reach a shared inbox or a machine rather than a person.
 *
 * Not invalid — `info@` is a real address a real business reads. But it is worth
 * less: it is less likely to be answered, more likely to be marked as spam, and
 * for a *personalised* email with the owner's business name in the subject, the
 * difference between `info@` and `dr.eze@` is the difference between a reply and
 * nothing.
 */
export const ROLE_LOCAL_PARTS = new Set([
  "info",
  "admin",
  "administrator",
  "contact",
  "hello",
  "hi",
  "enquiries",
  "enquiry",
  "inquiries",
  "inquiry",
  "sales",
  "support",
  "help",
  "office",
  "mail",
  "email",
  "webmaster",
  "postmaster",
  "noreply",
  "no-reply",
  "donotreply",
  "billing",
  "accounts",
  "accounting",
  "marketing",
  "reception",
  "frontdesk",
  "bookings",
  "booking",
  "appointments",
  "care",
  "clinic",
  "team",
  "general",
  "services",
  "customercare",
]);

/** Values that are not addresses at all, seen in scraped listings. */
const JUNK_VALUES = new Set([
  "n/a",
  "na",
  "none",
  "null",
  "nil",
  "-",
  "--",
  "unknown",
  "not available",
  "notavailable",
  "no email",
  "noemail",
  "test",
  "test@test.com",
  "example@example.com",
  "user@example.com",
  "your@email.com",
  "email@email.com",
  "youremail@gmail.com",
]);

/**
 * RFC-5322 in full is not worth implementing. This is the practical subset that
 * catches real mistakes without rejecting real addresses: one @, a non-empty
 * local part with no leading/trailing dot, a domain with at least one dot and a
 * plausible TLD.
 */
export function isSyntacticallyValid(email: string): boolean {
  const value = normalizeEmail(email);
  if (!value || value.length > 254) return false;
  if (JUNK_VALUES.has(value)) return false;

  const parts = value.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;

  if (!local || local.length > 64) return false;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  // Practical character set. Deliberately allows + and _ and -, which are common
  // and legal, and rejects anything that suggests the value is not an address.
  if (!/^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local)) return false;

  if (domain.length > 253) return false;
  if (domain.startsWith("-") || domain.endsWith("-") || domain.startsWith(".") || domain.endsWith(".")) return false;
  if (domain.includes("..")) return false;
  if (!/^[a-z0-9.-]+$/.test(domain)) return false;

  // Must have a real TLD: at least one dot, and two or more letters after it.
  // The dot check is not redundant — without it `lastIndexOf` returns -1 and the
  // whole domain is treated as the TLD, so `no@tld` was accepted as valid.
  if (!domain.includes(".")) return false;
  const tld = domain.slice(domain.lastIndexOf(".") + 1);
  if (!/^[a-z]{2,}$/.test(tld)) return false;

  return true;
}

/**
 * The checks that need no network.
 *
 * Returns `invalid` for junk and throwaway providers, `risky` for a real but
 * shared inbox, and `unknown` when the address looks fine and only a DNS lookup
 * can say more — never `valid`, because syntax alone has never delivered an
 * email.
 */
export function checkEmailOffline(email: string): EmailCheck {
  const value = normalizeEmail(email);
  const domain = domainOf(value);

  if (!value) return { status: "invalid", note: "No address", domain: "" };
  if (!isSyntacticallyValid(value)) return { status: "invalid", note: "Malformed address", domain };
  if (DISPOSABLE_DOMAINS.has(domain)) return { status: "invalid", note: "Disposable provider", domain };

  const local = value.slice(0, value.lastIndexOf("@"));
  // A role address with a suffix is still a role address: `info-ng@`, `info2@`
  // and `sales.lagos@` all reach a shared inbox, not a person. Splitting on the
  // separators handles the first two forms; stripping trailing digits handles
  // `info2@`, which would otherwise be classified as a named contact.
  const stem = (local.split(/[.+_-]/)[0] ?? "").replace(/\d+$/, "");
  if (ROLE_LOCAL_PARTS.has(local) || ROLE_LOCAL_PARTS.has(stem)) {
    return { status: "risky", note: "Shared inbox (role address)", domain };
  }

  // Free consumer mail at a business listing is a real person, but it tells you
  // this is a one-person operation with no domain of its own.
  if (FREE_PROVIDERS.has(domain)) {
    return { status: "risky", note: "Free mailbox, not a company domain", domain };
  }

  return { status: "unknown", note: "Looks well-formed; domain not yet checked", domain };
}

export const FREE_PROVIDERS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.fr",
  "ymail.com",
  "hotmail.com",
  "hotmail.co.uk",
  "outlook.com",
  "live.com",
  "msn.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "protonmail.com",
  "proton.me",
  "gmx.com",
  "gmx.net",
  "mail.com",
  "yandex.com",
  "zoho.com",
]);

/** Unique domains in a list, so MX lookups happen once per domain rather than
 * once per address. A 5,000-row list is usually a few hundred domains. */
export function uniqueDomains(emails: string[]): string[] {
  const seen = new Set<string>();
  for (const email of emails) {
    const domain = domainOf(email);
    if (domain) seen.add(domain);
  }
  return [...seen];
}

export interface MxResult {
  domain: string;
  /** null means the lookup failed for a reason that is not the domain's fault. */
  hasMail: boolean | null;
  note: string;
}

/**
 * Resolves whether a domain can receive mail.
 *
 * Falls back to an A record: some perfectly good small-business domains publish
 * no MX and rely on their host's implicit mail handling, so treating "no MX" as
 * dead would discard real leads. Only "no MX *and* no A record" is a dead domain.
 */
export async function checkDomainMail(domain: string, resolve: DnsResolver): Promise<MxResult> {
  try {
    const records = await resolve.resolveMx(domain);
    if (records.length > 0) {
      // A null MX (".", priority 0) is an explicit "this domain accepts no mail".
      const nullMx = records.length === 1 && (records[0].exchange === "" || records[0].exchange === ".");
      return nullMx
        ? { domain, hasMail: false, note: "Domain publishes a null MX (accepts no mail)" }
        : { domain, hasMail: true, note: "Mail exchanger found" };
    }
  } catch (err) {
    const code = (err as { code?: string }).code;
    // NXDOMAIN is the domain's fault — it does not exist. Anything else
    // (SERVFAIL, timeout, rate limit) is ours, and must not condemn a real lead.
    if (code !== "ENOTFOUND" && code !== "ENODATA") {
      return { domain, hasMail: null, note: "DNS lookup failed; not treated as invalid" };
    }
  }

  try {
    const addresses = await resolve.resolve4(domain).catch(() => [] as string[]);
    if (addresses.length > 0) {
      // No MX but the domain resolves: some hosts deliver to the A record. Worth
      // one send rather than discarding the business.
      return { domain, hasMail: true, note: "No MX, but the domain resolves" };
    }
  } catch {
    // Falls through to the verdict below.
  }

  return { domain, hasMail: false, note: "Domain does not exist or cannot receive mail" };
}

/** The slice of `node:dns/promises` this needs, so tests can supply a fake. */
export interface DnsResolver {
  resolveMx(domain: string): Promise<Array<{ exchange: string; priority: number }>>;
  resolve4(domain: string): Promise<string[]>;
}

/**
 * The full check: offline layers first, then MX for whatever survived.
 *
 * `mxByDomain` is passed in rather than looked up here so a caller can batch —
 * one DNS query per domain for a whole import, not one per row.
 */
export function combineEmailChecks(email: string, mx?: MxResult | null): EmailCheck {
  const offline = checkEmailOffline(email);
  if (offline.status === "invalid") return offline;
  if (!mx) return offline;
  if (mx.hasMail === false) return { status: "invalid", note: mx.note, domain: offline.domain };
  if (mx.hasMail === null) return { ...offline, note: `${offline.note}; ${mx.note}` };
  // Domain is reachable. A role address stays "risky" — reachable is not the
  // same as worth a personalised email.
  return offline.status === "risky" ? offline : { status: "valid", note: mx.note, domain: offline.domain };
}

/**
 * Whether outreach may be sent here.
 *
 * `risky` is allowed — a shared inbox is still a real business — and is
 * deprioritised by the caller rather than blocked. `unknown` is allowed too: a
 * lead must not be discarded merely for not having been checked yet, and an
 * earlier version of this excluded it, which would have silently blocked every
 * address the validator had not reached.
 *
 * Only `invalid` is a hard no: a malformed address, a dead domain, or a
 * throwaway mailbox is a guaranteed bounce, and bounces are what take a sending
 * domain down.
 */
export function isSendable(status: EmailStatus): boolean {
  return status !== "invalid";
}

/**
 * Orders addresses so the most promising are sent to first.
 *
 * A named person at a company domain beats a named person on Gmail beats
 * `info@`, and an unvalidated address is sent last — if at all.
 */
export function emailPriority(status: EmailStatus, email: string): number {
  const local = email.slice(0, Math.max(email.lastIndexOf("@"), 0));
  const named = local.length > 1 && !ROLE_LOCAL_PARTS.has(local.split(/[.+_-]/)[0]);
  if (status === "valid") return named ? 0 : 1;
  if (status === "risky") return named ? 2 : 3;
  if (status === "unknown") return 4;
  return 5;
}
