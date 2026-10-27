/** Read-only production readiness check. Never creates payments, messages or accounts. */
import { neon } from "@neondatabase/serverless";
const names = [
  "DATABASE_URL",
  "RESEND_API_KEY",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "CRON_SECRET",
  "PAYSTACK_SECRET_KEY",
  "BLOB_READ_WRITE_TOKEN",
];
const report = {
  checkedAt: new Date().toISOString(),
  configuration: Object.fromEntries(
    names.map((n) => [n, Boolean(process.env[n])]),
  ),
  database: null,
  limitations: [
    "Email inbox delivery, browser notification receipt and a real payment callback need an authorized test account/device; this command does not send messages or move money.",
  ],
};
if (process.env.DATABASE_URL) {
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql.query(
      `SELECT to_regclass('public.distribution_product_costs') IS NOT NULL native_commissions,to_regclass('public.distribution_contract_payout_terms') IS NOT NULL payout_snapshots,to_regclass('public.affiliate_invitations') IS NOT NULL invitations,to_regclass('public.affiliate_campaigns') IS NOT NULL campaigns,to_regclass('public.affiliate_activity') IS NOT NULL activity,EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='partner_commercial_quotes' AND column_name='invoice_id') reseller_checkout,EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='distribution_program_notices' AND column_name='push_delivered_at') programme_push`,
    );
    report.database = rows[0];
    if (Object.values(rows[0]).every(Boolean)) {
      const checks = (
        await sql.query(
          `SELECT (SELECT count(*)::int FROM distribution_policies WHERE code IN('proposed-affiliate-v2','proposed-partner-v2') AND state='DRAFT') draft_policy_count,(SELECT count(*)::int FROM distribution_assets WHERE seed_key IS NOT NULL) seeded_materials,(SELECT count(*)::int FROM distribution_program_notices WHERE delivered_at IS NULL AND suppressed_at IS NULL AND attempts>=10) exhausted_email_retries,(SELECT count(*)::int FROM distribution_program_notices WHERE push_delivered_at IS NULL AND push_attempts>=10) exhausted_push_retries`,
        )
      )[0];
      Object.assign(report.database, checks);
    }
  } catch {
    report.database = {
      error:
        "Database connection or readiness query failed; inspect secure deployment logs.",
    };
  }
}
console.log(JSON.stringify(report, null, 2));
if (
  report.database?.draft_policy_count !== 2 ||
  report.database?.seeded_materials < 27 ||
  report.database?.exhausted_email_retries > 0 ||
  report.database?.exhausted_push_retries > 0 ||
  !Object.values(report.configuration).every(Boolean) ||
  !report.database ||
  report.database.error ||
  Object.values(report.database).some((v) => v === false)
)
  process.exitCode = 1;
