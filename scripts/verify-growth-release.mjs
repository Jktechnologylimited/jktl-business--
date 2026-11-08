/** Read-only release verification. Does not migrate, email, publish, charge or create test users. */
import { Client } from "pg";
if (process.env.JKTL_VERIFY_DEPLOYED !== "yes") {
  console.error(
    "Not run: deployment verification is on hold. After an authorized release, explicitly set JKTL_VERIFY_DEPLOYED=yes.",
  );
  process.exit(2);
}
if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL is required through secure environment settings.",
  );
  process.exit(2);
}
const db = new Client({ connectionString: process.env.DATABASE_URL });
let failed = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "REVIEW"} ${name}: ${detail}`);
  if (!ok) failed++;
};
try {
  await db.connect();
  await db.query("BEGIN READ ONLY");
  const tables = [
    "activation_milestones",
    "growth_signals",
    "growth_visits",
    "growth_recurring_snapshots",
    "growth_acquisition_costs",
    "growth_operational_checks",
  ];
  for (const table of tables) {
    const { rows } = await db.query(
      "SELECT to_regclass('public.'||$1) present",
      [table],
    );
    check(table, Boolean(rows[0].present), "schema presence only");
  }
  const { rows: accounts } = await db.query(
    "SELECT count(*) n FROM lifecycle_current",
  );
  console.log(
    `Registered eligible accounts: ${accounts[0].n} (not compared to a hardcoded target)`,
  );
  const { rows: jobs } = await db.query(
    "SELECT last_scan_at,last_dispatch_at FROM lifecycle_settings WHERE id=true",
  );
  for (const field of ["last_scan_at", "last_dispatch_at"])
    check(
      field,
      Boolean(
        jobs[0]?.[field] &&
        Date.now() - new Date(jobs[0][field]).getTime() < 48 * 3600000,
      ),
      "must be observed within 48 hours",
    );
  const { rows: snapshots } = await db.query(
    "SELECT max(created_at) latest FROM growth_recurring_snapshots",
  );
  check(
    "recurring snapshot freshness",
    Boolean(
      snapshots[0]?.latest &&
      Date.now() - new Date(snapshots[0].latest).getTime() < 48 * 3600000,
    ),
    "latest scheduled evidence within 48 hours",
  );
  const { rows: checks } = await db.query(
    "SELECT kind,verified_at FROM growth_operational_checks",
  );
  for (const kind of ["BACKUP_RESTORE", "MONITORING", "WEBHOOK", "SCHEDULER"]) {
    const row = checks.find((r) => r.kind === kind);
    check(
      kind,
      Boolean(
        row && Date.now() - new Date(row.verified_at).getTime() < 30 * 86400000,
      ),
      "requires recent concrete team verification; this script does not perform a restore or provider transaction",
    );
  }
  const { rows: mail } = await db.query(
    "SELECT count(*) n FROM lifecycle_events WHERE state='UNKNOWN' OR(state='FAILED' AND attempts>=3)",
  );
  check(
    "unresolved mail review",
    Number(mail[0].n) === 0,
    "review queue count " + mail[0].n,
  );
  await db.query("ROLLBACK");
  const origin =
    process.env.JKTL_VERIFY_ORIGIN || "https://business.jktl.com.ng";
  if (new URL(origin).hostname !== "business.jktl.com.ng")
    throw Error("Use the approved Business production origin.");
  for (const route of [
    "/login",
    "/signup",
    "/partners/login",
    "/affiliates/login",
  ]) {
    const r = await fetch(origin + route, {
      signal: AbortSignal.timeout(10000),
      redirect: "manual",
    });
    check(route, r.status === 200, `HTTP ${r.status}`);
  }
  console.log(
    "No write, mail, checkout, deployment or real-account login was performed. Provider webhook signatures, bank settlement, alert routing and restore success require their own recorded operational evidence.",
  );
} catch {
  console.error(
    "Verification could not complete. Check secure bindings and source coverage; no secret details printed.",
  );
  failed++;
} finally {
  await db.end().catch(() => {});
}
process.exitCode = failed ? 1 : 0;
