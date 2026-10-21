import "server-only";
import { getSql } from "./client";
import { kobo } from "./rows";
import { amountForMonth, SETUP_MONTHS } from "@/lib/ai/pricing";
import type { AdminInsightInput, InsightBusiness, InsightContract, InsightCalls } from "@/lib/admin-insights";

/**
 * The aggregate queries behind the admin reporting page.
 *
 * Each figure is counted in Postgres rather than by loading rows into the app: at
 * a few hundred businesses the difference is invisible, at a few thousand it is
 * the difference between a page that opens and one that times out. Every query is
 * a single scan with conditional aggregation.
 *
 * Nothing here reads tenant content — no customer names, no bookings, no chat
 * transcripts. Only counts and money. The admin has never been able to see inside
 * a business's records, and a reporting page is exactly where that boundary would
 * quietly erode.
 *
 * The whole thing is wrapped in the same shape the pure module expects, and every
 * query is allowed to fail: an operator opening the dashboard while one table is
 * mid-migration should see zeroes for that section, not a 500 on the page.
 */

/** Wraps a query so a missing table or column degrades to a default rather than
 * taking the page down. The row shape matters, so the fallback is explicit. */
async function safe<T>(query: Promise<T>, fallback: T, label: string): Promise<T> {
  try {
    return await query;
  } catch (err) {
    console.error(`admin-insights: ${label} query failed:`, err);
    return fallback;
  }
}

/** Sum of the schedule for months 1..paid, in kobo. */
function collectedFor(chargesPaid: number): number {
  let total = 0;
  for (let month = 1; month <= chargesPaid; month += 1) total += amountForMonth(month);
  return total;
}

/**
 * What the remaining setup months are worth.
 *
 * Only the launch package has a term. Once the six instalments are paid the
 * contract is month-to-month at the platform fee, so there is nothing "outstanding"
 * — counting a notional run-rate as money owed would inflate the figure an
 * operator uses to judge the business.
 */
function outstandingFor(chargesPaid: number, status: string): number {
  if (status !== "active" && status !== "past_due") return 0;
  let total = 0;
  for (let month = chargesPaid + 1; month <= SETUP_MONTHS; month += 1) total += amountForMonth(month);
  return total;
}

export async function loadInsightInput(): Promise<AdminInsightInput> {
  const sql = getSql();

  const [businessRows, contractRows, callRows, walletRows, prospectRows, affiliateRows, outreachRows] = await Promise.all([
    // Prospect tenants are real organizations, so they have to be separated here
    // or the growth chart claims customers that do not exist.
    safe(
      sql`
        SELECT o.created_at,
               COALESCE(bp.country_code, 'NG') AS country_code,
               COALESCE(bp.published, false) AS published,
               COALESCE(ia.subscription_status, 'inactive') AS subscription_status,
               COALESCE(o.is_prospect, false) AS is_prospect
        FROM organizations o
        LEFT JOIN business_profiles bp ON bp.organization_id = o.id
        LEFT JOIN infrastructure_accounts ia ON ia.organization_id = o.id
      `,
      [],
      "businesses",
    ),

    safe(
      sql`SELECT status, charges_paid, started_at FROM ai_receptionist_contracts`,
      [],
      "contracts",
    ),

    safe(
      sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE sms_sent_at IS NOT NULL)::int AS texts_sent,
          COUNT(*) FILTER (WHERE chat_session_id IS NOT NULL)::int AS chats_opened,
          COUNT(*) FILTER (WHERE recovered_booking_id IS NOT NULL)::int AS bookings,
          COALESCE(SUM(recovered_value_kobo), 0) AS recovered_kobo
        FROM missed_calls
      `,
      [],
      "missed calls",
    ),

    safe(
      sql`SELECT COALESCE(SUM(balance_kobo), 0) AS total_balance,
                 COUNT(*) FILTER (WHERE balance_kobo < 304000)::int AS empty_wallets
          FROM comm_wallet_balances`,
      [],
      "wallets",
    ),

    safe(
      sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'qualified')::int AS qualified,
          COUNT(*) FILTER (WHERE site_organization_id IS NOT NULL)::int AS sites_built,
          COUNT(*) FILTER (WHERE excluded_reason <> '')::int AS excluded,
          COUNT(*) FILTER (WHERE blocked_reason <> '')::int AS blocked,
          COUNT(*) FILTER (WHERE email_status IN ('valid', 'risky'))::int AS sendable_emails
        FROM prospects
      `,
      [],
      "prospects",
    ),

    safe(
      sql`
        SELECT
          (SELECT COUNT(*)::int FROM affiliates) AS applications,
          (SELECT COUNT(*)::int FROM affiliates WHERE status = 'active') AS approved,
          (SELECT COUNT(*)::int FROM affiliate_referrals) AS referrals,
          (SELECT COUNT(DISTINCT organization_id)::int FROM affiliate_earnings
             WHERE kind IN ('subscription', 'recurring')) AS converted_referrals,
          (SELECT COALESCE(SUM(commission_kobo), 0) FROM affiliate_earnings) AS earned_kobo,
          (SELECT COALESCE(SUM(commission_kobo), 0) FROM affiliate_earnings WHERE status = 'pending') AS pending_kobo,
          (SELECT COALESCE(SUM(amount_kobo), 0) FROM affiliate_payouts) AS paid_out_kobo
      `,
      [],
      "affiliates",
    ),

    safe(
      sql`SELECT COUNT(*)::int AS emails_sent FROM prospect_outreach WHERE status = 'sent'`,
      [],
      "outreach",
    ),
  ]);

  const businesses: InsightBusiness[] = (businessRows as Record<string, unknown>[]).map((row) => ({
    createdAt: new Date(row.created_at as string).toISOString(),
    published: Boolean(row.published),
    subscriptionStatus: (row.subscription_status as string) ?? "inactive",
    isProspect: Boolean(row.is_prospect),
    countryCode: (row.country_code as string) ?? "NG",
  }));

  /*
   * Contract money is derived from the schedule, not from a stored total.
   *
   * `charges_paid` is the count of months actually collected, by whatever route —
   * manual checkout, webhook, or automatic card charge — and the amount for each
   * month is deterministic (`amountForMonth`). `applyContractPayment` rejects an
   * underpayment, so every collected month equals its schedule amount. Deriving
   * it this way means the dashboard cannot disagree with the contract screen,
   * because both read the same function.
   */
  const contracts: InsightContract[] = (contractRows as Record<string, unknown>[]).map((row) => {
    const chargesPaid = Number(row.charges_paid ?? 0);
    const status = ((row.status as string) ?? "pending") as InsightContract["status"];
    return {
      status,
      chargesPaid,
      setupMonths: SETUP_MONTHS,
      collectedKobo: collectedFor(chargesPaid),
      outstandingKobo: outstandingFor(chargesPaid, status),
      startedAt: row.started_at ? new Date(row.started_at as string).toISOString() : null,
    };
  });

  const callRow = ((callRows as Record<string, unknown>[])[0] ?? {}) as Record<string, unknown>;
  const calls: InsightCalls = {
    total: Number(callRow.total ?? 0),
    textsSent: Number(callRow.texts_sent ?? 0),
    chatsOpened: Number(callRow.chats_opened ?? 0),
    bookings: Number(callRow.bookings ?? 0),
    recoveredKobo: kobo(callRow.recovered_kobo as string),
  };

  const walletRow = ((walletRows as Record<string, unknown>[])[0] ?? {}) as Record<string, unknown>;
  const prospectRow = ((prospectRows as Record<string, unknown>[])[0] ?? {}) as Record<string, unknown>;
  const affiliateRow = ((affiliateRows as Record<string, unknown>[])[0] ?? {}) as Record<string, unknown>;
  const outreachRow = ((outreachRows as Record<string, unknown>[])[0] ?? {}) as Record<string, unknown>;

  return {
    businesses,
    contracts,
    calls,
    wallet: {
      totalBalanceKobo: kobo(walletRow.total_balance as string),
      emptyWallets: Number(walletRow.empty_wallets ?? 0),
    },
    prospects: {
      total: Number(prospectRow.total ?? 0),
      qualified: Number(prospectRow.qualified ?? 0),
      sitesBuilt: Number(prospectRow.sites_built ?? 0),
      emailsSent: Number(outreachRow.emails_sent ?? 0),
      blocked: Number(prospectRow.blocked ?? 0),
      excluded: Number(prospectRow.excluded ?? 0),
      sendableEmails: Number(prospectRow.sendable_emails ?? 0),
    },
    affiliates: {
      applications: Number(affiliateRow.applications ?? 0),
      approved: Number(affiliateRow.approved ?? 0),
      referrals: Number(affiliateRow.referrals ?? 0),
      convertedReferrals: Number(affiliateRow.converted_referrals ?? 0),
      earnedKobo: kobo(affiliateRow.earned_kobo as string),
      pendingKobo: kobo(affiliateRow.pending_kobo as string),
      paidOutKobo: kobo(affiliateRow.paid_out_kobo as string),
    },
  };
}
