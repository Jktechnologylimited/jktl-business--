import "server-only";
import bcrypt from "bcryptjs";
import { getSql } from "./client";
import { kobo, isoDate } from "./rows";

/** Default commission rate for a newly created affiliate, in basis points
 * (2000 = 20%) — matches what was scoped for this feature: a recurring
 * cut of the Website & Hosting subscription revenue a referred business
 * pays, for as long as they stay subscribed. Overridable per affiliate
 * (see createAffiliate's input) since different agencies may be offered
 * different rates. */
export const DEFAULT_COMMISSION_BPS = 2000;

/** One-time signup bonus, in kobo (₦2,000) — credited (see
 * `claimWelcomeBonusIfEligible` below) the first time a business an
 * affiliate referred actually pays, never at approval time. About two
 * months of commission on one referral (20% of ₦5,000/mo), bounded
 * because it only fires after a real payment has already landed — see
 * migration 015's comment for the full reasoning. */
export const WELCOME_BONUS_KOBO = 200_000;

/** Payout requests only open from this day of the month onward (Africa/Lagos
 * time — Nigeria has one timezone, no DST, so this is unambiguous
 * regardless of where the server runs). See `isPayoutWindowOpen`. */
export const PAYOUT_REQUEST_DAY = 21;

export interface Affiliate {
  id: string;
  name: string;
  email: string;
  referralCode: string;
  commissionBps: number;
  status: "pending" | "active" | "suspended";
  /** Freeform note from a self-serve application — how they plan to
   * promote JKTL, their social handles, etc. Empty for an affiliate the
   * command center created directly, since that flow has no such field. */
  applicationNote: string;
  /** Null until their first referred business actually pays — see
   * `claimWelcomeBonusIfEligible`. Once set, the ₦2,000 bonus has already
   * been credited as a real row in `affiliate_earnings`, so this is just
   * a "has it happened yet" flag for the UI, not the source of truth for
   * whether it's been paid. */
  welcomeBonusClaimedAt: string | null;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  /** The name Paystack's account-resolve endpoint returned for this
   * account — never client-supplied, so this is always what the bank
   * actually has on file. Empty until `bankVerifiedAt` is set. */
  accountName: string;
  bankVerifiedAt: string | null;
  createdAt: string;
}

function mapAffiliate(row: Record<string, unknown>): Affiliate {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    referralCode: row.referral_code as string,
    commissionBps: Number(row.commission_bps),
    status: (row.status as string) === "pending" ? "pending" : (row.status as string) === "suspended" ? "suspended" : "active",
    applicationNote: (row.application_note as string) ?? "",
    welcomeBonusClaimedAt: row.welcome_bonus_claimed_at ? isoDate(row.welcome_bonus_claimed_at as string) : null,
    bankCode: (row.bank_code as string) ?? "",
    bankName: (row.bank_name as string) ?? "",
    accountNumber: (row.account_number as string) ?? "",
    accountName: (row.account_name as string) ?? "",
    bankVerifiedAt: row.bank_verified_at ? isoDate(row.bank_verified_at as string) : null,
    createdAt: isoDate(row.created_at as string),
  };
}

/** Nigeria has one timezone (Africa/Lagos, UTC+1, no DST), so this always
 * reflects the real local day/month regardless of where the server runs —
 * unlike `new Date().getDate()`, which would read the server's own UTC
 * clock and could be a day off right around midnight. */
function lagosDateParts(d: Date = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** True from the 21st of the month (Africa/Lagos time) through month end —
 * the window an affiliate can request a payout in. Exported so the
 * dashboard can show the same "requests open on the 21st" state without
 * duplicating the date logic. */
export function isPayoutWindowOpen(d: Date = new Date()): boolean {
  return lagosDateParts(d).day >= PAYOUT_REQUEST_DAY;
}

/** 'YYYY-MM' in Africa/Lagos time — this month's payout-request window key,
 * matching `payout_requests.window_key`'s UNIQUE constraint so an
 * affiliate can only ever have one request per calendar month. */
export function currentPayoutWindowKey(d: Date = new Date()): string {
  const { year, month } = lagosDateParts(d);
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Excludes visually-ambiguous characters (0/O, 1/I/L) since this gets
 * read aloud or typed by hand often enough (an affiliate sharing their
 * code over the phone, someone typing it into a signup link). */
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomReferralCode(): string {
  let code = "";
  for (let i = 0; i < 7; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

export interface AffiliateStats extends Affiliate {
  referralCount: number;
  totalEarnedKobo: number;
  totalPaidOutKobo: number;
  balanceKobo: number;
}

export async function listAffiliatesWithStats(): Promise<AffiliateStats[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      a.*,
      (SELECT COUNT(*) FROM affiliate_referrals r WHERE r.affiliate_id = a.id) AS referral_count,
      (SELECT COALESCE(SUM(e.commission_kobo), 0) FROM affiliate_earnings e WHERE e.affiliate_id = a.id) AS total_earned_kobo,
      (SELECT COALESCE(SUM(p.amount_kobo), 0) FROM affiliate_payouts p WHERE p.affiliate_id = a.id) AS total_paid_out_kobo
    FROM affiliates a
    ORDER BY a.created_at DESC
  `;
  return rows.map((row) => {
    const totalEarnedKobo = kobo(row.total_earned_kobo as string);
    const totalPaidOutKobo = kobo(row.total_paid_out_kobo as string);
    return {
      ...mapAffiliate(row),
      referralCount: Number(row.referral_count ?? 0),
      totalEarnedKobo,
      totalPaidOutKobo,
      balanceKobo: totalEarnedKobo - totalPaidOutKobo,
    };
  });
}

export interface CreateAffiliateInput {
  name: string;
  email: string;
  password: string;
  commissionBps?: number;
}

/** Thrown (as a plain Error with this message) when the email is already
 * in use — checked up front rather than relying on parsing a Postgres
 * unique-violation error, so the caller gets an unambiguous reason. */
export const AFFILIATE_EMAIL_TAKEN = "AFFILIATE_EMAIL_TAKEN";

export async function createAffiliate(input: CreateAffiliateInput): Promise<Affiliate> {
  const sql = getSql();
  const email = input.email.toLowerCase();

  const existing = await sql`SELECT id FROM affiliates WHERE email = ${email}`;
  if (existing[0]) throw new Error(AFFILIATE_EMAIL_TAKEN);

  const passwordHash = await bcrypt.hash(input.password, 10);
  const commissionBps = input.commissionBps ?? DEFAULT_COMMISSION_BPS;

  // Referral codes are random, not sequential, so a collision is possible
  // (if rare) — retry with a fresh code rather than failing the whole
  // create over it.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomReferralCode();
    try {
      const rows = await sql`
        INSERT INTO affiliates (name, email, password_hash, referral_code, commission_bps)
        VALUES (${input.name}, ${email}, ${passwordHash}, ${code}, ${commissionBps})
        RETURNING *
      `;
      return mapAffiliate(rows[0]);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Couldn't create affiliate.");
}

/** The full `Affiliate` record (bank details, bonus status, etc.) — the
 * session's own `AffiliateUser` is deliberately a slimmer, auth-only shape
 * (see affiliate-auth.ts), so anything that needs these extra fields
 * fetches them separately here rather than bloating every session check
 * with columns most callers don't need. */
export async function getAffiliateById(affiliateId: string): Promise<Affiliate | null> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM affiliates WHERE id = ${affiliateId}`;
  return rows[0] ? mapAffiliate(rows[0]) : null;
}

export async function setAffiliateStatus(affiliateId: string, status: "active" | "suspended"): Promise<void> {
  const sql = getSql();
  await sql`UPDATE affiliates SET status = ${status} WHERE id = ${affiliateId}`;
}

// ---- Self-serve applications (migration 014) ----
//
// A person who wants to become an affiliate can apply themselves at
// /affiliates/apply, landing in `status = 'pending'` — they can't sign in
// or earn anything (see `verifyAffiliateLogin` in affiliate-auth.ts) until
// an admin approves them from the command center. This sits alongside,
// not in place of, the original admin-creates-directly flow above
// (`createAffiliate`), which still skips the review step entirely — the
// admin creating the account *is* the review there.

export interface ApplyAsAffiliateInput {
  name: string;
  email: string;
  password: string;
  applicationNote: string;
}

export async function applyAsAffiliate(input: ApplyAsAffiliateInput): Promise<Affiliate> {
  const sql = getSql();
  const email = input.email.toLowerCase();

  // Same email-taken check as createAffiliate — deliberately shared logic
  // (an email already used by an active affiliate OR a still-pending
  // application both block a new application) rather than a separate
  // "pending only" check, so nobody can queue up a second application
  // under an email that's already in the system in any state.
  const existing = await sql`SELECT id FROM affiliates WHERE email = ${email}`;
  if (existing[0]) throw new Error(AFFILIATE_EMAIL_TAKEN);

  const passwordHash = await bcrypt.hash(input.password, 10);

  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomReferralCode();
    try {
      const rows = await sql`
        INSERT INTO affiliates (name, email, password_hash, referral_code, commission_bps, status, application_note)
        VALUES (${input.name}, ${email}, ${passwordHash}, ${code}, ${DEFAULT_COMMISSION_BPS}, 'pending', ${input.applicationNote})
        RETURNING *
      `;
      return mapAffiliate(rows[0]);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Couldn't submit that application.");
}

export async function listPendingApplications(): Promise<Affiliate[]> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM affiliates WHERE status = 'pending' ORDER BY created_at ASC`;
  return rows.map(mapAffiliate);
}

/** The applicant already set their own password at apply time, so
 * approving is just a status flip — no password to generate or share.
 * Scoped to `status = 'pending'` so this can't accidentally reactivate a
 * suspended affiliate through the wrong code path. */
export async function approveAffiliateApplication(affiliateId: string): Promise<void> {
  const sql = getSql();
  await sql`UPDATE affiliates SET status = 'active' WHERE id = ${affiliateId} AND status = 'pending'`;
}

/** Deletes the application outright rather than keeping a 'rejected'
 * status — there's nothing worth retaining about one nobody approved, and
 * it frees up the email for a future application. Scoped to `status =
 * 'pending'` so this can never be used to delete a real, active affiliate
 * and its earnings history. */
export async function rejectAffiliateApplication(affiliateId: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM affiliates WHERE id = ${affiliateId} AND status = 'pending'`;
}

export interface AffiliateReferredBusiness {
  organizationId: string;
  displayName: string;
  subscriptionStatus: string;
  referredAt: string;
}

export async function listReferredBusinesses(affiliateId: string): Promise<AffiliateReferredBusiness[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT r.organization_id, r.created_at, bp.display_name, COALESCE(ia.subscription_status, 'inactive') AS subscription_status
    FROM affiliate_referrals r
    JOIN business_profiles bp ON bp.organization_id = r.organization_id
    LEFT JOIN infrastructure_accounts ia ON ia.organization_id = r.organization_id
    WHERE r.affiliate_id = ${affiliateId}
    ORDER BY r.created_at DESC
  `;
  return rows.map((row) => ({
    organizationId: row.organization_id as string,
    displayName: row.display_name as string,
    subscriptionStatus: row.subscription_status as string,
    referredAt: isoDate(row.created_at as string),
  }));
}

export interface AffiliateEarning {
  id: string;
  organizationId: string;
  businessName: string;
  sourceAmountKobo: number;
  commissionKobo: number;
  /** True for the one-time welcome-bonus row (`source_amount_kobo = 0` is
   * the signal — a real commission row is always > 0, guarded in
   * `accrueCommissionForOrg`). The UI labels this row "Signup bonus"
   * instead of ordinary commission. */
  isBonus: boolean;
  createdAt: string;
}

export async function listEarnings(affiliateId: string, limit = 50): Promise<AffiliateEarning[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT e.id, e.organization_id, e.source_amount_kobo, e.commission_kobo, e.created_at, bp.display_name
    FROM affiliate_earnings e
    JOIN business_profiles bp ON bp.organization_id = e.organization_id
    WHERE e.affiliate_id = ${affiliateId}
    ORDER BY e.created_at DESC
    LIMIT ${limit}
  `;
  return rows.map((row) => {
    const sourceAmountKobo = kobo(row.source_amount_kobo as string);
    return {
      id: row.id as string,
      organizationId: row.organization_id as string,
      businessName: row.display_name as string,
      sourceAmountKobo,
      commissionKobo: kobo(row.commission_kobo as string),
      isBonus: sourceAmountKobo === 0,
      createdAt: isoDate(row.created_at as string),
    };
  });
}

export interface AffiliatePayout {
  id: string;
  amountKobo: number;
  note: string;
  createdAt: string;
}

export async function listPayouts(affiliateId: string, limit = 50): Promise<AffiliatePayout[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, amount_kobo, note, created_at FROM affiliate_payouts
    WHERE affiliate_id = ${affiliateId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map((row) => ({
    id: row.id as string,
    amountKobo: kobo(row.amount_kobo as string),
    note: (row.note as string) ?? "",
    createdAt: isoDate(row.created_at as string),
  }));
}

export async function recordPayout(affiliateId: string, adminUserId: string, amountKobo: number, note: string): Promise<AffiliatePayout> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO affiliate_payouts (affiliate_id, admin_user_id, amount_kobo, note)
    VALUES (${affiliateId}, ${adminUserId}, ${amountKobo}, ${note})
    RETURNING *
  `;
  const row = rows[0];
  return { id: row.id as string, amountKobo: kobo(row.amount_kobo as string), note: (row.note as string) ?? "", createdAt: isoDate(row.created_at as string) };
}

/**
 * Saves a verified bank account for manual payouts. Always called with the
 * name Paystack's resolve endpoint returned (never a client-supplied
 * name) — see `verifyAffiliateAccountAction` — so `accountName` here is
 * trustworthy for the admin to check against before transferring money.
 */
export async function saveAffiliateBankDetails(
  affiliateId: string,
  input: { bankCode: string; bankName: string; accountNumber: string; accountName: string },
): Promise<Affiliate> {
  const sql = getSql();
  const rows = await sql`
    UPDATE affiliates
    SET bank_code = ${input.bankCode}, bank_name = ${input.bankName},
        account_number = ${input.accountNumber}, account_name = ${input.accountName},
        bank_verified_at = now()
    WHERE id = ${affiliateId}
    RETURNING *
  `;
  return mapAffiliate(rows[0]);
}

export async function getAffiliateBalance(affiliateId: string): Promise<{ totalEarnedKobo: number; totalPaidOutKobo: number; balanceKobo: number }> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      (SELECT COALESCE(SUM(commission_kobo), 0) FROM affiliate_earnings WHERE affiliate_id = ${affiliateId}) AS total_earned_kobo,
      (SELECT COALESCE(SUM(amount_kobo), 0) FROM affiliate_payouts WHERE affiliate_id = ${affiliateId}) AS total_paid_out_kobo
  `;
  const totalEarnedKobo = kobo(rows[0].total_earned_kobo as string);
  const totalPaidOutKobo = kobo(rows[0].total_paid_out_kobo as string);
  return { totalEarnedKobo, totalPaidOutKobo, balanceKobo: totalEarnedKobo - totalPaidOutKobo };
}

/**
 * Called once at signup (best-effort, from signupAction) when the person
 * arrived via a `?ref=<code>` link. Silently does nothing if the code
 * doesn't match any affiliate, or matches a suspended one — a bad or
 * stale referral code should never block or complicate signup itself.
 * The UNIQUE constraint on organization_id means this can only ever
 * happen once per business, no matter how many times it's called.
 */
export async function recordReferralIfValid(organizationId: string, referralCode: string | null | undefined): Promise<void> {
  if (!referralCode) return;
  const sql = getSql();
  const rows = await sql`SELECT id FROM affiliates WHERE referral_code = ${referralCode.toUpperCase()} AND status = 'active'`;
  const affiliate = rows[0];
  if (!affiliate) return;
  await sql`
    INSERT INTO affiliate_referrals (affiliate_id, organization_id)
    VALUES (${affiliate.id}, ${organizationId})
    ON CONFLICT (organization_id) DO NOTHING
  `;
}

/**
 * Called from the Paystack webhook (the authoritative side of a
 * subscription charge — never from the optimistic checkout-callback path,
 * so a single real payment is never double-counted; see the webhook
 * route's comment). Best-effort and silent when there's no referral or
 * the affiliate has been suspended since — this must never be allowed to
 * break the billing webhook it's called from.
 */
export async function accrueCommissionForOrg(organizationId: string, sourceAmountKobo: number, paystackReference: string): Promise<void> {
  if (!sourceAmountKobo || sourceAmountKobo <= 0) return;
  const sql = getSql();
  const rows = await sql`
    SELECT r.affiliate_id, a.commission_bps
    FROM affiliate_referrals r
    JOIN affiliates a ON a.id = r.affiliate_id
    WHERE r.organization_id = ${organizationId} AND a.status = 'active'
  `;
  const row = rows[0];
  if (!row) return;

  const commissionKobo = Math.round((sourceAmountKobo * Number(row.commission_bps)) / 10000);
  if (commissionKobo > 0) {
    await sql`
      INSERT INTO affiliate_earnings (affiliate_id, organization_id, source_amount_kobo, commission_kobo, paystack_reference)
      VALUES (${row.affiliate_id}, ${organizationId}, ${sourceAmountKobo}, ${commissionKobo}, ${paystackReference})
    `;
  }

  // The affiliate's referred business just made a real payment — if this
  // affiliate hasn't already claimed their one-time welcome bonus, this is
  // the moment it unlocks. Deliberately reached even if commissionKobo
  // above was 0 (a 0% commission affiliate should still get the bonus).
  await claimWelcomeBonusIfEligible(sql, row.affiliate_id as string, organizationId);
}

/**
 * Credits the ₦2,000 welcome bonus exactly once per affiliate, the first
 * time any business they referred actually pays. The UPDATE...RETURNING
 * guard is what makes this idempotent under concurrent webhook deliveries
 * (two referred businesses paying within moments of each other, or a
 * redelivered webhook): only the call that successfully flips
 * `welcome_bonus_claimed_at` from NULL to now() goes on to insert the
 * earnings row, so it can never be credited twice.
 */
async function claimWelcomeBonusIfEligible(sql: ReturnType<typeof getSql>, affiliateId: string, organizationId: string): Promise<void> {
  const rows = await sql`
    UPDATE affiliates SET welcome_bonus_claimed_at = now()
    WHERE id = ${affiliateId} AND welcome_bonus_claimed_at IS NULL
    RETURNING id
  `;
  if (!rows[0]) return;
  await sql`
    INSERT INTO affiliate_earnings (affiliate_id, organization_id, source_amount_kobo, commission_kobo, paystack_reference)
    VALUES (${affiliateId}, ${organizationId}, 0, ${WELCOME_BONUS_KOBO}, 'welcome-bonus')
  `;
}

// ---- Payout requests ----
//
// An affiliate requests their full balance once a month (from the 21st
// onward — see `isPayoutWindowOpen`) instead of the admin having to guess
// when to check in on them. The admin still pays by manual bank transfer
// and marks the request paid, or declines it — no automated Paystack
// transfer, same "manual, tracked in command center" choice as the
// original affiliate-program round.

export interface PayoutRequest {
  id: string;
  amountKobo: number;
  status: "pending" | "paid" | "declined";
  requestedAt: string;
}

function mapPayoutRequest(row: Record<string, unknown>): PayoutRequest {
  return {
    id: row.id as string,
    amountKobo: kobo(row.amount_kobo as string),
    status: (row.status as string) as PayoutRequest["status"],
    requestedAt: isoDate(row.requested_at as string),
  };
}

/** This affiliate's payout request for the *current* calendar month, if
 * any — regardless of status, so a declined request this month still
 * blocks a second one until next month's window (same one-per-month rule
 * a paid or pending request enforces). */
export async function getCurrentPayoutRequest(affiliateId: string): Promise<PayoutRequest | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM payout_requests
    WHERE affiliate_id = ${affiliateId} AND window_key = ${currentPayoutWindowKey()}
    LIMIT 1
  `;
  return rows[0] ? mapPayoutRequest(rows[0]) : null;
}

export const PAYOUT_WINDOW_CLOSED = "PAYOUT_WINDOW_CLOSED";
export const PAYOUT_ALREADY_REQUESTED = "PAYOUT_ALREADY_REQUESTED";
export const PAYOUT_NOTHING_TO_REQUEST = "PAYOUT_NOTHING_TO_REQUEST";
export const PAYOUT_BANK_NOT_VERIFIED = "PAYOUT_BANK_NOT_VERIFIED";

/** Requests a payout of the affiliate's *entire* current balance — not a
 * custom amount, deliberately, to keep this a one-tap action rather than
 * needing amount validation against a balance that could itself change
 * between load and submit. Throws one of the sentinels above; the action
 * layer turns each into a specific message. */
export async function requestPayout(affiliateId: string): Promise<PayoutRequest> {
  if (!isPayoutWindowOpen()) throw new Error(PAYOUT_WINDOW_CLOSED);

  const sql = getSql();
  const [affiliateRows, { balanceKobo }] = await Promise.all([
    sql`SELECT bank_verified_at FROM affiliates WHERE id = ${affiliateId}`,
    getAffiliateBalance(affiliateId),
  ]);
  if (!affiliateRows[0]?.bank_verified_at) throw new Error(PAYOUT_BANK_NOT_VERIFIED);
  if (balanceKobo <= 0) throw new Error(PAYOUT_NOTHING_TO_REQUEST);

  const rows = await sql`
    INSERT INTO payout_requests (affiliate_id, amount_kobo, window_key)
    VALUES (${affiliateId}, ${balanceKobo}, ${currentPayoutWindowKey()})
    ON CONFLICT (affiliate_id, window_key) DO NOTHING
    RETURNING *
  `;
  if (!rows[0]) throw new Error(PAYOUT_ALREADY_REQUESTED);
  return mapPayoutRequest(rows[0]);
}

export interface PendingPayoutRequest extends PayoutRequest {
  affiliateId: string;
  affiliateName: string;
  affiliateEmail: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export async function listPendingPayoutRequests(): Promise<PendingPayoutRequest[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT pr.*, a.name AS affiliate_name, a.email AS affiliate_email,
           a.bank_name, a.account_number, a.account_name
    FROM payout_requests pr
    JOIN affiliates a ON a.id = pr.affiliate_id
    WHERE pr.status = 'pending'
    ORDER BY pr.requested_at ASC
  `;
  return rows.map((row) => ({
    ...mapPayoutRequest(row),
    affiliateId: row.affiliate_id as string,
    affiliateName: row.affiliate_name as string,
    affiliateEmail: row.affiliate_email as string,
    bankName: (row.bank_name as string) ?? "",
    accountNumber: (row.account_number as string) ?? "",
    accountName: (row.account_name as string) ?? "",
  }));
}

/** Pays a pending request: records the actual payout (same ledger + the
 * same `recordPayout` the command center's manual "Record payout" form
 * uses, so it shows up identically in the affiliate's payout history),
 * then marks the request resolved. Two sequential statements rather than
 * a DB transaction — this driver's tagged-template mode has no
 * interactive transaction support, and a manual, one-off admin click here
 * carries the same acceptable risk window this codebase takes elsewhere
 * (see CHECKPOINT's "failure handling is deliberately simple" notes). */
export async function markPayoutRequestPaid(requestId: string, adminUserId: string, note: string): Promise<AffiliatePayout> {
  const sql = getSql();
  const rows = await sql`SELECT affiliate_id, amount_kobo FROM payout_requests WHERE id = ${requestId} AND status = 'pending'`;
  const row = rows[0];
  if (!row) throw new Error("That payout request was already resolved.");

  const payout = await recordPayout(row.affiliate_id as string, adminUserId, kobo(row.amount_kobo as string), note);
  await sql`UPDATE payout_requests SET status = 'paid', resolved_at = now(), admin_user_id = ${adminUserId} WHERE id = ${requestId} AND status = 'pending'`;
  return payout;
}

export async function declinePayoutRequest(requestId: string, adminUserId: string): Promise<void> {
  const sql = getSql();
  await sql`UPDATE payout_requests SET status = 'declined', resolved_at = now(), admin_user_id = ${adminUserId} WHERE id = ${requestId} AND status = 'pending'`;
}
